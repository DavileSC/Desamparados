import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import type { Color, Cuerpo, Formato, Grafica } from '../../domain/datos-areas.js';
import { euros, numero } from '../../domain/datos-areas.js';
import type { Trozo } from '../../domain/entradillas.js';
import { identidad } from '../../domain/datos-entidad.js';

/**
 * Las piezas con que se componen los PDF de «Datos e informes»: la hoja, la
 * letra, los colores de imprenta, las bandas de cada página y las gráficas
 * dibujadas a mano con pdfkit.
 *
 * Es la maqueta elegida el 30-09-2026: negro, burdeos y oro. Negro en las
 * bandas y en las barras, burdeos para lo que resta (bajas, gastos, lo que hay
 * que reparar) y oro solo en filetes y detalles. Títulos en Newsreader, texto
 * en Instrument Sans, y nada por debajo de 9 pt en lo que se lee.
 *
 * Todo se mide en puntos: la maqueta estaba en píxeles CSS de 794 de ancho, y
 * un píxel de allí son tres cuartos de punto aquí.
 */

const ruta = (relativa: string) => fileURLToPath(new URL(relativa, import.meta.url));

export const IMAGENES = {
  escudo: ruta('./imagenes/escudo.png'),
  escudoOro: ruta('./imagenes/escudo-oro.png'),
};

export const NEGRO = '#161214';
export const BURDEOS = '#5c1622';
/**
 * El burdeos de las gráficas. El de las bandas, junto al negro, se confundía:
 * los dos son casi igual de oscuros. Este se distingue a simple vista y en una
 * fotocopia en blanco y negro sale gris medio, no negro.
 */
export const BURDEOS_VIVO = '#a3303f';
export const ORO = '#b08d52';
export const ORO_CLARO = '#cdae72';
export const ORO_PALIDO = '#ddd0b3';
export const MARFIL = '#f4efe5';
export const CREMA = '#f3ebdc';
export const GRIS = '#5f5759';
export const FILETE = '#e2dcdd';
const ORO_MEDIO = '#cbb48a';
const GRIS_CLARO = '#b9b1a8';

/**
 * Los tipos de acto en papel. En pantalla la Agenda tiene un color por tipo;
 * aquí la paleta es cerrada y los tipos se distinguen también por lo claro u
 * oscuro, para que se lean en una fotocopia en blanco y negro.
 */
const TIPOS: Record<string, string> = {
  'tipo:CULTO': NEGRO,
  'tipo:PROCESION': '#7d6f73',
  'tipo:ENSAYO': '#7d6f73',
  'tipo:REUNION': BURDEOS_VIVO,
  'tipo:FORMACION': ORO,
  'tipo:SOCIAL': ORO_MEDIO,
  'tipo:OTRO': GRIS_CLARO,
};

/**
 * El color de papel de un color con nombre. Los nombres vienen de la pantalla
 * («oro» para la serie principal, «rojo» para lo que resta…); en papel la serie
 * principal va en negro y lo que resta en burdeos.
 */
export function colorDePapel(c: Color, varios: boolean): string {
  if (c.startsWith('tipo:')) return TIPOS[c] ?? GRIS_CLARO;
  if (c === 'rojo') return BURDEOS_VIVO;
  if (!varios) return NEGRO;
  const varias: Record<string, string> = { verde: NEGRO, oro: ORO, azul: ORO_PALIDO, gris: GRIS_CLARO };
  return varias[c] ?? GRIS_CLARO;
}

export const LETRA = {
  fina: 'NewsreaderFina',
  titulo: 'Newsreader',
  tituloMedio: 'NewsreaderMedia',
  tituloFuerte: 'NewsreaderFuerte',
  cursiva: 'NewsreaderCursiva',
  texto: 'Instrument',
  textoMedio: 'InstrumentMedia',
  textoFuerte: 'InstrumentFuerte',
} as const;

export const A4 = { ancho: 595.28, alto: 841.89 };
export const MX = 48;
export const ANCHO_UTIL = A4.ancho - 2 * MX;
/** Hasta dónde llega el contenido: debajo va el pie. */
export const FIN = A4.alto - 67.5;
/** Dónde empieza el contenido en una página que sigue a otra (bajo la banda fina). */
export const INICIO_SIGUE = 72;

export type Doc = PDFKit.PDFDocument;

