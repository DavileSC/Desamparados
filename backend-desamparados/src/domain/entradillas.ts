import type { ClaveArea, DatosCrudos } from './datos-areas.js';
import { euros, numero, salidaPrincipal } from './datos-areas.js';
import type { Periodo } from './periodo-datos.js';
import { conArticulo, deArticulo, laCorporacion, mayuscula } from './articulos.js';

/**
 * El párrafo con que abre cada capítulo del Informe anual y cada informe: las
 * cifras de ese área contadas en una o dos frases.
 *
 * Solo dice lo que sale de los datos. Nada de «el reparto se abre en
 * Cuaresma» ni del porqué de una cifra: eso lo escriben el Hermano Mayor y el
 * Secretario en sus textos. Y distingue un año en marcha («hasta hoy», «aún
 * no tiene») de uno cerrado («al cierre», «no tuvo»), porque el mismo Informe
 * anual se genera a mitad de año para revisarlo y al cerrarlo para el cabildo.
 */

/** Un trozo de la frase; los `fuerte` van en negrita (la cifra que la sostiene). */
export interface Trozo { texto: string; fuerte?: boolean }

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const decimal = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const contar = (n: number, uno: string, varios: string) => `${numero(n)} ${n === 1 ? uno : varios}`;
const pct = (parte: number, todo: number) => `${Math.round((parte / todo) * 100)} %`;

