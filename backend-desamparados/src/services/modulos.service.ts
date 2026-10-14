import { EstadoPedido, OrigenPago, TipoPagoEnLinea } from '@prisma/client';
import db from '../config/db.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';
import { NotFoundError } from '../utils/error.handle.js';
import { avisosConfigurados } from './aprobacion/push.js';
import {
  CATALOGO_MODULOS, CLAVES_MODULO, DE_INSTALACION_ENCENDIDOS, LOTE_INICIAL, dependientesActivos, esClaveDeModulo, fichaDe,
  requisitosQueFaltan, type ClaveDeInstalacion, type ClaveEncendible, type ClaveModulo, type FichaDeModulo,
} from '../domain/modulos.js';

/** `uno`, para cuando hay uno solo: «1 producto», no «1 productos». */
interface RecuentoDeDatos { uno: string; que: string; total: number }

interface ModuloDelCms extends FichaDeModulo {
  activo: boolean;
  cambiadoEl: string | null;
  cambiadoPor: string | null;
  /** Cuántos datos tiene («12 productos»): se enseñan antes de apagar, para que se sepa qué se oculta. */
  datos: RecuentoDeDatos[];
}

type ResultadoDeCambio =
  | { ok: true; cambiados: ClaveModulo[]; activos: ClaveModulo[] }
  | { ok: false; message: string; faltan: ClaveModulo[]; dependientes: ClaveModulo[] };

/**
 * Lo que cada módulo tiene guardado: un `count` por modelo principal. Lo que
 * no tiene modelo propio (la Puerta lee papeletas, el Modelo 182 lee recibos,
 * Contabilidad lee el libro, que es del núcleo) devuelve la lista vacía.
 */
const RECUENTOS: Record<ClaveModulo, () => Promise<RecuentoDeDatos[]>> = {
  noticias: async () => [{ uno: 'noticia', que: 'noticias', total: await db.noticia.count() }],
  publicaciones: async () => [{ uno: 'publicación', que: 'publicaciones', total: await db.publicacion.count() }],
  agenda: async () => [{ uno: 'acto', que: 'actos', total: await db.evento.count() }],
  comunicados: async () => [{ uno: 'comunicado', que: 'comunicados', total: await db.comunicado.count() }],
  'alta-web': async () => [],
  'area-hermanos': async () => [],
  procesion: async () => [
    { uno: 'salida', que: 'salidas', total: await db.salida.count() },
    { uno: 'papeleta', que: 'papeletas', total: await db.papeletaSitio.count() },
    { uno: 'turno de reparto', que: 'turnos de reparto', total: await db.turno.count() },
    { uno: 'prenda del ropero', que: 'prendas del ropero', total: await db.prenda.count() },
  ],
  puerta: async () => [],
  'cortejo-directo': async () => [],
  inventario: async () => [{ uno: 'enser', que: 'enseres', total: await db.enser.count() }],
  cartas: async () => [{ uno: 'carta', que: 'cartas', total: await db.carta.count() }],
  difuntos: async () => [{ uno: 'sufragio', que: 'sufragios', total: await db.sufragio.count() }],
  apadrinamientos: async () => [
    { uno: 'campaña', que: 'campañas', total: await db.campanaApadrinamiento.count() },
    { uno: 'apadrinamiento', que: 'apadrinamientos', total: await db.apadrinamiento.count() },
  ],
  remesas: async () => [{ uno: 'remesa', que: 'remesas', total: await db.remesa.count() }],
  'pago-en-linea': async () => [{ uno: 'pago en línea', que: 'pagos en línea', total: await db.pagoEnLinea.count() }],
  'cuotas-en-linea': async () => [{ uno: 'pago desde el área', que: 'pagos desde el área', total: await db.pagoEnLinea.count({ where: { origen: OrigenPago.AREA_HERMANOS } }) }],
  donativos: async () => [{ uno: 'donativo', que: 'donativos', total: await db.pagoEnLinea.count({ where: { tipo: TipoPagoEnLinea.DONATIVO } }) }],
  tienda: async () => [
    { uno: 'producto', que: 'productos', total: await db.producto.count() },
    { uno: 'venta de caja', que: 'ventas de caja', total: await db.cajaVenta.count() },
  ],
  'tienda-web': async () => [{ uno: 'pedido', que: 'pedidos', total: await db.pedidoTienda.count({ where: { estado: { not: EstadoPedido.PENDIENTE_PAGO } } }) }],
  loteria: async () => [
    { uno: 'sorteo', que: 'sorteos', total: await db.sorteoLoteria.count() },
    { uno: 'talonario', que: 'talonarios', total: await db.talonarioLoteria.count() },
  ],
  'modelo-182': async () => [],
  contabilidad: async () => [],
  cabildos: async () => [{ uno: 'cabildo', que: 'cabildos', total: await db.cabildo.count() }],
  'informe-anual': async () => [{ uno: 'informe', que: 'informes', total: await db.informeAnual.count() }],
  'avisos-en-el-movil': async () => [{ uno: 'móvil apuntado', que: 'móviles apuntados', total: await db.movilApuntado.count() }],
};

