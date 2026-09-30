import { createCipheriv, createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/**
 * La pasarela del banco: Redsys, el TPV virtual de casi toda la banca
 * española. Con él se cobra con tarjeta y, si el banco lo tiene contratado,
 * con Bizum.
 *
 * Cómo va un pago: la web manda al hermano a la página de Redsys con los datos
 * del pedido firmados; allí paga, y Redsys avisa al servidor con otro mensaje
 * firmado. **Solo ese aviso** da un recibo por pagado: la vuelta del navegador
 * a la web la puede escribir cualquiera.
 *
 * La firma es la de Redsys (HMAC_SHA256_V1): con la clave del comercio se cifra
 * el número de pedido en 3DES y el resultado es la clave del HMAC-SHA256 de los
 * parámetros en base64. Así una firma no sirve para otro pedido.
 *
 * Aquí solo hay cuentas y cadenas; lo que toca la base está en
 * `services/pagos/pago-en-linea.service.ts`.
 */

export type ModoDePago = 'redsys' | 'simulado';

/**
 * Cómo se paga en línea, o null si no se paga. `PAGO_EN_LINEA=redsys` es el
 * banco de verdad (o su entorno de pruebas, según `REDSYS_ENTORNO`);
 * `simulado` da el pago por hecho sin mover dinero, para desarrollar sin
 * banco; `no` lo apaga. Sin la variable, en producción está apagado y fuera
 * de ella, simulado: que un olvido en el servidor no cobre de mentira.
 */
export function modoDePago(env: Record<string, string | undefined> = process.env): ModoDePago | null {
  if (env.PAGO_EN_LINEA === 'redsys') return 'redsys';
  if (env.PAGO_EN_LINEA === 'simulado') return 'simulado';
  if (env.PAGO_EN_LINEA !== undefined) return null;
  return env.NODE_ENV === 'production' ? null : 'simulado';
}

/**
 * Las claves públicas del entorno de pruebas de Redsys, las que publica en su
 * documentación. No cobran: con ellas se prueba todo el camino (la tarjeta de
 * pruebas es 4548 8100 0000 0003, caducidad 12/49, CVV 123).
 */
const PRUEBAS = { comercio: '999008881', terminal: '1', clave: 'sq7HjrUOBfKmC576ILgskD5srU870gJ7' };

const URL_TPV = {
  pruebas: 'https://sis-t.redsys.es:25443/sis/realizarPago',
  real: 'https://sis.redsys.es/sis/realizarPago',
} as const;

export interface ConfiguracionRedsys {
  entorno: 'pruebas' | 'real';
  url: string;
  comercio: string;
  terminal: string;
  clave: string;
  /** Si el comercio tiene Bizum contratado. */
  bizum: boolean;
}

/**
 * Los datos del comercio. En pruebas, sin claves propias, valen las públicas
 * de Redsys; en el entorno real no hay valor por defecto (lo comprueba
 * `config/entorno.ts` al arrancar).
 */
export function configuracionRedsys(env: Record<string, string | undefined> = process.env): ConfiguracionRedsys {
  const entorno = env.REDSYS_ENTORNO === 'real' ? 'real' : 'pruebas';
  const propias = Boolean(env.REDSYS_COMERCIO && env.REDSYS_CLAVE);
  if (entorno === 'real' && !propias) throw new Error('Faltan REDSYS_COMERCIO y REDSYS_CLAVE para cobrar con el banco.');
  return {
    entorno,
    url: URL_TPV[entorno],
    comercio: propias ? env.REDSYS_COMERCIO!.trim() : PRUEBAS.comercio,
    terminal: (propias ? env.REDSYS_TERMINAL?.trim() : undefined) || PRUEBAS.terminal,
    clave: propias ? env.REDSYS_CLAVE!.trim() : PRUEBAS.clave,
    bizum: env.REDSYS_BIZUM === 'si',
  };
}

/**
 * Lo que la web necesita saber para ofrecer el pago: con qué se puede pagar y
 * si es de pruebas (entonces avisa de que no se cobra de verdad). Null si no
 * hay pago en línea.
 */
export function pagoParaLaWeb(env: Record<string, string | undefined> = process.env): { metodos: Array<'TARJETA' | 'BIZUM'>; pruebas: boolean } | null {
  const modo = modoDePago(env);
  if (!modo) return null;
  if (modo === 'simulado') return { metodos: ['TARJETA'], pruebas: true };
  const c = configuracionRedsys(env);
  return { metodos: c.bizum ? ['TARJETA', 'BIZUM'] : ['TARJETA'], pruebas: c.entorno === 'pruebas' };
}

/** Si una clave de comercio tiene la forma que da el banco: base64 de 24 bytes. */
export const claveRedsysValida = (clave: string) => /^[A-Za-z0-9+/]{32}$/.test(clave.trim());

/**
 * Un número de pedido: 12 caracteres, los 4 primeros cifras (lo exige Redsys).
 * El id del pago da el orden y cuatro letras al azar evitan repetir un pedido
 * que el banco ya vio si algún día la base empieza de cero.
 */
export function numeroDePedido(id: number): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const azar = Array.from({ length: 4 }, () => letras[randomInt(letras.length)]).join('');
  return String(id).padStart(8, '0').slice(-8) + azar;
}

