/**
 * El plazo para pedir la papeleta de sitio desde el área de hermanos.
 *
 * Lo abre y lo cierra Secretaría a mano. Mientras está cerrado, el hermano no
 * puede reservar día de reparto (lo comprueba también `avisarAsistencia`, no
 * solo la pantalla), aunque la Mesa de Reparto sigue inscribiendo a mano.
 *
 * Se guarda en la tabla de configuración, pero fuera de las claves de
 * `/admin/config`: abrirlo no es cambiar un valor, es avisar a los hermanos y
 * preparar la noticia, y eso solo pasa por aquí.
 */
import db from '../../config/db';
import { EstadoCita, Prisma } from '@prisma/client';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from '../auditoria.service';
import { EmailService } from '../email.service';
import { NoticiaService } from '../noticia.service';
import { HttpError } from '../../utils/error.handle';
import { DOMINIO_CUENTA_ELIMINADA } from '../../domain/cuenta-anonimizada.js';
import { PRECIO_ALQUILER_POR_DEFECTO, PRECIO_PAPELETA_POR_DEFECTO, leerPrecio } from '../../domain/datos-procesion.js';

export const CLAVE_PLAZO = 'papeletas_abiertas';

type Cliente = Prisma.TransactionClient | typeof db;

const ZONA = 'Europe/Madrid';
const formatoDia = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' });
const formatoHora = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' });

/** «lunes 8 de marzo, de 18:00 a 21:00». */
export function describirTurno(turno: { fecha: Date; horaInicio: Date; horaFin: Date }): string {
  return `${formatoDia.format(turno.fecha)}, de ${formatoHora.format(turno.horaInicio)} a ${formatoHora.format(turno.horaFin)}`;
}

export class PlazoPapeletasService {

  static async estaAbierto(cliente: Cliente = db): Promise<boolean> {
    const fila = await cliente.configuracion.findUnique({ where: { key: CLAVE_PLAZO } });
    return fila?.value === 'true';
  }

