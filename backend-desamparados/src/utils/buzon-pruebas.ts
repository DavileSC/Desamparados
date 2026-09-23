import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Buzón de pruebas: en vez de enviar, escribe cada correo como un .html
 * abrible en el navegador.
 *
 * Existe porque revisar un correo en local exigía credenciales de Gmail. Sin
 * ellas nodemailer fallaba, `enviarEmailBase` se tragaba el error y quien
 * probaba el alta de un hermano no tenía forma de saber si el correo estaba
 * bien redactado, ni siquiera si se había intentado enviar.
 *
 * Se enciende A MANO con EMAIL_BUZON_PRUEBAS=true, nunca por omisión: la suite
 * de tests corre con NODE_ENV=development y EMAIL_USER vacío, y varios ficheros
 * registran hermanos sin aislar storage/. Encendido solo por faltar las
 * credenciales, esos tests llenarían el repositorio de correos sueltos.
 *
 * `src/config/entorno.ts` exige EMAIL_USER y EMAIL_PASS en producción, y aquí se
 * vuelve a comprobar: un buzón encendido en el servidor dejaría de enviar las
 * altas y las recuperaciones de contraseña sin que nada fallara a la vista.
 */

export interface CorreoParaBuzon {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Imágenes en línea (`cid:`): el buzón las incrusta para verlas al abrir el .html. */
  attachments?: { path: string; cid: string; contentType: string }[];
}

/**
 * Se calcula al llamar y no al importar: el fixture de los tests cambia el
 * directorio de trabajo, y una constante de módulo habría congelado la carpeta
 * del repositorio antes de ese cambio.
 */
export const carpetaCorreos = (): string => path.join(process.cwd(), 'storage', 'correos');

/**
 * `NODE_TEST_CONTEXT` la pone el ejecutor de tests de Node en cada proceso
 * hijo. Sin esa condición, un `.env` con el buzón encendido hacía que cada
 * `npm test` dejara 46 correos sueltos en storage/correos: los que sueltan
 * aprobar, rechazar y dar de baja en los cinco ficheros que hacen esas
 * operaciones. Nadie debería tener que cambiar su .env para pasar los tests, y
 * en un test lo correcto es no enviar nada (sin cuenta, el envío falla en el
 * acto y sin tocar la red).
 */
export const buzonPedido = (entorno: NodeJS.ProcessEnv = process.env): boolean =>
  entorno.EMAIL_BUZON_PRUEBAS?.trim().toLowerCase() === 'true' &&
  entorno.NODE_ENV?.trim() !== 'production' &&
  entorno.NODE_TEST_CONTEXT === undefined;

/** `Solicitud de Registro Recibida - Ana` -> `solicitud-de-registro-recibida-ana`. */
function partePlana(texto: string): string {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // fuera tildes
    .replace(/[^a-zA-Z0-9]+/g, '-')                   // y todo lo demás (emojis incluidos)
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .toLowerCase() || 'correo';
}

/** Cabecera visible con el sobre, para saber a quién iba sin abrir el código. */
function sobre(correo: CorreoParaBuzon): string {
  const fila = (etiqueta: string, valor: string) =>
    `<tr><td style="padding:2px 12px 2px 0;color:#888">${etiqueta}</td><td>${escapar(valor)}</td></tr>`;
  return `<div style="font:13px/1.6 monospace;background:#fffbe6;border-bottom:2px solid #e0d6a8;padding:12px 16px">
  <strong style="color:#8a6d00">BUZÓN DE PRUEBAS — este correo no se ha enviado a nadie</strong>
  <table style="margin-top:8px;border-collapse:collapse">
    ${fila('De:', correo.from)}
    ${fila('Para:', correo.to)}
    ${fila('Asunto:', correo.subject)}
    ${correo.replyTo ? fila('Responder a:', correo.replyTo) : ''}
  </table>
</div>`;
}

function escapar(texto: string): string {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Mete el sobre dentro del `<body>` del correo para que el fichero siga siendo
 * un documento válido. Si la plantilla no trae body (un correo suelto), va
 * delante y el navegador lo abre igual.
 */
async function paginaDelCorreo(correo: CorreoParaBuzon): Promise<string> {
  const cabecera = sobre(correo);
  // Un navegador no sabe qué es `cid:`: las imágenes en línea se incrustan.
  let html = correo.html;
  for (const imagen of correo.attachments ?? []) {
    const datos = (await fs.readFile(imagen.path)).toString('base64');
    html = html.split(`cid:${imagen.cid}`).join(`data:${imagen.contentType};base64,${datos}`);
  }
  const conBody = html.replace(/(<body[^>]*>)/i, `$1\n${cabecera}`);
  return conBody === html ? `${cabecera}\n${html}` : conBody;
}

/**
 * Transporte con la misma forma que el de nodemailer (`sendMail`), para que
 * `EmailService` no tenga que saber cuál de los dos está usando.
 */
export function buzonDePruebas() {
  return {
    async sendMail(correo: CorreoParaBuzon) {
      const carpeta = carpetaCorreos();
      await fs.mkdir(carpeta, { recursive: true });
      const marca = new Date().toISOString().replace(/[:.]/g, '-');
      const nombre = `${marca}-${partePlana(correo.subject)}.html`;
      const destino = path.join(carpeta, nombre);
      await fs.writeFile(destino, await paginaDelCorreo(correo), 'utf8');
      console.log(`📬 [Buzón de pruebas] Correo escrito en ${destino}`);
      return { messageId: nombre, accepted: [correo.to] };
    },
  };
}
