/**
 * La mesa de la procesión: buscar a la persona (o darla de alta si no está en
 * el censo), leer su ficha con lo que tiene pendiente, corregir sus datos o
 * su papeleta y el listado de los apuntados. Inscribir, cobrar y dar la ropa,
 * cada cosa en su zona, están en `ZonasService`.
 *
 * Es lo que antes se llevaba en una hoja de cálculo: nombre, fecha de
 * nacimiento, teléfono, puesto, altura de hombro, túnica y capirote o faraona.
 */
import { randomBytes } from 'node:crypto';
import { Cingulo, EstadoCita, EstadoPrenda, EstadoSolicitud, Parentesco, Prisma, Role, Sexo, TipoPrenda } from '@prisma/client';
import db from '../../config/db.js';
import { encrypt } from '../../utils/bcrypt.handle.js';
import { HttpError, NotFoundError } from '../../utils/error.handle.js';
import { condicionBusqueda } from '../../domain/busqueda-texto.js';
import { apellidosTrasCambio, componerApellidos } from '../../domain/apellidos.js';
import { comprobarEsAdulto, comprobarEsMenor } from '../../domain/fechas-hermano.js';
import { diaMadridComoIntervalo } from '../../domain/contabilidad.js';
import { alturaHombroEnCm, normalizarNumeroPrenda, propuestaDeRopa, type Origen } from '../../domain/mesa-procesion.js';
import { getNextNumeroHermano, transaccionReintentable } from '../hermanos/comunes.js';
import { CensoService } from '../censo.service.js';
import { SolicitudesService } from '../solicitudes.service.js';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from '../auditoria.service.js';
import { CAMPO_DE_ROPA, comprobarQueNoVaEnOtraPapeleta, prestarRopaEnTransaccion, recogerRopaEnTransaccion, ropaPedida, tunicasLibres, type TipoRopa } from './ropa.js';
import { anioDeLaMesa, cuotasQueCuentan, pendienteDe } from './zonas.service.js';
import { prestarCinguloEnTransaccion, recuentoDeCingulos, type CinguloEnMesa } from './cingulos.js';
import { avisarALaMesa } from './avisos-mesa.js';
import { enmascararEmail } from '../../utils/log-privacidad.js';
import { conceptoDeSalida, requisitosParaRecoger } from '../../domain/salidas.js';
import { cuotaDe } from './plazo.service.js';
import type { SalidaConActo } from './salidas.service.js';


/**
 * Qué busca cada zona: Inscripción, a quien aún no está apuntado; Túnicas, a
 * quien está apuntado y no ha recogido; Devolución, a quien tiene algo del
 * ropero sin devolver.
 */
export type ZonaDeBusqueda = 'inscripcion' | 'tesoreria' | 'tunicas' | 'devolucion' | 'todas';

/** Cuántas personas devuelve el buscador: la mesa afina escribiendo más. */
const RESULTADOS = 12;

/**
 * Quién lleva el censo en la mesa: busca por cualquier dato, ve la ficha
 * entera (DNI y contacto), la corrige, da de alta y reactiva. Es la misma
 * lista que puede «Reactivar» o «Aprobar alta» (`/activar`).
 */
export const ROLES_CENSO_EN_MESA: readonly Role[] = [Role.ADMIN, Role.SECRETARIA];
export const esDelCensoEnMesa = (rol: string | undefined): boolean => rol !== undefined && (ROLES_CENSO_EN_MESA as readonly string[]).includes(rol);

/**
 * Lo que puede la persona de la mesa que pide. Tesorería y Albacería cobran y
 * dan la ropa: les basta reconocer a quien tienen delante, y no necesitan el
 * DNI ni el contacto de nadie, ni ver bajas, pendientes o difuntos. Antes
 * buscaban por un trozo de DNI o de teléfono y leían y corregían cualquier
 * ficha del censo, todo el año (auditoría del 07-10-2026, AC3).
 */
export interface AccesoMesa {
  censo: boolean;
}
const SIN_CENSO: AccesoMesa = { censo: false };

/** Está en activo: lo único que ve de la mesa quien no lleva el censo. */
const EN_ACTIVO: Prisma.HermanoWhereInput = { activo: true, fechaBaja: null };
/** Le queda ropa por devolver: aunque esté de baja, Albacería tiene que poder recibirla. */
const CON_ROPA_SIN_DEVOLVER: Prisma.HermanoWhereInput = {
  OR: [{ prendas: { some: { estado: EstadoPrenda.PRESTADA } } }, { papeletas: { some: { cingulo: Cingulo.PRESTADO } } }],
};

/** `623577927` → `••••••927`: lo justo para confirmar con la persona delante. */
const enmascararTelefono = (telefono: string) => {
  const digitos = telefono.replace(/\s+/g, '');
  return digitos.length <= 3 ? '•••' : `${'•'.repeat(digitos.length - 3)}${digitos.slice(-3)}`;
};

type Situacion = 'activo' | 'baja' | 'pendiente';
const situacionDe = (h: { activo: boolean; fechaBaja: Date | null }): Situacion =>
  h.activo ? 'activo' : h.fechaBaja ? 'baja' : 'pendiente';

