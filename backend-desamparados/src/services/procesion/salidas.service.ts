/**
 * Las salidas procesionales: filas que define el CMS (el Sábado de Pasión, el
 * Rosario vespertino, las que se añadan). Todo lo de la procesión recibe la
 * fila ya leída, con su acto de la Agenda: de ahí salen su fecha, su cobro,
 * su ropa, sus puestos y su plazo.
 *
 * Las de fecha a mano (`MANUAL`) la toman de un acto de la Agenda que fija
 * Secretaría cada año; ese acto es también de donde la papeleta saca su día,
 * su hora y su lugar (ver `leerDatosEvento`).
 */
import { FechaSalida, Prisma, TipoEvento, type Evento, type Salida } from '@prisma/client';
import db from '../../config/db.js';
import { HttpError } from '../../utils/error.handle.js';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from '../auditoria.service.js';
import { diaMadrid, fechaDeSalida, anioDeLaSalida, proximaFecha, type ReglaFecha } from '../../domain/fecha-salida.js';
import { enMadrid } from '../../domain/datos-areas.js';
import type { PuestoDelCatalogo } from '../../domain/salidas.js';
import type { ConfiguracionCortejo } from '../../domain/cortejo.js';
import type { DatosSalida, SalidaCms, SalidaWeb } from '../../dtos/procesion.dto.js';
import { articuloDe, conArticulo, mayuscula, segunNumero, type Articulo } from '../../domain/articulos.js';

export type SalidaConActo = Salida & { acto: Evento | null };

/** Con `PASCUA` y sin días desde la Pascua no hay fecha que calcular: ni al crear ni al editar. */
function comprobarFecha(datos: Pick<DatosSalida, 'fecha' | 'diasDesdePascua'>): void {
  if (datos.fecha === 'PASCUA' && datos.diasDesdePascua == null) {
    throw new HttpError('Di cuántos días antes o después de la Pascua es la salida.', 400);
  }
}

/**
 * De los datos del formulario a lo que espera Prisma: el importe en
 * `Decimal`, los puestos como JSON y, con `MANUAL`, `diasDesdePascua` siempre
 * a `null` (con `PASCUA` calculada sola, un valor a mano sobrante solo
 * confundiría). Sirve igual para el alta (todos los campos) que para la
 * edición (solo los que cambian): lo que no venga en `datos` no se toca.
 */
function normalizar(datos: Partial<DatosSalida>): Record<string, unknown> {
  const { puestos, importeCuota, diasDesdePascua, fecha, ...resto } = datos;
  return {
    ...resto,
    ...(fecha !== undefined ? { fecha } : {}),
    ...(fecha === 'MANUAL'
      ? { diasDesdePascua: null }
      : diasDesdePascua !== undefined ? { diasDesdePascua } : {}),
    ...(importeCuota !== undefined ? { importeCuota: new Prisma.Decimal(importeCuota) } : {}),
    ...(puestos !== undefined ? { puestos: puestos as unknown as Prisma.InputJsonValue } : {}),
  };
}

type Cliente = Prisma.TransactionClient | typeof db;

/** La regla de fecha de una fila, para las funciones puras de `fecha-salida`. */
export function reglaDe(s: SalidaConActo): ReglaFecha {
  if (s.fecha === FechaSalida.PASCUA) return { fecha: 'PASCUA', diasDesdePascua: s.diasDesdePascua ?? 0 };
  return { fecha: 'MANUAL', acto: s.acto ? diaMadrid(s.acto.startDate) : null };
}

/**
 * Sin próxima fecha no se sabe para qué año es una solicitud: una salida a
 * mano sin acto toma el año natural, y quien pedía en diciembre para la de
 * enero dejaba una solicitud de una salida que ya pasó. El plazo ya lo exige
 * al abrirse; esto lo exige al pedir (en el área y en la mesa), por si la
 * salida se quedó sin fecha con el plazo abierto.
 */
export function exigirProximaFecha(s: SalidaConActo, hoy = diaMadrid(new Date())): void {
  if (proximaFecha(reglaDe(s), hoy)) return;
  const art = articuloDe(s);
  throw new HttpError(`${mayuscula(conArticulo(art, s.nombre))} ${segunNumero(art, 'todavía no tiene', 'todavía no tienen')} fecha: no se puede pedir la papeleta hasta que se ponga.`, 409);
}

/**
 * La salida de una petición: `?salida=<slug>` en las lecturas, `salida` en el
 * cuerpo en las escrituras. Sin ella o si no existe, el 400 de `porSlug`.
 */
export function salidaDe(peticion: { query?: Record<string, unknown>; body?: unknown }): Promise<SalidaConActo> {
  const delCuerpo = (peticion.body as { salida?: unknown } | undefined)?.salida;
  const slug = peticion.query?.salida ?? delCuerpo;
  return SalidasService.porSlug(typeof slug === 'string' ? slug : undefined);
}

