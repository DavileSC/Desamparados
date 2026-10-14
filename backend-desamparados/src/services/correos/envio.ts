/**
 * Por dónde salen los correos: la cuenta de la casa, la cuenta aparte del
 * formulario de contacto y el envío en sí, que nunca lanza —un correo que no
 * sale no puede tumbar el alta de un hermano— y deja el fallo en la auditoría.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { enmascararEmail } from '../../utils/log-privacidad.js';
import { buzonDePruebas, buzonPedido, type CorreoParaBuzon } from '../../utils/buzon-pruebas.js';
import { AuditoriaService, ACCIONES_AUDITORIA } from '../auditoria.service.js';
import { aTexto, imagenesDe } from './plantilla.js';
import { esDireccionDeNadie } from '../../domain/cuenta-de-custodia.js';
import { identidad } from '../../domain/datos-entidad.js';

/**
 * Lo único que `EmailService` necesita de un transporte. Lo cumplen tanto el de
 * nodemailer como el buzón de pruebas, así que el motor de envío no tiene que
 * saber cuál de los dos tiene delante.
 */
export interface TransporteDeCorreo {
  sendMail(correo: CorreoParaBuzon): Promise<unknown>;
}

/** La cuenta aparte del formulario de contacto, ya resuelta. */
interface CuentaDeContacto {
  transporter: Transporter;
  usuario: string;
}

/**
 * Se resuelve en el primer envío y no al importar: el buzón de pruebas se
 * decide con EMAIL_BUZON_PRUEBAS, y leyéndola al importar el módulo quedaba
 * fijada antes de que `dotenv` terminara de cargar el .env.
 */
let transporteGuardado: TransporteDeCorreo | undefined;

function transporte(): TransporteDeCorreo {
  if (transporteGuardado) return transporteGuardado;

  if (process.env.NODE_TEST_CONTEXT !== undefined) {
    // Dentro de `node --test` nunca se sale a la red, aunque el .env tenga una
    // cuenta de verdad: con una, cada aprobación, rechazo o baja de los tests
    // intentaba entrar en Gmail y la suite se quedaba colgada durante horas.
    // Los tests que miran el correo ponen su propio transporte (ponerTransporte).
    transporteGuardado = {
      sendMail: () => Promise.reject(new Error('Envío de correo desactivado dentro de los tests.')),
    };
  } else if (buzonPedido()) {
    console.log('📬 [Email] EMAIL_BUZON_PRUEBAS activo: los correos se escriben en storage/correos y no se envían.');
    transporteGuardado = buzonDePruebas();
  } else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporteGuardado = nodemailer.createTransport(opcionesDelServidor(process.env));
  } else {
    // Sin cuenta configurada NO se abre conexión: se falla en el acto.
    //
    // Antes se creaba igualmente el transporte de Gmail con credenciales
    // vacías, y cada envío se quedaba esperando al SMTP hasta agotar el
    // tiempo. Desde que aprobar, rechazar y dar de baja mandan correo, eso
    // colgaba la suite de tests entera —cinco ficheros hacen esas
    // operaciones— y habría colgado también al CI, que no tiene ningún .env.
    //
    // En producción no puede darse: `config/entorno.ts` exige EMAIL_USER y
    // EMAIL_PASS para que el servidor arranque.
    transporteGuardado = {
      sendMail: () => Promise.reject(new Error(
        'No hay cuenta de correo configurada (faltan EMAIL_USER y EMAIL_PASS). ' +
        'Para revisar los correos en local, pon EMAIL_BUZON_PRUEBAS=true.'
      )),
    };
  }
  return transporteGuardado;
}

type Entorno = Readonly<Record<string, string | undefined>>;

/**
 * Por qué servidor sale el correo. Sin EMAIL_SMTP_HOST, Gmail, como siempre.
 * Con él, un servicio de envío (Brevo): Gmail deja unos 500 al día y saca los
 * correos con la dirección de la cuenta de Gmail, no con la del dominio.
 */
