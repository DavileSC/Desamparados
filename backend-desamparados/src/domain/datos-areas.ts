import type { EstadoPrenda, MotivoBaja, TipoEvento, TipoPrenda } from '@prisma/client';
import type { Periodo } from './periodo-datos.js';
import type { Recuento } from './panel-agrupar.js';

/**
 * «Datos e informes», pestaña a pestaña, ya dicho en palabras: cuatro cifras por
 * área y, de cada una, la gráfica que la explica.
 *
 * Todo sale de aquí y en la misma forma para la pantalla del CMS y para los
 * PDF (el informe de cada área y el Informe anual): así los títulos, las
 * notas y los números no pueden decir una cosa en la pantalla y otra en papel.
 *
 * Es puro: recibe las cifras de conjunto (`DatosCrudos`, que junta
 * `datos.service.ts` con count, groupBy y aggregate) y no toca la base de datos.
 */

// ---------------------------------------------------------------- las cifras en crudo

export interface Movimientos { mes: string; altas: number; bajas: number }
export interface PorCobrar { estado: 'PENDIENTE' | 'REMESADO' | 'DEVUELTO'; total: number; importe: number }

/** Las cifras de una salida en el año del periodo. La serie de cinco años, solo en las que llevan ropa. */
export interface CifrasDeSalida {
  slug: string;
  nombre: string;
  conRopa: boolean;
  papeletas: number;
  papeletasAnioAnterior: number;
  porPuesto: Recuento[];
  serie?: { anio: number; total: number }[];
}

/**
 * La salida que encabeza la procesión en los datos: la primera con ropa (la
 * de la Semana Santa, con su serie de años) o, si no hay, la primera.
 */
export function salidaPrincipal(salidas: CifrasDeSalida[]): CifrasDeSalida | null {
  return salidas.find((s) => s.serie) ?? salidas[0] ?? null;
}

export interface DatosCrudos {
  hermanos: {
    /** Al cierre del periodo, o hoy si está en marcha. */
    activos: number;
    /** El día antes de empezar: el cierre del periodo anterior. */
    activosAlEmpezar: number;
    altas: number;
    bajas: number;
    anterior: { altas: number; bajas: number };
    bajasPorMotivo: { motivo: MotivoBaja | null; total: number }[];
    porMes: Movimientos[];
    /** Los activos al cierre de cada uno de los cinco últimos periodos, el último el de ahora. */
    cierres: { etiqueta: string; activos: number }[];
    edadMedia: number | null;
    menores: number;
    porEdad: { tramo: string; total: number }[];
  };
  dinero: {
    ingresos: number;
    gastos: number;
    anterior: { ingresos: number; gastos: number };
    porMes: { mes: string; ingresos: number; gastos: number }[];
    porCategoria: { categoria: string; tipo: 'INGRESO' | 'GASTO'; importe: number }[];
    porCobrar: PorCobrar[];
  };
  procesion: {
    anio: number;
    /** Las salidas activas, por su orden. */
    porSalida: CifrasDeSalida[];
    porCobrar: PorCobrar[];
  };
  inventario: {
    enseres: { nombre: string; optimo: number; bueno: number; reparar: number; total: number }[];
    prendas: { tipo: TipoPrenda; estado: EstadoPrenda; total: number }[];
  };
  web: {
    noticias: number;
    publicaciones: number;
    cambios: number;
    paginasTocadas: number;
    anterior: { noticias: number; publicaciones: number };
    noticiasPorMes: { mes: string; total: number }[];
    publicacionesPorMes: { mes: string; total: number }[];
    cambiosPorMes: { mes: string; total: number }[];
    boletin: number;
    activos: number;
  };
  agenda: {
    /** Los actos del periodo: son públicos, salen en la web. */
    actos: { id: number; title: string; startDate: string; type: TipoEvento; location: string | null }[];
    anterior: number;
  };
}

// ---------------------------------------------------------------- la forma común

/** Colores con nombre: la pantalla los pone en claro o en oscuro y el PDF en tinta de papel. */
export type Color = 'oro' | 'rojo' | 'verde' | 'azul' | 'gris' | `tipo:${TipoEvento}`;
export type Formato = 'numero' | 'euros';

export interface Serie { nombre: string; color: Color; valores: number[] }

export type Cuerpo =
  | { tipo: 'columnas'; etiquetas: string[]; series: Serie[]; formato: Formato; destacar?: number }
  | { tipo: 'apiladas'; etiquetas: string[]; capas: Serie[]; hoy?: number }
  | { tipo: 'barras'; filas: { etiqueta: string; valores: number[]; nota: string }[]; colores: Color[] }
  | { tipo: 'lista'; filas: { dia: string; hora: string | null; titulo: string; lugar: string | null; color: Color; pasado: boolean }[] };

