import type { Area, CifraVistazo, DatosCrudos } from '../../domain/datos-areas.js';
import { euros, fechaLarga, valorEscrito, vistazo } from '../../domain/datos-areas.js';
import type { Periodo } from '../../domain/periodo-datos.js';
import { diaMadrid } from '../../domain/contabilidad.js';
import {
  A4, ANCHO_UTIL, FILETE, GRANATE, GRIS, IMAGENES, INICIO_CONTENIDO, LETRA, MARGEN, ROJO, TINTA, VERDE,
  aBuffer, cabecerasYPies, filaDeCifras, grafica, nuevoDocumento, parrafos, rotulo, sitio, versalitas,
  type CifraPapel, type Doc,
} from './pdf.js';

const NOMBRE_GRUPO = 'Grupo Parroquial Nuestra Señora de los Desamparados';

const pieDeCifras = (hoy: Date) => `Cifras de conjunto del CMS, sin datos de ningún hermano · a ${fechaLarga(diaMadrid(hoy))}`;

const tonoDe = (t?: 'bueno' | 'malo') => (t === 'bueno' ? VERDE : t === 'malo' ? ROJO : undefined);

const cifrasDe = (area: Area): CifraPapel[] => area.cifras.map((c) => ({
  etiqueta: c.etiqueta, valor: valorEscrito(c), sufijo: c.sufijo, nota: c.nota,
  colorValor: c.formato.startsWith('diferencia') ? tonoDe(c.tono) : undefined,
}));

/** Las cuatro cifras de un área y, debajo, la gráfica de cada una. */
function cuerpoDeArea(doc: Doc, area: Area) {
  if (area.alcance) {
    rotulo(doc, area.alcance, MARGEN.x, doc.y, { tam: 8, letra: LETRA.serifCursiva, color: GRIS });
    doc.y += 16;
  }
  doc.y = filaDeCifras(doc, cifrasDe(area), sitio(doc, 70)) + 26;
  for (const cifra of area.cifras) grafica(doc, cifra.grafica);
}

/** El informe de una pestaña: membrete, cifras y gráficas. */
export async function informeDeArea(area: Area, periodo: Periodo, hoy = new Date()): Promise<Buffer> {
  const titulo = `${area.informe} · ${periodo.etiqueta}`;
  const doc = nuevoDocumento(titulo);

  // Membrete: escudo, el Grupo y el título, en la primera página.
  const y0 = MARGEN.arriba;
  doc.image(IMAGENES.escudo, MARGEN.x, y0, { height: 58 });
  rotulo(doc, NOMBRE_GRUPO, MARGEN.x + 60, y0 + 4, { letra: LETRA.serifCursiva, tam: 12, color: GRIS });
  doc.font(LETRA.serif).fontSize(32).fillColor(TINTA).text(area.informe, MARGEN.x + 60, y0 + 18, { lineBreak: false });
  const fechas = periodo.tipo === 'curso'
    ? `${periodo.etiqueta}: del ${fechaLarga(periodo.desde)} al ${fechaLarga(periodo.hasta)}`
    : `${periodo.etiqueta}: de enero a diciembre de ${periodo.anio}`;
  rotulo(doc, `${fechas}${periodo.enCurso ? ', hasta hoy' : ''}`, MARGEN.x + 60, y0 + 56, { tam: 8.5 });
  doc.moveTo(MARGEN.x, y0 + 76).lineTo(A4.ancho - MARGEN.x, y0 + 76).lineWidth(1.4).strokeColor(GRANATE).stroke();
  doc.x = MARGEN.x;
  doc.y = y0 + 96;

  cuerpoDeArea(doc, area);
  cabecerasYPies(doc, `${area.informe} · ${periodo.etiqueta}`, () => area.nombre, pieDeCifras(hoy), 1);
  // La primera página lleva el membrete en vez de la cabecera, pero también su pie.
  pieDePrimera(doc, pieDeCifras(hoy));
  return aBuffer(doc);
}

