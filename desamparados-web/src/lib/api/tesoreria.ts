import { llamarApi, traerArchivo } from './cliente'
import { paramsPagina, type RespuestaPaginada } from './tipos'

export type AdminReceiptStatus = 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'ANULADO' | 'DEVUELTO' | 'EXENTO' | 'REEMBOLSADO'
export type PaymentMethod = 'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA' | 'DOMICILIACION'
export type ReceiptType = 'PAPELETA_SITIO' | 'CUOTA_HERMANO' | 'DONATIVO' | 'OTRO'
/** Los que se pueden emitir a mano: la papeleta nace en la mesa de reparto, con su sitio. */
export type EmittableReceiptType = Exclude<ReceiptType, 'PAPELETA_SITIO'>

export interface AdminReceipt {
  id: number
  year: number
  concepto: string
  importe: number | string
  fechaEmision: string
  estado: AdminReceiptStatus
  fechaPago: string | null
  metodoPago: PaymentMethod | null
  tipo?: ReceiptType
  hermano: { id: number; nombre: string; apellidos: string; numeroHermano: number | null }
  /** Devuelto y ya reemitido: su recibo nuevo sigue su curso y este no pide nada. */
  reemitido?: boolean
  /**
   * La remesa que lo lleva. Un REMESADO sin ella (de antes de que solo una
   * remesa pusiera ese estado) no va en ningún fichero: puede volver a
   * PENDIENTE, y anularlo no tiene nada que ver con el banco.
   */
  remesaId: number | null
}

/** Lo justo para elegir a quién se le emite un recibo: sin DNI ni datos de contacto. */
export interface ReceiptBrother {
  id: number
  nombre: string
  apellidos: string
  numeroHermano: number | null
}

interface DatosDeRecibo {
  hermanoId: number
  year: number
  concepto: string
  importe: number
  tipo: EmittableReceiptType
  /**
   * El DEVUELTO que este recibo vuelve a cobrar. El servidor lo enlaza con él:
   * así el devuelto deja de contar como deuda y la reemisión hereda su origen
   * (la de un donativo de salida no entra en el 182).
   */
  reemisionDeId?: number
}

/** `true` si el texto es un año de cuatro cifras, que es lo único que acepta el servidor como filtro. */
export const esAnioCompleto = (year: string | undefined): year is string => Boolean(year && /^\d{4}$/.test(year))

/** Búsqueda (hermano, número o concepto), filtros y orden del listado de recibos. Vacío = sin filtrar. */
/** `recibo`: uno concreto por su número, al llegar desde Contabilidad. `hermano`: los de un hermano, por su id. */
export type FiltrosRecibos = { q?: string; estado?: AdminReceiptStatus | ''; tipo?: ReceiptType | ''; orden?: string; recibo?: string; hermano?: string }

export function recibosDelCms(year: string | undefined, pagina: { pagina: number; porPagina: number }, filtros: FiltrosRecibos = {}) {
  // Un año a medio escribir («20») sería un 400: se pide sin filtro de año.
  return llamarApi<RespuestaPaginada<AdminReceipt>>(`/recibos/admin?${paramsPagina(pagina, { ...filtros, year: esAnioCompleto(year) ? year : undefined })}`)
}

/** Recibos y euros de cada estado, con la búsqueda, el año y el tipo del listado pero sin su estado. */
export type ResumenRecibos = {
  estados: Record<AdminReceiptStatus, { cuenta: number; total: number }>
  /** Los devueltos que aún piden algo (sin reemitir ni dar por perdidos). Opcional: un backend anterior no lo manda. */
  devueltosPorResolver?: { cuenta: number; total: number }
}

export function resumenDeRecibos(year: string | undefined, filtros: Pick<FiltrosRecibos, 'q' | 'tipo' | 'recibo'> = {}) {
  return llamarApi<ResumenRecibos>(`/recibos/admin/resumen?${new URLSearchParams(Object.entries({ ...filtros, year: esAnioCompleto(year) ? year : undefined })
    .filter((par): par is [string, string] => Boolean(par[1]))).toString()}`)
}

