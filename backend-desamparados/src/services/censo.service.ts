import crypto from 'crypto';
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
import { UpdateAdminHermanoDto, type MotivoBaja } from '../dtos/hermano.dto';
import { encrypt } from '../utils/bcrypt.handle';
import { comprobarBajaNoFutura, comprobarFechasHermano, diaDeHoy, instanteDeDia } from '../domain/fechas-hermano';
import { esCuentaAnonimizada } from '../domain/cuenta-anonimizada';
import { diferenciasFicha, valorParaAuditoria } from '../domain/cambios-ficha';
import { apellidosTrasCambio } from '../domain/apellidos.js';
import { condicionBusqueda } from '../domain/busqueda-texto.js';
import { filtrosAvanzados } from '../domain/filtros-censo.js';
import { ORDENES_CENSO, ordenDe } from '../domain/ordenacion.js';
import { EmailService } from './email.service';
import { PapeletasService, type SolicitudConRecibo } from './procesion/papeletas.service.js';
import { idCategoriaDevoluciones } from './recibos/comunes.js';

/**
 * El censo entero, como lo ve Secretaría: buscarlo, leer una ficha, corregirla,
 * dar de baja y reactivar.
 *
 * Las altas no están aquí: quien todavía no es hermano vive en la cola de
 * solicitudes (`solicitudes.service`), que es la que reparte los números.
 */
export class CensoService {

