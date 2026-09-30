import type { Area, ClaveArea, Cifra, Color, DatosCrudos, Grafica } from '../../domain/datos-areas.js';
import { enMadrid, euros, fechaLarga, numero, valorEscrito, vistazo } from '../../domain/datos-areas.js';
import { entradilla as entradillaDe } from '../../domain/entradillas.js';
import type { Periodo } from '../../domain/periodo-datos.js';
import { diaMadrid } from '../../domain/contabilidad.js';
import {
  A4, ALTO_BARRA, ANCHO_UTIL, BURDEOS, BURDEOS_VIVO, CREMA, FIN, GRIS, HUECO_COLUMNAS, IMAGENES, LETRA, MARFIL, MX, NEGRO, ORO, ORO_CLARO, ORO_PALIDO,
  Paginas, aBuffer, bandaCapitulo, colorDePapel, bandaInforme, entradilla, fila, grafica, hueco, leyenda, marcaBorrador, marcaHecho,
  nuevoDocumento, parrafos, pies, rombo, rotulo, rotuloVersalitas, sinMargenes, tarjetas, tituloDeBloque, vacio,
  altoDeVacio, type Doc, type Tarjeta,
} from './pdf.js';

const PIE_DE_CIFRAS = 'Cifras de conjunto de los registros del Grupo: ninguna página nombra a un hermano.';

/** Lo que necesita el cuerpo de un área para escribirse, en el Informe anual o suelto. */
interface Contexto {
  p: Paginas;
  area: Area;
  crudos: DatosCrudos;
  periodo: Periodo;
  hoy: Date;
  /** La nota de patrimonio, que solo va en el Informe anual. */
  notaPatrimonio?: string | null;
}

const tarjetasDe = (cifras: Cifra[]): Tarjeta[] => cifras.map((c) => ({ etiqueta: c.etiqueta, valor: valorEscrito(c), sufijo: c.sufijo, nota: c.nota }));

function comienzo(ctx: Contexto) {
  entradilla(ctx.p, entradillaDe(ctx.area.clave, ctx.crudos, ctx.periodo, ctx.hoy));
  tarjetas(ctx.p, tarjetasDe(ctx.area.cifras));
}

/** Una nota pequeña bajo un bloque. */
function nota(ctx: Contexto, texto: string) {
  const doc = ctx.p.doc;
  doc.font(LETRA.texto).fontSize(9);
  const alto = doc.heightOfString(texto, { width: ANCHO_UTIL });
  const y = ctx.p.sitio(alto);
  doc.fillColor(GRIS).text(texto, MX, y, { width: ANCHO_UTIL });
  doc.x = MX;
  doc.y = y + alto + 16;
}

// ---------------------------------------------------------------- los cuerpos de cada área

function hermanos(ctx: Contexto) {
  const [activos, altas, bajas, edad] = ctx.area.cifras;
  comienzo(ctx);
  fila(ctx.p, [[activos.grafica], [altas.grafica]], { altoColumnas: 124 });
  fila(ctx.p, [[edad.grafica], [bajas.grafica]]);
}

