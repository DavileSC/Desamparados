import crypto from 'crypto';
import db from '../config/db';
import { Prisma, Role } from '@prisma/client';
import { corteDeSesiones, esStaff } from '../utils/jwt.handle';
import { verified } from '../utils/bcrypt.handle';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { DOMINIO_CUENTA_ELIMINADA, PREFIJO_DNI_ELIMINADO } from '../domain/cuenta-anonimizada.js';
import { suprimirDatosPersonales } from '../domain/auditoria-supresion.js';
import { asegurarQueQuedaOtroAdmin } from './auth.service';
import { consumirCodigoDeRespaldo, reclamarTotp } from './auth/codigos-2fa.js';
import { borrarDocumentosPrivados, documentosDe } from '../utils/documentos-privados.js';

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
            transacciones: true
          }
        }
      }
    });
    if (!user) throw new NotFoundError('Usuario no encontrado');

    // Auditoría (las exportaciones masivas de datos también son rastreables)
    AuditoriaService.log(ACCIONES_AUDITORIA.CUENTA_DATOS_EXPORT, meta ?? {}, 'user', userId);

    // Nunca exponemos secretos en la exportación: el cliente Prisma ya los omite
    // globalmente (ver config/db.ts), así que `user` llega sin password/2FA/reset.
    const { hermanos, ...safeUser } = user;
    return {
      exportadoEn: new Date().toISOString(),
      aviso: 'Exportación de datos personales conforme al art. 15 RGPD.',
      usuario: safeUser,
      perfilesHermanos: user.hermanos
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

    // Confirmación de identidad obligatoria
    const isMatch = await verified(password, user.password);
    if (!isMatch) throw new HttpError('Contraseña incorrecta: no se puede eliminar la cuenta.', 401);

    const randomPass = crypto.randomBytes(32).toString('hex');
    const fichas = { retiradas: 0, dadasDeBaja: 0, yaDeBaja: 0 };
    let registrosSuprimidos = 0;

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
          tokenValidAfter: corteDeSesiones() // Mata todas las sesiones abiertas
        }
      });

      // 2. Backup codes del 2FA fuera
      await tx.twoFactorBackupCode.deleteMany({ where: { userId } });

      // 3. Fichas, según su estado (el mismo criterio que la retirada de un
      // perfil desde el área de hermanos, `deleteProfileIfOwned`). Antes todas
      // pasaban a baja con fecha de hoy: una solicitud pendiente quedaba como
      // «baja» que Secretaría podía reactivar sin pasar por Solicitudes, las ya
      // de baja perdían su fecha real y las activas conservaban su número.
      // A todas se les limpia el contacto; nombre e historial económico se
      // conservan porque los recibos tienen obligación de retención (6 años).
      const fechaBaja = new Date();
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
          data: { activo: false, fechaBaja, numeroHermano: null, ...CONTACTO_FUERA }
        });
        fichas.dadasDeBaja += 1;
      }

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

    // Auditoría después de confirmar: si la transacción falla, el registro no
    // debe dar fe de un borrado que no ocurrió. El userId del registro sigue
    // señalando a la cuenta, que se anonimiza pero no se borra.
    await AuditoriaService.log(ACCIONES_AUDITORIA.CUENTA_AUTODELETE, meta ?? {}, 'user', userId, {
      antes: { rol: user.role, activa: user.active, fichasActivas: user.hermanos.filter((h) => h.activo).length },
      despues: { activa: false, anonimizada: true, fichas, registrosAuditoriaSuprimidos: registrosSuprimidos }
    });

    return {
      message: 'Tu cuenta ha sido eliminada y tus datos personales anonimizados. ' +
        'El historial de recibos se conserva durante el plazo legal obligatorio, ya sin vincular a tus datos de contacto.'
    };
  }
}
