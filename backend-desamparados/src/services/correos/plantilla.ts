/**
 * La maqueta de los correos: colores, el armazón HTML que comparten todos, las
 * piezas con que se escribe cada uno (botón, recuadro, tabla de datos, firma) y
 * su versión en texto plano.
 *
 * Vive aparte de los correos en sí porque es pura presentación: lo que cambia
 * cuando se retoca el diseño, no cuando se añade un aviso nuevo.
 *
 * El aire es el de una carta de Secretaría: membrete con el escudo, la imagen
 * de la Virgen, lugar y fecha, etiquetas en cursiva como en un impreso y la
 * cruz antes de la firma. Negro para el texto, el escudo y los botones, y
 * burdeos de acento, sobre una hoja blanca.
 *
 * Todo va con tablas y estilos en línea: es lo único que Gmail, Outlook y el
 * correo del móvil pintan igual. El único <style> es el del ajuste al móvil,
 * que quien no lo entiende ignora sin romper nada.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { emailDeSecretaria, identidad, lineasDeSecretaria, type Identidad } from '../../domain/datos-entidad.js';
import { deLaCorporacion, laCorporacion, segunLaCorporacion } from '../../domain/articulos.js';

/**
 * Las imágenes van dentro del correo (adjuntos en línea, `cid:`) y no enlazadas
 * a la web: así se ven aunque la web aún no esté publicada, y no dependen de
 * que el lector de correo quiera descargar imágenes de fuera.
 */
export const IMAGENES = {
  escudo: { cid: 'escudo@desamparados', archivo: fileURLToPath(new URL('./imagenes/escudo.png', import.meta.url)), tipo: 'image/png' },
  virgen: { cid: 'virgen@desamparados', archivo: fileURLToPath(new URL('./imagenes/virgen.jpg', import.meta.url)), tipo: 'image/jpeg' },
} as const;

// Los colores de la casa. Los grises están elegidos para leerse bien sobre su
// fondo (contraste 4,5:1 como poco), también en el móvil y a pleno sol.
export const COLORES = {
  negro: '#141111',      // Escudo, títulos, botones, cabecera de la papeleta
  fondo: '#eeeae7',      // Alrededor de la hoja
  burdeos: '#6e1a20',    // Acento: filete bajo la Virgen, cruz, títulos de recuadro
  papel: '#ffffff',
  panel: '#f5f2f0',      // Recuadros dentro del papel
  linea: '#ddd5d0',
  texto: '#1f1a19',
  suave: '#5c5452',      // Texto secundario (7:1 sobre blanco)
  sobreNegro: '#b3a8a3', // Texto secundario sobre el negro (8:1)
};

const SERIF = "Georgia, 'Times New Roman', Times, serif";
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

/** «Málaga, 23 de septiembre de 2026», como encabeza una carta (con la localidad de la corporación). */
export function lugarYFecha(fecha = new Date()): string {
  return `${identidad.localidad}, ${fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' })}`;
}

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
  const { negro, suave } = COLORES;
  return `
    <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 10px 0;">
      <tr>
        <td bgcolor="${negro}" style="background-color: ${negro}; border-radius: 2px;">
          <a href="${url}" target="_blank" style="display: inline-block; padding: 14px 28px; font-family: ${SANS}; font-size: 14px; font-weight: bold; letter-spacing: 0.3px; color: #ffffff; text-decoration: none;">${esc(texto)}&nbsp;&nbsp;&rarr;</a>
        </td>
      </tr>
    </table>
    <p data-alternativa style="margin: 0 0 24px 0; font-family: ${SANS}; font-size: 12px; line-height: 1.5; color: ${suave};">
      Si el botón no funciona, copie esta dirección en el navegador:<br>
      <a href="${url}" style="color: ${suave}; word-break: break-all;">${esc(url)}</a>
    </p>`;
}

/**
 * Recuadro para lo que el lector tiene que hacer o no pasar por alto: papel
 * algo más oscuro, sin esquinas redondas, con su título en versalitas.
 * `titulo` es texto; `html` va tal cual.
 */
