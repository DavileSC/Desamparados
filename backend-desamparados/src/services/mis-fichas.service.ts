import crypto from 'crypto';
import db from '../config/db';
import { Prisma, Role } from '@prisma/client';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import {
  ADMIN_EDITABLE_FIELDS, FICHA_PENDIENTE, HERMANO_ERRORS, HERMANO_SAFE_SELECT,
  USER_EDITABLE_FIELDS, WHERE_SITUACION, emanciparFicha,
  esCuentaStaff, getNextNumeroHermano, prepareUpdateData, sinFechasDelMismoDia,
  transaccionReintentable, type FichaEmancipable, type SearchHermanoQuery,
} from './hermanos/comunes.js';
import { encrypt } from '../utils/bcrypt.handle';
import { CreateHermanoDto, UpdateHermanoDto, EmancipateHermanoDto } from '../dtos/hermano.dto';
import { comprobarEsAdulto, comprobarEsMenor, comprobarFechasHermano } from '../domain/fechas-hermano';
import { diferenciasFicha, valorParaAuditoria } from '../domain/cambios-ficha';
import { apellidosTrasCambio, partirApellidos } from '../domain/apellidos.js';
import { enmascararIban } from '../domain/iban.js';
import { renuevaMandato } from '../domain/sepa.js';
import { borrarDocumentosPrivados, documentosDe } from '../utils/documentos-privados.js';
import { PapeletasService, type SolicitudConRecibo } from './procesion/papeletas.service.js';
import { idCategoriaDevoluciones } from './recibos/comunes.js';
import { ContadorFallos } from '../utils/contador-fallos.js';

const UN_DIA = 24 * 60 * 60 * 1000;

/**
 * Lo que se responde cuando el DNI de una ficha del área de hermanos ya es de
 * otra ficha. Antes decía «Ese DNI ya está registrado», y «Mi familia» servía
 * para averiguar quién está en el censo probando DNI. No lo confirma: deja el
 * caso a Secretaría, que lo ve en la auditoría.
 */
export const MENSAJE_FECHA_DE_SECRETARIA = 'La fecha de nacimiento de una ficha a cargo ya aprobada la corrige Secretaría.';

export const MENSAJE_DNI_NO_GUARDADO = 'No se ha podido guardar ese DNI. Si es correcto, habla con Secretaría.';

/**
 * Cuántos DNI puede escribir una cuenta en sus fichas al día, salgan bien o
 * mal: también un DNI que se guarda dice algo (que no estaba en el censo). Una
 * familia que apunta a sus hijos no llega ni de lejos.
 */
const intentosDeDni = new ContadorFallos({ maxFallos: 10, bloqueoMs: UN_DIA, ventanaMs: UN_DIA, tope: 10_000 });

/** Cuenta un DNI escrito desde el área de hermanos y frena a quien escribe demasiados. */
function contarIntentoDeDni(userId: number) {
  const clave = String(userId);
  if (intentosDeDni.restanteBloqueo(clave) > 0) {
    throw new HttpError('Has cambiado demasiados DNI por hoy. Si necesitas corregir alguno, habla con Secretaría.', 429);
  }
  intentosDeDni.registrarFallo(clave);
}

/**
 * Que el DNI no sea ya de otra ficha, sin decirlo. El choque queda en la
 * auditoría, con la ficha con la que choca, para que Secretaría lo resuelva.
 */
async function exigirDniLibreSinDelatar(dni: string, exceptoId: number | null, meta: MetaDeAuditoria | undefined) {
  const otra = await db.hermano.findFirst({
    where: { dni, ...(exceptoId !== null ? { id: { not: exceptoId } } : {}) },
    select: { id: true },
  });
  if (!otra) return;
  await AuditoriaService.log(ACCIONES_AUDITORIA.FAMILIAR_DNI_OCUPADO, meta ?? {}, 'hermano', exceptoId ?? undefined, {
    fichaConEseDni: otra.id,
  });
  throw new HttpError(MENSAJE_DNI_NO_GUARDADO);
}

/**
 * Las fichas que cuelgan de una cuenta: la suya y las de quien tenga a su
 * cargo. Es lo que se ve y se toca desde «Mi perfil» y «Mi familia».
 *
 * Todo lo de aquí comprueba que la ficha sea de quien la pide (el `IfOwned`
 * de los nombres): es la puerta por la que un hermano podría llegar a la ficha de
 * otro cambiando un número en la URL.
 */
