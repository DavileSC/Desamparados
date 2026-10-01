/**
 * El certificado de donativos de un ejercicio, en A4: uno por donante, todos
 * en un PDF para imprimirlos de una vez. Con el membrete de las cartas (papel
 * blanco, escudo en oro, filete con el rombo burdeos).
 *
 * Lleva lo que pide el art. 24 del Reglamento de la Ley 49/2002 para que el
 * donante pueda deducir: el NIF y los datos de los dos, que la entidad es
 * beneficiaria del mecenazgo, la fecha y el importe de cada donativo, que se
 * destina a sus fines propios y que es irrevocable.
 */
import { identidad, secretaria } from '../domain/datos-entidad.js';
import { conArticulo, deArticulo } from '../domain/articulos.js';
import type { Aportacion } from '../domain/modelo-182.js';
import {
  A4, BURDEOS, FILETE, GRIS, IMAGENES, LETRA, NEGRO, ORO,
  aBuffer, nuevoDocumento, rombo, rotulo, sinMargenes, versalitas, type Doc,
} from './informes/pdf.js';
import type { ConfiguracionModelo182 } from './modelo-182.service.js';

export interface CertificadoDe {
  nif: string;
  nifRepresentante: string | null;
  nombre: string;
  centimos: number;
  porcentaje: number;
  aportaciones: Aportacion[];
}