export interface AltaEnMesaDto {
  nombre: string;
  primerApellido: string;
  segundoApellido?: string;
  /** AAAA-MM-DD */
  fechaNacimiento: string;
  sexo?: Sexo;
  telefono?: string;
  email?: string;
  dni?: string;
  /** Solo los menores: de qué cuenta cuelgan. */
  tutor?: { hermanoId: number } | { nuevo: { nombre: string; primerApellido: string; segundoApellido?: string; dni: string; telefono: string; email: string } };
  parentesco?: Parentesco;
}

export interface CorreccionFichaDto {
  nombre?: string;
  primerApellido?: string;
  segundoApellido?: string | null;
  fechaNacimiento?: string;
  telefono?: string | null;
  email?: string | null;
  alturaHombro?: string | null;
}

export interface EdicionSolicitudDto {
  puesto?: string;
  observaciones?: string | null;
  /** Solo en las salidas de donativo, y mientras no esté pagado. */
  donativo?: number;
}

export interface EdicionPapeletaDto {
  puesto?: string;
  tramo?: string | null;
  observaciones?: string | null;
  numTunicaAsignada?: string | null;
  numCapiroteAsignado?: string | null;
  numFaraonaAsignada?: string | null;
  /** Solo en una papeleta ya recogida: pasar a túnica propia devuelve la del ropero. */
  origenTunica?: 'ROPERO' | 'PROPIA' | 'NINGUNA';
  crearPrendas?: TipoRopa[];
  /** Dárselo cuando se le debía, o corregir lo que se marcó. */
  cingulo?: CinguloEnMesa;
}

/** Un día AAAA-MM-DD como fecha del censo (mediodía UTC: no cambia de día en ningún huso). */
const diaDelCenso = (dia: string) => new Date(`${dia}T12:00:00.000Z`);