export function nuevoDocumento(titulo: string): Doc {
  const doc = new PDFDocument({
    size: 'A4',
    // Los márgenes son los de una página que sigue: si un párrafo largo no cabe,
    // pdfkit abre la siguiente y sigue escribiendo bajo la banda fina.
    margins: { top: INICIO_SIGUE, bottom: A4.alto - FIN, left: MX, right: MX },
    bufferPages: true,
    autoFirstPage: true,
    info: { Title: titulo, Author: identidad.nombre, Creator: `CMS de ${identidad.nombreCorto}` },
  });
  doc.registerFont(LETRA.fina, ruta('./fuentes/Newsreader-Light.ttf'));
  doc.registerFont(LETRA.titulo, ruta('./fuentes/Newsreader-Regular.ttf'));
  doc.registerFont(LETRA.tituloMedio, ruta('./fuentes/Newsreader-Medium.ttf'));
  doc.registerFont(LETRA.tituloFuerte, ruta('./fuentes/Newsreader-SemiBold.ttf'));
  doc.registerFont(LETRA.cursiva, ruta('./fuentes/Newsreader-Italic.ttf'));
  doc.registerFont(LETRA.texto, ruta('./fuentes/InstrumentSans-Regular.ttf'));
  doc.registerFont(LETRA.textoMedio, ruta('./fuentes/InstrumentSans-Medium.ttf'));
  doc.registerFont(LETRA.textoFuerte, ruta('./fuentes/InstrumentSans-SemiBold.ttf'));
  doc.font(LETRA.texto).fontSize(9.5).fillColor(NEGRO);
  return doc;
}

/** El PDF entero en memoria: son unas pocas páginas y así se prueba sin servidor. */
export function aBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const trozos: Buffer[] = [];
    doc.on('data', (t: Buffer) => trozos.push(t));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);
    doc.end();
  });
}

/** Escribir fuera de la caja (bandas, pies) sin que pdfkit abra una página nueva. */
export function sinMargenes(doc: Doc, dibujar: () => void) {
  const margenes = doc.page.margins;
  doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
  dibujar();
  doc.page.margins = margenes;
}

// ---------------------------------------------------------------- el paso de página

/**
 * Lleva la cuenta de por dónde va la página y abre la siguiente cuando algo no
 * cabe. La página que sigue lleva la banda fina con el nombre del capítulo, lo
 * mismo si la abre `sitio` que si la abre pdfkit a mitad de un párrafo.
 */
export class Paginas {
  private abriendo = false;
  /** Lo que dice la banda fina de las páginas que siguen: se cambia al abrir cada capítulo. */
  seccion = '';

  constructor(readonly doc: Doc, readonly cabecera: string) {
    doc.on('pageAdded', () => {
      if (this.abriendo) return;
      // Si la abre pdfkit a mitad de un párrafo, el párrafo sigue con la letra
      // y el color que haya al volver: los de la banda, si no se devuelven.
      // pdfkit no ofrece otra forma de leerlos que sus campos internos.
      const estado = doc as unknown as { _font: unknown; _fontSize: number; _fillColor: [string, number] };
      const [letra, tam, [color, opacidad]] = [estado._font, estado._fontSize, estado._fillColor];
      bandaSigue(doc, this.cabecera, this.seccion);
      estado._font = letra;
      doc.fontSize(tam).fillColor(color, opacidad);
      doc.x = MX;
      doc.y = INICIO_SIGUE;
    });
  }

  /** Una página nueva que pinta su propia cabecera (un capítulo, el índice…). */
  nueva(): void {
    this.abriendo = true;
    this.doc.addPage();
    this.abriendo = false;
  }

  /** Salta de página si lo que viene no cabe; devuelve dónde empezar a escribir. */
  sitio(alto: number): number {
    if (this.doc.y + alto > FIN) this.doc.addPage();
    return this.doc.y;
  }

  get y(): number { return this.doc.y; }
  set y(v: number) { this.doc.y = v; }
}

// ---------------------------------------------------------------- texto

export interface OpcionesRotulo { letra?: string; tam?: number; color?: string; ancho?: number; alinear?: 'left' | 'center' | 'right'; espaciado?: number; opacidad?: number }

/**
 * Una línea de texto en un sitio fijo, sin partirla ni saltar de página. Con
 * `ancho` se alinea dentro de esa caja midiendo el texto (y se recorta con
 * «…» si no cabe).
 */
export function rotulo(doc: Doc, texto: string, x: number, y: number, o: OpcionesRotulo = {}) {
  const espaciado = o.espaciado ?? 0;
  doc.font(o.letra ?? LETRA.texto).fontSize(o.tam ?? 9).fillColor(o.color ?? GRIS, o.opacidad ?? 1);
  const medir = (t: string) => doc.widthOfString(t, { characterSpacing: espaciado });
  let linea = texto;
  if (o.ancho && medir(linea) > o.ancho) {
    while (linea.length > 1 && medir(`${linea}…`) > o.ancho) linea = linea.slice(0, -1);
    linea = `${linea.trimEnd()}…`;
  }
  let xx = x;
  if (o.ancho && o.alinear === 'right') xx = x + o.ancho - medir(linea);
  if (o.ancho && o.alinear === 'center') xx = x + (o.ancho - medir(linea)) / 2;
  doc.text(linea, xx, y, { lineBreak: false, characterSpacing: espaciado });
  doc.fillOpacity(1);
}