export interface Grafica {
  titulo: string;
  resumen: string;
  leyenda?: { texto: string; color: Color }[];
  pie?: string;
  /** Qué decir si no hay nada que dibujar. Si está, el cuerpo no se pinta. */
  vacio?: string;
  cuerpo: Cuerpo;
}

export interface Cifra {
  etiqueta: string;
  valor: number;
  /** 'diferencia' lleva signo; 'decimal', una cifra decimal. */
  formato: Formato | 'decimal' | 'diferencia' | 'diferencia-euros';
  /** «años», «de 83». */
  sufijo?: string;
  nota: string;
  tono?: 'bueno' | 'malo';
  grafica: Grafica;
}

export type ClaveArea = 'hermanos' | 'dinero' | 'procesion' | 'inventario' | 'web' | 'agenda';

export interface Area {
  clave: ClaveArea;
  nombre: string;
  /** El botón y el título del PDF: «Informe de hermanos». */
  informe: string;
  /** El alcance, si no es el del periodo: «El inventario es el de hoy». */
  alcance?: string;
  cifras: Cifra[];
}

// ---------------------------------------------------------------- en palabras

const formatoNumero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' as never });
const formatoEuros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' as never });
const formatoDecimal = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const numero = (n: number) => formatoNumero.format(n);
export const euros = (n: number) => formatoEuros.format(Math.round(n)).replace(/ /g, ' ');
const conSigno = (texto: string, n: number) => (n > 0 ? `+${texto}` : n < 0 ? `−${texto}` : texto);
export const diferencia = (n: number) => conSigno(numero(Math.abs(n)), n);
export const diferenciaEuros = (n: number) => conSigno(euros(Math.abs(n)), n);

/** Cómo se escribe una cifra, igual en la pantalla y en el PDF. */
export function valorEscrito(c: Pick<Cifra, 'valor' | 'formato'>): string {
  switch (c.formato) {
    case 'euros': return euros(c.valor);
    case 'decimal': return formatoDecimal.format(c.valor);
    case 'diferencia': return diferencia(c.valor);
    case 'diferencia-euros': return diferenciaEuros(c.valor);
    default: return numero(c.valor);
  }
}

const contar = (n: number, uno: string, varios: string) => `${numero(n)} ${n === 1 ? uno : varios}`;
const porciento = (parte: number, todo: number) => (todo > 0 ? `${Math.round((parte / todo) * 100)} %` : '—');

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/**
 * «ene», y con el año en los extremos cuando el periodo pasa de un año a otro
 * («mar 25» … «mar 26»): un curso recorre trece meses y dos marzos.
 */
export function etiquetasDeMeses(meses: string[]): string[] {
  const variosAnios = meses.length > 0 && meses[0].slice(0, 4) !== meses[meses.length - 1].slice(0, 4);
  return meses.map((m, i) => {
    const corto = MESES[Number(m.slice(5, 7)) - 1];
    return variosAnios && (i === 0 || i === meses.length - 1) ? `${corto} ${m.slice(2, 4)}` : corto;
  });
}

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** «28 de marzo de 2026». */
export const fechaLarga = (dia: string) => `${Number(dia.slice(8, 10))} de ${MESES_LARGOS[Number(dia.slice(5, 7)) - 1]} de ${dia.slice(0, 4)}`;

/** El año dentro de una frase: «Ninguna baja en 2026». */
const elPeriodo = (p: Periodo) => String(p.anio);
/**
 * Con qué se compara, dicho: con el año en marcha, el anterior hasta el mismo
 * día («a estas alturas de 2025»); con el año cerrado, el anterior entero.
 */
const delAnterior = (p: Periodo) => (p.comparaHasta ? `a estas alturas de ${p.anio - 1}` : `en ${p.anio - 1}`);

// ---------------------------------------------------------------- las seis áreas