export function recuadro(titulo: string | null, html: string): string {
  const { panel, burdeos, linea } = COLORES;
  return `
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 8px 0 24px 0;">
      <tr>
        <td style="background-color: ${panel}; border-top: 1px solid ${linea}; border-bottom: 1px solid ${linea}; padding: 18px 22px;">
          ${titulo ? `<p style="margin: 0 0 6px 0; font-family: ${SERIF}; font-size: 16px; font-weight: bold; font-variant: small-caps; letter-spacing: 0.5px; color: ${burdeos};">${esc(titulo)}</p>` : ''}
          <div style="font-size: 15px; line-height: 1.6;">${html}</div>
        </td>
      </tr>
    </table>`;
}

/** Lista con viñetas. Los elementos son texto y se escapan aquí. */
export function lista(elementos: string[], margen = '0 0 16px 0'): string {
  return `<ul style="margin: ${margen}; padding-left: 22px;">${elementos.map((e) => `<li style="margin: 0 0 6px 0;">${esc(e)}</li>`).join('')}</ul>`;
}

/** Etiqueta en cursiva, como los rótulos de un impreso («Puesto», «Día»). */
export const rotulo = (texto: string) =>
  `<span style="font-family: ${SERIF}; font-style: italic; font-size: 14px; color: ${COLORES.suave};">${esc(texto)}</span>`;

/**
 * Tabla de datos de dos columnas (rótulo y valor). El valor va tal cual, para
 * poder llevar un enlace: quien llama escapa.
 */
export function datos(filas: [string, string][]): string {
  const { linea } = COLORES;
  const celdas = filas.map(([nombre, valor]) => `
      <tr>
        <td valign="top" width="32%" style="padding: 9px 16px 9px 0; border-bottom: 1px solid ${linea};">${rotulo(nombre)}</td>
        <td valign="top" style="padding: 9px 0; border-bottom: 1px solid ${linea}; font-size: 15px;">${valor}</td>
      </tr>`).join('');
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 4px 0 24px 0; border-top: 1px solid ${linea};">${celdas}</table>`;
}

/** Cita larga (el mensaje del formulario de contacto). `html` va tal cual. */
export function cita(html: string): string {
  const { panel, linea } = COLORES;
  return `<div style="margin: 0 0 16px 0; padding: 18px 22px; background-color: ${panel}; border-top: 1px solid ${linea}; border-bottom: 1px solid ${linea}; font-size: 15px; line-height: 1.6;">${html}</div>`;
}

/**
 * Despedida y firma, con la cruz delante como en las cartas de la casa.
 * Firma el cargo, no la persona que hoy lo ocupa, igual que el buzón al que se
 * responde. `identidadInstalacion`: otra instalación, para las pruebas (igual
 * que en domain/articulos.ts).
 */
export function firma(despedida: string | null, cargo = 'La Secretaría', identidadInstalacion: Identidad = identidad): string {
  const { burdeos, suave, texto } = COLORES;
  return `
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 30px;">
      <tr>
        <td>
          ${despedida ? `<p style="margin: 0 0 22px 0; font-style: italic; color: ${suave};">${esc(despedida)}</p>` : ''}
          <p style="margin: 0; font-size: 16px; color: ${texto};"><span style="color: ${burdeos};">&#10016;</span>&nbsp; ${esc(cargo)}</p>
          <p style="margin: 2px 0 0 0; font-size: 14px; font-style: italic; color: ${suave};">${esc(identidadInstalacion.nombre)}</p>
        </td>
      </tr>
    </table>`;
}

/**
 * Bloque con el horario y la dirección de Secretaría. Devuelve cadena vacía
 * mientras el Grupo Parroquial no confirme esos datos (instalacion/datos-entidad.json):
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
 * A quién va el correo, que decide el pie y si lleva la imagen de la Virgen:
 *  - `hermano`: a un hermano o solicitante. Se puede responder: la respuesta
 *    llega a Secretaría. Lleva la nota de protección de datos.
 *  - `interno`: al buzón de Secretaría (aviso de solicitud nueva).
 *  - `contacto`: al buzón de Secretaría, y responder contesta a quien escribió.
 */