export function opcionesDelServidor(entorno: Entorno) {
  const auth = { user: entorno.EMAIL_USER, pass: entorno.EMAIL_PASS };
  const host = entorno.EMAIL_SMTP_HOST?.trim();
  if (!host) return { service: 'gmail', auth };
  const port = Number(entorno.EMAIL_SMTP_PORT?.trim() || 587);
  // 465 cifra desde el primer byte; 587 empieza en claro y pasa a TLS, y
  // `requireTLS` impide que siga en claro si el servidor no lo ofrece.
  return { host, port, secure: port === 465, requireTLS: port !== 465, auth };
}

/**
 * La dirección que ve quien recibe el correo. En Gmail es la misma cuenta que
 * entra (EMAIL_USER); en un servicio de envío, el usuario de entrada no es una
 * dirección de nadie, y el remitente va aparte en EMAIL_FROM (noreply@…).
 */
export function direccionDeEnvio(entorno: Entorno = process.env): string | undefined {
  return entorno.EMAIL_FROM?.trim() || entorno.EMAIL_USER;
}

/**
 * El nombre que se ve en la bandeja: «Desamparados · Secretaría». Con
 * «Secretaría» a secas no se sabía de qué Secretaría era entre otros correos
 * (14-10-2026). EMAIL_FROM_NAME manda si está.
 */
export function nombreDelRemitente(entorno: Entorno = process.env): string {
  return entorno.EMAIL_FROM_NAME?.trim() || `${identidad.nombreCorto} · Secretaría`;
}

/**
 * Cuenta de envío propia del formulario de contacto (CONTACT_EMAIL_USER y
 * CONTACT_EMAIL_PASS). El formulario es público: un spam repartido entre
 * muchas IP podía agotar la cuota diaria de la cuenta de Gmail y dejar sin
 * salir los correos de recuperación de contraseña, que usan EMAIL_*. Sin esas
 * dos variables se sigue usando EMAIL_* como hasta ahora.
 *
 * Se resuelve en el primer envío y no al importar: `undefined` = sin mirar
 * todavía, `null` = no configurada.
 */
let cuentaGuardada: CuentaDeContacto | null | undefined;

export function cuentaDeContacto() {
  if (cuentaGuardada !== undefined) return cuentaGuardada;
  const usuario = process.env.CONTACT_EMAIL_USER;
  const pass = process.env.CONTACT_EMAIL_PASS;
  if (usuario && pass) {
    cuentaGuardada = { transporter: nodemailer.createTransport({ service: 'gmail', auth: { user: usuario, pass } }), usuario };
  } else {
    if (usuario || pass) console.warn('[Email] CONTACT_EMAIL_USER y CONTACT_EMAIL_PASS van juntas y falta una: el contacto sale por la cuenta de EMAIL_USER.');
    cuentaGuardada = null;
  }
  return cuentaGuardada;
}

/**
 * Por aquí los tests ponen un transporte de mentira y lo quitan al terminar.
 *
 * Hasta que el envío vivió en `EmailService` bastaba con escribir encima de sus
 * dos campos privados; ahora que vive en su propio módulo hace falta declarar
 * la puerta, porque lo que se importa de un módulo es de solo lectura.
 *
 * Que exista no es un capricho de los tests: sin ella, un test que pone un
 * EMAIL_USER y un EMAIL_PASS inventados hace que `transporte()` abra una
 * conexión de verdad contra Gmail y la suite entera se quede esperando al
 * SMTP. Es justo lo que pasaba, y lo que `correos-solicitud.test.ts` vigila.
 *
 * `undefined` los devuelve a «sin resolver»: el siguiente envío los vuelve a
 * decidir mirando el entorno de ese momento.
 */
export function ponerTransporte(nuevo: TransporteDeCorreo | undefined): void {
  transporteGuardado = nuevo;
}

/** El acompañante de `ponerTransporte` para la cuenta del contacto. */
export function ponerCuentaDeContacto(nueva: CuentaDeContacto | null | undefined): void {
  cuentaGuardada = nueva;
}

