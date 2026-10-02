/**
 * El boletín y los avisos masivos por correo: el borrador, a quién va, la
 * prueba, el envío y la baja del boletín.
 *
 * Enviar no manda nada en el acto: apunta a cada destinatario y un proceso en
 * segundo plano los va mandando uno a uno, con una pausa entre correos. La
 * cuenta de Gmail tiene un cupo diario y corta a quien manda de golpe; así, un
 * boletín a cuatrocientos hermanos tarda unos minutos, pero llega. Si el
 * servidor se reinicia a medias, al arrancar sigue por donde iba.
 */
import { EstadoComunicado, EstadoEnvio, EstadoPago, Prisma, TipoComunicado } from '@prisma/client';
import db from '../config/db';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { sanearContenidoCms, extractoPlano } from '../utils/sanear-html.js';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service.js';
import { enviarCorreo } from './correos/envio.js';
import { firma, maquetar, parrafo, saludo, urlDeLaWeb } from './correos/plantilla.js';
import { anioDeLaMesa } from './procesion/zonas.service.js';
import { SalidasService } from './procesion/salidas.service.js';
import { ModulosService } from './modulos.service.js';
import { diaDeHoy } from '../domain/fechas-hermano.js';
import { articuloDe, deLaCorporacion } from '../domain/articulos.js';
import {
  adaptarAlCorreo, describirSegmento, destinatariosDe, emailDeToken, tokenDeBaja,
  type Destinatario, type Segmento, type SalidaDelSegmento,
} from '../domain/comunicados.js';

export interface DatosComunicado {
  tipo: TipoComunicado;
  asunto: string;
  cuerpo: string;
  segmento: Segmento;
}

/** Entre correo y correo: por debajo de lo que Gmail tolera sin cortar. Se puede cambiar con COMUNICADOS_PAUSA_MS. */
const pausa = () => Number(process.env.COMUNICADOS_PAUSA_MS ?? 1500);
const secreto = () => process.env.JWT_SECRET ?? '';
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Solo los filtros que se conocen, para guardar lo que se eligió y nada más. */
function segmentoLimpio(s: Segmento): Segmento {
  return {
    conPapeleta: Number.isInteger(s.conPapeleta) && (s.conPapeleta ?? 0) > 0 ? s.conPapeleta : null,
    conDeuda: s.conDeuda === true,
    edad: s.edad === 'MAYORES' || s.edad === 'MENORES' ? s.edad : null,
    poblacion: s.poblacion?.trim().slice(0, 100) || null,
  };
}

/** Las fichas del segmento: siempre activas; en el boletín, solo las suscritas. */
async function fichasDelSegmento(tipo: TipoComunicado, s: Segmento) {
  const hoy = diaDeHoy();
  const hace18 = new Date(`${Number(hoy.slice(0, 4)) - 18}${hoy.slice(4)}T00:00:00Z`);
  // «Con papeleta de…» es de Procesión: apagada, el filtro no existe y se manda a todos los del segmento.
  const conPapeleta = s.conPapeleta && (await ModulosService.activo('procesion')) ? s.conPapeleta : null;
  const where: Prisma.HermanoWhereInput = {
    activo: true,
    ...(tipo === TipoComunicado.BOLETIN ? { boletin: true } : {}),
    ...(conPapeleta ? { papeletas: { some: { salidaId: conPapeleta, year: anioDeLaMesa(await SalidasService.porId(conPapeleta)) } } } : {}),
    ...(s.conDeuda ? { recibos: { some: { estado: { in: [EstadoPago.PENDIENTE, EstadoPago.DEVUELTO] } } } } : {}),
    ...(s.edad === 'MAYORES' ? { fechaNacimiento: { lte: hace18 } } : s.edad === 'MENORES' ? { fechaNacimiento: { gt: hace18 } } : {}),
    ...(s.poblacion ? { poblacion: s.poblacion } : {}),
  };
  const fichas = await db.hermano.findMany({
    where,
    select: { nombre: true, sexo: true, email: true, user: { select: { email: true } } },
    orderBy: [{ apellidos: 'asc' }, { id: 'asc' }],
  });
  return fichas.map((f) => ({ nombre: f.nombre, sexo: f.sexo, email: f.email, emailCuenta: f.user.email }));
}

