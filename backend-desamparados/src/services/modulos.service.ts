import { EstadoPedido, OrigenPago, TipoPagoEnLinea } from '@prisma/client';
import db from '../config/db.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';
import { NotFoundError } from '../utils/error.handle.js';
import {
  CATALOGO_MODULOS, CLAVES_MODULO, LOTE_INICIAL, dependientesActivos, esClaveDeModulo, fichaDe, requisitosQueFaltan,
  type ClaveModulo, type FichaDeModulo,
} from '../domain/modulos.js';

export interface RecuentoDeDatos { que: string; total: number }

export interface ModuloDelCms extends FichaDeModulo {
  activo: boolean;
  cambiadoEl: string | null;
  cambiadoPor: string | null;
  /** Cuántos datos tiene («12 productos»): se enseñan antes de apagar, para que se sepa qué se oculta. */
  datos: RecuentoDeDatos[];
}

export type ResultadoDeCambio =
  | { ok: true; cambiados: ClaveModulo[]; activos: ClaveModulo[] }
  | { ok: false; message: string; faltan: ClaveModulo[]; dependientes: ClaveModulo[] };

/**
 * Lo que cada módulo tiene guardado: un `count` por modelo principal. Lo que
 * no tiene modelo propio (la Puerta lee papeletas, el Modelo 182 lee recibos,
 * Contabilidad lee el libro, que es del núcleo) devuelve la lista vacía.
 */
const RECUENTOS: Record<ClaveModulo, () => Promise<RecuentoDeDatos[]>> = {
  noticias: async () => [{ que: 'noticias', total: await db.noticia.count() }],
  publicaciones: async () => [{ que: 'publicaciones', total: await db.publicacion.count() }],
  agenda: async () => [{ que: 'actos', total: await db.evento.count() }],
  comunicados: async () => [{ que: 'comunicados', total: await db.comunicado.count() }],
  'alta-web': async () => [],
  'area-hermanos': async () => [],
  procesion: async () => [
    { que: 'salidas', total: await db.salida.count() },
    { que: 'papeletas', total: await db.papeletaSitio.count() },
    { que: 'turnos de reparto', total: await db.turno.count() },
    { que: 'prendas del ropero', total: await db.prenda.count() },
  ],
  puerta: async () => [],
  'cortejo-directo': async () => [],
  inventario: async () => [{ que: 'enseres', total: await db.enser.count() }],
  cartas: async () => [{ que: 'cartas', total: await db.carta.count() }],
  difuntos: async () => [{ que: 'sufragios', total: await db.sufragio.count() }],
  apadrinamientos: async () => [
    { que: 'campañas', total: await db.campanaApadrinamiento.count() },
    { que: 'apadrinamientos', total: await db.apadrinamiento.count() },
  ],
  remesas: async () => [{ que: 'remesas', total: await db.remesa.count() }],
  'pago-en-linea': async () => [{ que: 'pagos en línea', total: await db.pagoEnLinea.count() }],
  'cuotas-en-linea': async () => [{ que: 'pagos desde el área', total: await db.pagoEnLinea.count({ where: { origen: OrigenPago.AREA_HERMANOS } }) }],
  donativos: async () => [{ que: 'donativos', total: await db.pagoEnLinea.count({ where: { tipo: TipoPagoEnLinea.DONATIVO } }) }],
  tienda: async () => [
    { que: 'productos', total: await db.producto.count() },
    { que: 'ventas de caja', total: await db.cajaVenta.count() },
  ],
  'tienda-web': async () => [{ que: 'pedidos', total: await db.pedidoTienda.count({ where: { estado: { not: EstadoPedido.PENDIENTE_PAGO } } }) }],
  loteria: async () => [
    { que: 'sorteos', total: await db.sorteoLoteria.count() },
    { que: 'talonarios', total: await db.talonarioLoteria.count() },
  ],
  'modelo-182': async () => [],
  contabilidad: async () => [],
  cabildos: async () => [{ que: 'cabildos', total: await db.cabildo.count() }],
  'informe-anual': async () => [{ que: 'informes', total: await db.informeAnual.count() }],
};

const nombres = (claves: ClaveModulo[]) => claves.map((c) => `«${fichaDe(c).nombre}»`).join(', ');

/**
 * Los módulos encendidos, en memoria: es un solo proceso y cada petición
 * pregunta por ellos. Se cargan la primera vez que alguien pregunta (así los
 * tests, que importan `app` sin pasar por index.ts, no tienen que acordarse)
 * y se recargan al cambiar.
 */
let activos: Set<ClaveModulo> | null = null;
let cargando: Promise<ReadonlySet<ClaveModulo>> | null = null;