function hermanos(d: DatosCrudos['hermanos'], p: Periodo): Area {
  const crecimiento = d.activos - d.activosAlEmpezar;
  const primero = d.cierres[0];
  const nombresMotivo: Record<string, string> = { VOLUNTARIA: 'Voluntaria', IMPAGO: 'Por impago', FALLECIMIENTO: 'Fallecimiento', OTRO: 'Otro motivo' };
  const motivos = [...d.bajasPorMotivo].sort((a, b) => b.total - a.total);
  const impagos = d.bajasPorMotivo.find((m) => m.motivo === 'IMPAGO')?.total ?? 0;
  const conEdad = d.porEdad.reduce((s, t) => s + t.total, 0);
  return {
    clave: 'hermanos',
    nombre: 'Hermanos',
    informe: 'Informe de hermanos',
    cifras: [
      {
        etiqueta: 'Hermanos activos',
        valor: d.activos,
        formato: 'numero',
        nota: `${diferencia(crecimiento)} en ${elPeriodo(p)}${p.enMarcha ? ', a día de hoy' : ''}`,
        tono: crecimiento >= 0 ? 'bueno' : 'malo',
        grafica: {
          titulo: 'Hermanos al cierre de cada año',
          resumen: primero ? `${diferencia(d.activos - primero.activos)} desde ${primero.etiqueta}` : '',
          pie: p.enMarcha ? 'El último, a día de hoy.' : undefined,
          cuerpo: { tipo: 'columnas', etiquetas: d.cierres.map((c) => c.etiqueta), series: [{ nombre: 'hermanos', color: 'oro', valores: d.cierres.map((c) => c.activos) }], formato: 'numero', destacar: d.cierres.length - 1 },
        },
      },
      {
        etiqueta: 'Altas',
        valor: d.altas,
        formato: 'numero',
        nota: `${numero(d.anterior.altas)} ${delAnterior(p)}`,
        grafica: {
          titulo: 'Altas y bajas, mes a mes',
          resumen: `${contar(d.altas, 'alta', 'altas')}, ${contar(d.bajas, 'baja', 'bajas')}`,
          leyenda: [{ texto: 'altas', color: 'oro' }, { texto: 'bajas', color: 'rojo' }],
          vacio: d.altas + d.bajas === 0 ? `Ni altas ni bajas en ${elPeriodo(p)}.` : undefined,
          cuerpo: {
            tipo: 'columnas', etiquetas: etiquetasDeMeses(d.porMes.map((m) => m.mes)), formato: 'numero',
            series: [{ nombre: 'altas', color: 'oro', valores: d.porMes.map((m) => m.altas) }, { nombre: 'bajas', color: 'rojo', valores: d.porMes.map((m) => m.bajas) }],
          },
        },
      },
      {
        etiqueta: 'Bajas',
        valor: d.bajas,
        formato: 'numero',
        nota: impagos ? `${numero(impagos)} por impago` : `${numero(d.anterior.bajas)} ${delAnterior(p)}`,
        grafica: {
          titulo: 'Por qué se van',
          resumen: contar(d.bajas, 'baja', 'bajas'),
          vacio: d.bajas === 0 ? `Ninguna baja en ${elPeriodo(p)}.` : undefined,
          cuerpo: {
            tipo: 'barras', colores: ['rojo'],
            filas: motivos.map((m) => ({ etiqueta: m.motivo ? nombresMotivo[m.motivo] : 'Sin motivo anotado', valores: [m.total], nota: `${numero(m.total)} · ${porciento(m.total, d.bajas)}` })),
          },
        },
      },
      {
        etiqueta: 'Edad media',
        valor: d.edadMedia ?? 0,
        formato: 'decimal',
        sufijo: 'años',
        nota: `${contar(d.menores, 'menor', 'menores')} de edad`,
        grafica: {
          titulo: 'Por edades',
          resumen: `${contar(conEdad, 'hermano', 'hermanos')}${p.enMarcha ? ', hoy' : `, al ${fechaLarga(p.hasta)}`}`,
          vacio: conEdad === 0 ? 'Todavía no hay hermanos que contar.' : undefined,
          cuerpo: { tipo: 'barras', colores: ['oro'], filas: d.porEdad.map((t) => ({ etiqueta: t.tramo, valores: [t.total], nota: numero(t.total) })) },
        },
      },
    ],
  };
}

const PARTES_COBRO: { estado: PorCobrar['estado']; texto: string; color: Color }[] = [
  { estado: 'PENDIENTE', texto: 'Pendiente', color: 'oro' },
  { estado: 'REMESADO', texto: 'En el banco', color: 'azul' },
  { estado: 'DEVUELTO', texto: 'Devuelto sin reemitir', color: 'rojo' },
];

function graficaPorCobrar(partes: PorCobrar[], titulo: string): Grafica {
  const total = partes.reduce((s, x) => s + x.total, 0);
  const importe = partes.reduce((s, x) => s + x.importe, 0);
  const filas = PARTES_COBRO.map((parte) => {
    const fila = partes.find((x) => x.estado === parte.estado) ?? { total: 0, importe: 0 };
    return { etiqueta: parte.texto, valores: [fila.importe], nota: `${contar(fila.total, 'recibo', 'recibos')} · ${euros(fila.importe)}`, color: parte.color };
  });
  return {
    titulo,
    resumen: `${contar(total, 'recibo', 'recibos')} · ${euros(importe)}`,
    vacio: importe === 0 ? 'No queda nada por cobrar.' : undefined,
    // Una fila por parte, cada una de su color: la barra i lleva el color i.
    cuerpo: { tipo: 'barras', colores: filas.map((f) => f.color), filas: filas.map((f, i) => ({ etiqueta: f.etiqueta, valores: filas.map((_, j) => (i === j ? f.valores[0] : 0)), nota: f.nota })) },
  };
}