/**
 * «4.314 €» y «46 %» no se parten al final de una línea. `euros()` deja un
 * espacio normal (la pantalla lo prefiere así); en papel se pega con uno duro.
 */
export const pegar = (texto: string) => texto.replace(/ (€|%)/g, '\u00a0$1');

/** «CAPÍTULO IV»: los rótulos van en versalitas espaciadas. */
export const versalitas = (texto: string) => texto.toLocaleUpperCase('es-ES');

export function rotuloVersalitas(doc: Doc, texto: string, x: number, y: number, o: OpcionesRotulo = {}) {
  rotulo(doc, versalitas(texto), x, y, { letra: LETRA.textoFuerte, tam: 8, espaciado: 1.1, ...o });
}

/** El rombo de oro de los estados vacíos y de la portada: la letra no lo trae. */
export function rombo(doc: Doc, cx: number, cy: number, r: number, relleno: string, borde?: string) {
  doc.save();
  doc.polygon([cx, cy - r], [cx + r, cy], [cx, cy + r], [cx - r, cy]);
  if (borde) doc.lineWidth(0.75).fillAndStroke(relleno, borde);
  else doc.fill(relleno);
  doc.restore();
}

/** La marca de «celebrado» del calendario, dibujada. */
export function marcaHecho(doc: Doc, x: number, y: number) {
  doc.save().moveTo(x, y + 3.2).lineTo(x + 2.6, y + 5.8).lineTo(x + 7, y).lineWidth(1.1).strokeColor(GRIS).stroke().restore();
}

/** La entradilla: una o dos frases grandes, con la cifra que las sostiene en negrita. */
export function entradilla(p: Paginas, trozos: Trozo[], ancho = ANCHO_UTIL) {
  const doc = p.doc;
  const opciones = { width: ancho, lineGap: 4.5 };
  doc.font(LETRA.titulo).fontSize(14);
  const alto = doc.heightOfString(pegar(trozos.map((t) => t.texto).join('')), opciones) + 6;
  const y = p.sitio(alto);
  doc.fillColor(NEGRO);
  trozos.forEach((t, i) => {
    doc.font(t.fuerte ? LETRA.tituloFuerte : LETRA.titulo).fontSize(14);
    const continua = i < trozos.length - 1;
    if (i === 0) doc.text(pegar(t.texto), MX, y, { ...opciones, continued: continua });
    else doc.text(pegar(t.texto), { ...opciones, continued: continua });
  });
  doc.x = MX;
  doc.y = y + alto + 10;
}

/** Párrafos de un texto escrito a mano: una línea en blanco separa uno de otro. */
export function parrafos(p: Paginas, texto: string, o: { tam?: number } = {}) {
  const doc = p.doc;
  const tam = o.tam ?? 12;
  for (const parrafo of texto.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean)) {
    const limpio = parrafo.replace(/\s*\n\s*/g, ' ');
    doc.font(LETRA.titulo).fontSize(tam).fillColor(NEGRO);
    // Que un párrafo no empiece en la última línea de una página.
    p.sitio(tam * 3);
    doc.text(limpio, MX, doc.y, { width: ANCHO_UTIL, align: 'justify', lineGap: 3.5, paragraphGap: 9, indent: 18 });
  }
}

/** Lo que se escribe en el CMS y aún no está: una caja marfil con el aviso entre corchetes. */
export function hueco(p: Paginas, texto: string) {
  const doc = p.doc;
  doc.font(LETRA.cursiva).fontSize(12.5);
  const alto = doc.heightOfString(texto, { width: ANCHO_UTIL - 30, lineGap: 3 }) + 28;
  const y = p.sitio(alto);
  doc.rect(MX, y, ANCHO_UTIL, alto).fill(MARFIL);
  doc.rect(MX, y, ANCHO_UTIL, 1.5).fill(ORO);
  doc.font(LETRA.cursiva).fontSize(12.5).fillColor(GRIS).text(texto, MX + 15, y + 14, { width: ANCHO_UTIL - 30, lineGap: 3 });
  doc.x = MX;
  doc.y = y + alto + 14;
}

// ---------------------------------------------------------------- bandas y pies

