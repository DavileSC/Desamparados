import { Role } from '@prisma/client';
import db from '../config/db';
import { HttpError, NotFoundError } from '../utils/error.handle.js';
import { fechaLimite, puedeDarPorHecho } from '../domain/avisos.js';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from './auditoria.service.js';

/** Un aviso tal y como lo pinta el Inicio. */
export interface AvisoDelPanel {
  id: number;
  texto: string;
  /** Un cargo, o null si es para toda la junta. */
  para: Role | null;
  /** AAAA-MM-DD, o null si no tiene fecha límite. */
  hasta: string | null;
  urgente: boolean;
  creadoPorId: number | null;
  creadorRol: Role;
  createdAt: string;
}

export interface DatosAviso {
  texto: string;
  para: Role | null;
  hasta?: string | null;
  urgente?: boolean;
}

const aPanel = (a: {
  id: number; texto: string; para: Role | null; hasta: Date | null; urgente: boolean
  creadoPorId: number | null; creadorRol: Role; createdAt: Date
}): AvisoDelPanel => ({
  id: a.id,
  texto: a.texto,
  para: a.para,
  hasta: a.hasta ? a.hasta.toISOString().slice(0, 10) : null,
  urgente: a.urgente,
  creadoPorId: a.creadoPorId,
  creadorRol: a.creadorRol,
  createdAt: a.createdAt.toISOString(),
});

export class AvisoService {
  /** Los que siguen sin hacer, del más antiguo al más nuevo. */
  static async pendientes(): Promise<AvisoDelPanel[]> {
    const avisos = await db.avisoJunta.findMany({ where: { hechoAt: null }, orderBy: { createdAt: 'asc' } });
    return avisos.map(aPanel);
  }

  static async crear(datos: DatosAviso, usuario: { id: number; role: string }, meta: MetaDeAuditoria): Promise<AvisoDelPanel> {
    const texto = datos.texto.trim().replace(/\s+/g, ' ');
    let hasta: Date | null = null;
    if (datos.hasta) {
      hasta = fechaLimite(datos.hasta);
      if (!hasta) throw new HttpError('La fecha límite no es una fecha válida.');
    }
    const aviso = await db.avisoJunta.create({
      data: { texto, para: datos.para, hasta, urgente: datos.urgente ?? false, creadoPorId: usuario.id, creadorRol: usuario.role as Role },
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.AVISO_CREAR, meta, 'aviso', aviso.id, { texto, para: datos.para, hasta: datos.hasta ?? null, urgente: aviso.urgente });
    return aPanel(aviso);
  }

  /** Lo da por hecho: desaparece del Inicio, pero queda guardado (y en la auditoría). */
  static async hecho(id: number, usuario: { id: number; role: string }, meta: MetaDeAuditoria): Promise<void> {
    const aviso = await db.avisoJunta.findUnique({ where: { id } });
    if (!aviso) throw new NotFoundError('Ese aviso no existe.');
    if (!puedeDarPorHecho(aviso, usuario)) {
      throw new HttpError('Este aviso lo lleva otro cargo: solo él, quien lo creó, el Hermano Mayor o Administración pueden darlo por hecho.', 403);
    }
    // Ya hecho (otro de la junta se adelantó): no es un error, el resultado es el mismo.
    if (aviso.hechoAt) return;
    await db.avisoJunta.update({ where: { id }, data: { hechoAt: new Date(), hechoPorId: usuario.id } });
    await AuditoriaService.log(ACCIONES_AUDITORIA.AVISO_HECHO, meta, 'aviso', id, { texto: aviso.texto, para: aviso.para });
  }
}