function claveDelPedido(clave: string, pedido: string): Buffer {
  const cifrado = createCipheriv('des-ede3-cbc', Buffer.from(clave, 'base64'), Buffer.alloc(8, 0));
  cifrado.setAutoPadding(false);
  // Redsys rellena con ceros hasta múltiplo de 8, no con PKCS#7.
  const relleno = Buffer.alloc(Math.ceil(pedido.length / 8) * 8, 0);
  relleno.write(pedido, 'utf8');
  return Buffer.concat([cifrado.update(relleno), cifrado.final()]);
}

/** La firma de unos parámetros ya en base64, en base64 normal. */
export function firmar(parametros: string, pedido: string, clave: string): string {
  return createHmac('sha256', claveDelPedido(clave, pedido)).update(parametros).digest('base64');
}

/** El base64 «seguro para URL» que usa Redsys en sus avisos, sin relleno, para comparar. */
const normalizar = (firma: string) => firma.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export interface PeticionDePago {
  pedido: string;
  /** En céntimos. */
  centimos: number;
  metodo: 'TARJETA' | 'BIZUM';
  descripcion: string;
  urlAviso: string;
  /** Adónde vuelve el hermano si pagó, y si no se hizo el pago (el banco no avisa entonces). */
  urlVuelta: string;
  urlFallo: string;
}

/** Lo que la web manda a Redsys en un formulario: la URL y los tres campos. */
export interface FormularioRedsys {
  url: string;
  campos: { Ds_SignatureVersion: string; Ds_MerchantParameters: string; Ds_Signature: string };
}

export function formularioDePago(p: PeticionDePago, c: ConfiguracionRedsys): FormularioRedsys {
  const datos: Record<string, string> = {
    DS_MERCHANT_AMOUNT: String(p.centimos),
    DS_MERCHANT_ORDER: p.pedido,
    DS_MERCHANT_MERCHANTCODE: c.comercio,
    DS_MERCHANT_CURRENCY: '978',
    DS_MERCHANT_TRANSACTIONTYPE: '0',
    DS_MERCHANT_TERMINAL: c.terminal,
    DS_MERCHANT_MERCHANTURL: p.urlAviso,
    DS_MERCHANT_URLOK: p.urlVuelta,
    DS_MERCHANT_URLKO: p.urlFallo,
    DS_MERCHANT_PRODUCTDESCRIPTION: p.descripcion.slice(0, 125),
    DS_MERCHANT_CONSUMERLANGUAGE: '001',
    // «C» solo tarjeta, «z» solo Bizum: el hermano ya eligió en la web.
    DS_MERCHANT_PAYMETHODS: p.metodo === 'BIZUM' ? 'z' : 'C',
  };
  const parametros = Buffer.from(JSON.stringify(datos), 'utf8').toString('base64');
  return {
    url: c.url,
    campos: { Ds_SignatureVersion: 'HMAC_SHA256_V1', Ds_MerchantParameters: parametros, Ds_Signature: firmar(parametros, p.pedido, c.clave) },
  };
}

export interface AvisoDelBanco {
  pedido: string;
  centimos: number;
  respuesta: string;
  autorizacion: string | null;
  /** Si el banco cobró: respuesta de 0000 a 0099. */
  cobrado: boolean;
}

/**
 * Lee el aviso que Redsys manda al servidor. Devuelve null si la firma no
 * cuadra o falta algo: un aviso así no es del banco y no se toca nada.
 */
export function leerAviso(cuerpo: Record<string, unknown>, clave: string): AvisoDelBanco | null {
  const parametros = cuerpo.Ds_MerchantParameters;
  const firma = cuerpo.Ds_Signature;
  if (typeof parametros !== 'string' || typeof firma !== 'string' || !parametros || !firma) return null;
  let datos: Record<string, unknown>;
  try {
    datos = JSON.parse(Buffer.from(parametros, 'base64').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
  // Redsys escribe los nombres con mayúsculas variables según el producto.
  const leer = (nombre: string) => {
    const k = Object.keys(datos).find((x) => x.toLowerCase() === nombre.toLowerCase());
    const v = k === undefined ? undefined : datos[k];
    return typeof v === 'string' || typeof v === 'number' ? decodeURIComponent(String(v)) : null;
  };
  const pedido = leer('Ds_Order');
  const importe = leer('Ds_Amount');
  const respuesta = leer('Ds_Response');
  if (!pedido || !importe || !respuesta || !/^\d+$/.test(importe) || !/^\d{1,4}$/.test(respuesta)) return null;

  const esperada = Buffer.from(normalizar(firmar(parametros, pedido, clave)));
  const llegada = Buffer.from(normalizar(firma));
  if (esperada.length !== llegada.length || !timingSafeEqual(esperada, llegada)) return null;

  const codigo = Number(respuesta);
  const autorizacion = leer('Ds_AuthorisationCode')?.trim() || null;
  return { pedido, centimos: Number(importe), respuesta: respuesta.padStart(4, '0'), autorizacion, cobrado: codigo >= 0 && codigo <= 99 };
}