/** Banda negra a sangre de la primera página de un capítulo. */
export function bandaCapitulo(doc: Doc, o: { cabecera: string; antetitulo: string; titulo: string; numeral?: string }) {
  sinMargenes(doc, () => {
    doc.rect(0, 0, A4.ancho, 126).fill(NEGRO);
    doc.rect(0, 122.25, A4.ancho, 3.75).fill(BURDEOS);
    rotulo(doc, o.cabecera, MX, 17, { tam: 8.25, color: CREMA, opacidad: 0.75 });
    rotulo(doc, identidad.nombre, MX, 17, { tam: 8.25, color: CREMA, opacidad: 0.75, ancho: ANCHO_UTIL, alinear: 'right' });
    const numeral = o.numeral ? 60 : 0;
    rotuloVersalitas(doc, o.antetitulo, MX, 62, { tam: 8.25, color: ORO_CLARO, ancho: ANCHO_UTIL - numeral });
    doc.font(LETRA.tituloMedio).fontSize(32);
    // Un título largo («Sábado de Pasión y Rosario vespertino») baja un punto de cuerpo hasta caber.
    let tam = 32;
    while (tam > 22 && doc.widthOfString(o.titulo) > ANCHO_UTIL - numeral - 10) doc.fontSize(--tam);
    doc.fillColor(CREMA).text(o.titulo, MX, 78 + (32 - tam) * 0.6, { lineBreak: false });
    if (o.numeral) rotulo(doc, o.numeral, MX, 64, { letra: LETRA.titulo, tam: 46, color: ORO_CLARO, ancho: ANCHO_UTIL, alinear: 'right' });
  });
  doc.x = MX;
  doc.y = 153;
}

/** La banda fina de una página que sigue a otra del mismo capítulo. */
export function bandaSigue(doc: Doc, izquierda: string, derecha: string) {
  sinMargenes(doc, () => {
    doc.rect(0, 0, A4.ancho, 42).fill(NEGRO);
    doc.rect(0, 39.75, A4.ancho, 2.25).fill(BURDEOS);
    rotulo(doc, izquierda, MX, 16, { tam: 8.25, color: CREMA, opacidad: 0.75, ancho: ANCHO_UTIL / 2 });
    rotuloVersalitas(doc, derecha, MX + ANCHO_UTIL / 2, 16, { tam: 8, color: ORO_CLARO, ancho: ANCHO_UTIL / 2, alinear: 'right' });
  });
}

/** El membrete de un informe suelto: banda negra con el escudo en oro. */
export function bandaInforme(doc: Doc, titulo: string, derecha: string[]) {
  sinMargenes(doc, () => {
    doc.rect(0, 0, A4.ancho, 112.5).fill(NEGRO);
    doc.rect(0, 108.75, A4.ancho, 3.75).fill(BURDEOS);
    doc.image(IMAGENES.escudoOro, MX, 20, { height: 69 });
    const x = MX + 72;
    rotuloVersalitas(doc, identidad.nombre, x, 36, { tam: 8, color: ORO_CLARO, ancho: ANCHO_UTIL - 72 });
    doc.font(LETRA.texto).fontSize(9);
    const anchoDerecha = Math.max(...derecha.map((l) => doc.widthOfString(l)));
    doc.font(LETRA.tituloMedio).fontSize(29);
    let tam = 29;
    while (tam > 20 && doc.widthOfString(titulo) > ANCHO_UTIL - 72 - anchoDerecha - 16) doc.fontSize(--tam);
    doc.fillColor(CREMA).text(titulo, x, 52 + (29 - tam) * 0.5, { lineBreak: false });
    derecha.forEach((l, i) => rotulo(doc, l, MX, 60 + i * 13, { tam: 9, color: CREMA, opacidad: 0.85, ancho: ANCHO_UTIL, alinear: 'right' }));
  });
  doc.x = MX;
  doc.y = 139.5;
}

/**
 * El pie de las páginas `desde` en adelante, cuando ya se sabe cuántas hay:
 * a la izquierda el escudo y lo que se diga, a la derecha el folio en su círculo.
 */
export function pies(doc: Doc, izquierda: string, desde = 0, escudo = true) {
  const total = doc.bufferedPageRange().count;
  for (let i = desde; i < total; i++) {
    doc.switchToPage(i);
    sinMargenes(doc, () => {
      const y = A4.alto - 40;
      let x = MX;
      if (escudo) {
        doc.image(IMAGENES.escudo, MX, y - 1, { height: 18 });
        x += 22;
      }
      rotulo(doc, izquierda, x, y + 4, { tam: 9, color: GRIS, ancho: ANCHO_UTIL - 60 });
      const cx = A4.ancho - MX - 11.25;
      doc.circle(cx, y + 8.5, 11.25).fill(NEGRO);
      rotulo(doc, String(i + 1), cx - 11.25, y + 4.2, { letra: LETRA.textoFuerte, tam: 9, color: ORO_CLARO, ancho: 22.5, alinear: 'center' });
    });
  }
}