export class ModulosService {
  /** Crea las filas que falten con el lote; las que existen no se tocan. Devuelve cuántas creó. */
  static async sembrar(lote: readonly ClaveModulo[] = LOTE_INICIAL): Promise<number> {
    const existentes = new Set((await db.modulo.findMany({ select: { clave: true } })).map((f) => f.clave));
    const nuevas = CLAVES_MODULO.filter((c) => !existentes.has(c)).map((clave) => ({ clave, activo: lote.includes(clave) }));
    if (nuevas.length) await db.modulo.createMany({ data: nuevas });
    return nuevas.length;
  }

  /** Relee la base (sembrando lo que falte) y lo deja en memoria. */
  static async cargar(): Promise<ReadonlySet<ClaveModulo>> {
    await ModulosService.sembrar();
    const filas = await db.modulo.findMany({ where: { activo: true }, select: { clave: true } });
    // Una fila con una clave que ya no está en el catálogo se ignora.
    activos = new Set(filas.map((f) => f.clave).filter(esClaveDeModulo));
    return activos;
  }

  static async activos(): Promise<ReadonlySet<ClaveModulo>> {
    if (activos) return activos;
    // Varias peticiones a la vez comparten una sola carga.
    cargando ??= ModulosService.cargar().finally(() => { cargando = null; });
    return cargando;
  }

  static async activo(clave: ClaveModulo): Promise<boolean> {
    return (await ModulosService.activos()).has(clave);
  }

  /** Para las pruebas: como recién arrancado. */
  static olvidar(): void {
    activos = null;
  }

  /**
   * Enciende o apaga un módulo respetando el catálogo: encender uno con
   * requisitos apagados solo se hace con `conRequisitos` (y los enciende
   * antes, cada uno con su apunte de auditoría); apagar uno que otros
   * encendidos requieren no se hace nunca. Devuelve qué pasó en vez de lanzar:
   * la pantalla necesita las listas para proponer o explicar.
   */
  static async cambiar(
    clave: string, activar: boolean, opciones: { conRequisitos?: boolean }, quienId: number | undefined, meta: MetaDeAuditoria,
  ): Promise<ResultadoDeCambio> {
    if (!esClaveDeModulo(clave)) throw new NotFoundError('No hay ningún módulo con esa clave.');
    const antes = await ModulosService.activos();
    const ficha = fichaDe(clave);
    let cambiados: ClaveModulo[];
    if (activar) {
      const faltan = requisitosQueFaltan(clave, antes);
      if (faltan.length && !opciones.conRequisitos) {
        return { ok: false, faltan, dependientes: [], message: `Para encender «${ficha.nombre}» hay que encender también ${nombres(faltan)}.` };
      }
      cambiados = [...faltan, clave].filter((c) => !antes.has(c));
    } else {
      const dependientes = dependientesActivos(clave, antes);
      if (dependientes.length) {
        return { ok: false, faltan: [], dependientes, message: `No se puede apagar «${ficha.nombre}»: lo necesitan ${nombres(dependientes)}. Apaga antes esos módulos.` };
      }
      cambiados = antes.has(clave) ? [clave] : [];
    }
    const cambiadoPor = quienId === undefined ? null : (await db.user.findUnique({ where: { id: quienId }, select: { email: true } }))?.email ?? null;
    for (const c of cambiados) {
      await db.modulo.upsert({
        where: { clave: c },
        update: { activo: activar, cambiadoEl: new Date(), cambiadoPor },
        create: { clave: c, activo: activar, cambiadoPor },
      });
      await AuditoriaService.log(
        activar ? ACCIONES_AUDITORIA.MODULO_ENCENDER : ACCIONES_AUDITORIA.MODULO_APAGAR,
        meta, 'modulo', c, c === clave ? undefined : { porRequisitoDe: clave },
      );
    }
    const despues = await ModulosService.cargar();
    return { ok: true, cambiados, activos: CLAVES_MODULO.filter((c) => despues.has(c)) };
  }

  static async listarCms(): Promise<ModuloDelCms[]> {
    const encendidos = await ModulosService.activos();
    const filas = new Map((await db.modulo.findMany()).map((f) => [f.clave, f]));
    return Promise.all(CATALOGO_MODULOS.map(async (m) => ({
      ...m,
      activo: encendidos.has(m.clave),
      cambiadoEl: filas.get(m.clave)?.cambiadoEl.toISOString() ?? null,
      cambiadoPor: filas.get(m.clave)?.cambiadoPor ?? null,
      datos: await RECUENTOS[m.clave](),
    })));
  }
}

/**
 * Un enganche opcional entre módulos: la acción solo se hace con el módulo
 * encendido (Procesión crea una noticia al abrir el plazo si Noticias está).
 * Lo fijo nunca lo usa: el núcleo no pregunta por nadie.
 */
export async function siModulo<T>(clave: ClaveModulo, accion: () => Promise<T>): Promise<T | undefined> {
  return (await ModulosService.activo(clave)) ? accion() : undefined;
}
