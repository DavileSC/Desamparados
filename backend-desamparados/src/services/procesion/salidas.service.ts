/**
 * La fecha del Rosario vespertino. La decide el Grupo Parroquial cada año
 * (siempre en octubre) y, al fijarla Secretaría, sale en la Agenda pública:
 * es el segundo acto del año tras el Sábado de Pasión. El acto de la Agenda
 * es también de donde la papeleta del Rosario saca su día, su hora y su
 * lugar (ver `leerDatosEvento`).
 */
import { TipoEvento } from '@prisma/client';
import db from '../../config/db.js';
import { HttpError } from '../../utils/error.handle.js';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from '../auditoria.service.js';
import { CLAVE_EVENTO_ROSARIO } from '../recibos/comunes.js';
import { identidad } from '../../domain/datos-entidad.js';

const DESCRIPCION = `Rezamos el Santo Rosario por la tarde acompañando a ${identidad.titular} por las calles. Se va en traje.`;

export class SalidasService {
  /** El acto del Rosario de este año en la Agenda, si ya tiene fecha. */
  static async rosario() {
    const clave = await db.configuracion.findUnique({ where: { key: CLAVE_EVENTO_ROSARIO } });
    const acto = clave ? await db.evento.findUnique({ where: { id: Number(clave.value) || 0 } }) : null;
    return acto ? { eventoId: acto.id, inicio: acto.startDate, lugar: acto.location } : null;
  }

  /**
   * Fija (o cambia) la fecha del Rosario: crea su acto en la Agenda o mueve
   * el que ya había. Solo en octubre: si el Grupo decidiera otra cosa algún
   * año, se cambia aquí.
   */
  static async fijarRosario(datos: { inicio: string; lugar?: string | null }, meta?: MetaDeAuditoria) {
    const inicio = new Date(datos.inicio);
    if (Number.isNaN(inicio.getTime())) throw new HttpError('La fecha del Rosario no es válida.');
    const mes = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', month: 'numeric' }).format(inicio);
    if (mes !== '10') throw new HttpError('El Rosario vespertino es siempre en octubre.');

    const antes = await SalidasService.rosario();
    const acto = {
      title: 'Rosario vespertino',
      description: DESCRIPCION,
      location: datos.lugar?.trim() || null,
      startDate: inicio,
      type: TipoEvento.PROCESION,
    };
    const evento = antes
      ? await db.evento.update({ where: { id: antes.eventoId }, data: acto })
      : await db.evento.create({ data: acto });
    await db.configuracion.upsert({
      where: { key: CLAVE_EVENTO_ROSARIO },
      create: { key: CLAVE_EVENTO_ROSARIO, value: String(evento.id), descripcion: 'Acto de la Agenda del Rosario vespertino de este año' },
      update: { value: String(evento.id) },
    });

    await AuditoriaService.log(ACCIONES_AUDITORIA.ROSARIO_FECHAR, meta ?? {}, 'evento', evento.id, {
      antes: antes && { inicio: antes.inicio.toISOString(), lugar: antes.lugar },
      despues: { inicio: evento.startDate.toISOString(), lugar: evento.location },
    });
    return { eventoId: evento.id, inicio: evento.startDate, lugar: evento.location };
  }
}
