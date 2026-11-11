import { readFile } from 'node:fs/promises';
import PptxGenJS from 'pptxgenjs';
import sharp from 'sharp';
import type { Area, ClaveArea, Cifra, DatosCrudos } from '../../domain/datos-areas.js';
import { enMadrid, etiquetasDeMeses, valorEscrito, vistazo } from '../../domain/datos-areas.js';
import { entradilla, enTexto } from '../../domain/entradillas.js';
import type { Periodo } from '../../domain/periodo-datos.js';
import { BURDEOS, BURDEOS_VIVO, CREMA, IMAGENES, NEGRO, ORO, ORO_CLARO, ORO_PALIDO } from './pdf.js';
import { capituloDeSalidas, salidasDelAnio, textosPortada, type TextosInforme } from './informes.js';

/**
 * El Informe anual en PowerPoint, para proyectarlo en una tele desde un
 * portátil y pasarlo en directo: la maqueta elegida el 11-11-2026.
 *
 * No es el PDF partido en diapositivas: en una pantalla se lee de lejos, así
 * que va una idea por diapositiva, letra grande y la cifra que manda en
 * grande. Lo que no cabe a esa distancia (la carta entera, la entradilla de
 * cada capítulo, la nota de patrimonio) va en las notas del orador, que se
 * ven en el portátil y no en la tele.
 *
 * Las cifras son las de `domain/datos-areas.ts`, las mismas del PDF, y los
 * capítulos se numeran igual que allí. Las gráficas son de PowerPoint y no
 * dibujos: se pueden retocar a mano antes de presentarlas.
 *
 * Letras que trae cualquier Windows: un .pptx no lleva las suyas dentro, y en
 * un equipo que no tuviera las del PDF PowerPoint pondría otras y se
 * descuadraría. Georgia en los títulos y Segoe UI en el texto; las cifras en
 * grande, en Segoe UI Light, porque las de Georgia son de estilo antiguo (unas
 * bajan de la línea) y en grande parecen descolocadas.
 *
 * Se maqueta en los píxeles de la maqueta (1280×720) y se pasa a pulgadas y
 * puntos al escribir: así las medidas se pueden comparar con ella.
 */

type Presentacion = InstanceType<typeof PptxGenJS>;
type Diapositiva = ReturnType<Presentacion['addSlide']>;

const ANCHO = 1280;
const ALTO = 720;
const MX = 72;
const pulgadas = (px: number) => px / 96;
const puntos = (px: number) => px * 0.75;
const hex = (color: string) => color.replace('#', '').toUpperCase();

const LETRA = { titulo: 'Georgia', texto: 'Segoe UI', cifra: 'Segoe UI Light', fuerte: 'Segoe UI Semibold' } as const;
const GRIS_CLARO = '#b9b1a8';

/** Un color hacia otro: `parte` es cuánto del segundo. Para los tonos apagados sobre el negro, sin escribir a mano ninguno de marca. */
function mezcla(a: string, b: string, parte: number): string {
  const c = (h: string, i: number) => parseInt(h.replace('#', '').slice(i, i + 2), 16);
  return `#${[0, 2, 4].map((i) => Math.round(c(a, i) * (1 - parte) + c(b, i) * parte).toString(16).padStart(2, '0')).join('')}`;
}
// Funciones y no constantes: el burdeos y el oro cambian si se cambia la marca en el CMS.
const oroApagado = () => mezcla(ORO, NEGRO, 0.45);
const filete = () => mezcla(ORO, NEGRO, 0.65);

interface OpcionesTexto {
  tam: number;
  letra?: keyof typeof LETRA;
  color?: string;
  cursiva?: boolean;
  alinear?: 'left' | 'center' | 'right';
  vertical?: 'top' | 'middle' | 'bottom';
  /** En píxeles, como el `letter-spacing` de la maqueta. */
  espaciado?: number;
  alto?: number;
  interlineado?: number;
  /** 0 a 100. */
  transparencia?: number;
}

function texto(s: Diapositiva, t: string, x: number, y: number, ancho: number, o: OpcionesTexto) {
  s.addText(t, {
    x: pulgadas(x), y: pulgadas(y), w: pulgadas(ancho), h: pulgadas(o.alto ?? o.tam * 1.35),
    margin: 0, fontFace: LETRA[o.letra ?? 'texto'], fontSize: puntos(o.tam), color: hex(o.color ?? CREMA),
    italic: o.cursiva, align: o.alinear ?? 'left', valign: o.vertical ?? 'top',
    charSpacing: o.espaciado ? puntos(o.espaciado) : undefined, lineSpacingMultiple: o.interlineado,
    transparency: o.transparencia,
  });
}

