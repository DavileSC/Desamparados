/**
 * Validación del entorno al arrancar el servidor.
 *
 * Casi todo el endurecimiento del backend depende de `NODE_ENV=production`:
 * la cookie `Secure`, HSTS, la longitud mínima de `JWT_SECRET`, las
 * contraseñas aleatorias de la siembra, el CORS cerrado... Si esa variable se
 * olvida en el servidor, nada falla: todo funciona «bien» y todo queda abierto.
 * Y lo mismo con `FRONTEND_URL` o `API_URL`, que sin definir caen en
 * `localhost` y rompen los enlaces de los correos sin avisar.
 *
 * Por eso el arranque se niega a continuar si falta algo, con la lista
 * completa de lo que falta (no de una en una, que obliga a reiniciar diez
 * veces). Se llama desde `src/index.ts` y NO al importar `app`: los tests
 * importan `app` directamente y no deben necesitar un entorno de producción.
 *
 * Pura (recibe el entorno) para poder probar el caso de producción sin tocar
 * `process.env`.
 */

type Entorno = Record<string, string | undefined>;

export const ENTORNOS_VALIDOS = ['development', 'test', 'production'] as const;
export type NombreEntorno = (typeof ENTORNOS_VALIDOS)[number];

export interface ResultadoEntorno {
  /** Motivos por los que el servidor no debe arrancar. Vacío si todo está bien. */
  errores: string[];
  /** Cosas que no impiden arrancar pero conviene saber. */
  avisos: string[];
}

/** Interfaz por defecto en producción: solo nginx, en la misma máquina, llega al puerto. */
export const HOST_PRODUCCION = '127.0.0.1';
export const PUERTO_POR_DEFECTO = 3001;

import { claveRedsysValida } from '../domain/redsys.js';
import { leerAcreedorSepa } from '../domain/sepa.js';

const definida = (valor: string | undefined): valor is string =>
  valor !== undefined && valor.trim() !== '';

function esEnteroEnRango(valor: string, min: number, max: number): boolean {
  if (!/^\d+$/.test(valor.trim())) return false;
  const n = Number(valor);
  return n >= min && n <= max;
}

function esUrlHttps(valor: string): boolean {
  try {
    return new URL(valor).protocol === 'https:';
  } catch {
    return false;
  }
}

