import { handleHttp } from '../utils/error.handle';
import { manejar } from '../utils/manejar';
import { HermanoService } from '../services/hermano.service';
import { AuditoriaService } from '../services/auditoria.service';

/**
 * El censo, por sus dos puertas: la del hermano, que solo alcanza sus fichas,
 * y la de Secretaría, que las alcanza todas.
 *
 * El `id` de la ruta llega ya comprobado: todas las de este router pasan por
 * `validateId` (`hermano.routes`), que rechaza con 400 lo que no sean dígitos
 * antes de llegar aquí. Por eso los métodos hacen `Number(req.params.id)` sin
 * volver a mirarlo.
 */
export class HermanoController {

  // ========================================================
  // --- RUTAS FAMILIARES (Prevención BOLA/IDOR Crítica) ---
  // ========================================================

  static getMyProfiles = manejar('Error obteniendo los perfiles familiares', async (req, res) => {
    const perfiles = await HermanoService.getProfilesByUserId(req.user!.id, req.query);
    res.status(200).json(perfiles);
  });

  static addProfile = manejar('Error añadiendo perfil familiar', async (req, res) => {
    const newProfile = await HermanoService.createDependentProfile(req.user!.id, req.body, AuditoriaService.metaFromReq(req));
    res.status(201).json(newProfile);
  });

  static updateProfile = manejar('Error actualizando el perfil', async (req, res) => {
    const updated = await HermanoService.updateProfileIfOwned(Number(req.params.id), req.user!.id, req.body, AuditoriaService.metaFromReq(req));
    if (!updated) return handleHttp(res, 'IDOR_ATTEMPT', 'Perfil no encontrado o no autorizado', 403);

    res.status(200).json({ message: 'Perfil actualizado correctamente', data: updated });
  });

  static deleteProfile = manejar('Error eliminando perfil', async (req, res) => {
    const deleted = await HermanoService.deleteProfileIfOwned(Number(req.params.id), req.user!.id, AuditoriaService.metaFromReq(req));
    if (!deleted) return handleHttp(res, 'IDOR_ATTEMPT', 'No autorizado para dar de baja este perfil', 403);

    // El mensaje dice qué pasó de verdad: baja, o solicitud retirada y borrada.
    res.status(200).json({ message: deleted.message });
  });

  static emancipate = manejar('Error en el proceso de emancipación', async (req, res) => {
    const result = await HermanoService.emancipateProfile(Number(req.params.id), req.user!.id, req.body, AuditoriaService.metaFromReq(req));
    res.status(200).json(result);
  });

  /** Secretaría emancipa a un hermano: al hermano le llega un enlace. */
  static emancipateByStaff = manejar('Error en el proceso de emancipación', async (req, res) => {
    const result = await HermanoService.emancipateByStaff(Number(req.params.id), req.body, AuditoriaService.metaFromReq(req));
    res.status(200).json(result);
  });

  // ========================================================
  // --- RUTAS ADMIN (Secretaría) ---
  // ========================================================

  static search = manejar('Error en el buscador de hermanos', async (req, res) => {
    const result = await HermanoService.searchHermanos(req.query);
    res.status(200).json(result);
  });

  static getAll = manejar('Error obteniendo el censo del Grupo Parroquial', async (req, res) => {
    // El saneamiento (defecto, tope) lo decide sanearPaginacion, no el controlador.
    const hermanos = await HermanoService.getAllHermanos(req.query);
    res.status(200).json(hermanos);
  });

  static getById = manejar('Error obteniendo la ficha del hermano', async (req, res) => {
    const hermano = await HermanoService.getHermanoById(Number(req.params.id));
    if (!hermano) return handleHttp(res, null, 'Hermano no encontrado', 404);

    res.status(200).json(hermano);
  });

  static updateAdmin = manejar('Error actualizando ficha desde Secretaría', async (req, res) => {
    const updated = await HermanoService.updateAdminMode(Number(req.params.id), req.body, AuditoriaService.metaFromReq(req));
    res.status(200).json(updated);
  });

  static reordenarCenso = manejar('Error crítico al intentar reordenar el censo', async (req, res) => {
    const result = await HermanoService.reordenarCenso(AuditoriaService.metaFromReq(req));
    res.status(200).json(result);
  });

  static cerrarHuecosNumero = manejar('Error asignando los números de hermano', async (req, res) => {
    const { asignados } = await HermanoService.cerrarHuecosDeNumero(AuditoriaService.metaFromReq(req));
    res.status(200).json({
      message: asignados.length === 0
        ? 'No había ningún hermano activo sin número.'
        : `Se han asignado ${asignados.length} números de hermano.`,
      asignados
    });
  });

  static getSolicitudes = manejar('Error obteniendo las solicitudes pendientes', async (req, res) => {
    // La ruta no pasa por `validate`: sanearPaginacion() ya defiende los
    // parámetros crudos de req.query (defecto y tope incluidos).
    const solicitudes = await HermanoService.getSolicitudesPendientes(req.query);
    res.status(200).json(solicitudes);
  });

  static aprobarSolicitud = manejar('Error aprobando la solicitud', async (req, res) => {
    const result = await HermanoService.aprobarSolicitud(Number(req.params.id), AuditoriaService.metaFromReq(req));
    res.status(200).json(result);
  });

  static rechazarSolicitud = manejar('Error rechazando la solicitud', async (req, res) => {
    const result = await HermanoService.rechazarSolicitud(Number(req.params.id), AuditoriaService.metaFromReq(req));
    res.status(200).json(result);
  });

  static darDeBajaHermano = manejar('Error dando de baja al hermano', async (req, res) => {
    // La fecha es opcional (validada por bajaHermanoSchema): sin ella, la baja es de hoy.
    const fechaBaja = typeof req.body?.fechaBaja === 'string' ? req.body.fechaBaja : undefined;
    const result = await HermanoService.darDeBajaHermano(Number(req.params.id), AuditoriaService.metaFromReq(req), fechaBaja);
    res.status(200).json(result);
  });

  static reactivarHermano = manejar('Error reactivando al hermano', async (req, res) => {
    const result = await HermanoService.reactivarHermano(Number(req.params.id), AuditoriaService.metaFromReq(req));
    res.status(200).json(result);
  });

  /** Secretaría descarta una petición de volver: la ficha se queda de baja. */
  static descartarReactivacion = manejar('Error descartando la petición de reactivación', async (req, res) => {
    res.status(200).json(await HermanoService.descartarReactivacion(Number(req.params.id), AuditoriaService.metaFromReq(req)));
  });
}