const sumaImportes = (partes: PorCobrar[]) => partes.reduce((s, x) => s + x.importe, 0);
const sumaRecibos = (partes: PorCobrar[]) => partes.reduce((s, x) => s + x.total, 0);

function dinero(d: DatosCrudos['dinero'], p: Periodo): Area {
  const resultado = d.ingresos - d.gastos;
  const ingresos = d.porCategoria.filter((c) => c.tipo === 'INGRESO').sort((a, b) => b.importe - a.importe);
  const gastos = d.porCategoria.filter((c) => c.tipo === 'GASTO').sort((a, b) => b.importe - a.importe);
  const mayor = (lista: typeof ingresos, todo: number) => (lista[0] ? `${lista[0].categoria.toLowerCase()}, ${porciento(lista[0].importe, todo)}` : 'sin apuntes');
  const barrasDe = (lista: typeof ingresos, todo: number, color: Color) => ({
    tipo: 'barras' as const, colores: [color],
    filas: lista.map((c) => ({ etiqueta: c.categoria, valores: [c.importe], nota: `${euros(c.importe)} · ${porciento(c.importe, todo)}` })),
  });
  return {
    clave: 'dinero',
    nombre: 'Dinero',
    informe: 'Informe de cuentas',
    cifras: [
      {
        etiqueta: 'Resultado',
        valor: resultado,
        formato: 'diferencia-euros',
        nota: `${resultado >= 0 ? 'superávit' : 'déficit'}; antes, ${diferenciaEuros(d.anterior.ingresos - d.anterior.gastos)}`,
        tono: resultado >= 0 ? 'bueno' : 'malo',
        grafica: {
          titulo: 'Entra y sale, mes a mes',
          resumen: `${euros(d.ingresos)} de ingresos, ${euros(d.gastos)} de gastos`,
          leyenda: [{ texto: 'ingresos', color: 'azul' }, { texto: 'gastos', color: 'rojo' }],
          vacio: d.ingresos + d.gastos === 0 ? `No hay apuntes en ${elPeriodo(p)}.` : undefined,
          cuerpo: {
            tipo: 'columnas', etiquetas: etiquetasDeMeses(d.porMes.map((m) => m.mes)), formato: 'euros',
            series: [{ nombre: 'ingresos', color: 'azul', valores: d.porMes.map((m) => m.ingresos) }, { nombre: 'gastos', color: 'rojo', valores: d.porMes.map((m) => m.gastos) }],
          },
        },
      },
      {
        etiqueta: 'Ingresos',
        valor: d.ingresos,
        formato: 'euros',
        nota: mayor(ingresos, d.ingresos),
        grafica: { titulo: 'De dónde viene el dinero', resumen: `${euros(d.ingresos)} · ${euros(d.anterior.ingresos)} ${delAnterior(p)}`, vacio: ingresos.length === 0 ? 'Ningún ingreso apuntado.' : undefined, cuerpo: barrasDe(ingresos, d.ingresos, 'azul') },
      },
      {
        etiqueta: 'Gastos',
        valor: d.gastos,
        formato: 'euros',
        nota: mayor(gastos, d.gastos),
        grafica: { titulo: 'Adónde va', resumen: `${euros(d.gastos)} · ${euros(d.anterior.gastos)} ${delAnterior(p)}`, vacio: gastos.length === 0 ? 'Ningún gasto apuntado.' : undefined, cuerpo: barrasDe(gastos, d.gastos, 'rojo') },
      },
      {
        etiqueta: 'Por cobrar',
        valor: sumaImportes(d.porCobrar),
        formato: 'euros',
        nota: contar(sumaRecibos(d.porCobrar), 'recibo pendiente', 'recibos pendientes'),
        grafica: graficaPorCobrar(d.porCobrar, 'Lo que queda por cobrar'),
      },
    ],
  };
}