/** «BORRADOR» en oro, arriba a la derecha de cada página. */
export function marcaBorrador(doc: Doc, desde = 0) {
  const total = doc.bufferedPageRange().count;
  for (let i = desde; i < total; i++) {
    doc.switchToPage(i);
    sinMargenes(doc, () => rotuloVersalitas(doc, 'Borrador', MX, i === 0 ? 24 : 4, { tam: 7.5, color: ORO_CLARO, ancho: ANCHO_UTIL, alinear: 'right', espaciado: 2 }));
  }
}

// ---------------------------------------------------------------- cifras en tarjetas

export interface Tarjeta { etiqueta: string; valor: string; sufijo?: string; nota: string }

const ETIQUETA = { letra: LETRA.textoFuerte, tam: 7.5, espaciado: 0.9, linea: 9.5 };
const NOTA = { letra: LETRA.texto, tam: 9, espaciado: 0, linea: 11 };

/**
 * Las cifras en tarjetas marfil con un filete de oro arriba, de cuatro en fila.
 * Una etiqueta o una nota larga («Formación y convivencia», «+48 en el curso, a
 * día de hoy») pasa a dos líneas en vez de cortarse, y toda su fila crece igual.
 */
export function tarjetas(p: Paginas, lista: Tarjeta[], o: { columnas?: number; tam?: number } = {}) {
  const doc = p.doc;
  const cols = o.columnas ?? 4;
  const tam = o.tam ?? 23;
  const separa = 6;
  const ancho = (ANCHO_UTIL - separa * (cols - 1)) / cols;
  const w = ancho - 22;
  // Se mide como se escribe (partiendo por palabras), no por el ancho total del texto.
  const opciones = (e: typeof ETIQUETA | typeof NOTA) => ({ width: w, characterSpacing: e.espaciado, lineGap: e.linea - e.tam * 1.2 });
  const lineas = (texto: string, e: typeof ETIQUETA | typeof NOTA) => {
    doc.font(e.letra).fontSize(e.tam);
    return Math.min(2, Math.max(1, Math.round(doc.heightOfString(texto, opciones(e)) / e.linea)));
  };
  const filas: Tarjeta[][] = [];
  for (let i = 0; i < lista.length; i += cols) filas.push(lista.slice(i, i + cols));
  const medidas = filas.map((f) => {
    const et = Math.max(...f.map((t) => lineas(versalitas(t.etiqueta), ETIQUETA)));
    const no = Math.max(...f.map((t) => lineas(pegar(t.nota), NOTA)));
    return { et, no, alto: 11 + et * ETIQUETA.linea + 4 + tam + 6 + no * NOTA.linea + 9 };
  });
  const total = medidas.reduce((s, m) => s + m.alto, 0) + (filas.length - 1) * separa;
  let y = p.sitio(total);
  filas.forEach((f, i) => {
    const m = medidas[i];
    f.forEach((t, j) => {
      const x = MX + j * (ancho + separa);
      doc.rect(x, y, ancho, m.alto).fill(MARFIL);
      doc.rect(x, y, ancho, 1.5).fill(ORO);
      doc.font(ETIQUETA.letra).fontSize(ETIQUETA.tam).fillColor(BURDEOS)
        .text(versalitas(t.etiqueta), x + 11, y + 11, { ...opciones(ETIQUETA), height: 2 * ETIQUETA.linea + 2, ellipsis: true });
      const yValor = y + 11 + m.et * ETIQUETA.linea + 4;
      doc.font(LETRA.tituloMedio).fontSize(tam);
      let tamValor = tam;
      while (tamValor > 14 && doc.widthOfString(t.valor) + (t.sufijo ? 30 : 0) > w) doc.fontSize(--tamValor);
      doc.fillColor(NEGRO).text(t.valor, x + 11, yValor + (tam - tamValor) * 0.7, { lineBreak: false });
      if (t.sufijo) rotulo(doc, t.sufijo, x + 11 + doc.widthOfString(t.valor) + 4, yValor + tamValor * 0.42, { letra: LETRA.cursiva, tam: 11.5, color: GRIS });
      doc.font(NOTA.letra).fontSize(NOTA.tam).fillColor(GRIS)
        .text(pegar(t.nota), x + 11, yValor + tam + 6, { ...opciones(NOTA), height: 2 * NOTA.linea + 2, ellipsis: true });
    });
    y += m.alto + separa;
  });
  doc.x = MX;
  doc.y = y - separa + 22;
}

// ---------------------------------------------------------------- gráficas