/** «5 cultos, 2 reuniones y 1 más». */
function enumerar(partes: string[]): string {
  if (partes.length <= 1) return partes.join('');
  return `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
}

/** El mes que se lleva al menos la mitad de algo, si lo hay: «17 de ellas en septiembre». */
function mesQueConcentra(porMes: { mes: string; valor: number }[], total: number): { mes: string; valor: number } | null {
  if (total < 4) return null;
  const mayor = porMes.reduce<{ mes: string; valor: number } | null>((m, x) => (!m || x.valor > m.valor ? x : m), null);
  return mayor && mayor.valor * 2 >= total ? mayor : null;
}

const nombreDelMes = (mes: string) => MESES_LARGOS[Number(mes.slice(5, 7)) - 1];

const comienzo = (p: Periodo) => (p.enMarcha ? 'Hasta hoy' : `Al cierre de ${p.anio}`);

function hermanos(d: DatosCrudos['hermanos'], p: Periodo): Trozo[] {
  const cambio = d.activos - d.activosAlEmpezar;
  const frente = cambio > 0 ? `${numero(cambio)} más que al empezar` : cambio < 0 ? `${numero(-cambio)} menos que al empezar` : 'los mismos que al empezar';
  const trozos: Trozo[] = [
    { texto: `${comienzo(p)}, ${laCorporacion({ corto: true })} cuenta con ` },
    { texto: contar(d.activos, 'hermano', 'hermanos'), fuerte: true },
    { texto: `, ${frente}. ` },
  ];
  if (d.altas + d.bajas === 0) {
    trozos.push({ texto: 'No ha habido altas ni bajas.' });
  } else {
    const pico = mesQueConcentra(d.porMes.map((m) => ({ mes: m.mes, valor: m.bajas })), d.bajas);
    const deEllas = pico ? `, ${numero(pico.valor)} de ellas en ${nombreDelMes(pico.mes)}` : '';
    trozos.push({ texto: `Se han dado ${contar(d.altas, 'alta', 'altas')} y ${contar(d.bajas, 'baja', 'bajas')}${deEllas}.` });
  }
  if (d.edadMedia !== null && d.activos > 0) {
    const menores = d.menores === 1 ? '1 hermano es menor' : `${numero(d.menores)} hermanos son menores`;
    trozos.push({ texto: ` La edad media es de ${decimal.format(d.edadMedia)} años y ${menores} de edad.` });
  }
  return trozos;
}

function dinero(d: DatosCrudos['dinero'], p: Periodo): Trozo[] {
  if (d.ingresos + d.gastos === 0) return [{ texto: `No hay apuntes en ${p.anio}.` }];
  const resultado = d.ingresos - d.gastos;
  const trozos: Trozo[] = [
    { texto: `${comienzo(p)}, las cuentas dejan un ` },
    { texto: `${resultado >= 0 ? 'superávit' : 'déficit'} de ${euros(Math.abs(resultado))}`, fuerte: true },
    { texto: `: han entrado ${euros(d.ingresos)} y han salido ${euros(d.gastos)}.` },
  ];
  const mayor = (tipo: 'INGRESO' | 'GASTO') => d.porCategoria.filter((c) => c.tipo === tipo && c.importe > 0).sort((a, b) => b.importe - a.importe)[0];
  const ingreso = mayor('INGRESO'), gasto = mayor('GASTO');
  if (ingreso) trozos.push({ texto: ` Lo que más aporta: ${ingreso.categoria.toLowerCase()} (${pct(ingreso.importe, d.ingresos)}).` });
  if (gasto) trozos.push({ texto: ` Donde más se gasta: ${gasto.categoria.toLowerCase()} (${pct(gasto.importe, d.gastos)}).` });
  return trozos;
}

function procesion(d: DatosCrudos['procesion'], p: Periodo): Trozo[] {
  const principal = salidaPrincipal(d.porSalida);
  const trozos: Trozo[] = [];
  if (!principal) return [{ texto: 'Todavía no hay salidas procesionales.' }];
  const del = (anio: number) => (anio === d.anio - 1 ? principal.papeletasAnioAnterior : principal.serie?.find((a) => a.anio === anio)?.total ?? 0);
  const anterior = principal.papeletasAnioAnterior;
  const frente = (a: number, b: number) => (b === 0 ? '' : a > b ? `, ${numero(a - b)} más que la anterior` : a < b ? `, ${numero(b - a)} menos que la anterior` : ', las mismas que la anterior');
  if (principal.papeletas > 0) {
    trozos.push({ texto: `La salida ${deArticulo(principal.articulo, principal.nombre)} de ${d.anio} ${p.enMarcha ? 'reúne' : 'reunió'} ` }, { texto: contar(principal.papeletas, 'papeleta de sitio', 'papeletas de sitio'), fuerte: true }, { texto: `${frente(principal.papeletas, anterior)}.` });
  } else {
    trozos.push({ texto: `La salida ${deArticulo(principal.articulo, principal.nombre)} de ${d.anio} ${p.enMarcha ? 'aún no tiene' : 'no tuvo'} papeletas.` });
    if (anterior > 0) trozos.push({ texto: ` La de ${d.anio - 1} reunió ` }, { texto: contar(anterior, 'papeleta de sitio', 'papeletas de sitio'), fuerte: true }, { texto: `${frente(anterior, del(d.anio - 2))}.` });
  }
  for (const s of d.porSalida.filter((x) => x !== principal)) {
    trozos.push({ texto: s.papeletas > 0
      ? ` ${mayuscula(conArticulo(s.articulo, s.nombre))} de ${d.anio} ${p.enMarcha ? 'reúne' : 'reunió'} ${contar(s.papeletas, 'papeleta', 'papeletas')}.`
      : ` ${mayuscula(conArticulo(s.articulo, s.nombre))} de ${d.anio} ${p.enMarcha ? 'aún no tiene' : 'no tuvo'} papeletas.` });
  }
  return trozos;
}

function inventario(d: DatosCrudos['inventario']): Trozo[] {
  const piezas = d.enseres.reduce((s, e) => s + e.total, 0);
  const reparar = d.enseres.reduce((s, e) => s + e.reparar, 0);
  const disponibles = (tipo: 'TUNICA' | 'CAPIROTE') => d.prendas.find((x) => x.tipo === tipo && x.estado === 'DISPONIBLE')?.total ?? 0;
  const trozos: Trozo[] = piezas === 0
    ? [{ texto: 'Todavía no hay enseres en el inventario.' }]
    : [
      { texto: `${mayuscula(laCorporacion({ corto: true }))} guarda ` },
      { texto: contar(piezas, 'pieza', 'piezas'), fuerte: true },
      { texto: ` de ${contar(d.enseres.length, 'enser', 'enseres')}; ${reparar === 0 ? 'ninguna necesita' : reparar === 1 ? 'una necesita' : `${numero(reparar)} necesitan`} reparación.` },
    ];
  const tunicas = disponibles('TUNICA'), capirotes = disponibles('CAPIROTE');
  if (tunicas + capirotes > 0) trozos.push({ texto: ` De la ropa de nazareno hay ${contar(tunicas, 'túnica', 'túnicas')} y ${contar(capirotes, 'capirote', 'capirotes')} disponibles.` });
  return trozos;
}

function web(d: DatosCrudos['web'], p: Periodo): Trozo[] {
  const cuando = p.enMarcha ? 'En lo que va de año' : `En ${p.anio}`;
  const trozos: Trozo[] = [
    { texto: `${cuando}, la web ha publicado ` },
    { texto: contar(d.noticias, 'noticia', 'noticias'), fuerte: true },
    { texto: ` y ${contar(d.publicaciones, 'publicación', 'publicaciones')}` },
  ];
  if (d.cambios > 0) {
    const pico = mesQueConcentra(d.cambiosPorMes.map((m) => ({ mes: m.mes, valor: m.total })), d.cambios);
    const cuandoCambios = pico?.valor === d.cambios ? `, todas en ${nombreDelMes(pico.mes)}` : '';
    trozos.push({ texto: `, y sus páginas se han retocado ${contar(d.cambios, 'vez', 'veces')}${cuandoCambios}` });
  }
  trozos.push({ texto: '.' });
  trozos.push({ texto: d.boletin > 0 && d.activos > 0
    ? ` El boletín llega a ${contar(d.boletin, 'hermano', 'hermanos')}, el ${pct(d.boletin, d.activos)} de los activos.`
    : ' El boletín aún no tiene suscritos.' });
  return trozos;
}

function agenda(d: DatosCrudos['agenda'], p: Periodo, hoy: Date): Trozo[] {
  const de = `de ${p.anio}`;
  if (d.actos.length === 0) return [{ texto: `No hay actos en la Agenda ${de}.` }];
  const cuantos = (...tipos: string[]) => d.actos.filter((a) => tipos.includes(a.type)).length;
  const grupos: [number, string, string][] = [
    [cuantos('CULTO'), 'culto', 'cultos'],
    [cuantos('PROCESION', 'ENSAYO'), 'salida o ensayo', 'salidas y ensayos'],
    [cuantos('REUNION'), 'reunión', 'reuniones'],
    [cuantos('FORMACION', 'SOCIAL'), 'de formación y convivencia', 'de formación y convivencia'],
    [cuantos('OTRO'), 'más', 'más'],
  ];
  const partes = grupos.filter(([n]) => n > 0).map(([n, uno, varios]) => contar(n, uno, varios));
  const trozos: Trozo[] = [
    { texto: `La Agenda ${de} tiene ` },
    { texto: contar(d.actos.length, 'acto', 'actos'), fuerte: true },
    { texto: `: ${enumerar(partes)}.` },
  ];
  if (p.enMarcha) {
    const ahora = hoy.toISOString();
    const hechos = d.actos.filter((a) => a.startDate < ahora).length;
    const quedan = d.actos.length - hechos;
    trozos.push({ texto: hechos === 0 ? ' Aún no se ha celebrado ninguno.' : ` Se ${hechos === 1 ? 'ha celebrado 1' : `han celebrado ${numero(hechos)}`}${quedan ? `; ${quedan === 1 ? 'queda 1' : `quedan ${numero(quedan)}`}` : ''}.` });
  }
  return trozos;
}

export function entradilla(clave: ClaveArea, d: DatosCrudos, p: Periodo, hoy: Date): Trozo[] {
  switch (clave) {
    case 'hermanos': return hermanos(d.hermanos, p);
    case 'dinero': return dinero(d.dinero, p);
    case 'procesion': return procesion(d.procesion, p);
    case 'inventario': return inventario(d.inventario);
    case 'web': return web(d.web, p);
    case 'agenda': return agenda(d.agenda, p, hoy);
  }
}

/** Todo seguido, para las pruebas y para medir lo que ocupa. */
export const enTexto = (trozos: Trozo[]) => trozos.map((t) => t.texto).join('');
