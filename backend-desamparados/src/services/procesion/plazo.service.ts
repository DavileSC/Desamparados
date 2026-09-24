/**
 * El plazo para pedir la papeleta desde el área de hermanos, uno por salida:
 * el de la Pasión y el del Rosario vespertino.
 *
 * Lo abre y lo cierra Secretaría a mano. Mientras está cerrado, el hermano no
 * puede pedir la papeleta de esa salida (lo comprueba también la solicitud,
 * no solo la pantalla), aunque la mesa sigue apuntando a mano.
 *
 * Se guarda en la tabla de configuración, pero fuera de las claves de
 * `/admin/config`: abrirlo no es cambiar un valor, es avisar a los hermanos y
 * preparar la noticia, y eso solo pasa por aquí.
 */
import db from '../../config/db';
import { EstadoCita, Prisma, type Salida } from '@prisma/client';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from '../auditoria.service';
import { EmailService } from '../email.service';
import { NoticiaService } from '../noticia.service';
import { HttpError } from '../../utils/error.handle';
import { DOMINIO_CUENTA_ELIMINADA } from '../../domain/cuenta-anonimizada.js';
import { leerPrecio } from '../../domain/datos-procesion.js';
import { CLAVE_CUOTA_SALIDA, CUOTA_SALIDA_POR_DEFECTO, DATOS_SALIDA } from '../../domain/salidas.js';

/** La clave del plazo de la Pasión, la de siempre. */
export const CLAVE_PLAZO = DATOS_SALIDA.PASION.clavePlazo;

type Cliente = Prisma.TransactionClient | typeof db;

const ZONA = 'Europe/Madrid';
const formatoDia = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' });
const formatoHora = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' });

/** «lunes 8 de marzo, de 18:00 a 21:00». */
export function describirTurno(turno: { fecha: Date; horaInicio: Date; horaFin: Date }): string {
  return `${formatoDia.format(turno.fecha)}, de ${formatoHora.format(turno.horaInicio)} a ${formatoHora.format(turno.horaFin)}`;
}

export class PlazoPapeletasService {

  static async estaAbierto(salida: Salida = 'PASION', cliente: Cliente = db): Promise<boolean> {
    const fila = await cliente.configuracion.findUnique({ where: { key: DATOS_SALIDA[salida].clavePlazo } });
    return fila?.value === 'true';
  }

