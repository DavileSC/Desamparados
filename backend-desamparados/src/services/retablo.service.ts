import db from '../config/db';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from './auditoria.service.js';

/**
 * La foto del retablo del Inicio del CMS y el punto que nunca se recorta. Vive
 * en `Configuracion`, dos claves: sin foto guardada, el CMS enseña la de
 * siempre (la del hero de la web).
 */
export interface Retablo {
  /** Ruta de la foto subida, o null para la de siempre. */
  foto: string | null;
  /** El punto que no se recorta, en % del ancho y del alto de la foto. */
  x: number;
  y: number;
}

const CLAVE_FOTO = 'inicio_retablo_foto';
const CLAVE_PUNTO = 'inicio_retablo_punto';
/** El encuadre de la foto de siempre: el rostro de la Virgen. */
export const PUNTO_POR_DEFECTO = { x: 50, y: 30 };

const acotar = (n: number) => Math.min(100, Math.max(0, Math.round(n)));

export class RetabloService {
  static async leer(): Promise<Retablo> {
    const filas = await db.configuracion.findMany({ where: { key: { in: [CLAVE_FOTO, CLAVE_PUNTO] } } });
    const valor = (clave: string) => filas.find((f) => f.key === clave)?.value;
    const [x, y] = (valor(CLAVE_PUNTO) ?? '').split(',').map(Number);
    const punto = Number.isFinite(x) && Number.isFinite(y) ? { x: acotar(x), y: acotar(y) } : PUNTO_POR_DEFECTO;
    return { foto: valor(CLAVE_FOTO) || null, ...punto };
  }

  static async guardar(datos: Retablo, meta: MetaDeAuditoria): Promise<Retablo> {
    const antes = await RetabloService.leer();
    const punto = `${acotar(datos.x)},${acotar(datos.y)}`;
    await db.$transaction([
      datos.foto
        ? db.configuracion.upsert({ where: { key: CLAVE_FOTO }, update: { value: datos.foto }, create: { key: CLAVE_FOTO, value: datos.foto, descripcion: 'Foto del retablo del Inicio del CMS' } })
        : db.configuracion.deleteMany({ where: { key: CLAVE_FOTO } }),
      db.configuracion.upsert({ where: { key: CLAVE_PUNTO }, update: { value: punto }, create: { key: CLAVE_PUNTO, value: punto, descripcion: 'Punto de la foto del retablo que no se recorta (x,y en %)' } }),
    ]);
    const despues = await RetabloService.leer();
    await AuditoriaService.log(ACCIONES_AUDITORIA.RETABLO_ACTUALIZAR, meta, 'config', CLAVE_FOTO, { antes: { ...antes }, despues: { ...despues } });
    return despues;
  }
}