function procesion(d: DatosCrudos['procesion']): Area {
  // Cuatro cifras, como todas las áreas: la salida principal y su año a año,
  // las demás salidas juntas (o la otra, si solo hay una) y lo por cobrar.
  const principal = salidaPrincipal(d.porSalida);
  const otras = d.porSalida.filter((s) => s !== principal);
  const papeletas = principal?.papeletas ?? 0;
  const anterior = principal?.papeletasAnioAnterior ?? 0;
  const serie = principal?.serie ?? [{ anio: d.anio - 1, total: anterior }, { anio: d.anio, total: papeletas }];
  const primero = serie[0];
  const filasPuesto = (lista: Recuento[], todo: number) => lista.map((r) => ({ etiqueta: r.etiqueta, valores: [r.total], nota: `${numero(r.total)} · ${porciento(r.total, todo)}` }));
  const totalOtras = otras.reduce((n, s) => n + s.papeletas, 0);
  const otrasAntes = otras.reduce((n, s) => n + s.papeletasAnioAnterior, 0);
  const sola = otras.length === 1 ? otras[0] : null;
  return {
    clave: 'procesion',
    nombre: 'Procesión',
    informe: 'Informe de la procesión',
    cifras: [
      {
        etiqueta: `Papeletas ${d.anio}`,
        valor: papeletas,
        formato: 'numero',
        nota: papeletas && principal ? `${principal.nombre} de ${d.anio}` : 'aún no hay papeletas',
        grafica: {
          titulo: `El cortejo de ${d.anio}, por puestos`,
          resumen: contar(papeletas, 'papeleta', 'papeletas'),
          vacio: papeletas === 0 ? `Todavía no hay papeletas para la salida de ${d.anio}.` : undefined,
          cuerpo: { tipo: 'barras', colores: ['oro'], filas: filasPuesto(principal?.porPuesto ?? [], papeletas) },
        },
      },
      {
        // Sin reparto todavía, la diferencia sería «−183» y asustaría sin decir
        // nada: se enseñan las del año anterior, que es lo que se tiene.
        ...(papeletas === 0
          ? { etiqueta: `Papeletas ${d.anio - 1}`, valor: anterior, formato: 'numero' as const, nota: `${d.anio}, aún sin reparto` }
          : { etiqueta: 'Año a año', valor: papeletas - anterior, formato: 'diferencia' as const, nota: `sobre las ${numero(anterior)} de ${d.anio - 1}`, tono: papeletas >= anterior ? 'bueno' as const : 'malo' as const }),
        grafica: {
          titulo: 'Papeletas de sitio, año a año',
          resumen: primero ? `${numero(primero.total)} en ${primero.anio}, ${numero(papeletas)} en ${d.anio}` : '',
          vacio: serie.every((a) => a.total === 0) ? 'Todavía no hay papeletas de ningún año.' : undefined,
          cuerpo: { tipo: 'columnas', etiquetas: serie.map((a) => String(a.anio)), series: [{ nombre: 'papeletas', color: 'oro', valores: serie.map((a) => a.total) }], formato: 'numero', destacar: serie.length - 1 },
        },
      },
      sola
        ? {
          etiqueta: `${sola.nombre} ${d.anio}`,
          valor: sola.papeletas,
          formato: 'numero',
          nota: `${numero(sola.papeletasAnioAnterior)} en ${d.anio - 1}`,
          grafica: {
            titulo: `${sola.nombre} de ${d.anio}`,
            resumen: contar(sola.papeletas, 'papeleta', 'papeletas'),
            vacio: sola.papeletas === 0 ? `No hay papeletas del ${sola.nombre} de ${d.anio}.` : undefined,
            cuerpo: { tipo: 'barras', colores: ['azul'], filas: filasPuesto(sola.porPuesto, sola.papeletas) },
          },
        }
        : {
          etiqueta: `Otras salidas ${d.anio}`,
          valor: totalOtras,
          formato: 'numero',
          nota: otras.length ? `${numero(otrasAntes)} en ${d.anio - 1}` : 'no hay más salidas',
          grafica: {
            titulo: `Las otras salidas de ${d.anio}`,
            resumen: contar(totalOtras, 'papeleta', 'papeletas'),
            vacio: totalOtras === 0 ? `No hay papeletas de otras salidas de ${d.anio}.` : undefined,
            cuerpo: { tipo: 'barras', colores: ['azul'], filas: filasPuesto(otras.map((s) => ({ etiqueta: s.nombre, total: s.papeletas })), totalOtras) },
          },
        },
      {
        etiqueta: 'Por cobrar',
        valor: sumaImportes(d.porCobrar),
        formato: 'euros',
        nota: contar(sumaRecibos(d.porCobrar), 'papeleta pendiente', 'papeletas pendientes'),
        grafica: graficaPorCobrar(d.porCobrar, `Papeletas de ${d.anio} por cobrar`),
      },
    ],
  };
}

const ESTADOS_PRENDA: { estado: EstadoPrenda; texto: string; color: Color }[] = [
  { estado: 'DISPONIBLE', texto: 'Disponibles', color: 'verde' },
  // «Prestadas» o «Prestados»: el único estado que concuerda con la prenda.
  { estado: 'PRESTADA', texto: 'Prestad', color: 'oro' },
  { estado: 'LAVADO', texto: 'En el lavado', color: 'azul' },
  { estado: 'TALLER', texto: 'En el taller', color: 'rojo' },
  { estado: 'BAJA', texto: 'De baja', color: 'gris' },
];

