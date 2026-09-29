import PDFDocument from 'pdfkit';
import { fileURLToPath } from 'node:url';
import type { Color, Cuerpo, Formato, Grafica } from '../../domain/datos-areas.js';
import { euros, numero } from '../../domain/datos-areas.js';

/**
 * Las piezas con que se componen los PDF de «Datos e informes»: la hoja, la
 * letra, los colores de imprenta y las gráficas dibujadas a mano con pdfkit.
 *
 * Mismo aire que la maqueta de la Memoria: hoja blanca, títulos en Cormorant,
 * texto en Exo 2, filete granate arriba y cifras en tinta. Las gráficas son
 * las de la pantalla (misma forma de datos, `Grafica`), pasadas a papel.
 */

const ruta = (relativa: string) => fileURLToPath(new URL(relativa, import.meta.url));

export const IMAGENES = {
  escudo: ruta('./imagenes/escudo.png'),
  virgen: ruta('./imagenes/virgen-portada.jpg'),
};

export const TINTA = '#231c1f';
export const GRIS = '#6b5c62';
export const FILETE = '#ddd3c8';
export const GRANATE = '#7a1f2b';
export const VERDE = '#2f6b3c';
export const ROJO = '#9b2c3a';

/** Los colores de las gráficas en papel. Los de la agenda son los del CMS en claro. */
const COLORES: Record<string, string> = {
  oro: '#b08f3e',
  rojo: '#b0414a',
  verde: '#3f8a52',
  azul: '#3d6a9e',
  gris: '#b9aeb2',
  'tipo:CULTO': '#b8283d',
  'tipo:PROCESION': '#8a4fd0',
  'tipo:FORMACION': '#2f7cc9',
  'tipo:ENSAYO': '#d2661c',
  'tipo:REUNION': '#667985',
  'tipo:SOCIAL': '#3c9448',
  'tipo:OTRO': '#a88300',
};
export const color = (c: Color) => COLORES[c] ?? GRIS;

/** Mezcla con blanco: las columnas que no se destacan van más claras. */
function aclarar(hex: string, cuanto: number): string {
  const n = parseInt(hex.slice(1), 16);
  const canal = (v: number) => Math.round(v + (255 - v) * cuanto);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(canal);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export const LETRA = {
  serif: 'Cormorant',
  serifCursiva: 'CormorantCursiva',
  serifFuerte: 'CormorantFuerte',
  sans: 'Exo',
  sansFuerte: 'ExoFuerte',
} as const;

export const A4 = { ancho: 595.28, alto: 841.89 };
export const MARGEN = { x: 54, arriba: 50, abajo: 46 };
export const ANCHO_UTIL = A4.ancho - 2 * MARGEN.x;
/** Dónde empieza el contenido, bajo la cabecera de cada página. */
export const INICIO_CONTENIDO = MARGEN.arriba + 34;
/** Dónde tiene que acabar, sobre el pie. */
export const FIN_CONTENIDO = A4.alto - MARGEN.abajo - 28;

export type Doc = PDFKit.PDFDocument;

export function nuevoDocumento(titulo: string): Doc {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: INICIO_CONTENIDO, bottom: MARGEN.abajo, left: MARGEN.x, right: MARGEN.x },
    bufferPages: true,
    autoFirstPage: true,
    info: { Title: titulo, Author: 'Grupo Parroquial Nuestra Señora de los Desamparados', Creator: 'CMS del Grupo Parroquial' },
  });
  doc.registerFont(LETRA.serif, ruta('./fuentes/Cormorant-Medium.ttf'));
  doc.registerFont(LETRA.serifCursiva, ruta('./fuentes/Cormorant-MediumItalic.ttf'));
  doc.registerFont(LETRA.serifFuerte, ruta('./fuentes/Cormorant-SemiBold.ttf'));
  doc.registerFont(LETRA.sans, ruta('./fuentes/Exo2-Regular.ttf'));
  doc.registerFont(LETRA.sansFuerte, ruta('./fuentes/Exo2-SemiBold.ttf'));
  doc.font(LETRA.sans).fontSize(10).fillColor(TINTA);
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

/** Salta de página si lo que viene no cabe; devuelve dónde empezar a escribir. */
export function sitio(doc: Doc, alto: number): number {
  if (doc.y + alto > FIN_CONTENIDO) {
    doc.addPage();
    doc.y = INICIO_CONTENIDO;
  }
  return doc.y;
}

