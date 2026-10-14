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
import { ModulosService, siModulo } from '../modulos.service.js';
import { HttpError } from '../../utils/error.handle';
import { DOMINIO_CUENTA_ELIMINADA } from '../../domain/cuenta-anonimizada.js';
import { anioDeLaSalida, diaMadrid, proximaFecha } from '../../domain/fecha-salida.js';
import { articuloDe, deArticulo } from '../../domain/articulos.js';
import { reglaDe, type SalidaConActo } from './salidas.service.js';
import { esDireccionDeNadie } from '../../domain/cuenta-de-custodia.js';
import { AvisosHermanosService } from '../avisos-hermanos.service.js';
import { despertarCola, enviadosHoy, topeDiario } from '../correos/cola.js';

type Cliente = Prisma.TransactionClient | typeof db;

const ZONA = 'Europe/Madrid';
const formatoDia = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' });
const formatoHora = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' });

/** «lunes 8 de marzo, de 18:00 a 21:00». */
function describirTurno(turno: { fecha: Date; horaInicio: Date; horaFin: Date }): string {
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

  /**
   * Los días de reparto de una salida que quedan por delante, en orden. Uno
   * cuenta hasta que acaba (`horaFin`), igual que en el área: `fecha` es la
   * medianoche UTC, y con ella el de hoy se daba por pasado o por futuro según
   * dónde se mirara.
   */
  static diasFuturos(salida: SalidaConActo, cliente: Cliente = db) {
    return cliente.turno.findMany({
      where: { activo: true, salidaId: salida.id, horaFin: { gte: new Date() } },
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

    // Condicionado al estado leído: con dos «Abrir» a la vez, los dos veían
    // el plazo cerrado y se mandaban todos los correos (y el borrador) dos
    // veces. El que llega tarde no cambia nada y no avisa a nadie.
    const { count } = await db.salida.updateMany({ where: { id: salida.id, plazoAbierto: !abrir }, data: { plazoAbierto: abrir, plazoCambiadoEl: new Date() } });
    if (count === 0) return { abierto: abrir, avisados: 0, noticiaId: null as number | null };

    const year = PlazoPapeletasService.anioDeLaProcesion(salida);
    // Sin área de hermanos la papeleta se pide en la mesa de reparto: ni se
    // avisa por correo (la plantilla manda al área) ni la noticia habla de ella.
    const conArea = await ModulosService.activo('area-hermanos');
    let noticiaId: number | null = null;
    let avisados = 0;

    if (abrir && opciones.borradorNoticia) {
      // Con Noticias apagado no hay borrador que crear: el plazo se abre igual.
      noticiaId = (await siModulo('noticias', async () => {
        const articuloNoticia = articuloDe(salida);
        const noticia = await NoticiaService.crear({
          titulo: `Abierta la inscripción ${deArticulo(articuloNoticia, salida.nombre)} ${year}`,
          extracto: conArea
            ? `Ya se puede pedir la papeleta ${deArticulo(articuloNoticia, salida.nombre)} desde el área de hermanos y elegir el día de reparto.`
            : `Ya se puede pedir la papeleta ${deArticulo(articuloNoticia, salida.nombre)} en la mesa de reparto.`,
          contenido: contenidoNoticia(dias, year, salida, conArea),
          visible: false,
        });
        await AuditoriaService.log(ACCIONES_AUDITORIA.NOTICIA_CREAR, meta ?? {}, 'noticia', noticia.id);
        return noticia.id;
      })) ?? null;
    }

    if (abrir && opciones.avisar && conArea) {
      const destinatarios = await PlazoPapeletasService.destinatarios();
      avisados = destinatarios.length;
      // Maquetar cientos de correos lleva unos segundos: se hace después de
      // responder. Luego la cola los manda con el tope del día, y antes los
      // avisos al móvil de quien los tiene.
      void PlazoPapeletasService.ponerAvisoEnCola(destinatarios, dias.map(describirTurno), year, salida)
        .catch((error) => console.error('No se ha podido poner en cola el aviso de apertura de papeletas', error));
    }

    await AuditoriaService.log(
      abrir ? ACCIONES_AUDITORIA.PLAZO_PAPELETAS_ABRIR : ACCIONES_AUDITORIA.PLAZO_PAPELETAS_CERRAR,
      meta ?? {}, 'salida', salida.id,
      { antes: { abierto: yaAbierto }, despues: { abierto: abrir, avisados, noticiaId } },
    );
    return { abierto: abrir, avisados, noticiaId };
  }

  /**
   * Un aviso por cuenta: al móvil a quien lo tiene (con el correo maquetado
   * por si no le llega), por correo a los demás.
   */
  static async ponerAvisoEnCola(destinatarios: Awaited<ReturnType<typeof PlazoPapeletasService.destinatarios>>, dias: string[], year: number, salida: SalidaConActo) {
    const articulo = articuloDe(salida);
    const conMovil = await AvisosHermanosService.cuentasConMovil(destinatarios.map((d) => d.userId));
    const aviso = {
      etiqueta: `apertura-${salida.id}-${year}`,
      titulo: 'Ya puedes pedir tu papeleta',
      cuerpo: `Está abierta la solicitud ${deArticulo(articulo, salida.nombre)} ${year}. Toca para pedirla.`,
      url: '/area-hermano/procesion',
    };
    const lote = `apertura:${salida.id}:${year}`;
    const titulo = `Apertura de papeletas · ${salida.nombre} ${year}`.slice(0, 150);
    const filas: Prisma.CorreoEnColaCreateManyInput[] = [];
    for (const d of destinatarios) {
      const { asunto, html, uso } = await EmailService.correoAperturaPapeletas(d.nombre, d.fichas, dias, year, d.sexo ?? undefined, { ...salida, articulo });
      const porMovil = conMovil.has(d.userId);
      filas.push({ lote, titulo, userId: d.userId, porMovil, para: d.email, asunto: asunto.slice(0, 200), html, uso, aviso: porMovil ? aviso : Prisma.JsonNull });
    }
    for (let i = 0; i < filas.length; i += 100) await db.correoEnCola.createMany({ data: filas.slice(i, i + 100) });
    void despertarCola();
  }

  /** Lo que diría la casilla «Avisar» si se abriera ahora: cuántos al móvil, cuántos por correo y cuántos caben hoy. */
  static async avisoPrevisto() {
    const destinatarios = await PlazoPapeletasService.destinatarios();
    const conMovil = await AvisosHermanosService.cuentasConMovil(destinatarios.map((d) => d.userId));
    const alMovil = destinatarios.filter((d) => conMovil.has(d.userId)).length;
    const [hoy, delante] = await Promise.all([
      enviadosHoy(),
      Promise.all([
        db.correoEnCola.count({ where: { estado: 'PENDIENTE', porMovil: false } }),
        db.comunicadoEnvio.count({ where: { estado: 'PENDIENTE', porMovil: false, comunicado: { estado: 'ENVIANDO' } } }),
      ]).then(([a, b]) => a + b),
    ]);
    return { alMovil, porCorreo: destinatarios.length - alMovil, cabenHoy: Math.max(0, topeDiario() - hoy - delante) };
  }

  /** Un correo por cuenta con fichas activas, nombrando las fichas. Sin las cuentas suprimidas. */
  static async destinatarios() {
    const cuentas = await db.user.findMany({
      where: { hermanos: { some: { activo: true } }, NOT: { email: { endsWith: DOMINIO_CUENTA_ELIMINADA } } },
      select: {
        id: true, email: true, nombre: true,
        hermanos: { where: { activo: true }, select: { nombre: true, apellidos: true, esTitular: true, sexo: true }, orderBy: { fechaNacimiento: 'asc' } },
      },
    });
    // Sin las direcciones de nadie (la cuenta de custodia del censo
    // importado, `.invalido`): su correo no sale y no es un avisado.
    return cuentas
      .filter((c) => Boolean(c.email) && !esDireccionDeNadie(c.email))
      .map((c) => ({
        userId: c.id,
        email: c.email,
        nombre: c.nombre ?? c.hermanos[0]?.nombre ?? '',
        sexo: c.hermanos.find((h) => h.esTitular)?.sexo ?? null,
        fichas: c.hermanos.map((h) => `${h.nombre} ${h.apellidos}`),
      }));
  }
}

/** El cuerpo del borrador: se revisa antes de publicar, así que solo lo que se sabe seguro. */
function contenidoNoticia(dias: { fecha: Date; horaInicio: Date; horaFin: Date }[], year: number, salida: SalidaConActo, conArea: boolean) {
  const lista = dias.map((d) => `<li>${describirTurno(d)}</li>`).join('');
  const cobro = salida.cobro === 'DONATIVO'
    ? 'Para participar se pide la voluntad, y hay que estar al día con la cuota de hermano.'
    : 'Para recogerla hay que estar al día con la cuota de hermano. Hay que llevar el DNI.';
  return [
    `<p>Ya está abierta la inscripción ${deArticulo(articuloDe(salida), escapar(salida.nombre))} de ${year}.</p>`,
    conArea
      ? '<p>Cada hermano puede pedir su papeleta desde el área de hermanos, para sí y para quienes tiene a su cargo, y elegir el día en que pasará a recogerla:</p>'
      : '<p>Cada hermano puede pedir y recoger su papeleta en la mesa de reparto, para sí y para quienes tiene a su cargo, en uno de estos días:</p>',
    `<ul>${lista}</ul>`,
    `<p>${cobro}</p>`,
    ...(salida.indicaciones?.trim() ? [`<p>${escapar(salida.indicaciones.trim())}</p>`] : []),
  ].join('');
}

/** El nombre y las indicaciones se escriben en el CMS como texto: en el HTML de la noticia no son etiquetas. */
const escapar = (texto: string) => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
