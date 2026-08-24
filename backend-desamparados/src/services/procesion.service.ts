import { CrearTurnoDto } from './../dtos/procesion.dto';
import db from '../config/db';
import { EstadoCita, EstadoPago, TipoRecibo } from '@prisma/client';
import { AvisarAsistenciaDto, CrearInscripcionManualDto } from '../dtos/procesion.dto';
import { EmailService } from './email.service';
import { AuditService, AUDIT_ACTIONS, AuditMeta } from './audit.service';

export class ProcesionService {

  // ============================================================
  //  ZONA WEB / APP (Para el Hermano)
  // ============================================================

  /**
   * Obtener días disponibles y cuánta gente va a ir.
   */
  static async getDiasDisponibles() {
    const turnos = await db.turno.findMany({
      where: {
        activo: true,
        fecha: { gte: new Date() } // Solo futuros
      },
      orderBy: { fecha: 'asc' },
      include: {
        _count: {
          select: { citas: true } // Contamos cuántos han dicho que van
        }
      }
    });

    return turnos.map(t => ({
      id: t.id,
      fecha: t.fecha,
      horaInicio: t.horaInicio,
      horaFin: t.horaFin,
      // Info útil para el usuario: "Hay 15 apuntados"
      genteApuntada: t._count.citas
    }));
  }

  /**
   * El hermano avisa: "Voy a ir este día".
   */
  static async avisarAsistencia(userId: number, { turnoId, hermanoId }: AvisarAsistenciaDto) {

    // 0. BARRERA BOLA: Verificar que este hermano pertenece a este usuario
    const checkPropiedad = await db.hermano.findFirst({
      where: { id: hermanoId, userId: userId }
    });
    if (!checkPropiedad) {
      throw new Error('No tienes permisos para apuntar a este cofrade.');
    }

    const year = new Date().getFullYear();

    // 1. Verificar si ya tiene papeleta este año
    const yaTienePapeleta = await db.papeletaSitio.findFirst({
      where: { hermanoId, year }
    });
    if (yaTienePapeleta) throw new Error('Ya tienes tu papeleta de este año.');

    // 2. Verificar si ya avisó para otro día (evitar duplicados)
    const avisoPrevio = await db.cita.findFirst({
      where: {
        hermanoId,
        estado: { not: EstadoCita.CANCELADA },
        turno: { fecha: { gte: new Date(year, 0, 1) } }
      }
    });
    if (avisoPrevio) throw new Error('Ya tienes un día reservado.');

    // 3. Crear el aviso
    return await db.cita.create({
      data: {
        turnoId,
        hermanoId,
        estado: EstadoCita.RESERVADA
      }
    });
  }

  /**
   * El hermano cancela su cita por si le surge un imprevisto.
   */
  static async cancelarAsistencia(userId: number, citaId: number) {
    // Seguridad: Buscar la cita asegurando que el hermano pertenece al usuario logueado
    const cita = await db.cita.findFirst({
      where: {
        id: citaId,
        hermano: { userId: userId }
      }
    });

    if (!cita) throw new Error('Cita no encontrada o no autorizada.');
    if (cita.estado !== EstadoCita.RESERVADA) throw new Error('Esta cita ya no se puede cancelar.');

    return await db.cita.update({
      where: { id: citaId },
      data: { estado: EstadoCita.CANCELADA }
    });
  }

  /**
   * El hermano ve su historial de salidas (y las de sus hijos).
   */
  static async getMisPapeletas(userId: number) {
    return await db.papeletaSitio.findMany({
      where: {
        hermano: { userId: userId }
      },
      include: {
        hermano: { select: { nombre: true, apellidos: true } },
        recibo: { select: { estado: true, importe: true } }
      },
      orderBy: [
        { year: 'desc' },
        { hermano: { nombre: 'asc' } }
      ]
    });
  }


  // ============================================================
  //  ZONA ADMIN (La mesa de reparto)
  // ============================================================

  /**
   * Listado de quién esperamos HOY.
   */
  static async getAsistentesDelDia(fecha: Date) {
    const start = new Date(fecha.setHours(0, 0, 0, 0));
    const end = new Date(fecha.setHours(23, 59, 59, 999));

    return await db.cita.findMany({
      where: {
        turno: { fecha: { gte: start, lte: end } },
        estado: EstadoCita.RESERVADA
      },
      include: {
        hermano: {
          // Traemos datos clave para identificarlo rápido
          select: { id: true, nombre: true, apellidos: true, dni: true, tieneTunicaPropia: true, tunica: true }
        }
      }
    });
  }

