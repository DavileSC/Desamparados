/**
 * Las cartas y circulares en PDF: una por hermano, todas en un archivo para
 * imprimirlas de una vez. Con la misma letra y los mismos colores que la
 * papeleta (papel blanco, escudo en oro, filete de oro con el rombo burdeos).
 *
 * La dirección del destinatario va donde cae la ventana de un sobre americano
 * (DL, ventana a la derecha): la carta se dobla en tres y no hay que escribir
 * ningún sobre. Si el texto no cabe en una hoja, sigue en la siguiente; la
 * carta del siguiente hermano empieza siempre en hoja nueva.
 */
import { identidad, secretaria } from '../../domain/datos-entidad.js';
import { rellenar, type DestinatarioDeCarta } from '../../domain/cartas.js';
import { lineasDeDireccion, nombreCompleto } from '../../domain/etiquetas.js';
import {
  A4, BURDEOS, FILETE, GRIS, IMAGENES, LETRA, NEGRO, ORO,
  aBuffer, nuevoDocumento, rombo, rotulo, sinMargenes, versalitas, type Doc,
} from '../informes/pdf.js';

export interface DestinatarioConDireccion extends DestinatarioDeCarta {
  direccion: string | null;
  codigoPostal: string | null;
  poblacion: string | null;
  provincia: string | null;
}

export interface TextoDeCarta {
  asunto: string;
  cuerpo: string;
  firmaCargo: string;
  firmaNombre: string | null;
}

const MM = 72 / 25.4;
const MARGEN = 25 * MM;
const ANCHO = A4.ancho - 2 * MARGEN;
/** La ventana del sobre DL: a 105 mm del borde izquierdo y 50 mm del de arriba, 85 mm de ancho. */
const VENTANA = { x: 105 * MM, y: 50 * MM, ancho: 85 * MM };
const ORO_TEXTO = '#8a6a30';
const fechaLarga = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric' });

/** El membrete, la dirección, la fecha y el asunto: lo de la primera hoja de cada carta. */
function cabecera(doc: Doc, d: DestinatarioConDireccion, texto: TextoDeCarta, hoy: Date): number {
  sinMargenes(doc, () => {
    doc.rect(0, 0, A4.ancho, 4.5).fill(BURDEOS);
    doc.image(IMAGENES.escudoOro, MARGEN, 30, { fit: [46, 56], align: 'center', valign: 'center' });
    const x = MARGEN + 62;
    rotulo(doc, versalitas(identidad.tipo), x, 38, { letra: LETRA.textoFuerte, tam: 7.5, color: ORO_TEXTO, espaciado: 2.2 });
    rotulo(doc, identidad.titular, x, 50, { letra: LETRA.titulo, tam: 15, color: NEGRO, ancho: 300 });
    rotulo(doc, identidad.localidad, x, 70, { tam: 9, color: GRIS });
    doc.rect(MARGEN, 100, ANCHO / 2 - 10, 0.75).fill(ORO);
    doc.rect(A4.ancho / 2 + 10, 100, ANCHO / 2 - 10, 0.75).fill(ORO);
    rombo(doc, A4.ancho / 2, 100.4, 3.5, BURDEOS);

    // En la ventana del sobre.
    doc.font(LETRA.texto).fontSize(11).fillColor(NEGRO);
    let y = VENTANA.y;
    for (const linea of lineasDeDireccion({ ...d, aQuien: nombreCompleto(d) })) {
      doc.text(linea, VENTANA.x, y, { width: VENTANA.ancho, lineBreak: false, ellipsis: true });
      y += 15;
    }
  });
  const yFecha = VENTANA.y + 4 * 15 + 22;
  rotulo(doc, `${identidad.localidad}, ${fechaLarga.format(hoy)}`, MARGEN, yFecha, { tam: 10.5, color: NEGRO, ancho: ANCHO, alinear: 'right' });
  let y = yFecha + 30;
  if (texto.asunto.trim()) {
    doc.font(LETRA.textoFuerte).fontSize(11).fillColor(NEGRO).text(rellenar(texto.asunto, d), MARGEN, y, { width: ANCHO });
    y = doc.y + 16;
  }
  return y;
}

/** El cuerpo, párrafo a párrafo (los separa una línea en blanco), y la firma. */
function cuerpoYFirma(doc: Doc, d: DestinatarioConDireccion, texto: TextoDeCarta, y: number) {
  doc.x = MARGEN;
  doc.y = y;
  const parrafos = rellenar(texto.cuerpo, d).replace(/\r\n/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  for (const p of parrafos) {
    doc.font(LETRA.texto).fontSize(11).fillColor(NEGRO).text(p, MARGEN, doc.y, { width: ANCHO, align: 'justify', lineGap: 3 });
    doc.moveDown(0.8);
  }
  // La firma no se parte: si no cabe entera, a la hoja siguiente.
  const altoFirma = 90;
  if (doc.y + altoFirma > A4.alto - MARGEN) doc.addPage();
  const yFirma = doc.y + 18;
  rotulo(doc, texto.firmaCargo, MARGEN, yFirma, { letra: LETRA.cursiva, tam: 11, color: NEGRO, ancho: ANCHO / 2 });
  if (texto.firmaNombre?.trim()) rotulo(doc, texto.firmaNombre, MARGEN, yFirma + 58, { tam: 10.5, color: NEGRO, ancho: ANCHO / 2 });
}

/** El pie de cada hoja: cómo llegar a Secretaría. */
function pies(doc: Doc) {
  const linea = [`Secretaría: ${secretaria.direccion ?? ''}`.replace(/: $/, ''), secretaria.telefono, secretaria.email].filter((l) => l && l !== 'Secretaría').join(' · ');
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    sinMargenes(doc, () => {
      doc.rect(MARGEN, A4.alto - 42, ANCHO, 0.75).fill(FILETE);
      if (linea) rotulo(doc, linea, MARGEN, A4.alto - 34, { tam: 7.5, color: GRIS, ancho: ANCHO, alinear: 'center' });
    });
  }
}

/** Todas las cartas, una por destinatario, en un PDF. */
export async function cartasEnPdf(texto: TextoDeCarta, destinatarios: DestinatarioConDireccion[], hoy = new Date()): Promise<Buffer> {
  const doc = nuevoDocumento(texto.asunto || 'Carta');
  const margenes = { top: MARGEN, bottom: MARGEN + 12, left: MARGEN, right: MARGEN };
  // Las hojas que se abren solas cuando el texto no cabe, con los márgenes de la carta.
  (doc as unknown as { options: { margins: typeof margenes } }).options.margins = margenes;
  doc.page.margins = margenes;
  destinatarios.forEach((d, i) => {
    if (i > 0) doc.addPage({ margins: margenes });
    const y = cabecera(doc, d, texto, hoy);
    cuerpoYFirma(doc, d, texto, y);
  });
  pies(doc);
  return aBuffer(doc);
}