/** El correo de un comunicado para un destinatario. */
function correoPara(c: { tipo: TipoComunicado; asunto: string; cuerpo: string }, d: Destinatario): string {
  const esBoletin = c.tipo === TipoComunicado.BOLETIN;
  const cuerpo = adaptarAlCorreo(c.cuerpo, urlDeLaWeb(), process.env.API_URL || 'http://localhost:3001');
  const baja = esBoletin
    ? parrafo(
      `Recibe este boletín porque se suscribió en su ficha. Si ya no quiere recibirlo, <a href="${urlDeLaWeb(`/boletin/baja?t=${encodeURIComponent(tokenDeBaja(d.email, secreto()))}`)}" style="color: inherit; text-decoration: underline;">dese de baja aquí</a>.`,
      'margin-top: 28px; font-size: 13px; color: #6b6259;',
    )
    : '';
  return maquetar({
    titulo: c.asunto,
    antetitulo: `${esBoletin ? 'Boletín' : 'Aviso'} ${deLaCorporacion()}`,
    resumen: extractoPlano(c.cuerpo).slice(0, 140),
    contenido: [
      d.nombre ? saludo(d.nombre, d.sexo) : parrafo('Queridos hermanos:'),
      cuerpo,
      firma(null, esBoletin ? 'La Junta de Gobierno' : 'La Secretaría'),
      baja,
    ].join(''),
  });
}

/** El nombre y el artículo de cada salida por su id, también de las desactivadas: un comunicado viejo sigue diciendo a quién fue. */
const nombresDeSalidas = async () => new Map((await SalidasService.listar({ todas: true }))
  .map((s) => [s.id, { nombre: s.nombre, articulo: articuloDe(s) }]));

const resumen = (c: { id: number; tipo: TipoComunicado; asunto: string; estado: EstadoComunicado; segmento: Prisma.JsonValue; enviadoEl: Date | null; autorNombre: string | null; createdAt: Date; updatedAt: Date }, nombres: ReadonlyMap<number, SalidaDelSegmento>) => ({
  id: c.id, tipo: c.tipo, asunto: c.asunto, estado: c.estado, segmento: c.segmento as Segmento,
  para: describirSegmento(c.tipo, c.segmento as Segmento, nombres), enviadoEl: c.enviadoEl, autorNombre: c.autorNombre,
  createdAt: c.createdAt, updatedAt: c.updatedAt,
});

// --- El envío en segundo plano ---------------------------------------------

let enMarcha: Promise<void> | null = null;

/**
 * Manda lo pendiente, de uno en uno, hasta que no quede nada. Solo hay uno en
 * marcha a la vez: si ya está corriendo, devuelve el mismo.
 */
function procesarPendientes(): Promise<void> {
  enMarcha ??= (async () => {
    try {
      for (;;) {
        const envio = await db.comunicadoEnvio.findFirst({
          where: { estado: EstadoEnvio.PENDIENTE, comunicado: { estado: EstadoComunicado.ENVIANDO } },
          include: { comunicado: { select: { id: true, tipo: true, asunto: true, cuerpo: true } } },
          orderBy: { id: 'asc' },
        });
        if (!envio) break;
        const ok = await enviarCorreo(envio.email, envio.comunicado.asunto, correoPara(envio.comunicado, envio));
        await db.comunicadoEnvio.update({
          where: { id: envio.id },
          data: { estado: ok ? EstadoEnvio.ENVIADO : EstadoEnvio.FALLIDO, enviadoEl: new Date() },
        });
        const quedan = await db.comunicadoEnvio.count({ where: { comunicadoId: envio.comunicadoId, estado: EstadoEnvio.PENDIENTE } });
        if (quedan === 0) {
          await db.comunicado.update({ where: { id: envio.comunicadoId }, data: { estado: EstadoComunicado.ENVIADO } });
        } else if (pausa() > 0) {
          await esperar(pausa());
        }
      }
    } catch (error) {
      // Un fallo de la base no debe tumbar el servidor: lo pendiente sigue
      // apuntado y se retoma al volver a enviar o al arrancar.
      console.error('❌ [Comunicados] El envío se ha detenido:', error);
    } finally {
      enMarcha = null;
    }
  })();
  return enMarcha;
}