/**
 * Lo que un módulo necesita del servidor y no de otro módulo: sin ello,
 * encenderlo dejaría una función que no puede funcionar (los avisos al móvil
 * sin claves VAPID no salen). Devuelve qué falta, o null si está todo.
 */
const QUE_FALTA_EN_EL_SERVIDOR: Partial<Record<ClaveModulo, () => string | null>> = {
  'avisos-en-el-movil': () => (avisosConfigurados() ? null : 'faltan las claves VAPID del servidor (VAPID_PUBLICA, VAPID_PRIVADA y VAPID_CONTACTO; se generan con npm run gen:vapid).'),
};

const nombres = (claves: ClaveModulo[]) => claves.map((c) => `«${fichaDe(c).nombre}»`).join(', ');

/**
 * Los módulos encendidos, en memoria: es un solo proceso y cada petición
 * pregunta por ellos. Se cargan la primera vez que alguien pregunta (así los
 * tests, que importan `app` sin pasar por index.ts, no tienen que acordarse)
 * y se recargan al cambiar.
 */
let activos: Set<ClaveEncendible> | null = null;
let cargando: Promise<ReadonlySet<ClaveEncendible>> | null = null;

/**
 * Los de instalación encendidos: los del fichero, leídos al arrancar. No pasan
 * por la base; se suman a lo que diga ella en cada `cargar`. Solo las pruebas
 * los cambian (`fijarDeInstalacion`).
 */
let deInstalacion: ReadonlySet<ClaveDeInstalacion> = new Set(DE_INSTALACION_ENCENDIDOS);

/**
 * Los cambios van de uno en uno: dos a la vez leerían el mismo «antes» y
 * podrían dejar encendido un módulo sin su requisito (apagar Tienda mientras
 * otro enciende Tienda en la web).
 */
let cambiando: Promise<unknown> = Promise.resolve();

export class ModulosService {
  /** Crea las filas que falten con el lote; las que existen no se tocan. Devuelve cuántas creó. */
  static async sembrar(lote: readonly ClaveModulo[] = LOTE_INICIAL): Promise<number> {
    const existentes = new Set((await db.modulo.findMany({ select: { clave: true } })).map((f) => f.clave));
    const nuevas = CLAVES_MODULO.filter((c) => !existentes.has(c)).map((clave) => ({ clave, activo: lote.includes(clave) }));
    if (nuevas.length) await db.modulo.createMany({ data: nuevas });
    return nuevas.length;
  }

  /** Relee la base (sembrando lo que falte) y lo deja en memoria. */
  static async cargar(): Promise<ReadonlySet<ClaveEncendible>> {
    await ModulosService.sembrar();
    const filas = await db.modulo.findMany({ where: { activo: true }, select: { clave: true } });
    // Una fila con una clave que ya no está en el catálogo se ignora.
    activos = new Set<ClaveEncendible>([...filas.map((f) => f.clave).filter(esClaveDeModulo), ...deInstalacion]);
    return activos;
  }

  /** Todo lo encendido: los del catálogo (la base) y los de instalación (el fichero). */
  static async activos(): Promise<ReadonlySet<ClaveEncendible>> {
    if (activos) return activos;
    // Varias peticiones a la vez comparten una sola carga.
    cargando ??= ModulosService.cargar().finally(() => { cargando = null; });
    return cargando;
  }