/**
 * Una línea de texto en un sitio fijo, sin partirla ni saltar de página. Con
 * `ancho` se alinea dentro de esa caja midiendo el texto (y se recorta con
 * «…» si no cabe).
 */
export function rotulo(doc: Doc, texto: string, x: number, y: number, opciones: { letra?: string; tam?: number; color?: string; ancho?: number; alinear?: 'left' | 'center' | 'right'; espaciado?: number } = {}) {
  const espaciado = opciones.espaciado ?? 0;
  doc.font(opciones.letra ?? LETRA.sans).fontSize(opciones.tam ?? 8).fillColor(opciones.color ?? GRIS);
  const medir = (t: string) => doc.widthOfString(t, { characterSpacing: espaciado });
  let linea = texto;
  if (opciones.ancho && medir(linea) > opciones.ancho) {
    while (linea.length > 1 && medir(`${linea}…`) > opciones.ancho) linea = linea.slice(0, -1);
    linea = `${linea.trimEnd()}…`;
  }
  let xx = x;
  if (opciones.ancho && opciones.alinear === 'right') xx = x + opciones.ancho - medir(linea);
  if (opciones.ancho && opciones.alinear === 'center') xx = x + (opciones.ancho - medir(linea)) / 2;
  doc.text(linea, xx, y, { lineBreak: false, characterSpacing: espaciado });
}

/** «HERMANOS ACTIVOS»: etiqueta en versalitas espaciadas. */
export const versalitas = (texto: string) => texto.toLocaleUpperCase('es-ES');

/** Cabecera y pie de todas las páginas menos la primera, cuando ya se sabe cuántas hay. */
export function cabecerasYPies(doc: Doc, izquierda: string, derechaDe: (pagina: number) => string, pie: string, desde = 1, borrador = false) {
  const rango = doc.bufferedPageRange();
  const total = rango.count;
  for (let i = desde; i < total; i++) {
    doc.switchToPage(i);
    // Sin márgenes mientras se escribe fuera de la caja: si no, pdfkit abre páginas nuevas.
    const margenes = doc.page.margins;
    doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
    rotulo(doc, izquierda, MARGEN.x, MARGEN.arriba, { letra: LETRA.serifCursiva, tam: 11.5, color: GRIS });
    const derecha = `${borrador ? 'BORRADOR · ' : ''}${derechaDe(i)}`;
    rotulo(doc, derecha, MARGEN.x, MARGEN.arriba + 2, { tam: 8, color: borrador ? GRANATE : GRIS, ancho: ANCHO_UTIL, alinear: 'right' });
    doc.moveTo(MARGEN.x, MARGEN.arriba + 18).lineTo(A4.ancho - MARGEN.x, MARGEN.arriba + 18).lineWidth(1.4).strokeColor(GRANATE).stroke();
    const yPie = A4.alto - MARGEN.abajo;
    doc.moveTo(MARGEN.x, yPie - 8).lineTo(A4.ancho - MARGEN.x, yPie - 8).lineWidth(0.6).strokeColor(FILETE).stroke();
    rotulo(doc, pie, MARGEN.x, yPie, { tam: 7.5, color: GRIS, ancho: ANCHO_UTIL - 60, alinear: 'left' });
    rotulo(doc, `${i + 1} de ${total}`, MARGEN.x, yPie, { tam: 7.5, color: GRIS, ancho: ANCHO_UTIL, alinear: 'right' });
    doc.page.margins = margenes;
  }
}

// ---------------------------------------------------------------- cifras

export interface CifraPapel { etiqueta: string; valor: string; sufijo?: string; nota: string; colorValor?: string }

