/**
 * La papeleta de sitio en PDF, en A4: la que se imprime en la mesa al dar la
 * ropa y la que va adjunta al correo. Es la maqueta elegida el 30-09-2026:
 * papel blanco (se imprime en casa y en la mesa, sin gastar tinta), el escudo
 * en oro, el puesto grande en burdeos y el QR firmado al pie.
 *
 * El QR se dibuja con vectores, módulo a módulo: impreso sale nítido a
 * cualquier tamaño, y no depende de ninguna imagen.
 */
import QRCode from 'qrcode';
import type { Sexo } from '@prisma/client';
import db from '../../config/db.js';
import { codigoDePapeleta } from '../../domain/papeleta-qr.js';
import { identidad, type Identidad } from '../../domain/datos-entidad.js';
import { articuloDe, deLaCorporacion } from '../../domain/articulos.js';
import { leerDatosEvento } from '../recibos/comunes.js';
import type { SalidaImpresa } from '../../dtos/email.dto.js';
import {
  A4, BURDEOS, FILETE, GRIS, IMAGENES, LETRA, MARFIL, NEGRO, ORO, ORO_TEXTO,
  aBuffer, nuevoDocumento, rombo, rotulo, sinMargenes, versalitas, type Doc,
} from '../informes/pdf.js';
import { euros } from '../../utils/euros.js';

interface DatosDeLaPapeleta {
  id: number;
  year: number;
  salida: SalidaImpresa;
  /** «2027-0012»: el número con que la busca Secretaría. */
  referencia: string;
  nombre: string;
  sexo: Sexo | null;
  /** El de la ficha («Rvdo. P.»…); sin él, «D.» o «Dña.» según el sexo. */
  tratamiento?: string | null;
  numeroHermano: number | null;
  puesto: string;
  tramo: string | null;
  tunica: string | null;
  capirote: string | null;
  faraona: string | null;
  /** Ya formateado («20,00 €»); vacío si no hubo que pagar nada. */
  importe: string;
  observaciones: string | null;
  fechaSalida: string;
  horaSalida: string;
  accesoPuerta: string;
  expedida: Date;
  /** El texto del QR (ver `papeleta-qr.ts`). */
  codigo: string;
}

export const referenciaDe = (year: number, id: number) => `${year}-${String(id).padStart(4, '0')}`;


/** Todo lo que lleva la papeleta, o null si no existe. */
export async function datosDeLaPapeleta(id: number): Promise<DatosDeLaPapeleta | null> {
  const p = await db.papeletaSitio.findUnique({
    where: { id },
    include: { recibo: true, salida: { include: { acto: true } }, hermano: { select: { nombre: true, apellidos: true, sexo: true, numeroHermano: true, tratamiento: true } } },
  });
  if (!p) return null;
  const importe = Number(p.recibo.importe);
  return {
    id: p.id,
    year: p.year,
    salida: { nombre: p.salida.nombre, cobro: p.salida.cobro, conRopa: p.salida.conRopa, indicaciones: p.salida.indicaciones, articulo: articuloDe(p.salida) },
    referencia: referenciaDe(p.year, p.id),
    nombre: `${p.hermano.nombre} ${p.hermano.apellidos}`.trim(),
    sexo: p.hermano.sexo,
    tratamiento: p.hermano.tratamiento,
    numeroHermano: p.hermano.numeroHermano,
    puesto: p.puesto,
    tramo: p.tramo,
    tunica: p.numTunicaAsignada,
    capirote: p.numCapiroteAsignado,
    faraona: p.numFaraonaAsignada,
    importe: importe > 0 && p.recibo.estado === 'PAGADO' ? euros(importe) : '',
    observaciones: p.observaciones,
    ...leerDatosEvento(p.salida, p.year),
    expedida: p.createdAt,
    codigo: codigoDePapeleta(p.id),
  };
}

// ---------------------------------------------------------------- el dibujo

const MARGEN = 54;
const ANCHO = A4.ancho - 2 * MARGEN;
const fecha = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric' });

/**
 * El tratamiento delante del nombre: el de la ficha si Secretaría lo puso; si
 * no, «D.» o «Dña.» según el sexo, como en los correos; sin sexo, solo el nombre.
 */