  static async activo(clave: ClaveEncendible): Promise<boolean> {
    return (await ModulosService.activos()).has(clave);
  }

  /** Para las pruebas: como recién arrancado. */
  static olvidar(): void {
    activos = null;
  }

  /**
   * Para las pruebas: qué módulos de instalación están encendidos, en lugar de
   * los del fichero (el ejemplo no lleva ninguno). Devuelve cómo dejarlos.
   */
  static fijarDeInstalacion(claves: readonly ClaveDeInstalacion[]): () => void {
    const antes = deInstalacion;
    deInstalacion = new Set(claves);
    activos = null;
    return () => { deInstalacion = antes; activos = null; };
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
    const trabajo = () => ModulosService.cambiarYa(clave, activar, opciones, quienId, meta);
    // Se encadena aunque el anterior fallara: un error no debe bloquear los siguientes.
    const resultado = cambiando.then(trabajo, trabajo);
    cambiando = resultado;
    return resultado;
  }

  private static async cambiarYa(
    clave: ClaveModulo, activar: boolean, opciones: { conRequisitos?: boolean }, quienId: number | undefined, meta: MetaDeAuditoria,
  ): Promise<ResultadoDeCambio> {
    const antes = await ModulosService.activos();
    const ficha = fichaDe(clave);
    let cambiados: ClaveModulo[];
    if (activar) {
      const sinServidor = QUE_FALTA_EN_EL_SERVIDOR[clave]?.();
      if (sinServidor) return { ok: false, faltan: [], dependientes: [], message: `Para encender «${ficha.nombre}» ${sinServidor}` };
      const faltan = requisitosQueFaltan(clave, antes);
      if (faltan.length && !opciones.conRequisitos) {
        return { ok: false, faltan, dependientes: [], message: `Para encender «${ficha.nombre}» hay que encender también ${nombres(faltan)}.` };
      }
      cambiados = [...faltan, clave].filter((c) => !antes.has(c));
    } else {
      const dependientes = dependientesActivos(clave, antes);
      if (dependientes.length) {
        const aviso = dependientes.length === 1
          ? `lo necesita ${nombres(dependientes)}. Apaga antes ese módulo.`
          : `lo necesitan ${nombres(dependientes)}. Apaga antes esos módulos.`;
        return { ok: false, faltan: [], dependientes, message: `No se puede apagar «${ficha.nombre}»: ${aviso}` };
      }
      cambiados = antes.has(clave) ? [clave] : [];
    }
    const cambiadoPor = quienId === undefined ? null : (await db.user.findUnique({ where: { id: quienId }, select: { email: true } }))?.email ?? null;
    try {
      // Los módulos de un cambio se guardan a una: encender «Tienda en la web»
      // con «Tienda» por requisito no puede dejar la segunda encendida sola si
      // la base falla a mitad.
      const ahora = new Date();
      if (cambiados.length) {
        await db.$transaction(cambiados.map((c) => db.modulo.upsert({
          where: { clave: c },
          update: { activo: activar, cambiadoEl: ahora, cambiadoPor },
          create: { clave: c, activo: activar, cambiadoPor },
        })));
      }
    } finally {
      // Si la base falla a mitad, la memoria se relee igual: así no anuncia como apagado algo que ya se encendió.
      // Pero si la propia recarga falla (la base caída, por ejemplo), no debe tapar el error de la escritura:
      // quien llama a `cambiar` necesita saber qué falló al guardar, no por qué no se pudo releer después.
      try {
        await ModulosService.cargar();
      } catch (error) {
        console.error('[Módulos] No se pudo recargar la memoria tras un cambio:', error);
      }
    }
    // La auditoría, después de confirmar: un apunte no debe dar fe de un cambio que no se guardó.
    for (const c of cambiados) {
      await AuditoriaService.log(
        activar ? ACCIONES_AUDITORIA.MODULO_ENCENDER : ACCIONES_AUDITORIA.MODULO_APAGAR,
        meta, 'modulo', c, c === clave ? undefined : { porRequisitoDe: clave },
      );
    }
    const despues = await ModulosService.activos();
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
export async function siModulo<T>(clave: ClaveEncendible, accion: () => Promise<T>): Promise<T | undefined> {
  return (await ModulosService.activo(clave)) ? accion() : undefined;
}