function caja(s: Diapositiva, x: number, y: number, ancho: number, alto: number, color: string, giro?: number, borde?: string) {
  s.addShape(giro ? 'diamond' : 'rect', {
    x: pulgadas(x), y: pulgadas(y), w: pulgadas(ancho), h: pulgadas(alto),
    fill: { color: hex(color) }, line: borde ? { color: hex(borde), width: 0.75 } : { type: 'none' },
  });
}

/** Dos filetes de oro con el rombo burdeos en medio, como en la portada del PDF. */
function filetesConRombo(s: Diapositiva, cx: number, y: number) {
  caja(s, cx - 104, y, 90, 1, ORO);
  caja(s, cx + 14, y, 90, 1, ORO);
  caja(s, cx - 6.5, y - 6, 13, 13, BURDEOS, 45, ORO);
}

/** El escudo de la marca, entero dentro de la caja y centrado en ella. */
interface Escudo { datos: string; ancho: number; alto: number }
async function leerEscudo(ruta: string): Promise<Escudo | null> {
  try {
    const [bytes, meta] = await Promise.all([readFile(ruta), sharp(ruta).metadata()]);
    if (!meta.width || !meta.height) return null;
    const tipo = meta.format === 'svg' ? 'image/svg+xml' : meta.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    return { datos: `${tipo};base64,${bytes.toString('base64')}`, ancho: meta.width, alto: meta.height };
  } catch {
    // Sin escudo la presentación sigue valiendo: el hueco queda en negro.
    return null;
  }
}
function escudo(s: Diapositiva, e: Escudo | null, x: number, y: number, ancho: number, alto: number) {
  if (!e) return;
  const escala = Math.min(ancho / e.ancho, alto / e.alto);
  const w = e.ancho * escala;
  const h = e.alto * escala;
  s.addImage({ data: e.datos, x: pulgadas(x + (ancho - w) / 2), y: pulgadas(y + (alto - h) / 2), w: pulgadas(w), h: pulgadas(h), altText: 'Escudo' });
}

// ---------------------------------------------------------------- textos a mano

const FALTA_CARTA = '[Falta la carta del Hermano Mayor: se escribe en «Datos e informes › Informe anual».]';
const FALTA_EPILOGO = '[Falta el epílogo del Secretario: se escribe en «Datos e informes › Informe anual».]';

/**
 * Lo que se deja en la tele de un texto largo: las primeras frases del primer
 * párrafo que quepan en `maximo` caracteres. Si la primera ya no cabe, se corta
 * por una palabra y se cierra con «…». El texto entero va en las notas.
 */