/** Título de un bloque, con el resumen a la derecha y un filete negro debajo. */
export function tituloDeBloque(doc: Doc, titulo: string, resumen: string, x: number, y: number, ancho: number): number {
  doc.font(LETRA.textoFuerte).fontSize(10.5);
  const usado = Math.min(ancho, doc.widthOfString(titulo));
  rotulo(doc, titulo, x, y, { letra: LETRA.textoFuerte, tam: 10.5, color: NEGRO, ancho });
  const queda = ancho - usado - 12;
  doc.font(LETRA.texto).fontSize(9);
  if (resumen && doc.widthOfString(resumen) <= queda) rotulo(doc, resumen, x + usado + 12, y + 1.5, { tam: 9, color: GRIS, ancho: queda, alinear: 'right' });
  doc.rect(x, y + 16, ancho, 1.5).fill(NEGRO);
  return y + 25;
}

export function leyenda(doc: Doc, items: { texto: string; color: string }[], x: number, y: number): number {
  let lx = x;
  for (const l of items) {
    doc.rect(lx, y + 1.5, 7, 7).fill(l.color);
    rotulo(doc, l.texto, lx + 10, y, { tam: 9, color: GRIS });
    lx += 10 + doc.widthOfString(l.texto) + 14;
  }
  return y + 16;
}