function prendas(d: DatosCrudos['inventario'], tipo: TipoPrenda, nombre: string, plural: string, femenino: boolean): Cifra {
  const de = (estado: EstadoPrenda) => d.prendas.find((x) => x.tipo === tipo && x.estado === estado)?.total ?? 0;
  const utiles = ESTADOS_PRENDA.filter((e) => e.estado !== 'BAJA').reduce((s, e) => s + de(e.estado), 0);
  const texto = (e: (typeof ESTADOS_PRENDA)[number]) => (e.estado === 'PRESTADA' ? `${e.texto}${femenino ? 'as' : 'os'}` : e.texto);
  const filas = ESTADOS_PRENDA.map((e, i) => ({ etiqueta: texto(e), valores: ESTADOS_PRENDA.map((_, j) => (i === j ? de(e.estado) : 0)), nota: numero(de(e.estado)) }));
  return {
    etiqueta: nombre,
    valor: de('DISPONIBLE'),
    formato: 'numero',
    sufijo: `de ${numero(utiles)}`,
    nota: `disponibles; ${numero(de('TALLER'))} en el taller`,
    grafica: {
      titulo: `${femenino ? 'Las' : 'Los'} ${plural}, por estado`,
      resumen: `${numero(utiles)} útiles${de('BAJA') ? ` y ${numero(de('BAJA'))} de baja` : ''}`,
      vacio: utiles + de('BAJA') === 0 ? `No hay ${plural} en el ropero.` : undefined,
      cuerpo: { tipo: 'barras', colores: ESTADOS_PRENDA.map((e) => e.color), filas },
    },
  };
}

function inventario(d: DatosCrudos['inventario']): Area {
  const piezas = d.enseres.reduce((s, e) => s + e.total, 0);
  const suma = (k: 'optimo' | 'bueno' | 'reparar') => d.enseres.reduce((s, e) => s + e[k], 0);
  const aReparar = d.enseres.filter((e) => e.reparar > 0).sort((a, b) => b.reparar - a.reparar);
  return {
    clave: 'inventario',
    nombre: 'Inventario',
    informe: 'Informe de patrimonio',
    alcance: 'El inventario es el de hoy: no guarda fechas, así que no cambia con el periodo.',
    cifras: [
      {
        etiqueta: 'Enseres',
        valor: piezas,
        formato: 'numero',
        nota: `piezas de ${contar(d.enseres.length, 'enser', 'enseres')}`,
        grafica: {
          titulo: 'Estado de los enseres',
          resumen: `${numero(suma('optimo'))} óptimos · ${numero(suma('bueno'))} buenos · ${numero(suma('reparar'))} a reparar`,
          leyenda: [{ texto: 'óptimo', color: 'verde' }, { texto: 'bueno', color: 'oro' }, { texto: 'a reparar', color: 'rojo' }],
          vacio: d.enseres.length === 0 ? 'Todavía no hay enseres en el inventario.' : undefined,
          cuerpo: { tipo: 'barras', colores: ['verde', 'oro', 'rojo'], filas: d.enseres.map((e) => ({ etiqueta: e.nombre, valores: [e.optimo, e.bueno, e.reparar], nota: numero(e.total) })) },
        },
      },
      {
        etiqueta: 'Para reparar',
        valor: suma('reparar'),
        formato: 'numero',
        nota: aReparar[0] ? `${numero(aReparar[0].reparar)} de ${aReparar[0].nombre.toLowerCase()}` : 'nada que reparar',
        tono: suma('reparar') > 0 ? 'malo' : undefined,
        grafica: {
          titulo: 'Lo que hay que reparar',
          resumen: `${numero(suma('reparar'))} de ${contar(piezas, 'pieza', 'piezas')}`,
          vacio: aReparar.length === 0 ? 'No hay nada que reparar.' : undefined,
          cuerpo: { tipo: 'barras', colores: ['rojo'], filas: aReparar.map((e) => ({ etiqueta: e.nombre, valores: [e.reparar], nota: `${numero(e.reparar)} de ${numero(e.total)}` })) },
        },
      },
      prendas(d, 'TUNICA', 'Túnicas', 'túnicas', true),
      prendas(d, 'CAPIROTE', 'Capirotes', 'capirotes', false),
    ],
  };
}