export function generarCuotas(payload: { year: number; importe: number; concepto: string }) {
  return llamarApi<{ message: string; omitidos?: number }>('/recibos/admin/generar', { method: 'POST', json: payload })
}

/** Las formas de cobrar en mano: lo domiciliado lo cobra el banco, con su remesa. */
export type MetodoEnMano = Exclude<PaymentMethod, 'DOMICILIACION'>

/**
 * Cobra varios recibos de una vez: todos o ninguno. `fecha` (AAAA-MM-DD), el
 * día en que entró el dinero si no es hoy; `nota`, lo que convenga recordar
 * (se lee en la ficha del recibo).
 */
export function cobrarRecibos(payload: { ids: number[]; metodoPago: MetodoEnMano; fecha?: string; nota?: string }) {
  return llamarApi<{ message: string; cobrados: number; total: number }>('/recibos/admin/cobrar', { method: 'POST', json: payload })
}

/** Un cobro reciente, para la entrada de Tesorería. */
export interface CobroReciente {
  id: number
  year: number
  concepto: string
  importe: number
  fechaPago: string
  metodoPago: PaymentMethod | null
  hermano: ReceiptBrother
}

/** La entrada de Tesorería: cómo va el ejercicio y lo que toca hacer. */
export interface PanelTesoreria {
  year: number
  estados: ResumenRecibos['estados']
  /** Lo que se pidió cobrar ese año (sin exentos, anulados ni reembolsados). */
  emitido: { cuenta: number; total: number }
  /** Lo que se debe, por año, de ese y los anteriores (por cobrar y devuelto sin reemitir). */
  antiguedad: { year: number; cuenta: number; total: number }[]
  /** Cómo se cobró lo de ese año, de más a menos. */
  porMetodo: { metodo: PaymentMethod | null; cuenta: number; total: number }[]
  ultimosCobros: CobroReciente[]
  tareas: {
    /** Remesas que el banco ya cargó y que siguen sin darse por cobradas. */
    remesasCargadas: { id: number; fechaCobro: string; enElBanco: number; total: number }[]
    porCobrar: { recibos: number; hermanos: number; total: number }
    impagos: { hermanos: number; total: number }
  }
}

export const panelTesoreria = (year: string) => llamarApi<PanelTesoreria>(`/recibos/admin/panel?${new URLSearchParams({ year }).toString()}`)

/**
 * Da por perdida una papeleta devuelta que no se va a cobrar. Solo el Hermano
 * Mayor (y Administración): queda cerrada con una nota de quién lo decidió.
 */
export const darPorPerdida = (id: number, motivo?: string) =>
  llamarApi<{ message: string; reemisionId: number }>(`/recibos/admin/${id}/perdida`, { method: 'POST', json: motivo ? { motivo } : {} })

/** Una línea del historial de un recibo, de la auditoría. */
export interface LineaHistorial {
  id: number
  /** RECIBO_COBRAR, RECIBO_ESTADO… */
  accion: string
  fecha: string
  quien: string | null
  /** El estado en que lo dejó, si lo cambió. */
  estado: AdminReceiptStatus | null
  metodoPago: PaymentMethod | null
  nota: string | null
}

export const historialRecibo = (id: number) =>
  llamarApi<{ observaciones: string | null; historial: LineaHistorial[] }>(`/recibos/admin/${id}/historial`)

export function cobrarRecibo(id: number, metodoPago: PaymentMethod) {
  return llamarApi<{ message: string; reciboId: number; estado: AdminReceiptStatus }>(`/recibos/admin/${id}/pagar`, { method: 'POST', json: { metodoPago } })
}