function pieDePrimera(doc: Doc, texto: string) {
  const total = doc.bufferedPageRange().count;
  doc.switchToPage(0);
  const margenes = doc.page.margins;
  doc.page.margins = { top: 0, bottom: 0, left: 0, right: 0 };
  const yPie = A4.alto - MARGEN.abajo;
  doc.moveTo(MARGEN.x, yPie - 8).lineTo(A4.ancho - MARGEN.x, yPie - 8).lineWidth(0.6).strokeColor(FILETE).stroke();
  rotulo(doc, texto, MARGEN.x, yPie, { tam: 7.5, ancho: ANCHO_UTIL - 60 });
  rotulo(doc, `1 de ${total}`, MARGEN.x, yPie, { tam: 7.5, ancho: ANCHO_UTIL, alinear: 'right' });
  doc.page.margins = margenes;
}

// ---------------------------------------------------------------- la Memoria

export interface TextosMemoria {
  presentacion: string | null;
  firmaPresentacion: string | null;
  lugarFecha: string | null;
  epilogo: string | null;
  firmaEpilogo: string | null;
  notaPatrimonio: string | null;
  fechaCabildo: string | null;
}

interface Capitulo { numero: string; titulo: string; descripcion: string; pagina?: number }

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

/** Primera página de un capítulo: el número en granate y el título grande. */
function abrirCapitulo(doc: Doc, cap: Capitulo, subtitulo?: string) {
  doc.addPage();
  cap.pagina = doc.bufferedPageRange().count;
  let y = INICIO_CONTENIDO + 6;
  rotulo(doc, versalitas(cap.numero === '·' ? 'Epílogo' : `Capítulo ${cap.numero}`), MARGEN.x, y, { tam: 8, letra: LETRA.sansFuerte, color: GRANATE, espaciado: 1.6 });
  y += 14;
  doc.font(LETRA.serif).fontSize(34).fillColor(TINTA).text(cap.titulo, MARGEN.x, y, { width: ANCHO_UTIL });
  y = doc.y + 2;
  if (subtitulo) {
    doc.font(LETRA.sans).fontSize(9).fillColor(GRIS).text(subtitulo, MARGEN.x, y, { width: ANCHO_UTIL });
    y = doc.y;
  }
  doc.x = MARGEN.x;
  doc.y = y + 22;
}

function falta(doc: Doc, texto: string) {
  doc.font(LETRA.serifCursiva).fontSize(13).fillColor(GRIS).text(`[${texto}]`, MARGEN.x, doc.y, { width: ANCHO_UTIL });
  doc.y += 10;
}

function firma(doc: Doc, lineas: (string | null)[]) {
  const y = sitio(doc, 70) + 14;
  // La cruz antes de la firma, dibujada: la letra no la trae.
  const cx = A4.ancho - MARGEN.x - 5;
  doc.rect(cx - 0.9, y, 1.8, 13).fill(GRANATE);
  doc.rect(cx - 4.5, y + 3.5, 9, 1.8).fill(GRANATE);
  let yy = y + 18;
  for (const [i, l] of lineas.entries()) {
    if (!l) continue;
    doc.font(i === 0 ? LETRA.serifCursiva : LETRA.serif).fontSize(i === 0 ? 11 : 12.5).fillColor(i === 0 ? GRIS : TINTA).text(l, MARGEN.x, yy, { width: ANCHO_UTIL, align: 'right' });
    yy = doc.y + 1;
  }
  doc.y = yy + 10;
}