/** Una fila de cifras en columnas, con filetes como en la maqueta de la Memoria. */
export function filaDeCifras(doc: Doc, cifras: CifraPapel[], y: number, columnas = 4): number {
  const ancho = ANCHO_UTIL / columnas;
  const filas = Math.ceil(cifras.length / columnas);
  const altoFila = 68;
  doc.moveTo(MARGEN.x, y).lineTo(A4.ancho - MARGEN.x, y).lineWidth(0.9).strokeColor(TINTA).stroke();
  cifras.forEach((c, i) => {
    const fila = Math.floor(i / columnas), col = i % columnas;
    const x = MARGEN.x + col * ancho + (col ? 10 : 0);
    const yy = y + fila * altoFila + 10;
    const w = ancho - (col ? 14 : 8);
    rotulo(doc, versalitas(c.etiqueta), x, yy, { tam: 7, espaciado: 0.8, ancho: w, alinear: 'left' });
    doc.font(LETRA.serif).fontSize(25).fillColor(c.colorValor ?? TINTA);
    doc.text(c.valor, x, yy + 12, { lineBreak: false });
    // El sufijo, a su lado y sobre la misma línea de base (una letra más pequeña baja 8 pt).
    if (c.sufijo) rotulo(doc, c.sufijo, x + doc.widthOfString(c.valor) + 4, yy + 20, { letra: LETRA.serifCursiva, tam: 13, color: GRIS });
    rotulo(doc, c.nota, x, yy + 45, { tam: 7.5, ancho: w, alinear: 'left' });
    if (col) doc.moveTo(MARGEN.x + col * ancho, y + fila * altoFila).lineTo(MARGEN.x + col * ancho, y + (fila + 1) * altoFila).lineWidth(0.6).strokeColor(FILETE).stroke();
    doc.moveTo(MARGEN.x, y + (fila + 1) * altoFila).lineTo(A4.ancho - MARGEN.x, y + (fila + 1) * altoFila).lineWidth(fila === filas - 1 ? 0.9 : 0.6).strokeColor(fila === filas - 1 ? TINTA : FILETE).stroke();
  });
  return y + filas * altoFila;
}

// ---------------------------------------------------------------- gráficas