  /**
   * Las condiciones de la búsqueda del censo, sin la paginación: las usan el
   * listado y lo que se hace con una búsqueda entera (las cartas a quienes
   * salen en ella). Un solo sitio para que las dos elijan a los mismos.
   */
  static whereDelCenso(query: SearchHermanoQuery): Prisma.HermanoWhereInput {
    // Un número suelto busca también al hermano con ese número: en la
    // secretaría a un hermano se le conoce tanto por el número como por el nombre.
    const texto = query.q?.trim() ?? '';
    const numero = /^\d{1,9}$/.test(texto) ? Number(texto) : null;
    const busqueda = condicionBusqueda(texto, ['nombre', 'apellidos', 'dni', 'email']);

    const where: Prisma.HermanoWhereInput = numero !== null
      ? { OR: [busqueda, { numeroHermano: numero }] }
      : { ...busqueda };

    if (query.tunica) where.tunica = { contains: query.tunica };
    if (query.puesto) where.puesto = { contains: query.puesto };
    if (query.activo) where.activo = query.activo === 'true';
    if (query.tieneTunicaPropia) where.tieneTunicaPropia = query.tieneTunicaPropia === 'true';
    if (query.estado) Object.assign(where, WHERE_SITUACION[query.estado]);
    if (query.numero) where.numeroHermano = query.numero === 'con' ? { not: null } : null;
    // Se suman a las de la búsqueda, que también van en AND: asignarlas encima
    // borraba lo buscado.
    const avanzados = filtrosAvanzados(query, new Date());
    if (avanzados.length) where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), ...avanzados];
    return where;
  }

  static async searchHermanos(query: SearchHermanoQuery) {
    const paginacion = sanearPaginacion(query);
    const where = CensoService.whereDelCenso(query);

    const [data, total] = await db.$transaction([
      db.hermano.findMany({
        where, skip: paginacion.skip, take: paginacion.take,
        orderBy: ordenDe(ORDENES_CENSO, query.orden),
        // `select` y no `include`: con `include` salían todos los escalares de la
        // ficha, IBAN, titular de la cuenta y forma de pago incluidos, a cualquiera
        // que abriera el buscador del censo.
        select: { ...HERMANO_SAFE_SELECT, user: { select: { telefono: true, email: true } } }
      }),
      db.hermano.count({ where })
    ]);

    return respuestaPaginada(data, total, paginacion);
  }

  // Ver todos los hermanos
  static async getAllHermanos(query: { page?: unknown; limit?: unknown } = {}) {
    const paginacion = sanearPaginacion(query);

    const [data, total] = await db.$transaction([
      db.hermano.findMany({
        where: { activo: true },
        orderBy: [
          { numeroHermano: 'asc' }, // Ordenamos por número en lugar de apellidos
          { id: 'asc' } // Desempate: `numeroHermano` es @unique pero opcional, y en MariaDB
                        // el índice único no impide varios NULL, así que las fichas activas
                        // aún sin número quedarían en orden arbitrario entre la página 1 y
                        // la 2: una saldría dos veces y otra ninguna.
        ],
        skip: paginacion.skip,
        take: paginacion.take,
        // Sin datos bancarios, como el buscador (ver searchHermanos).
        select: {
          ...HERMANO_SAFE_SELECT,
          user: { select: { nombre: true, apellidos: true, telefono: true } }
        }
      }),
      db.hermano.count({ where: { activo: true } })
    ]);

    return respuestaPaginada(data, total, paginacion);
  }

  // Ver un hermano por ID
  static async getHermanoById(id: number) {
    return await db.hermano.findUnique({
      where: { id },
      select: {
        ...HERMANO_SAFE_SELECT,
        user: {
          select: {
            email: true, telefono: true,
            // Las otras fichas de la misma cuenta: el titular y quienes están a
            // su cargo, con su parentesco. La ficha del censo las enseña para
            // pasar de una a otra sin volver a buscar.
            hermanos: {
              where: { id: { not: id } },
              orderBy: [{ esTitular: 'desc' }, { fechaNacimiento: 'asc' }],
              select: {
                id: true, nombre: true, apellidos: true, fechaNacimiento: true,
                numeroHermano: true, esTitular: true, parentesco: true, activo: true, fechaBaja: true
              }
            }
          }
        },
        // Lo que tiene del ropero ahora mismo, no su historial.
        prendas: {
          where: { estado: 'PRESTADA' },
          orderBy: { numero: 'asc' },
          select: { id: true, numero: true, tipo: true, talla: true }
        },
        recibos: {
          orderBy: { year: 'desc' },
          select: {
            id: true, year: true, concepto: true, importe: true, fechaEmision: true,
            tipo: true, estado: true, fechaPago: true, metodoPago: true,
            observaciones: true, createdAt: true, updatedAt: true
          }
        },
        papeletas: {
          orderBy: { year: 'desc' },
          select: {
            id: true, year: true, puesto: true, tramo: true, numero: true,
            numTunicaAsignada: true, numCapiroteAsignado: true, observaciones: true,
            reciboId: true, citaId: true, createdAt: true, updatedAt: true
          }
        }
      }
    });
  }

  /**
   * Edición de la ficha desde el CMS. No da altas ni bajas (ver
   * ADMIN_EDITABLE_FIELDS): corrige datos, y cada cambio queda en la auditoría
   * con su valor anterior.
   */
  static async updateAdminMode(id: number, data: UpdateAdminHermanoDto, meta?: MetaDeAuditoria) {
    const pedidos = prepareUpdateData(data, ADMIN_EDITABLE_FIELDS) as Record<string, unknown>;
    // El esquema ya no admite null, pero el servicio no sabe quién le llama:
    // quitar la baja es reactivar, y eso tiene su propia operación.
    if (pedidos.fechaBaja === null) throw new HttpError('Para quitar la baja de un hermano, usa «Reactivar».');

    // Lectura, comprobaciones y escritura en la MISMA transacción: si mientras
    // tanto alguien da de baja o reactiva la ficha, las reglas de abajo se
    // evaluarían sobre un estado que ya no existe (una corrección de la fecha
    // de baja podía dejar una ficha activa con fecha de baja).
    const { actualizado, detalles } = await transaccionReintentable(async (tx) => {
      const actual = await tx.hermano.findUnique({ where: { id }, select: HERMANO_SAFE_SELECT });
      if (!actual) throw new NotFoundError(HERMANO_ERRORS.HERMANO_NOT_FOUND);

      const cambios = sinFechasDelMismoDia(pedidos, actual);
      const apellidos = apellidosTrasCambio(data, actual);
      if (apellidos) Object.assign(cambios, apellidos);
      if (actual.esTitular) delete cambios.parentesco;
      const deBaja = !actual.activo && actual.fechaBaja !== null;

      // La fecha de baja solo se corrige donde ya hay una baja. Ponérsela a una
      // ficha activa dejaba a alguien de baja pero activo, y a una pendiente la
      // sacaba de las solicitudes sin rechazarla.
      if (cambios.fechaBaja !== undefined) {
        if (!deBaja) throw new HttpError(HERMANO_ERRORS.BAJA_ONLY_WHEN_DOWN);
        comprobarBajaNoFutura(cambios.fechaBaja as Date);
      }

      // El número lo dan «Aprobar» y «Reactivar»: puesto a mano en una ficha
      // pendiente o de baja, reservaría un número a quien no está en el censo.
      if (cambios.numeroHermano !== undefined && cambios.numeroHermano !== actual.numeroHermano) {
        if (!actual.activo) throw new HttpError(HERMANO_ERRORS.NUMBER_ONLY_ACTIVE);
        const ocupado = await tx.hermano.findFirst({
          where: { numeroHermano: cambios.numeroHermano as number, id: { not: id } },
          select: { id: true }
        });
        if (ocupado) throw new HttpError(HERMANO_ERRORS.NUMBER_DUPLICATE, 409);
      }

      if (typeof cambios.dni === 'string' && cambios.dni !== actual.dni) {
        await comprobarDniLibre(cambios.dni, id, tx);
      }

      // La baja se compara con el alta que vaya a quedar en la ficha, no solo con
      // la que venga en el cuerpo: cambiar únicamente una de las dos es lo habitual.
      comprobarFechasHermano(
        (cambios.fechaAlta as Date | undefined) ?? actual.fechaAlta,
        (cambios.fechaBaja as Date | undefined) ?? actual.fechaBaja
      );

      const diferencias = diferenciasFicha(actual, cambios);
      // Nada que cambie de verdad: no se escribe (ni se reescriben fechas).
      if (!diferencias) return { actualizado: actual, detalles: null };

      // Escritura condicionada al estado que se ha leído (alta, baja y número).
      // Con la aislamiento de instantáneas de MariaDB 11.8, una escritura cruzada
      // suele saltar antes como error 1020 y la transacción se repite con el
      // estado nuevo; esta condición es la red por si no: si la ficha ya no
      // está como se leyó, no se toca y se avisa.
      const { count } = await tx.hermano.updateMany({
        where: { id, activo: actual.activo, fechaBaja: actual.fechaBaja, numeroHermano: actual.numeroHermano },
        data: cambios as Prisma.HermanoUpdateManyMutationInput
      });
      if (count === 0) throw new HttpError(HERMANO_ERRORS.FICHA_CHANGED, 409);

      // `select` también aquí: la respuesta del PUT devolvía la ficha entera, IBAN incluido.
      const releida = await tx.hermano.findUnique({ where: { id }, select: HERMANO_SAFE_SELECT });
      return { actualizado: releida!, detalles: diferencias };
    });

    // Auditoría tras confirmar (fuera del cuerpo que se reintenta), y solo si
    // algo cambió de verdad.
    if (detalles) await AuditoriaService.log(ACCIONES_AUDITORIA.HERMANO_ACTUALIZAR, meta ?? {}, 'hermano', id, detalles);
    return actualizado;
  }

  /**
   * Vuelve a dar de alta a un hermano que estaba de baja: número nuevo al final
   * de la cola, alta de hoy y su cuenta de nuevo con acceso.
   *
   * Si la cuenta se anonimizó por el derecho de supresión (RGPD), la ficha
   * vuelve al censo pero la cuenta NO se reabre: su titular pidió que se
   * borraran sus datos y la cuenta ya no tiene ni correo ni contraseña que
   * sirvan. Si vuelve a necesitar acceso, se le crea una cuenta nueva con la
   * emancipación, que le manda un enlace a un correo que dé él.
   */
  static async reactivarHermano(hermanoId: number, meta?: MetaDeAuditoria) {
    const hermano = await db.hermano.findUnique({
      where: { id: hermanoId },
      include: { user: { select: { email: true, dni: true, active: true } } }
    });
    if (!hermano) throw new NotFoundError(HERMANO_ERRORS.HERMANO_NOT_FOUND);
    if (hermano.activo) throw new HttpError(HERMANO_ERRORS.HERMANO_ALREADY_ACTIVE);
    // Una solicitud pendiente no se «reactiva»: nunca estuvo activa. Antes esta
    // ruta la aprobaba sin pasar por Solicitudes.
    if (hermano.fechaBaja === null) throw new HttpError(HERMANO_ERRORS.PENDING_USE_REQUESTS);

    const anonimizada = esCuentaAnonimizada(hermano.user);
    const fechaAlta = new Date();

    const { numero, cuentaActiva } = await transaccionReintentable(async (tx) => {
      // Le mandamos al final de la cola
      const nextNum = await getNextNumeroHermano(tx);

      // El estado va en el `where`: InnoDB lo evalúa sobre la última versión
      // confirmada, así que con dos clics seguidos la segunda petición no
      // encuentra nada que reactivar y no se lleva otro número.
      const { count } = await tx.hermano.updateMany({
        where: { id: hermanoId, activo: false, fechaBaja: { not: null } },
        data: {
          activo: true,
          fechaBaja: null, // Limpiamos la fecha de baja
          motivoBaja: null,
          // Si se dio por fallecido por error, volver lo deshace del todo.
          fechaDefuncion: null,
          fechaAlta, // Nueva fecha de alta
          numeroHermano: nextNum,
          // Si volvió porque lo pidió desde la web, la petición queda atendida
          // y sale de la cola de Secretaría.
          reactivacionSolicitada: null
        }
      });
      if (count === 0) throw new HttpError(HERMANO_ERRORS.HERMANO_ALREADY_ACTIVE);

      // Aseguramos que su cuenta de usuario vuelva a tener acceso, salvo que
      // esté anonimizada (ver el comentario de la función).
      if (!anonimizada && !hermano.user.active) {
        await tx.user.update({
          where: { id: hermano.userId },
          data: { active: true }
        });
      }

      return { numero: nextNum, cuentaActiva: anonimizada ? hermano.user.active : true };
    });

    // Auditoría tras confirmar: reactivación de un miembro del censo
    await AuditoriaService.log(ACCIONES_AUDITORIA.HERMANO_REACTIVAR, meta ?? {}, 'hermano', hermanoId, {
      antes: {
        activo: false, numeroHermano: null, fechaAlta: valorParaAuditoria(hermano.fechaAlta),
        fechaBaja: valorParaAuditoria(hermano.fechaBaja), cuentaActiva: hermano.user.active
      },
      despues: {
        activo: true, numeroHermano: numero, fechaAlta: valorParaAuditoria(fechaAlta),
        fechaBaja: null, cuentaActiva
      },
      ...(anonimizada ? { cuentaAnonimizada: true } : {})
    });

    if (anonimizada) {
      return {
        message: `Hermano reactivado con el número ${numero}. Su cuenta de acceso se eliminó a petición suya (RGPD) y sigue cerrada: si necesita entrar en la web, créale una cuenta nueva desde su ficha.`
      };
    }
    return { message: `Hermano reactivado correctamente. Se le ha asignado el nuevo número ${numero}.` };
  }

  /**
   * Baja desde secretaría. `fechaBajaTexto` (AAAA-MM-DD) permite anotar la baja
   * con el día en que el hermano avisó; sin ella, la baja es de ahora.
   */
  static async darDeBajaHermano(hermanoId: number, meta?: MetaDeAuditoria, fechaBajaTexto?: string, motivo?: MotivoBaja, fechaDefuncionTexto?: string) {
    const hermano = await db.hermano.findUnique({
      where: { id: hermanoId },
      // `user.email` es el respaldo del aviso de baja: las fichas antiguas
      // pueden no tener dirección propia, y la de un menor es la del tutor.
      include: { user: { select: { role: true, active: true, email: true } } }
    });
    if (!hermano) throw new NotFoundError(HERMANO_ERRORS.HERMANO_NOT_FOUND);
    if (!hermano.activo) {
      // Una solicitud pendiente se rechaza, no se da de baja: nunca estuvo en el censo.
      throw new HttpError(hermano.fechaBaja === null ? HERMANO_ERRORS.PENDING_USE_REQUESTS : HERMANO_ERRORS.HERMANO_ALREADY_DOWN);
    }

    // Un día pasado se guarda como el comienzo de ese día en Madrid; la baja de
    // hoy (o sin fecha), con la hora real, como los apuntes contables del día.
    const fechaBaja = fechaBajaTexto && fechaBajaTexto !== diaDeHoy() ? instanteDeDia(fechaBajaTexto, 'fechaBaja') : new Date();
    comprobarBajaNoFutura(fechaBaja);
    comprobarFechasHermano(hermano.fechaAlta, fechaBaja);
    // Por fallecimiento, el día del óbito: el que se diga o, si no, el de la baja.
    let fechaDefuncion: Date | null = null;
    if (motivo === 'FALLECIMIENTO') {
      fechaDefuncion = fechaDefuncionTexto ? instanteDeDia(fechaDefuncionTexto, 'fechaDefuncion') : fechaBaja;
      comprobarBajaNoFutura(fechaDefuncion);
    }

    // Las categorías contables, antes de abrir la transacción (ver idCategoriaDeRecibos).
    const categoriaDevolucionesId = await idCategoriaDevoluciones();
    let canceladas: SolicitudConRecibo[] = [];
    const cuentaBloqueada = await transaccionReintentable(async (tx) => {
      // El estado va en el `where` (ver reactivarHermano): dos clics seguidos
      // no dan dos bajas.
      const { count } = await tx.hermano.updateMany({
        where: { id: hermanoId, activo: true },
        // Liberamos el número: al reactivar se le asigna uno nuevo (final de la cola)
        data: { activo: false, fechaBaja, numeroHermano: null, motivoBaja: motivo ?? null, ...(fechaDefuncion && { fechaDefuncion }) }
      });
      if (count === 0) throw new HttpError(HERMANO_ERRORS.HERMANO_ALREADY_DOWN);
      // Lo que tenía pedido para salir y aún no ha pagado ni recogido.
      canceladas = await PapeletasService.cancelarSolicitudesDeBajaEnTransaccion(tx, [hermanoId], categoriaDevolucionesId);

      const restantes = await tx.hermano.count({
        where: { userId: hermano.userId, activo: true }
      });

      // SEGURIDAD: nunca bloqueamos la cuenta de un miembro del staff desde aquí.
      // Antes, Secretaría podía dejar sin acceso al ADMIN dando de baja su ficha.
      if (restantes === 0 && !esCuentaStaff(hermano.user.role)) {
        await tx.user.update({
          where: { id: hermano.userId },
          data: { active: false }
        });
        return true;
      }
      return false;
    });

    // Auditoría tras confirmar: baja de un miembro del censo. El número que tenía
    // queda aquí, porque en la ficha se borra.
    await AuditoriaService.log(ACCIONES_AUDITORIA.HERMANO_BAJA, meta ?? {}, 'hermano', hermanoId, {
      antes: { activo: true, numeroHermano: hermano.numeroHermano, fechaBaja: null, cuentaActiva: hermano.user.active },
      despues: { activo: false, numeroHermano: null, fechaBaja: valorParaAuditoria(fechaBaja), motivoBaja: motivo ?? null, cuentaActiva: hermano.user.active && !cuentaBloqueada }
    });
    await PapeletasService.registrarCanceladasPorBaja(canceladas, meta ?? {});

    // Aviso de la baja, fuera de la transacción y con catch: la baja ya está
    // escrita y un correo no puede deshacerla.
    // Tras un fallecimiento no se escribe: el correo le llegaría a la familia
    // como una carta de trámite dirigida a quien ha muerto.
    const destino = motivo === 'FALLECIMIENTO' ? null : hermano.email || hermano.user.email;
    if (destino) {
      EmailService.enviarBajaORechazo(destino, hermano.nombre, 'baja', motivo === 'IMPAGO', hermano.sexo)
        .catch((err) => console.error('Error enviando el aviso de baja:', err));
    }

    return cuentaBloqueada
      ? { message: `${hermano.nombre} ${hermano.apellidos} dado de baja. Se ha bloqueado el acceso a la App porque no le quedan perfiles activos.` }
      : { message: `${hermano.nombre} ${hermano.apellidos} dado de baja. El usuario mantiene el acceso.` };
  }

  /**
   * Secretaría emancipa: la contraseña no la elige nadie, va un enlace al
   * hermano. Quien está en el mostrador no puede saber la contraseña de otro.
   */
  static async emancipateByStaff(hermanoId: number, dto: { newEmail: string; newDni?: string }, meta?: MetaDeAuditoria) {
    const hermano = await db.hermano.findUnique({
      where: { id: hermanoId },
      include: { user: { select: { role: true } } }
    });
    if (!hermano) throw new NotFoundError(HERMANO_ERRORS.HERMANO_NOT_FOUND);

    // Una contraseña aleatoria que nadie conoce: la cuenta se abre con el enlace.
    const inutilizable = await encrypt(crypto.randomBytes(32).toString('hex'));
    return await emanciparFicha(hermano, dto.newEmail, dto.newDni, inutilizable, true, meta);
  }
}