export function validarEntorno(entorno: Entorno = process.env): ResultadoEntorno {
  const errores: string[] = [];
  const avisos: string[] = [];

  // --- En cualquier entorno ---

  const nodeEnv = entorno.NODE_ENV?.trim();
  if (!definida(nodeEnv)) {
    errores.push(
      'NODE_ENV no está definida. Pon NODE_ENV=development en tu equipo y NODE_ENV=production en el servidor: ' +
      'sin ella el backend se comporta como en desarrollo (cookies sin Secure, sin HSTS, contraseñas de la siembra del repositorio).'
    );
  } else if (!(ENTORNOS_VALIDOS as readonly string[]).includes(nodeEnv)) {
    errores.push(
      `NODE_ENV="${nodeEnv}" no es un valor conocido. Usa ${ENTORNOS_VALIDOS.join(', ')}: ` +
      'cualquier otro valor (por ejemplo "prod") se trataría como desarrollo.'
    );
  }

  if (definida(entorno.PORT) && !esEnteroEnRango(entorno.PORT, 1, 65535)) {
    errores.push(`PORT="${entorno.PORT}" no es un puerto válido (1-65535).`);
  }

  if (definida(entorno.LIMITE_GLOBAL_POR_IP) && !esEnteroEnRango(entorno.LIMITE_GLOBAL_POR_IP, 1, 10_000_000)) {
    errores.push(`LIMITE_GLOBAL_POR_IP="${entorno.LIMITE_GLOBAL_POR_IP}" debe ser un número entero positivo (peticiones por IP cada 15 minutos).`);
  }

  if (definida(entorno.NUM_PROXIES) && !esEnteroEnRango(entorno.NUM_PROXIES, 0, 10)) {
    errores.push(`NUM_PROXIES="${entorno.NUM_PROXIES}" debe ser un número entero (0 sin proxy, 1 detrás de nginx).`);
  }

  // clamd.ts rechaza TODAS las subidas si el valor no es exactamente true o
  // false: mejor saberlo al arrancar que cuando alguien intente subir una foto.
  const clamavRequired = entorno.CLAMAV_REQUIRED?.trim().toLowerCase();
  if (definida(clamavRequired) && clamavRequired !== 'true' && clamavRequired !== 'false') {
    errores.push(`CLAMAV_REQUIRED="${entorno.CLAMAV_REQUIRED}" debe ser true o false.`);
  }

  if (definida(entorno.AUDIT_RETENTION_DAYS) && !esEnteroEnRango(entorno.AUDIT_RETENTION_DAYS, 30, 100000)) {
    errores.push(`AUDIT_RETENTION_DAYS="${entorno.AUDIT_RETENTION_DAYS}" debe ser un número entero de días, 30 o más.`);
  }

  // El pago en línea: un valor mal escrito apagaría el pago sin decir nada, y
  // unas claves del banco mal copiadas se descubrirían con el primer hermano
  // que intentara pagar.
  const pago = entorno.PAGO_EN_LINEA;
  if (definida(pago) && !['redsys', 'simulado', 'no'].includes(pago)) {
    errores.push(`PAGO_EN_LINEA="${pago}" debe ser redsys, simulado o no.`);
  }
  if (definida(entorno.REDSYS_ENTORNO) && !['pruebas', 'real'].includes(entorno.REDSYS_ENTORNO)) {
    errores.push(`REDSYS_ENTORNO="${entorno.REDSYS_ENTORNO}" debe ser pruebas o real.`);
  }
  if (pago === 'redsys') {
    if (entorno.REDSYS_ENTORNO === 'real' && (!definida(entorno.REDSYS_COMERCIO) || !definida(entorno.REDSYS_CLAVE))) {
      errores.push('Con REDSYS_ENTORNO=real hacen falta REDSYS_COMERCIO y REDSYS_CLAVE (los da el banco al contratar el TPV virtual).');
    }
    if (definida(entorno.REDSYS_CLAVE) && !claveRedsysValida(entorno.REDSYS_CLAVE)) {
      errores.push('REDSYS_CLAVE no tiene la forma de una clave de Redsys (32 caracteres en base64): cópiala entera del portal del banco.');
    }
    if (definida(entorno.REDSYS_COMERCIO) && !/^\d{1,9}$/.test(entorno.REDSYS_COMERCIO.trim())) {
      errores.push(`REDSYS_COMERCIO="${entorno.REDSYS_COMERCIO}" debe ser el número de comercio (FUC), solo cifras.`);
    }
    if (definida(entorno.REDSYS_TERMINAL) && !esEnteroEnRango(entorno.REDSYS_TERMINAL, 1, 999)) {
      errores.push(`REDSYS_TERMINAL="${entorno.REDSYS_TERMINAL}" debe ser el número de terminal (normalmente 1).`);
    }
  }

  // Las remesas SEPA: si se empiezan a rellenar los datos del acreedor, que
  // estén todos y bien. Un identificador mal copiado no falla al generar el
  // fichero: lo rechaza el banco días después, con la remesa entera.
  if (Object.keys(entorno).some((nombre) => nombre.startsWith('SEPA_ACREEDOR_') && definida(entorno[nombre]))) {
    errores.push(...leerAcreedorSepa(entorno).problemas);
  }

  if (nodeEnv !== 'production') return { errores, avisos };

  // --- Solo en producción ---

  const obligatorias: Array<[string, string]> = [
    ['FRONTEND_URL', 'origen de la web; sin él el CORS queda cerrado y los enlaces de los correos apuntan a localhost'],
    ['API_URL', 'base de las URL de los archivos subidos; sin ella apuntan a localhost'],
    ['EMAIL_USER', 'cuenta desde la que salen los correos (altas, recibos, recuperación de contraseña)'],
    ['EMAIL_PASS', 'contraseña de esa cuenta de correo'],
    ['NUM_PROXIES', 'cuántos proxies hay delante (1 detrás de nginx); se exige explícita porque un valor equivocado deja falsear la IP ante los limitadores'],
    ['JWT_SECRET', 'firma de las sesiones; genera uno con npm run gen:secret'],
    ['TOTP_ENC_KEY', 'clave de cifrado del secreto del doble factor; genera una con npm run gen:clave-totp'],
    ['CLAMAV_HOST', 'dirección de clamd; sin ella las subidas se aceptan sin analizar'],
  ];
  for (const [nombre, motivo] of obligatorias) {
    if (!definida(entorno[nombre])) errores.push(`Falta ${nombre} (${motivo}).`);
  }

  // Un pago de mentira en producción da recibos por pagados sin que entre un
  // euro, y con solo un aviso en el registro nadie lo ve hasta el arqueo. Se
  // corta el arranque; la web de pruebas, que también corre como producción,
  // lo pide por escrito con PAGO_DE_PRUEBA_EN_PRODUCCION=si.
  const pagoDePrueba = pago === 'simulado' || (pago === 'redsys' && entorno.REDSYS_ENTORNO !== 'real');
  const pruebaConsentida = entorno.PAGO_DE_PRUEBA_EN_PRODUCCION?.trim() === 'si';
  if (pagoDePrueba && pruebaConsentida) {
    avisos.push('El pago en línea está en pruebas: los hermanos pueden pagar, pero no se cobra de verdad (PAGO_EN_LINEA / REDSYS_ENTORNO).');
  } else if (pagoDePrueba) {
    errores.push(
      'El pago en línea está en pruebas en producción (PAGO_EN_LINEA=simulado, o redsys sin REDSYS_ENTORNO=real): ' +
      'los recibos se darían por pagados sin cobrar. Si es la web de pruebas, añade PAGO_DE_PRUEBA_EN_PRODUCCION=si.'
    );
  }

  for (const nombre of ['FRONTEND_URL', 'API_URL']) {
    const valor = entorno[nombre];
    if (definida(valor) && !esUrlHttps(valor)) {
      errores.push(`${nombre}="${valor}" debe ser una URL https: la cookie de sesión lleva Secure y por http no viajaría.`);
    }
  }

  if (definida(entorno.JWT_SECRET) && entorno.JWT_SECRET.length < 32) {
    errores.push('JWT_SECRET es demasiado corto: en producción hacen falta al menos 32 caracteres (npm run gen:secret).');
  }

  if (definida(entorno.TOTP_ENC_KEY) && !/^[0-9a-f]{64}$/i.test(entorno.TOTP_ENC_KEY.trim())) {
    errores.push('TOTP_ENC_KEY debe tener exactamente 64 caracteres hexadecimales (32 bytes): npm run gen:clave-totp.');
  }

  // La anterior solo existe durante una rotación: se lee con ella y se escribe
  // con la nueva hasta que el script lo haya pasado todo. Mal escrita, los
  // secretos que dependen de ella serían ilegibles sin que nada avisara.
  if (definida(entorno.TOTP_ENC_KEY_ANTERIOR)) {
    const anterior = entorno.TOTP_ENC_KEY_ANTERIOR.trim();
    if (!/^[0-9a-f]{64}$/i.test(anterior)) {
      errores.push('TOTP_ENC_KEY_ANTERIOR debe tener exactamente 64 caracteres hexadecimales (32 bytes): es la TOTP_ENC_KEY de antes de rotarla.');
    } else if (anterior.toLowerCase() === entorno.TOTP_ENC_KEY?.trim().toLowerCase()) {
      errores.push('TOTP_ENC_KEY_ANTERIOR es igual que TOTP_ENC_KEY: en una rotación, la anterior es la clave vieja y TOTP_ENC_KEY la nueva.');
    } else {
      avisos.push(
        'TOTP_ENC_KEY_ANTERIOR está definida: rotación de la clave del doble factor en curso. ' +
        'Ejecuta npm run 2fa:cifrar-secretos y, cuando termine sin secretos ilegibles, quítala.'
      );
    }
  }

  // Con CLAMAV_HOST definido, un clamd caído ya rechaza las subidas aunque
  // CLAMAV_REQUIRED sea false. Se exige true de todos modos para que la
  // intención quede escrita y no dependa de ese detalle de clamd.ts.
  if (clamavRequired !== 'true') {
    errores.push('CLAMAV_REQUIRED debe ser true en producción: ningún archivo se publica sin pasar por el antivirus.');
  }

  if (definida(entorno.NUM_PROXIES) && entorno.NUM_PROXIES.trim() === '0') {
    avisos.push('NUM_PROXIES=0 en producción: si hay un nginx delante, todas las visitas compartirán la IP 127.0.0.1 y un único cupo en los limitadores.');
  }

  if (definida(entorno.HOST) && !['127.0.0.1', '::1', 'localhost'].includes(entorno.HOST.trim())) {
    avisos.push(
      `HOST=${entorno.HOST}: la API escucha fuera de la propia máquina. Si su puerto es alcanzable sin pasar por nginx, ` +
      'cualquiera puede falsear X-Forwarded-For y saltarse los limitadores. Ciérralo en el cortafuegos.'
    );
  }

  return { errores, avisos };
}

