import db from '../config/db';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from './auditoria.service.js';
import { ModulosService } from './modulos.service.js';
import { SalidasService, reglaDe, type SalidaConActo } from './procesion/salidas.service.js';
import { diaMadrid, proximaFecha } from '../domain/fecha-salida.js';
import { articuloDe, type Articulo } from '../domain/articulos.js';
import {
  CUENTA_POR_DEFECTO, MAX_TIEMPOS, TIEMPOS_CALCULADOS, esDiaDelAnio, tiempoDeHoy,
  type CuentaAtras, type TiempoDelRetablo,
} from '../domain/retablo.js';

/**
 * El retablo del Inicio del CMS: la foto de todo el año con el punto que nunca
 * se recorta, las fotos de otros tiempos (la Cuaresma, la Navidad, unas
 * fechas a mano) y hasta qué cuenta los días. Vive en `Configuracion`: sin
 * nada guardado, la foto de siempre (la del hero de la web) y la cuenta
 * atrás hasta la próxima salida.
 */
export interface Retablo {
  /** Ruta de la foto de todo el año, o null para la de siempre. */
  foto: string | null;
  /** El punto que no se recorta, en % del ancho y del alto de la foto. */
  x: number;
  y: number;
}

export interface AjustesRetablo extends Retablo {
  tiempos: TiempoDelRetablo[];
  cuenta: CuentaAtras;
}

/** Lo que se cuenta: su nombre, con qué artículo se escribe (null en un acto) y el día. */
interface CuentaDeHoy {
  nombre: string;
  articulo: Articulo | null;
  fecha: string;
}

/** Lo que pinta el Inicio hoy: la foto que toca y la cuenta atrás, ya resueltas. */
interface RetabloDeHoy extends Retablo {
  cuenta: CuentaDeHoy | null;
}

/** Lo que se puede elegir en la pantalla de ajustes. Null: su módulo está apagado. */
interface OpcionesRetablo {
  proxima: CuentaDeHoy | null;
  salidas: { id: number; nombre: string; articulo: Articulo; fecha: string | null }[] | null;
  actos: { id: number; nombre: string; fecha: string }[] | null;
}

const CLAVE_FOTO = 'inicio_retablo_foto';
const CLAVE_PUNTO = 'inicio_retablo_punto';
const CLAVE_TIEMPOS = 'inicio_retablo_tiempos';
const CLAVE_CUENTA = 'inicio_retablo_cuenta';
/** El encuadre de la foto de siempre: el rostro de la Virgen. */
const PUNTO_POR_DEFECTO = { x: 50, y: 30 };
/** Los actos de la Agenda que se ofrecen: los próximos, hasta este número. */
const ACTOS_A_ELEGIR = 60;

const acotar = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

/**
 * Lo guardado se vuelve a mirar al leer: un JSON tocado a mano o de una
 * versión anterior no debe tirar el Inicio. Lo que no encaja se descarta.
 */
function tiemposGuardados(valor: string | undefined): TiempoDelRetablo[] {
  if (!valor) return [];
  try {
    const lista: unknown = JSON.parse(valor);
    if (!Array.isArray(lista)) return [];
    return lista.flatMap((t): TiempoDelRetablo[] => {
      if (!t || typeof t !== 'object') return [];
      const { tiempo, foto, x, y, nombre, desde, hasta } = t as Record<string, unknown>;
      if (typeof foto !== 'string' || !foto || typeof x !== 'number' || typeof y !== 'number') return [];
      const encuadre = { foto, x: acotar(x), y: acotar(y) };
      if (TIEMPOS_CALCULADOS.includes(tiempo as never)) return [{ tiempo: tiempo as (typeof TIEMPOS_CALCULADOS)[number], ...encuadre }];
      if (tiempo === 'a-mano' && typeof nombre === 'string' && typeof desde === 'string' && typeof hasta === 'string' && esDiaDelAnio(desde) && esDiaDelAnio(hasta)) {
        return [{ tiempo: 'a-mano', nombre, desde, hasta, ...encuadre }];
      }
      return [];
    }).slice(0, MAX_TIEMPOS);
  } catch {
    return [];
  }
}

function cuentaGuardada(valor: string | undefined): CuentaAtras {
  if (!valor) return CUENTA_POR_DEFECTO;
  try {
    const c = JSON.parse(valor) as Record<string, unknown>;
    if (c.tipo === 'ninguna' || c.tipo === 'proxima') return { tipo: c.tipo };
    if (c.tipo === 'salida' && Number.isInteger(c.salidaId)) return { tipo: 'salida', salidaId: c.salidaId as number };
    if (c.tipo === 'acto' && Number.isInteger(c.eventoId)) return { tipo: 'acto', eventoId: c.eventoId as number };
  } catch { /* se queda la de siempre */ }
  return CUENTA_POR_DEFECTO;
}

const deSalida = (s: SalidaConActo, fecha: string): CuentaDeHoy => ({ nombre: s.nombre, articulo: articuloDe(s), fecha });

/** La primera salida activa con fecha por delante; a igual día, la de menor orden (ya vienen así). */
function primeraSalida(salidas: SalidaConActo[], hoy: string): CuentaDeHoy | null {
  let mejor: CuentaDeHoy | null = null;
  for (const s of salidas) {
    const fecha = proximaFecha(reglaDe(s), hoy);
    if (fecha && (!mejor || fecha < mejor.fecha)) mejor = deSalida(s, fecha);
  }
  return mejor;
}

