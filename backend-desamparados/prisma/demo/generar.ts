// prisma/demo/generar.ts
//
// Decide los datos de la siembra de demostración. Todo lo de aquí es puro: no
// toca la base de datos, no lee la hora salvo por el parámetro `hoy`, y con la
// misma entrada devuelve siempre exactamente lo mismo. Quien escribe en MariaDB
// es `prisma/seed-demo.ts`, que se limita a volcar esto.
//
// Que sea determinista no es un capricho: si cada `npm run seed` cambiara las
// cifras, no habría forma de comparar el panel de ayer con el de hoy ni de
// escribir un test sobre lo sembrado.
//
// TODO son personas inventadas. Los correos usan `ejemplo.invalido`, un dominio
// reservado por la RFC 2606 que nunca existirá: aunque alguien sembrara esto
// donde no debe y el sistema intentara escribir a estos hermanos, no saldría un
// solo correo hacia nadie real.

/** Los cinco ejercicios que cubre la demostración, el más antiguo primero. */
export const EJERCICIOS_DEMO = (anio: number): number[] => [anio - 4, anio - 3, anio - 2, anio - 1, anio];

/**
 * Generador con semilla (mulberry32). Node no trae ninguno determinista y
 * `Math.random()` no lo es, que es justo lo que aquí no vale.
 */