export class ComunicadosService {
  static async listar() {
    const lista = await db.comunicado.findMany({ orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 200 });
    const cuentas = await db.comunicadoEnvio.groupBy({ by: ['comunicadoId', 'estado'], where: { comunicadoId: { in: lista.map((c) => c.id) } }, _count: { _all: true } });
    const de = (id: number, estado: EstadoEnvio) => cuentas.find((x) => x.comunicadoId === id && x.estado === estado)?._count._all ?? 0;
    const nombres = await nombresDeSalidas();
    return lista.map((c) => ({
      ...resumen(c, nombres),
      envios: { enviados: de(c.id, EstadoEnvio.ENVIADO), fallidos: de(c.id, EstadoEnvio.FALLIDO), pendientes: de(c.id, EstadoEnvio.PENDIENTE) },
    }));
  }

  static async obtener(id: number) {
    const c = await db.comunicado.findUnique({ where: { id } });
    if (!c) throw new NotFoundError('Comunicado no encontrado.');
    return { ...resumen(c, await nombresDeSalidas()), cuerpo: c.cuerpo };
  }

  /** A cuántas direcciones llegaría, y cuántas fichas del segmento no tienen correo. */
  static async destinatarios(tipo: TipoComunicado, segmento: Segmento) {
    const s = segmentoLimpio(segmento);
    const fichas = await fichasDelSegmento(tipo, s);
    const { destinatarios, sinCorreo } = destinatariosDe(fichas);
    return { para: describirSegmento(tipo, s, await nombresDeSalidas()), fichas: fichas.length, correos: destinatarios.length, sinCorreo };
  }

  static async crear(datos: DatosComunicado, meta?: MetaDeAuditoria) {
    const autor = meta?.userId ? await db.user.findUnique({ where: { id: meta.userId }, select: { nombre: true, apellidos: true } }) : null;
    const c = await db.comunicado.create({
      data: {
        tipo: datos.tipo, asunto: datos.asunto.trim(), cuerpo: sanearContenidoCms(datos.cuerpo),
        segmento: segmentoLimpio(datos.segmento) as Prisma.InputJsonObject,
        autorId: meta?.userId ?? null, autorNombre: autor ? `${autor.nombre} ${autor.apellidos}`.trim() : null,
      },
    });
    return { ...resumen(c, await nombresDeSalidas()), cuerpo: c.cuerpo };
  }