  /**
   * EL NÚCLEO DEL SISTEMA: Inscribir, Cobrar y Dar Ropa.
   * Funciona para gente con cita (pasando citaId) y sin cita (citaId null).
   */
  static async inscribirYFacturar(data: CrearInscripcionManualDto, meta?: AuditMeta) {
    const yearActual = new Date().getFullYear();

    // Comprobar seguridad: ¿Ya la sacó?
    const existe = await db.papeletaSitio.findUnique({
      where: { hermanoId_year: { hermanoId: data.hermanoId, year: yearActual } }
    });
    if (existe) throw new Error('Este hermano ya tiene papeleta este año.');

    // ================== CÁLCULO DE IMPORTE SEGURO (Backend) ==================
    // 1. Obtenemos los precios de la configuración y los datos del hermano en paralelo.
    const [precioBaseConfig, precioAlquilerConfig, hermano] = await Promise.all([
      db.configuracion.findUnique({ where: { key: 'precio_papeleta_sitio' } }),
      db.configuracion.findUnique({ where: { key: 'precio_alquiler_tunica' } }),
      db.hermano.findUnique({ 
        where: { id: data.hermanoId },
        include: { user: { select: { email: true } } } // Incluimos el email para el paso final
      })
    ]);

    if (!hermano) throw new Error('No se encontró al hermano para calcular el importe.');

    // 2. Parseo seguro con valores por defecto para evitar fallos si no está configurado.
    const precioBase = Number(precioBaseConfig?.value) || 30; // Fallback a 30€
    const precioAlquiler = Number(precioAlquilerConfig?.value) || 15; // Fallback a 15€

    // 3. Calculamos el importe final.
    const importeFinal = hermano.tieneTunicaPropia ? precioBase : precioBase + precioAlquiler;

    // INICIO TRANSACCIÓN (Todo o Nada)
    const result = await db.$transaction(async (tx) => {

// 1. Crear RECIBO (Dinero o Exención)
      const recibo = await tx.recibo.create({
        data: {
          year: yearActual,
          concepto: `Papeleta Sitio ${yearActual}`,
          importe: importeFinal, // Usamos el importe calculado y seguro
          tipo: TipoRecibo.PAPELETA_SITIO,
          
          // LA MAGIA: Si cuesta 0€, ya está pagado. Si cuesta dinero, se cobra en mesa.
          estado: EstadoPago.PAGADO,

          metodoPago: data.metodoPago,
          fechaPago: new Date(),
          hermanoId: data.hermanoId
        }
      });

      // 2. Crear PAPELETA (Sitio + Ropa)
      const papeleta = await tx.papeletaSitio.create({
        data: {
          year: yearActual,
          puesto: data.puesto,
          tramo: data.tramo,
          numTunicaAsignada: data.numTunicaAsignada,
          numCapiroteAsignado: data.numCapiroteAsignado,
          observaciones: data.observaciones,

          hermanoId: data.hermanoId,
          reciboId: recibo.id,

          // Si venía con cita, guardamos el link para historial
          citaId: data.citaId ?? undefined
        }
      });

      // 3. Si había cita previa, la cerramos
      if (data.citaId) {
        await tx.cita.update({
          where: { id: data.citaId },
          data: { estado: EstadoCita.ATENDIDA }
        });
      }

      return { recibo, papeleta };
    });

    // Auditoría: cobro + papeleta (dinero de la Hermandad)
    AuditService.log(AUDIT_ACTIONS.INSCRIPCION_FACTURAR, meta ?? {}, 'hermano', data.hermanoId);

    // 4. Enviar Email (Fuera de la transacción)
    if (hermano?.user?.email) {
       EmailService.enviarPapeleta(hermano.user.email, hermano.nombre, {
           year: yearActual,
           concepto: result.recibo.concepto,
           importe: `${importeFinal.toFixed(2)} €`,
           puesto: result.papeleta.puesto,
           tramo: result.papeleta.tramo || '',
           observaciones: result.papeleta.observaciones || '',
           fechaSalida: 'Viernes Santo', // Configurable
           horaSalida: '19:00',
           accesoPuerta: 'Casa Hermandad'
       }).catch(console.error);
    }

    return result;
  }