/** Ingresos y gastos por partida, lado a lado, con el total y el del periodo anterior. */
function partidas(ctx: Contexto) {
  const { p, crudos: { dinero: d } } = ctx;
  const doc = p.doc;
  const ancho = (ANCHO_UTIL - HUECO_COLUMNAS) / 2;
  const lados = [
    { titulo: 'Ingresos', tipo: 'INGRESO' as const, total: d.ingresos, antes: d.anterior.ingresos, vacio: 'Ningún ingreso apuntado.' },
    { titulo: 'Gastos', tipo: 'GASTO' as const, total: d.gastos, antes: d.anterior.gastos, vacio: 'Ningún gasto apuntado.' },
  ].map((l) => ({ ...l, filas: d.porCategoria.filter((c) => c.tipo === l.tipo && c.importe > 0).sort((a, b) => b.importe - a.importe) }));
  const altoDe = (n: number) => 25 + (n ? n * ALTO_BARRA + 24 : altoDeVacio(doc, 'Ningún ingreso apuntado.', ancho));
  const y = p.sitio(Math.max(...lados.map((l) => altoDe(l.filas.length))));
  lados.forEach((l, i) => {
    const x = MX + i * (ancho + HUECO_COLUMNAS);
    let yy = tituloDeBloque(doc, l.titulo, '', x, y, ancho);
    if (!l.filas.length) {
      vacio(doc, l.vacio, x, yy, ancho);
      return;
    }
    l.filas.forEach((f, j) => {
      if (j % 2 === 0) doc.rect(x, yy, ancho, ALTO_BARRA).fill(MARFIL);
      rotulo(doc, f.categoria, x + 6, yy + 5.5, { tam: 9.5, color: NEGRO, ancho: ancho - 110 });
      rotulo(doc, euros(f.importe), x, yy + 5.5, { tam: 9.5, color: NEGRO, ancho: ancho - 44, alinear: 'right' });
      rotulo(doc, `${Math.round((f.importe / l.total) * 100)} %`, x, yy + 5.5, { tam: 9, color: GRIS, ancho: ancho - 6, alinear: 'right' });
      yy += ALTO_BARRA;
    });
    doc.rect(x, yy, ancho, 1.5).fill(NEGRO);
    rotulo(doc, 'Total', x + 6, yy + 7, { letra: LETRA.textoFuerte, tam: 9.5, color: NEGRO });
    rotulo(doc, euros(l.total), x, yy + 7, { letra: LETRA.textoFuerte, tam: 9.5, color: NEGRO, ancho: ancho - 44, alinear: 'right' });
    rotulo(doc, `antes ${euros(l.antes)}`, x + ancho * 0.28, yy + 7.5, { tam: 8.5, color: GRIS, ancho: ancho * 0.36 });
  });
  doc.x = MX;
  doc.y = y + Math.max(...lados.map((l) => altoDe(l.filas.length))) + 22;
}

function dinero(ctx: Contexto) {
  const [resultado, , , porCobrar] = ctx.area.cifras;
  comienzo(ctx);
  partidas(ctx);
  fila(ctx.p, [[resultado.grafica], [porCobrar.grafica]], { altoColumnas: 124 });
  if (ctx.periodo.comparaHasta) {
    nota(ctx, `«Antes» es ${ctx.periodo.anio - 1} hasta el ${fechaLarga(ctx.periodo.comparaHasta).replace(/ de \d{4}$/, '')}: el mismo tramo del año, para comparar lo mismo.`);
  }
}

function procesion(ctx: Contexto) {
  const [cortejo, anioAnio, rosario, porCobrar] = ctx.area.cifras;
  comienzo(ctx);
  fila(ctx.p, [[anioAnio.grafica], [cortejo.grafica, rosario.grafica]], { altoColumnas: 150 });
  grafica(ctx.p, porCobrar.grafica);
}