  /** Los días de reparto que quedan por delante, en orden. */
  static diasFuturos(cliente: Cliente = db) {
    return cliente.turno.findMany({
      where: { activo: true, fecha: { gte: inicioDeHoy() } },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  /**
   * El año de la procesión a la que se refiere el plazo: el del primer día de
   * reparto que queda. En otoño aún no hay ninguno y es el del año que viene.
   */
  static async anioDeLaProcesion(cliente: Cliente = db): Promise<number> {
    const [primero] = await PlazoPapeletasService.diasFuturos(cliente);
    if (primero) return primero.fecha.getFullYear();
    const hoy = new Date();
    // Pasada la Semana Santa (abril como muy tarde), toca la del año siguiente.
    return hoy.getMonth() >= 4 ? hoy.getFullYear() + 1 : hoy.getFullYear();
  }

  /** Lo que se paga en el reparto: la papeleta, y el alquiler de túnica a quien no la tiene. */
  static async precios() {
    const [base, alquiler] = await Promise.all([
      db.configuracion.findUnique({ where: { key: 'precio_papeleta_sitio' } }),
      db.configuracion.findUnique({ where: { key: 'precio_alquiler_tunica' } }),
    ]);
    const leidoBase = leerPrecio(base?.value, PRECIO_PAPELETA_POR_DEFECTO);
    const leidoAlquiler = leerPrecio(alquiler?.value, PRECIO_ALQUILER_POR_DEFECTO);
    return {
      papeleta: leidoBase.ok ? leidoBase.valor : null,
      alquilerTunica: leidoAlquiler.ok ? leidoAlquiler.valor : null,
    };
  }

  /** Lo que ve Secretaría junto al interruptor. */
  static async estadoParaSecretaria() {
    const [fila, dias, precios] = await Promise.all([
      db.configuracion.findUnique({ where: { key: CLAVE_PLAZO } }),
      PlazoPapeletasService.diasFuturos(),
      PlazoPapeletasService.precios(),
    ]);
    const citasReservadas = dias.length === 0 ? 0 : await db.cita.count({
      where: { estado: EstadoCita.RESERVADA, turnoId: { in: dias.map((d) => d.id) } },
    });
    return {
      abierto: fila?.value === 'true',
      cambiadoEl: fila?.updatedAt ?? null,
      year: await PlazoPapeletasService.anioDeLaProcesion(),
      diasDeReparto: dias.length,
      primerDia: dias[0]?.fecha ?? null,
      ultimoDia: dias.at(-1)?.fecha ?? null,
      citasReservadas,
      precios,
    };
  }

  /**
   * Abre o cierra el plazo. Al abrirlo, si se pide, se avisa por correo a
   * cada cuenta con fichas activas y se deja un borrador de noticia con los
   * días de reparto, para revisarlo y publicarlo (y moverlo por redes).
   *
   * Los correos salen después de responder: con cientos de hermanos, esperar
   * a que se manden todos dejaría el botón colgado minutos.
   */
  static async cambiar(abrir: boolean, opciones: { avisar?: boolean; borradorNoticia?: boolean }, meta?: MetaDeAuditoria) {
    const dias = await PlazoPapeletasService.diasFuturos();
    if (abrir && dias.length === 0) {
      throw new HttpError('No hay días de reparto por delante: los hermanos no tendrían día que elegir. Crea al menos uno antes de abrir el plazo.', 409);
    }
    const yaAbierto = await PlazoPapeletasService.estaAbierto();
    if (yaAbierto === abrir) {
      return { abierto: abrir, avisados: 0, noticiaId: null as number | null };
    }

    await db.configuracion.upsert({
      where: { key: CLAVE_PLAZO },
      create: { key: CLAVE_PLAZO, value: String(abrir), descripcion: 'Solicitud de papeletas abierta en el área de hermanos' },
      update: { value: String(abrir) },
    });

    const year = await PlazoPapeletasService.anioDeLaProcesion();
    let noticiaId: number | null = null;
    let avisados = 0;

    if (abrir && opciones.borradorNoticia) {
      const noticia = await NoticiaService.crear({
        titulo: `Abierta la solicitud de papeletas de sitio ${year}`,
        extracto: 'Ya se puede pedir la papeleta de sitio desde el área de hermanos y elegir el día de reparto.',
        contenido: contenidoNoticia(dias, year),
        visible: false,
      });
      noticiaId = noticia.id;
      await AuditoriaService.log(ACCIONES_AUDITORIA.NOTICIA_CREAR, meta ?? {}, 'noticia', noticia.id);
    }

    if (abrir && opciones.avisar) {
      const destinatarios = await PlazoPapeletasService.destinatarios();
      avisados = destinatarios.length;
      const textos = dias.map(describirTurno);
      void (async () => {
        for (const d of destinatarios) {
          try {
            await EmailService.enviarAperturaPapeletas(d.email, d.nombre, d.fichas, textos, year, d.sexo);
          } catch (error) {
            console.error('No se ha podido avisar de la apertura de papeletas', error);
          }
        }
      })();
    }

    await AuditoriaService.log(
      abrir ? ACCIONES_AUDITORIA.PLAZO_PAPELETAS_ABRIR : ACCIONES_AUDITORIA.PLAZO_PAPELETAS_CERRAR,
      meta ?? {}, 'configuracion', CLAVE_PLAZO,
      { antes: { abierto: yaAbierto }, despues: { abierto: abrir, avisados, noticiaId } },
    );
    return { abierto: abrir, avisados, noticiaId };
  }

  /** Un correo por cuenta con fichas activas, nombrando las fichas. Sin las cuentas suprimidas. */
  static async destinatarios() {
    const cuentas = await db.user.findMany({
      where: { hermanos: { some: { activo: true } }, NOT: { email: { endsWith: DOMINIO_CUENTA_ELIMINADA } } },
      select: {
        email: true, nombre: true,
        hermanos: { where: { activo: true }, select: { nombre: true, apellidos: true, esTitular: true, sexo: true }, orderBy: { fechaNacimiento: 'asc' } },
      },
    });
    return cuentas
      .filter((c) => Boolean(c.email))
      .map((c) => ({
        email: c.email,
        nombre: c.nombre ?? c.hermanos[0]?.nombre ?? '',
        sexo: c.hermanos.find((h) => h.esTitular)?.sexo ?? null,
        fichas: c.hermanos.map((h) => `${h.nombre} ${h.apellidos}`),
      }));
  }
}

function inicioDeHoy() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return hoy;
}

/** El cuerpo del borrador: se revisa antes de publicar, así que solo lo que se sabe seguro. */
function contenidoNoticia(dias: { fecha: Date; horaInicio: Date; horaFin: Date }[], year: number) {
  const lista = dias.map((d) => `<li>${describirTurno(d)}</li>`).join('');
  return [
    `<p>Ya está abierta la solicitud de papeletas de sitio para la Estación de Penitencia de ${year}.</p>`,
    '<p>Cada hermano puede pedirla desde el área de hermanos, para sí y para quienes tiene a su cargo, y elegir el día en que pasará a recogerla:</p>',
    `<ul>${lista}</ul>`,
    '<p>La papeleta se paga el día del reparto. Hay que llevar el DNI.</p>',
  ].join('');
}