  /**
   * Emergencia: El hermano devuelve la túnica por enfermedad o hubo un error al cobrar.
   */
  static async anularPapeleta(papeletaId: number, meta?: AuditMeta) {
    const papeleta = await db.papeletaSitio.findUnique({ where: { id: papeletaId } });
    if (!papeleta) throw new Error('Papeleta no encontrada');

    // Auditoría: anulación implica devolución de dinero
    AuditService.log(AUDIT_ACTIONS.PAPELETA_ANULAR, meta ?? {}, 'papeleta', papeletaId);

    // Transacción: Anulamos la papeleta y el recibo al mismo tiempo
    return await db.$transaction(async (tx) => {
      // 1. El recibo pasa a ANULADO para que tesorería sepa que ese dinero se devolvió o no vale
      await tx.recibo.update({
        where: { id: papeleta.reciboId },
        data: { estado: EstadoPago.ANULADO, observaciones: 'Anulado por devolución de papeleta.' }
      });

      // 2. Liberamos la cita (si la hubo) por si quiere volver otro día
      if (papeleta.citaId) {
        await tx.cita.update({
          where: { id: papeleta.citaId },
          data: { estado: EstadoCita.CANCELADA }
        });
      }

      // 3. Borramos la papeleta (liberando el hueco en la procesión y el número de túnica)
      await tx.papeletaSitio.delete({
        where: { id: papeletaId }
      });

      return { message: 'Papeleta anulada y recibo cancelado correctamente. Ropa liberada.' };
    });
  }


  // ============================================================
  //  ZONA ADMIN (Listados Finales y Mantenimiento)
  // ============================================================

  /**
   * Genera el censo de la procesión para los diputados de tramo / mayordomos.
   */
  static async getListadoProcesion(year: number) {
    return await db.papeletaSitio.findMany({
      where: {
        year: year,
        // Opcional: Solo traer los que hayan pagado o estén exentos
        // recibo: { estado: { in: [EstadoPago.PAGADO, EstadoPago.EXENTO] } } 
      },
      include: {
        hermano: {
          select: { nombre: true, apellidos: true, telefono: true, alturaHombro: true }
        }
      },
      // Los ordenamos primero por tramo y luego por su número de orden
      orderBy: [
        { tramo: 'asc' },
        { numero: 'asc' }
      ]
    });
  }

  /**
   * Mantenimiento: Procesa a los hermanos que dijeron que venían pero no lo hicieron.
   * @param fechaLimite Fecha hasta la que revisar
   * @param esCierreDefinitivo Si es TRUE, limpia las citas sin mandar correos de "vuelve a pedir cita".
   */
  static async procesarAusencias(fechaLimite: Date = new Date(), esCierreDefinitivo: boolean = false) {
    const ausentes = await db.cita.findMany({
      where: {
        estado: EstadoCita.RESERVADA,
        turno: { fecha: { lt: fechaLimite } },
        papeleta: null
      },
      include: {
        hermano: { include: { user: true } },
        turno: true
      }
    });

    if (ausentes.length === 0) return { message: 'No hay ausencias pendientes de procesar.' };

    const idsAusentes = ausentes.map(a => a.id);

    await db.cita.updateMany({
      where: { id: { in: idsAusentes } },
      data: { estado: esCierreDefinitivo ? EstadoCita.CANCELADA : EstadoCita.NO_PRESENTADO }
    });

    // Si es cierre definitivo, cortamos aquí.
    if (esCierreDefinitivo) {
      return { message: `CIERRE DE PLAZO: ${ausentes.length} citas caducadas han sido canceladas.` };
    }

    // Si no es cierre, mandamos los emails y luego retornamos.
    for (const cita of ausentes) {
      if (cita.hermano?.user?.email) {
        const fechaStr = cita.turno.fecha.toLocaleDateString('es-ES');
        // Importante añadir 'await' para que no se sature el servidor si hay 500 emails
        await EmailService.enviarRecordatorioAusencia(
          cita.hermano.user.email,
          cita.hermano.nombre,
          fechaStr
        ).catch(err => console.error(`Error enviando email a ${cita.hermano.user.email}`));
      }
    }

    return { message: `Se han procesado ${ausentes.length} ausencias. Citas actualizadas a NO_PRESENTADO y correos enviados.` };
  }