function web(d: DatosCrudos['web'], p: Periodo): Area {
  const porMes = (lista: { mes: string; total: number }[], nombre: string, color: Color) => ({
    tipo: 'columnas' as const, etiquetas: etiquetasDeMeses(lista.map((m) => m.mes)), formato: 'numero' as const,
    series: [{ nombre, color, valores: lista.map((m) => m.total) }],
  });
  return {
    clave: 'web',
    nombre: 'Web',
    informe: 'Informe de comunicación',
    cifras: [
      {
        etiqueta: 'Noticias',
        valor: d.noticias,
        formato: 'numero',
        nota: `${numero(d.anterior.noticias)} ${delAnterior(p)}`,
        grafica: {
          titulo: 'Noticias publicadas, mes a mes',
          resumen: contar(d.noticias, 'noticia', 'noticias'),
          pie: 'La web no cuenta visitas: aquí solo lo que se ha publicado.',
          vacio: d.noticias === 0 ? `Ninguna noticia en ${elPeriodo(p)}.` : undefined,
          cuerpo: porMes(d.noticiasPorMes, 'noticias', 'oro'),
        },
      },
      {
        etiqueta: 'Publicaciones',
        valor: d.publicaciones,
        formato: 'numero',
        nota: `${numero(d.anterior.publicaciones)} ${delAnterior(p)}`,
        grafica: {
          titulo: 'Publicaciones, mes a mes',
          resumen: contar(d.publicaciones, 'publicación', 'publicaciones'),
          vacio: d.publicaciones === 0 ? `Ninguna publicación en ${elPeriodo(p)}.` : undefined,
          cuerpo: porMes(d.publicacionesPorMes, 'publicaciones', 'azul'),
        },
      },
      {
        etiqueta: 'Cambios en las páginas',
        valor: d.cambios,
        formato: 'numero',
        nota: `en ${contar(d.paginasTocadas, 'página', 'páginas')}`,
        grafica: {
          titulo: 'Las páginas de la web, retocadas',
          resumen: `${contar(d.cambios, 'versión guardada', 'versiones guardadas')}`,
          vacio: d.cambios === 0 ? `No se ha tocado ninguna página en ${elPeriodo(p)}.` : undefined,
          cuerpo: porMes(d.cambiosPorMes, 'cambios', 'verde'),
        },
      },
      {
        etiqueta: 'Boletín',
        valor: d.boletin,
        formato: 'numero',
        nota: `de ${contar(d.activos, 'hermano activo', 'hermanos activos')}`,
        grafica: {
          titulo: 'Quién recibe el boletín',
          resumen: `${porciento(d.boletin, d.activos)} de los hermanos activos, hoy`,
          vacio: d.activos === 0 ? 'Todavía no hay hermanos activos.' : undefined,
          cuerpo: {
            tipo: 'barras', colores: ['oro', 'gris'],
            filas: [
              { etiqueta: 'Suscritos', valores: [d.boletin, 0], nota: numero(d.boletin) },
              { etiqueta: 'Sin suscribir', valores: [0, d.activos - d.boletin], nota: numero(d.activos - d.boletin) },
            ],
          },
        },
      },
    ],
  };
}

/** Cómo se agrupan los tipos en la gráfica del curso: seis colores se leen, siete no. */
const GRUPOS_AGENDA: { nombre: string; tipos: TipoEvento[]; color: Color }[] = [
  { nombre: 'cultos', tipos: ['CULTO'], color: 'tipo:CULTO' },
  { nombre: 'salida y ensayos', tipos: ['PROCESION', 'ENSAYO'], color: 'tipo:PROCESION' },
  { nombre: 'reuniones', tipos: ['REUNION'], color: 'tipo:REUNION' },
  { nombre: 'formación', tipos: ['FORMACION'], color: 'tipo:FORMACION' },
  { nombre: 'convivencias', tipos: ['SOCIAL'], color: 'tipo:SOCIAL' },
  { nombre: 'otros', tipos: ['OTRO'], color: 'tipo:OTRO' },
];

/** Día y hora de Madrid de un acto. */
export function enMadrid(iso: string): { dia: string; hora: string } {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(iso));
  const v = (t: string) => partes.find((x) => x.type === t)?.value ?? '';
  return { dia: `${v('year')}-${v('month')}-${v('day')}`, hora: `${v('hour') === '24' ? '00' : v('hour')}:${v('minute')}` };
}