const MM = 72 / 25.4;
const MARGEN = 25 * MM;
const ANCHO = A4.ancho - 2 * MARGEN;
const ORO_TEXTO = '#8a6a30';
const fechaLarga = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric' });
const euros = (c: number) => `${(c / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
/** «2026-03-05» → «05/03/2026». */
const dia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

function membrete(doc: Doc) {
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
    const pie = [secretaria.direccion, secretaria.telefono, secretaria.email].filter(Boolean).join(' · ');
    doc.rect(MARGEN, A4.alto - 42, ANCHO, 0.75).fill(FILETE);
    if (pie) rotulo(doc, pie, MARGEN, A4.alto - 34, { tam: 7.5, color: GRIS, ancho: ANCHO, alinear: 'center' });
  });
}

const parrafo = (doc: Doc, texto: string) => {
  doc.font(LETRA.texto).fontSize(10.5).fillColor(NEGRO).text(texto, MARGEN, doc.y, { width: ANCHO, align: 'justify', lineGap: 2.5 });
  doc.moveDown(0.7);
};

function certificado(doc: Doc, c: ConfiguracionModelo182, ejercicio: number, d: CertificadoDe, hoy: Date) {
  membrete(doc);
  rotulo(doc, versalitas(`Certificado de donativos · Ejercicio ${ejercicio}`), MARGEN, 125, { letra: LETRA.textoFuerte, tam: 10, color: BURDEOS, espaciado: 1.6, ancho: ANCHO, alinear: 'center' });
  doc.x = MARGEN;
  doc.y = 158;

  const firmante = c.firmanteNombre.trim() ? `${c.firmanteNombre.trim()}, ${c.firmanteCargo.toLocaleLowerCase('es-ES')}` : `El ${c.firmanteCargo.toLocaleLowerCase('es-ES')}`;
  parrafo(doc, `${firmante} ${deArticulo(identidad.articulo, identidad.nombre)}, con NIF ${c.nif}, con domicilio en ${secretaria.direccion ?? identidad.localidad},`);
  doc.font(LETRA.textoFuerte).fontSize(10.5).fillColor(NEGRO).text('CERTIFICA:', MARGEN, doc.y, { width: ANCHO });
  doc.moveDown(0.5);
  const representante = d.nifRepresentante ? `, menor de catorce años, representado por su padre, madre o tutor con NIF ${d.nifRepresentante},` : '';
  parrafo(doc, `Que ${d.nombre}, con NIF ${d.nif}${representante} ha entregado a esta entidad durante el ejercicio ${ejercicio}, con carácter irrevocable, puro y simple, los donativos siguientes, que se destinan a la realización de sus fines propios:`);

  // La tabla: fecha, concepto, importe.
  const colFecha = 70;
  const colImporte = 90;
  let y = doc.y + 2;
  const cabecera = () => {
    rotulo(doc, versalitas('Fecha'), MARGEN, y, { letra: LETRA.textoMedio, tam: 7.5, color: GRIS, espaciado: 1.2 });
    rotulo(doc, versalitas('Concepto'), MARGEN + colFecha, y, { letra: LETRA.textoMedio, tam: 7.5, color: GRIS, espaciado: 1.2 });
    rotulo(doc, versalitas('Importe'), MARGEN, y, { letra: LETRA.textoMedio, tam: 7.5, color: GRIS, espaciado: 1.2, ancho: ANCHO, alinear: 'right' });
    y += 13;
    doc.rect(MARGEN, y, ANCHO, 0.5).fill(FILETE);
    y += 5;
  };
  cabecera();
  for (const a of d.aportaciones) {
    if (y > A4.alto - 240) { doc.addPage(); membrete(doc); y = 130; cabecera(); }
    rotulo(doc, dia(a.fecha), MARGEN, y, { tam: 9.5, color: NEGRO });
    rotulo(doc, a.concepto, MARGEN + colFecha, y, { tam: 9.5, color: NEGRO, ancho: ANCHO - colFecha - colImporte });
    rotulo(doc, euros(a.centimos), MARGEN, y, { tam: 9.5, color: NEGRO, ancho: ANCHO, alinear: 'right' });
    y += 15;
  }
  doc.rect(MARGEN, y, ANCHO, 0.5).fill(FILETE);
  y += 6;
  rotulo(doc, 'Total del ejercicio', MARGEN + colFecha, y, { letra: LETRA.textoFuerte, tam: 10, color: NEGRO });
  rotulo(doc, euros(d.centimos), MARGEN, y, { letra: LETRA.textoFuerte, tam: 10, color: NEGRO, ancho: ANCHO, alinear: 'right' });
  doc.x = MARGEN;
  doc.y = y + 26;

  parrafo(doc, `Que ${conArticulo(identidad.articulo, identidad.nombre)} es una de las entidades beneficiarias del mecenazgo a las que se refiere el artículo 16 de la Ley 49/2002, de 23 de diciembre, de régimen fiscal de las entidades sin fines lucrativos y de los incentivos fiscales al mecenazgo, y que estos donativos se incluyen en su declaración informativa (Modelo 182) del ejercicio ${ejercicio}.`);
  parrafo(doc, 'Y para que conste a los efectos de la deducción prevista en dicha ley, se expide el presente certificado.');

  const yFirma = Math.min(doc.y + 14, A4.alto - 150);
  rotulo(doc, `${identidad.localidad}, ${fechaLarga.format(hoy)}`, MARGEN, yFirma, { tam: 10.5, color: NEGRO, ancho: ANCHO, alinear: 'right' });
  rotulo(doc, c.firmanteCargo, MARGEN, yFirma + 24, { letra: LETRA.cursiva, tam: 11, color: NEGRO, ancho: ANCHO / 2 });
  if (c.firmanteNombre.trim()) rotulo(doc, c.firmanteNombre, MARGEN, yFirma + 82, { tam: 10.5, color: NEGRO, ancho: ANCHO / 2 });
}

/** Un certificado por donante, cada uno en hoja nueva. */
export async function certificadosEnPdf(c: ConfiguracionModelo182, ejercicio: number, donantes: CertificadoDe[], hoy = new Date()): Promise<Buffer> {
  const doc = nuevoDocumento(`Certificados de donativos ${ejercicio}`);
  donantes.forEach((d, i) => {
    if (i > 0) doc.addPage();
    certificado(doc, c, ejercicio, d, hoy);
  });
  return aBuffer(doc);
}
