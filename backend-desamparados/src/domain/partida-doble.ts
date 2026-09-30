/**
 * La contabilidad por partida doble, sacada de los apuntes de siempre.
 *
 * El libro de caja apunta cada ingreso y cada gasto con su categoría y su
 * forma de pago. Eso basta para el asiento: un ingreso es un cargo en la
 * tesorería (570 Caja si fue en efectivo, 572 Bancos si no) y un abono en la
 * cuenta de su categoría; un gasto, al revés. Así no hay un segundo libro que
 * alimentar a mano, y todo lo que apunte en contabilidad (la mesa, las
 * remesas, la lotería, la caja de la tienda) entra en la partida doble solo.
 *
 * Las cuentas son las del plan de contabilidad de las entidades sin fines
 * lucrativos (RD 1491/2011), las que usa un grupo parroquial. Cada categoría
 * tiene la suya: la que Tesorería le asigne o, mientras no lo haga, la que se
 * propone por su nombre.
 */

export interface Cuenta { codigo: string; nombre: string }

/** Las cuentas del plan que puede necesitar el Grupo, por grupos. */
export const PLAN: Cuenta[] = [
  { codigo: '570', nombre: 'Caja, euros' },
  { codigo: '572', nombre: 'Bancos e instituciones de crédito c/c vista, euros' },
  { codigo: '600', nombre: 'Compras de bienes destinados a la actividad' },
  { codigo: '602', nombre: 'Compras de otros aprovisionamientos' },
  { codigo: '621', nombre: 'Arrendamientos y cánones' },
  { codigo: '622', nombre: 'Reparaciones y conservación' },
  { codigo: '623', nombre: 'Servicios de profesionales independientes' },
  { codigo: '624', nombre: 'Transportes' },
  { codigo: '625', nombre: 'Primas de seguros' },
  { codigo: '626', nombre: 'Servicios bancarios y similares' },
  { codigo: '627', nombre: 'Publicidad, propaganda y relaciones públicas' },
  { codigo: '628', nombre: 'Suministros' },
  { codigo: '629', nombre: 'Otros servicios' },
  { codigo: '631', nombre: 'Otros tributos' },
  { codigo: '650', nombre: 'Ayudas monetarias' },
  { codigo: '651', nombre: 'Ayudas no monetarias' },
  { codigo: '653', nombre: 'Compensación de gastos por prestaciones de colaboración' },
  { codigo: '659', nombre: 'Otras pérdidas en gestión corriente' },
  { codigo: '678', nombre: 'Gastos excepcionales' },
  { codigo: '700', nombre: 'Ventas de mercaderías' },
  { codigo: '705', nombre: 'Prestaciones de servicios' },
  { codigo: '720', nombre: 'Cuotas de asociados y afiliados' },
  { codigo: '721', nombre: 'Cuotas de usuarios' },
  { codigo: '722', nombre: 'Promociones para captación de recursos' },
  { codigo: '723', nombre: 'Ingresos de patrocinadores y colaboraciones' },
  { codigo: '740', nombre: 'Subvenciones, donaciones y legados a la actividad' },
  { codigo: '752', nombre: 'Ingresos por arrendamientos' },
  { codigo: '759', nombre: 'Ingresos por servicios diversos' },
  { codigo: '769', nombre: 'Otros ingresos financieros' },
  { codigo: '778', nombre: 'Ingresos excepcionales' },
];

const POR_CODIGO = new Map(PLAN.map((c) => [c.codigo, c]));
export const nombreDeCuenta = (codigo: string) => POR_CODIGO.get(codigo)?.nombre ?? 'Cuenta sin nombre';
export const esCuentaDelPlan = (codigo: string) => POR_CODIGO.has(codigo);

export type Tipo = 'INGRESO' | 'GASTO';

const normalizar = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Por el nombre de la categoría, la primera regla que casa. */
const REGLAS: Record<Tipo, [RegExp, string][]> = {
  INGRESO: [
    [/cuota/, '720'],
    [/papeleta|salida|inscripcion/, '721'],
    [/donativ|donacion|limosna|ofrenda|legado|subvencion|apadrin/, '740'],
    [/loteria|rifa|sorteo|tombola|promocion/, '722'],
    [/patrocin|colabora/, '723'],
    [/venta|tienda|recuerdo|mercader/, '700'],
    [/alquiler|arrendamiento/, '752'],
    [/interes|financier/, '769'],
    [/extraordinari|excepcional/, '778'],
  ],
  GASTO: [
    // Devolver un recibo deshace un ingreso de cuotas: minora la cuenta de cuotas.
    [/devoluci/, '720'],
    [/comision|banc/, '626'],
    [/caridad|ayuda|beneficen|limosna/, '650'],
    [/mantenimiento|reparaci|restaura|conservaci|enser/, '622'],
    [/culto|cera|flor|exorno|liturg/, '602'],
    [/loteria|mercader|tienda|compra/, '600'],
    [/seguro/, '625'],
    [/luz|agua|electric|suministro|telefon/, '628'],
    [/publicidad|imprenta|cartel|propaganda/, '627'],
    [/alquiler|arrendamiento/, '621'],
    [/transporte|autobus|viaje/, '624'],
    [/musica|banda|profesional|honorario/, '623'],
    [/impuesto|tributo|tasa/, '631'],
  ],
};

