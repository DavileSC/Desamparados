import db from '../config/db.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';
import { depurarNombres, type NombresEnMenu } from '../domain/menu.js';

/** La fila de `Configuracion` donde se guardan, en JSON `{ ruta: nombre }`. */
const CLAVE = 'nombres_en_menu';
const DESCRIPCION = 'Nombres de las páginas en el menú público (CMS → Páginas)';

let enMemoria: NombresEnMenu | null = null;
let cargando: Promise<NombresEnMenu> | null = null;

/**
 * El nombre de cada página en el menú público, cuando no es el de siempre
 * (p. ej. «Parroquia · Pasionistas» en vez de «Parroquia»). En memoria, como
 * los datos de contacto: la web lo pide en cada visita y no cambia casi nunca.
 * Sin fila no se siembra nada: sin nombres, los de siempre.
 */
export class MenuService {
  static async cargar(): Promise<NombresEnMenu> {
    const fila = await db.configuracion.findUnique({ where: { key: CLAVE } });
    let nombres: NombresEnMenu = {};
    if (fila) {
      try { nombres = depurarNombres(JSON.parse(fila.value)); }
      catch {
        // Una fila rota no deja la web sin menú: se avisa y salen los de siempre.
        console.error(`[Menú] La fila ${CLAVE} no es un JSON válido: se usan los nombres de siempre.`);
      }
    }
    enMemoria = nombres;
    return nombres;
  }

  static async leer(): Promise<NombresEnMenu> {
    if (enMemoria) return enMemoria;
    // Varias peticiones a la vez comparten una sola carga.
    cargando ??= MenuService.cargar().finally(() => { cargando = null; });
    return cargando;
  }

  /** `nombres` ya viene depurado por el esquema: solo los que cambian. */
  static async guardar(nombres: NombresEnMenu, meta: MetaDeAuditoria): Promise<NombresEnMenu> {
    const antes = await MenuService.leer();
    const value = JSON.stringify(nombres);
    await db.configuracion.upsert({
      where: { key: CLAVE },
      update: { value },
      create: { key: CLAVE, value, descripcion: DESCRIPCION },
    });
    enMemoria = nombres;
    await AuditoriaService.log(ACCIONES_AUDITORIA.MENU_NOMBRES_ACTUALIZAR, meta, 'config', CLAVE, { antes, despues: nombres });
    return nombres;
  }

  /** Para las pruebas: que la próxima lectura vuelva a la base. */
  static olvidar(): void {
    enMemoria = null;
  }
}