/** Los enseres pieza a pieza: barra por estados y las cuentas en columnas. Se parte si no cabe. */
function enseres(ctx: Contexto, g: Grafica) {
  const { p, crudos: { inventario: inv } } = ctx;
  const doc = p.doc;
  if (g.vacio || !inv.enseres.length) {
    grafica(p, g);
    return;
  }
  const cols = [{ t: 'Piezas', w: 44 }, { t: 'Óptimo', w: 46 }, { t: 'Bueno', w: 44 }, { t: 'A reparar', w: 56 }];
  const anchoCols = cols.reduce((s, c) => s + c.w, 0);
  const etiqueta = 150;
  const zona = ANCHO_UTIL - etiqueta - anchoCols - 18;
  const max = Math.max(1, ...inv.enseres.map((e) => e.total));
  const cabecera = () => {
    let x = MX + ANCHO_UTIL - anchoCols;
    for (const c of cols) {
      rotulo(doc, c.t, x, doc.y, { tam: 8.5, color: GRIS, ancho: c.w - 6, alinear: 'right' });
      x += c.w;
    }
    rotulo(doc, 'Enser', MX + 6, doc.y, { tam: 8.5, color: GRIS });
    doc.y += 15;
  };
  let y = tituloDeBloque(doc, g.titulo, ctx.area.alcance ? 'el inventario, a día de hoy' : g.resumen, MX, p.sitio(25 + 16 + 15 + ALTO_BARRA * 3), ANCHO_UTIL);
  doc.y = leyenda(doc, [{ texto: 'óptimo', color: NEGRO }, { texto: 'bueno', color: ORO }, { texto: 'a reparar', color: BURDEOS_VIVO }], MX, y);
  cabecera();
  inv.enseres.forEach((e, i) => {
    if (doc.y + ALTO_BARRA > FIN) {
      doc.addPage();
      cabecera();
    }
    y = doc.y;
    if (i % 2 === 0) doc.rect(MX, y, ANCHO_UTIL, ALTO_BARRA).fill(MARFIL);
    rotulo(doc, e.nombre, MX + 6, y + 5.5, { tam: 9.5, color: NEGRO, ancho: etiqueta - 10 });
    let xx = MX + etiqueta;
    for (const [v, c] of [[e.optimo, NEGRO], [e.bueno, ORO], [e.reparar, BURDEOS_VIVO]] as const) {
      if (!v) continue;
      const w = (zona * v) / max;
      doc.rect(xx, y + 6, Math.max(w - 0.75, 0.75), 7.5).fill(c);
      xx += w;
    }
    let x = MX + ANCHO_UTIL - anchoCols;
    for (const [j, v] of [e.total, e.optimo, e.bueno, e.reparar].entries()) {
      const rojo = j === 3 && v > 0;
      rotulo(doc, v ? numero(v) : '—', x, y + 5.5, { tam: 9.5, color: j === 0 || rojo ? NEGRO : GRIS, letra: rojo ? LETRA.textoFuerte : LETRA.texto, ancho: cols[j].w - 6, alinear: 'right' });
      if (rojo) rotulo(doc, numero(v), x, y + 5.5, { tam: 9.5, color: BURDEOS, letra: LETRA.textoFuerte, ancho: cols[j].w - 6, alinear: 'right' });
      x += cols[j].w;
    }
    doc.y = y + ALTO_BARRA;
  });
  const suma = (k: 'total' | 'optimo' | 'bueno' | 'reparar') => inv.enseres.reduce((s, e) => s + e[k], 0);
  y = p.sitio(22);
  doc.rect(MX, y, ANCHO_UTIL, 1.5).fill(NEGRO);
  rotulo(doc, 'Total', MX + 6, y + 7, { letra: LETRA.textoFuerte, tam: 9.5, color: NEGRO });
  let x = MX + ANCHO_UTIL - anchoCols;
  for (const [j, k] of (['total', 'optimo', 'bueno', 'reparar'] as const).entries()) {
    rotulo(doc, numero(suma(k)), x, y + 7, { letra: LETRA.textoFuerte, tam: 9.5, color: j === 3 && suma(k) ? BURDEOS : NEGRO, ancho: cols[j].w - 6, alinear: 'right' });
    x += cols[j].w;
  }
  doc.x = MX;
  doc.y = y + 22 + 22;
}

/** Túnicas y capirotes en una línea cada uno: «Disponibles, 72 · prestadas, 5 · en el taller, 3». */
function ropa(ctx: Contexto, cifras: Cifra[]) {
  const { p } = ctx;
  const doc = p.doc;
  const ancho = (ANCHO_UTIL - HUECO_COLUMNAS) / 2;
  const lineas = cifras.map((c) => {
    const cuerpo = c.grafica.cuerpo;
    const partes = cuerpo.tipo === 'barras' ? cuerpo.filas.map((f) => ({ t: f.etiqueta, v: f.valores.reduce((s, v) => s + v, 0) })).filter((x) => x.v > 0) : [];
    const texto = partes.map((x, i) => `${i ? x.t.toLowerCase() : x.t}, ${numero(x.v)}`).join(' · ');
    return { titulo: c.etiqueta, resumen: c.grafica.resumen, texto: texto ? `${texto}.` : '', vacio: c.grafica.vacio };
  });
  doc.font(LETRA.texto).fontSize(9.5);
  const alto = 25 + Math.max(...lineas.map((l) => (l.vacio ? altoDeVacio(doc, l.vacio, ancho) : doc.heightOfString(l.texto, { width: ancho, lineGap: 3 }))));
  const y = p.sitio(alto);
  lineas.forEach((l, i) => {
    const x = MX + i * (ancho + HUECO_COLUMNAS);
    const yy = tituloDeBloque(doc, l.titulo, l.resumen, x, y, ancho);
    if (l.vacio) vacio(doc, l.vacio, x, yy, ancho);
    else doc.font(LETRA.texto).fontSize(9.5).fillColor(NEGRO).text(l.texto, x, yy, { width: ancho, lineGap: 3 });
  });
  doc.x = MX;
  doc.y = y + alto + 22;
}