/** La cuenta que se propone para una categoría que aún no tiene: por su nombre, o la genérica. */
export function cuentaPropuesta(nombre: string, tipo: Tipo): string {
  const n = normalizar(nombre);
  return REGLAS[tipo].find(([re]) => re.test(n))?.[1] ?? (tipo === 'INGRESO' ? '759' : '629');
}

/** Efectivo, a caja; lo demás (transferencia, domiciliación, tarjeta, Bizum) pasa por el banco. */
export const cuentaDeTesoreria = (metodo: string | null) => (metodo === 'EFECTIVO' ? '570' : '572');

export interface ApunteDeCaja {
  id: number;
  fecha: string;
  concepto: string;
  tipo: Tipo;
  /** En céntimos. */
  centimos: number;
  metodoPago: string | null;
  cuentaCategoria: string;
}

export interface Linea { cuenta: string; debe: number; haber: number }
export interface Asiento { numero: number; apunteId: number; fecha: string; concepto: string; lineas: Linea[] }

/**
 * El libro diario: un asiento por apunte, numerados por fecha. Los importes
 * negativos (una corrección) se asientan con el cargo y el abono cambiados.
 */
export function libroDiario(apuntes: ApunteDeCaja[]): Asiento[] {
  return [...apuntes]
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id)
    .map((a, i) => {
      const tesoreria = cuentaDeTesoreria(a.metodoPago);
      const importe = Math.abs(a.centimos);
      const entra = (a.tipo === 'INGRESO') === (a.centimos >= 0);
      const [cargo, abono] = entra ? [tesoreria, a.cuentaCategoria] : [a.cuentaCategoria, tesoreria];
      return {
        numero: i + 1, apunteId: a.id, fecha: a.fecha, concepto: a.concepto,
        lineas: [{ cuenta: cargo, debe: importe, haber: 0 }, { cuenta: abono, debe: 0, haber: importe }],
      };
    });
}

export interface SumaDeCuenta { cuenta: string; nombre: string; debe: number; haber: number; saldo: number }

/** Sumas y saldos: por cuenta, lo cargado, lo abonado y el saldo (deudor en positivo). */
export function sumasYSaldos(asientos: Asiento[]): SumaDeCuenta[] {
  const sumas = new Map<string, { debe: number; haber: number }>();
  for (const l of asientos.flatMap((a) => a.lineas)) {
    const s = sumas.get(l.cuenta) ?? { debe: 0, haber: 0 };
    s.debe += l.debe;
    s.haber += l.haber;
    sumas.set(l.cuenta, s);
  }
  return [...sumas.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cuenta, s]) => ({ cuenta, nombre: nombreDeCuenta(cuenta), debe: s.debe, haber: s.haber, saldo: s.debe - s.haber }));
}

/**
 * La cuenta de resultados: los ingresos (grupo 7, saldo acreedor) menos los
 * gastos (grupo 6, saldo deudor), cuenta a cuenta, y el excedente del ejercicio.
 */
export function cuentaDeResultados(sumas: SumaDeCuenta[]): {
  ingresos: { cuenta: string; nombre: string; importe: number }[];
  gastos: { cuenta: string; nombre: string; importe: number }[];
  totalIngresos: number;
  totalGastos: number;
  excedente: number;
} {
  const ingresos = sumas.filter((s) => s.cuenta.startsWith('7')).map((s) => ({ cuenta: s.cuenta, nombre: s.nombre, importe: -s.saldo }));
  const gastos = sumas.filter((s) => s.cuenta.startsWith('6')).map((s) => ({ cuenta: s.cuenta, nombre: s.nombre, importe: s.saldo }));
  const totalIngresos = ingresos.reduce((t, x) => t + x.importe, 0);
  const totalGastos = gastos.reduce((t, x) => t + x.importe, 0);
  return { ingresos, gastos, totalIngresos, totalGastos, excedente: totalIngresos - totalGastos };
}
