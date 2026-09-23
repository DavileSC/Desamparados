import db from '../config/db';
import { Prisma, Role } from '@prisma/client';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { sanearPaginacion, respuestaPaginada } from '../domain/paginacion.js';
import {
  ADMIN_EDITABLE_FIELDS, FICHA_PENDIENTE, HERMANO_ERRORS, HERMANO_SAFE_SELECT,
  USER_EDITABLE_FIELDS, WHERE_SITUACION, comprobarDniLibre, emanciparFicha,
  esCuentaStaff, getNextNumeroHermano, prepareUpdateData, sinFechasDelMismoDia,
  transaccionReintentable, type FichaEmancipable, type SearchHermanoQuery,
} from './hermanos/comunes.js';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { esCuentaAnonimizada } from '../domain/cuenta-anonimizada';
import { borrarDocumentosPrivados, documentosDe } from '../utils/documentos-privados.js';

/**
 * La cola de Secretaría: quien pide entrar y quien pide volver.
 *
 * Aprobar reparte el número de hermano, rechazar borra lo que nunca llegó a
 * ser y las peticiones de vuelta se atienden reactivando o descartándolas. Aquí
 * también viven las dos operaciones sobre los números del censo: reordenarlos
 * una vez al año y cerrar los huecos.
 */
export class SolicitudesService {

  /**
   * Solicitudes pendientes: cuentas USER con alguna ficha sin aprobar (activo:false y sin
   * fecha de baja). Incluye tanto registros nuevos (cuenta inactiva) como familiares añadidos
   * por un hermano ya aprobado (cuenta activa, ficha pendiente).
   *
   * SEGURIDAD: `select` explícito. Antes se devolvía el objeto User completo con el hash
   * de contraseña, el secreto 2FA, el token de reset y el IBAN de las fichas.
   */
  static async getSolicitudesPendientes(query: { page?: unknown; limit?: unknown } = {}) {
    const paginacion = sanearPaginacion(query);
    const where: Prisma.UserWhereInput = {
      role: Role.USER,
      hermanos: {
        some: FICHA_PENDIENTE
      }
    };

    const [data, total] = await db.$transaction([
      db.user.findMany({
        where,
        select: {
          id: true, email: true, dni: true, nombre: true, apellidos: true, telefono: true,
          direccion: true, poblacion: true, codigoPostal: true, active: true, createdAt: true,
          hermanos: {
            where: FICHA_PENDIENTE,
            select: HERMANO_SAFE_SELECT
          }
        },
        orderBy: [
          { createdAt: 'asc' },
          { id: 'asc' } // Desempate: dos altas registradas en el mismo segundo —una familia
                        // que se apunta seguida desde el mismo formulario, o una siembra que
                        // las inserta de golpe— comparten `createdAt` y MariaDB las ordenaría
                        // a su antojo: una saldría en dos páginas y otra en ninguna.
        ],
        skip: paginacion.skip,
        take: paginacion.take
      }),
      db.user.count({ where })
    ]);

    return { ...respuestaPaginada(data, total, paginacion), reactivaciones: await SolicitudesService.getReactivacionesPedidas() };
  }

  /**
   * Quien se dio de baja y ha pedido volver desde la web.
   *
   * No son solicitudes de alta: su ficha ya estuvo en el censo y conserva su
   * `fechaBaja`, así que el `where` de arriba no las ve. Van aparte en la misma
   * respuesta porque Secretaría las atiende en la misma pantalla, pero con otro
   * botón: estas se resuelven con `reactivarHermano`, que les devuelve número
   * nuevo, no con `aprobarSolicitud`.
   *
   * Sin paginar a propósito: son pocas y conviene verlas todas de un vistazo.
   */
  static async getReactivacionesPedidas() {
    return db.hermano.findMany({
      where: { reactivacionSolicitada: { not: null } },
      orderBy: [{ reactivacionSolicitada: 'asc' }, { id: 'asc' }],
      select: {
        id: true, nombre: true, apellidos: true, dni: true, email: true,
        fechaBaja: true, reactivacionSolicitada: true,
      },
    });
  }

  /**
   * Secretaría descarta una petición de volver: la marca se quita y la ficha
   * sigue de baja, como estaba. No se borra nada, porque la ficha tiene
   * historia (recibos, papeletas) aunque su dueño ya no esté.
   */
  static async descartarReactivacion(hermanoId: number, meta?: MetaDeAuditoria) {
    const { count } = await db.hermano.updateMany({
      where: { id: hermanoId, reactivacionSolicitada: { not: null } },
      data: { reactivacionSolicitada: null },
    });
    if (count === 0) throw new NotFoundError('Esa petición de reactivación ya no está.');

    await AuditoriaService.log(ACCIONES_AUDITORIA.REACTIVACION_DESCARTAR, meta ?? {}, 'hermano', hermanoId, {
      despues: { peticionDeVuelta: 'descartada' },
    });
    return { message: 'Petición descartada. La ficha sigue de baja.' };
  }