interface OpcionesDeEnvio {
  replyTo?: string;
  cuenta?: CuentaDeContacto | null;
  /** Archivos que van con el correo (la papeleta en PDF), además de las imágenes de la plantilla. */
  adjuntos?: { filename: string; content: Buffer; contentType: string }[];
  /**
   * Qué correo es (la clave de shared/usos-de-correo.json, o «contacto»,
   * «comunicado»…). Es lo que se apunta en la auditoría si no sale: el asunto
   * puede llevar el nombre del destinatario.
   */
  uso?: string;
}

/**
 * Lo que se puede contar de un fallo de envío sin datos personales. El error
 * de nodemailer trae `rejected`, `envelope` y a veces la respuesta del SMTP
 * con la dirección entera: volcado tal cual, acababa en el registro.
 */
export function resumenDelFallo(error: unknown): string {
  if (!(error instanceof Error)) return 'desconocido';
  const e = error as Error & { code?: unknown; responseCode?: unknown; command?: unknown };
  const partes = [
    typeof e.code === 'string' ? e.code : null,
    typeof e.responseCode === 'number' ? `SMTP ${e.responseCode}` : null,
    typeof e.command === 'string' ? e.command : null,
  ].filter(Boolean);
  // Sin código (un fallo propio, como «no hay cuenta configurada»), el
  // mensaje, con cualquier dirección que lleve tapada.
  return partes.length
    ? partes.join(' · ')
    : e.message.replace(/[^\s<>"',;:]+@[^\s<>"',;:]+/g, (d) => enmascararEmail(d)).slice(0, 250);
}

// --- MOTOR DE ENVÍO ---
export async function enviarCorreo(
  to: string,
  subject: string,
  html: string,
  { replyTo, cuenta, adjuntos = [], uso = 'sin_clasificar' }: OpcionesDeEnvio = {},
): Promise<boolean> {
  // Todos los correos pasan por aquí, y muchos caen en la dirección de la
  // cuenta cuando la ficha no trae una (el aviso de baja, la papeleta, el
  // recibo…): con una ficha de la cuenta de custodia, esa dirección es
  // relleno. Se trata como «sin correo»: no sale, y no es un fallo que
  // apuntar en la auditoría, porque no hay nada que Secretaría pueda reenviar.
  if (esDireccionDeNadie(to)) {
    console.warn(`✉️ El correo «${uso}» no se envía: ${enmascararEmail(to)} no es de nadie.`);
    return false;
  }
  try {
    await (cuenta?.transporter ?? transporte()).sendMail({
      from: `"${nombreDelRemitente()}" <${cuenta?.usuario ?? direccionDeEnvio()}>`,
      to,
      subject,
      html,
      text: aTexto(html),
      // El escudo y la cabecera de la marca van dentro del correo, no enlazados a la web.
      attachments: [...imagenesDe(html), ...adjuntos],
      // Sin Reply-To propio, las respuestas van al buzón de Secretaría si es
      // otro distinto de la cuenta que envía.
      ...(replyTo || process.env.CONTACT_EMAIL_TO ? { replyTo: replyTo || process.env.CONTACT_EMAIL_TO } : {}),
    });
    console.log(`✅ Email enviado con éxito a: ${enmascararEmail(to)}`);
    return true;
  } catch (error) {
    const motivo = resumenDelFallo(error);
    console.error(`❌ Error enviando el correo «${uso}» a ${enmascararEmail(to)}: ${motivo}`);
    // El fallo va también a la auditoría: es el único sitio donde el staff
    // puede verlo. La dirección se guarda ENMASCARADA — la auditoría ya
    // retiene IP y navegador, y no hace falta añadirle correos completos para
    // saber que algo no salió. Y la clave del correo en vez del asunto, que
    // puede llevar el nombre de quien lo recibía y se guarda 730 días.
    await AuditoriaService.log(ACCIONES_AUDITORIA.EMAIL_FALLIDO, {}, 'email', undefined, {
      para: enmascararEmail(to),
      uso,
      motivo,
    });
    return false;
  }
}
