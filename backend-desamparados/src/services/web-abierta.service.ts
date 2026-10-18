import db from '../config/db.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';
import { depurarEstado, WEB_ABIERTA, type EstadoDeLaWeb } from '../domain/web-abierta.js';

/** La fila de `Configuracion` donde se guarda, en JSON. */
const CLAVE = 'estado_de_la_web';
const DESCRIPCION = 'Si la web pública está abierta o enseña «Próximamente» (CMS → Sistema → Abrir la web)';

let enMemoria: EstadoDeLaWeb | null = null;
let cargando: Promise<EstadoDeLaWeb> | null = null;

/**
 * En memoria, como los nombres del menú: la web lo pregunta en cada visita y
 * cambia dos o tres veces en la vida de la instalación. Sin fila no se siembra
 * nada: abierta.
 */
export class WebAbiertaService {
  static async cargar(): Promise<EstadoDeLaWeb> {
    const fila = await db.configuracion.findUnique({ where: { key: CLAVE } });
    let estado = WEB_ABIERTA;
    if (fila) {
      try { estado = depurarEstado(JSON.parse(fila.value)); }
      catch {
        console.error(`[Web abierta] La fila ${CLAVE} no es un JSON válido: la web se da por abierta.`);
      }
    }
    enMemoria = estado;
    return estado;
  }

  static async leer(): Promise<EstadoDeLaWeb> {
    if (enMemoria) return enMemoria;
    cargando ??= WebAbiertaService.cargar().finally(() => { cargando = null; });
    return cargando;
  }

  /**
   * Se guarda entero, sin mezclar: la pantalla manda siempre los tres campos,
   * así que no hace falta la cola del menú.
   */
  static async guardar(estado: EstadoDeLaWeb, meta: MetaDeAuditoria): Promise<EstadoDeLaWeb> {
    const antes = await WebAbiertaService.leer();
    const value = JSON.stringify(estado);
    await db.configuracion.upsert({
      where: { key: CLAVE },
      update: { value },
      create: { key: CLAVE, value, descripcion: DESCRIPCION },
    });
    enMemoria = estado;
    // Abrir y cerrar son acciones distintas en la auditoría: es lo que se busca
    // después («¿quién la cerró?»); cambiar solo el texto cuenta como lo que ya estaba.
    const accion = estado.abierta ? ACCIONES_AUDITORIA.WEB_ABRIR : ACCIONES_AUDITORIA.WEB_CERRAR;
    await AuditoriaService.log(accion, meta, 'config', CLAVE, { antes, despues: estado });
    return estado;
  }

  /** Para las pruebas: que la próxima lectura vuelva a la base. */
  static olvidar(): void {
    enMemoria = null;
  }
}