/**
 * Cambia el estado de un recibo (remesar, devolver, reembolsar, anular,
 * eximir). Al devolverlo, `comision` es lo que cobró el banco (se apunta como
 * gasto) y `fechaDevolucion` el día en que lo devolvió (AAAA-MM-DD): los
 * asientos van a ese día, que es el que cuadra con el extracto.
 */
export interface DatosDevolucion { comision?: number; fechaDevolucion?: string }

export function cambiarEstadoRecibo(id: number, payload: { estado: AdminReceiptStatus } & DatosDevolucion) {
  return llamarApi<{ message: string; papeletaAnulada: boolean }>(`/recibos/admin/${id}`, { method: 'PUT', json: payload })
}

export function crearRecibo(payload: DatosDeRecibo) {
  return llamarApi<{ message: string; reciboId: number; estado: AdminReceiptStatus }>('/recibos/admin', { method: 'POST', json: payload })
}

/** Hermanos activos cuyo nombre, apellidos o número coinciden con `q` (dos letras como mínimo). */
export function buscarHermanosConRecibo(q: string) {
  return llamarApi<ReceiptBrother[]>(`/recibos/admin/hermanos?${new URLSearchParams({ q }).toString()}`)
}

/** Una cuota de hermano sin pagar: pendiente o devuelta por el banco. */
export interface CuotaImpagada { id: number; year: number; estado: 'PENDIENTE' | 'DEVUELTO'; importe: number }

/** Un hermano activo que debe cuotas, con lo que debe en total. */
export interface HermanoConImpagos {
  hermano: { id: number; nombre: string; apellidos: string; numeroHermano: number | null }
  cuotas: CuotaImpagada[]
  total: number
}

/**
 * Quién debe cuotas, de quien más debe a quien menos. Sin `incluirAnioActual`
 * la cuota de este año no cuenta: pendiente a mitad de año no es un impago.
 */
export function impagos(filtros: { incluirAnioActual: boolean; minimo: number }, pagina: { pagina: number; porPagina: number }) {
  return llamarApi<RespuestaPaginada<HermanoConImpagos> & { anioActual: number }>(`/recibos/admin/impagos?${paramsPagina(pagina, {
    incluirAnioActual: filtros.incluirAnioActual ? 'true' : undefined,
    minimo: filtros.minimo > 1 ? String(filtros.minimo) : undefined,
  })}`)
}

/** Lo que el banco cobró en línea y no se pudo aplicar a lo que se debía: hay que devolverlo. */
export interface IncidenciaDePago {
  id: number
  pedido: string | null
  fecha: string
  importe: number
  metodo: PaymentMethod
  autorizacion: string | null
  motivo: string | null
  correo: string | null
  /** Qué se pagaba. */
  origen: 'AREA_HERMANOS' | 'TIENDA' | 'APADRINAMIENTO'
  /**
   * Si se puede resolver anulando lo que se pagaba: hoy, un pedido de la
   * tienda que aún existe. Lo decide el servidor, que es quien sabe anularlo.
   */
  anulable: boolean
}

export function incidenciasDePago() {
  return llamarApi<IncidenciaDePago[]>('/recibos/admin/pagos-en-linea/incidencias')
}

/** Con `anular`, antes de darla por resuelta anula lo que se pagaba (hoy, solo un pedido de la tienda). */
export function resolverIncidenciaDePago(id: number, opciones: { anular?: boolean } = {}) {
  return llamarApi<{ message: string }>(`/recibos/admin/pagos-en-linea/incidencias/${id}/resolver`, { method: 'POST', ...(opciones.anular ? { json: { anular: true } } : {}) })
}

// --- Remesas SEPA ---

/** Una remesa ya generada: su fichero se descarga aparte. */
export interface Remesa {
  id: number
  /** El identificador del fichero, el que se ve en la banca en línea. */
  mensajeId: string
  /** AAAA-MM-DD: el día en que el banco carga los adeudos. */
  fechaCobro: string
  numRecibos: number
  total: number
  estado: 'ENVIADA' | 'COBRADA'
  cobradaEl: string | null
  autorNombre: string | null
  createdAt: string
  /** Recibos que siguen remesados, sin cobrar ni devolver. */
  enElBanco: number
}

