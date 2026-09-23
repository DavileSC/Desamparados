import { Response, Request } from 'express';
import { AgendaService } from '../services/agenda.service.js';
import type { AdminEventFilterDto } from '../dtos/agenda.dto.js';
import { handleHttp } from '../utils/error.handle.js';
import { manejar } from '../utils/manejar.js';
import { AuditoriaService, ACCIONES_AUDITORIA } from '../services/auditoria.service.js';

export class AgendaController {

  static list = manejar('Error obteniendo agenda', async (req, res) => {
    // Los query params ya vienen limpios y tipados gracias a ArkType. La
    // página y el tamaño llegan crudos: quien los sanea es el servicio.
    const events = await AgendaService.getEvents(req.query as any);
    res.status(200).json(events);
  });

  // Listado del CMS (sesión + rol en la ruta): pasados o próximos. La query ya viene validada por queryAgendaAdminSchema.
  static adminList = manejar('Error obteniendo agenda', async (req, res) => {
    const periodo = req.query.periodo === 'pasados' ? 'pasados' : 'proximos';
    const { page, limit, q, tipo } = req.query as AdminEventFilterDto;
    const events = await AgendaService.getAdminEvents(periodo, { page, limit, q, tipo });
    res.status(200).json(events);
  });

  static getOne = manejar('Error obteniendo evento', async (req, res) => {
    // Ya no hace falta isNaN, validateId en la ruta nos protege
    const id = Number(req.params.id);
    const event = await AgendaService.getEventById(id);
    res.status(200).json(event);
  });

  static create = manejar('Error creando evento', async (req, res) => {
    // req.body validado por agendaSchema
    const event = await AgendaService.createEvent(req.body);
    AuditoriaService.log(ACCIONES_AUDITORIA.EVENTO_CREAR, AuditoriaService.metaFromReq(req), 'evento', event.id);
    res.status(201).json(event);
  });

  static update = manejar('Error actualizando evento', async (req, res) => {
    const id = Number(req.params.id);
    const updated = await AgendaService.updateEvent(id, req.body);
    AuditoriaService.log(ACCIONES_AUDITORIA.EVENTO_ACTUALIZAR, AuditoriaService.metaFromReq(req), 'evento', id);
    res.status(200).json(updated);
  });

  static delete = manejar('Error eliminando evento', async (req, res) => {
    const id = Number(req.params.id);
    await AgendaService.deleteEvent(id);
    AuditoriaService.log(ACCIONES_AUDITORIA.EVENTO_ELIMINAR, AuditoriaService.metaFromReq(req), 'evento', id);
    res.status(200).json({ message: 'Evento eliminado' });
  });
}
