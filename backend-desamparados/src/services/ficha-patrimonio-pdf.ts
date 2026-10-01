/**
 * La ficha de patrimonio de un enser en PDF, en A4: la que se manda al seguro,
 * al Obispado o al taller de restauración. Con el membrete de las cartas y la
 * foto principal grande; las demás, en una rejilla con su pie.
 *
 * Las fotos se guardan en WebP y pdfkit solo dibuja JPEG y PNG: se pasan a
 * JPEG al vuelo, reducidas a lo que ocupan en la hoja. Las que no se pueden
 * leer (una ruta que no es una subida, un fichero que ya no está) se saltan:
 * la ficha sale igual, con los datos.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import type { Enser } from '@prisma/client';
import { identidad } from '../domain/datos-entidad.js';
import { publicStorageDir } from '../middleware/upload.middleware.js';
import { nombreDeSubida } from '../utils/ficheros-publicos.js';
import {
  A4, BURDEOS, FILETE, GRIS, IMAGENES, LETRA, NEGRO, ORO,
  aBuffer, nuevoDocumento, rombo, rotulo, sinMargenes, versalitas, type Doc,
} from './informes/pdf.js';

const MM = 72 / 25.4;
const MARGEN = 20 * MM;
const ANCHO = A4.ancho - 2 * MARGEN;
const ORO_TEXTO = '#8a6a30';
const fechaCorta = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric' });
const euros = (n: number) => `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** La foto como JPEG, o null si no es una subida o no se puede leer. */
async function jpegDe(url: string | null | undefined, anchoPx: number): Promise<Buffer | null> {
  const nombre = nombreDeSubida(url);
  if (!nombre || /\.(pdf|mp4)$/i.test(nombre)) return null;
  try {
    const original = await fs.readFile(path.join(publicStorageDir, nombre));
    return await sharp(original).rotate().resize({ width: anchoPx, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  } catch {
    return null;
  }
}

function membrete(doc: Doc) {
  sinMargenes(doc, () => {
    doc.rect(0, 0, A4.ancho, 4.5).fill(BURDEOS);
    doc.image(IMAGENES.escudoOro, MARGEN, 26, { fit: [38, 46], align: 'center', valign: 'center' });
    rotulo(doc, versalitas(identidad.tipo), MARGEN + 52, 32, { letra: LETRA.textoFuerte, tam: 7, color: ORO_TEXTO, espaciado: 2 });
    rotulo(doc, identidad.titular, MARGEN + 52, 43, { letra: LETRA.titulo, tam: 13, color: NEGRO, ancho: 320 });
    rotulo(doc, versalitas('Ficha de patrimonio'), MARGEN, 38, { letra: LETRA.textoMedio, tam: 8, color: GRIS, espaciado: 1.6, ancho: ANCHO, alinear: 'right' });
    doc.rect(MARGEN, 82, ANCHO / 2 - 8, 0.75).fill(ORO);
    doc.rect(A4.ancho / 2 + 8, 82, ANCHO / 2 - 8, 0.75).fill(ORO);
    rombo(doc, A4.ancho / 2, 82.4, 3, BURDEOS);
    doc.rect(MARGEN, A4.alto - 36, ANCHO, 0.75).fill(FILETE);
    rotulo(doc, `${identidad.nombre} · Inventario de patrimonio · ${fechaCorta.format(new Date())}`, MARGEN, A4.alto - 28, { tam: 7, color: GRIS, ancho: ANCHO, alinear: 'center' });
  });
}

/** Una etiqueta y su valor; si no hay valor, no se pinta nada. Devuelve la y siguiente. */
function dato(doc: Doc, etiqueta: string, valor: string | null | undefined, x: number, y: number, ancho: number): number {
  if (!valor?.trim()) return y;
  rotulo(doc, versalitas(etiqueta), x, y, { letra: LETRA.textoMedio, tam: 7, color: GRIS, espaciado: 1.2 });
  doc.font(LETRA.texto).fontSize(10).fillColor(NEGRO).text(valor.trim(), x, y + 10, { width: ancho, lineGap: 1.5 });
  return doc.y + 9;
}

function seccion(doc: Doc, titulo: string, texto: string | null | undefined) {
  if (!texto?.trim()) return;
  if (doc.y > A4.alto - 140) { doc.addPage(); membrete(doc); doc.y = 100; }
  rotulo(doc, versalitas(titulo), MARGEN, doc.y + 4, { letra: LETRA.textoFuerte, tam: 8.5, color: BURDEOS, espaciado: 1.4 });
  doc.font(LETRA.texto).fontSize(10).fillColor(NEGRO).text(texto.trim(), MARGEN, doc.y + 18, { width: ANCHO, align: 'justify', lineGap: 2 });
  doc.moveDown(1);
}

export async function fichaDePatrimonioEnPdf(e: Enser): Promise<Buffer> {
  const doc = nuevoDocumento(`Ficha de patrimonio: ${e.nombre}`);
  membrete(doc);

  // Título y referencia.
  rotulo(doc, e.nombre, MARGEN, 100, { letra: LETRA.titulo, tam: 20, color: NEGRO, ancho: ANCHO });
  const sub = [e.referencia && `Ref. ${e.referencia}`, e.categoria].filter(Boolean).join(' · ');
  if (sub) rotulo(doc, sub, MARGEN, 126, { tam: 9.5, color: GRIS, ancho: ANCHO });

  // La foto principal a la izquierda; los datos a la derecha.
  const yArriba = 148;
  const anchoFoto = ANCHO * 0.48;
  const principal = await jpegDe(e.imagenUrl, 900);
  let yFoto = yArriba;
  if (principal) {
    doc.image(principal, MARGEN, yArriba, { fit: [anchoFoto, 250], align: 'center' });
    yFoto = yArriba + 258;
  }
  const xDatos = principal ? MARGEN + anchoFoto + 18 : MARGEN;
  const anchoDatos = principal ? ANCHO - anchoFoto - 18 : ANCHO;
  let y = yArriba;
  y = dato(doc, 'Autor o taller', e.autor, xDatos, y, anchoDatos);
  y = dato(doc, 'Época', e.epoca, xDatos, y, anchoDatos);
  y = dato(doc, 'Materiales y técnica', e.materiales, xDatos, y, anchoDatos);
  y = dato(doc, 'Medidas', e.dimensiones, xDatos, y, anchoDatos);
  y = dato(doc, 'Ubicación', e.ubicacion, xDatos, y, anchoDatos);
  y = dato(doc, 'Adquisición', e.fechaAdquisicion ? fechaCorta.format(e.fechaAdquisicion) : null, xDatos, y, anchoDatos);
  const unidades = e.cantidadTotal > 1
    ? `${e.cantidadTotal} unidades: ${e.cantidadOptimo} óptimas, ${e.cantidadBueno} en buen estado, ${e.cantidadReparar} para reparar`
    : e.cantidadReparar > 0 ? 'Para reparar' : e.cantidadOptimo > 0 ? 'Óptimo' : e.cantidadBueno > 0 ? 'Bueno' : null;
  y = dato(doc, 'Estado', unidades, xDatos, y, anchoDatos);
  if (e.valorTasacion !== null) {
    const tasacion = [euros(Number(e.valorTasacion)), e.fechaTasacion && `a ${fechaCorta.format(e.fechaTasacion)}`, e.tasadoPor && `por ${e.tasadoPor}`].filter(Boolean).join(' ');
    y = dato(doc, 'Tasación', tasacion, xDatos, y, anchoDatos);
  }
  doc.x = MARGEN;
  doc.y = Math.max(y, yFoto) + 6;

  seccion(doc, 'Descripción', e.descripcion);
  seccion(doc, 'Conservación e intervenciones', e.conservacion);

  // Las demás fotos, de tres en tres, con su pie.
  const fotos = Array.isArray(e.fotos) ? (e.fotos as { url: string; pie: string }[]) : [];
  const leidas = (await Promise.all(fotos.map(async (f) => ({ pie: f.pie, jpeg: await jpegDe(f.url, 500) })))).filter((f) => f.jpeg);
  if (leidas.length > 0) {
    const hueco = 10;
    const anchoCelda = (ANCHO - 2 * hueco) / 3;
    const altoCelda = anchoCelda * 0.75;
    if (doc.y > A4.alto - altoCelda - 110) { doc.addPage(); membrete(doc); doc.y = 100; }
    rotulo(doc, versalitas('Más fotos'), MARGEN, doc.y + 4, { letra: LETRA.textoFuerte, tam: 8.5, color: BURDEOS, espaciado: 1.4 });
    let yFila = doc.y + 20;
    leidas.forEach((f, i) => {
      const col = i % 3;
      if (col === 0 && i > 0) yFila += altoCelda + 28;
      if (yFila + altoCelda + 24 > A4.alto - 50) { doc.addPage(); membrete(doc); yFila = 100; }
      const x = MARGEN + col * (anchoCelda + hueco);
      doc.image(f.jpeg!, x, yFila, { fit: [anchoCelda, altoCelda], align: 'center', valign: 'center' });
      if (f.pie) rotulo(doc, f.pie, x, yFila + altoCelda + 4, { tam: 7.5, color: GRIS, ancho: anchoCelda, alinear: 'center' });
    });
  }
  return aBuffer(doc);
}