export class MesaService {
  /**
   * Buscar a una persona por nombre, apellidos, DNI, teléfono, correo o número
   * de hermano. Salen también las de baja y las pendientes de aprobar: la mesa
   * las reactiva o aprueba ahí mismo. Con la fecha de nacimiento, que es lo
   * que distingue a dos «Alejandro García».
   *
   * Quien no lleva el censo solo encuentra a los que están en activo (y a
   * quien le queda ropa por devolver), y por DNI, teléfono o correo solo con
   * el dato entero: un trozo servía para sacar los datos de cualquiera.
   */
  static async buscarPersonas(q: string, salida: SalidaConActo, opciones: { zona?: ZonaDeBusqueda; acceso?: AccesoMesa } = {}) {
    const texto = q.trim();
    if (texto.length < 2) return [];
    const { zona = 'todas', acceso = SIN_CENSO } = opciones;
    const numero = /^\d{1,9}$/.test(texto) ? Number(texto) : null;
    const busqueda: Prisma.HermanoWhereInput = acceso.censo
      ? condicionBusqueda(texto, ['nombre', 'apellidos', 'dni', 'telefono', 'email'])
      : {
        OR: [
          condicionBusqueda(texto, ['nombre', 'apellidos']),
          { dni: texto.toUpperCase() },
          { telefono: { in: [texto, texto.replace(/\s+/g, '')] } },
          { email: texto.toLowerCase() },
        ],
      };
    const year = anioDeLaMesa(salida);
    const salidaId = salida.id;
    // Los ya apuntados (con solicitud o papeleta) no salen en Inscripción:
    // para eso está el listado. En Túnicas solo salen los que tienen la
    // solicitud pendiente de recoger.
    const porZona: Prisma.HermanoWhereInput =
      zona === 'inscripcion' ? { papeletas: { none: { year, salidaId } }, solicitudes: { none: { year, salidaId, estado: EstadoSolicitud.PENDIENTE } } }
        : zona === 'tunicas' ? { solicitudes: { some: { year, salidaId, estado: EstadoSolicitud.PENDIENTE } } }
          : zona === 'devolucion' ? { OR: [{ prendas: { some: { estado: EstadoPrenda.PRESTADA } } }, { papeletas: { some: { cingulo: Cingulo.PRESTADO } } }] }
            : {};

    const personas = await db.hermano.findMany({
      where: {
        AND: [
          numero !== null ? { OR: [busqueda, { numeroHermano: numero }] } : busqueda,
          porZona,
          ...(acceso.censo ? [] : [{ OR: [EN_ACTIVO, CON_ROPA_SIN_DEVOLVER] }]),
        ],
      },
      take: RESULTADOS,
      orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true, nombre: true, apellidos: true, fechaNacimiento: true, numeroHermano: true,
        activo: true, fechaBaja: true,
        papeletas: { where: { year, salidaId }, select: { puesto: true } },
        solicitudes: { where: { year, salidaId, estado: EstadoSolicitud.PENDIENTE }, select: { puesto: true } },
      },
    });
    return personas.map(({ activo, fechaBaja, papeletas, solicitudes, ...p }) => ({
      ...p,
      situacion: situacionDe({ activo, fechaBaja }),
      apuntado: papeletas[0] ? { puesto: papeletas[0].puesto, recogida: true }
        : solicitudes[0] ? { puesto: solicitudes[0].puesto, recogida: false } : null,
    }));
  }

  /** Quienes pidieron día para hoy y aún no han recogido la papeleta. */
  static async esperadosHoy(salida: SalidaConActo, ahora = new Date()) {
    // Hoy en Madrid: el servidor corre en UTC y de 00:00 a 02:00 era ayer.
    const { desde, hasta } = diaMadridComoIntervalo(ahora);
    const citas = await db.cita.findMany({
      where: { estado: EstadoCita.RESERVADA, papeleta: null, turno: { salidaId: salida.id, fecha: { gte: desde, lt: hasta } } },
      orderBy: { hermano: { apellidos: 'asc' } },
      select: { id: true, hermano: { select: { id: true, nombre: true, apellidos: true, fechaNacimiento: true } } },
    });
    return citas.map((c) => ({ citaId: c.id, ...c.hermano }));
  }

  /**
   * Todo lo que la mesa necesita de una persona: sus datos (para
   * corregirlos), su situación en el censo, su solicitud de la salida (si se
   * ha apuntado y no ha recogido) o su papeleta (si ya recogió), lo que debe
   * (y lo que debe su familia, que suele pagar junta), la ropa que tiene
   * prestada, lo que llevó la última vez y la ropa que se le propone.
   *
   * Quien no lleva el censo solo abre fichas en activo (o con ropa por
   * devolver), sin el DNI y con el teléfono y el correo enmascarados.
   */
  static async ficha(hermanoId: number, salida: SalidaConActo, acceso: AccesoMesa = SIN_CENSO) {
    const year = anioDeLaMesa(salida);
    const h = await db.hermano.findFirst({
      where: { id: hermanoId, ...(acceso.censo ? {} : { OR: [EN_ACTIVO, CON_ROPA_SIN_DEVOLVER] }) },
      select: {
        id: true, nombre: true, primerApellido: true, segundoApellido: true, apellidos: true,
        fechaNacimiento: true, sexo: true, telefono: true, email: true, dni: true, numeroHermano: true,
        activo: true, fechaBaja: true, userId: true, esTitular: true,
        tieneTunicaPropia: true, alturaHombro: true, puesto: true,
        prendas: {
          where: { estado: EstadoPrenda.PRESTADA },
          orderBy: [{ tipo: 'asc' }, { numero: 'asc' }],
          select: { id: true, tipo: true, numero: true, talla: true, fechaAsignacion: true },
        },
        papeletas: {
          where: { salidaId: salida.id },
          orderBy: { year: 'desc' },
          take: 2,
          select: {
            id: true, year: true, puesto: true, tramo: true, observaciones: true,
            numTunicaAsignada: true, numCapiroteAsignado: true, numFaraonaAsignada: true, origenTunica: true, cingulo: true,
            recibo: { select: { id: true, concepto: true, importe: true, estado: true, metodoPago: true, tipo: true } },
            solicitud: { select: { puesto: true } },
          },
        },
      },
    });
    if (!h) throw new NotFoundError('No se encontró a esa persona en el censo.');

    const { papeletas, prendas, activo, fechaBaja, ...datos } = h;
    const deEsteAnio = papeletas.find((p) => p.year === year) ?? null;
    const anterior = papeletas.find((p) => p.year < year) ?? null;
    const solicitud = deEsteAnio ? null : await db.solicitud.findFirst({
      where: { hermanoId, year, salidaId: salida.id, estado: EstadoSolicitud.PENDIENTE },
      include: { recibo: true, cita: { select: { turno: { select: { fecha: true, horaInicio: true } } } } },
      orderBy: { id: 'desc' },
    });
    // Los cíngulos sin devolver, de cualquier salida y año: van con el resto de la ropa.
    const [cingulosSinDevolver, cingulos] = await Promise.all([
      db.papeletaSitio.findMany({ where: { hermanoId, cingulo: Cingulo.PRESTADO }, select: { id: true, year: true }, orderBy: { year: 'desc' } }),
      recuentoDeCingulos(),
    ]);

    // La familia (las fichas de la misma cuenta) suele pagar junta.
    const familia = await db.hermano.findMany({
      where: { userId: h.userId, id: { not: h.id }, fechaBaja: null },
      orderBy: [{ esTitular: 'desc' }, { fechaNacimiento: 'asc' }],
      select: { id: true, nombre: true, apellidos: true },
    });
    const cuotas = await cuotasQueCuentan(db, [h.id, ...familia.map((f) => f.id)]);
    const pendienteSalida = solicitud ? pendienteDe(solicitud, salida) : 0;
    const requisitos = requisitosParaRecoger({
      activo,
      solicitud: solicitud && { cobro: salida.cobro, salidaPendiente: pendienteSalida },
      cuotas: cuotas.get(h.id) ?? [],
    });
    const propuesta = propuestaDeRopa({
      anterior: anterior && { ...anterior, origenTunica: anterior.origenTunica as Origen | null },
      prestadas: prendas,
      tieneTunicaPropia: h.tieneTunicaPropia,
      puestoDeLaFicha: h.puesto,
      // En las salidas sin ropa se va de traje: no hay túnica que buscar.
      ...(salida.conRopa && { ropero: { libres: await tunicasLibres(db, year, salida.id), alturaHombro: h.alturaHombro } }),
    });

    return {
      ...datos,
      ...(!acceso.censo && {
        dni: null,
        telefono: datos.telefono && enmascararTelefono(datos.telefono),
        email: datos.email && enmascararEmail(datos.email),
      }),
      /** Si el DNI y el contacto van enteros: sin ellos, la pantalla no deja corregirlos. */
      contactoCompleto: acceso.censo,
      situacion: situacionDe({ activo, fechaBaja }),
      salida: salida.slug,
      year,
      /** Lo que tiene del ropero sin devolver: las prendas numeradas y los cíngulos. */
      prendas,
      cingulosSinDevolver: cingulosSinDevolver.map((c) => ({ papeletaId: c.id, year: c.year })),
      /** Cuántos cíngulos quedan: sin ninguno, la mesa propone «se le debe». */
      cingulos,
      solicitud: solicitud && {
        id: solicitud.id,
        puesto: solicitud.puesto,
        observaciones: solicitud.observaciones,
        origen: solicitud.origen,
        donativo: solicitud.donativo === null ? null : Number(solicitud.donativo),
        /** Lo que falta pagar de la salida (la cuota de salida o el donativo). */
        pendiente: pendienteSalida,
        /** Cómo se llamará el recibo de la salida al cobrarlo. */
        concepto: solicitud.recibo?.concepto ?? conceptoDeSalida(salida, year, []),
        cita: solicitud.cita && { fecha: solicitud.cita.turno.fecha, horaInicio: solicitud.cita.turno.horaInicio },
      },
      papeleta: deEsteAnio && {
        ...deEsteAnio,
        puestoPedido: deEsteAnio.solicitud?.puesto ?? null,
        solicitud: undefined,
        recibo: { ...deEsteAnio.recibo, importe: Number(deEsteAnio.recibo.importe) },
      },
      requisitos,
      familia: familia
        .map((f) => ({ ...f, cuotasPendientes: (cuotas.get(f.id) ?? []).filter((c) => c.estado !== 'REMESADO') }))
        .filter((f) => f.cuotasPendientes.length > 0),
      anterior: anterior && {
        year: anterior.year, puesto: anterior.puesto, origenTunica: anterior.origenTunica, cingulo: anterior.cingulo,
        numTunicaAsignada: anterior.numTunicaAsignada, numCapiroteAsignado: anterior.numCapiroteAsignado, numFaraonaAsignada: anterior.numFaraonaAsignada,
      },
      // Lo que pidió manda sobre lo del año pasado.
      propuesta: { ...propuesta, puesto: solicitud?.puesto ?? propuesta.puesto },
      cuotaSalida: cuotaDe(salida),
    };
  }

  /**
   * Prendas del ropero de un tipo cuyo número empieza por lo escrito, con
   * quién las tiene y en qué papeleta de este año de la salida van: la mesa
   * ve al teclear si la túnica está libre. Libre en el ropero no basta: después de la
   * salida todo vuelve, y la que ya va en la papeleta de otro no se repite.
   */
  static async prendas(tipo: TipoRopa, q: string, salida: SalidaConActo) {
    const numero = normalizarNumeroPrenda(q);
    if (!numero) return [];
    const prendas = await db.prenda.findMany({
      where: { tipo: tipo as TipoPrenda, numero: { startsWith: numero } },
      orderBy: { numero: 'asc' },
      take: 15,
      select: { id: true, numero: true, talla: true, estado: true, hermano: { select: { id: true, nombre: true, apellidos: true } } },
    });
    const campo = CAMPO_DE_ROPA[tipo];
    const papeletas = await db.papeletaSitio.findMany({
      where: { year: anioDeLaMesa(salida), salidaId: salida.id, [campo]: { in: prendas.map((p) => p.numero) } },
      select: { [campo]: true, hermano: { select: { id: true, nombre: true, apellidos: true } } },
    }) as unknown as ({ hermano: { id: number; nombre: string; apellidos: string } } & Record<string, string>)[];
    const enPapeleta = new Map(papeletas.map((p) => [p[campo], p.hermano]));
    // La exacta primero: «150» antes que «1500».
    return prendas
      .map((p) => ({ ...p, enPapeleta: enPapeleta.get(p.numero) ?? null }))
      .sort((a, b) => Number(b.numero === numero) - Number(a.numero === numero));
  }

  /**
   * Dar de alta en el momento a quien viene a salir y no está en el censo.
   *
   * Un adulto abre su propia cuenta (correo, DNI y teléfono) y su ficha; un
   * menor cuelga de la cuenta de su tutor, que puede estar ya en el censo o
   * abrirse ahí mismo (solo la cuenta, sin ficha). La ficha nace activa y con
   * número: la da de alta la Junta en persona, no hay solicitud que aprobar.
   * La cuenta nace con una contraseña que nadie conoce; para entrar al área
   * de hermanos, «He olvidado mi contraseña».
   */
  static async darDeAlta(dto: AltaEnMesaDto, meta?: MetaDeAuditoria) {
    const fechaNacimiento = diaDelCenso(dto.fechaNacimiento);
    const nombreCompleto = `${dto.nombre} ${dto.primerApellido}`.trim();
    const apellidos = componerApellidos(dto.primerApellido, dto.segundoApellido ?? null);
    const dni = dto.dni?.trim().toUpperCase() || null;
    const email = dto.email?.trim().toLowerCase() || null;

    if (dto.tutor) comprobarEsMenor(fechaNacimiento, nombreCompleto);
    else {
      comprobarEsAdulto(fechaNacimiento);
      if (!dni || !email || !dto.telefono?.trim()) {
        throw new HttpError('Para dar de alta a un adulto hacen falta su DNI, su correo y su teléfono: con ellos se le abre la cuenta.');
      }
    }

    if (dni && await db.hermano.findFirst({ where: { dni }, select: { id: true } })) {
      throw new HttpError(`Ya hay una ficha con el DNI ${dni}: búscala por el DNI y apúntala desde ahí.`, 409);
    }

    // La cuenta: la de la propia persona, la del tutor que ya está, o una nueva para el tutor.
    type Cuenta = { id?: number; nueva?: { email: string; dni: string; telefono: string; nombre: string; apellidos: string } };
    let cuenta: Cuenta;
    let contacto: { telefono: string | null; email: string | null };
    if (!dto.tutor) {
      cuenta = { nueva: { email: email!, dni: dni!, telefono: dto.telefono!.trim(), nombre: dto.nombre.trim(), apellidos: apellidos.apellidos } };
      contacto = { telefono: dto.telefono!.trim(), email };
    } else if ('hermanoId' in dto.tutor) {
      const tutor = await db.hermano.findUnique({
        where: { id: dto.tutor.hermanoId },
        select: { userId: true, telefono: true, email: true, user: { select: { email: true, telefono: true } } },
      });
      if (!tutor) throw new NotFoundError('No se encontró al tutor en el censo.');
      cuenta = { id: tutor.userId };
      contacto = { telefono: dto.telefono?.trim() || tutor.telefono || tutor.user.telefono, email: email || tutor.email || tutor.user.email };
    } else {
      const t = dto.tutor.nuevo;
      const apellidosTutor = componerApellidos(t.primerApellido, t.segundoApellido ?? null).apellidos;
      cuenta = { nueva: { email: t.email.trim().toLowerCase(), dni: t.dni.trim().toUpperCase(), telefono: t.telefono.trim(), nombre: t.nombre.trim(), apellidos: apellidosTutor } };
      contacto = { telefono: dto.telefono?.trim() || t.telefono.trim(), email: email || t.email.trim().toLowerCase() };
    }

    if (cuenta.nueva) {
      const ocupada = await db.user.findFirst({ where: { OR: [{ email: cuenta.nueva.email }, { dni: cuenta.nueva.dni }] }, select: { email: true } });
      if (ocupada) {
        throw new HttpError(
          ocupada.email === cuenta.nueva.email
            ? `El correo ${cuenta.nueva.email} ya tiene cuenta. Busca a su titular en el censo.`
            : `El DNI ${cuenta.nueva.dni} ya tiene cuenta. Busca a su titular en el censo.`,
          409,
        );
      }
    }
    const password = cuenta.nueva ? await encrypt(randomBytes(24).toString('hex')) : null;

    const hermano = await transaccionReintentable(async (tx) => {
      const userId = cuenta.id ?? (await tx.user.create({
        data: { ...cuenta.nueva!, password: password!, role: Role.USER, active: true },
        select: { id: true },
      })).id;
      return tx.hermano.create({
        data: {
          userId,
          esTitular: !dto.tutor,
          parentesco: dto.tutor ? dto.parentesco ?? null : null,
          nombre: dto.nombre.trim(),
          ...apellidos,
          dni,
          fechaNacimiento,
          sexo: dto.sexo ?? null,
          ...contacto,
          activo: true,
          fechaAlta: new Date(),
          numeroHermano: await getNextNumeroHermano(tx),
        },
        select: { id: true, numeroHermano: true, nombre: true, apellidos: true },
      });
    });

    await AuditoriaService.log(ACCIONES_AUDITORIA.MESA_ALTA, meta ?? {}, 'hermano', hermano.id, {
      despues: { numeroHermano: hermano.numeroHermano, menor: !!dto.tutor, cuentaNueva: !!cuenta.nueva },
    });
    avisarALaMesa({ que: 'alta', hermanoId: hermano.id });
    return hermano;
  }

  /**
   * «Editar antes de guardar»: los datos que la mesa comprueba con la persona
   * delante. Quien no lleva el censo corrige solo fichas en activo, y no el
   * teléfono ni el correo: no los ve enteros, y son los datos con que se
   * entra al área de hermanos y se recupera la contraseña.
   */
  static async corregirFicha(hermanoId: number, dto: CorreccionFichaDto, meta?: MetaDeAuditoria, acceso: AccesoMesa = SIN_CENSO) {
    if (!acceso.censo && (dto.telefono !== undefined || dto.email !== undefined)) {
      throw new HttpError('El teléfono y el correo los corrige Secretaría.', 403);
    }
    const actual = await db.hermano.findFirst({ where: { id: hermanoId, ...(acceso.censo ? {} : EN_ACTIVO) } });
    if (!actual) throw new NotFoundError('No se encontró a esa persona en el censo.');

    const data: Prisma.HermanoUpdateInput = {};
    if (dto.nombre?.trim()) data.nombre = dto.nombre.trim();
    const apellidos = apellidosTrasCambio(dto, actual);
    if (apellidos) Object.assign(data, apellidos);
    if (dto.fechaNacimiento) data.fechaNacimiento = diaDelCenso(dto.fechaNacimiento);
    if (dto.telefono !== undefined) data.telefono = dto.telefono?.trim() || null;
    if (dto.email !== undefined) data.email = dto.email?.trim().toLowerCase() || null;
    if (dto.alturaHombro !== undefined) {
      if (!dto.alturaHombro?.trim()) data.alturaHombro = null;
      else {
        const cm = alturaHombroEnCm(dto.alturaHombro);
        if (cm === null) throw new HttpError(`No se entiende la altura de hombro «${dto.alturaHombro}». Escríbela en metros (1,45) o en centímetros (145).`);
        data.alturaHombro = cm;
      }
    }

    // Solo lo que de verdad cambia, a la ficha y a la auditoría.
    const cambios = Object.fromEntries(
      Object.entries(data).filter(([campo, valor]) => {
        const antes = (actual as Record<string, unknown>)[campo];
        return antes instanceof Date && valor instanceof Date ? antes.getTime() !== valor.getTime() : antes !== valor;
      }),
    );
    if (Object.keys(cambios).length === 0) return { cambiados: 0 };

    await db.hermano.update({ where: { id: hermanoId }, data: cambios });
    await AuditoriaService.log(ACCIONES_AUDITORIA.HERMANO_ACTUALIZAR, meta ?? {}, 'hermano', hermanoId, {
      origen: 'mesa de la procesión',
      antes: Object.fromEntries(Object.keys(cambios).map((c) => [c, (actual as Record<string, unknown>)[c]])),
      despues: cambios,
    } as Prisma.InputJsonValue);
    return { cambiados: Object.keys(cambios).length };
  }

  /**
   * Corregir una solicitud aún sin recoger: el puesto que pide, las
   * observaciones y, en las salidas de donativo, la voluntad (si aún no la
   * ha pagado).
   */
  static async editarSolicitud(solicitudId: number, dto: EdicionSolicitudDto, meta?: MetaDeAuditoria) {
    const antes = await db.solicitud.findUnique({ where: { id: solicitudId }, include: { recibo: true, salida: true } });
    if (!antes) throw new NotFoundError('Solicitud no encontrada.');
    if (antes.estado !== EstadoSolicitud.PENDIENTE) throw new HttpError('Esta solicitud ya no está pendiente. Recarga la ficha.', 409);
    if (dto.donativo !== undefined && (antes.salida.cobro !== 'DONATIVO' || antes.recibo)) {
      throw new HttpError('El donativo solo se cambia en las salidas de donativo y antes de pagarlo.', 409);
    }
    const despues = await db.solicitud.update({
      where: { id: solicitudId },
      data: {
        ...(dto.puesto?.trim() && { puesto: dto.puesto.trim() }),
        ...(dto.observaciones !== undefined && { observaciones: dto.observaciones?.trim() || null }),
        ...(dto.donativo !== undefined && { donativo: new Prisma.Decimal(Math.round(dto.donativo * 100) / 100) }),
      },
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.PAPELETA_EDITAR, meta ?? {}, 'solicitud', solicitudId, {
      antes: { puesto: antes.puesto, observaciones: antes.observaciones, donativo: antes.donativo?.toString() ?? null },
      despues: { puesto: despues.puesto, observaciones: despues.observaciones, donativo: despues.donativo?.toString() ?? null },
    });
    avisarALaMesa({ que: 'corregido', hermanoId: antes.hermanoId, salidaId: antes.salidaId });
    return { id: despues.id };
  }

  /**
   * Corregir una papeleta ya recogida: el puesto, el tramo, las
   * observaciones y la ropa. La ropa que se cambia vuelve al ropero y la
   * nueva queda prestada; pasar a túnica propia devuelve la del ropero.
   */
  static async editarPapeleta(papeletaId: number, dto: EdicionPapeletaDto, meta?: MetaDeAuditoria) {
    const antes = await db.papeletaSitio.findUnique({ where: { id: papeletaId }, include: { salida: { select: { conRopa: true } } } });
    if (!antes) throw new NotFoundError('Papeleta no encontrada.');
    const conRopa = antes.salida.conRopa;
    const origen = conRopa ? dto.origenTunica ?? antes.origenTunica : antes.origenTunica;

    const numero = (nuevo: string | null | undefined, viejo: string | null) =>
      !conRopa || nuevo === undefined ? viejo : nuevo?.trim() ? normalizarNumeroPrenda(nuevo) : null;
    const ropa = {
      numTunicaAsignada: origen === 'ROPERO' || origen === null ? numero(dto.numTunicaAsignada, antes.numTunicaAsignada) : null,
      numCapiroteAsignado: numero(dto.numCapiroteAsignado, antes.numCapiroteAsignado),
      numFaraonaAsignada: numero(dto.numFaraonaAsignada, antes.numFaraonaAsignada),
    };

    const cingulo = conRopa && dto.cingulo !== undefined ? dto.cingulo : antes.cingulo;

    const despues = await db.$transaction(async (tx) => {
      // Dárselo ahora (se le debía) o corregirlo: si pasa a prestado, tiene que quedar alguno.
      if (cingulo === Cingulo.PRESTADO && antes.cingulo !== Cingulo.PRESTADO) {
        await prestarCinguloEnTransaccion(tx, antes.hermanoId, papeletaId);
      }
      // Solo se toca en el ropero la ropa que cambia.
      const cambia = (campo: keyof typeof ropa) => ropa[campo] !== antes[campo];
      if (conRopa) {
        // Solo la que cambia: una papeleta vieja con un número repetido se puede seguir corrigiendo en lo demás.
        await comprobarQueNoVaEnOtraPapeleta(tx, { year: antes.year, salidaId: antes.salidaId, papeletaId }, {
          numTunicaAsignada: cambia('numTunicaAsignada') ? ropa.numTunicaAsignada : null,
          numCapiroteAsignado: cambia('numCapiroteAsignado') ? ropa.numCapiroteAsignado : null,
          numFaraonaAsignada: cambia('numFaraonaAsignada') ? ropa.numFaraonaAsignada : null,
        });
        await recogerRopaEnTransaccion(tx, antes.hermanoId, {
          numTunicaAsignada: cambia('numTunicaAsignada') ? antes.numTunicaAsignada : null,
          numCapiroteAsignado: cambia('numCapiroteAsignado') ? antes.numCapiroteAsignado : null,
          numFaraonaAsignada: cambia('numFaraonaAsignada') ? antes.numFaraonaAsignada : null,
        });
        await prestarRopaEnTransaccion(tx, antes.hermanoId, ropaPedida({
          origenTunica: 'ROPERO',
          numTunicaAsignada: cambia('numTunicaAsignada') ? ropa.numTunicaAsignada : null,
          numCapiroteAsignado: cambia('numCapiroteAsignado') ? ropa.numCapiroteAsignado : null,
          numFaraonaAsignada: cambia('numFaraonaAsignada') ? ropa.numFaraonaAsignada : null,
          crearPrendas: dto.crearPrendas,
        }));
        if (origen !== antes.origenTunica && (origen === 'PROPIA' || origen === 'ROPERO')) {
          await tx.hermano.update({ where: { id: antes.hermanoId }, data: { tieneTunicaPropia: origen === 'PROPIA' } });
        }
      }
      return tx.papeletaSitio.update({
        where: { id: papeletaId },
        data: {
          ...ropa,
          origenTunica: origen,
          cingulo,
          ...(dto.puesto?.trim() && { puesto: dto.puesto.trim() }),
          ...(dto.tramo !== undefined && { tramo: dto.tramo?.trim() || null }),
          ...(dto.observaciones !== undefined && { observaciones: dto.observaciones?.trim() || null }),
        },
      });
    });

    await AuditoriaService.log(ACCIONES_AUDITORIA.PAPELETA_EDITAR, meta ?? {}, 'papeleta', papeletaId, {
      antes: { puesto: antes.puesto, tramo: antes.tramo, origenTunica: antes.origenTunica, cingulo: antes.cingulo, ...Object.fromEntries(Object.keys(ropa).map((k) => [k, antes[k as keyof typeof ropa]])) },
      despues: { puesto: despues.puesto, tramo: despues.tramo, origenTunica: despues.origenTunica, cingulo: despues.cingulo, ...ropa },
    });
    avisarALaMesa({ que: 'corregido', hermanoId: antes.hermanoId, salidaId: antes.salidaId });
    return despues;
  }

  /**
   * Poner en activo a quien viene a salir y no lo está: si está de baja, se
   * reactiva su ficha; si su alta por la web esperaba a Secretaría, se aprueba
   * la solicitud (con todas las fichas de esa cuenta, como en Secretaría).
   * Cada camino deja su propio rastro en la auditoría.
   */
  static async activar(hermanoId: number, meta?: MetaDeAuditoria) {
    const h = await db.hermano.findUnique({ where: { id: hermanoId }, select: { activo: true, fechaBaja: true, userId: true } });
    if (!h) throw new NotFoundError('No se encontró a esa persona en el censo.');
    const situacion = situacionDe(h);
    if (situacion === 'activo') return { message: 'Ya está en activo.' };
    return situacion === 'baja'
      ? CensoService.reactivarHermano(hermanoId, meta)
      : SolicitudesService.aprobarSolicitud(h.userId, meta);
  }

  /**
   * Los apuntados de una salida, como la hoja: para la tabla de la mesa. Cada
   * uno con su punto del camino: solicitado con algo por pagar, listo para
   * recoger, o recogido (y entonces con su papeleta y su ropa).
   */
  static async listado(year: number, salida: SalidaConActo, filtro: { q?: string; puesto?: string; faltaCingulo?: boolean }) {
    const salidaId = salida.id;
    const busqueda = condicionBusqueda(filtro.q, ['nombre', 'apellidos', 'telefono', 'email']);
    const deLaPersona = Object.keys(busqueda).length > 0 ? { hermano: busqueda } : {};
    const delPuesto = filtro.puesto ? { puesto: filtro.puesto } : {};
    const hermano = { select: { id: true, nombre: true, apellidos: true, fechaNacimiento: true, telefono: true, email: true, alturaHombro: true, numeroHermano: true, activo: true } } as const;

    const [papeletas, solicitudes] = await Promise.all([
      db.papeletaSitio.findMany({
        where: { year, salidaId, ...delPuesto, ...deLaPersona, ...(filtro.faltaCingulo && { cingulo: Cingulo.DEBIDO }) },
        select: {
          id: true, puesto: true, tramo: true, observaciones: true, createdAt: true,
          numTunicaAsignada: true, numCapiroteAsignado: true, numFaraonaAsignada: true, origenTunica: true, cingulo: true,
          recibo: { select: { importe: true, estado: true, metodoPago: true } },
          solicitud: { select: { puesto: true } },
          hermano,
        },
      }),
      // A quien le falta el cíngulo ya recogió: las solicitudes sin recoger no cuentan.
      filtro.faltaCingulo ? Promise.resolve([]) : db.solicitud.findMany({
        where: { year, salidaId, estado: EstadoSolicitud.PENDIENTE, ...delPuesto, ...deLaPersona },
        include: { recibo: true, hermano },
      }),
    ]);
    const cuotas = await cuotasQueCuentan(db, solicitudes.map((s) => s.hermano.id));

    const sinActivo = <T extends { activo: boolean }>({ activo: _activo, ...resto }: T) => resto;
    const filas = [
      ...papeletas.map((p) => ({
        tipo: 'papeleta' as const,
        id: p.id,
        puesto: p.puesto,
        puestoPedido: p.solicitud?.puesto ?? null,
        tramo: p.tramo,
        observaciones: p.observaciones,
        createdAt: p.createdAt,
        numTunicaAsignada: p.numTunicaAsignada,
        numCapiroteAsignado: p.numCapiroteAsignado,
        numFaraonaAsignada: p.numFaraonaAsignada,
        origenTunica: p.origenTunica,
        cingulo: p.cingulo,
        pagado: { importe: Number(p.recibo.importe), estado: p.recibo.estado, metodoPago: p.recibo.metodoPago },
        estado: 'recogida' as const,
        pendiente: 0,
        hermano: sinActivo(p.hermano),
      })),
      ...solicitudes.map((s) => {
        const requisitos = requisitosParaRecoger({
          activo: s.hermano.activo,
          solicitud: { cobro: salida.cobro, salidaPendiente: pendienteDe(s, salida) },
          cuotas: cuotas.get(s.hermano.id) ?? [],
        });
        return {
          tipo: 'solicitud' as const,
          id: s.id,
          puesto: s.puesto,
          puestoPedido: s.puesto,
          tramo: null,
          observaciones: s.observaciones,
          createdAt: s.createdAt,
          numTunicaAsignada: null,
          numCapiroteAsignado: null,
          numFaraonaAsignada: null,
          origenTunica: null,
          cingulo: null,
          pagado: s.recibo && { importe: Number(s.recibo.importe), estado: s.recibo.estado, metodoPago: s.recibo.metodoPago },
          estado: requisitos.puedeRecoger ? 'lista' as const : 'por-pagar' as const,
          pendiente: requisitos.totalPendiente,
          hermano: sinActivo(s.hermano),
        };
      }),
    ].sort((a, b) => a.hermano.nombre.localeCompare(b.hermano.nombre, 'es') || a.hermano.apellidos.localeCompare(b.hermano.apellidos, 'es'));

    // Los puestos, de lo recogido y de lo pedido: para filtrar y como sugerencias.
    const cuenta = new Map<string, number>();
    for (const f of await Promise.all([
      db.papeletaSitio.groupBy({ by: ['puesto'], where: { year, salidaId }, _count: { _all: true } }),
      db.solicitud.groupBy({ by: ['puesto'], where: { year, salidaId, estado: EstadoSolicitud.PENDIENTE }, _count: { _all: true } }),
    ]).then((g) => g.flat())) {
      cuenta.set(f.puesto, (cuenta.get(f.puesto) ?? 0) + f._count._all);
    }
    const faltanCingulos = await db.papeletaSitio.count({ where: { year, salidaId, cingulo: Cingulo.DEBIDO } });
    return {
      year,
      salida: salida.slug,
      apuntados: filas,
      /** Cuántos recogieron sin cíngulo porque no quedaban. */
      faltanCingulos,
      puestos: [...cuenta].map(([puesto, total]) => ({ puesto, total })).sort((a, b) => a.puesto.localeCompare(b.puesto, 'es')),
    };
  }
}