/**
 * Interfaz en la que escucha el servidor. En producción, solo local: nginx está
 * en la misma máquina y es el único que debe llegar a Node. Con `trust proxy`
 * activado, un puerto de Node alcanzable desde fuera deja a cualquiera mandar
 * un `X-Forwarded-For` inventado y estrenar cupo en cada petición.
 *
 * En desarrollo NO se restringe: el proxy de Vite apunta a `localhost`, que en
 * Windows puede resolver a `::1`, y escuchando solo en 127.0.0.1 no llegaría.
 * `undefined` hace que Node escuche en todas las interfaces, IPv4 e IPv6.
 */
export function hostDeEscucha(entorno: Entorno = process.env): string | undefined {
  if (definida(entorno.HOST)) return entorno.HOST.trim();
  return entorno.NODE_ENV?.trim() === 'production' ? HOST_PRODUCCION : undefined;
}

export function puertoDeEscucha(entorno: Entorno = process.env): number {
  return definida(entorno.PORT) ? Number(entorno.PORT) : PUERTO_POR_DEFECTO;
}

/**
 * Lanza con un mensaje que enumera todo lo que falta. Los avisos se escriben
 * en el registro y no detienen el arranque.
 */
export function comprobarEntorno(entorno: Entorno = process.env): void {
  const { errores, avisos } = validarEntorno(entorno);
  for (const aviso of avisos) console.warn(`⚠️  [Entorno] ${aviso}`);
  if (errores.length > 0) {
    throw new Error(
      `El servidor no arranca: el entorno tiene ${errores.length} problema(s).\n` +
      errores.map((e) => `  - ${e}`).join('\n') +
      '\nRevisa el .env (plantilla en .env.example) o las variables del servicio.'
    );
  }
}