export class MisFichasService {

  static async getProfilesByUserId(userId: number, query: { page?: unknown; limit?: unknown } = {}) {
    const paginacion = sanearPaginacion(query);
    // Incluimos también las fichas pendientes de aprobación (activo:false sin fecha de baja)
    // para que el usuario vea que su familiar está "en trámite".
    const where = { userId, fechaBaja: null };

    const [data, total] = await db.$transaction([
      db.hermano.findMany({
        where,
        orderBy: [
          { fechaNacimiento: 'desc' },
          { id: 'asc' } // Desempate: con dos mellizos el orden quedaría a merced de MariaDB y
                        // una ficha podría salir en dos páginas y otra en ninguna.
        ],
        include: {
          recibos: { take: 1, orderBy: { year: 'desc' }, select: { year: true, estado: true } }
        },
        skip: paginacion.skip,
        take: paginacion.take,
      }),
      db.hermano.count({ where })
    ]);

    // La cuenta bancaria nunca vuelve entera: basta para reconocerla. Para
    // cambiarla se escribe la nueva.
    const fichas = data.map(({ iban, ...ficha }) => ({ ...ficha, ibanEnmascarado: enmascararIban(iban) }));
    return respuestaPaginada(fichas, total, paginacion);
  }

  static async createDependentProfile(managerUserId: number, data: CreateHermanoDto, meta?: MetaDeAuditoria) {
    if (data.dni) {
      contarIntentoDeDni(managerUserId);
      await exigirDniLibreSinDelatar(data.dni, null, meta);
    }

    const manager = await db.user.findUnique({ where: { id: managerUserId } });
    if (!manager) throw new NotFoundError(HERMANO_ERRORS.MANAGER_NOT_FOUND);

    const esTitular = !!data.dni && data.dni === manager.dni;

    // Su propia ficha (se apunta él con su DNI) tiene que ser de un adulto; la
    // de alguien a su cargo, de un menor: con 18 cumplidos el alta la hace la
    // propia persona, o quedaría un adulto dependiendo de la cuenta de otro.
    const nacimiento = new Date(data.fechaNacimiento);
    if (esTitular) comprobarEsAdulto(nacimiento);
    else comprobarEsMenor(nacimiento, data.nombre);

    const creado = await db.hermano.create({
      data: {
        userId: managerUserId,
        esTitular,
        nombre: data.nombre,
        // De un hijo se heredan si no vienen; de un sobrino o un ahijado no
        // valen, y por eso el formulario los pide en blanco cuando no es hijo.
        ...(apellidosTrasCambio(data) ?? partirApellidos(manager.apellidos)),
        dni: data.dni || null,
        // La ficha del propio titular no tiene parentesco: no es de nadie.
        parentesco: esTitular ? null : (data.parentesco ?? null),
        fechaNacimiento: nacimiento,
        telefono: data.telefono || manager.telefono,
        email: data.email || manager.email,
        direccion: data.direccion || manager.direccion,
        poblacion: data.poblacion || manager.poblacion,
        codigoPostal: data.codigoPostal || manager.codigoPostal,
        // SEGURIDAD: un familiar nuevo NO entra en el censo hasta que Secretaría lo apruebe
        // (igual que el registro normal). Antes nacía activo y recibía cuotas sin control.
        activo: false
      }
    });

    // Auditoría: una solicitud de alta nueva desde el área familiar. Sin los datos
    // personales del familiar: basta el id de la ficha para encontrarlos.
    await AuditoriaService.log(ACCIONES_AUDITORIA.FAMILIAR_CREAR, meta ?? {}, 'hermano', creado.id, {
      despues: { estado: 'pendiente', esTitular }
    });
    return creado;
  }