function inventario(ctx: Contexto) {
  const [piezas, , tunicas, capirotes] = ctx.area.cifras;
  entradilla(ctx.p, entradillaDe('inventario', ctx.crudos, ctx.periodo, ctx.hoy));
  if (ctx.notaPatrimonio?.trim()) {
    parrafos(ctx.p, ctx.notaPatrimonio, { tam: 11.5 });
    ctx.p.y += 6;
  }
  tarjetas(ctx.p, tarjetasDe(ctx.area.cifras));
  enseres(ctx, piezas.grafica);
  ropa(ctx, [tunicas, capirotes]);
}

function web(ctx: Contexto) {
  const [noticias, publicaciones, cambios, boletin] = ctx.area.cifras;
  comienzo(ctx);
  const n = noticias.grafica.cuerpo, pb = publicaciones.grafica.cuerpo;
  const juntas: Grafica = {
    titulo: 'Noticias y publicaciones, mes a mes',
    resumen: `${numero(noticias.valor)} noticias · ${numero(publicaciones.valor)} publicaciones`,
    leyenda: [{ texto: 'noticias', color: 'oro' }, { texto: 'publicaciones', color: 'azul' }],
    pie: noticias.grafica.pie,
    vacio: noticias.valor + publicaciones.valor === 0 ? 'Ni noticias ni publicaciones todavía.' : undefined,
    cuerpo: n.tipo === 'columnas' && pb.tipo === 'columnas' ? { ...n, series: [...n.series, ...pb.series] } : n,
  };
  grafica(ctx.p, juntas, { altoColumnas: 124 });
  fila(ctx.p, [[cambios.grafica], [boletin.grafica]], { altoColumnas: 110 });
}

const TIPOS_ACTO: Record<string, string> = {
  CULTO: 'culto', PROCESION: 'salida', ENSAYO: 'ensayo', REUNION: 'reunión', FORMACION: 'formación', SOCIAL: 'convivencia', OTRO: 'otro',
};
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const ALTO_ACTO = 18;

/** El calendario del periodo agrupado por meses: una línea por acto. */
function calendario(ctx: Contexto) {
  const { p, crudos: { agenda }, hoy } = ctx;
  const doc = p.doc;
  if (!agenda.actos.length) return;
  const ahora = hoy.toISOString();
  const actos = [...agenda.actos].sort((a, b) => a.startDate.localeCompare(b.startDate)).map((a) => ({ ...a, ...enMadrid(a.startDate) }));
  const celebrados = actos.filter((a) => a.startDate < ahora).length;
  const hechos = celebrados === 1 ? '1 celebrado' : `${numero(celebrados)} celebrados`;
  let y = tituloDeBloque(doc, 'El calendario', `${numero(actos.length)} actos${celebrados ? ` · ${hechos}` : ''}`, MX, p.sitio(25 + 20 + ALTO_ACTO * 2), ANCHO_UTIL);
  doc.y = y;
  let mes = '', par = 0;
  for (const a of actos) {
    if (a.dia.slice(0, 7) !== mes) {
      mes = a.dia.slice(0, 7);
      par = 0;
      y = p.sitio(20 + ALTO_ACTO);
      rotuloVersalitas(doc, `${MESES_LARGOS[Number(mes.slice(5, 7)) - 1]} de ${mes.slice(0, 4)}`, MX, y + 4, { tam: 8, color: BURDEOS });
      doc.rect(MX, y + 16, ANCHO_UTIL, 0.75).fill(NEGRO);
      doc.y = y + 18;
    }
    y = p.sitio(ALTO_ACTO);
    if (par++ % 2 === 0) doc.rect(MX, y, ANCHO_UTIL, ALTO_ACTO).fill(MARFIL);
    const fecha = new Date(`${a.dia}T12:00:00Z`);
    rotulo(doc, String(fecha.getUTCDate()), MX + 6, y + 2.4, { letra: LETRA.titulo, tam: 14, color: NEGRO });
    const hora = a.hora === '00:00' ? '' : ` · ${a.hora}`;
    rotulo(doc, `${DIAS[fecha.getUTCDay()]}${hora}`, MX + 30, y + 4.8, { tam: 9, color: GRIS, ancho: 78 });
    const xTitulo = MX + 112, anchoTitulo = ANCHO_UTIL - 112 - 100;
    rotulo(doc, a.title, xTitulo, y + 4.8, { letra: LETRA.textoMedio, tam: 9.5, color: NEGRO, ancho: anchoTitulo });
    const usado = Math.min(anchoTitulo, doc.widthOfString(a.title));
    if (a.location && usado < anchoTitulo - 30) rotulo(doc, ` · ${a.location}`, xTitulo + usado, y + 4.8, { tam: 9, color: GRIS, ancho: anchoTitulo - usado });
    const tipo = TIPOS_ACTO[a.type] ?? 'otro';
    doc.font(LETRA.texto).fontSize(9);
    const xTipo = MX + ANCHO_UTIL - 18 - doc.widthOfString(tipo);
    doc.rect(xTipo - 12, y + 5.8, 6.5, 6.5).fill(colorDePapel(`tipo:${a.type}` as Color, true));
    rotulo(doc, tipo, xTipo, y + 4.8, { tam: 9, color: NEGRO });
    if (a.startDate < ahora) marcaHecho(doc, MX + ANCHO_UTIL - 13, y + 5.8);
    doc.y = y + ALTO_ACTO;
  }
  doc.x = MX;
  doc.y += 22;
}

