/**
 * El plazo para pedir la papeleta desde el área de hermanos, uno por salida.
 *
 * Lo abre y lo cierra Secretaría a mano. Mientras está cerrado, el hermano no
 * puede pedir la papeleta de esa salida (lo comprueba también la solicitud,
 * no solo la pantalla), aunque la mesa sigue apuntando a mano.
 *
 * Vive en la fila de la salida (`plazoAbierto`), pero no se cambia al editar
 * la salida: abrirlo es avisar a los hermanos y preparar la noticia, y eso
 * solo pasa por aquí.
 */
import db from '../../config/db';
import { EstadoCita, Prisma } from '@prisma/client';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from '../auditoria.service';
import { EmailService } from '../email.service';
import { NoticiaService } from '../noticia.service';
import { HttpError } from '../../utils/error.handle';
import { DOMINIO_CUENTA_ELIMINADA } from '../../domain/cuenta-anonimizada.js';
import { anioDeLaSalida, diaMadrid, proximaFecha } from '../../domain/fecha-salida.js';
import { articuloDe, deArticulo } from '../../domain/articulos.js';
import { reglaDe, type SalidaConActo } from './salidas.service.js';

type Cliente = Prisma.TransactionClient | typeof db;

const ZONA = 'Europe/Madrid';
const formatoDia = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' });
const formatoHora = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' });

/** «lunes 8 de marzo, de 18:00 a 21:00». */
export function describirTurno(turno: { fecha: Date; horaInicio: Date; horaFin: Date }): string {
  return `${formatoDia.format(turno.fecha)}, de ${formatoHora.format(turno.horaInicio)} a ${formatoHora.format(turno.horaFin)}`;
}

/** La cuota que ve el hermano: `null` en las de donativo, donde se da la voluntad. */
export const cuotaDe = (salida: { cobro: SalidaConActo['cobro']; importeCuota: SalidaConActo['importeCuota'] }): number | null =>
  salida.cobro === 'DONATIVO' ? null : Number(salida.importeCuota);

export class PlazoPapeletasService {

  /** Se lee de la base y no de la fila que se tenga: la solicitud lo comprueba dentro de su transacción. */
  static async estaAbierto(salida: SalidaConActo, cliente: Cliente = db): Promise<boolean> {
    const fila = await cliente.salida.findUnique({ where: { id: salida.id }, select: { plazoAbierto: true } });
    return fila?.plazoAbierto === true;
  }

  /** Los días de reparto de una salida que quedan por delante, en orden. */
  static diasFuturos(salida: SalidaConActo, cliente: Cliente = db) {
    return cliente.turno.findMany({
      where: { activo: true, salidaId: salida.id, fecha: { gte: inicioDeHoy() } },
      orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  /**
   * El año de la salida que se está preparando: el de su próxima fecha (ver
   * `anioDeLaSalida`). Pasada la salida, ya es la del año siguiente, aunque
   * todavía no haya días de reparto.
   */
  static anioDeLaProcesion(salida: SalidaConActo): number {
    return anioDeLaSalida(reglaDe(salida), diaMadrid(new Date()));
  }

  /** Lo que ve Secretaría junto al interruptor de cada salida. */
  static async estadoParaSecretaria(salida: SalidaConActo) {
    const dias = await PlazoPapeletasService.diasFuturos(salida);
    const citasReservadas = dias.length === 0 ? 0 : await db.cita.count({
      where: { estado: EstadoCita.RESERVADA, turnoId: { in: dias.map((d) => d.id) } },
    });
    return {
      salida: salida.slug,
      abierto: salida.plazoAbierto,
      cambiadoEl: salida.plazoCambiadoEl,
      year: PlazoPapeletasService.anioDeLaProcesion(salida),
      diasDeReparto: dias.length,
      primerDia: dias[0]?.fecha ?? null,
      ultimoDia: dias.at(-1)?.fecha ?? null,
      citasReservadas,
      /** Solo con cuota: en las de donativo se da la voluntad. */
      cuotaSalida: cuotaDe(salida),
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
  static async cambiar(abrir: boolean, opciones: { avisar?: boolean; borradorNoticia?: boolean }, salida: SalidaConActo, meta?: MetaDeAuditoria) {
    // Sin fecha no se sabe para qué año son las papeletas ni hasta cuándo se reparte.
    if (abrir && !proximaFecha(reglaDe(salida), diaMadrid(new Date()))) {
      throw new HttpError('Pon antes la fecha de la salida en la Agenda.', 409);
    }
    const dias = await PlazoPapeletasService.diasFuturos(salida);
    if (abrir && dias.length === 0) {
      throw new HttpError('No hay días de reparto por delante: los hermanos no tendrían día que elegir. Crea al menos uno antes de abrir el plazo.', 409);
    }
    const yaAbierto = await PlazoPapeletasService.estaAbierto(salida);
    if (yaAbierto === abrir) {
      return { abierto: abrir, avisados: 0, noticiaId: null as number | null };
    }

    await db.salida.update({ where: { id: salida.id }, data: { plazoAbierto: abrir, plazoCambiadoEl: new Date() } });

    const year = PlazoPapeletasService.anioDeLaProcesion(salida);
    let noticiaId: number | null = null;
    let avisados = 0;

    if (abrir && opciones.borradorNoticia) {
      const articuloNoticia = articuloDe(salida);
      const noticia = await NoticiaService.crear({
        titulo: `Abierta la inscripción ${deArticulo(articuloNoticia, salida.nombre)} ${year}`,
        extracto: `Ya se puede pedir la papeleta ${deArticulo(articuloNoticia, salida.nombre)} desde el área de hermanos y elegir el día de reparto.`,
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
      const salidaParaCorreo = { ...salida, articulo: articuloDe(salida) };
      void (async () => {
        for (const d of destinatarios) {
          try {
            await EmailService.enviarAperturaPapeletas(d.email, d.nombre, d.fichas, textos, year, d.sexo, salidaParaCorreo);
          } catch (error) {
            console.error('No se ha podido avisar de la apertura de papeletas', error);
          }
        }
      })();
    }

    await AuditoriaService.log(
      abrir ? ACCIONES_AUDITORIA.PLAZO_PAPELETAS_ABRIR : ACCIONES_AUDITORIA.PLAZO_PAPELETAS_CERRAR,
      meta ?? {}, 'salida', salida.id,
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
function contenidoNoticia(dias: { fecha: Date; horaInicio: Date; horaFin: Date }[], year: number, salida: SalidaConActo) {
  const lista = dias.map((d) => `<li>${describirTurno(d)}</li>`).join('');
  const cobro = salida.cobro === 'DONATIVO'
    ? 'Para participar se pide la voluntad, y hay que estar al día con la cuota de hermano.'
    : 'Para recogerla hay que estar al día con la cuota de hermano. Hay que llevar el DNI.';
  return [
    `<p>Ya está abierta la inscripción ${deArticulo(articuloDe(salida), escapar(salida.nombre))} de ${year}.</p>`,
    '<p>Cada hermano puede pedir su papeleta desde el área de hermanos, para sí y para quienes tiene a su cargo, y elegir el día en que pasará a recogerla:</p>',
    `<ul>${lista}</ul>`,
    `<p>${cobro}</p>`,
    ...(salida.indicaciones?.trim() ? [`<p>${escapar(salida.indicaciones.trim())}</p>`] : []),
  ].join('');
}

/** El nombre y las indicaciones se escriben en el CMS como texto: en el HTML de la noticia no son etiquetas. */
const escapar = (texto: string) => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