function portada(doc: Doc, periodo: Periodo, textos: TextosMemoria) {
  const cx = A4.ancho / 2;
  doc.rect(0, 0, A4.ancho, A4.alto).fill('#faf6ef');
  let y = 50;
  doc.image(IMAGENES.escudo, cx - 26, y, { height: 64 });
  y += 74;
  const centro = (t: string, letra: string, tam: number, c: string, espaciado = 0) => {
    doc.font(letra).fontSize(tam).fillColor(c).text(t, MARGEN.x, y, { width: ANCHO_UTIL, align: 'center', characterSpacing: espaciado });
    y = doc.y;
  };
  centro('Grupo Parroquial', LETRA.serifCursiva, 13, GRIS);
  centro('Nuestra Señora de los Desamparados', LETRA.serifFuerte, 17.5, TINTA);
  y += 2;
  centro('MÁLAGA', LETRA.sans, 7.5, GRIS, 2);

  // La Virgen en un arco de medio punto, con un filete de oro alrededor.
  const w = 250, h = 330, r = w / 2;
  const x0 = cx - w / 2, y0 = y + 18;
  const arco = (m: number) => {
    doc.moveTo(x0 + m, y0 + r)
      .bezierCurveTo(x0 + m, y0 + m + r * 0.448, x0 + r - (r - m) * 0.552, y0 + m, cx, y0 + m)
      .bezierCurveTo(cx + (r - m) * 0.552, y0 + m, x0 + w - m, y0 + m + r * 0.448, x0 + w - m, y0 + r)
      .lineTo(x0 + w - m, y0 + h - m).lineTo(x0 + m, y0 + h - m).closePath();
  };
  doc.save();
  arco(0);
  doc.lineWidth(0.8).strokeColor('#c8a95a').stroke();
  doc.restore();
  doc.save();
  arco(6);
  doc.clip();
  doc.image(IMAGENES.virgen, x0 + 6, y0 + 6, { cover: [w - 12, h - 12], align: 'center' });
  doc.restore();
  y = y0 + h + 26;

  centro('MEMORIA DEL CURSO', LETRA.sansFuerte, 9, GRANATE, 2.6);
  y += 4;
  centro(`${periodo.anio} – ${periodo.anio + 1}`, LETRA.serif, 52, TINTA);
  y += 2;
  centro(`Del ${fechaLarga(periodo.desde)} al Sábado de Pasión, ${fechaLarga(periodo.hasta)}`, LETRA.serifCursiva, 12.5, GRIS);

  const yPie = A4.alto - MARGEN.abajo - 10;
  doc.moveTo(MARGEN.x, yPie - 10).lineTo(A4.ancho - MARGEN.x, yPie - 10).lineWidth(0.6).strokeColor(FILETE).stroke();
  const cabildo = textos.fechaCabildo?.trim();
  doc.font(LETRA.sans).fontSize(8).fillColor(GRIS).text(cabildo ? `Presentada al Cabildo General de hermanos el ${cabildo}` : NOMBRE_GRUPO, MARGEN.x, yPie, { width: ANCHO_UTIL, align: 'center', lineBreak: false });
}

function indice(doc: Doc, capitulos: Capitulo[]) {
  let y = INICIO_CONTENIDO + 6;
  doc.font(LETRA.serif).fontSize(40).fillColor(TINTA).text('Índice', MARGEN.x, y);
  y = doc.y + 18;
  for (const [i, cap] of capitulos.entries()) {
    doc.moveTo(MARGEN.x, y).lineTo(A4.ancho - MARGEN.x, y).lineWidth(0.6).strokeColor(FILETE).stroke();
    rotulo(doc, cap.numero, MARGEN.x, y + 11, { letra: LETRA.serif, tam: 18, color: GRANATE });
    rotulo(doc, cap.titulo, MARGEN.x + 44, y + 9, { letra: LETRA.serifFuerte, tam: 16, color: TINTA, ancho: ANCHO_UTIL - 90 });
    rotulo(doc, cap.descripcion, MARGEN.x + 44, y + 29, { tam: 8, ancho: ANCHO_UTIL - 90 });
    rotulo(doc, String(cap.pagina ?? ''), MARGEN.x, y + 13, { tam: 9, color: TINTA, ancho: ANCHO_UTIL, alinear: 'right' });
    y += 48;
    if (i === capitulos.length - 1) doc.moveTo(MARGEN.x, y).lineTo(A4.ancho - MARGEN.x, y).lineWidth(0.6).strokeColor(FILETE).stroke();
  }
}

