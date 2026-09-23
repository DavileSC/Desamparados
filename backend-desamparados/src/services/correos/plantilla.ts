/**
 * La maqueta de los correos: colores, el armazón HTML que comparten todos, las
 * piezas con que se escribe cada uno (botón, recuadro, tabla de datos, firma) y
 * su versión en texto plano.
 *
 * Vive aparte de los correos en sí porque es pura presentación: lo que cambia
 * cuando se retoca el diseño, no cuando se añade un aviso nuevo.
 *
 * Todo va con tablas y estilos en línea: es lo único que Gmail, Outlook y el
 * correo del móvil pintan igual. El único <style> es el del ajuste al móvil,
 * que quien no lo entiende ignora sin romper nada.
 */
import { emailDeSecretaria, escudoUrl, lineasDeSecretaria } from '../../domain/datos-entidad.js';

export const NOMBRE_GRUPO = 'Grupo Parroquial Nuestra Señora de los Desamparados';

// Los colores de la casa. Los grises están elegidos para leerse bien sobre
// blanco (contraste 4,5:1 como poco), también en el móvil y a pleno sol.
export const COLORES = {
  primario: '#5c1919',   // Burdeos
  dorado: '#b08d2e',     // Dorado viejo: filetes y detalles, nunca texto largo
  doradoClaro: '#e3cf8f', // Dorado sobre el burdeos de la cabecera
  fondo: '#f3eee6',      // Crema, alrededor de la tarjeta
  panel: '#faf7f1',      // Recuadros dentro de la tarjeta
  linea: '#e6ddcf',
  texto: '#2b2622',
  suave: '#5f5750',      // Texto secundario (6,6:1 sobre blanco)
  etiqueta: '#6f6660',   // Etiquetas en versalitas (5,4:1 sobre blanco)
};

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS = "'Helvetica Neue', Helvetica, Arial, sans-serif";

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

export const urlDeLaWeb = (ruta = '') => `${process.env.FRONTEND_URL || 'http://localhost:5173'}${ruta}`;

// --- PIEZAS DEL CUERPO ---

/** Un párrafo normal del cuerpo. `html` va tal cual: quien llama escapa. */
export const parrafo = (html: string, estilo = '') =>
  `<p style="margin: 0 0 16px 0; ${estilo}">${html}</p>`;

export type Sexo = 'HOMBRE' | 'MUJER' | null | undefined;

/**
 * «Estimado Pablo:» o «Estimada Rocío:». Sin sexo en la ficha (las altas de
 * antes no lo pedían) queda el «Estimado/a», que es feo pero no se equivoca.
 */
export function saludo(nombre: string, sexo?: Sexo): string {
  const estimado = sexo === 'HOMBRE' ? 'Estimado' : sexo === 'MUJER' ? 'Estimada' : 'Estimado/a';
  return parrafo(`${estimado} ${esc(nombre)}:`);
}

/** Masculino, femenino o las dos formas cuando no se sabe. */
export const segunSexo = (sexo: Sexo, hombre: string, mujer: string) =>
  sexo === 'HOMBRE' ? hombre : sexo === 'MUJER' ? mujer : `${hombre}/a`;

/**
 * Botón a prueba de Outlook (una celda con fondo, no un <a> con relleno), y
 * debajo la dirección en claro por si el botón no se pinta o el enlace no
 * se puede pulsar.
 */
export function boton(texto: string, url: string): string {
  const { primario, suave } = COLORES;
  return `
    <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 28px auto 8px auto;">
      <tr>
        <td align="center" bgcolor="${primario}" style="border-radius: 4px;">
          <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 30px; font-family: ${SANS}; font-size: 15px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 4px;">${esc(texto)}</a>
        </td>
      </tr>
    </table>
    <p data-alternativa style="margin: 0 0 24px 0; text-align: center; font-family: ${SANS}; font-size: 12px; line-height: 1.5; color: ${suave};">
      Si el botón no funciona, copie esta dirección en el navegador:<br>
      <a href="${url}" style="color: ${suave}; word-break: break-all;">${esc(url)}</a>
    </p>`;
}

/**
 * Recuadro con filete dorado a la izquierda: lo que el lector tiene que hacer
 * o no pasar por alto. `titulo` es texto; `html` va tal cual.
 */