/**
 * El acto de la Agenda de ese año (en Madrid) con el nombre de la salida y
 * tipo PROCESION que no sea la fecha de otra salida, o `null`.
 */
async function actoDelAnio(tx: Prisma.TransactionClient, salida: SalidaConActo, anio: string): Promise<number | null> {
  const candidatos = await tx.evento.findMany({
    where: {
      title: salida.nombre,
      type: TipoEvento.PROCESION,
      startDate: { gte: new Date(`${Number(anio) - 1}-12-31T00:00:00Z`), lt: new Date(`${Number(anio) + 1}-01-02T00:00:00Z`) },
      salidas: { none: { id: { not: salida.id } } },
    },
    orderBy: { startDate: 'desc' },
    select: { id: true, startDate: true },
  });
  return candidatos.find((e) => diaMadrid(e.startDate).startsWith(`${anio}-`))?.id ?? null;
}

/** La próxima salida para la cuenta atrás de la portada: lo justo, nada de cuotas ni puestos. */
interface ProximaSalida {
  nombre: string;
  articulo: Articulo;
  /** El día en Madrid, `AAAA-MM-DD`. */
  dia: string;
  /** La hora de salida en Madrid, `HH:MM`, o null si no se ha puesto. */
  hora: string | null;
}

export class SalidasService {
  /**
   * La salida activa que antes llega, de hoy en adelante (el mismo día todavía
   * cuenta: la portada dice «hoy»). Las de la Pascua, con su hora de salida;
   * las de fecha a mano, con la de su acto de la Agenda.
   */
  static async proxima(hoy = diaMadrid(new Date())): Promise<ProximaSalida | null> {
    let mejor: ProximaSalida | null = null;
    for (const s of await SalidasService.listar()) {
      const dia = proximaFecha(reglaDe(s), hoy);
      if (!dia) continue;
      const hora = s.fecha === FechaSalida.MANUAL
        ? (s.acto ? enMadrid(s.acto.startDate.toISOString()).hora : null)
        : (s.horaSalida && /^\d{2}:\d{2}$/.test(s.horaSalida) ? s.horaSalida : null);
      const candidata: ProximaSalida = { nombre: s.nombre, articulo: articuloDe(s), dia, hora };
      const clave = (x: ProximaSalida) => `${x.dia}T${x.hora ?? '00:00'}`;
      if (!mejor || clave(candidata) < clave(mejor)) mejor = candidata;
    }
    return mejor;
  }

  /**
   * La salida de un `?salida=<slug>`. Sin ella no se sabe de qué salida se
   * habla, y antes se suponía la Pasión: con varias salidas, suponer es
   * equivocarse en silencio. Por eso es un 400 y no un valor por defecto.
   */
  static async porSlug(slug: string | undefined, cliente: Cliente = db): Promise<SalidaConActo> {
    const limpio = typeof slug === 'string' ? slug.trim() : '';
    if (!limpio) throw new HttpError('Falta la salida.', 400);
    const salida = await cliente.salida.findUnique({ where: { slug: limpio }, include: { acto: true } });
    if (!salida) throw new HttpError(`No existe la salida «${limpio}».`, 400);
    return salida;
  }

  static async porId(id: number, cliente: Cliente = db): Promise<SalidaConActo> {
    const salida = await cliente.salida.findUnique({ where: { id }, include: { acto: true } });
    if (!salida) throw new HttpError('No existe esa salida.', 400);
    return salida;
  }

  /** Por su orden, y solo las activas salvo que se pidan todas (el CMS). */
  static listar(opciones: { todas?: boolean } = {}): Promise<SalidaConActo[]> {
    return db.salida.findMany({
      where: opciones.todas ? {} : { activa: true },
      include: { acto: true },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    });
  }

  /** Alta de una salida desde el CMS. El slug es único: repetido, 409. */
  static async crear(datos: DatosSalida, meta?: MetaDeAuditoria): Promise<SalidaConActo> {
    comprobarFecha(datos);
    try {
      const s = await db.salida.create({ data: normalizar(datos) as Prisma.SalidaCreateInput, include: { acto: true } });
      await AuditoriaService.log(ACCIONES_AUDITORIA.SALIDA_CREAR, meta ?? {}, 'salida', s.id, { despues: { slug: s.slug, nombre: s.nombre } });
      return s;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new HttpError('Ya hay una salida con ese nombre corto.', 409);
      throw e;
    }
  }