export interface EstadoRemesas {
  /** El servidor tiene los datos del Grupo como acreedor. */
  configurada: boolean
  /** Qué le falta, si no los tiene. */
  problemas: string[]
  /** El primer día que se puede pedir de cobro (AAAA-MM-DD). */
  fechaCobroMinima: string
  remesas: Remesa[]
}

export type MotivoExclusion = 'SIN_IBAN' | 'IBAN_NO_VALIDO' | 'DE_BAJA' | 'IMPORTE_CERO'

/** Qué entraría en una remesa y qué se queda fuera, con el porqué. */
export interface PreviaRemesa {
  fechaCobro: string
  /** Si el aviso a cada cuenta llegaría con menos antelación de la que pide la norma SEPA. */
  avisoPlazo: string | null
  numRecibos: number
  total: number
  excluidos: {
    reciboId: number
    concepto: string
    importe: number
    hermano: ReceiptBrother
    motivo: MotivoExclusion
    texto: string
  }[]
}

export interface FiltroRemesa { fechaCobro: string; year?: number; tipo?: ReceiptType }

export const estadoRemesas = () => llamarApi<EstadoRemesas>('/recibos/admin/remesas')

export const previaRemesa = (filtro: FiltroRemesa) =>
  llamarApi<PreviaRemesa>('/recibos/admin/remesas/previa', { method: 'POST', json: filtro })

/** `avisados`: las cuentas a las que sale por correo el aviso del cargo. */
export const generarRemesa = (filtro: FiltroRemesa) =>
  llamarApi<Omit<Remesa, 'enElBanco'> & { avisados: number }>('/recibos/admin/remesas', { method: 'POST', json: filtro })

/** El fichero XML de la remesa, para subirlo a la banca en línea. */
export const traerFicheroRemesa = (id: number) => traerArchivo(`/recibos/admin/remesas/${id}/fichero`)

export const cobrarRemesa = (id: number) =>
  llamarApi<{ message: string; cobrados: number; devueltos: number }>(`/recibos/admin/remesas/${id}/cobrar`, { method: 'POST' })

// --- El extracto del banco (Norma 43) ---

/** Lo que haría el extracto: devoluciones y cobros de remesas que reconoce, y lo dudoso. */
export interface PreviaNorma43 {
  /** Si el fichero no se entiende o no cuadra: con alguno, no se aplica. */
  errores: string[]
  cuentas: { cuenta: string; desde: string; hasta: string; movimientos: number }[]
  devoluciones: {
    reciboId: number
    concepto: string
    importe: number
    estado: AdminReceiptStatus
    fecha: string
    hermano: ReceiptBrother
    /** Ya estaba devuelto: subir otra vez el extracto no lo toca. */
    yaAplicado: boolean
  }[]
  cobros: { remesaId: number; mensajeId: string; fechaCobro: string; importe: number; fecha: string; yaAplicado: boolean }[]
  /** Parecen de una remesa, pero no se sabe de qué recibo: a mano. */
  dudosos: { linea: number; fecha: string; signo: 'CARGO' | 'ABONO'; importe: number; texto: string; motivo: string }[]
  /** Movimientos que no son de ninguna remesa. */
  ajenos: number
}

const conFichero = (fichero: File) => {
  const formulario = new FormData()
  formulario.append('fichero', fichero)
  return formulario
}

export const previaNorma43 = (fichero: File) =>
  llamarApi<PreviaNorma43>('/recibos/admin/remesas/norma43/previa', { method: 'POST', formData: conFichero(fichero) })

export const aplicarNorma43 = (fichero: File) =>
  llamarApi<{ message: string; devueltos: number; cobradas: number; omitidos: string[] }>('/recibos/admin/remesas/norma43/aplicar', { method: 'POST', formData: conFichero(fichero) })
