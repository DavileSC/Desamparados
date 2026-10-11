/**
 * Las participaciones de lotería en PDF, para imprimirlas y encuadernarlas en
 * talonarios: cinco por hoja A4, cada una con su matriz a la izquierda (la
 * que se queda en el talonario con el nombre de quien la compró) y la
 * participación a la derecha, separadas por la línea por donde se corta.
 *
 * Con la letra y los colores de la papeleta y las cartas. Cada talonario
 * empieza en hoja nueva, para grapar cada uno por su lado.
 */
import { identidad } from '../../domain/datos-entidad.js';
import {
  LEYENDA_POR_DEFECTO, jugadoPorNumero, numeroImpreso, participacionesDelTalonario, type Reparto,
} from '../../domain/loteria.js';
import { A4, BURDEOS, FILETE, GRIS, IMAGENES, LETRA, NEGRO, ORO, ORO_TEXTO, aBuffer, nuevoDocumento, rotulo, sinMargenes, versalitas, type Doc } from '../informes/pdf.js';
import { eurosDeCentimos } from '../../utils/euros.js';

interface SorteoParaImprimir extends Reparto {
  nombre: string;
  fecha: Date;
  leyenda: string;
  totalTalonarios: number;
}

const MM = 72 / 25.4;
const POR_HOJA = 5;
const ALTO = A4.alto / POR_HOJA;
const MATRIZ = 52 * MM;
const MARGEN = 7 * MM;
const fechaLarga = new Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
/** «4,00 €», siempre con céntimos (en una participación se lee el precio exacto) y con espacio duro. */

function lineaDeCorte(doc: Doc, x1: number, y1: number, x2: number, y2: number) {
  doc.save().moveTo(x1, y1).lineTo(x2, y2).lineWidth(0.5).dash(3, { space: 3 }).strokeColor(GRIS).stroke().undash().restore();
}

function matriz(doc: Doc, s: SorteoParaImprimir, n: number, total: number, talonario: number, y: number) {
  const x = MARGEN;
  const ancho = MATRIZ - 2 * MARGEN;
  rotulo(doc, versalitas('Matriz'), x, y + MARGEN, { letra: LETRA.textoFuerte, tam: 7, color: ORO_TEXTO, espaciado: 1.5 });
  rotulo(doc, `N.º ${numeroImpreso(n, total)}`, x, y + MARGEN + 12, { letra: LETRA.tituloFuerte, tam: 15, color: BURDEOS, ancho });
  rotulo(doc, `Talonario n.º ${talonario}`, x, y + MARGEN + 33, { tam: 8, color: GRIS, ancho });
  rotulo(doc, s.numeros.map((m) => m.numero).join(' · '), x, y + MARGEN + 45, { letra: LETRA.textoMedio, tam: 8, color: NEGRO, ancho });
  rotulo(doc, `${s.nombre}`, x, y + MARGEN + 57, { tam: 7.5, color: GRIS, ancho });
  rotulo(doc, 'Vendida a:', x, y + ALTO - MARGEN - 34, { tam: 7.5, color: GRIS });
  for (const dy of [22, 6]) doc.rect(x, y + ALTO - MARGEN - dy, ancho, 0.5).fill(FILETE);
}

function participacion(doc: Doc, s: SorteoParaImprimir, n: number, total: number, y: number) {
  const x = MATRIZ + MARGEN;
  const ancho = A4.ancho - x - MARGEN;
  const arriba = y + MARGEN;
  doc.image(IMAGENES.escudoDestacadoEnPapel, x, arriba, { fit: [30, 36], align: 'center', valign: 'center' });
  rotulo(doc, versalitas(identidad.tipo), x + 40, arriba + 4, { letra: LETRA.textoFuerte, tam: 7, color: ORO_TEXTO, espaciado: 1.8 });
  rotulo(doc, identidad.titular, x + 40, arriba + 15, { letra: LETRA.titulo, tam: 12, color: NEGRO, ancho: ancho - 150 });
  rotulo(doc, versalitas('Participación'), x, arriba + 4, { letra: LETRA.textoFuerte, tam: 7, color: ORO_TEXTO, espaciado: 1.5, ancho, alinear: 'right' });
  rotulo(doc, `N.º ${numeroImpreso(n, total)}`, x, arriba + 13, { letra: LETRA.tituloFuerte, tam: 15, color: BURDEOS, ancho, alinear: 'right' });

  doc.rect(x, arriba + 44, ancho, 0.75).fill(ORO);
  rotulo(doc, `${s.nombre} · Sorteo del ${fechaLarga.format(s.fecha)}`, x, arriba + 51, { letra: LETRA.textoMedio, tam: 9, color: NEGRO, ancho });
  rotulo(doc, s.numeros.map((m) => m.numero).join('   ·   '), x, arriba + 64, { letra: LETRA.tituloMedio, tam: 24, color: NEGRO, ancho, espaciado: 2 });

  const varios = s.numeros.length > 1;
  const donativo = s.precioParticipacion - s.jugado;
  const juega = `Juega ${eurosDeCentimos(s.jugado)}${varios ? ` (${eurosDeCentimos(Math.floor(jugadoPorNumero(s)))} a cada número)` : ''}`;
  const cuentas = [juega, donativo > 0 ? `Donativo ${eurosDeCentimos(donativo)}` : null, `Importe ${eurosDeCentimos(s.precioParticipacion)}`].filter(Boolean).join('   ·   ');
  rotulo(doc, cuentas, x, arriba + 96, { letra: LETRA.textoMedio, tam: 9, color: NEGRO, ancho });
  doc.font(LETRA.texto).fontSize(6.8).fillColor(GRIS)
    .text(s.leyenda.trim() || LEYENDA_POR_DEFECTO, x, arriba + 110, { width: ancho, height: ALTO - 110 - 2 * MARGEN, ellipsis: true, lineGap: 0.5 });
}

/** Todas las participaciones de esos talonarios (por su número), cada talonario desde hoja nueva. */
export async function participacionesEnPdf(s: SorteoParaImprimir, talonarios: number[]): Promise<Buffer> {
  const doc = nuevoDocumento(`${s.nombre}: participaciones`);
  const total = s.totalTalonarios * s.porTalonario;
  let primera = true;
  for (const talonario of talonarios) {
    const { desde, hasta } = participacionesDelTalonario(talonario, s.porTalonario);
    for (let n = desde; n <= hasta; n++) {
      const enHoja = (n - desde) % POR_HOJA;
      if (enHoja === 0) {
        if (!primera) doc.addPage();
        primera = false;
      }
      const y = enHoja * ALTO;
      sinMargenes(doc, () => {
        matriz(doc, s, n, total, talonario, y);
        participacion(doc, s, n, total, y);
        lineaDeCorte(doc, MATRIZ, y + 4, MATRIZ, y + ALTO - 4);
        if (enHoja > 0) lineaDeCorte(doc, 0, y, A4.ancho, y);
      });
    }
  }
  return aBuffer(doc);
}