const corto = (v: number, formato: Formato) => {
  if (formato === 'euros') return v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} k` : numero(Math.round(v));
  return numero(v);
};

/** «mar 26» cabe en una columna ancha; en una estrecha se queda en «mar». */
function etiquetaQueCabe(doc: Doc, et: string, paso: number) {
  doc.font(LETRA.texto).fontSize(8.5);
  return doc.widthOfString(et) + 3 > paso ? et.split(' ')[0] : et;
}

function columnas(doc: Doc, c: Extract<Cuerpo, { tipo: 'columnas' }>, x: number, y: number, ancho: number, alto: number) {
  const base = y + alto - 16;
  const tope = y + 13;
  const max = Math.max(1, ...c.series.flatMap((s) => s.valores));
  const n = c.etiquetas.length, k = c.series.length;
  const paso = ancho / Math.max(1, n);
  const w = Math.min(26, (paso * 0.62) / k);
  // Con muchas columnas estrechas y dos series, los números chocarían: solo se ponen con sitio.
  const conValores = k === 1 || paso >= 30;
  doc.rect(x, base, ancho, 0.75).fill(NEGRO);
  c.etiquetas.forEach((et, i) => {
    const cx = x + paso * i + paso / 2;
    const x0 = cx - (w * k + 1.5 * (k - 1)) / 2;
    c.series.forEach((_, j) => {
      const v = c.series[j].valores[i] ?? 0;
      if (v <= 0) return;
      const h = ((base - tope) * v) / max;
      const destacada = c.destacar === undefined || c.destacar === i;
      const tono = destacada ? [NEGRO, BURDEOS_VIVO][j] ?? GRIS_CLARO : ORO_PALIDO;
      doc.rect(x0 + j * (w + 1.5), base - h, w, h).fill(tono);
      if (conValores) rotulo(doc, corto(v, c.formato), x0 + j * (w + 1.5) - 12, base - h - 11, { tam: 8.5, color: destacada && c.destacar !== undefined ? NEGRO : GRIS, ancho: w + 24, alinear: 'center' });
    });
    const fuerte = c.destacar === i;
    rotulo(doc, etiquetaQueCabe(doc, et, paso), cx - paso / 2, base + 4.5, { tam: 8.5, color: fuerte ? NEGRO : GRIS, ancho: paso, alinear: 'center', letra: fuerte ? LETRA.textoFuerte : LETRA.texto });
  });
}

function apiladas(doc: Doc, c: Extract<Cuerpo, { tipo: 'apiladas' }>, x: number, y: number, ancho: number, alto: number) {
  const base = y + alto - 16;
  const tope = y + 14;
  const n = c.etiquetas.length;
  const totales = c.etiquetas.map((_, i) => c.capas.reduce((s, capa) => s + (capa.valores[i] ?? 0), 0));
  const max = Math.max(1, ...totales);
  const paso = ancho / Math.max(1, n);
  const w = Math.min(22, paso * 0.56);
  if (c.hoy !== undefined && c.hoy >= 0) {
    const xh = x + paso * (c.hoy + 1);
    doc.save().moveTo(xh, tope - 6).lineTo(xh, base).dash(2.25, { space: 2.25 }).lineWidth(0.75).strokeColor(ORO).stroke().undash().restore();
    // El oro de los filetes se queda en 3:1 sobre blanco; para leer, uno más oscuro (5:1).
    rotulo(doc, 'hoy', xh + 4, tope - 8, { tam: 8.5, color: '#8a6a30' });
  }
  doc.rect(x, base, ancho, 0.75).fill(NEGRO);
  c.etiquetas.forEach((et, i) => {
    const cx = x + paso * i + paso / 2;
    let cima = base;
    for (const capa of c.capas) {
      const v = capa.valores[i] ?? 0;
      if (!v) continue;
      const h = ((base - tope) * v) / max;
      doc.rect(cx - w / 2, cima - h + 0.75, w, h - 0.75).fill(colorDePapel(capa.color, true));
      cima -= h;
    }
    if (totales[i]) rotulo(doc, numero(totales[i]), cx - 15, cima - 11, { tam: 8.5, color: NEGRO, ancho: 30, alinear: 'center' });
    rotulo(doc, etiquetaQueCabe(doc, et, paso), cx - paso / 2, base + 4.5, { tam: 8.5, ancho: paso, alinear: 'center' });
  });
}

export const ALTO_BARRA = 19.5;

function barras(doc: Doc, c: Extract<Cuerpo, { tipo: 'barras' }>, x: number, y: number, ancho: number, desde = 0) {
  const max = Math.max(1, ...c.filas.map((f) => f.valores.reduce((s, v) => s + v, 0)));
  const varios = c.colores.length > 1;
  doc.font(LETRA.texto).fontSize(9.5);
  const etiqueta = Math.min(150, ancho * 0.5, Math.max(ancho * 0.3, ...c.filas.map((f) => doc.widthOfString(f.etiqueta) + 16)));
  doc.font(LETRA.texto).fontSize(9);
  const nota = Math.min(110, Math.max(28, ...c.filas.map((f) => doc.widthOfString(f.nota) + 6)));
  const zona = ancho - etiqueta - nota - 16;
  c.filas.forEach((f, i) => {
    const yy = y + i * ALTO_BARRA;
    if ((desde + i) % 2 === 0) doc.rect(x, yy, ancho, ALTO_BARRA).fill(MARFIL);
    rotulo(doc, f.etiqueta, x + 6, yy + 5.5, { tam: 9.5, color: NEGRO, ancho: etiqueta - 10 });
    let xx = x + etiqueta;
    f.valores.forEach((v, j) => {
      if (!v) return;
      const w = (zona * v) / max;
      doc.rect(xx, yy + 6, Math.max(w - 0.75, 0.75), 7.5).fill(colorDePapel(c.colores[j] ?? c.colores[0], varios));
      xx += w;
    });
    rotulo(doc, f.nota, x + ancho - nota - 6, yy + 5.5, { tam: 9, color: NEGRO, ancho: nota, alinear: 'right' });
  });
}

/** Lo que ocupa el cuerpo de una gráfica. */
export function altoDelCuerpo(c: Cuerpo, altoColumnas: number): number {
  if (c.tipo === 'barras') return c.filas.length * ALTO_BARRA;
  if (c.tipo === 'lista') return c.filas.length * ALTO_BARRA;
  return altoColumnas;
}

/** Lo que ocupa un estado vacío: una línea, o dos si el texto no cabe. */
export function altoDeVacio(doc: Doc, texto: string, ancho: number): number {
  doc.font(LETRA.texto).fontSize(9.5);
  return doc.heightOfString(texto, { width: ancho - 36, lineGap: 2 }) + 18;
}

/** Un estado vacío: caja marfil con el rombo de oro y lo que falta dicho en palabras. */
export function vacio(doc: Doc, texto: string, x: number, y: number, ancho: number): number {
  const alto = altoDeVacio(doc, texto, ancho);
  doc.rect(x, y, ancho, alto).fill(MARFIL);
  rombo(doc, x + 14, y + alto / 2, 3.5, ORO);
  doc.font(LETRA.texto).fontSize(9.5).fillColor(GRIS).text(texto, x + 26, y + 9, { width: ancho - 36, lineGap: 2 });
  return alto;
}

export interface OpcionesGrafica { altoColumnas?: number }

/** Lo que ocupa una gráfica entera: título, leyenda, dibujo y pie. */
export function altoDeGrafica(doc: Doc, g: Grafica, ancho: number, o: OpcionesGrafica = {}): number {
  const cabecera = 25 + (g.leyenda?.length && !g.vacio ? 16 : 0);
  const cuerpo = g.vacio ? altoDeVacio(doc, g.vacio, ancho) : altoDelCuerpo(g.cuerpo, o.altoColumnas ?? 130);
  return cabecera + cuerpo + (g.pie ? 16 : 0);
}

const coloresDeLeyenda = (g: Grafica) => {
  const c = g.cuerpo;
  return (g.leyenda ?? []).map((l, j) => ({
    texto: l.texto,
    // En columnas, la leyenda sigue el orden de las series (negro, burdeos); en lo demás, su color.
    color: c.tipo === 'columnas' ? [NEGRO, BURDEOS_VIVO][j] ?? GRIS_CLARO : colorDePapel(l.color, c.tipo === 'apiladas' || (c.tipo === 'barras' && c.colores.length > 1)),
  }));
};

/** Una gráfica en un sitio fijo, sin partirla (se ha medido antes con `altoDeGrafica`). */
export function graficaEn(doc: Doc, g: Grafica, x: number, y: number, ancho: number, o: OpcionesGrafica = {}): number {
  let yy = tituloDeBloque(doc, g.titulo, g.resumen, x, y, ancho);
  if (g.leyenda?.length && !g.vacio) yy = leyenda(doc, coloresDeLeyenda(g), x, yy);
  if (g.vacio) {
    yy += vacio(doc, g.vacio, x, yy, ancho);
  } else if (g.cuerpo.tipo === 'columnas') {
    columnas(doc, g.cuerpo, x, yy, ancho, o.altoColumnas ?? 130);
    yy += o.altoColumnas ?? 130;
  } else if (g.cuerpo.tipo === 'apiladas') {
    apiladas(doc, g.cuerpo, x, yy, ancho, o.altoColumnas ?? 130);
    yy += o.altoColumnas ?? 130;
  } else if (g.cuerpo.tipo === 'barras') {
    barras(doc, g.cuerpo, x, yy, ancho);
    yy += g.cuerpo.filas.length * ALTO_BARRA;
  }
  if (g.pie) {
    rotulo(doc, g.pie, x, yy + 5, { tam: 9, color: GRIS, ancho });
    yy += 16;
  }
  return yy;
}

/**
 * Una gráfica a todo lo ancho, en el flujo de la página. Unas barras que no
 * caben se parten entre esta página y la siguiente; lo demás salta entero.
 */
export function grafica(p: Paginas, g: Grafica, o: OpcionesGrafica = {}) {
  const doc = p.doc;
  const alto = altoDeGrafica(doc, g, ANCHO_UTIL, o);
  const partible = !g.vacio && g.cuerpo.tipo === 'barras' && alto > FIN - p.y;
  if (!partible) {
    const y = p.sitio(alto);
    doc.y = graficaEn(doc, g, MX, y, ANCHO_UTIL, o) + 22;
    return;
  }
  const cuerpo = g.cuerpo as Extract<Cuerpo, { tipo: 'barras' }>;
  let y = tituloDeBloque(doc, g.titulo, g.resumen, MX, p.sitio(25 + (g.leyenda?.length ? 16 : 0) + ALTO_BARRA * 3), ANCHO_UTIL);
  if (g.leyenda?.length) y = leyenda(doc, coloresDeLeyenda(g), MX, y);
  let desde = 0;
  while (desde < cuerpo.filas.length) {
    const caben = Math.max(1, Math.floor((FIN - y) / ALTO_BARRA));
    const tramo = cuerpo.filas.slice(desde, desde + caben);
    barras(doc, { ...cuerpo, filas: tramo }, MX, y, ANCHO_UTIL, desde);
    y += tramo.length * ALTO_BARRA;
    desde += tramo.length;
    if (desde < cuerpo.filas.length) {
      doc.addPage();
      y = doc.y;
    }
  }
  if (g.pie) {
    rotulo(doc, g.pie, MX, y + 5, { tam: 9, color: GRIS, ancho: ANCHO_UTIL });
    y += 16;
  }
  doc.x = MX;
  doc.y = y + 22;
}

export const HUECO_COLUMNAS = 27;

/**
 * Dos columnas de gráficas lado a lado (cada columna, una o varias gráficas
 * apiladas). Si la fila no cabe entera ni en una página vacía, van una detrás
 * de otra a todo lo ancho.
 */
export function fila(p: Paginas, cols: Grafica[][], o: OpcionesGrafica = {}) {
  const doc = p.doc;
  const ancho = (ANCHO_UTIL - HUECO_COLUMNAS) / 2;
  const altoCol = (gs: Grafica[]) => gs.reduce((s, g) => s + altoDeGrafica(doc, g, ancho, o), 0) + (gs.length - 1) * 18;
  const alto = Math.max(...cols.map(altoCol));
  if (alto > FIN - INICIO_SIGUE) {
    for (const g of cols.flat()) grafica(p, g, o);
    return;
  }
  const y = p.sitio(alto);
  cols.forEach((gs, i) => {
    let yy = y;
    for (const g of gs) yy = graficaEn(doc, g, MX + i * (ancho + HUECO_COLUMNAS), yy, ancho, o) + 18;
  });
  doc.x = MX;
  doc.y = y + alto + 22;
}

export { euros, numero };
