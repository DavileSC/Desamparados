/**
 * La maqueta de los correos: colores, el armazón HTML que comparten todos y
 * los dos bloques de pie (Secretaría y enlaces).
 *
 * Vive aparte de los correos en sí porque es pura presentación: lo que cambia
 * cuando se retoca el diseño, no cuando se añade un aviso nuevo.
 */
import { emailDeSecretaria, escudoUrl, lineasDeSecretaria } from '../../domain/datos-entidad.js';


// CONFIGURACIÓN GLOBAL DE COLORES
export const COLORES = {
  primario: '#5c1919',   // Rojo Burdeos
  secundario: '#d4af37', // Dorado
  fondo: '#f9f9f9',
  texto: '#333333'
};

/**
 * Escapa caracteres HTML de datos que vienen de la BD (nombres, puestos...)
 * para impedir HTML/Phishing injection en los correos (un hermano
 * registrado como "<b>Estafador</b>" no puede maquillar el email).
 */
export function esc(text: string | null | undefined): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
/**
 * PLANTILLA MAESTRA (Layout)
 * Centraliza el HTML, head, body, header, footer y estilos comunes.
 */
export function maquetar(tituloCabecera: string, subtitulo: string, contenidoPrincipal: string, footerExtra: string = '', legalExtra: string = ''): string {
  const { primario, fondo, texto } = COLORES;
  const year = new Date().getFullYear();
  // Ni escudo ni dirección de contacto si no están confirmados: antes iban
  // escritos a mano un placeholder y un dominio que no es nuestro.
  const emailSecretaria = esc(emailDeSecretaria() ?? '');

  return `
  <!DOCTYPE html>
  <html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${tituloCabecera}</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: ${fondo}; font-family: 'Georgia', 'Times New Roman', serif; -webkit-font-smoothing: antialiased;">
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${fondo};">
      <tr>
        <td align="center" style="padding: 40px 10px;">
          <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border: 1px solid #eaeaeb; border-top: 6px solid ${primario}; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
            
            <tr>
              <td style="padding: 40px 40px 20px 40px; text-align: center; border-bottom: 1px solid #f0f0f0;">
                ${escudoUrl ? `<img src="${escudoUrl}" alt="Escudo del Grupo Parroquial" width="80" style="display: block; margin: 0 auto 15px auto; border: 0;">` : ''}
                <h1 style="color: ${primario}; margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 2px; font-weight: normal;">Grupo Parroquial de los Desamparados</h1>
                <p style="margin: 10px 0 0; color: #888; font-size: 13px; font-family: 'Arial', sans-serif; text-transform: uppercase; letter-spacing: 1px;">${subtitulo}</p>
              </td>
            </tr>

            <tr>
              <td style="padding: 30px 40px; color: ${texto}; font-size: 15px; line-height: 1.8;">
                ${contenidoPrincipal}
              </td>
            </tr>

            <tr>
              <td style="background-color: #2b2b2b; color: #999999; padding: 30px 40px; font-family: 'Arial', sans-serif; font-size: 11px; line-height: 1.5; text-align: center;">
                <p style="margin-top: 0; color: #ffffff;">&copy; ${year} GRUPO PARROQUIAL DE LOS DESAMPARADOS</p>
                ${footerExtra}
                <p style="text-align: justify;"><strong>Aviso Legal y Protección de Datos:</strong> En cumplimiento del RGPD, le informamos que sus datos serán tratados por el Grupo Parroquial. Este mensaje es confidencial. No responda a este correo automatizado.${emailSecretaria ? ` Dudas en <em>${emailSecretaria}</em>` : ''}</p>
                ${legalExtra}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}
/**
 * Bloque con el horario y la dirección de Secretaría. Devuelve cadena vacía
 * mientras el Grupo Parroquial no confirme esos datos (shared/datos-entidad.json):
 * antes iban escritos a mano en la plantilla, y el correo citaba un horario y
 * una «C/ Falsa, 123» a los que un solicitante podía presentarse de verdad.
 */
export function bloqueDeSecretaria(titulo: string): string {
  const lineas = lineasDeSecretaria();
  if (lineas.length === 0) return '';

  const { primario } = COLORES;
  const [primera, ...resto] = lineas.map((linea) => esc(linea));
  const secundarias = resto.length
    ? `<span style="color: #888; font-size: 12px; margin-top: 8px; display: block;">${resto.join(' · ')}</span>`
    : '';

  return `
    <table width="100%" style="background-color: #fcfcfc; border: 1px solid #eeeeee; padding: 20px; text-align: center; font-family: 'Arial', sans-serif; font-size: 13px; color: #555; margin-top: 20px;">
      <tr>
        <td>
          <strong style="color: ${primario}; font-size: 14px; display: block; margin-bottom: 5px;">${esc(titulo)}</strong>
          ${primera}
          ${secundarias}
        </td>
      </tr>
    </table>`;
}
/**
 * Enlaces del pie de los correos. Solo se pinta el enlace a la normativa si
 * NORMATIVA_URL está configurada: un `href="#"` en un correo es un enlace
 * muerto que ya no se puede corregir una vez enviado.
 */
export function enlacesDelPie(): string {
  const estilo = 'color: #ffffff; text-decoration: underline;';
  const secretaria = process.env.CONTACT_EMAIL_TO || process.env.EMAIL_USER;
  const enlaces: string[] = [];

  if (process.env.NORMATIVA_URL) {
    enlaces.push(`<a href="${process.env.NORMATIVA_URL}" style="${estilo}">Descargar Normativa</a>`);
  }
  if (secretaria) {
    enlaces.push(`<a href="mailto:${secretaria}" style="${estilo}">Contactar Secretaría</a>`);
  }
  if (enlaces.length === 0) return '';

  return `<p style="margin: 10px 0 15px 0;">${enlaces.join(' | ')}</p>`;
}