export type Destinatario = 'hermano' | 'interno' | { contacto: string };

export interface Maqueta {
  /** El título del cuerpo. También el <title> del documento. */
  titulo: string;
  /** La línea pequeña de encima del título: de dónde viene el correo. */
  antetitulo: string;
  /** Lo que la bandeja enseña junto al asunto. Una frase. */
  resumen: string;
  /** El cuerpo, ya en HTML. */
  contenido: string;
  para?: Destinatario;
  /** Otra instalación: para las pruebas (igual que en domain/articulos.ts). */
  identidad?: Identidad;
}

export function pie(para: Destinatario, identidadInstalacion: Identidad = identidad): string {
  const { suave, texto } = COLORES;
  const p = (html: string) => `<p style="margin: 0 0 10px 0;">${html}</p>`;
  const enlace = (url: string, titulo: string) => `<a href="${url}" style="color: ${texto}; text-decoration: underline;">${esc(titulo)}</a>`;

  if (para === 'interno') {
    return p(`Aviso automático de la web ${deLaCorporacion({ identidad: identidadInstalacion })} para el buzón de Secretaría.`);
  }
  if (typeof para === 'object') {
    return p(`Mensaje enviado desde el formulario de contacto de la web. Si responde a este correo, la respuesta le llegará directamente a ${esc(para.contacto)}.`);
  }

  // Los correos salen de la cuenta de Secretaría: responder es la forma de
  // contactar mientras el Grupo no confirme un teléfono o una dirección.
  const correo = emailDeSecretaria(process.env);
  return [
    p(`<strong style="color: ${texto};">¿Tiene alguna duda?</strong> Responda a este correo y le atenderá la Secretaría${correo ? `, o escriba a ${enlace(`mailto:${esc(correo)}`, correo)}` : ''}.`),
    `<p style="margin: 0; color: ${suave};">Recibe este correo por su relación con ${laCorporacion({ identidad: identidadInstalacion })}, que ${segunLaCorporacion('trata', 'tratan', { identidad: identidadInstalacion })} sus datos conforme al Reglamento General de Protección de Datos. Más información en nuestra ${enlace(urlDeLaWeb('/politica-privacidad'), 'política de privacidad')}.</p>`,
  ].join('');
}