function agenda(d: DatosCrudos['agenda'], p: Periodo, hoy: Date): Area {
  const ahora = hoy.toISOString();
  const celebrados = d.actos.filter((a) => a.startDate < ahora).length;
  const meses = p.meses;
  const mesDe = (iso: string) => enMadrid(iso).dia.slice(0, 7);
  const capas = GRUPOS_AGENDA.map((g) => ({
    nombre: g.nombre, color: g.color,
    valores: meses.map((m) => d.actos.filter((a) => g.tipos.includes(a.type) && mesDe(a.startDate) === m).length),
  })).filter((c) => c.valores.some((v) => v > 0));
  const mesHoy = enMadrid(ahora).dia.slice(0, 7);
  const lista = (tipos: TipoEvento[]) => d.actos.filter((a) => tipos.includes(a.type)).map((a) => {
    const { dia, hora } = enMadrid(a.startDate);
    return { dia, hora: hora === '00:00' ? null : hora, titulo: a.title, lugar: a.location, color: `tipo:${a.type}` as Color, pasado: a.startDate < ahora };
  });
  const cifraLista = (etiqueta: string, tipos: TipoEvento[], titulo: string, nota: string): Cifra => {
    const filas = lista(tipos);
    return {
      etiqueta, valor: filas.length, formato: 'numero', nota,
      grafica: { titulo, resumen: `${contar(filas.filter((f) => f.pasado).length, 'celebrado', 'celebrados')}, ${numero(filas.filter((f) => !f.pasado).length)} por venir`, vacio: filas.length === 0 ? `Ninguno en ${elPeriodo(p)}.` : undefined, cuerpo: { tipo: 'lista', filas } },
    };
  };
  return {
    clave: 'agenda',
    nombre: 'Agenda',
    informe: 'Informe de cultos y actos',
    cifras: [
      {
        etiqueta: 'Actos del año',
        valor: d.actos.length,
        formato: 'numero',
        nota: p.enMarcha ? `${contar(celebrados, 'celebrado', 'celebrados')}, ${numero(d.actos.length - celebrados)} por venir` : `${numero(d.anterior)} ${delAnterior(p)}`,
        grafica: {
          titulo: 'Actos, mes a mes',
          resumen: `de enero a diciembre de ${p.anio}`,
          leyenda: capas.map((c) => ({ texto: c.nombre, color: c.color })),
          vacio: d.actos.length === 0 ? `No hay actos en la agenda de ${elPeriodo(p)}.` : undefined,
          cuerpo: { tipo: 'apiladas', etiquetas: etiquetasDeMeses(meses), capas, hoy: p.enMarcha ? meses.indexOf(mesHoy) : undefined },
        },
      },
      cifraLista('Cultos', ['CULTO'], 'Los cultos', 'triduos, besamanos y misas'),
      cifraLista('Reuniones', ['REUNION'], 'Reuniones y cabildos', 'de la junta y cabildos'),
      cifraLista('Formación y convivencia', ['FORMACION', 'SOCIAL'], 'Formación y convivencias', 'catequesis y encuentros'),
    ],
  };
}

export function areasDe(d: DatosCrudos, p: Periodo, hoy: Date): Area[] {
  return [hermanos(d.hermanos, p), dinero(d.dinero, p), procesion(d.procesion), inventario(d.inventario), web(d.web, p), agenda(d.agenda, p, hoy)];
}

// ---------------------------------------------------------------- el Informe anual: el año de un vistazo

export interface CifraVistazo { etiqueta: string; valor: string; antes: string; cambio: string; tono?: 'bueno' | 'malo' }

/**
 * Las ocho cifras de la segunda página del Informe anual, cada una frente a la
 * del año anterior (hasta el mismo día, si este va en marcha).
 */
export function vistazo(d: DatosCrudos, hoy: Date): CifraVistazo[] {
  const ahora = hoy.toISOString();
  const celebrados = d.agenda.actos.filter((a) => a.startDate < ahora).length;
  const principal = salidaPrincipal(d.procesion.porSalida);
  const pct = (a: number, b: number) => (b ? `${a >= b ? '+' : '−'}${Math.round(Math.abs((a - b) / b) * 100)} %` : '—');
  const resultado = d.dinero.ingresos - d.dinero.gastos;
  const resultadoAntes = d.dinero.anterior.ingresos - d.dinero.anterior.gastos;
  const par = (etiqueta: string, a: number, b: number, masEsBueno = true): CifraVistazo => ({
    etiqueta, valor: numero(a), antes: numero(b), cambio: diferencia(a - b), tono: a === b ? undefined : (a > b) === masEsBueno ? 'bueno' : 'malo',
  });
  return [
    par('Hermanos al cierre', d.hermanos.activos, d.hermanos.activosAlEmpezar),
    par('Altas', d.hermanos.altas, d.hermanos.anterior.altas),
    par('Bajas', d.hermanos.bajas, d.hermanos.anterior.bajas, false),
    par('Actos celebrados', celebrados, d.agenda.anterior),
    par('Papeletas de sitio', principal?.papeletas ?? 0, principal?.papeletasAnioAnterior ?? 0),
    { etiqueta: 'Ingresos', valor: euros(d.dinero.ingresos), antes: euros(d.dinero.anterior.ingresos), cambio: pct(d.dinero.ingresos, d.dinero.anterior.ingresos), tono: d.dinero.ingresos >= d.dinero.anterior.ingresos ? 'bueno' : 'malo' },
    { etiqueta: 'Gastos', valor: euros(d.dinero.gastos), antes: euros(d.dinero.anterior.gastos), cambio: pct(d.dinero.gastos, d.dinero.anterior.gastos), tono: d.dinero.gastos <= d.dinero.anterior.gastos ? 'bueno' : 'malo' },
    { etiqueta: 'Resultado', valor: diferenciaEuros(resultado), antes: diferenciaEuros(resultadoAntes), cambio: resultado >= 0 ? 'superávit' : 'déficit', tono: resultado >= 0 ? 'bueno' : 'malo' },
  ];
}
