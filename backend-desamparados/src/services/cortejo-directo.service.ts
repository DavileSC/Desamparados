import db from '../config/db.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';

/**
 * Una posición que lleva este tiempo sin renovarse ya no se enseña como «en
 * directo»: el móvil se ha quedado sin batería o sin cobertura, y un trono
 * clavado en una esquina durante media hora engaña más que la reproducción.
 */
export const CADUCA_MS = 10 * 60 * 1000;

export interface PosicionEnviada { lng: number; lat: number; precision: number | null }

interface CortejoPublico {
  enDirecto: boolean;
  lng?: number;
  lat?: number;
  actualizadoEl?: string;
}

interface CortejoParaLaJunta extends CortejoPublico {
  enMarcha: boolean;
  precision: number | null;
  autorNombre: string | null;
}

const ID = 1;

const leer = () => db.cortejoEnDirecto.findUnique({ where: { id: ID } });

function vigente(fila: NonNullable<Awaited<ReturnType<typeof leer>>>, ahora: Date) {
  return fila.enMarcha && ahora.getTime() - fila.actualizadoEl.getTime() < CADUCA_MS;
}

export class CortejoDirectoService {
  /** Lo que ve la web: la posición solo si está en marcha y es reciente; nunca quién la manda. */
  static async publico(ahora = new Date()): Promise<CortejoPublico> {
    const fila = await leer();
    if (!fila || !vigente(fila, ahora)) return { enDirecto: false };
    return { enDirecto: true, lng: Number(fila.lng), lat: Number(fila.lat), actualizadoEl: fila.actualizadoEl.toISOString() };
  }

  /** Lo que ve la Junta en el CMS: además, si se quedó en marcha sin renovarse y quién la mandaba. */
  static async paraLaJunta(ahora = new Date()): Promise<CortejoParaLaJunta> {
    const fila = await leer();
    if (!fila) return { enDirecto: false, enMarcha: false, precision: null, autorNombre: null };
    return {
      enDirecto: vigente(fila, ahora),
      enMarcha: fila.enMarcha,
      lng: Number(fila.lng),
      lat: Number(fila.lat),
      actualizadoEl: fila.actualizadoEl.toISOString(),
      precision: fila.precision,
      autorNombre: fila.autorNombre,
    };
  }

  /**
   * Una posición nueva. La primera de una salida (la fila apagada o sin
   * existir) queda en la auditoría como el comienzo; las demás no, que son
   * cientos por tarde y no dicen nada.
   */
  static async enviar(p: PosicionEnviada, meta: MetaDeAuditoria): Promise<CortejoParaLaJunta> {
    const autor = meta.userId ? await db.user.findUnique({ where: { id: meta.userId }, select: { nombre: true } }) : null;
    const antes = await leer();
    const datos = { enMarcha: true, lng: p.lng, lat: p.lat, precision: p.precision, autorId: meta.userId ?? null, autorNombre: autor?.nombre ?? null, actualizadoEl: new Date() };
    await db.cortejoEnDirecto.upsert({ where: { id: ID }, create: { id: ID, ...datos }, update: datos });
    if (!antes?.enMarcha) await AuditoriaService.log(ACCIONES_AUDITORIA.CORTEJO_DIRECTO_EMPEZAR, meta, 'cortejoEnDirecto', ID);
    return CortejoDirectoService.paraLaJunta();
  }

  /** Se recoge: el mapa vuelve a la reproducción. */
  static async terminar(meta: MetaDeAuditoria): Promise<CortejoParaLaJunta> {
    const { count } = await db.cortejoEnDirecto.updateMany({ where: { id: ID, enMarcha: true }, data: { enMarcha: false } });
    if (count > 0) await AuditoriaService.log(ACCIONES_AUDITORIA.CORTEJO_DIRECTO_TERMINAR, meta, 'cortejoEnDirecto', ID);
    return CortejoDirectoService.paraLaJunta();
  }
}