function agenda(ctx: Contexto) {
  const [actos] = ctx.area.cifras;
  comienzo(ctx);
  grafica(ctx.p, actos.grafica, { altoColumnas: 84 });
  calendario(ctx);
}

const CUERPOS: Record<ClaveArea, (ctx: Contexto) => void> = { hermanos, dinero, procesion, inventario, web, agenda };

// ---------------------------------------------------------------- el informe suelto

/** El informe de una pestaña: membrete negro, la entradilla, las cifras y sus gráficas. */
export async function informeDeArea(area: Area, periodo: Periodo, crudos: DatosCrudos, hoy = new Date()): Promise<Buffer> {
  const doc = nuevoDocumento(`${area.informe} · ${periodo.etiqueta}`);
  const p = new Paginas(doc, `${area.informe} · ${periodo.etiqueta}`);
  p.seccion = area.nombre;
  const aDia = `a ${fechaLarga(diaMadrid(hoy))}`;
  const derecha = area.clave === 'inventario'
    ? ['Inventario', aDia]
    : [`Año ${periodo.anio}`, periodo.enMarcha ? aDia : 'del 1 de enero al 31 de diciembre'];
  bandaInforme(doc, area.informe, derecha);
  CUERPOS[area.clave]({ p, area, crudos, periodo, hoy });
  pies(doc, PIE_DE_CIFRAS);
  return aBuffer(doc);
}

// ---------------------------------------------------------------- el Informe anual

export interface TextosInforme {
  presentacion: string | null;
  firmaPresentacion: string | null;
  lugarFecha: string | null;
  epilogo: string | null;
  firmaEpilogo: string | null;
  notaPatrimonio: string | null;
  fechaCabildo: string | null;
}

interface Capitulo { numero: string; titulo: string; descripcion: string; pagina?: number }

/** La portada: negro, el escudo en oro, «Informe anual» con el nombre del Grupo, el año grande y una franja burdeos. */
function portada(doc: Doc, periodo: Periodo, textos: TextosInforme) {
  sinMargenes(doc, () => {
    const cx = A4.ancho / 2;
    doc.rect(0, 0, A4.ancho, A4.alto).fill(NEGRO);
    doc.image(IMAGENES.escudoOro, cx - 46, 72, { height: 112 });
    const centro = (t: string, y: number, o: Parameters<typeof rotulo>[4]) => rotulo(doc, t, 0, y, { ancho: A4.ancho, alinear: 'center', ...o });
    centro('INFORME ANUAL', 222, { letra: LETRA.textoFuerte, tam: 9, color: ORO_CLARO, espaciado: 4 });
    centro('del Grupo Parroquial', 250, { letra: LETRA.cursiva, tam: 15, color: ORO_CLARO });
    centro('Nuestra Señora de los Desamparados', 270, { letra: LETRA.titulo, tam: 24, color: CREMA });
    // Dos filetes de oro y el rombo burdeos entre el nombre y el año.
    const yRaya = 328;
    doc.rect(cx - 104, yRaya, 90, 0.75).fill(ORO);
    doc.rect(cx + 14, yRaya, 90, 0.75).fill(ORO);
    rombo(doc, cx, yRaya + 0.4, 4.5, BURDEOS, ORO);
    centro(String(periodo.anio), 352, { letra: LETRA.fina, tam: 150, color: CREMA });
    centro(`Del 1 de enero al 31 de diciembre de ${periodo.anio}`, 548, { letra: LETRA.cursiva, tam: 13.5, color: CREMA, opacidad: 0.75 });

    const alto = 96;
    const yPie = A4.alto - alto;
    doc.rect(0, yPie, A4.ancho, alto).fill(BURDEOS);
    doc.rect(0, yPie, A4.ancho, 0.75).fill(ORO);
    const x = 54;
    rotuloVersalitas(doc, 'Málaga', x, yPie + 42, { tam: 8.5, color: ORO_CLARO, espaciado: 2.6 });
    const cabildo = textos.fechaCabildo?.trim();
    if (cabildo) {
      ['Presentado al Cabildo General de hermanos', `el ${cabildo}`].forEach((l, i) =>
        rotulo(doc, l, x, yPie + 36 + i * 13, { tam: 9, color: CREMA, opacidad: 0.8, ancho: A4.ancho - 2 * x, alinear: 'right' }));
    }
  });
}