function generadorAleatorio(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semillas distintas por bloque, para que añadir hermanos no mueva los recibos. */
export const SEMILLAS = { hermanos: 20260829, recibos: 8112, dinero: 4477, procesion: 9013, reparto: 2211 };

const NOMBRES_HOMBRE = [
  'Antonio', 'Manuel', 'José', 'Francisco', 'David', 'Juan', 'Javier', 'Daniel', 'Rafael', 'Miguel',
  'Carlos', 'Alejandro', 'Pablo', 'Sergio', 'Jesús', 'Álvaro', 'Fernando', 'Luis', 'Andrés', 'Ignacio',
];
const NOMBRES_MUJER = [
  'María', 'Carmen', 'Ana', 'Isabel', 'Lucía', 'Rocío', 'Marta', 'Laura', 'Cristina', 'Elena',
  'Paula', 'Sara', 'Beatriz', 'Pilar', 'Inmaculada', 'Reyes', 'Encarnación', 'Nuria', 'Silvia', 'Julia',
];
const APELLIDOS = [
  'García', 'Fernández', 'González', 'Rodríguez', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín',
  'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Gutiérrez', 'Navarro',
  'Torres', 'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Ramírez', 'Serrano', 'Blanco', 'Molina', 'Morales',
  'Ortega', 'Delgado', 'Castro', 'Ortiz', 'Rubio', 'Marín', 'Sanz', 'Núñez', 'Iglesias', 'Medina',
];
const POBLACIONES = [
  { nombre: 'Málaga', cp: '29010' },
  { nombre: 'Málaga', cp: '29013' },
  { nombre: 'Málaga', cp: '29018' },
  { nombre: 'Rincón de la Victoria', cp: '29730' },
  { nombre: 'Torremolinos', cp: '29620' },
  { nombre: 'Alhaurín de la Torre', cp: '29130' },
];
const CALLES = ['Calle Victoria', 'Calle Alcazabilla', 'Avenida de Andalucía', 'Calle Carretería', 'Calle Mármoles', 'Calle Cristo de la Epidemia'];

/** Puestos del cortejo, con el peso que tienen de verdad en una nómina. */
const PUESTOS: [string, number][] = [
  ['Nazareno de cirio', 0.46],
  ['Nazareno de insignia', 0.1],
  ['Hombre de trono', 0.24],
  ['Monaguillo', 0.06],
  ['Acólito', 0.05],
  ['Diputado de tramo', 0.05],
  ['Capataz', 0.02],
  ['Músico', 0.02],
];

const TALLAS_TUNICA = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const METODOS_PAGO = ['DOMICILIACION', 'DOMICILIACION', 'DOMICILIACION', 'TRANSFERENCIA', 'EFECTIVO', 'BIZUM'] as const;

/** Los cinco tramos de edad del panel, con el reparto que se busca. */
const TRAMOS_EDAD: [number, number, number][] = [
  [4, 17, 0.12],
  [18, 30, 0.2],
  [31, 45, 0.28],
  [46, 60, 0.25],
  [61, 88, 0.15],
];

/** Reparto de altas por ejercicio: más recientes, más altas. */
const PESO_ALTAS = [0.1, 0.14, 0.2, 0.26, 0.3];

export interface HermanoDemo {
  nombre: string;
  apellidos: string;
  dni: string;
  email: string;
  telefono: string;
  direccion: string;
  poblacion: string;
  codigoPostal: string;
  fechaNacimiento: Date;
  fechaAlta: Date;
  fechaBaja: Date | null;
  activo: boolean;
  numeroHermano: number | null;
  tunica: string | null;
  alturaHombro: number | null;
  puesto: string;
  tieneTunicaPropia: boolean;
  formaPagoPref: (typeof METODOS_PAGO)[number];
}

/** Letra del DNI por el algoritmo oficial, para que no chirríen a la vista. */
function letraDni(numero: number): string {
  return 'TRWAGMYFPDXBNJZSQVHLCKE'[numero % 23];
}

/** Elige por peso acumulado: `pesos` no tiene por qué sumar exactamente uno. */
function elegirPorPeso<T>(azar: number, opciones: [T, number][]): T {
  const total = opciones.reduce((suma, [, peso]) => suma + peso, 0);
  let acumulado = 0;
  for (const [valor, peso] of opciones) {
    acumulado += peso / total;
    if (azar < acumulado) return valor;
  }
  return opciones[opciones.length - 1][0];
}

function entero(azar: number, desde: number, hasta: number): number {
  return desde + Math.floor(azar * (hasta - desde + 1));
}

/**
 * Recorta una fecha al comienzo de su día en UTC.
 *
 * Sin esto la siembra no es determinista: `new Date()` trae milisegundos, y en
 * cuanto una fecha se topa con el día de hoy (un cobro que no puede ser
 * posterior, una baja reciente) dos llamadas seguidas devuelven valores
 * distintos por unos pocos milisegundos.
 */
function inicioDelDia(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

/**
 * Genera `cantidad` hermanos coherentes entre sí para el ejercicio `anio`.
 *
 * `hoy` solo se usa para no dar de alta a nadie en un mes que todavía no ha
 * llegado: sembrar altas en diciembre estando en agosto deja la línea del censo
 * con un tramo plano en el futuro.
 */
export function generarHermanos(cantidad: number, anio: number, momento: Date = new Date()): HermanoDemo[] {
  const azar = generadorAleatorio(SEMILLAS.hermanos);
  const hoy = inicioDelDia(momento);
  const ejercicios = EJERCICIOS_DEMO(anio);
  const mesTope = hoy.getUTCFullYear() === anio ? hoy.getUTCMonth() : 11;

  const hermanos: HermanoDemo[] = [];
  let siguienteNumero = 1;

  for (let i = 0; i < cantidad; i++) {
    const esHombre = azar() < 0.52;
    const nombre = esHombre
      ? NOMBRES_HOMBRE[entero(azar(), 0, NOMBRES_HOMBRE.length - 1)]
      : NOMBRES_MUJER[entero(azar(), 0, NOMBRES_MUJER.length - 1)];
    const apellidos = `${APELLIDOS[entero(azar(), 0, APELLIDOS.length - 1)]} ${APELLIDOS[entero(azar(), 0, APELLIDOS.length - 1)]}`;

    // EDAD -> fecha de nacimiento dentro del tramo que toque.
    const [edadMin, edadMax] = elegirPorPeso(
      azar(),
      TRAMOS_EDAD.map(([min, max, peso]) => [[min, max] as [number, number], peso] as [[number, number], number]),
    );
    const edad = entero(azar(), edadMin, edadMax);
    const fechaNacimiento = new Date(Date.UTC(anio - edad, entero(azar(), 0, 11), entero(azar(), 1, 28)));

    // ALTA: se reparte por ejercicios, pero nadie entra antes de nacer. Los
    // niños se apuntan de recién nacidos, que es justo lo que pasa de verdad.
    const ejercicioAlta = elegirPorPeso(azar(), ejercicios.map((e, j) => [e, PESO_ALTAS[j]] as [number, number]));
    const anioAlta = Math.max(ejercicioAlta, fechaNacimiento.getUTCFullYear());
    const mesAlta = entero(azar(), 0, anioAlta === anio ? mesTope : 11);
    let fechaAlta = new Date(Date.UTC(anioAlta, mesAlta, entero(azar(), 1, 28)));
    if (fechaAlta <= fechaNacimiento) {
      fechaAlta = new Date(fechaNacimiento.getTime() + 90 * 24 * 60 * 60 * 1000);
    }

    // BAJAS: en torno al 8 %, siempre después del alta.
    const causaBaja = azar() < 0.08;
    const fechaBaja = causaBaja
      ? new Date(Math.min(fechaAlta.getTime() + entero(azar(), 200, 1400) * 24 * 60 * 60 * 1000, hoy.getTime()))
      : null;
    const activo = fechaBaja === null;

    // Un 15 % de los activos aún no tiene número asignado: es la cifra que el
    // panel enseña para que secretaría sepa qué le falta por hacer.
    const conNumero = !activo || azar() >= 0.15;
    const numeroHermano = conNumero ? siguienteNumero++ : null;

    const edadHoy = anio - fechaNacimiento.getUTCFullYear();
    const puesto = elegirPorPeso(azar(), PUESTOS);
    const poblacion = POBLACIONES[entero(azar(), 0, POBLACIONES.length - 1)];
    const numeroDni = 20000000 + i;

    hermanos.push({
      nombre,
      apellidos,
      dni: `${numeroDni}${letraDni(numeroDni)}`,
      email: `demo.${i + 1}@ejemplo.invalido`,
      telefono: `6${String(10000000 + entero(azar(), 0, 89999999)).slice(0, 8)}`,
      direccion: `${CALLES[entero(azar(), 0, CALLES.length - 1)]}, ${entero(azar(), 1, 90)}`,
      poblacion: poblacion.nombre,
      codigoPostal: poblacion.cp,
      fechaNacimiento,
      fechaAlta,
      fechaBaja,
      activo,
      numeroHermano,
      tunica: TALLAS_TUNICA[entero(azar(), 0, TALLAS_TUNICA.length - 1)],
      // La altura de hombro solo se toma a quien lleva varal.
      alturaHombro: puesto === 'Hombre de trono' ? entero(azar(), 155, 190) : edadHoy >= 16 ? entero(azar(), 158, 192) : null,
      puesto,
      tieneTunicaPropia: azar() < 0.55,
      formaPagoPref: METODOS_PAGO[entero(azar(), 0, METODOS_PAGO.length - 1)],
    });
  }

  return hermanos;
}

// ---------------------------------------------------------------------------
// RECIBOS
// ---------------------------------------------------------------------------

export type EstadoReciboDemo = 'PENDIENTE' | 'REMESADO' | 'PAGADO' | 'DEVUELTO' | 'ANULADO' | 'EXENTO';

export interface ReciboDemo {
  dniHermano: string;
  year: number;
  concepto: string;
  importe: number;
  tipo: 'CUOTA_HERMANO' | 'PAPELETA_SITIO';
  estado: EstadoReciboDemo;
  fechaEmision: Date;
  fechaPago: Date | null;
  metodoPago: string | null;
  /** Solo en las papeletas: de qué puesto se emitió, para cuadrar el cortejo. */
  puesto: string | null;
}

/** Cuota anual: la de los menores es media, como en casi todas las nóminas. */
const CUOTA_ADULTO = 36;
const CUOTA_MENOR = 18;

/** Lo que cuesta la papeleta según el sitio que se saca. */
const PRECIO_PAPELETA: Record<string, number> = {
  'Nazareno de cirio': 30,
  'Nazareno de insignia': 35,
  'Hombre de trono': 45,
  Monaguillo: 15,
  Acólito: 20,
  'Diputado de tramo': 35,
  Capataz: 45,
  Músico: 0,
};

/**
 * Estados de los recibos. Los ejercicios cerrados están casi todos cobrados;
 * el que está en curso reparte para que la barra de estados del panel tenga
 * los tres colores y «pendiente de cobro» no salga a cero.
 */
const ESTADOS_CERRADO: [EstadoReciboDemo, number][] = [
  ['PAGADO', 0.92], ['DEVUELTO', 0.04], ['ANULADO', 0.02], ['EXENTO', 0.02],
];
const ESTADOS_EN_CURSO: [EstadoReciboDemo, number][] = [
  ['PAGADO', 0.62], ['PENDIENTE', 0.2], ['REMESADO', 0.08], ['DEVUELTO', 0.05], ['EXENTO', 0.03], ['ANULADO', 0.02],
];

const DIA = 24 * 60 * 60 * 1000;

/** Los años en que un hermano estuvo de alta, dentro de los cinco ejercicios. */
function ejerciciosDelHermano(hermano: HermanoDemo, anio: number): number[] {
  const desde = Math.max(hermano.fechaAlta.getUTCFullYear(), EJERCICIOS_DEMO(anio)[0]);
  const hasta = hermano.fechaBaja ? hermano.fechaBaja.getUTCFullYear() : anio;
  const anios: number[] = [];
  for (let a = desde; a <= Math.min(hasta, anio); a++) anios.push(a);
  return anios;
}

export function generarRecibos(hermanos: HermanoDemo[], anio: number, momento: Date = new Date()): ReciboDemo[] {
  const azar = generadorAleatorio(SEMILLAS.recibos);
  const hoy = inicioDelDia(momento);
  const recibos: ReciboDemo[] = [];

  for (const hermano of hermanos) {
    for (const ejercicio of ejerciciosDelHermano(hermano, anio)) {
      const edad = ejercicio - hermano.fechaNacimiento.getUTCFullYear();
      // La cuota se pasa a mediados de febrero, o al entrar si es más tarde.
      const emisionCuota = new Date(
        Math.max(Date.UTC(ejercicio, 1, 15), hermano.fechaAlta.getTime()),
      );
      if (emisionCuota > hoy) continue;

      recibos.push(
        conEstado(
          {
            dniHermano: hermano.dni,
            year: ejercicio,
            concepto: `Cuota anual ${ejercicio}`,
            importe: edad < 18 ? CUOTA_MENOR : CUOTA_ADULTO,
            tipo: 'CUOTA_HERMANO',
            fechaEmision: emisionCuota,
            puesto: null,
          },
          hermano,
          ejercicio,
          anio,
          azar,
          hoy,
        ),
      );

      // La papeleta la saca el 72 % de los hermanos: el resto no procesiona.
      const precio = PRECIO_PAPELETA[hermano.puesto] ?? 30;
      if (precio > 0 && azar() < 0.72) {
        const emisionPapeleta = new Date(Math.max(Date.UTC(ejercicio, 2, 1), hermano.fechaAlta.getTime()));
        if (emisionPapeleta <= hoy) {
          recibos.push(
            conEstado(
              {
                dniHermano: hermano.dni,
                year: ejercicio,
                concepto: `Papeleta de sitio ${ejercicio}`,
                importe: precio,
                tipo: 'PAPELETA_SITIO',
                fechaEmision: emisionPapeleta,
                puesto: hermano.puesto,
              },
              hermano,
              ejercicio,
              anio,
              azar,
              hoy,
            ),
          );
        }
      }
    }
  }

  return recibos;
}

/** Le pone estado y, si toca, fecha y método de cobro. */
function conEstado(
  base: Omit<ReciboDemo, 'estado' | 'fechaPago' | 'metodoPago'>,
  hermano: HermanoDemo,
  ejercicio: number,
  anio: number,
  azar: () => number,
  hoy: Date,
): ReciboDemo {
  const estado = elegirPorPeso(azar(), ejercicio < anio ? ESTADOS_CERRADO : ESTADOS_EN_CURSO);
  if (estado !== 'PAGADO') {
    return { ...base, estado, fechaPago: null, metodoPago: null };
  }
  const margen = Math.floor(azar() * 60) * DIA;
  const fechaPago = new Date(Math.min(base.fechaEmision.getTime() + margen, hoy.getTime()));
  return { ...base, estado, fechaPago, metodoPago: hermano.formaPagoPref };
}

// ---------------------------------------------------------------------------
// CONTABILIDAD
// ---------------------------------------------------------------------------

export interface TransaccionDemo {
  categoria: string;
  tipo: 'INGRESO' | 'GASTO';
  concepto: string;
  importe: number;
  fecha: Date;
  dniHermano: string | null;
  /** `dni|año|concepto` del recibo que la originó, si vino de uno. */
  claveRecibo: string | null;
  metodoPago: string | null;
}

/** Comisión que cobra el banco por cada recibo devuelto. */
const COMISION_DEVOLUCION = 3.5;

/**
 * Gastos que se repiten mes a mes, con su horquilla de importe. Las categorías
 * son literalmente las que siembra `seed-contenido`: inventarse una aquí
 * dejaría la transacción sin `categoriaId` y abortaría la siembra.
 */
const GASTOS_MENSUALES: { categoria: string; concepto: string; desde: number; hasta: number }[] = [
  { categoria: 'Culto y cera', concepto: 'Cera para los cultos del mes', desde: 90, hasta: 260 },
  { categoria: 'Flores y exorno', concepto: 'Exorno floral', desde: 120, hasta: 380 },
  { categoria: 'Caridad', concepto: 'Ayuda a familias de la parroquia', desde: 150, hasta: 400 },
  { categoria: 'Mantenimiento de enseres', concepto: 'Mantenimiento de enseres', desde: 60, hasta: 240 },
];

/** Ingresos que no vienen de un recibo. */
const INGRESOS_VARIOS: { categoria: string; concepto: string; desde: number; hasta: number; meses: number[] }[] = [
  { categoria: 'Donativos', concepto: 'Donativos de hermanos y devotos', desde: 80, hasta: 320, meses: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { categoria: 'Lotería y rifas', concepto: 'Lotería de Navidad', desde: 600, hasta: 1400, meses: [10, 11] },
  { categoria: 'Lotería y rifas', concepto: 'Rifa de cuaresma', desde: 200, hasta: 600, meses: [1, 2] },
];

/** Dos decimales, que es lo que aguanta la columna Decimal(10,2). */
function euros(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function generarTransacciones(
  recibos: ReciboDemo[],
  anio: number,
  momento: Date = new Date(),
): TransaccionDemo[] {
  const azar = generadorAleatorio(SEMILLAS.dinero);
  const hoy = inicioDelDia(momento);
  const movimientos: TransaccionDemo[] = [];

  // 1. Lo que entra por los recibos cobrados, y lo que cuesta cada devolución.
  for (const recibo of recibos) {
    const clave = `${recibo.dniHermano}|${recibo.year}|${recibo.concepto}`;
    if (recibo.estado === 'PAGADO' && recibo.fechaPago) {
      movimientos.push({
        categoria: 'Cuotas y papeletas',
        tipo: 'INGRESO',
        concepto: recibo.concepto,
        importe: recibo.importe,
        fecha: recibo.fechaPago,
        dniHermano: recibo.dniHermano,
        claveRecibo: clave,
        metodoPago: recibo.metodoPago,
      });
    }
    if (recibo.estado === 'DEVUELTO') {
      movimientos.push({
        categoria: 'Devoluciones de recibos',
        tipo: 'GASTO',
        concepto: `Devolución de ${recibo.concepto.toLowerCase()}`,
        importe: COMISION_DEVOLUCION,
        // El banco tarda unas tres semanas en devolverlo, pero si eso cae
        // más allá de hoy la comisión aún no se ha cobrado.
        fecha: new Date(Math.min(recibo.fechaEmision.getTime() + 21 * DIA, hoy.getTime())),
        dniHermano: recibo.dniHermano,
        claveRecibo: clave,
        metodoPago: null,
      });
    }
  }

  // 2. El día a día del grupo, mes a mes, en los cinco ejercicios.
  for (const ejercicio of EJERCICIOS_DEMO(anio)) {
    for (let mes = 0; mes < 12; mes++) {
      // Cada gasto recurrente cae una vez al mes; los importes bailan.
      for (const gasto of GASTOS_MENSUALES) {
        const fecha = new Date(Date.UTC(ejercicio, mes, entero(azar(), 3, 26)));
        if (fecha > hoy) continue;
        movimientos.push({
          categoria: gasto.categoria,
          tipo: 'GASTO',
          concepto: gasto.concepto,
          importe: euros(entero(azar(), gasto.desde, gasto.hasta)),
          fecha,
          dniHermano: null,
          claveRecibo: null,
          metodoPago: 'TRANSFERENCIA',
        });
      }

      for (const ingreso of INGRESOS_VARIOS) {
        if (!ingreso.meses.includes(mes)) continue;
        const fecha = new Date(Date.UTC(ejercicio, mes, entero(azar(), 3, 26)));
        if (fecha > hoy) continue;
        movimientos.push({
          categoria: ingreso.categoria,
          tipo: 'INGRESO',
          concepto: ingreso.concepto,
          importe: euros(entero(azar(), ingreso.desde, ingreso.hasta)),
          fecha,
          dniHermano: null,
          claveRecibo: null,
          metodoPago: 'EFECTIVO',
        });
      }
    }
  }

  return movimientos;
}

// ---------------------------------------------------------------------------
// PROCESIÓN
// ---------------------------------------------------------------------------

export interface PapeletaDemo {
  dniHermano: string;
  /** `dni|año|concepto` del recibo que la pagó. */
  claveRecibo: string;
  year: number;
  puesto: string;
  tramo: string | null;
  numero: number;
  numTunicaAsignada: string | null;
  numCapiroteAsignado: string | null;
}

const TRAMOS = ['Tramo 1 · Cruz de guía', 'Tramo 2 · Cristo', 'Tramo 3 · Palio', 'Tramo 4 · Presidencia'];

/** Quien va bajo el paso, delante de él o tocando no forma en el cortejo. */
const FUERA_DEL_CORTEJO = ['Hombre de trono', 'Capataz', 'Músico'];

/**
 * Una papeleta por cada recibo de papeleta que se llegó a emitir. El sitio sale
 * del puesto del hermano, y quien no tiene túnica propia se lleva una del
 * ropero.
 */
export function generarPapeletas(hermanos: HermanoDemo[], recibos: ReciboDemo[]): PapeletaDemo[] {
  const azar = generadorAleatorio(SEMILLAS.procesion);
  const porDni = new Map(hermanos.map((h) => [h.dni, h]));
  const papeletas: PapeletaDemo[] = [];
  const numeroPorAnio = new Map<number, number>();

  for (const recibo of recibos) {
    if (recibo.tipo !== 'PAPELETA_SITIO' || recibo.estado === 'ANULADO') continue;
    const hermano = porDni.get(recibo.dniHermano);
    if (!hermano) continue;

    const orden = (numeroPorAnio.get(recibo.year) ?? 0) + 1;
    numeroPorAnio.set(recibo.year, orden);

    const enElCortejo = !FUERA_DEL_CORTEJO.includes(hermano.puesto);
    const delRopero = enElCortejo && !hermano.tieneTunicaPropia;
    papeletas.push({
      dniHermano: hermano.dni,
      claveRecibo: `${recibo.dniHermano}|${recibo.year}|${recibo.concepto}`,
      year: recibo.year,
      puesto: hermano.puesto,
      tramo: enElCortejo ? TRAMOS[entero(azar(), 0, TRAMOS.length - 1)] : null,
      numero: orden,
      numTunicaAsignada: delRopero ? `TUN-${entero(azar(), 101, 180)}` : null,
      numCapiroteAsignado: delRopero ? `CAP-${entero(azar(), 181, 220)}` : null,
    });
  }

  return papeletas;
}

// ---------------------------------------------------------------------------
// REPARTO Y ALBACERÍA
// ---------------------------------------------------------------------------

export interface TurnoDemo {
  /** Identificador estable dentro de la siembra, para poder atar las citas. */
  clave: string;
  fecha: Date;
  horaInicio: Date;
  horaFin: Date;
  capacidadEstimada: number;
  activo: boolean;
}

export interface CitaDemo {
  claveTurno: string;
  dniHermano: string;
  estado: 'RESERVADA' | 'ATENDIDA' | 'CANCELADA' | 'NO_PRESENTADO';
}

/** Cómo acabaron las citas de un reparto ya celebrado. */
const FINALES_DE_CITA: ['ATENDIDA' | 'CANCELADA' | 'NO_PRESENTADO', number][] = [
  ['ATENDIDA', 0.88],
  ['NO_PRESENTADO', 0.08],
  ['CANCELADA', 0.04],
];

/**
 * Los días que el grupo abre para repartir papeletas: los de cada ejercicio, ya
 * celebrados, y cuatro por venir en las próximas semanas. Sin turnos futuros,
 * las cifras de reparto del panel salen siempre a cero.
 */
export function generarReparto(
  hermanos: HermanoDemo[],
  anio: number,
  momento: Date = new Date(),
): { turnos: TurnoDemo[]; citas: CitaDemo[] } {
  const azar = generadorAleatorio(SEMILLAS.reparto);
  const hoy = inicioDelDia(momento);
  const turnos: TurnoDemo[] = [];

  const nuevoTurno = (clave: string, fecha: Date, capacidad: number): TurnoDemo => ({
    clave,
    fecha,
    horaInicio: new Date(fecha.getTime() + 18 * 60 * 60 * 1000),
    horaFin: new Date(fecha.getTime() + 21 * 60 * 60 * 1000),
    capacidadEstimada: capacidad,
    activo: true,
  });

  // Repartos celebrados: tres tardes de febrero en cada ejercicio.
  for (const ejercicio of EJERCICIOS_DEMO(anio)) {
    for (const [i, dia] of [10, 17, 24].entries()) {
      const fecha = new Date(Date.UTC(ejercicio, 1, dia));
      if (fecha >= hoy) continue;
      turnos.push(nuevoTurno(`${ejercicio}-reparto-${i + 1}`, fecha, entero(azar(), 80, 140)));
    }
  }

  // Repartos por venir: las cuatro tardes siguientes, semana a semana.
  for (let semana = 1; semana <= 4; semana++) {
    turnos.push(nuevoTurno(`proximo-${semana}`, new Date(hoy.getTime() + semana * 7 * DIA), entero(azar(), 90, 150)));
  }

  // Las citas las piden los hermanos activos.
  const activos = hermanos.filter((h) => h.activo);
  const citas: CitaDemo[] = [];
  const pedidas = new Set<string>();

  for (const turno of turnos) {
    const esFuturo = turno.fecha > hoy;
    const cuantas = Math.min(activos.length, entero(azar(), 25, 55));
    for (let i = 0; i < cuantas; i++) {
      const hermano = activos[entero(azar(), 0, activos.length - 1)];
      const clave = `${hermano.dni}|${turno.clave}`;
      if (pedidas.has(clave)) continue; // el esquema no deja repetir turno
      pedidas.add(clave);
      citas.push({
        claveTurno: turno.clave,
        dniHermano: hermano.dni,
        estado: esFuturo ? 'RESERVADA' : elegirPorPeso(azar(), FINALES_DE_CITA),
      });
    }
  }

  return { turnos, citas };
}

export interface PrendaDemo {
  numero: string;
  tipo: 'TUNICA' | 'CAPIROTE';
  talla: string;
  estado: 'DISPONIBLE' | 'PRESTADA' | 'TALLER' | 'BAJA';
  dniHermano: string | null;
  fechaAsignacion: Date | null;
  observaciones: string | null;
}

const TALLAS_ROPERO = { tunica: ['1.55m', '1.62m', '1.70m', '1.78m', '1.85m'], capirote: ['S', 'M', 'L', 'XL'] };

/**
 * El ropero: 80 túnicas y 40 capirotes. La numeración arranca en 101 para no
 * chocar con las prendas del contenido de ejemplo, donde `numero` es único.
 */
export function generarPrendas(hermanos: HermanoDemo[], momento: Date = new Date()): PrendaDemo[] {
  const azar = generadorAleatorio(SEMILLAS.procesion + 1);
  const hoy = inicioDelDia(momento);
  const candidatos = hermanos.filter((h) => h.activo && !h.tieneTunicaPropia);
  const prendas: PrendaDemo[] = [];
  const yaTiene = new Set<string>();

  for (let i = 0; i < 120; i++) {
    const esTunica = i < 80;
    const suerte = azar();
    // Dos de cada tres están repartidas; el resto, en el ropero o en el taller.
    const previsto = suerte < 0.62 ? 'PRESTADA' : suerte < 0.9 ? 'DISPONIBLE' : suerte < 0.97 ? 'TALLER' : 'BAJA';

    let dniHermano: string | null = null;
    if (previsto === 'PRESTADA') {
      // Un hermano no se lleva dos túnicas: si el elegido ya tiene, se prueba
      // con otro, y si no aparece ninguno la prenda se queda en el ropero.
      for (let intento = 0; intento < 8 && dniHermano === null; intento++) {
        const candidato = candidatos[entero(azar(), 0, candidatos.length - 1)];
        const clave = `${candidato.dni}|${esTunica}`;
        if (!yaTiene.has(clave)) {
          yaTiene.add(clave);
          dniHermano = candidato.dni;
        }
      }
    }

    const estado = previsto === 'PRESTADA' && dniHermano === null ? 'DISPONIBLE' : previsto;
    const tallas = esTunica ? TALLAS_ROPERO.tunica : TALLAS_ROPERO.capirote;

    prendas.push({
      numero: `${esTunica ? 'TUN' : 'CAP'}-${101 + i}`,
      tipo: esTunica ? 'TUNICA' : 'CAPIROTE',
      talla: tallas[entero(azar(), 0, tallas.length - 1)],
      estado,
      dniHermano,
      fechaAsignacion: dniHermano ? new Date(hoy.getTime() - entero(azar(), 30, 400) * DIA) : null,
      observaciones: estado === 'TALLER' ? 'Pendiente de arreglo en el taller de costura.' : null,
    });
  }

  return prendas;
}

// =====================================================================
//  SOLICITUDES DE ALTA PENDIENTES
// =====================================================================

export interface SolicitudDemo {
  email: string;
  dni: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  /** Las fichas que entran con la solicitud: la del titular y, a veces, un menor. */
  fichas: { nombre: string; apellidos: string; dni: string | null; fechaNacimiento: Date; esTitular: boolean }[];
}

/**
 * Altas esperando aprobación. Son usuarios con la ficha inactiva y sin fecha de
 * baja, que es exactamente lo que crea el alta pública de la web y lo que
 * cuenta como solicitud pendiente. No son hermanos activos, así que no mueven
 * ninguna cifra del panel.
 */
export function generarSolicitudes(anio: number): SolicitudDemo[] {
  const azar = generadorAleatorio(SEMILLAS.hermanos + 7);
  const solicitudes: SolicitudDemo[] = [];

  for (let i = 0; i < 5; i++) {
    // Fuera del rango del censo, que llega hasta 20000299.
    const numero = 20000900 + i;
    const nombre = NOMBRES_HOMBRE[entero(azar(), 0, NOMBRES_HOMBRE.length - 1)];
    const apellidos = `${APELLIDOS[entero(azar(), 0, APELLIDOS.length - 1)]} ${APELLIDOS[entero(azar(), 0, APELLIDOS.length - 1)]}`;
    // Las dos últimas vienen con un menor a cargo: es el caso del tutor.
    const conMenor = i >= 3;

    const fichas: SolicitudDemo['fichas'] = [{
      nombre,
      apellidos,
      dni: `${numero}${letraDni(numero)}`,
      fechaNacimiento: new Date(Date.UTC(anio - entero(azar(), 28, 55), entero(azar(), 0, 11), entero(azar(), 1, 28))),
      esTitular: true,
    }];

    if (conMenor) {
      fichas.push({
        nombre: NOMBRES_MUJER[entero(azar(), 0, NOMBRES_MUJER.length - 1)],
        apellidos,
        dni: null,
        fechaNacimiento: new Date(Date.UTC(anio - entero(azar(), 6, 15), entero(azar(), 0, 11), entero(azar(), 1, 28))),
        esTitular: false,
      });
    }

    solicitudes.push({
      email: `solicitud.${i + 1}@ejemplo.invalido`,
      dni: `${numero}${letraDni(numero)}`,
      nombre,
      apellidos,
      telefono: `6${String(20000000 + entero(azar(), 0, 9999999)).slice(0, 8)}`,
      fichas,
    });
  }

  return solicitudes;
}
