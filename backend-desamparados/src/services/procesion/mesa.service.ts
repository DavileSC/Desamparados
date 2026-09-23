/**
 * La mesa de la procesión: quien atiende a la gente que sale busca a la
 * persona (o la da de alta si no está en el censo), corrige sus datos, ve la
 * ropa que se le propone y la apunta cobrando (eso último lo hace
 * `PapeletasService.inscribirYFacturar`).
 *
 * Es lo que antes se llevaba en una hoja de cálculo: nombre, fecha de
 * nacimiento, teléfono, puesto, altura de hombro, túnica y capirote o faraona.
 */
import { randomBytes } from 'node:crypto';
import { EstadoCita, EstadoPrenda, Parentesco, Prisma, Role, Sexo, TipoPrenda } from '@prisma/client';
import db from '../../config/db.js';
import { encrypt } from '../../utils/bcrypt.handle.js';
import { HttpError, NotFoundError } from '../../utils/error.handle.js';
import { condicionBusqueda } from '../../domain/busqueda-texto.js';
import { apellidosTrasCambio, componerApellidos } from '../../domain/apellidos.js';
import { comprobarEsAdulto, comprobarEsMenor } from '../../domain/fechas-hermano.js';
import { alturaHombroEnCm, normalizarNumeroPrenda, propuestaDeRopa, type Origen } from '../../domain/mesa-procesion.js';
import { getNextNumeroHermano, transaccionReintentable } from '../hermanos/comunes.js';
import { CensoService } from '../censo.service.js';
import { SolicitudesService } from '../solicitudes.service.js';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from '../auditoria.service.js';
import { PapeletasService } from './papeletas.service.js';
import { prestarRopaEnTransaccion, recogerRopaEnTransaccion, ropaPedida, type TipoRopa } from './ropa.js';

const anioDeLaProcesion = () => new Date().getFullYear();

/** Cuántas personas devuelve el buscador: la mesa afina escribiendo más. */
const RESULTADOS = 12;

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

export interface EdicionPapeletaDto {
  puesto?: string;
  tramo?: string | null;
  observaciones?: string | null;
  numTunicaAsignada?: string | null;
  numCapiroteAsignado?: string | null;
  numFaraonaAsignada?: string | null;
  crearPrendas?: TipoRopa[];
}

/** Un día AAAA-MM-DD como fecha del censo (mediodía UTC: no cambia de día en ningún huso). */
const diaDelCenso = (dia: string) => new Date(`${dia}T12:00:00.000Z`);