  /**
   * Listar absolutamente todos los turnos para el panel de control de Secretaría.
   * Incluye los pasados, los inactivos y la ocupación real.
   */
  static async getTodosLosTurnos() {
    return await db.turno.findMany({
      orderBy: { fecha: 'desc' },
      include: {
        _count: {
          select: { citas: { where: { estado: EstadoCita.RESERVADA } } }
        }
      }
    });
  }

  /**
   * Crear un nuevo día de reparto en la Casa Hermandad.
   */
  static async crearTurno(data: CrearTurnoDto) {
    // 1. Convertimos los textos (strings) a fechas reales de JavaScript
    const fechaInicio = new Date(data.horaInicio);
    const fechaFin = new Date(data.horaFin);

    // 2. Validación lógica básica
    if (fechaFin <= fechaInicio) {
      throw new Error('La hora de fin debe ser posterior a la hora de inicio.');
    }

    // 3. Lo guardamos en la base de datos
    return await db.turno.create({
      data: {
        fecha: new Date(data.fecha),
        horaInicio: fechaInicio,
        horaFin: fechaFin,
        capacidadEstimada: data.capacidadEstimada,
        activo: true // Por defecto lo abrimos al crearlo
      }
    });
  }

  /**
   * Modificar un turno existente (Ej: Se pone malo el tesorero y hay que bajar el aforo a la mitad).
   */
  static async actualizarTurno(turnoId: number, data: { capacidadEstimada?: number, activo?: boolean, horaInicio?: Date, horaFin?: Date }) {
    const turno = await db.turno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new Error('Turno no encontrado');

    return await db.turno.update({
      where: { id: turnoId },
      data: {
        capacidadEstimada: data.capacidadEstimada,
        activo: data.activo,
        // Solo actualizamos las fechas si nos las envían
        horaInicio: data.horaInicio ? new Date(data.horaInicio) : undefined,
        horaFin: data.horaFin ? new Date(data.horaFin) : undefined
      }
    });
  }

  /**
   * Elimina un día de reparto (Solo si nos hemos equivocado al crearlo y no hay nadie apuntado).
   */
  static async eliminarTurno(turnoId: number) {
    const ocupacion = await db.cita.count({ where: { turnoId } });

    if (ocupacion > 0) {
      throw new Error('No puedes borrar este día porque ya hay hermanos con cita. Desactívalo en su lugar.');
    }

    return await db.turno.delete({ where: { id: turnoId } });
  }

  /**
   * Un miembro de la Junta dice: "Yo voy a cubrir este turno".
   */
  static async apuntarmeATurno(userId: number, turnoId: number) {
    // 1. EL BLINDAJE: ¿Es de la Junta?
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !user.esJuntaDeGobierno) {
      throw new Error('Solo los miembros de la Junta de Gobierno pueden apuntarse a trabajar en los turnos.');
    }

    const turno = await db.turno.findUnique({ where: { id: turnoId } });
    if (!turno) throw new Error('Turno no encontrado');

    return await db.turno.update({
      where: { id: turnoId },
      data: { responsables: { connect: { id: userId } } }
    });
  }

  /**
   * Un miembro de la Junta dice: "Al final me ha surgido algo, me borro de este turno".
   */
  static async desapuntarmeDeTurno(userId: number, turnoId: number) {
    return await db.turno.update({
      where: { id: turnoId },
      data: {
        responsables: {
          disconnect: { id: userId }
        }
      }
    });
  }

  /**
   * (MODIFICACIÓN) Ver el calendario completo con la gente que viene a sacar papeleta 
   * Y los miembros de la Junta que van a estar trabajando.
   */
  static async getCuadranteTurnos() {
    return await db.turno.findMany({
      orderBy: { fecha: 'asc' },
      include: {
        // Cuántos hermanos de la calle vienen
        _count: {
          select: { citas: { where: { estado: EstadoCita.RESERVADA } } }
        },
        // Qué miembros de la Junta están apuntados para trabajar
        responsables: {
          select: {
            id: true,
            nombre: true,
            apellidos: true,
            role: true // Muy útil para saber si hay algún TESORERO apuntado para cobrar
          }
        }
      }
    });
  }
}