export function recuadro(titulo: string | null, html: string): string {
  const { panel, dorado, primario } = COLORES;
  return `
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 8px 0 24px 0;">
      <tr>
        <td style="background-color: ${panel}; border-left: 3px solid ${dorado}; padding: 18px 22px;">
          ${titulo ? `<p style="margin: 0 0 8px 0; font-family: ${SANS}; font-size: 12px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; color: ${primario};">${esc(titulo)}</p>` : ''}
          <div style="font-size: 15px; line-height: 1.6;">${html}</div>
        </td>
      </tr>
    </table>`;
}

/** Lista con viñetas. Los elementos son texto y se escapan aquí. */
export function lista(elementos: string[]): string {
  return `<ul style="margin: 0 0 16px 0; padding-left: 22px;">${elementos.map((e) => `<li style="margin: 0 0 6px 0;">${esc(e)}</li>`).join('')}</ul>`;
}

/**
 * Tabla de datos de dos columnas (etiqueta y valor). El valor va tal cual,
 * para poder llevar un enlace: quien llama escapa.
 */
export function datos(filas: [string, string][]): string {
  const { linea, etiqueta } = COLORES;
  const celdas = filas.map(([nombre, valor], i) => `
      <tr>
        <td valign="top" style="padding: 10px 16px 10px 0; ${i ? `border-top: 1px solid ${linea};` : ''} width: 34%; font-family: ${SANS}; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; color: ${etiqueta};">${esc(nombre)}</td>
        <td valign="top" style="padding: 10px 0; ${i ? `border-top: 1px solid ${linea};` : ''} font-size: 15px;">${valor}</td>
      </tr>`).join('');
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 4px 0 24px 0;">${celdas}</table>`;
}

/** Cita larga (el mensaje del formulario de contacto). `html` va tal cual. */
export function cita(html: string): string {
  const { panel, linea } = COLORES;
  return `<div style="margin: 0 0 16px 0; padding: 18px 22px; background-color: ${panel}; border: 1px solid ${linea}; border-radius: 4px; font-size: 15px; line-height: 1.6;">${html}</div>`;
}

/**
 * Despedida y firma. Firma el cargo, no la persona que hoy lo ocupa, igual que
 * el buzón al que se responde.
 */
export function firma(despedida: string | null, cargo = 'La Secretaría'): string {
  const { primario, suave } = COLORES;
  return `
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 32px;">
      <tr>
        <td>
          ${despedida ? `<p style="margin: 0 0 18px 0; font-style: italic; color: ${suave};">${esc(despedida)}</p>` : ''}
          <p style="margin: 0; font-weight: bold; color: ${primario};">${esc(cargo)}</p>
          <p style="margin: 2px 0 0 0; font-family: ${SANS}; font-size: 13px; color: ${suave};">${esc(NOMBRE_GRUPO)}</p>
        </td>
      </tr>
    </table>`;
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
  return recuadro(titulo, lineas.map((linea) => esc(linea)).join('<br>'));
}

// --- EL ARMAZÓN ---

/**
 * A quién va el correo, que decide el pie:
 *  - `hermano`: a un hermano o solicitante. Se puede responder: la respuesta
 *    llega a Secretaría. Lleva la nota de protección de datos.
 *  - `interno`: al buzón de Secretaría (aviso de solicitud nueva).
 *  - `contacto`: al buzón de Secretaría, y responder contesta a quien escribió.
 */
export type Destinatario = 'hermano' | 'interno' | { contacto: string };

export interface Maqueta {
  /** El título grande del cuerpo. También el <title> del documento. */
  titulo: string;
  /** La línea pequeña de encima del título: de dónde viene el correo. */
  antetitulo: string;
  /** Lo que la bandeja enseña junto al asunto. Una frase. */
  resumen: string;
  /** El cuerpo, ya en HTML. */
  contenido: string;
  para?: Destinatario;
}