const conTratamiento = (d: DatosDeLaPapeleta) => {
  const propio = d.tratamiento?.trim();
  if (propio) return `${propio} ${d.nombre}`;
  return d.sexo === 'MUJER' ? `Dña. ${d.nombre}` : d.sexo === 'HOMBRE' ? `D. ${d.nombre}` : d.nombre;
};

/**
 * Un texto en una línea, bajando la letra hasta que quepa (un nombre o un
 * puesto largos). Con `dosLineas`, si ni al mínimo cabe, se parte en dos
 * líneas a ese tamaño en vez de recortarlo: un nombre no se corta con «…».
 */
function ajustado(doc: Doc, texto: string, x: number, y: number, o: { letra: string; tam: number; minimo: number; ancho: number; color: string; alinear?: 'left' | 'center'; dosLineas?: boolean }) {
  let tam = o.tam;
  doc.font(o.letra);
  while (tam > o.minimo && doc.fontSize(tam).widthOfString(texto) > o.ancho) tam -= 0.5;
  if (o.dosLineas && doc.fontSize(tam).widthOfString(texto) > o.ancho) {
    doc.fillColor(o.color).text(texto, x, y - tam * 0.15, { width: o.ancho, height: tam * 2.5, lineGap: 0, ellipsis: true, align: o.alinear ?? 'left' });
    return;
  }
  rotulo(doc, texto, x, y + (o.tam - tam) * 0.6, { letra: o.letra, tam, color: o.color, ancho: o.ancho, alinear: o.alinear });
}

/** «sábado, 17 de octubre» → «Sábado, 17 de octubre»: la fecha del Rosario viene de la Agenda en minúscula. */
const mayuscula = (texto: string) => texto.charAt(0).toLocaleUpperCase('es-ES') + texto.slice(1);

const etiqueta = (doc: Doc, texto: string, x: number, y: number, ancho?: number, alinear?: 'left' | 'right') =>
  rotulo(doc, versalitas(texto), x, y, { letra: LETRA.textoMedio, tam: 8, color: GRIS, espaciado: 1.5, ancho, alinear });

/** El QR con vectores: cada tramo de módulos negros seguidos es un rectángulo. */
function qr(doc: Doc, texto: string, x: number, y: number, lado: number) {
  const { modules } = QRCode.create(texto, { errorCorrectionLevel: 'M' });
  const n = modules.size;
  const m = lado / n;
  doc.save().fillColor(NEGRO);
  for (let fila = 0; fila < n; fila++) {
    let inicio = -1;
    for (let col = 0; col <= n; col++) {
      const negro = col < n && modules.get(fila, col);
      if (negro && inicio < 0) inicio = col;
      if (!negro && inicio >= 0) {
        // Un pelo de solape para que no queden rayas finas entre módulos al imprimir.
        doc.rect(x + inicio * m, y + fila * m, (col - inicio) * m + 0.05, m + 0.05);
        inicio = -1;
      }
    }
  }
  doc.fill().restore();
}

/** Una fila de celdas con su etiqueta y su valor, separadas por filetes. */
function filaDeCeldas(doc: Doc, celdas: [string, string][], y: number, alto: number) {
  const ancho = ANCHO / 3;
  celdas.forEach(([rot, valor], i) => {
    const x = MARGEN + i * ancho;
    const dentro = i === 0 ? 0 : 15;
    etiqueta(doc, rot, x + dentro, y + 15);
    ajustado(doc, valor, x + dentro, y + 29, { letra: LETRA.textoMedio, tam: 12.75, minimo: 10.5, ancho: ancho - dentro - 12, color: NEGRO, dosLineas: true });
    if (i > 0) doc.rect(x, y, 0.75, alto).fill(FILETE);
  });
  doc.rect(MARGEN, y + alto, ANCHO, 0.75).fill(FILETE);
}

/**
 * Lo que la papeleta dice de la corporación, aparte de pdfkit: una función
 * pura para poder probarlo con otra instalación sin generar el PDF (pdfkit
 * comprime el contenido y el texto no se puede leer del buffer).
 */