function indice(doc: Doc, capitulos: Capitulo[], hoy: Date) {
  let y = 153;
  const alto = 42;
  capitulos.forEach((c, i) => {
    if (i % 2 === 0) doc.rect(MX, y, ANCHO_UTIL, alto).fill(MARFIL);
    rotulo(doc, c.numero || '—', MX + 10, y + 11, { letra: LETRA.titulo, tam: 16, color: BURDEOS });
    rotulo(doc, c.titulo, MX + 50, y + 7, { letra: LETRA.tituloMedio, tam: 15, color: NEGRO, ancho: ANCHO_UTIL - 100 });
    rotulo(doc, c.descripcion, MX + 50, y + 26, { tam: 9, color: GRIS, ancho: ANCHO_UTIL - 100 });
    rotulo(doc, String(c.pagina ?? ''), MX, y + 14, { letra: LETRA.textoFuerte, tam: 11, color: NEGRO, ancho: ANCHO_UTIL - 10, alinear: 'right' });
    y += alto;
  });
  // La nota de privacidad, una sola vez y al pie del índice.
  const texto = `Las cifras salen de los registros del Grupo a ${fechaLarga(diaMadrid(hoy))} y son siempre de conjunto: ninguna página nombra a un hermano.`;
  const yNota = FIN - 44;
  doc.rect(MX, yNota, ANCHO_UTIL, 44).fill(MARFIL);
  doc.rect(MX, yNota, 2.25, 44).fill(BURDEOS);
  doc.font(LETRA.texto).fontSize(9.5).fillColor(GRIS).text(texto, MX + 14, yNota + 10, { width: ANCHO_UTIL - 28, lineGap: 2 });
}

/** Una firma: el cargo, el hueco para firmar, la raya y el nombre. */
function firma(doc: Doc, x: number, y: number, cargo: string, nombre: string | null, previo?: string) {
  const ancho = 172;
  if (previo) rotuloVersalitas(doc, previo, x, y, { tam: 8, color: GRIS, ancho, alinear: 'center' });
  rotulo(doc, cargo, x, y + 13, { letra: LETRA.cursiva, tam: 13.5, color: NEGRO, ancho, alinear: 'center' });
  doc.rect(x, y + 90, ancho, 0.75).fill(NEGRO);
  if (nombre?.trim()) rotulo(doc, `Fdo.: ${nombre.trim()}`, x, y + 96, { tam: 9.5, color: GRIS, ancho, alinear: 'center' });
}
const ALTO_FIRMA = 112;

function lugarYFecha(p: Paginas, texto: string | null) {
  if (!texto?.trim()) return;
  const y = p.sitio(30);
  rotulo(p.doc, texto.trim(), MX, y, { letra: LETRA.titulo, tam: 13.5, color: NEGRO, ancho: ANCHO_UTIL, alinear: 'right' });
  p.y = y + 30;
}

/**
 * El Informe anual del Grupo Parroquial, entero: portada, índice,
 * presentación, el año de un vistazo, los capítulos de cada área y el epílogo.
 * `borrador` avisa en cada página y deja a la vista lo que falta por escribir.
 */