  /** Los días de reparto de una salida que quedan por delante, en orden. */
  static diasFuturos(salida: Salida = 'PASION', cliente: Cliente = db) {
    return cliente.turno.findMany({
      where: { activo: true, salida, fecha: { gte: inicioDeHoy() } },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  /**
   * El año de la salida a la que se refiere el plazo: el del primer día de
   * reparto que queda. Sin ninguno, la Pasión pasada la Semana Santa (abril
   * como muy tarde) es la del año siguiente, y el Rosario pasado octubre, también.
   */
  static async anioDeLaProcesion(salida: Salida = 'PASION', cliente: Cliente = db): Promise<number> {
    const [primero] = await PlazoPapeletasService.diasFuturos(salida, cliente);
    if (primero) return primero.fecha.getFullYear();
    const hoy = new Date();
    const pasada = salida === 'PASION' ? hoy.getMonth() >= 4 : hoy.getMonth() >= 10;
    return pasada ? hoy.getFullYear() + 1 : hoy.getFullYear();
  }

  /**
   * La cuota de salida de la Pasión (hoy 0 €, y entonces el hermano no ve
   * nada de ella). `null` si la configuración tiene un valor que no se entiende.
   */
  static async cuotaDeSalida(): Promise<number | null> {
    const fila = await db.configuracion.findUnique({ where: { key: CLAVE_CUOTA_SALIDA } });
    const leida = leerPrecio(fila?.value, CUOTA_SALIDA_POR_DEFECTO);
    return leida.ok ? leida.valor : null;
  }

  /** Lo que ve Secretaría junto al interruptor de cada salida. */
  static async estadoParaSecretaria(salida: Salida = 'PASION') {
    const [fila, dias, cuotaSalida, year] = await Promise.all([
      db.configuracion.findUnique({ where: { key: DATOS_SALIDA[salida].clavePlazo } }),
      PlazoPapeletasService.diasFuturos(salida),
      PlazoPapeletasService.cuotaDeSalida(),
      PlazoPapeletasService.anioDeLaProcesion(salida),
    ]);
    const citasReservadas = dias.length === 0 ? 0 : await db.cita.count({
      where: { estado: EstadoCita.RESERVADA, turnoId: { in: dias.map((d) => d.id) } },
    });
    return {
      salida,
      abierto: fila?.value === 'true',
      cambiadoEl: fila?.updatedAt ?? null,
      year,
      diasDeReparto: dias.length,
      primerDia: dias[0]?.fecha ?? null,
      ultimoDia: dias.at(-1)?.fecha ?? null,
      citasReservadas,
      /** Solo la Pasión: en el Rosario se da la voluntad. */
      cuotaSalida: salida === 'PASION' ? cuotaSalida : null,
    };
  }

  /**
   * Abre o cierra el plazo de una salida. Al abrirlo, si se pide, se avisa
   * por correo a cada cuenta con fichas activas y se deja un borrador de
   * noticia con los días de reparto, para revisarlo y publicarlo.
   *
   * Los correos salen después de responder: con cientos de hermanos, esperar
   * a que se manden todos dejaría el botón colgado minutos.
   */
  static async cambiar(abrir: boolean, opciones: { avisar?: boolean; borradorNoticia?: boolean; salida?: Salida }, meta?: MetaDeAuditoria) {
    const salida = opciones.salida ?? 'PASION';
    const clave = DATOS_SALIDA[salida].clavePlazo;
    const dias = await PlazoPapeletasService.diasFuturos(salida);
    if (abrir && dias.length === 0) {
      throw new HttpError('No hay días de reparto por delante: los hermanos no tendrían día que elegir. Crea al menos uno antes de abrir el plazo.', 409);
    }
    const yaAbierto = await PlazoPapeletasService.estaAbierto(salida);
    if (yaAbierto === abrir) {
      return { abierto: abrir, avisados: 0, noticiaId: null as number | null };
    }

    await db.configuracion.upsert({
      where: { key: clave },
      create: { key: clave, value: String(abrir), descripcion: `Solicitud de papeletas del ${DATOS_SALIDA[salida].nombre} abierta en el área de hermanos` },
      update: { value: String(abrir) },
    });

    const year = await PlazoPapeletasService.anioDeLaProcesion(salida);
    let noticiaId: number | null = null;
    let avisados = 0;

    if (abrir && opciones.borradorNoticia) {
      const rosario = salida === 'ROSARIO';
      const noticia = await NoticiaService.crear({
        titulo: rosario ? `Abierta la inscripción del Rosario vespertino ${year}` : `Abierta la solicitud de papeletas de sitio ${year}`,
        extracto: rosario
          ? 'Ya se puede apuntar al Rosario vespertino desde el área de hermanos y elegir el día de reparto.'
          : 'Ya se puede pedir la papeleta de sitio desde el área de hermanos y elegir el día de reparto.',
        contenido: contenidoNoticia(dias, year, salida),
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
            await EmailService.enviarAperturaPapeletas(d.email, d.nombre, d.fichas, textos, year, d.sexo, salida);
          } catch (error) {
            console.error('No se ha podido avisar de la apertura de papeletas', error);
          }
        }
      })();
    }

    await AuditoriaService.log(
      abrir ? ACCIONES_AUDITORIA.PLAZO_PAPELETAS_ABRIR : ACCIONES_AUDITORIA.PLAZO_PAPELETAS_CERRAR,
      meta ?? {}, 'configuracion', clave,
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
function contenidoNoticia(dias: { fecha: Date; horaInicio: Date; horaFin: Date }[], year: number, salida: Salida) {
  const lista = dias.map((d) => `<li>${describirTurno(d)}</li>`).join('');
  if (salida === 'ROSARIO') {
    return [
      `<p>Ya está abierta la inscripción para el Rosario vespertino de ${year}, en el que acompañamos a Nuestra Señora de los Desamparados por las calles rezando el Santo Rosario.</p>`,
      '<p>Cada hermano puede apuntarse desde el área de hermanos, para sí y para quienes tiene a su cargo, pedir el puesto en que le gustaría ir y elegir el día en que pasará a recoger su papeleta:</p>',
      `<ul>${lista}</ul>`,
      '<p>Se va en traje. Para participar se pide la voluntad, y hay que estar al día con la cuota de hermano.</p>',
    ].join('');
  }
  return [
    `<p>Ya está abierta la solicitud de papeletas de sitio para la Estación de Penitencia de ${year}.</p>`,
    '<p>Cada hermano puede pedirla desde el área de hermanos, para sí y para quienes tiene a su cargo, y elegir el día en que pasará a recogerla:</p>',
    `<ul>${lista}</ul>`,
    '<p>Para recogerla hay que estar al día con la cuota de hermano. Hay que llevar el DNI.</p>',
  ].join('');
}