  static async updateProfileIfOwned(hermanoId: number, managerUserId: number, data: UpdateHermanoDto, meta?: MetaDeAuditoria) {
    const hermano = await db.hermano.findFirst({
      where: { id: hermanoId, userId: managerUserId }
    });

    if (!hermano) return null; // Devolvemos null para que el Controller lance el 403 IDOR

    const dataToUpdate = sinFechasDelMismoDia(prepareUpdateData(data, USER_EDITABLE_FIELDS) as Record<string, unknown>, hermano);
    // La fecha de nacimiento de una ficha a cargo ya aprobada la corrige
    // Secretaría: cambiándola, el tutor hacía adulto a un menor para
    // emanciparlo (y con ello probar DNI y correos).
    if (dataToUpdate.fechaNacimiento !== undefined && hermano.activo && !hermano.esTitular) {
      throw new HttpError(MENSAJE_FECHA_DE_SECRETARIA, 409);
    }
    // La ficha del titular no es de nadie: no lleva parentesco.
    if (hermano.esTitular) delete dataToUpdate.parentesco;
    const apellidos = apellidosTrasCambio(data, hermano);
    if (apellidos) Object.assign(dataToUpdate, apellidos);
    // Domiciliar sin cuenta dejaría a Tesorería con un recibo que no puede cobrar.
    const forma = dataToUpdate.formaPagoPref ?? hermano.formaPagoPref;
    const cuenta = dataToUpdate.iban !== undefined ? dataToUpdate.iban : hermano.iban;
    if (forma === 'DOMICILIACION' && !cuenta) {
      throw new HttpError('Para domiciliar los recibos hace falta el IBAN de la cuenta.');
    }
    if (typeof dataToUpdate.dni === 'string' && dataToUpdate.dni !== hermano.dni) {
      contarIntentoDeDni(managerUserId);
      await exigirDniLibreSinDelatar(dataToUpdate.dni, hermanoId, meta);
    }
    const detalles = diferenciasFicha(hermano, dataToUpdate);
    // Domiciliar o cambiar de cuenta es autorizar el adeudo de nuevo: la
    // remesa manda esta fecha como la de firma del mandato.
    if (renuevaMandato(hermano, { formaPagoPref: String(forma), iban: typeof cuenta === 'string' ? cuenta : null })) {
      dataToUpdate.fechaMandato = new Date();
    }

    const actualizado = await db.hermano.update({
      where: { id: hermanoId },
      data: dataToUpdate as Prisma.HermanoUpdateInput
    });

    // Auditoría tras confirmar: el hermano cambió datos de su ficha o de la de un familiar
    if (detalles) await AuditoriaService.log(ACCIONES_AUDITORIA.FAMILIAR_ACTUALIZAR, meta ?? {}, 'hermano', hermanoId, detalles);
    const { iban: cuentaGuardada, ...resto } = actualizado;
    return { ...resto, ibanEnmascarado: enmascararIban(cuentaGuardada) };
  }

