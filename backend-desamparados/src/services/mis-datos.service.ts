import crypto from 'crypto';
import { olvidarCuenta } from '../utils/contador-fallos.js';
import db from '../config/db';
import { EstadoEnvio, Prisma, Role } from '@prisma/client';
import { corteDeSesiones, esStaff } from '../utils/jwt.handle';
import { verified } from '../utils/bcrypt.handle';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { DOMINIO_CUENTA_ELIMINADA, PREFIJO_DNI_ELIMINADO } from '../domain/cuenta-anonimizada.js';
import { suprimirDatosPersonales } from '../domain/auditoria-supresion.js';
import { asegurarQueQuedaOtroAdmin } from './auth.service';
import { consumirCodigoDeRespaldo, reclamarTotp } from './auth/codigos-2fa.js';
import { borrarDocumentosPrivados, documentosDe } from '../utils/documentos-privados.js';
import { PapeletasService, type SolicitudConRecibo } from './procesion/papeletas.service.js';
import { idCategoriaDevoluciones } from './recibos/comunes.js';
import { retirarPendientes } from './correos/cola.js';

// Datos de contacto de una ficha, fuera, en la supresión de la cuenta.
// La foto y el certificado de bautismo también salen: no hacen falta para la
// contabilidad que se retiene, y los ficheros se borran al terminar.
const CONTACTO_FUERA = {
  email: null, telefono: null, direccion: null, poblacion: null, codigoPostal: null,
  foto: null, certificadoBautismo: null,
} as const;

/**
 * Los derechos del RGPD sobre los datos propios: llevárselos y borrarlos.
 *
 * Son dos operaciones grandes y de una pieza —la exportación recorre media
 * base de datos y la supresión anonimiza sin romper la contabilidad— que no
 * tienen nada que ver con entrar ni con darse de alta, y que estaban en medio
 * del servicio del acceso.
 */
export class MisDatosService {