function paginaVistazo(doc: Doc, cifras: CifraVistazo[], areas: Record<string, Area>, crudos: DatosCrudos) {
  doc.y = filaDeCifras(doc, cifras.map((c) => ({
    etiqueta: c.etiqueta, valor: c.valor, colorValor: c.etiqueta === 'Resultado' ? tonoDe(c.tono) : undefined,
    nota: `${c.cambio} · antes ${c.antes}`,
  })), doc.y) + 28;

  // Hermanos y papeletas, cinco cursos, lado a lado.
  const medio = (ANCHO_UTIL - 30) / 2;
  const y = doc.y;
  const hermanos = areas.hermanos.cifras[0].grafica;
  const papeletas = areas.procesion.cifras[1].grafica;
  grafica(doc, { ...hermanos, titulo: 'Hermanos, cinco cursos', resumen: '', pie: undefined }, { ancho: medio, altoColumnas: 120 });
  const yFin = doc.y;
  doc.y = y;
  grafica(doc, { ...papeletas, titulo: 'Papeletas, cinco estaciones', resumen: '', pie: undefined }, { x: MARGEN.x + medio + 30, ancho: medio, altoColumnas: 120 });
  doc.y = Math.max(doc.y, yFin);

  // Adónde fue cada euro: los cuatro gastos mayores y el resto junto.
  const gastos = crudos.dinero.porCategoria.filter((c) => c.tipo === 'GASTO' && c.importe > 0).sort((a, b) => b.importe - a.importe);
  const total = gastos.reduce((s, g) => s + g.importe, 0);
  if (total > 0) {
    const partes = [...gastos.slice(0, 4), ...(gastos.length > 4 ? [{ categoria: 'Otros', importe: gastos.slice(4).reduce((s, g) => s + g.importe, 0) }] : [])];
    const tonos = [GRANATE, '#a5606b', '#c9a7ad', '#9c7a2a', '#d8c79c'];
    let yy = sitio(doc, 80);
    doc.font(LETRA.serifFuerte).fontSize(14.5).fillColor(TINTA).text('Adónde fue cada euro', MARGEN.x, yy, { lineBreak: false });
    yy += 22;
    let x = MARGEN.x;
    partes.forEach((p, i) => {
      const w = (ANCHO_UTIL * p.importe) / total;
      doc.rect(x, yy, Math.max(w - 1.5, 1), 15).fill(tonos[i]);
      x += w;
    });
    yy += 22;
    const col = ANCHO_UTIL / partes.length;
    partes.forEach((p, i) => {
      doc.rect(MARGEN.x + i * col, yy + 1.5, 6.5, 6.5).fill(tonos[i]);
      rotulo(doc, p.categoria, MARGEN.x + i * col + 10, yy, { tam: 8, color: TINTA, ancho: col - 14 });
      rotulo(doc, `${euros(p.importe)} · ${Math.round((p.importe / total) * 100)} %`, MARGEN.x + i * col + 10, yy + 11, { tam: 7.5, ancho: col - 14 });
    });
    doc.y = yy + 30;
  }
}

/**
 * La Memoria del curso, entera: portada, índice, presentación, el curso de un
 * vistazo, los capítulos de cada área y el epílogo. `borrador` avisa en cada
 * página y deja a la vista lo que falta por escribir.
 */