  /**
   * La familia retira un perfil desde el área de hermanos (Blindaje BOLA/IDOR).
   *
   * Dos casos distintos:
   * - Una SOLICITUD pendiente sin historial (nunca estuvo en el censo, sin
   *   recibos ni papeletas) se BORRA, igual que «Rechazar solicitud». Antes se le
   *   ponía fecha de baja y quedaba indistinguible de una baja real: el panel la
   *   contaba como alta y como baja.
   * - Cualquier otra ficha (activa, o pendiente con historial) se da de BAJA.
   */
  static async deleteProfileIfOwned(hermanoId: number, managerUserId: number, meta?: MetaDeAuditoria) {
    const check = await db.hermano.findFirst({
      where: { id: hermanoId, userId: managerUserId },
      include: { user: { select: { role: true, active: true } } }
    });

    if (!check) return null;
    // Una segunda baja reescribiría la fecha de la primera y borraría la historia.
    if (check.fechaBaja) throw new HttpError(HERMANO_ERRORS.PROFILE_ALREADY_DOWN);

    const fechaBaja = new Date();
    // Las categorías contables, antes de abrir la transacción (ver idCategoriaDeRecibos).
    const categoriaDevolucionesId = await idCategoriaDevoluciones();
    let canceladas: SolicitudConRecibo[] = [];
    const resultado = await transaccionReintentable(async (tx) => {
      // El estado y el historial se miran dentro de la transacción: con dos
      // clics seguidos, la segunda petición ve lo que ya hizo la primera.
      const actual = await tx.hermano.findFirst({
        where: { id: hermanoId, userId: managerUserId },
        select: {
          activo: true, fechaBaja: true, foto: true, certificadoBautismo: true,
          _count: { select: { recibos: true, papeletas: true, citas: true, transacciones: true, prendas: true } }
        }
      });
      if (!actual || actual.fechaBaja) throw new HttpError(HERMANO_ERRORS.PROFILE_ALREADY_DOWN);

      const pendiente = !actual.activo; // sin baja (visto arriba): el mismo criterio que FICHA_PENDIENTE
      const conHistorial = Object.values(actual._count).some((n) => n > 0);
      if (pendiente && !conHistorial) {
        await tx.hermano.delete({ where: { id: hermanoId } });
        // Retirar una solicitud no cambia nada de la cuenta: no se desactiva.
        return { retirada: true, cuentaDesactivada: false, documentos: documentosDe([actual]) };
      }

      // La baja familiar libera el número igual que la de secretaría
      // (darDeBajaHermano): una ficha de baja con número lo retenía sin estar en
      // el censo, y al reactivarla se le daba otro de todas formas. El estado va
      // en el `where` para que dos clics seguidos no den dos bajas.
      const { count } = await tx.hermano.updateMany({
        where: { id: hermanoId, fechaBaja: null },
        data: { activo: false, fechaBaja, numeroHermano: null, motivoBaja: 'VOLUNTARIA' }
      });
      if (count === 0) throw new HttpError(HERMANO_ERRORS.PROFILE_ALREADY_DOWN);
      // Lo que tenía pedido para salir y aún no ha pagado ni recogido.
      canceladas = await PapeletasService.cancelarSolicitudesDeBajaEnTransaccion(tx, [hermanoId], categoriaDevolucionesId);

      const restantes = await tx.hermano.count({
        where: { userId: managerUserId, activo: true }
      });

      // Solo las cuentas de hermano raso se desactivan al quedarse sin fichas.
      // Un ADMIN/SECRETARÍA que borra su propia ficha no debe perder el acceso al CMS.
      if (restantes === 0 && !esCuentaStaff(check.user.role)) {
        await tx.user.update({
          where: { id: managerUserId },
          data: { active: false }
        });
        return { retirada: false, cuentaDesactivada: true };
      }
      return { retirada: false, cuentaDesactivada: false };
    });

    if (resultado.retirada) {
      await borrarDocumentosPrivados(resultado.documentos ?? []);
      // Como en rechazarSolicitud: solo el estado, sin los datos de la ficha borrada.
      await AuditoriaService.log(ACCIONES_AUDITORIA.FAMILIAR_SOLICITUD_RETIRAR, meta ?? {}, 'hermano', hermanoId, {
        antes: { estado: 'pendiente' }, despues: { estado: 'eliminada' }
      });
      return { message: 'Solicitud retirada: el perfil pendiente se ha eliminado.' };
    }

    await AuditoriaService.log(ACCIONES_AUDITORIA.HERMANO_BAJA_FAMILIAR, meta ?? {}, 'hermano', hermanoId, {
      antes: { activo: check.activo, numeroHermano: check.numeroHermano, fechaBaja: null, cuentaActiva: check.user.active },
      despues: { activo: false, numeroHermano: null, fechaBaja: valorParaAuditoria(fechaBaja), cuentaActiva: check.user.active && !resultado.cuentaDesactivada }
    });
    await PapeletasService.registrarCanceladasPorBaja(canceladas, meta ?? {});

    return resultado.cuentaDesactivada
      ? { message: 'Perfil dado de baja. Usuario gestor desactivado.' }
      : { message: 'Perfil dado de baja correctamente.' };
  }


  /** El tutor emancipa a su dependiente y elige la contraseña. */
  static async emancipateProfile(hermanoId: number, managerUserId: number, dto: EmancipateHermanoDto, meta?: MetaDeAuditoria) {
    const hermano = await db.hermano.findFirst({
      where: { id: hermanoId, userId: managerUserId },
      include: { user: { select: { role: true } } }
    });
    if (!hermano) throw new HttpError(HERMANO_ERRORS.NOT_AUTHORIZED, 403);

    // Cada intento gasta uno de los DNI del día, también si solo cambia el
    // correo: los dos dicen si alguien tiene cuenta.
    contarIntentoDeDni(managerUserId);
    if (dto.newDni && !hermano.dni) await exigirDniLibreSinDelatar(dto.newDni, hermanoId, meta);
    return await emanciparFicha(hermano, dto.newEmail, dto.newDni, await encrypt(dto.newPassword), false, meta, true);
  }
  /**
   * Tronco común de la emancipación: las reglas y la transacción son las mismas
   * venga de donde venga. Lo único que cambia entre los dos caminos es cómo
   * nace la contraseña de la cuenta nueva.
   */
}