  /**
   * Derecho de acceso (art. 15 RGPD): exporta TODOS los datos personales
   * del usuario: cuenta, fichas familiares, recibos, papeletas, citas y
   * transacciones asociadas a sus perfiles.
   */
  static async exportMisDatos(userId: number, meta?: MetaDeAuditoria) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        hermanos: {
          include: {
            recibos: { orderBy: { year: 'desc' } },
            papeletas: { orderBy: { year: 'desc' } },
            citas: { include: { turno: true } },
            transacciones: true,
            solicitudes: { orderBy: { year: 'desc' } },
            prendas: { select: { tipo: true, numero: true, talla: true, estado: true, fechaAsignacion: true } },
            cingulosSueltos: true,
            asistenciasCabildo: { include: { cabildo: { select: { tipo: true, fecha: true, lugar: true } } } }
          }
        },
        // Sin la dirección ni las claves del servicio de push: identifican el aparato, no a la persona.
        movilesDeAvisos: { select: { nombre: true, creadoEn: true, usadoEn: true } },
        avisosPersonales: { select: { asunto: true, resumen: true, creadoEn: true }, orderBy: { creadoEn: 'desc' } }
      }
    });
    if (!user) throw new NotFoundError('Usuario no encontrado');
    // Lo que no cuelga de la cuenta en el esquema pero es suyo: lo que pagó en
    // línea y los comunicados que le llegaron.
    const [pagosEnLinea, comunicadosRecibidos] = await Promise.all([
      db.pagoEnLinea.findMany({
        where: { userId },
        select: { pedido: true, importe: true, metodo: true, estado: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      db.comunicadoEnvio.findMany({
        where: { userId },
        select: { email: true, estado: true, enviadoEl: true, comunicado: { select: { asunto: true } } },
        orderBy: { id: 'desc' },
      }),
    ]);

    // Auditoría (las exportaciones masivas de datos también son rastreables)
    AuditoriaService.log(ACCIONES_AUDITORIA.CUENTA_DATOS_EXPORT, meta ?? {}, 'user', userId);

    // Nunca exponemos secretos en la exportación: el cliente Prisma ya los omite
    // globalmente (ver config/db.ts), así que `user` llega sin password/2FA/reset.
    const { hermanos, ...safeUser } = user;
    return {
      exportadoEn: new Date().toISOString(),
      aviso: 'Exportación de datos personales conforme al art. 15 RGPD.',
      usuario: safeUser,
      perfilesHermanos: user.hermanos,
      pagosEnLinea,
      comunicadosRecibidos
    };
  }

  /**
   * Derecho de supresión (art. 17 RGPD) adaptado a las obligaciones fiscales
   * del Grupo Parroquial:
   * - La CUENTA se anonimiza por completo (email, DNI, nombre, contraseña)
   *   y se desactiva. Sus sesiones quedan invalidadas al instante.
   * - Las FICHAS de hermano se dan de baja y se les limpia el contacto
   *   (email/teléfono/dirección), conservando nombre y historial económico
   *   porque los recibos tienen obligación de retención (6 años Hacienda).
   * Requiere confirmar con la contraseña actual.
   *
   * Una cuenta del equipo solo puede borrarse desde una sesión del CMS: la del
   * área de hermanos no ha pasado el 2FA, y con la contraseña robada de un
   * cargo bastaba para hacer desaparecer su cuenta. Y nunca la del último
   * ADMIN activo, que dejaría el CMS sin nadie capaz de gestionar al equipo.
   */
  static async deleteOwnAccount(
    userId: number,
    password: string,
    origen: 'cms' | 'hermanos' | undefined,
    meta?: MetaDeAuditoria
  ) {
    const user = await db.user.findUnique({
      where: { id: userId },
      omit: { password: false }, // Necesario para confirmar la identidad
      include: { hermanos: true }
    });
    if (!user) throw new NotFoundError('Usuario no encontrado');

    // Antes que la contraseña: no hace falta gastar un bcrypt para decir que no.
    if (esStaff(user.role) && origen !== 'cms') {
      throw new HttpError('Esta cuenta es del equipo del CMS: para eliminarla, entra por el acceso del CMS.', 403);
    }
    // Una sesión del CMS ya no implica haber pasado el 2FA: sin él activado,
    // solo sirve para activarlo (ver checkRole), y esta ruta no pasa por checkRole.
    if (esStaff(user.role) && !user.twoFactorEnabled) {
      throw new HttpError('Esta cuenta es del equipo del CMS: activa antes el doble factor en «Mi seguridad».', 403);
    }

    // Confirmación de identidad obligatoria
    const isMatch = await verified(password, user.password);
    if (!isMatch) throw new HttpError('Contraseña incorrecta: no se puede eliminar la cuenta.', 401);

    const randomPass = crypto.randomBytes(32).toString('hex');
    const fichas = { retiradas: 0, dadasDeBaja: 0, yaDeBaja: 0 };
    let registrosSuprimidos = 0;
    // Las categorías contables, antes de abrir la transacción (ver idCategoriaDeRecibos).
    const categoriaDevolucionesId = await idCategoriaDevoluciones();
    let canceladas: SolicitudConRecibo[] = [];

    await db.$transaction(async (tx) => {
      // 0. El último ADMIN activo no se va.
      await asegurarQueQuedaOtroAdmin(tx, user.role);

      // 1. Anonimización de la cuenta
      await tx.user.update({
        where: { id: userId },
        data: {
          // Formato compartido con `esCuentaAnonimizada`, que lo usa para no
          // reactivar por error una cuenta suprimida.
          email: `anon-${userId}${DOMINIO_CUENTA_ELIMINADA}`,
          dni: `${PREFIJO_DNI_ELIMINADO}${userId}`,
          nombre: 'Usuario',
          apellidos: 'Eliminado',
          telefono: '',
          direccion: null,
          poblacion: null,
          codigoPostal: null,
          password: randomPass, // Inutiliza la contraseña anterior
          active: false,
          twoFactorEnabled: false,
          twoFactorSecret: null,
          resetPasswordToken: null,
          resetPasswordExpires: null,
          invitacionCaducaEn: null,
          tokenValidAfter: corteDeSesiones() // Mata todas las sesiones abiertas
        }
      });

      // 2. Backup codes del 2FA fuera, y los avisos personales: llevan
      // nombres, importes y la carta entera.
      await tx.twoFactorBackupCode.deleteMany({ where: { userId } });
      await tx.avisoPersonal.deleteMany({ where: { userId } });
      // Los móviles de los avisos (su dirección en el servicio de push es del
      // aparato de la persona), y lo que ya salió por la cola: el registro de
      // envíos guardaba la dirección y el nombre para siempre, y la cola, el
      // correo entero. Lo pendiente se retira al acabar (`retirarPendientes`).
      await tx.movilDeAvisos.deleteMany({ where: { userId } });
      const enviados = await tx.comunicadoEnvio.findMany({ where: { userId, estado: { not: EstadoEnvio.PENDIENTE } }, select: { id: true } });
      for (const { id } of enviados) {
        // Una por fila: la dirección es única dentro de cada comunicado.
        await tx.comunicadoEnvio.update({ where: { id }, data: { email: `envio-${id}${DOMINIO_CUENTA_ELIMINADA}`, nombre: null, sexo: null } });
      }
      await tx.correoEnCola.updateMany({
        where: { userId, estado: { not: EstadoEnvio.PENDIENTE } },
        data: { para: `anon-${userId}${DOMINIO_CUENTA_ELIMINADA}`, html: '', aviso: Prisma.DbNull },
      });

      // 3. Fichas, según su estado (el mismo criterio que la retirada de un
      // perfil desde el área de hermanos, `deleteProfileIfOwned`). Antes todas
      // pasaban a baja con fecha de hoy: una solicitud pendiente quedaba como
      // «baja» que Secretaría podía reactivar sin pasar por Solicitudes, las ya
      // de baja perdían su fecha real y las activas conservaban su número.
      // A todas se les limpia el contacto; nombre e historial económico se
      // conservan porque los recibos tienen obligación de retención (6 años).
      const fechaBaja = new Date();
      const deBaja: number[] = [];
      for (const { id } of user.hermanos) {
        const ficha = await tx.hermano.findUnique({
          where: { id },
          select: {
            activo: true, fechaBaja: true,
            _count: { select: { recibos: true, papeletas: true, citas: true, transacciones: true, prendas: true } }
          }
        });
        if (!ficha) continue;

        if (ficha.fechaBaja) {
          // Ya de baja: su estado y su fecha son historia del censo.
          await tx.hermano.update({ where: { id }, data: CONTACTO_FUERA });
          fichas.yaDeBaja += 1;
          continue;
        }

        const conHistorial = Object.values(ficha._count).some((n) => n > 0);
        if (!ficha.activo && !conHistorial) {
          // Solicitud pendiente sin nada detrás: se retira, como la retiraría la familia.
          await tx.hermano.delete({ where: { id } });
          fichas.retiradas += 1;
          continue;
        }

        // Activa, o pendiente con historial: baja, y el número queda libre
        // como en cualquier otra baja (una ficha de baja no lo retiene).
        await tx.hermano.update({
          where: { id },
          data: { activo: false, fechaBaja, numeroHermano: null, motivoBaja: 'VOLUNTARIA', ...CONTACTO_FUERA }
        });
        fichas.dadasDeBaja += 1;
        deBaja.push(id);
      }
      // Lo que tenían pedido para salir y aún no han pagado ni recogido.
      canceladas = await PapeletasService.cancelarSolicitudesDeBajaEnTransaccion(tx, deBaja, categoriaDevolucionesId);

      // 4. La auditoría de la cuenta y de sus fichas guarda el antes y el
      // después de cada cambio (DNI, correo, dirección...) durante todo el
      // plazo de retención. Se suprimen esos valores en la misma transacción:
      // la cuenta no está suprimida mientras su historial siga diciendo quién era.
      const registros = await tx.auditLog.findMany({
        where: {
          OR: [
            { entityType: 'user', entityId: String(userId) },
            { entityType: 'hermano', entityId: { in: user.hermanos.map((h) => String(h.id)) } }
          ]
        },
        select: { id: true, detalles: true }
      });
      for (const registro of registros) {
        if (registro.detalles === null) continue;
        const suprimidos = suprimirDatosPersonales(registro.detalles);
        if (JSON.stringify(suprimidos) === JSON.stringify(registro.detalles)) continue;
        await tx.auditLog.update({
          where: { id: registro.id },
          data: { detalles: suprimidos as Prisma.InputJsonValue }
        });
        registrosSuprimidos += 1;
      }
    });

    await borrarDocumentosPrivados(documentosDe(user.hermanos));

    // Lo que aún esperaba en la cola ya no sale: con el tope del día, un envío
    // a todos tarda varios, y la cuenta no existe desde hoy. Por la cuenta, o
    // por sus direcciones si el envío no la apuntó.
    const direcciones = [user.email, ...user.hermanos.map((h) => h.email)].flatMap((e) => (e?.trim() ? [e.trim().toLowerCase()] : []));
    await retirarPendientes(
      { OR: [{ userId }, { userId: null, email: { in: direcciones } }] },
      { OR: [{ userId }, { userId: null, para: { in: direcciones } }] },
    );

    // Los contadores de la entrada y las redes confiadas guardan el correo y
    // las IP desde las que entraba; los rebotes, sus direcciones. Un rebote se
    // queda si otra cuenta o ficha sigue usando esa dirección: sin él, la cola
    // le volvería a gastar cupo en un buzón que no existe.
    await olvidarCuenta(user.email, userId);
    for (const direccion of new Set(direcciones)) {
      const enUso = await db.user.count({ where: { email: direccion } }) + await db.hermano.count({ where: { email: direccion } });
      if (enUso === 0) await db.correoQueRebota.deleteMany({ where: { email: direccion } });
    }

    // Auditoría después de confirmar: si la transacción falla, el registro no
    // debe dar fe de un borrado que no ocurrió. El userId del registro sigue
    // señalando a la cuenta, que se anonimiza pero no se borra.
    await AuditoriaService.log(ACCIONES_AUDITORIA.CUENTA_AUTODELETE, meta ?? {}, 'user', userId, {
      antes: { rol: user.role, activa: user.active, fichasActivas: user.hermanos.filter((h) => h.activo).length },
      despues: { activa: false, anonimizada: true, fichas, registrosAuditoriaSuprimidos: registrosSuprimidos }
    });
    await PapeletasService.registrarCanceladasPorBaja(canceladas, meta ?? { userId });

    return {
      message: 'Tu cuenta ha sido eliminada y tus datos personales anonimizados. ' +
        'El historial de recibos se conserva durante el plazo legal obligatorio, ya sin vincular a tus datos de contacto.'
    };
  }
}