  /** Solo el borrador se cambia: lo enviado es lo que recibieron. */
  static async actualizar(id: number, datos: DatosComunicado) {
    const cambiado = await db.comunicado.updateMany({
      where: { id, estado: EstadoComunicado.BORRADOR },
      data: {
        tipo: datos.tipo, asunto: datos.asunto.trim(), cuerpo: sanearContenidoCms(datos.cuerpo),
        segmento: segmentoLimpio(datos.segmento) as Prisma.InputJsonObject,
      },
    });
    if (cambiado.count === 0) {
      if (!(await db.comunicado.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundError('Comunicado no encontrado.');
      throw new HttpError('Este comunicado ya se envió: no se puede cambiar.', 409);
    }
    return ComunicadosService.obtener(id);
  }

  static async borrar(id: number) {
    const borrado = await db.comunicado.deleteMany({ where: { id, estado: EstadoComunicado.BORRADOR } });
    if (borrado.count === 0) throw new HttpError('Solo se borran los borradores: lo enviado se queda como constancia.', 409);
  }

  /** Una prueba a quien lo está escribiendo, con su nombre en el saludo. */
  static async enviarPrueba(id: number, meta?: MetaDeAuditoria) {
    const c = await db.comunicado.findUnique({ where: { id } });
    if (!c) throw new NotFoundError('Comunicado no encontrado.');
    const yo = meta?.userId ? await db.user.findUnique({ where: { id: meta.userId }, select: { email: true, nombre: true } }) : null;
    if (!yo) throw new HttpError('No se sabe a quién mandar la prueba.');
    const ok = await enviarCorreo(yo.email, `[Prueba] ${c.asunto}`, correoPara(c, { email: yo.email, nombre: yo.nombre, sexo: null }));
    if (!ok) throw new HttpError('La prueba no ha salido: revisa la cuenta de correo del servidor.', 502);
    return { message: `Prueba enviada a ${yo.email}.` };
  }

  /**
   * Apunta a los destinatarios y arranca el envío. Todo o nada: si dos
   * personas pulsan a la vez, solo una lo manda.
   */
  static async enviar(id: number, meta?: MetaDeAuditoria) {
    const c = await db.comunicado.findUnique({ where: { id } });
    if (!c) throw new NotFoundError('Comunicado no encontrado.');
    if (c.estado !== EstadoComunicado.BORRADOR) throw new HttpError('Este comunicado ya se envió.', 409);
    const { destinatarios } = destinatariosDe(await fichasDelSegmento(c.tipo, c.segmento as Segmento));
    if (destinatarios.length === 0) throw new HttpError('Nadie del segmento tiene correo: no hay a quién mandarlo.', 409);

    await db.$transaction(async (tx) => {
      const pasa = await tx.comunicado.updateMany({
        where: { id, estado: EstadoComunicado.BORRADOR },
        data: { estado: EstadoComunicado.ENVIANDO, enviadoEl: new Date() },
      });
      if (pasa.count === 0) throw new HttpError('Este comunicado ya se envió.', 409);
      await tx.comunicadoEnvio.createMany({
        data: destinatarios.map((d) => ({ comunicadoId: id, email: d.email, nombre: d.nombre, sexo: d.sexo })),
      });
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.COMUNICADO_ENVIAR, meta ?? {}, 'comunicado', id, {
      despues: { tipo: c.tipo, asunto: c.asunto, destinatarios: destinatarios.length },
    });
    void procesarPendientes();
    return { message: `Enviando a ${destinatarios.length === 1 ? '1 dirección' : `${destinatarios.length} direcciones`}. Tarda unos minutos: se ve aquí cómo avanza.`, destinatarios: destinatarios.length };
  }

  /** Vuelve a intentar los que fallaron (la cuenta se quedó sin cupo, por ejemplo). */
  static async reintentarFallidos(id: number) {
    const r = await db.$transaction([
      db.comunicadoEnvio.updateMany({ where: { comunicadoId: id, estado: EstadoEnvio.FALLIDO }, data: { estado: EstadoEnvio.PENDIENTE, enviadoEl: null } }),
      db.comunicado.updateMany({ where: { id, estado: EstadoComunicado.ENVIADO }, data: { estado: EstadoComunicado.ENVIANDO } }),
    ]);
    if (r[0].count === 0) throw new HttpError('No hay envíos fallidos que reintentar.', 409);
    void procesarPendientes();
    return { message: `Reintentando ${r[0].count === 1 ? '1 envío' : `${r[0].count} envíos`}.` };
  }

  /** Al arrancar el servidor: si se quedó algo a medias, sigue. */
  static reanudar() {
    return procesarPendientes();
  }

  /** La baja del boletín desde el enlace del correo: todas las fichas con esa dirección. */
  static async bajaDelBoletin(token: string) {
    const email = emailDeToken(token, secreto());
    if (!email) throw new HttpError('El enlace de baja no es válido. Cópialo entero del correo, o date de baja desde tu área de hermanos.');
    const r = await db.hermano.updateMany({
      where: { boletin: true, OR: [{ email }, { email: null, user: { email } }] },
      data: { boletin: false },
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.BOLETIN_BAJA, {}, 'boletin', undefined, { despues: { fichas: r.count } });
    return { message: `Hecho: ya no recibirás el boletín. Los avisos ${deLaCorporacion({ corto: true })} (cuotas, cabildos) te seguirán llegando.`, fichas: r.count };
  }
}

/** Para las pruebas: esperar a que el envío en segundo plano termine. */
export const envioTerminado = () => enMarcha ?? Promise.resolve();