export class MesaService {
  /**
   * Buscar a una persona por nombre, apellidos, DNI, teléfono, correo o número
   * de hermano. Salen también las de baja y las pendientes de aprobar: la mesa
   * las reactiva o aprueba ahí mismo. Con la fecha de nacimiento, que es lo
   * que distingue a dos «Alejandro García».
   */
  static async buscarPersonas(q: string) {
    const texto = q.trim();
    if (texto.length < 2) return [];
    const numero = /^\d{1,9}$/.test(texto) ? Number(texto) : null;
    const busqueda = condicionBusqueda(texto, ['nombre', 'apellidos', 'dni', 'telefono', 'email']);
    const year = anioDeLaProcesion();

    const personas = await db.hermano.findMany({
      where: numero !== null ? { OR: [busqueda, { numeroHermano: numero }] } : busqueda,
      take: RESULTADOS,
      orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true, nombre: true, apellidos: true, fechaNacimiento: true, numeroHermano: true,
        activo: true, fechaBaja: true,
        papeletas: { where: { year }, select: { id: true, puesto: true } },
      },
    });
    return personas.map(({ activo, fechaBaja, papeletas, ...p }) => ({
      ...p,
      situacion: situacionDe({ activo, fechaBaja }),
      papeleta: papeletas[0] ?? null,
    }));
  }

  /** Quienes pidieron día para hoy y aún no tienen papeleta: la mesa los atiende primero. */
  static async esperadosHoy() {
    const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
    const fin = new Date(); fin.setHours(23, 59, 59, 999);
    const citas = await db.cita.findMany({
      where: { estado: EstadoCita.RESERVADA, papeleta: null, turno: { fecha: { gte: inicio, lte: fin } } },
      orderBy: { hermano: { apellidos: 'asc' } },
      select: { id: true, hermano: { select: { id: true, nombre: true, apellidos: true, fechaNacimiento: true } } },
    });
    return citas.map((c) => ({ citaId: c.id, ...c.hermano }));
  }

  /**
   * Todo lo que la mesa necesita de una persona para apuntarla: sus datos
   * (para corregirlos), su situación en el censo, la papeleta de este año si
   * ya la tiene, la ropa que tiene prestada, lo que llevó la última vez, la
   * propuesta de ropa y los precios.
   */
  static async ficha(hermanoId: number) {
    const year = anioDeLaProcesion();
    const h = await db.hermano.findUnique({
      where: { id: hermanoId },
      select: {
        id: true, nombre: true, primerApellido: true, segundoApellido: true, apellidos: true,
        fechaNacimiento: true, sexo: true, telefono: true, email: true, dni: true, numeroHermano: true,
        activo: true, fechaBaja: true, userId: true, esTitular: true,
        tieneTunicaPropia: true, alturaHombro: true, puesto: true,
        prendas: { where: { estado: EstadoPrenda.PRESTADA }, select: { tipo: true, numero: true, talla: true } },
        papeletas: {
          orderBy: { year: 'desc' },
          take: 2,
          select: {
            id: true, year: true, puesto: true, tramo: true, observaciones: true,
            numTunicaAsignada: true, numCapiroteAsignado: true, numFaraonaAsignada: true, origenTunica: true,
            recibo: { select: { importe: true, estado: true, metodoPago: true } },
          },
        },
        citas: {
          where: { estado: EstadoCita.RESERVADA, papeleta: null },
          orderBy: { id: 'desc' },
          take: 1,
          select: { id: true, turno: { select: { fecha: true, horaInicio: true } } },
        },
      },
    });
    if (!h) throw new NotFoundError('No se encontró a esa persona en el censo.');

    const { papeletas, citas, prendas, activo, fechaBaja, ...datos } = h;
    const deEsteAnio = papeletas.find((p) => p.year === year) ?? null;
    const anterior = papeletas.find((p) => p.year < year) ?? null;

    return {
      ...datos,
      situacion: situacionDe({ activo, fechaBaja }),
      year,
      prendas,
      papeleta: deEsteAnio && { ...deEsteAnio, recibo: { ...deEsteAnio.recibo, importe: Number(deEsteAnio.recibo.importe) } },
      anterior: anterior && {
        year: anterior.year, puesto: anterior.puesto, origenTunica: anterior.origenTunica,
        numTunicaAsignada: anterior.numTunicaAsignada, numCapiroteAsignado: anterior.numCapiroteAsignado, numFaraonaAsignada: anterior.numFaraonaAsignada,
      },
      cita: citas[0] ? { id: citas[0].id, fecha: citas[0].turno.fecha, horaInicio: citas[0].turno.horaInicio } : null,
      propuesta: propuestaDeRopa({
        anterior: anterior && { ...anterior, origenTunica: anterior.origenTunica as Origen | null },
        prestadas: prendas,
        tieneTunicaPropia: h.tieneTunicaPropia,
        puestoDeLaFicha: h.puesto,
      }),
      precios: await PapeletasService.precios(),
    };
  }

  /**
   * Prendas del ropero de un tipo cuyo número empieza por lo escrito, con
   * quién las tiene: la mesa ve al teclear si la túnica está libre.
   */
  static async prendas(tipo: TipoRopa, q: string) {
    const numero = normalizarNumeroPrenda(q);
    if (!numero) return [];
    const prendas = await db.prenda.findMany({
      where: { tipo: tipo as TipoPrenda, numero: { startsWith: numero } },
      orderBy: { numero: 'asc' },
      take: 15,
      select: { id: true, numero: true, talla: true, estado: true, hermano: { select: { id: true, nombre: true, apellidos: true } } },
    });
    // La exacta primero: «150» antes que «1500».
    return prendas.sort((a, b) => Number(b.numero === numero) - Number(a.numero === numero));
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
    return hermano;
  }

  /** «Editar antes de guardar»: los datos que la mesa comprueba con la persona delante. */
  static async corregirFicha(hermanoId: number, dto: CorreccionFichaDto, meta?: MetaDeAuditoria) {
    const actual = await db.hermano.findUnique({ where: { id: hermanoId } });
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
   * Corregir una papeleta ya emitida: el puesto, el tramo, las observaciones
   * o la ropa. La ropa que se cambia vuelve al ropero y la nueva queda
   * prestada. No cambia lo cobrado: pasar de túnica propia a la del ropero (o
   * al revés) cambia el importe, y eso es anular y volver a apuntar.
   */
  static async editarPapeleta(papeletaId: number, dto: EdicionPapeletaDto, meta?: MetaDeAuditoria) {
    const antes = await db.papeletaSitio.findUnique({ where: { id: papeletaId } });
    if (!antes) throw new NotFoundError('Papeleta no encontrada.');
    if (dto.numTunicaAsignada?.trim() && antes.origenTunica && antes.origenTunica !== 'ROPERO') {
      throw new HttpError('Esta papeleta salió sin túnica del ropero y no pagó alquiler. Para darle una, anúlala y vuelve a apuntarla.', 409);
    }

    const numero = (nuevo: string | null | undefined, viejo: string | null) =>
      nuevo === undefined ? viejo : nuevo?.trim() ? normalizarNumeroPrenda(nuevo) : null;
    const ropa = {
      numTunicaAsignada: numero(dto.numTunicaAsignada, antes.numTunicaAsignada),
      numCapiroteAsignado: numero(dto.numCapiroteAsignado, antes.numCapiroteAsignado),
      numFaraonaAsignada: numero(dto.numFaraonaAsignada, antes.numFaraonaAsignada),
    };

    const despues = await db.$transaction(async (tx) => {
      // Solo se toca en el ropero la ropa que cambia.
      const cambia = (campo: keyof typeof ropa) => ropa[campo] !== antes[campo];
      await recogerRopaEnTransaccion(tx, antes.hermanoId, {
        numTunicaAsignada: cambia('numTunicaAsignada') ? antes.numTunicaAsignada : null,
        numCapiroteAsignado: cambia('numCapiroteAsignado') ? antes.numCapiroteAsignado : null,
        numFaraonaAsignada: cambia('numFaraonaAsignada') ? antes.numFaraonaAsignada : null,
      });
      if (antes.origenTunica) {
        await prestarRopaEnTransaccion(tx, antes.hermanoId, ropaPedida({
          origenTunica: 'ROPERO',
          numTunicaAsignada: cambia('numTunicaAsignada') ? ropa.numTunicaAsignada : null,
          numCapiroteAsignado: cambia('numCapiroteAsignado') ? ropa.numCapiroteAsignado : null,
          numFaraonaAsignada: cambia('numFaraonaAsignada') ? ropa.numFaraonaAsignada : null,
          crearPrendas: dto.crearPrendas,
        }));
      }
      return tx.papeletaSitio.update({
        where: { id: papeletaId },
        data: {
          ...ropa,
          ...(dto.puesto?.trim() && { puesto: dto.puesto.trim() }),
          ...(dto.tramo !== undefined && { tramo: dto.tramo?.trim() || null }),
          ...(dto.observaciones !== undefined && { observaciones: dto.observaciones?.trim() || null }),
        },
      });
    });

    await AuditoriaService.log(ACCIONES_AUDITORIA.PAPELETA_EDITAR, meta ?? {}, 'papeleta', papeletaId, {
      antes: { puesto: antes.puesto, tramo: antes.tramo, ...Object.fromEntries(Object.keys(ropa).map((k) => [k, antes[k as keyof typeof ropa]])) },
      despues: { puesto: despues.puesto, tramo: despues.tramo, ...ropa },
    });
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

  /** Los apuntados del año, como la hoja: para la tabla de la mesa. */
  static async listado(year: number, filtro: { q?: string; puesto?: string }) {
    const busqueda = condicionBusqueda(filtro.q, ['nombre', 'apellidos', 'telefono', 'email']);
    const papeletas = await db.papeletaSitio.findMany({
      where: {
        year,
        ...(filtro.puesto && { puesto: filtro.puesto }),
        ...(Object.keys(busqueda).length > 0 && { hermano: busqueda }),
      },
      orderBy: [{ hermano: { nombre: 'asc' } }, { hermano: { apellidos: 'asc' } }],
      select: {
        id: true, puesto: true, tramo: true, observaciones: true, createdAt: true,
        numTunicaAsignada: true, numCapiroteAsignado: true, numFaraonaAsignada: true, origenTunica: true,
        recibo: { select: { importe: true, estado: true, metodoPago: true } },
        hermano: { select: { id: true, nombre: true, apellidos: true, fechaNacimiento: true, telefono: true, email: true, alturaHombro: true, numeroHermano: true } },
      },
    });
    const puestos = await db.papeletaSitio.groupBy({ by: ['puesto'], where: { year }, _count: { _all: true }, orderBy: { puesto: 'asc' } });
    return {
      year,
      papeletas: papeletas.map((p) => ({ ...p, recibo: { ...p.recibo, importe: Number(p.recibo.importe) } })),
      puestos: puestos.map((p) => ({ puesto: p.puesto, total: p._count._all })),
    };
  }
}