export class RetabloService {
  static async leer(): Promise<AjustesRetablo> {
    const filas = await db.configuracion.findMany({ where: { key: { in: [CLAVE_FOTO, CLAVE_PUNTO, CLAVE_TIEMPOS, CLAVE_CUENTA] } } });
    const valor = (clave: string) => filas.find((f) => f.key === clave)?.value;
    const [x, y] = (valor(CLAVE_PUNTO) ?? '').split(',').map(Number);
    const punto = Number.isFinite(x) && Number.isFinite(y) ? { x: acotar(x), y: acotar(y) } : PUNTO_POR_DEFECTO;
    return {
      foto: valor(CLAVE_FOTO) || null,
      ...punto,
      tiempos: tiemposGuardados(valor(CLAVE_TIEMPOS)),
      cuenta: cuentaGuardada(valor(CLAVE_CUENTA)),
    };
  }

  /**
   * Hasta qué cuenta el retablo, ya resuelto. Las salidas necesitan Procesión
   * y los actos, la Agenda: con su módulo apagado no hay cuenta atrás. Una
   * salida borrada o desactivada vuelve a la próxima; un acto que ya pasó o
   * que se borró deja el retablo sin cuenta, hasta que se elija otro.
   */
  static async cuenta(cuenta: CuentaAtras, hoy: string): Promise<CuentaDeHoy | null> {
    if (cuenta.tipo === 'ninguna') return null;
    if (cuenta.tipo === 'acto') {
      if (!(await ModulosService.activo('agenda'))) return null;
      const acto = await db.evento.findUnique({ where: { id: cuenta.eventoId }, select: { title: true, startDate: true } });
      const fecha = acto && diaMadrid(acto.startDate);
      return acto && fecha && fecha >= hoy ? { nombre: acto.title, articulo: null, fecha } : null;
    }
    if (!(await ModulosService.activo('procesion'))) return null;
    const salidas = await SalidasService.listar();
    if (cuenta.tipo === 'salida') {
      const elegida = salidas.find((s) => s.id === cuenta.salidaId);
      if (elegida) {
        const fecha = proximaFecha(reglaDe(elegida), hoy);
        return fecha ? deSalida(elegida, fecha) : null;
      }
    }
    return primeraSalida(salidas, hoy);
  }

  /** La foto que toca hoy y la cuenta atrás: lo que pinta el Inicio. */
  static async deHoy(hoy = diaMadrid(new Date())): Promise<RetabloDeHoy> {
    const ajustes = await RetabloService.leer();
    const tiempo = tiempoDeHoy(ajustes.tiempos, hoy);
    const encuadre = tiempo ? { foto: tiempo.foto, x: tiempo.x, y: tiempo.y } : { foto: ajustes.foto, x: ajustes.x, y: ajustes.y };
    return { ...encuadre, cuenta: await RetabloService.cuenta(ajustes.cuenta, hoy) };
  }

  /** Las salidas y los actos que se pueden elegir, y cuál sería hoy «la próxima salida». */
  static async opciones(hoy = diaMadrid(new Date())): Promise<OpcionesRetablo> {
    const [conProcesion, conAgenda] = await Promise.all([ModulosService.activo('procesion'), ModulosService.activo('agenda')]);
    const salidas = conProcesion ? await SalidasService.listar() : null;
    // Los días de reparto los crea la procesión en la Agenda: no son actos a los que contar.
    const actos = conAgenda
      ? await db.evento.findMany({
        where: { startDate: { gte: new Date(`${hoy}T00:00:00Z`) }, turno: null },
        orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
        take: ACTOS_A_ELEGIR,
        select: { id: true, title: true, startDate: true },
      })
      : null;
    return {
      proxima: salidas ? primeraSalida(salidas, hoy) : null,
      salidas: salidas?.map((s) => ({ id: s.id, nombre: s.nombre, articulo: articuloDe(s), fecha: proximaFecha(reglaDe(s), hoy) })) ?? null,
      actos: actos?.filter((a) => diaMadrid(a.startDate) >= hoy).map((a) => ({ id: a.id, nombre: a.title, fecha: diaMadrid(a.startDate) })) ?? null,
    };
  }

  static async guardar(datos: AjustesRetablo, meta: MetaDeAuditoria): Promise<AjustesRetablo> {
    const antes = await RetabloService.leer();
    const punto = `${acotar(datos.x)},${acotar(datos.y)}`;
    const tiempos = JSON.stringify(datos.tiempos.map((t) => ({ ...t, x: acotar(t.x), y: acotar(t.y) })));
    const cuenta = JSON.stringify(datos.cuenta);
    const poner = (key: string, value: string, descripcion: string) =>
      db.configuracion.upsert({ where: { key }, update: { value }, create: { key, value, descripcion } });
    await db.$transaction([
      datos.foto
        ? poner(CLAVE_FOTO, datos.foto, 'Foto del retablo del Inicio del CMS')
        : db.configuracion.deleteMany({ where: { key: CLAVE_FOTO } }),
      poner(CLAVE_PUNTO, punto, 'Punto de la foto del retablo que no se recorta (x,y en %)'),
      poner(CLAVE_TIEMPOS, tiempos, 'Fotos del retablo por tiempos (Cuaresma, Navidad, fechas a mano)'),
      poner(CLAVE_CUENTA, cuenta, 'Hasta qué cuenta los días el retablo del Inicio'),
    ]);
    const despues = await RetabloService.leer();
    // Por JSON: los tiempos son una unión de tipos que Prisma no reconoce como JSON.
    await AuditoriaService.log(ACCIONES_AUDITORIA.RETABLO_ACTUALIZAR, meta, 'config', CLAVE_FOTO, JSON.parse(JSON.stringify({ antes, despues })));
    return despues;
  }
}