  /**
   * Edita los campos que lleguen (el resto se queda como estaba). La fecha a
   * mano no se toca aquí: va por `fijarFecha`, que mueve el acto de la
   * Agenda. `comprobarFecha` mira la fila ya fusionada con los cambios, para
   * detectar tanto un `PASCUA` nuevo sin días como uno que ya lo era y se
   * queda sin ellos al tocar otro campo.
   */
  static async editar(id: number, cambios: Partial<DatosSalida>, meta?: MetaDeAuditoria): Promise<SalidaConActo> {
    const antes = await SalidasService.porId(id);
    comprobarFecha({ ...antes, ...cambios } as DatosSalida);
    // Pasarla a mano sin acto la deja sin fecha, y sin fecha su año es el
    // natural: con el plazo abierto, las solicitudes del año de la salida
    // dejaban de verse y las nuevas nacían para una salida ya pasada. Con el
    // plazo abierto se pasa a mano con su fecha, en `fijarFecha` (`aMano`).
    if (cambios.fecha === FechaSalida.MANUAL && antes.fecha !== FechaSalida.MANUAL && antes.plazoAbierto
      && !proximaFecha(reglaDe({ ...antes, fecha: FechaSalida.MANUAL }), diaMadrid(new Date()))) {
      throw new HttpError('Con el plazo abierto, la salida no puede quedarse sin fecha: pásala a mano junto con su fecha, o cierra antes el plazo.', 409);
    }
    try {
      // Una salida desactivada deja de verse, pero su plazo seguía abierto: al
      // reactivarla, la solicitud volvía abierta sin que nadie la abriera.
      const cierre = cambios.activa === false && antes.plazoAbierto ? { plazoAbierto: false, plazoCambiadoEl: new Date() } : {};
      const s = await db.salida.update({ where: { id }, data: { ...(normalizar(cambios) as Prisma.SalidaUpdateInput), ...cierre }, include: { acto: true } });
      await AuditoriaService.log(ACCIONES_AUDITORIA.SALIDA_EDITAR, meta ?? {}, 'salida', s.id, {
        antes: Object.fromEntries(Object.keys({ ...cambios, ...cierre }).filter((c) => c !== 'plazoCambiadoEl').map((c) => {
          const valor = (antes as Record<string, unknown>)[c];
          return [c, valor instanceof Prisma.Decimal ? valor.toNumber() : valor];
        })),
        despues: { ...cambios, ...('plazoAbierto' in cierre && { plazoAbierto: false }) },
      } as unknown as Prisma.InputJsonValue);
      return s;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new HttpError('Ya hay una salida con ese nombre corto.', 409);
      throw e;
    }
  }

  /** Lo que la web necesita: la fila y su fecha de este año, ya calculada. */
  static paraLaWeb(s: SalidaConActo, hoy = diaMadrid(new Date())): SalidaWeb {
    const regla = reglaDe(s);
    const anio = anioDeLaSalida(regla, hoy);
    return {
      id: s.id, slug: s.slug, nombre: s.nombre, articulo: articuloDe(s), orden: s.orden, activa: s.activa, conRopa: s.conRopa,
      cobro: s.cobro, importeCuota: Number(s.importeCuota), fecha: s.fecha, diasDesdePascua: s.diasDesdePascua,
      horaSalida: s.horaSalida, lugar: s.lugar, eventoId: s.eventoId, plazoAbierto: s.plazoAbierto,
      puestos: s.puestos as unknown as PuestoDelCatalogo[], cortejo: s.cortejo as unknown as ConfiguracionCortejo | null,
      indicaciones: s.indicaciones, anio, fechaDelAnio: fechaDeSalida(regla, anio),
      acto: s.acto ? { inicio: s.acto.startDate.toISOString(), lugar: s.acto.location } : null,
    };
  }

  /**
   * La lista del CMS: lo de la web y, por salida, las solicitudes de su año
   * aún sin recoger. Con ellas, la ficha avisa antes de cambiar la fecha o el
   * cobro, que esos hermanos pidieron con lo de antes y nadie les avisa solo.
   */
  static async paraElCms(salidas: SalidaConActo[], hoy = diaMadrid(new Date())): Promise<SalidaCms[]> {
    const web = salidas.map((s) => SalidasService.paraLaWeb(s, hoy));
    if (web.length === 0) return [];
    const cuentas = await db.solicitud.groupBy({
      by: ['salidaId', 'year'],
      where: { estado: 'PENDIENTE', OR: web.map((s) => ({ salidaId: s.id, year: s.anio })) },
      _count: { _all: true },
    });
    return web.map((s) => ({ ...s, solicitudesPendientes: cuentas.find((c) => c.salidaId === s.id && c.year === s.anio)?._count._all ?? 0 }));
  }

  /** El acto de la Agenda de una salida a mano, si ya tiene fecha. */
  static fecha(salida: SalidaConActo) {
    const { acto } = salida;
    return acto ? { eventoId: acto.id, inicio: acto.startDate, lugar: acto.location } : null;
  }