export async function informeAnual(
  periodo: Periodo, areas: Area[], crudos: DatosCrudos, textos: TextosInforme, opciones: { borrador: boolean; hoy?: Date },
): Promise<Buffer> {
  const hoy = opciones.hoy ?? new Date();
  const titulo = `Informe anual ${periodo.anio}`;
  const doc = nuevoDocumento(titulo);
  const p = new Paginas(doc, titulo);
  const porClave = Object.fromEntries(areas.map((a) => [a.clave, a])) as Record<ClaveArea, Area>;

  const capitulos: Capitulo[] = [
    { numero: 'I', titulo: 'Presentación del Hermano Mayor', descripcion: 'Carta a los hermanos.' },
    { numero: 'II', titulo: 'El año de un vistazo', descripcion: 'Las cifras clave, frente al año anterior.' },
    { numero: 'III', titulo: 'Cultos y actos', descripcion: 'Cultos, formación, convivencias y cabildos, mes a mes.' },
    { numero: 'IV', titulo: 'Hermanos', descripcion: 'Censo al cierre, altas y bajas con sus motivos, edades.' },
    { numero: 'V', titulo: 'Sábado de Pasión y Rosario vespertino', descripcion: `Las dos salidas de ${periodo.anio}: papeletas de sitio y el cortejo por puestos.` },
    { numero: 'VI', titulo: 'Cuentas', descripcion: 'Ingresos y gastos por partida, y lo que queda por cobrar.' },
    { numero: 'VII', titulo: 'Patrimonio', descripcion: 'Enseres, túnicas y capirotes; estrenos, restauraciones y donaciones.' },
    { numero: 'VIII', titulo: 'Comunicación', descripcion: 'Noticias, publicaciones y páginas de la web.' },
    { numero: '', titulo: 'Epílogo', descripcion: 'Del Secretario, con el visto bueno del Hermano Mayor.' },
  ];
  const [cPresentacion, cVistazo, cCultos, cHermanos, cProcesion, cCuentas, cPatrimonio, cComunicacion, cEpilogo] = capitulos;

  const abrir = (c: Capitulo) => {
    p.nueva();
    c.pagina = doc.bufferedPageRange().count;
    p.seccion = c.numero ? `${c.numero} · ${c.titulo}` : c.titulo;
    bandaCapitulo(doc, { cabecera: titulo, antetitulo: c.numero ? `Capítulo ${c.numero}` : titulo, titulo: c.titulo, numeral: c.numero || undefined });
  };
  const ctx = (clave: ClaveArea): Contexto => ({ p, area: porClave[clave], crudos, periodo, hoy, notaPatrimonio: textos.notaPatrimonio });

  portada(doc, periodo, textos);
  p.nueva(); // el índice: las filas se escriben al final, cuando se saben las páginas
  bandaCapitulo(doc, { cabecera: titulo, antetitulo: titulo, titulo: 'Índice' });

  abrir(cPresentacion);
  if (textos.presentacion?.trim()) parrafos(p, textos.presentacion);
  else hueco(p, '[Falta la carta del Hermano Mayor: se escribe en «Datos e informes › Informe anual».]');
  p.y += 14;
  lugarYFecha(p, textos.lugarFecha);
  const yFirma = p.sitio(ALTO_FIRMA);
  firma(doc, MX + ANCHO_UTIL - 172, yFirma, 'El Hermano Mayor', textos.firmaPresentacion);

  abrir(cVistazo);
  paginaVistazo(p, periodo, porClave, crudos, hoy);

  abrir(cCultos);
  CUERPOS.agenda(ctx('agenda'));
  abrir(cHermanos);
  CUERPOS.hermanos(ctx('hermanos'));
  abrir(cProcesion);
  CUERPOS.procesion(ctx('procesion'));
  abrir(cCuentas);
  CUERPOS.dinero(ctx('dinero'));
  abrir(cPatrimonio);
  CUERPOS.inventario(ctx('inventario'));
  abrir(cComunicacion);
  CUERPOS.web(ctx('web'));

  abrir(cEpilogo);
  if (textos.epilogo?.trim()) parrafos(p, textos.epilogo);
  else hueco(p, '[Falta el epílogo del Secretario: se escribe en «Datos e informes › Informe anual».]');
  // La fórmula, las dos firmas y el sello, abajo del todo si hay sitio.
  const altoCierre = 28 + (textos.lugarFecha?.trim() ? 30 : 0) + 20 + ALTO_FIRMA + 24 + 78;
  let y = p.sitio(altoCierre);
  y = Math.max(y + 10, FIN - altoCierre);
  rotulo(doc, 'Y para que así conste, se firma el presente Informe anual.', MX, y, { letra: LETRA.titulo, tam: 13.5, color: NEGRO, ancho: ANCHO_UTIL });
  p.y = y + 28;
  lugarYFecha(p, textos.lugarFecha);
  y = p.y + 20;
  firma(doc, MX + 20, y, 'El Secretario', textos.firmaEpilogo);
  firma(doc, MX + ANCHO_UTIL - 172 - 20, y, 'El Hermano Mayor', textos.firmaPresentacion, 'Vº Bº');
  y += ALTO_FIRMA + 24;
  doc.save().circle(A4.ancho / 2, y + 36, 36).dash(2.5, { space: 2.5 }).lineWidth(0.75).strokeColor(ORO).stroke().undash().restore();
  rotulo(doc, 'sello', 0, y + 31, { tam: 9, color: GRIS, ancho: A4.ancho, alinear: 'center' });

  // El índice, ya con los números de página.
  doc.switchToPage(1);
  indice(doc, capitulos, hoy);

  pies(doc, titulo, 1);
  if (opciones.borrador) marcaBorrador(doc);
  return aBuffer(doc);
}

