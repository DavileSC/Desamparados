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

/**
 * Lo único que `EmailService` necesita de un transporte. Lo cumplen tanto el de
 * nodemailer como el buzón de pruebas, así que el motor de envío no tiene que
 * saber cuál de los dos tiene delante.
 */
export interface TransporteDeCorreo {
  sendMail(correo: CorreoParaBuzon): Promise<unknown>;
}

/** La cuenta aparte del formulario de contacto, ya resuelta. */
export interface CuentaDeContacto {
  transporter: Transporter;
  usuario: string;
}

/**
 * Se resuelve en el primer envío y no al importar: el buzón de pruebas se
 * decide con EMAIL_BUZON_PRUEBAS, y leyéndola al importar el módulo quedaba
 * fijada antes de que `dotenv` terminara de cargar el .env.
 */
let transporteGuardado: TransporteDeCorreo | undefined;

export function transporte(): TransporteDeCorreo {
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
    transporteGuardado = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
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

// --- MOTOR DE ENVÍO ---
export async function enviarCorreo(
  to: string,
  subject: string,
  html: string,
  replyTo?: string,
  cuenta?: CuentaDeContacto | null,
): Promise<boolean> {
  try {
    await (cuenta?.transporter ?? transporte()).sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Secretaría'}" <${cuenta?.usuario ?? process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
      text: aTexto(html),
      // El escudo y la Virgen van dentro del correo, no enlazados a la web.
      attachments: imagenesDe(html),
      // Sin Reply-To propio, las respuestas van al buzón de Secretaría si es
      // otro distinto de la cuenta que envía.
      ...(replyTo || process.env.CONTACT_EMAIL_TO ? { replyTo: replyTo || process.env.CONTACT_EMAIL_TO } : {}),
    });
    console.log(`✅ Email enviado con éxito a: ${enmascararEmail(to)}`);
    return true;
  } catch (error) {
    console.error(`❌ Error enviando email a ${enmascararEmail(to)}:`, error);
    // El fallo va también a la auditoría: es el único sitio donde el staff
    // puede verlo. La dirección se guarda ENMASCARADA — la auditoría ya
    // retiene IP y navegador, y no hace falta añadirle correos completos para
    // saber que algo no salió.
    await AuditoriaService.log(ACCIONES_AUDITORIA.EMAIL_FALLIDO, {}, 'email', undefined, {
      para: enmascararEmail(to),
      asunto: subject,
      motivo: error instanceof Error ? error.message.slice(0, 250) : 'desconocido',
    });
    return false;
  }
}