export async function memoriaDelCurso(
  periodo: Periodo, areas: Area[], crudos: DatosCrudos, textos: TextosMemoria, opciones: { borrador: boolean; hoy?: Date },
): Promise<Buffer> {
  const hoy = opciones.hoy ?? new Date();
  const titulo = `Memoria del curso ${periodo.anio} – ${periodo.anio + 1}`;
  const doc = nuevoDocumento(titulo);
  const porClave = Object.fromEntries(areas.map((a) => [a.clave, a])) as Record<string, Area>;

  const capitulos: Capitulo[] = [
    { numero: 'I', titulo: 'Presentación del Hermano Mayor', descripcion: 'Carta a los hermanos.' },
    { numero: 'II', titulo: 'El curso de un vistazo', descripcion: 'Las cifras clave frente al curso anterior.' },
    { numero: 'III', titulo: 'Cultos y actos', descripcion: 'De la Agenda: cultos, formación, convivencias y reuniones, mes a mes.' },
    { numero: 'IV', titulo: 'Hermanos', descripcion: 'Secretaría: censo al cierre, altas y bajas con sus motivos, edades. Sin nombres.' },
    { numero: 'V', titulo: 'Sábado de Pasión y Rosario vespertino', descripcion: 'Papeletas de sitio, el cortejo por puestos y la salida de octubre.' },
    { numero: 'VI', titulo: 'Cuentas', descripcion: 'Mayordomía: ingresos y gastos por partida, y lo que queda por cobrar.' },
    { numero: 'VII', titulo: 'Patrimonio', descripcion: 'Estrenos, restauraciones y donaciones, y el estado del inventario.' },
    { numero: 'VIII', titulo: 'Comunicación', descripcion: 'La web: noticias, publicaciones y páginas del curso.' },
    { numero: '·', titulo: 'Epílogo y firma del Secretario', descripcion: 'Con el visto bueno del Hermano Mayor.' },
  ];
  const [cPresentacion, cVistazo, cCultos, cHermanos, cProcesion, cCuentas, cPatrimonio, cComunicacion, cEpilogo] = capitulos;

  portada(doc, periodo, textos);
  doc.addPage(); // el índice: se escribe al final, cuando se saben las páginas

  abrirCapitulo(doc, cPresentacion);
  if (textos.presentacion?.trim()) parrafos(doc, textos.presentacion);
  else falta(doc, 'Falta la presentación del Hermano Mayor: se escribe en «Datos e informes › Memoria».');
  firma(doc, [textos.lugarFecha, textos.firmaPresentacion || 'El Hermano Mayor']);

  abrirCapitulo(doc, cVistazo, `Cada cifra, con la del curso ${periodo.anio - 1} – ${periodo.anio} al lado.`);
  paginaVistazo(doc, vistazo(crudos, hoy), porClave, crudos);

  const capituloDeArea = (cap: Capitulo, area: Area, antes?: () => void) => {
    abrirCapitulo(doc, cap, cap.descripcion);
    antes?.();
    cuerpoDeArea(doc, area);
  };
  capituloDeArea(cCultos, porClave.agenda);
  capituloDeArea(cHermanos, porClave.hermanos);
  capituloDeArea(cProcesion, porClave.procesion);
  capituloDeArea(cCuentas, porClave.dinero);
  capituloDeArea(cPatrimonio, porClave.inventario, () => {
    if (textos.notaPatrimonio?.trim()) {
      parrafos(doc, textos.notaPatrimonio, { tam: 12 });
      doc.y += 8;
    }
  });
  capituloDeArea(cComunicacion, porClave.web);

  abrirCapitulo(doc, cEpilogo);
  if (textos.epilogo?.trim()) parrafos(doc, textos.epilogo);
  else falta(doc, 'Falta el epílogo del Secretario.');
  firma(doc, [textos.lugarFecha, textos.firmaEpilogo || 'El Secretario', 'Vº Bº, el Hermano Mayor']);

  // El índice, ya con los números de página.
  doc.switchToPage(1);
  indice(doc, capitulos);

  const nombres = new Map<number, string>();
  let actual = 'Índice';
  const inicios = new Map(capitulos.map((c) => [(c.pagina ?? 0) - 1, c.numero === '·' ? 'Epílogo' : `${c.numero} · ${c.titulo}`]));
  for (let i = 1; i < doc.bufferedPageRange().count; i++) {
    actual = inicios.get(i) ?? actual;
    nombres.set(i, actual);
  }
  cabecerasYPies(doc, titulo, (i) => nombres.get(i) ?? '', `${pieDeCifras(hoy)}. Ninguna página nombra a un hermano.`, 1, opciones.borrador);
  if (opciones.borrador) {
    doc.switchToPage(0);
    rotulo(doc, 'BORRADOR', MARGEN.x, 24, { tam: 8, letra: LETRA.sansFuerte, color: GRANATE, ancho: ANCHO_UTIL, alinear: 'right', espaciado: 2 });
  }
  return aBuffer(doc);
}