/** II · Ocho cifras frente al año anterior, hermanos y papeletas en cinco años, y el reparto del gasto. */
function paginaVistazo(p: Paginas, periodo: Periodo, areas: Record<ClaveArea, Area>, crudos: DatosCrudos, hoy: Date) {
  const doc = p.doc;
  const antes = periodo.comparaHasta ? `la de ${periodo.anio - 1} a estas alturas` : `la de ${periodo.anio - 1}`;
  entradilla(p, [{ texto: `Ocho cifras para resumir el año, cada una junto a ${antes}.` }]);
  tarjetas(p, vistazo(crudos, hoy).map((c) => ({
    etiqueta: c.etiqueta,
    valor: c.valor,
    nota: /\d/.test(c.cambio) ? `${c.cambio} · antes ${c.antes}` : `antes ${c.antes}`,
  })), { tam: 21 });
  const hermanos = areas.hermanos.cifras[0].grafica;
  const papeletas = areas.procesion.cifras[1].grafica;
  fila(p, [
    [{ ...hermanos, titulo: 'Hermanos, cinco años', pie: undefined }],
    [{ ...papeletas, titulo: 'Papeletas, cinco salidas', pie: undefined }],
  ], { altoColumnas: 124 });

  // Adónde fue cada euro: los cuatro gastos mayores y el resto junto.
  const gastos = crudos.dinero.porCategoria.filter((c) => c.tipo === 'GASTO' && c.importe > 0).sort((a, b) => b.importe - a.importe);
  const total = gastos.reduce((s, g) => s + g.importe, 0);
  if (!total) return;
  const partes = [...gastos.slice(0, 4), ...(gastos.length > 4 ? [{ categoria: 'Otros', importe: gastos.slice(4).reduce((s, g) => s + g.importe, 0) }] : [])];
  const tonos = [NEGRO, BURDEOS_VIVO, ORO, ORO_PALIDO, '#ebe4d6'];
  let y = tituloDeBloque(doc, 'Adónde fue cada euro', `${euros(total)} de gasto`, MX, p.sitio(25 + 14 + 44), ANCHO_UTIL);
  let x = MX;
  partes.forEach((g, i) => {
    const w = (ANCHO_UTIL * g.importe) / total;
    doc.rect(x, y, Math.max(w - 1.5, 1), 13.5).fill(tonos[i]);
    x += w;
  });
  y += 24;
  const col = ANCHO_UTIL / partes.length;
  partes.forEach((g, i) => {
    const xx = MX + i * col;
    doc.rect(xx, y + 1.5, 7, 7).lineWidth(0.5).fillAndStroke(tonos[i], '#d8d0c4');
    rotulo(doc, g.categoria, xx + 11, y, { tam: 9.5, color: NEGRO, ancho: col - 16 });
    rotulo(doc, `${euros(g.importe)} · ${Math.round((g.importe / total) * 100)} %`, xx + 11, y + 13, { tam: 9, color: GRIS, ancho: col - 16 });
  });
  doc.x = MX;
  doc.y = y + 40;
}