  /**
   * Fija (o cambia) la fecha de una salida a mano: crea su acto en la Agenda o
   * mueve el que ya tenía si es del mismo año, y lo enlaza a la fila. Las de la Pascua se calculan
   * solas: ponerles fecha a mano dejaría dos fechas que no coinciden.
   *
   * Con `aMano`, una de la Pascua pasa a mano con esta fecha en la misma
   * transacción: en dos llamadas (cambiar el modo y luego la fecha), si la
   * segunda fallaba la salida se quedaba a mano y sin fecha.
   */
  static async fijarFecha(salida: SalidaConActo, datos: { inicio: string; lugar?: string | null; aMano?: boolean }, meta?: MetaDeAuditoria) {
    const pasaAMano = salida.fecha !== FechaSalida.MANUAL;
    if (pasaAMano && !datos.aMano) {
      throw new HttpError('Esta salida se calcula por la Pascua: su fecha no se pone a mano.', 409);
    }
    const inicio = new Date(datos.inicio);
    if (Number.isNaN(inicio.getTime())) throw new HttpError('La fecha de la salida no es válida.');

    const hoy = diaMadrid(new Date());
    const dia = diaMadrid(inicio);
    const antes = SalidasService.fecha(salida);
    const mismoAnio = !!antes && diaMadrid(antes.inicio).slice(0, 4) === dia.slice(0, 4);
    // Un día pasado solo para corregir la del mismo año (la salida ya
    // celebrada, con su día mal puesto). Fuera de eso era un año mal escrito:
    // 2025 por 2026 creaba un acto de 2025, dejaba suelto el de 2026 y la
    // salida pasaba a «por anunciar».
    if (dia < hoy && !mismoAnio) {
      throw new HttpError(`La fecha de la salida no puede ser un día que ya ha pasado (hoy es ${hoy.split('-').reverse().join('/')}).`);
    }
    if (pasaAMano && salida.plazoAbierto) {
      const anio = anioDeLaSalida(reglaDe(salida), hoy);
      if (Number(dia.slice(0, 4)) !== anio) {
        throw new HttpError(`Con el plazo abierto, la fecha a mano tiene que ser de ${anio}, el año de la salida que se prepara: las solicitudes ya hechas son de ese año.`, 409);
      }
    }

    const acto = {
      title: salida.nombre,
      description: salida.indicaciones,
      location: datos.lugar?.trim() || null,
      startDate: inicio,
      type: TipoEvento.PROCESION,
    };
    // Un acto por año: si el enlazado es de otro, se crea uno nuevo y el viejo
    // se queda en la Agenda como historia. Moverlo borraría la fecha de la
    // salida de aquel año, que es lo que sus papeletas impresas dicen.
    // Solo se enlaza el último acto: poner ya la del año que viene, con la de
    // este todavía por delante, dejaba a la mesa, la Puerta y el cortejo sin
    // las papeletas que se están repartiendo.
    if (antes && !mismoAnio && inicio > antes.inicio && diaMadrid(antes.inicio) >= hoy) {
      throw new HttpError(`La salida de ${diaMadrid(antes.inicio).slice(0, 4)} todavía no se ha celebrado: la del año siguiente se pone cuando pase. Si esa fecha está mal, cámbiala dentro de su año.`, 409);
    }
    // Crear el acto y enlazarlo, juntos: si el enlace fallaba, quedaba un acto
    // suelto en la Agenda pública con el nombre de la salida.
    const evento = await db.$transaction(async (tx) => {
      // De otro año, pero ese año ya tiene su acto (se corrigió un año mal
      // puesto y se vuelve a él): se reutiliza en vez de dejar dos iguales el
      // mismo día en la Agenda. Solo uno que no sea la fecha de otra salida.
      const delMismoAnio = antes && mismoAnio ? null : await actoDelAnio(tx, salida, dia.slice(0, 4));
      const reutilizado = antes && mismoAnio ? antes.eventoId : delMismoAnio;
      const guardado = reutilizado
        ? await tx.evento.update({ where: { id: reutilizado }, data: acto })
        : await tx.evento.create({ data: acto });
      await tx.salida.update({
        where: { id: salida.id },
        data: { eventoId: guardado.id, ...(pasaAMano && { fecha: FechaSalida.MANUAL, diasDesdePascua: null }) },
      });
      return guardado;
    });

    await AuditoriaService.log(ACCIONES_AUDITORIA.SALIDA_FECHAR, meta ?? {}, 'salida', salida.id, {
      antes: antes && { eventoId: antes.eventoId, inicio: antes.inicio.toISOString(), lugar: antes.lugar },
      despues: { eventoId: evento.id, inicio: evento.startDate.toISOString(), lugar: evento.location },
      ...(pasaAMano && { fecha: { antes: salida.fecha, despues: FechaSalida.MANUAL } }),
    });
    return { eventoId: evento.id, inicio: evento.startDate, lugar: evento.location };
  }
}
