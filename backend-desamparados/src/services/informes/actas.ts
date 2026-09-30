/**
 * Las actas de los cabildos en PDF: una suelta o el libro de actas de un año,
 * con la misma imprenta que la Memoria y el informe anual (membrete negro con
 * el escudo, Newsreader para el texto, folio abajo).
 */
import type { CabildoCompleto } from '../cabildos.service.js';
import { extractoPlano } from '../../utils/sanear-html.js';
import { identidad } from '../../domain/datos-entidad.js';
import {
  ANCHO_UTIL, BURDEOS, GRIS, LETRA, MX, NEGRO, Paginas, aBuffer, bandaInforme, marcaBorrador, nuevoDocumento, parrafos, pies, rotuloVersalitas,
} from './pdf.js';

const TIPO: Record<CabildoCompleto['tipo'], string> = { ORDINARIO: 'ordinario', EXTRAORDINARIO: 'extraordinario' };

const fechaLarga = (fecha: Date) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric' }).format(fecha);
const hora = (fecha: Date) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(fecha);

/** El HTML del acta a párrafos de texto, uno por bloque. */
function aParrafos(html: string): string {
  return extractoPlano(html.replace(/<\/(p|h2|h3|li|blockquote)>|<br\s*\/?>/gi, '\n\n')).trim();
}

function apartado(p: Paginas, titulo: string) {
  const y = p.sitio(60);
  rotuloVersalitas(p.doc, titulo, MX, y + 6, { tam: 8.5, color: BURDEOS, espaciado: 1 });
  p.doc.moveTo(MX, y + 20).lineTo(MX + ANCHO_UTIL, y + 20).lineWidth(0.6).strokeColor(NEGRO).stroke();
  p.doc.x = MX;
  p.doc.y = y + 30;
}

function texto(p: Paginas, t: string, o: { cursiva?: boolean } = {}) {
  p.sitio(20);
  p.doc.font(o.cursiva ? LETRA.cursiva : LETRA.titulo).fontSize(11.5).fillColor(NEGRO).text(t, MX, p.doc.y, { width: ANCHO_UTIL, lineGap: 3, paragraphGap: 6 });
}

function acta(p: Paginas, c: CabildoCompleto) {
  const doc = p.doc;
  bandaInforme(doc, `Cabildo ${TIPO[c.tipo]}`, [fechaLarga(c.fecha), c.lugar]);
  p.seccion = `Cabildo ${TIPO[c.tipo]} · ${fechaLarga(c.fecha)}`;

  texto(p, `El ${fechaLarga(c.fecha)}, a las ${hora(c.fecha)}, se reúne en ${c.enSegunda ? 'segunda' : 'primera'} convocatoria el cabildo ${TIPO[c.tipo]} de hermanos del ${identidad.nombre}. Lugar: ${c.lugar}.`);

  apartado(p, 'Asistencia y quórum');
  const q = c.quorum;
  texto(p, `Asisten ${c.asistentes.length === 1 ? '1 hermano' : `${c.asistentes.length} hermanos`}, ${q.presentesConVoto} de ellos con voto, de un censo de ${q.censoConVoto} con derecho a voto. ${c.enSegunda ? 'Se constituye en segunda convocatoria, con los hermanos presentes.' : `Hay quórum en primera convocatoria (hacían falta ${q.necesarios}).`}`);
  if (c.asistentes.length > 0) {
    doc.font(LETRA.texto).fontSize(9).fillColor(GRIS);
    p.sitio(30);
    doc.text(c.asistentes.map((a) => `${a.apellidos}, ${a.nombre}${a.numeroHermano !== null ? ` (${a.numeroHermano})` : ''}${a.conVoto ? '' : ' [sin voto]'}`).join(' · '), MX, doc.y, { width: ANCHO_UTIL, lineGap: 2 });
    doc.moveDown(0.8);
  }

  apartado(p, 'Orden del día');
  if (c.ordenDelDia.length === 0) texto(p, 'Sin orden del día.', { cursiva: true });
  c.ordenDelDia.forEach((punto, i) => texto(p, `${i + 1}. ${punto}`));

  if (c.votaciones.length > 0) {
    apartado(p, 'Votaciones');
    for (const v of c.votaciones) {
      texto(p, `${v.asunto}: ${v.aFavor} a favor, ${v.enContra} en contra y ${v.abstenciones} ${v.abstenciones === 1 ? 'abstención' : 'abstenciones'}${v.mayoria === 'DOS_TERCIOS' ? ', con mayoría de dos tercios' : ''}. ${v.resultado === 'APROBADO' ? 'Queda aprobado.' : 'No se aprueba.'}`);
    }
  }

  apartado(p, 'Acta');
  const cuerpo = aParrafos(c.acta);
  if (cuerpo) parrafos(p, cuerpo, { tam: 11.5 });
  else texto(p, 'El acta aún no está redactada.', { cursiva: true });

  if (c.actaAprobadaEl) {
    p.sitio(40);
    doc.moveDown(1);
    doc.font(LETRA.cursiva).fontSize(10.5).fillColor(GRIS).text(`Acta aprobada el ${fechaLarga(c.actaAprobadaEl)}.`, MX, doc.y, { width: ANCHO_UTIL });
  }
}

/** Una o varias actas en un PDF. Las que no estén aprobadas llevan la marca de borrador. */
export async function actasEnPdf(cabildos: CabildoCompleto[], titulo: string): Promise<{ pdf: Buffer; titulo: string }> {
  const doc = nuevoDocumento(titulo);
  const p = new Paginas(doc, titulo);
  cabildos.forEach((c, i) => {
    if (i > 0) p.nueva();
    acta(p, c);
  });
  pies(doc, titulo);
  if (cabildos.some((c) => c.estado !== 'ACTA_APROBADA')) marcaBorrador(doc);
  return { pdf: await aBuffer(doc), titulo };
}