export function fraseDestacada(textoLargo: string | null, maximo = 220): string | null {
  const parrafo = textoLargo?.trim().split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim();
  if (!parrafo) return null;
  const frases = parrafo.match(/[^.!?…]+(?:[.!?…]+[»”"')]*|$)/g)?.map((f) => f.trim()).filter(Boolean) ?? [parrafo];
  let elegida = '';
  for (const f of frases) {
    const junta = elegida ? `${elegida} ${f}` : f;
    if (junta.length > maximo) break;
    elegida = junta;
  }
  if (elegida) return elegida;
  const corte = parrafo.slice(0, maximo);
  return `${corte.slice(0, Math.max(corte.lastIndexOf(' '), 1)).replace(/[\s,;:]+$/, '')}…`;
}

// ---------------------------------------------------------------- las piezas de cada diapositiva

/** La banda burdeos de arriba, el antetítulo, el título y el numeral del capítulo. */
function cabecera(s: Diapositiva, antetitulo: string, titulo: string, numeral?: string, derecha?: string) {
  caja(s, 0, 0, ANCHO, 5, BURDEOS);
  caja(s, 0, 5, ANCHO, 1, ORO);
  texto(s, antetitulo.toUpperCase(), MX, 44, 900, { tam: 14, letra: 'fuerte', color: ORO_CLARO, espaciado: 5 });
  texto(s, titulo, MX, 62, numeral ? 900 : 760, { tam: 52, letra: 'titulo', alto: 72 });
  if (numeral) texto(s, numeral, ANCHO - MX - 300, 34, 300, { tam: 96, letra: 'titulo', color: BURDEOS, alinear: 'right', alto: 110 });
  if (derecha) texto(s, derecha, ANCHO - MX - 440, 104, 440, { tam: 18, color: GRIS_CLARO, alinear: 'right' });
}

function pie(s: Diapositiva, izquierda: string, numero: number) {
  caja(s, MX, ALTO - 54, ANCHO - 2 * MX, 1, filete());
  texto(s, izquierda, MX, ALTO - 36, 900, { tam: 14, color: GRIS_CLARO });
  texto(s, String(numero), ANCHO - MX - 100, ALTO - 36, 100, { tam: 14, color: GRIS_CLARO, alinear: 'right' });
}

/** La franja burdeos de abajo de la portada y del cierre. */
function franja(s: Diapositiva, izquierda: string, derecha: string) {
  caja(s, 0, ALTO - 76, ANCHO, 76, BURDEOS);
  caja(s, 0, ALTO - 76, ANCHO, 1, ORO);
  texto(s, izquierda.toUpperCase(), MX, ALTO - 50, 500, { tam: 14, color: ORO_CLARO, espaciado: 3 });
  if (derecha) texto(s, derecha, ANCHO - MX - 760, ALTO - 51, 760, { tam: 17, alinear: 'right', transparencia: 15 });
}

const Y_CUERPO = 160;
const Y_FIN = ALTO - 80;
const X_DERECHA = 476;
const ANCHO_DERECHA = ANCHO - MX - X_DERECHA;

/** La columna de la izquierda: la cifra que manda en grande y, debajo, las otras. */
function columnaDeCifras(s: Diapositiva, principal: Cifra, otras: Cifra[]) {
  const valor = valorEscrito(principal);
  const larga = valor.length > 5;
  const tam = larga ? 84 : 150;
  texto(s, valor, MX, Y_CUERPO - (larga ? 0 : 16), 330, { tam, letra: 'cifra', alto: tam * 1.2 });
  let y = Y_CUERPO + (larga ? 104 : 168);
  texto(s, principal.sufijo ? `${principal.etiqueta} (${principal.sufijo})` : principal.etiqueta, MX, y, 320, { tam: 22 });
  y += 32;
  texto(s, principal.nota, MX, y, 320, { tam: 18, color: ORO_CLARO, alto: 50 });
  y += 62;
  for (const c of otras) {
    const v = valorEscrito(c);
    texto(s, v, MX, y, 120, { tam: v.length > 6 ? 24 : 32, letra: 'cifra', alto: 44, vertical: 'middle' });
    texto(s, `${c.etiqueta}${c.sufijo ? ` (${c.sufijo})` : ''} · ${c.nota}`, MX + 126, y, 204, { tam: 16, color: GRIS_CLARO, alto: 52, vertical: 'middle' });
    y += 60;
  }
  caja(s, MX + 340, Y_CUERPO - 10, 1, Y_FIN - Y_CUERPO + 10, filete());
}

/** El título de la gráfica a la izquierda y su resumen a la derecha, sobre ella. */
function tituloDeGrafica(s: Diapositiva, titulo: string, resumen: string, x = X_DERECHA, ancho = ANCHO_DERECHA) {
  texto(s, titulo, x, Y_CUERPO - 8, ancho * 0.62, { tam: 24, letra: 'titulo', alto: 34 });
  if (resumen) texto(s, resumen, x + ancho * 0.62, Y_CUERPO - 2, ancho * 0.38, { tam: 16, color: ORO_CLARO, alinear: 'right', alto: 34 });
}

function vacio(s: Diapositiva, mensaje: string, x = X_DERECHA, ancho = ANCHO_DERECHA) {
  texto(s, mensaje, x, Y_CUERPO + 60, ancho, { tam: 20, color: GRIS_CLARO, cursiva: true, letra: 'titulo', alto: 120 });
}

/** Lo común de todas las gráficas: sin rejilla ni eje de valores, letra y colores de la diapositiva. */
function estiloDeGrafica(): PptxGenJS.IChartOpts {
  return {
    valAxisHidden: true,
    valGridLine: { style: 'none' },
    catGridLine: { style: 'none' },
    catAxisLabelColor: hex(GRIS_CLARO),
    catAxisLabelFontFace: LETRA.texto,
    catAxisLabelFontSize: 13,
    catAxisLineShow: true,
    catAxisLineColor: hex(mezcla(CREMA, NEGRO, 0.55)),
    catAxisMajorTickMark: 'none',
    dataLabelColor: hex(CREMA),
    dataLabelFontFace: LETRA.texto,
    dataLabelFontSize: 13,
    // Positivo; negativo; cero: el cero no se escribe (en las de dos series hay ceros de relleno).
    dataLabelFormatCode: '#,##0;;',
    showLegend: false,
  };
}

const posicion = (x: number, y: number, ancho: number, alto: number) => ({ x: pulgadas(x), y: pulgadas(y), w: pulgadas(ancho), h: pulgadas(alto) });

/**
 * Columnas o barras con una destacada en oro y las demás apagadas. PowerPoint
 * no deja un color por barra en una serie, así que van dos series encima la
 * una de la otra, cada una con ceros donde no le toca.
 */
function barrasConDestacada(
  s: Diapositiva, etiquetas: string[], valores: number[], destacar: number | undefined,
  marco: { x: number; y: number; ancho: number; alto: number }, horizontales: boolean, formato?: string,
) {
  const resto = valores.map((v, i) => (i === destacar ? 0 : v));
  const una = valores.map((v, i) => (i === destacar ? v : 0));
  s.addChart('bar', [
    { name: 'resto', labels: etiquetas, values: resto },
    { name: 'destacada', labels: etiquetas, values: una },
  ], {
    ...posicion(marco.x, marco.y, marco.ancho, marco.alto),
    ...estiloDeGrafica(),
    barDir: horizontales ? 'bar' : 'col',
    barGrouping: 'clustered',
    barOverlapPct: 100,
    barGapWidthPct: horizontales ? 45 : 70,
    chartColors: [hex(oroApagado()), hex(ORO)],
    showValue: true,
    dataLabelPosition: 'outEnd',
    ...(formato && { dataLabelFormatCode: formato }),
    ...(horizontales && { catAxisLabelFontSize: 14, catAxisLabelColor: hex(CREMA), catAxisLineShow: false, catAxisOrientation: 'maxMin' as 'minMax' }),
  });
}

/** Barras apiladas con leyenda arriba: el estado de los enseres, lo publicado mes a mes. */
function apiladas(
  s: Diapositiva, etiquetas: string[], series: { nombre: string; color: string; valores: number[] }[],
  marco: { x: number; y: number; ancho: number; alto: number }, horizontales: boolean, conValores: boolean,
) {
  s.addChart('bar', series.map((x) => ({ name: x.nombre, labels: etiquetas, values: x.valores })), {
    ...posicion(marco.x, marco.y, marco.ancho, marco.alto),
    ...estiloDeGrafica(),
    barDir: horizontales ? 'bar' : 'col',
    barGrouping: 'stacked',
    barOverlapPct: 100,
    barGapWidthPct: horizontales ? 45 : 60,
    chartColors: series.map((x) => hex(x.color)),
    showValue: conValores,
    dataLabelPosition: 'ctr',
    dataLabelColor: hex(NEGRO),
    showLegend: true,
    legendPos: 't',
    legendColor: hex(GRIS_CLARO),
    legendFontFace: LETRA.texto,
    legendFontSize: 13,
    ...(horizontales && { catAxisLabelFontSize: 14, catAxisLabelColor: hex(CREMA), catAxisLineShow: false, catAxisOrientation: 'maxMin' as 'minMax' }),
  });
}

/** Las filas que caben a la vista; las demás, juntas en una última. */
function recortar<T extends { etiqueta: string; valores: number[] }>(filas: T[], cuantas: number, otras: string): { etiqueta: string; valores: number[] }[] {
  if (filas.length <= cuantas) return filas;
  const resto = filas.slice(cuantas - 1);
  const suma = resto[0].valores.map((_, i) => resto.reduce((t, f) => t + (f.valores[i] ?? 0), 0));
  return [...filas.slice(0, cuantas - 1), { etiqueta: otras, valores: suma }];
}

const AREA_GRAFICA = { x: X_DERECHA, y: Y_CUERPO + 34, ancho: ANCHO_DERECHA, alto: Y_FIN - Y_CUERPO - 34 };

// ---------------------------------------------------------------- los capítulos

interface Contexto { s: Diapositiva; area: Area; crudos: DatosCrudos; periodo: Periodo; hoy: Date }

const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ALTO_MES = 34;
const ALTO_LISTA = Y_FIN - Y_CUERPO;
const ANCHO_COLUMNA_ACTOS = (ANCHO_DERECHA - 40) / 2;
const ANCHO_TITULO_ACTO = ANCHO_COLUMNA_ACTOS - 58;
/**
 * Las líneas que ocupa el nombre de un acto a 18 px. No se puede medir como en
 * pdfkit (PowerPoint compone el texto al abrirlo): se cuenta con el ancho medio
 * de una letra de Segoe UI (medido en LibreOffice), un poco por encima.
 */
const lineasDeActo = (titulo: string) => (titulo.length * 8.8 > ANCHO_TITULO_ACTO ? 2 : 1);
const altoDeActo = (titulo: string) => 30 + lineasDeActo(titulo) * 26;
const altoDeMes = (actos: { title: string }[]) => ALTO_MES + actos.reduce((t, a) => t + altoDeActo(a.title), 0);

/** Cultos y actos: la lista por meses si cabe en dos columnas; si no, los actos mes a mes. */
function agenda({ s, area, crudos, hoy }: Contexto) {
  const [actos, ...otras] = area.cifras;
  columnaDeCifras(s, actos, otras);
  const ahora = hoy.toISOString();
  const lista = [...crudos.agenda.actos].sort((a, b) => a.startDate.localeCompare(b.startDate)).map((a) => ({ ...a, ...enMadrid(a.startDate), pasado: a.startDate < ahora }));
  if (!lista.length) return vacio(s, actos.grafica.vacio ?? 'No hay actos en la agenda de este año.');

  // Se reparte por meses en columnas; un mes no se parte entre dos.
  const meses = [...new Set(lista.map((a) => a.dia.slice(0, 7)))].map((m) => ({ mes: m, actos: lista.filter((a) => a.dia.startsWith(m)) }));
  const columnas: (typeof meses)[] = [[]];
  let usado = 0;
  for (const m of meses) {
    const alto = altoDeMes(m.actos);
    if (usado + alto > ALTO_LISTA && columnas[columnas.length - 1].length) {
      columnas.push([]);
      usado = 0;
    }
    columnas[columnas.length - 1].push(m);
    usado += alto;
  }
  const cabe = columnas.length <= 2 && columnas.every((c) => c.reduce((t, m) => t + altoDeMes(m.actos), 0) <= ALTO_LISTA);
  if (!cabe) {
    const g = actos.grafica;
    if (g.cuerpo.tipo !== 'apiladas') return;
    tituloDeGrafica(s, g.titulo, g.resumen);
    const tonos = [ORO, BURDEOS_VIVO, ORO_PALIDO, oroApagado(), GRIS_CLARO];
    apiladas(s, g.cuerpo.etiquetas, g.cuerpo.capas.map((c, i) => ({ nombre: c.nombre, color: tonos[i % tonos.length], valores: c.valores })), AREA_GRAFICA, false, true);
    return;
  }
  const anchoColumna = ANCHO_COLUMNA_ACTOS;
  columnas.forEach((col, i) => {
    const x = X_DERECHA + i * (anchoColumna + 40);
    let y = Y_CUERPO - 6;
    for (const m of col) {
      texto(s, MESES_LARGOS[Number(m.mes.slice(5, 7)) - 1], x, y, anchoColumna, { tam: 20, letra: 'titulo', cursiva: true, color: ORO_CLARO, alto: 28 });
      y += ALTO_MES;
      for (const a of m.actos) {
        const atenuado = a.pasado ? undefined : 40;
        texto(s, String(Number(a.dia.slice(8, 10))), x, y, 44, { tam: 30, letra: 'cifra', alto: 40, transparencia: atenuado });
        const lineas = lineasDeActo(a.title);
        texto(s, a.title, x + 58, y, ANCHO_TITULO_ACTO, { tam: 18, alto: lineas * 26, transparencia: atenuado });
        const detalle = [a.hora === '00:00' ? null : a.hora, a.location, a.pasado ? null : 'por venir'].filter(Boolean).join(' · ');
        texto(s, detalle, x + 58, y + lineas * 26, ANCHO_TITULO_ACTO, { tam: 14, color: GRIS_CLARO, alto: 22 });
        y += altoDeActo(a.title);
      }
    }
  });
}

function hermanos({ s, area }: Contexto) {
  const [activos, altas, bajas, edad] = area.cifras;
  columnaDeCifras(s, activos, [altas, bajas, edad]);
  const g = activos.grafica;
  if (g.cuerpo.tipo !== 'columnas') return;
  tituloDeGrafica(s, g.titulo, g.resumen);
  barrasConDestacada(s, g.cuerpo.etiquetas, g.cuerpo.series[0].valores, g.cuerpo.destacar, AREA_GRAFICA, false);
}

function procesion({ s, area, crudos }: Contexto) {
  // La tercera cifra es la de las otras salidas: con una sola no dice nada.
  const [cortejo, anioAnio, otras, porCobrar] = area.cifras;
  const hayOtras = crudos.procesion.porSalida.length > 1;
  columnaDeCifras(s, cortejo, hayOtras ? [anioAnio, otras, porCobrar] : [anioAnio, porCobrar]);
  const g = cortejo.grafica;
  tituloDeGrafica(s, g.titulo, g.resumen);
  if (g.vacio || g.cuerpo.tipo !== 'barras' || !g.cuerpo.filas.length) return vacio(s, g.vacio ?? 'Aún no hay papeletas este año.');
  const filas = recortar(g.cuerpo.filas.map((f) => ({ etiqueta: f.etiqueta, valores: [f.valores[0]] })), 9, 'Otros puestos');
  barrasConDestacada(s, filas.map((f) => f.etiqueta), filas.map((f) => f.valores[0]), 0, AREA_GRAFICA, true);
}

function dinero({ s, area, crudos }: Contexto) {
  const [resultado, ingresos, gastos, porCobrar] = area.cifras;
  columnaDeCifras(s, resultado, [ingresos, gastos, porCobrar]);
  const ancho = (ANCHO_DERECHA - 40) / 2;
  const lados = [
    { titulo: 'De dónde viene', tipo: 'INGRESO' as const, color: ORO, vacio: 'Ningún ingreso apuntado.' },
    { titulo: 'Adónde va', tipo: 'GASTO' as const, color: BURDEOS_VIVO, vacio: 'Ningún gasto apuntado.' },
  ];
  lados.forEach((l, i) => {
    const x = X_DERECHA + i * (ancho + 40);
    texto(s, l.titulo, x, Y_CUERPO - 8, ancho, { tam: 24, letra: 'titulo', alto: 34 });
    const filas = recortar(
      crudos.dinero.porCategoria.filter((c) => c.tipo === l.tipo && c.importe > 0).sort((a, b) => b.importe - a.importe).map((c) => ({ etiqueta: c.categoria, valores: [Math.round(c.importe)] })),
      6, 'Otras partidas',
    );
    if (!filas.length) return vacio(s, l.vacio, x, ancho);
    s.addChart('bar', [{ name: l.titulo, labels: filas.map((f) => f.etiqueta), values: filas.map((f) => f.valores[0]) }], {
      ...posicion(x, AREA_GRAFICA.y, ancho, AREA_GRAFICA.alto),
      ...estiloDeGrafica(),
      barDir: 'bar',
      barGapWidthPct: 55,
      chartColors: [hex(l.color)],
      showValue: true,
      dataLabelPosition: 'outEnd',
      dataLabelFormatCode: '#,##0 "€";;',
      catAxisLabelFontSize: 13,
      catAxisLabelColor: hex(CREMA),
      catAxisLineShow: false,
      catAxisOrientation: 'maxMin' as 'minMax',
    });
  });
}

function inventario({ s, area, crudos }: Contexto) {
  const [enseres, reparar, tunicas, capirotes] = area.cifras;
  columnaDeCifras(s, enseres, [reparar, tunicas, capirotes]);
  const g = enseres.grafica;
  tituloDeGrafica(s, g.titulo, '');
  const lista = crudos.inventario.enseres.filter((e) => e.total > 0);
  if (g.vacio || !lista.length) return vacio(s, g.vacio ?? 'No hay enseres en el inventario.');
  const filas = recortar(lista.map((e) => ({ etiqueta: e.nombre, valores: [e.optimo, e.bueno, e.reparar] })), 9, 'Otros enseres');
  apiladas(s, filas.map((f) => `${f.etiqueta} · ${f.valores.reduce((t, v) => t + v, 0)}`), [
    { nombre: 'óptimo', color: ORO, valores: filas.map((f) => f.valores[0]) },
    { nombre: 'bueno', color: oroApagado(), valores: filas.map((f) => f.valores[1]) },
    { nombre: 'a reparar', color: BURDEOS_VIVO, valores: filas.map((f) => f.valores[2]) },
  ], AREA_GRAFICA, true, false);
}

function web({ s, area, crudos, periodo }: Contexto) {
  const [noticias, publicaciones, cambios, boletin] = area.cifras;
  columnaDeCifras(s, noticias, [publicaciones, cambios, boletin]);
  const d = crudos.web;
  const de = (serie: { mes: string; total: number }[]) => periodo.meses.map((m) => serie.find((x) => x.mes === m)?.total ?? 0);
  tituloDeGrafica(s, 'Lo publicado, mes a mes', '');
  if (!d.noticias && !d.publicaciones) return vacio(s, 'Nada publicado este año.');
  apiladas(s, etiquetasDeMeses(periodo.meses), [
    { nombre: 'noticias', color: ORO, valores: de(d.noticiasPorMes) },
    { nombre: 'publicaciones', color: ORO_PALIDO, valores: de(d.publicacionesPorMes) },
  ], AREA_GRAFICA, false, true);
}

const CUERPOS: Record<ClaveArea, (ctx: Contexto) => void> = { agenda, hermanos, procesion, dinero, inventario, web };

// ---------------------------------------------------------------- la presentación entera

/**
 * La presentación del Informe anual: portada, presentación del Hermano Mayor,
 * el año de un vistazo, una diapositiva por capítulo y el epílogo. Las áreas
 * llegan ya sin las de módulos apagados: su capítulo no sale ni se numera.
 */
export async function presentacionAnual(
  periodo: Periodo, areas: Area[], crudos: DatosCrudos, textos: TextosInforme, opciones: { hoy?: Date } = {},
): Promise<Buffer> {
  const hoy = opciones.hoy ?? new Date();
  const titulo = `Informe anual ${periodo.anio}`;
  const t = textosPortada();
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = titulo;
  pres.subject = `${t.tipo} ${t.titular}`;
  pres.company = t.titular;
  pres.theme = { headFontFace: LETRA.titulo, bodyFontFace: LETRA.texto };
  const marcaDeEscudo = await leerEscudo(IMAGENES.escudoDestacadoEnNegro);
  const porClave = Object.fromEntries(areas.map((a) => [a.clave, a])) as Partial<Record<ClaveArea, Area>>;

  let numero = 0;
  const nueva = () => {
    const s = pres.addSlide();
    s.background = { color: hex(NEGRO) };
    numero += 1;
    return s;
  };

  // Los capítulos, en el orden y con los números del PDF.
  const salidas = salidasDelAnio(crudos).map((x) => x.nombre);
  const capitulos: { clave: ClaveArea | 'presentacion' | 'vistazo'; titulo: string }[] = [
    { clave: 'presentacion', titulo: 'Presentación del Hermano Mayor' },
    { clave: 'vistazo', titulo: 'El año de un vistazo' },
    { clave: 'agenda', titulo: 'Cultos y actos' },
    { clave: 'hermanos', titulo: 'Hermanos' },
    { clave: 'procesion', titulo: capituloDeSalidas(salidas, periodo.anio).titulo },
    { clave: 'dinero', titulo: 'Cuentas' },
    { clave: 'inventario', titulo: 'Patrimonio' },
    { clave: 'web', titulo: 'Comunicación' },
  ];
  const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const presentes = capitulos.filter((c) => c.clave === 'presentacion' || c.clave === 'vistazo' || c.clave in porClave)
    .map((c, i) => ({ ...c, numeral: ROMANOS[i] }));

  // Portada.
  {
    const s = nueva();
    const alto = ALTO - 76;
    caja(s, 460, 0, 1, alto, filete());
    escudo(s, marcaDeEscudo, 115, (alto - 280) / 2, 230, 280);
    const x = 540;
    const ancho = ANCHO - x - 80;
    texto(s, 'INFORME ANUAL', x, 92, ancho, { tam: 15, letra: 'fuerte', color: ORO_CLARO, espaciado: 6 });
    texto(s, t.tipo, x, 128, ancho, { tam: 26, letra: 'titulo', cursiva: true, color: ORO_CLARO, alto: 36 });
    texto(s, t.titular, x, 166, ancho, { tam: 46, letra: 'titulo', alto: 112, interlineado: 0.95, vertical: 'top' });
    filetesConRombo(s, x + 104, 300);
    texto(s, String(periodo.anio), x - 8, 304, ancho, { tam: 168, letra: 'cifra', alto: 200 });
    texto(s, `Del 1 de enero al 31 de diciembre de ${periodo.anio}`, x, 510, ancho, { tam: 22, letra: 'titulo', cursiva: true, transparencia: 25 });
    const cabildo = textos.fechaCabildo?.trim();
    franja(s, t.localidad, cabildo ? `Presentado al Cabildo General de hermanos el ${cabildo}` : '');
  }

  for (const c of presentes) {
    const s = nueva();
    const enPie = `${titulo} · ${c.numeral} · ${c.titulo}`;
    if (c.clave === 'presentacion') {
      const frase = fraseDestacada(textos.presentacion);
      caja(s, 0, 0, ANCHO, 5, BURDEOS);
      caja(s, 0, 5, ANCHO, 1, ORO);
      const x = 150;
      texto(s, c.titulo.toUpperCase(), x, 150, ANCHO - 2 * x, { tam: 14, letra: 'fuerte', color: ORO_CLARO, espaciado: 5 });
      texto(s, '“', x - 6, 170, 100, { tam: 120, letra: 'titulo', color: BURDEOS, alto: 120 });
      texto(s, frase ?? FALTA_CARTA, x, 250, ANCHO - 2 * x, { tam: frase ? 38 : 28, letra: 'titulo', cursiva: true, color: frase ? CREMA : GRIS_CLARO, alto: 240, interlineado: 1.2 });
      caja(s, x, 528, 60, 1, ORO);
      texto(s, 'El Hermano Mayor', x + 78, 512, 300, { tam: 24, letra: 'titulo', color: ORO_CLARO, alto: 34 });
      texto(s, textos.firmaPresentacion?.trim() ?? '', x + 300, 516, 500, { tam: 20, color: GRIS_CLARO, alto: 30 });
      pie(s, enPie, numero);
      s.addNotes(textos.presentacion?.trim() || FALTA_CARTA);
      continue;
    }
    if (c.clave === 'vistazo') {
      const antes = periodo.comparaHasta ? `Cada cifra, junto a la de ${periodo.anio - 1} a estas alturas` : `Cada cifra, junto a la de ${periodo.anio - 1}`;
      cabecera(s, titulo, c.titulo, undefined, antes);
      const cifras = vistazo(crudos, hoy).filter((v) => v.area in porClave);
      const ancho = (ANCHO - 2 * MX - 3 * 40) / 4;
      cifras.forEach((v, i) => {
        const x = MX + (i % 4) * (ancho + 40);
        const y = 180 + Math.floor(i / 4) * 236;
        caja(s, x, y, ancho, 1, filete());
        texto(s, v.etiqueta, x, y + 16, ancho, { tam: 18, color: GRIS_CLARO });
        const largo = v.valor.length > 5;
        texto(s, v.valor, x, y + 46, ancho, { tam: largo ? 52 : 76, letra: 'cifra', alto: 96, vertical: 'middle' });
        const conCambio = v.cambio && v.cambio !== '—';
        texto(s, conCambio ? `${v.cambio} · antes ${v.antes}` : `antes ${v.antes}`, x, y + 148, ancho, { tam: 17, color: ORO_CLARO });
      });
      pie(s, enPie, numero);
      s.addNotes(`${antes}.`);
      continue;
    }
    const area = porClave[c.clave]!;
    cabecera(s, `Capítulo ${c.numeral}`, c.titulo, c.numeral);
    CUERPOS[c.clave]({ s, area, crudos, periodo, hoy });
    pie(s, enPie, numero);
    const notas = [enTexto(entradilla(c.clave, crudos, periodo, hoy))];
    if (c.clave === 'inventario' && textos.notaPatrimonio?.trim()) notas.push(textos.notaPatrimonio.trim());
    s.addNotes(notas.join('\n\n'));
  }

  // Epílogo y cierre.
  {
    const s = nueva();
    const frase = fraseDestacada(textos.epilogo);
    const x = 160;
    escudo(s, marcaDeEscudo, (ANCHO - 84) / 2, 70, 84, 102);
    texto(s, 'EPÍLOGO', x, 196, ANCHO - 2 * x, { tam: 14, letra: 'fuerte', color: ORO_CLARO, espaciado: 5, alinear: 'center' });
    texto(s, frase ?? FALTA_EPILOGO, x, 230, ANCHO - 2 * x, { tam: frase ? 32 : 26, letra: 'titulo', cursiva: true, color: frase ? CREMA : GRIS_CLARO, alinear: 'center', alto: 170, vertical: 'middle', interlineado: 1.2 });
    filetesConRombo(s, ANCHO / 2, 430);
    const firmas = [
      { cargo: 'El Secretario', nombre: textos.firmaEpilogo },
      { cargo: 'Vº Bº El Hermano Mayor', nombre: textos.firmaPresentacion },
    ];
    firmas.forEach((f, i) => {
      const xx = ANCHO / 2 + (i === 0 ? -420 : 60);
      texto(s, f.cargo, xx, 466, 360, { tam: 24, letra: 'titulo', color: ORO_CLARO, alinear: 'center', alto: 34 });
      texto(s, f.nombre?.trim() ?? '', xx, 504, 360, { tam: 19, color: GRIS_CLARO, alinear: 'center', alto: 28 });
    });
    franja(s, titulo, textos.lugarFecha?.trim() ?? '');
    s.addNotes(textos.epilogo?.trim() || FALTA_EPILOGO);
  }

  return (await pres.write({ outputType: 'nodebuffer' })) as Buffer;
}