const corto = (v: number, formato: Formato) => {
  if (formato === 'euros') return v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} k` : numero(Math.round(v));
  return numero(v);
};

function columnas(doc: Doc, c: Extract<Cuerpo, { tipo: 'columnas' }>, x: number, y: number, ancho: number, alto: number) {
  const base = y + alto - 16;
  const tope = y + 12;
  const max = Math.max(1, ...c.series.flatMap((s) => s.valores));
  const n = c.etiquetas.length, k = c.series.length;
  const paso = ancho / Math.max(1, n);
  const w = Math.min(28, (paso * 0.66) / k);
  doc.moveTo(x, base + 0.5).lineTo(x + ancho, base + 0.5).lineWidth(0.8).strokeColor(TINTA).stroke();
  c.etiquetas.forEach((et, i) => {
    const cx = x + paso * i + paso / 2;
    const x0 = cx - (w * k + 2 * (k - 1)) / 2;
    c.series.forEach((s, j) => {
      const v = s.valores[i] ?? 0;
      const h = ((base - tope) * v) / max;
      const destacada = c.destacar === undefined || c.destacar === i;
      const tono = destacada ? color(s.color) : aclarar(color(s.color), 0.5);
      if (v > 0) doc.rect(x0 + j * (w + 2), base - h, w, h).fill(tono);
      if (v > 0) rotulo(doc, corto(v, c.formato), x0 + j * (w + 2) - 10, base - h - 9, { tam: 6.5, color: destacada && c.destacar !== undefined ? TINTA : GRIS, ancho: w + 20, alinear: 'center' });
    });
    rotulo(doc, et, cx - paso / 2, base + 4, { tam: 7, color: c.destacar === i ? TINTA : GRIS, ancho: paso, alinear: 'center', letra: c.destacar === i ? LETRA.sansFuerte : LETRA.sans });
  });
}

function apiladas(doc: Doc, c: Extract<Cuerpo, { tipo: 'apiladas' }>, x: number, y: number, ancho: number, alto: number) {
  const base = y + alto - 16;
  const tope = y + 14;
  const n = c.etiquetas.length;
  const totales = c.etiquetas.map((_, i) => c.capas.reduce((s, capa) => s + (capa.valores[i] ?? 0), 0));
  const max = Math.max(1, ...totales);
  const paso = ancho / Math.max(1, n);
  const w = Math.min(26, paso * 0.6);
  doc.moveTo(x, base + 0.5).lineTo(x + ancho, base + 0.5).lineWidth(0.8).strokeColor(TINTA).stroke();
  c.etiquetas.forEach((et, i) => {
    const cx = x + paso * i + paso / 2;
    let cima = base;
    for (const capa of c.capas) {
      const v = capa.valores[i] ?? 0;
      if (!v) continue;
      const h = ((base - tope) * v) / max;
      doc.rect(cx - w / 2, cima - h + 0.6, w, h - 1.2).fill(color(capa.color));
      cima -= h;
    }
    if (totales[i]) rotulo(doc, numero(totales[i]), cx - 15, cima - 9, { tam: 6.5, ancho: 30, alinear: 'center' });
    rotulo(doc, et, cx - paso / 2, base + 4, { tam: 7, ancho: paso, alinear: 'center', color: c.hoy === i ? TINTA : GRIS });
  });
  if (c.hoy !== undefined && c.hoy >= 0) {
    const xh = x + paso * c.hoy;
    doc.moveTo(xh, tope - 8).lineTo(xh, base).dash(2, { space: 2.5 }).lineWidth(0.6).strokeColor(GRANATE).stroke().undash();
    rotulo(doc, 'hoy', xh + 3, tope - 10, { tam: 6.5, color: GRANATE });
  }
}

const ALTO_BARRA = 17;

function barras(doc: Doc, c: Extract<Cuerpo, { tipo: 'barras' }>, x: number, y: number, ancho: number) {
  const max = Math.max(1, ...c.filas.map((f) => f.valores.reduce((s, v) => s + v, 0)));
  const etiqueta = Math.min(150, ancho * 0.32), nota = 96;
  const zona = ancho - etiqueta - nota - 16;
  c.filas.forEach((f, i) => {
    const yy = y + i * ALTO_BARRA;
    doc.moveTo(x, yy).lineTo(x + ancho, yy).lineWidth(0.4).strokeColor(FILETE).stroke();
    rotulo(doc, f.etiqueta, x, yy + 4.5, { tam: 8, color: TINTA, ancho: etiqueta - 6 });
    let xx = x + etiqueta;
    f.valores.forEach((v, j) => {
      if (!v) return;
      const w = (zona * v) / max;
      doc.rect(xx, yy + 5, Math.max(w - 0.8, 0.8), 7).fill(color(c.colores[j] ?? c.colores[0]));
      xx += w;
    });
    rotulo(doc, f.nota, x + ancho - nota, yy + 4.5, { tam: 7.5, ancho: nota, alinear: 'right' });
  });
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ALTO_LINEA_LISTA = 15;

function lista(doc: Doc, c: Extract<Cuerpo, { tipo: 'lista' }>, x: number, y: number, ancho: number) {
  c.filas.forEach((f, i) => {
    const yy = y + i * ALTO_LINEA_LISTA;
    doc.moveTo(x, yy).lineTo(x + ancho, yy).lineWidth(0.4).strokeColor(FILETE).stroke();
    const fecha = `${Number(f.dia.slice(8, 10))} ${MESES[Number(f.dia.slice(5, 7)) - 1]} ${f.dia.slice(0, 4)}`;
    rotulo(doc, fecha, x, yy + 4, { tam: 7.5, color: TINTA, ancho: 62, alinear: 'left' });
    rotulo(doc, f.hora ?? '', x + 62, yy + 4, { tam: 7.5, ancho: 30, alinear: 'left' });
    doc.circle(x + 98, yy + 7.5, 2.3).fill(color(f.color));
    rotulo(doc, f.titulo, x + 106, yy + 4, { tam: 8, color: TINTA, ancho: ancho - 106 });
    const usado = Math.min(ancho - 106, doc.widthOfString(f.titulo));
    if (f.lugar && usado < ancho - 150) rotulo(doc, ` · ${f.lugar}`, x + 106 + usado, yy + 4, { tam: 8, ancho: ancho - 106 - usado });
  });
}

/** Lo que ocupa el cuerpo de una gráfica, para saber si cabe antes de dibujarla. */
export function altoDelCuerpo(c: Cuerpo, altoColumnas = 130): number {
  if (c.tipo === 'barras') return c.filas.length * ALTO_BARRA + 4;
  if (c.tipo === 'lista') return c.filas.length * ALTO_LINEA_LISTA + 4;
  return altoColumnas;
}

/**
 * Una gráfica entera: título, resumen a la derecha, leyenda, el dibujo y el
 * pie. Salta de página si no cabe (una lista larga se parte en varias).
 */
export function grafica(doc: Doc, g: Grafica, opciones: { x?: number; ancho?: number; altoColumnas?: number } = {}) {
  const x = opciones.x ?? MARGEN.x;
  const ancho = opciones.ancho ?? ANCHO_UTIL;
  const cabecera = 22 + (g.leyenda?.length ? 13 : 0);
  const cuerpo = g.vacio ? 16 : altoDelCuerpo(g.cuerpo, opciones.altoColumnas);
  // Lo que no quepa en una página se parte solo si es una lista o unas barras largas.
  const partible = !g.vacio && (g.cuerpo.tipo === 'lista' || g.cuerpo.tipo === 'barras') && cuerpo > FIN_CONTENIDO - INICIO_CONTENIDO - 60;
  let y = sitio(doc, partible ? cabecera + 60 : cabecera + cuerpo + (g.pie ? 14 : 0) + 10);

  doc.font(LETRA.serifFuerte).fontSize(14.5).fillColor(TINTA).text(g.titulo, x, y, { lineBreak: false });
  rotulo(doc, g.resumen, x, y + 4, { tam: 7.5, ancho, alinear: 'right' });
  y += 20;
  if (g.leyenda?.length) {
    let lx = x;
    for (const l of g.leyenda) {
      doc.rect(lx, y + 1.5, 6, 6).fill(color(l.color));
      doc.font(LETRA.sans).fontSize(7.5).fillColor(GRIS).text(l.texto, lx + 9, y, { lineBreak: false });
      lx += 9 + doc.widthOfString(l.texto) + 12;
    }
    y += 13;
  }

  if (g.vacio) {
    rotulo(doc, g.vacio, x, y + 2, { tam: 8.5, letra: LETRA.serifCursiva, color: GRIS });
    y += 16;
  } else if (g.cuerpo.tipo === 'columnas') {
    columnas(doc, g.cuerpo, x, y, ancho, cuerpo);
    y += cuerpo;
  } else if (g.cuerpo.tipo === 'apiladas') {
    apiladas(doc, g.cuerpo, x, y, ancho, cuerpo);
    y += cuerpo;
  } else {
    // Barras y listas, por tramos: lo que quepa en esta página y el resto en la siguiente.
    const alto = g.cuerpo.tipo === 'barras' ? ALTO_BARRA : ALTO_LINEA_LISTA;
    const filas = g.cuerpo.filas as unknown[];
    let desde = 0;
    while (desde < filas.length) {
      const caben = Math.max(1, Math.floor((FIN_CONTENIDO - y - 4) / alto));
      const tramo = filas.slice(desde, desde + caben);
      if (g.cuerpo.tipo === 'barras') barras(doc, { ...g.cuerpo, filas: tramo as typeof g.cuerpo.filas }, x, y, ancho);
      else lista(doc, { ...g.cuerpo, filas: tramo as typeof g.cuerpo.filas }, x, y, ancho);
      y += tramo.length * alto;
      desde += tramo.length;
      if (desde < filas.length) {
        doc.addPage();
        y = INICIO_CONTENIDO;
      }
    }
    doc.moveTo(x, y).lineTo(x + ancho, y).lineWidth(0.4).strokeColor(FILETE).stroke();
    y += 4;
  }
  if (g.pie) {
    rotulo(doc, g.pie, x, y + 4, { tam: 7.5, letra: LETRA.sans });
    y += 14;
  }
  doc.x = MARGEN.x;
  doc.y = y + 18;
}

/** Párrafos de un texto escrito a mano: una línea en blanco separa uno de otro. */
export function parrafos(doc: Doc, texto: string, opciones: { tam?: number; x?: number; ancho?: number } = {}) {
  const x = opciones.x ?? MARGEN.x;
  const ancho = opciones.ancho ?? ANCHO_UTIL;
  doc.font(LETRA.serif).fontSize(opciones.tam ?? 12.5).fillColor(TINTA);
  for (const parrafo of texto.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
    const limpio = parrafo.replace(/\s*\n\s*/g, ' ');
    sitio(doc, 40);
    doc.text(limpio, x, doc.y, { width: ancho, align: 'justify', lineGap: 2.5, paragraphGap: 9 });
  }
}

export { euros };