function pie(para: Destinatario): string {
  const { suave, primario } = COLORES;
  const p = (html: string) => `<p style="margin: 0 0 10px 0;">${html}</p>`;
  const enlace = (url: string, texto: string) => `<a href="${url}" style="color: ${primario};">${esc(texto)}</a>`;

  if (para === 'interno') {
    return p('Aviso automático de la web del Grupo Parroquial para el buzón de Secretaría.');
  }
  if (typeof para === 'object') {
    return p(`Mensaje enviado desde el formulario de contacto de la web. Si responde a este correo, la respuesta le llegará directamente a ${esc(para.contacto)}.`);
  }

  // Los correos salen de la cuenta de Secretaría: responder es la forma de
  // contactar mientras el Grupo no confirme un teléfono o una dirección.
  const correo = emailDeSecretaria();
  return [
    p(`¿Tiene alguna duda? Responda a este correo y le atenderá la Secretaría${correo ? `, o escriba a ${enlace(`mailto:${esc(correo)}`, correo)}` : ''}.`),
    `<p style="margin: 0; color: ${suave};">Recibe este correo por su relación con el Grupo Parroquial, que trata sus datos conforme al Reglamento General de Protección de Datos. Más información en nuestra ${enlace(urlDeLaWeb('/politica-privacidad'), 'política de privacidad')}.</p>`,
  ].join('');
}

/** El HTML completo de un correo: cabecera, cuerpo y pie. */
export function maquetar({ titulo, antetitulo, resumen, contenido, para = 'hermano' }: Maqueta): string {
  const { primario, doradoClaro, dorado, fondo, texto, etiqueta, suave } = COLORES;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${esc(titulo)}</title>
  <style>
    @media only screen and (max-width: 620px) {
      .marco { padding: 16px 8px !important; }
      .caja { padding-left: 24px !important; padding-right: 24px !important; }
      .titulo { font-size: 24px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${fondo};">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: ${fondo}; font-size: 1px; line-height: 1px;" data-resumen>${esc(resumen)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${fondo};">
    <tr>
      <td align="center" class="marco" style="padding: 32px 12px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px;">
          <tr>
            <td align="center" bgcolor="${primario}" class="caja" style="background-color: ${primario}; padding: 30px 40px 26px 40px; border-radius: 6px 6px 0 0;">
              ${escudoUrl ? `<img src="${escudoUrl}" alt="" width="64" style="display: block; margin: 0 auto 14px auto; border: 0; height: auto;">` : ''}
              <p style="margin: 0; font-family: ${SANS}; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: ${doradoClaro};">Grupo Parroquial</p>
              <p style="margin: 6px 0 0 0; font-family: ${SERIF}; font-size: 21px; line-height: 1.3; color: #ffffff;">Nuestra Señora de los Desamparados</p>
            </td>
          </tr>
          <tr>
            <td height="3" bgcolor="${dorado}" style="background-color: ${dorado}; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="caja" bgcolor="#ffffff" style="background-color: #ffffff; padding: 36px 40px 40px 40px; font-family: ${SERIF}; font-size: 16px; line-height: 1.65; color: ${texto}; border-radius: 0 0 6px 6px;">
              <p style="margin: 0 0 6px 0; font-family: ${SANS}; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; color: ${etiqueta};">${esc(antetitulo)}</p>
              <h1 class="titulo" style="margin: 0 0 24px 0; font-family: ${SERIF}; font-size: 27px; line-height: 1.25; font-weight: normal; color: ${primario};">${esc(titulo)}</h1>
              ${contenido}
            </td>
          </tr>
          <tr>
            <td class="caja" style="padding: 24px 40px 8px 40px; font-family: ${SANS}; font-size: 12px; line-height: 1.6; color: ${suave};">
              ${pie(para)}
              <p style="margin: 14px 0 0 0; color: ${suave};">&copy; ${year} ${esc(NOMBRE_GRUPO)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// --- LA VERSIÓN EN TEXTO ---

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', copy: '©' };

/**
 * La versión en texto plano del mismo correo, que va junto al HTML. Sin ella
 * los filtros de spam desconfían, y hay lectores de correo (y personas) que
 * solo leen el texto. Se saca del HTML para que las dos no puedan contar cosas
 * distintas.
 */
export function aTexto(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<div[^>]*data-resumen[^>]*>[\s\S]*?<\/div>/i, '')
    // La dirección de repuesto del botón sobra: en el texto el botón ya la lleva.
    .replace(/<p data-alternativa[\s\S]*?<\/p>/gi, '')
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, url: string, texto: string) => {
      const limpio = texto.replace(/<[^>]+>/g, '').trim();
      return url.startsWith('mailto:') || limpio === url || limpio.replace(/&amp;/g, '&') === url.replace(/&amp;/g, '&') ? limpio : `${limpio} (${url})`;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n  • ')
    .replace(/<\/(p|h1|tr|table|ul|div)>/gi, '\n\n')
    .replace(/<\/td>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#8199;|&#65279;|&#847;/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp|copy);/g, (_, e: string) => ENTIDADES[e])
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