  static async aprobarSolicitud(userId: number, meta?: MetaDeAuditoria) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { hermanos: { where: FICHA_PENDIENTE, select: { id: true, esTitular: true, sexo: true } } } // Solo las fichas pendientes
    });

    if (!user) throw new NotFoundError(HERMANO_ERRORS.USER_NOT_FOUND);
    if (user.hermanos.length === 0) {
      throw new HttpError(user.active ? HERMANO_ERRORS.NOTHING_TO_APPROVE : HERMANO_ERRORS.ALREADY_ACTIVE);
    }

    const fechaAlta = new Date();
    const { aprobadas, cuentaActivada } = await transaccionReintentable(async (tx) => {
      // Las fichas se vuelven a leer DENTRO de la transacción: con dos clics
      // seguidos en «Aprobar», la segunda petición no debe numerar otra vez las
      // que la primera ya aprobó (antes, número saltado o un 500).
      const pendientes = await tx.hermano.findMany({
        where: { userId, ...FICHA_PENDIENTE },
        orderBy: { id: 'asc' },
        select: { id: true }
      });

      // A cada ficha pendiente le damos de alta y le asignamos un número consecutivo.
      // (Las fichas ya activas no se tocan: no se les reasigna número.)
      const hechas: { id: number; numeroHermano: number }[] = [];
      for (const { id } of pendientes) {
        const nextNum = await getNextNumeroHermano(tx);
        // El estado en el `where` es la segunda red: si otra petición la aprobó
        // entre la lectura y esta escritura, no se toca (count = 0).
        const { count } = await tx.hermano.updateMany({
          where: { id, ...FICHA_PENDIENTE },
          data: { activo: true, fechaAlta, numeroHermano: nextNum }
        });
        if (count === 1) hechas.push({ id, numeroHermano: nextNum });
      }
      if (hechas.length === 0) throw new HttpError(HERMANO_ERRORS.NOTHING_TO_APPROVE);

      const cuenta = await tx.user.findUnique({ where: { id: userId }, select: { active: true } });
      if (cuenta && !cuenta.active) {
        await tx.user.update({ where: { id: userId }, data: { active: true } });
      }
      return { aprobadas: hechas, cuentaActivada: !!cuenta && !cuenta.active };
    });

    // Auditoría tras confirmar: alta oficial de miembros (trámite de Secretaría)
    await AuditoriaService.log(ACCIONES_AUDITORIA.SOLICITUD_APROBAR, meta ?? {}, 'user', userId, {
      antes: { cuentaActiva: !cuentaActivada, fichasPendientes: aprobadas.map((f) => f.id) },
      despues: { cuentaActiva: true, fichasAprobadas: aprobadas }
    });

    // Aviso al hermano, fuera de la transacción y con catch: aprobar no puede
    // deshacerse porque falle un correo (el fallo queda en la auditoría como
    // EMAIL_FALLIDO). Antes esta operación era muda y el hermano no se enteraba
    // ni de su alta ni de su número.
    EmailService.enviarAprobacionSolicitud(
      user.email,
      user.nombre,
      aprobadas.map((f) => f.numeroHermano),
      user.hermanos.find((h) => h.esTitular)?.sexo
    ).catch((err) => console.error('Error enviando el aviso de aprobación:', err));

    return { message: 'Solicitud aprobada. Los perfiles ya son oficiales y tienen número de hermano asignado.' };
  }

  /**
   * REORDENACIÓN DEL CENSO (Proceso anual de Secretaría)
   * Asigna un nuevo número correlativo a todos los hermanos activos
   * basándose estrictamente en su fecha de alta (antigüedad).
   */
  static async reordenarCenso(meta?: MetaDeAuditoria) {
    // Todo en UNA transacción para que, si falla a la mitad, no quede el censo corrupto.
    // `transaccionReintentable` (no `db.$transaction` a pelo): un reordenamiento
    // toca a todo el censo activo, y con eso hay más ocasión de chocar con una
    // aprobación o una baja que esté firmando a la vez.
    //
    // Las dos lecturas van DENTRO del cuerpo, y con `tx`: el cuerpo se reintenta,
    // y con la foto tomada fuera el reintento renumeraba sobre una realidad que
    // ya había cambiado. Quien entrase en el censo entre la lectura y el reintento
    // se comía el `numeroHermano: null` del `updateMany` de abajo, no estaba en la
    // lista que reparte 1..N, nadie le reasignaba número y el reintento confirmaba
    // una ficha `activo: true` sin número: el estado que el censo declara imposible.
    // Leyendo dentro, cada intento parte del censo real del momento.
    const { hermanosActivos, inactivosConNumero } = await transaccionReintentable(async (tx) => {
      // 1. TODOS los hermanos activos, ordenados por fecha de alta (los más antiguos primero)
      const hermanosActivos = await tx.hermano.findMany({
        where: { activo: true },
        orderBy: [{ fechaAlta: 'asc' }, { id: 'asc' }],
        select: { id: true, numeroHermano: true } // Traemos lo mínimo para no saturar la memoria
      });

      // Lanzar aquí aborta la transacción sin tocar nada, y el error sale del
      // servicio igual que cuando la lectura estaba fuera: un `HttpError` no es
      // P2002 ni un conflicto transitorio, así que `esChoqueReintentable` no lo
      // toma por un choque y no lo repite (fijado en test/numero-hermano.test.ts).
      if (hermanosActivos.length === 0) {
        throw new HttpError('No hay hermanos activos en el censo para reordenar.');
      }

      // Fichas fuera del censo que aún conservan número (bajas familiares de antes
      // de que se liberara): la reordenación se lo quita, y eso también se anota.
      const inactivosConNumero = await tx.hermano.findMany({
        where: { activo: false, numeroHermano: { not: null } },
        select: { id: true, numeroHermano: true }
      });

      // numeroHermano es @unique y MySQL comprueba el índice por sentencia: si asignamos
      // 1..N directamente, el primer número ya ocupado por otro hermano lanza P2002.
      // Solución: liberamos TODOS los números primero (NULL no colisiona) y luego asignamos.
      await tx.hermano.updateMany({ data: { numeroHermano: null } });

      for (let index = 0; index < hermanosActivos.length; index++) {
        await tx.hermano.update({
          where: { id: hermanosActivos[index].id },
          data: { numeroHermano: index + 1 }
        });
      }

      // Las dos listas salen para la auditoría y el recuento de abajo: son la foto
      // del intento que de verdad se confirmó, no la de una lectura anterior.
      return { hermanosActivos, inactivosConNumero };
    }, { timeout: 60_000 }); // Censos grandes: damos margen a la transacción

    // Auditoría tras confirmar: renumeración completa del censo (operación
    // delicada). Solo los números que cambian, con el de antes y el de después.
    const antes: Record<string, number | null> = {};
    const despues: Record<string, number | null> = {};
    hermanosActivos.forEach((h, index) => {
      if (h.numeroHermano !== index + 1) {
        antes[`hermano #${h.id}`] = h.numeroHermano;
        despues[`hermano #${h.id}`] = index + 1;
      }
    });
    for (const h of inactivosConNumero) {
      antes[`hermano #${h.id}`] = h.numeroHermano;
      despues[`hermano #${h.id}`] = null;
    }
    await AuditoriaService.log(ACCIONES_AUDITORIA.CENSO_REORDENAR, meta ?? {}, 'hermano', `total:${hermanosActivos.length}`, {
      totalProcesados: hermanosActivos.length,
      antes,
      despues
    });

    return {
      message: 'Censo reordenado con éxito.',
      totalProcesados: hermanosActivos.length
    };
  }

  /**
   * Da número de hermano a las fichas activas que no lo tienen, por antigüedad.
   *
   * No renumera a nadie: quien ya tiene número lo conserva, porque lleva
   * décadas con él y el censo real llega con su numeración hecha. Esto cierra
   * huecos, no reordena; para reordenar está `reordenarCenso`.
   *
   * Se lanza a mano desde Secretaría y no en el arranque del servidor: asignar
   * números es una decisión suya y tiene que quedar en la auditoría con quién
   * la tomó.
   */
  static async cerrarHuecosDeNumero(meta?: MetaDeAuditoria) {
    const asignados = await transaccionReintentable(async (tx) => {
      const sinNumero = await tx.hermano.findMany({
        where: { activo: true, numeroHermano: null },
        // Por antigüedad real. `id` desempata: dos altas del mismo día dejarían
        // el orden a merced de MariaDB y el resultado no sería repetible.
        orderBy: [{ fechaAlta: 'asc' }, { id: 'asc' }],
        select: { id: true }
      });
      if (sinNumero.length === 0) return [];

      let siguiente = await getNextNumeroHermano(tx);
      const hechas: { id: number; numeroHermano: number }[] = [];
      for (const { id } of sinNumero) {
        await tx.hermano.update({ where: { id }, data: { numeroHermano: siguiente } });
        hechas.push({ id, numeroHermano: siguiente });
        siguiente += 1;
      }
      return hechas;
    // Margen largo, como `reordenarCenso` (misma cifra, mismo motivo: «Censos
    // grandes: damos margen a la transacción»). Esta función existe para el
    // censo real que se va a importar, que puede traer cientos de fichas sin
    // número: un `update` por ficha, cada uno un viaje de ida y vuelta, agota
    // de sobra los 5 s por defecto de Prisma. Y si agota el timeout, Prisma
    // deshace TODO y no hay nada que reintentar (no es de los errores que
    // repite `esChoqueReintentable`), así que volver a pulsar fallaría igual.
    // `reactivarHermano` y `aprobarSolicitud` tocan una sola ficha cada vez y
    // no lo necesitan.
    }, { timeout: 60_000 });

    if (asignados.length > 0) {
      await AuditoriaService.log(ACCIONES_AUDITORIA.CENSO_CERRAR_HUECOS, meta ?? {}, 'hermano', `total:${asignados.length}`, { asignados });
    }
    return { asignados };
  }

  static async rechazarSolicitud(userId: number, meta?: MetaDeAuditoria) {
    // El email y el nombre se leen AQUÍ y no después: cuando la cuenta nunca
    // llegó a aprobarse, la transacción de abajo la borra entera y ya no hay a
    // quién escribir ni cómo llamarle.
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true, nombre: true, hermanos: { where: { esTitular: true }, select: { sexo: true }, take: 1 } }
    });
    if (!user) throw new NotFoundError(HERMANO_ERRORS.USER_NOT_FOUND);
    // SEGURIDAD: jamás se borra una cuenta del staff desde el panel de solicitudes
    if (esCuentaStaff(user.role)) throw new HttpError(HERMANO_ERRORS.CANNOT_TOUCH_STAFF, 403);

    const resultado = await transaccionReintentable(async (tx) => {
      // Se relee dentro de la transacción: con dos clics seguidos, la segunda
      // petición tiene que ver lo que ya borró la primera.
      const cuenta = await tx.user.findUnique({
        where: { id: userId },
        select: { active: true, hermanos: { select: { id: true, activo: true, fechaBaja: true, foto: true, certificadoBautismo: true } } }
      });
      if (!cuenta) throw new NotFoundError(HERMANO_ERRORS.USER_NOT_FOUND);

      const fichasPendientes = cuenta.hermanos.filter((h) => !h.activo && h.fechaBaja === null);
      const pendientes = fichasPendientes.map((h) => h.id);
      // La foto y el certificado de quien no entra no se guardan: se borran al terminar.
      const documentos = documentosDe(fichasPendientes);
      // Una cuenta con alguna ficha que llegó a estar en el censo (activa o de
      // baja) tiene historia —recibos, papeletas— aunque hoy esté bloqueada: se
      // rechazan sus fichas pendientes y la cuenta se queda.
      const tuvoAlta = cuenta.hermanos.length > pendientes.length;

      if (cuenta.active || tuvoAlta) {
        // Cuenta ya aprobada: solo se eliminan las fichas pendientes, la cuenta sigue viva
        if (pendientes.length === 0) throw new HttpError(HERMANO_ERRORS.CANNOT_DELETE_ACTIVE);
        await tx.hermano.deleteMany({ where: { id: { in: pendientes }, ...FICHA_PENDIENTE } });
        return {
          cuentaAprobada: cuenta.active, cuentaEliminada: false, fichas: pendientes, documentos,
          message: 'Perfiles pendientes rechazados y eliminados. La cuenta del usuario se mantiene.'
        };
      }

      // Cuenta nunca aprobada: se elimina por completo
      await tx.hermano.deleteMany({ where: { userId } });
      await tx.user.delete({ where: { id: userId } });
      return {
        cuentaAprobada: false, cuentaEliminada: true, fichas: pendientes, documentos,
        message: 'Solicitud rechazada y eliminada definitivamente.'
      };
    });

    await borrarDocumentosPrivados(resultado.documentos);

    // Auditoría tras confirmar: borrado definitivo de datos personales (solicitud
    // rechazada). Solo ids: guardar aquí el nombre desharía el borrado.
    await AuditoriaService.log(ACCIONES_AUDITORIA.SOLICITUD_RECHAZAR, meta ?? {}, 'user', userId, {
      antes: { cuentaAprobada: resultado.cuentaAprobada, fichasPendientes: resultado.fichas },
      despues: { cuentaEliminada: resultado.cuentaEliminada, fichasEliminadas: resultado.fichas }
    });

    // Aviso con los datos leídos antes del borrado. Fuera de la transacción y
    // con catch: el rechazo ya está escrito y un correo no puede deshacerlo.
    EmailService.enviarBajaORechazo(user.email, user.nombre, 'rechazo', false, user.hermanos[0]?.sexo)
      .catch((err) => console.error('Error enviando el aviso de rechazo:', err));

    return { message: resultado.message };
  }
}