/** El HTML completo de un correo: membrete, Virgen, carta y pie. */
export function maquetar({ titulo, antetitulo, resumen, contenido, para = 'hermano', identidad: identidadInstalacion = identidad }: Maqueta): string {
  const { negro, burdeos, fondo, papel, texto, suave } = COLORES;
  const year = new Date().getFullYear();
  // La Virgen, en lo que recibe un hermano; los avisos internos, sin ella:
  // son trámite y se leen de un vistazo.
  const conVirgen = para === 'hermano';

  return `<!DOCTYPE html>
<html lang="es" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${esc(titulo)}</title>
  <style>
    @media only screen and (max-width: 620px) {
      .marco { padding: 0 !important; }
      .caja { padding-left: 22px !important; padding-right: 22px !important; }
      .titulo { font-size: 23px !important; }
      .fecha { display: block !important; text-align: left !important; padding-top: 4px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${fondo};">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: ${fondo}; font-size: 1px; line-height: 1px;" data-resumen>${esc(resumen)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${fondo}" style="background-color: ${fondo};">
    <tr>
      <td align="center" class="marco" style="padding: 32px 12px 36px 12px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${papel}" style="max-width: 600px; background-color: ${papel};">
          <tr>
            <td class="caja" style="padding: 24px 44px 22px 44px;">
              <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td valign="middle" style="padding-right: 16px;">
                    <img src="cid:${IMAGENES.escudo.cid}" alt="Escudo ${deLaCorporacion({ identidad: identidadInstalacion })}" width="46" height="56" style="display: block; border: 0; width: 46px; height: 56px;">
                  </td>
                  <td valign="middle" style="font-family: ${SERIF};">
                    <p style="margin: 0; font-size: 13px; font-style: italic; color: ${suave};">${esc(identidadInstalacion.tipo)}</p>
                    <p style="margin: 1px 0 0 0; font-size: 19px; line-height: 1.25; color: ${negro};">${esc(identidadInstalacion.titular)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${conVirgen ? `
          <tr>
            <td style="line-height: 0; font-size: 0;">
              <img src="cid:${IMAGENES.virgen.cid}" alt="${esc(identidadInstalacion.titular)}" width="600" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0;">
            </td>
          </tr>` : ''}
          <tr>
            <td height="4" bgcolor="${burdeos}" style="background-color: ${burdeos}; font-size: 0; line-height: 0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="caja" style="padding: 30px 44px 40px 44px; font-family: ${SERIF}; font-size: 16px; line-height: 1.65; color: ${texto};">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 22px;">
                <tr>
                  <td style="font-family: ${SERIF}; font-size: 15px; font-variant: small-caps; letter-spacing: 0.6px; color: ${burdeos};">${esc(antetitulo)}</td>
                  <td class="fecha" align="right" style="font-family: ${SERIF}; font-size: 14px; font-style: italic; color: ${suave};">${esc(lugarYFecha())}</td>
                </tr>
              </table>
              <h1 class="titulo" style="margin: 0 0 22px 0; font-family: ${SERIF}; font-size: 26px; line-height: 1.25; font-weight: normal; color: ${negro};">${esc(titulo)}</h1>
              ${contenido}
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px;">
          <tr>
            <td class="caja" style="padding: 24px 44px 0 44px; font-family: ${SANS}; font-size: 12px; line-height: 1.65; color: ${suave};">
              ${pie(para, identidadInstalacion)}
              <p style="margin: 16px 0 0 0; color: ${suave};">&copy; ${year} ${esc(identidadInstalacion.nombre)} &middot; ${esc(identidadInstalacion.localidad)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Las imágenes que usa un correo ya maquetado, para adjuntarlas en línea. */
/**
 * El correo para verlo en el navegador (la vista previa de Emails): las
 * imágenes `cid:` solo las entiende un lector de correo, así que aquí van
 * dentro del HTML. Se leen una vez y se guardan.
 */
let enLinea: [string, string][] | null = null;
export function conImagenesEnLinea(html: string): string {
  enLinea ??= Object.values(IMAGENES).map((i) => [`cid:${i.cid}`, `data:${i.tipo};base64,${readFileSync(i.archivo).toString('base64')}`]);
  return enLinea.reduce((h, [cid, datos]) => h.split(cid).join(datos), html);
}

export function imagenesDe(html: string) {
  return Object.entries(IMAGENES)
    .filter(([, imagen]) => html.includes(`cid:${imagen.cid}`))
    .map(([nombre, imagen]) => ({ filename: `${nombre}${imagen.tipo === 'image/png' ? '.png' : '.jpg'}`, path: imagen.archivo, cid: imagen.cid, contentType: imagen.tipo }));
}

// --- LA VERSIÓN EN TEXTO ---

const ENTIDADES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', copy: '©', middot: '·', rarr: '', '#10016': '✠',
};

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
      const limpio = texto.replace(/<[^>]+>/g, '').replace(/&nbsp;|&rarr;/g, ' ').trim();
      return url.startsWith('mailto:') || limpio === url || limpio.replace(/&amp;/g, '&') === url.replace(/&amp;/g, '&') ? limpio : `${limpio} (${url})`;
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n  • ')
    .replace(/<\/(p|h1|tr|table|ul|div)>/gi, '\n\n')
    .replace(/<\/td>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#8199;|&#65279;|&#847;/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp|copy|middot|rarr|#10016);/g, (_, e: string) => ENTIDADES[e])
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