export function textosDeLaPapeleta(identidadInstalacion: Identidad = identidad) {
  return {
    tipo: versalitas(identidadInstalacion.tipo),
    titular: identidadInstalacion.titular,
    localidad: identidadInstalacion.localidad,
    expide: `Secretaría ${deLaCorporacion({ identidad: identidadInstalacion })}`,
  };
}

function dibujar(doc: Doc, d: DatosDeLaPapeleta) {
  const t = textosDeLaPapeleta();
  const donativo = d.salida.cobro === 'DONATIVO';
  sinMargenes(doc, () => {
    doc.rect(0, 0, A4.ancho, 4.5).fill(BURDEOS);

    // Cabecera: escudo, nombre del Grupo y la referencia.
    doc.image(IMAGENES.escudoDestacadoEnPapel, MARGEN, 33, { fit: [61.5, 75], align: 'center', valign: 'center' });
    const xTexto = MARGEN + 82.5;
    rotulo(doc, t.tipo, xTexto, 45, { letra: LETRA.textoFuerte, tam: 8.25, color: ORO_TEXTO, espaciado: 2.6 });
    ajustado(doc, t.titular, xTexto, 58, { letra: LETRA.titulo, tam: 19, minimo: 14, ancho: 290, color: NEGRO });
    rotulo(doc, t.localidad, xTexto, 84, { tam: 9.75, color: GRIS });
    etiqueta(doc, 'Referencia', MARGEN, 50, ANCHO, 'right');
    rotulo(doc, d.referencia, MARGEN, 62, { letra: LETRA.titulo, tam: 16.5, color: NEGRO, ancho: ANCHO, alinear: 'right' });

    // El filete de oro con el rombo burdeos.
    const yFilete = 134;
    doc.rect(MARGEN, yFilete, ANCHO / 2 - 12, 0.75).fill(ORO);
    doc.rect(A4.ancho / 2 + 12, yFilete, ANCHO / 2 - 12, 0.75).fill(ORO);
    rombo(doc, A4.ancho / 2, yFilete + 0.4, 4, BURDEOS);

    // Qué es: «Papeleta de sitio» y la salida con su año.
    // «Papeleta de sitio» en todas las salidas, como en la pantalla de Procesión: debajo va cuál.
    rotulo(doc, versalitas('Papeleta de sitio'), MARGEN, 160, { letra: LETRA.textoFuerte, tam: 9.75, color: BURDEOS, espaciado: 4.5, ancho: ANCHO, alinear: 'center' });
    ajustado(doc, `${d.salida.nombre} · ${d.year}`, MARGEN, 176, { letra: LETRA.fina, tam: 33, minimo: 24, ancho: ANCHO, color: NEGRO, alinear: 'center' });

    // Quién y dónde va.
    const yBloque = 244;
    const altoBloque = 104;
    doc.rect(MARGEN, yBloque, ANCHO, 0.75).fill(FILETE);
    const mitad = ANCHO / 2;
    etiqueta(doc, 'Hermano', MARGEN, yBloque + 18);
    ajustado(doc, conTratamiento(d), MARGEN, yBloque + 34, { letra: LETRA.titulo, tam: 21, minimo: 15, ancho: mitad - 20, color: NEGRO, dosLineas: true });
    if (d.numeroHermano) rotulo(doc, `Hermano n.º ${d.numeroHermano}`, MARGEN, yBloque + 74, { tam: 10.5, color: GRIS });
    doc.rect(MARGEN + mitad, yBloque, 0.75, altoBloque).fill(FILETE);
    const xPuesto = MARGEN + mitad + 21;
    etiqueta(doc, 'Puesto', xPuesto, yBloque + 18);
    ajustado(doc, d.puesto || 'Por asignar', xPuesto, yBloque + 30, { letra: LETRA.titulo, tam: 30, minimo: 17, ancho: mitad - 22, color: BURDEOS, dosLineas: true });
    if (d.tramo) rotulo(doc, d.tramo, xPuesto, yBloque + 74, { tam: 10.5, color: NEGRO, ancho: mitad - 22 });
    doc.rect(MARGEN, yBloque + altoBloque, ANCHO, 0.75).fill(FILETE);

    // Cuándo y por dónde; la ropa y lo abonado, lo que haya.
    const altoFila = 60;
    let y = yBloque + altoBloque;
    filaDeCeldas(doc, [['Día', mayuscula(d.fechaSalida)], ['Hora de entrada', d.horaSalida], ['Acceso', mayuscula(d.accesoPuerta)]], y, altoFila);
    y += altoFila;
    const extra: [string, string][] = [];
    if (d.tunica) extra.push(['Túnica', d.tunica]);
    if (d.capirote) extra.push(['Capirote', d.capirote]);
    if (d.faraona) extra.push(['Faraona', d.faraona]);
    if (d.importe) extra.push([donativo ? 'Donativo' : 'Limosna abonada', d.importe]);
    for (let i = 0; i < extra.length; i += 3) {
      filaDeCeldas(doc, extra.slice(i, i + 3), y, altoFila);
      y += altoFila;
    }
    if (d.observaciones) {
      etiqueta(doc, 'Observaciones', MARGEN, y + 15);
      doc.font(LETRA.texto).fontSize(10.5).fillColor(NEGRO).text(d.observaciones, MARGEN, y + 29, { width: ANCHO, height: 28, ellipsis: true });
      y += altoFila;
      doc.rect(MARGEN, y, ANCHO, 0.75).fill(FILETE);
    }

    // El QR, en su recuadro crema. Con muchas filas encima (túnica, capirote,
    // faraona, observaciones) se encoge para no pisar el pie; a 96 pt (34 mm)
    // se sigue leyendo sin problema.
    const yPie = A4.alto - 64;
    const yQr = y + 26;
    const lado = Math.max(96, Math.min(126, yPie - 22 - yQr - 57));
    doc.rect(MARGEN, yQr, ANCHO, lado + 2 * 9 + 2 * 19.5).fill(MARFIL);
    doc.rect(MARGEN + 19.5, yQr + 19.5, lado + 18, lado + 18).fill('#ffffff');
    qr(doc, d.codigo, MARGEN + 28.5, yQr + 28.5, lado);
    const xQr = MARGEN + 19.5 + lado + 18 + 27;
    const anchoQr = MARGEN + ANCHO - 19.5 - xQr;
    const yTexto = yQr + 19.5 + (lado + 18) / 2 - 51;
    rotulo(doc, 'Enséñala en la puerta del templo', xQr, yTexto, { letra: LETRA.titulo, tam: 18, color: NEGRO, ancho: anchoQr });
    doc.font(LETRA.texto).fontSize(11).fillColor(NEGRO).text(
      'El diputado de tramo lee este código al entrar. Vale impresa o en la pantalla del móvil, junto a tu DNI.',
      xQr, yTexto + 28, { width: anchoQr, lineGap: 3 },
    );
    rotulo(doc, 'Personal e intransferible.', xQr, yTexto + 82, { tam: 9.75, color: GRIS });

    // Pie: las indicaciones de la salida (las escribe el CMS) y quién la
    // expide. Tres líneas como mucho: más largas pisarían el filete de abajo.
    doc.font(LETRA.cursiva).fontSize(11.25).fillColor(GRIS).text(
      d.salida.indicaciones?.trim() || 'Se ruega puntualidad y recogimiento.',
      MARGEN, yPie - 4, { width: 320, lineGap: 2, height: 44, ellipsis: true },
    );
    rotulo(doc, `Expedida el ${fecha.format(d.expedida)}`, MARGEN, yPie - 2, { tam: 9, color: GRIS, ancho: ANCHO, alinear: 'right' });
    rotulo(doc, t.expide, MARGEN, yPie + 11, { tam: 9, color: GRIS, ancho: ANCHO, alinear: 'right' });
    doc.rect(0, A4.alto - 4.5, A4.ancho, 4.5).fill(NEGRO);
  });
}

/** El PDF de una papeleta, en memoria. */
export async function papeletaEnPdf(d: DatosDeLaPapeleta): Promise<Buffer> {
  const doc = nuevoDocumento(`Papeleta de sitio ${d.referencia}`);
  dibujar(doc, d);
  return aBuffer(doc);
}

/** El nombre del archivo: papeleta-2027-0012.pdf */
export const archivoDePapeleta = (d: Pick<DatosDeLaPapeleta, 'referencia'>) => `papeleta-${d.referencia}.pdf`;
