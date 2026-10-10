/**
 * La mesa por zonas, como se trabaja el día del reparto: cada ordenador es una
 * zona y la persona pasa de una a otra.
 *
 * - Inscripción: a quien llega sin haberla pedido se le busca (o se le da de
 *   alta), se confirman sus datos y se apunta su solicitud con el puesto que
 *   pide.
 * - Tesorería: cobra lo que tenga pendiente (las cuotas de hermano, la cuota
 *   de la salida si la tiene, el donativo) o, si el Hermano
 *   Mayor lo decide, perdona la cuota.
 * - Túnicas: con todo pagado (o perdonado), se le da la ropa del ropero
 *   (túnica, capirote o faraona y cíngulo), se le confirma el puesto y
 *   entonces nace su papeleta. En las salidas sin ropa (de traje), solo el
 *   puesto.
 * - Devolución: después de la salida, todo lo prestado vuelve al ropero. Las
 *   túnicas, al lavado; lo roto, al taller.
 *
 * Quien pidió salir desde su área y lo tiene todo pagado va directo a
 * Túnicas. Cada zona se entera al momento de lo que hacen las otras (ver
 * `avisos-mesa.ts`) y cada operación lleva su clave para no hacerse dos veces
 * si la WiFi se corta a medias (ver `una-vez.ts`).
 */
import {
  Cingulo, EstadoCita, EstadoPago, EstadoPrenda, EstadoSolicitud, MetodoPago, OrigenSolicitud, Prisma, TipoRecibo, TipoTransaccion, type CobroSalida,
} from '@prisma/client';
import db from '../../config/db.js';
import { HttpError, NotFoundError } from '../../utils/error.handle.js';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from '../auditoria.service.js';
import { EmailService } from '../email.service.js';
import { exigirSinReemision, idCategoriaIngresos, leerDatosEvento } from '../recibos/comunes.js';
import { idsReemitidos } from '../../domain/reemisiones.js';
import { estadosCobrablesCon, MENSAJE_REMESADO_EN_MANO } from '../../domain/recibo-estados.js';
import { claveConcepto } from '../../domain/datos-procesion.js';
import { diaMadrid, inicioDiaMadrid } from '../../domain/contabilidad.js';
import { alturaHombroEnCm, CINGULO_SEGUN_TUNICA, normalizarNumeroPrenda, propuestaDeRopa, type Origen } from '../../domain/mesa-procesion.js';
import {
  notaDePerdon, pendienteDeLaSalida, requisitosParaRecoger, tipoReciboDe, type CuotaDelHermano,
} from '../../domain/salidas.js';
import { articuloDe } from '../../domain/articulos.js';
import type { SalidaConActo } from './salidas.service.js';
import { PapeletasService, type SolicitudConRecibo } from './papeletas.service.js';
import { PlazoPapeletasService } from './plazo.service.js';
import { archivoDePapeleta, datosDeLaPapeleta, papeletaEnPdf } from './papeleta-pdf.js';
import { comprobarQueNoVaEnOtraPapeleta, estadoAlDevolver, prestarRopaEnTransaccion, ropaPedida, tunicasLibres, type TipoRopa } from './ropa.js';
import { cingulosSinDevolverDe, devolverCingulosEnTransaccion, prestarCinguloEnTransaccion, recuentoDeCingulos, type CinguloEnMesa } from './cingulos.js';
import { unaVez } from './una-vez.js';
import { avisarALaMesa } from './avisos-mesa.js';
import { euros } from '../../utils/euros.js';

type Tx = Prisma.TransactionClient;
type Cliente = Tx | typeof db;

/**
 * El año de la salida que atiende la mesa: el mismo que ve el hermano al
 * pedirla (`anioDeLaProcesion`). No es el año natural: pasada la salida, la
 * que se pide es la del año siguiente, y con el año natural la mesa no
 * encontraba esas solicitudes.
 */
export const anioDeLaMesa = (salida: SalidaConActo): number => PlazoPapeletasService.anioDeLaProcesion(salida);

export interface InscripcionEnMesa {
  hermanoId: number;
  salida: SalidaConActo;
  puesto: string;
  observaciones?: string;
  /** El donativo, en las salidas de donativo, en euros (0 es válido). */
  donativo?: number;
  /** «1,45» o «145»: se guarda en la ficha. */
  alturaHombro?: string;
}

export interface CobroEnMesa {
  hermanoId: number;
  /** Cuotas (u otros recibos) por cobrar. */
  reciboIds: number[];
  /**
   * Lo de la salida de una solicitud: la cuota de salida o el donativo. Con
   * donativo, `importe` es lo que da al final si cambia lo que dijo.
   */
  solicitudes?: { solicitudId: number; importe?: number }[];
  metodoPago: Exclude<MetodoPago, 'DOMICILIACION'>;
}

export interface EntregaEnMesa {
  solicitudId: number;
  puesto?: string;
  origenTunica?: Origen;
  numTunicaAsignada?: string;
  numCapiroteAsignado?: string;
  numFaraonaAsignada?: string;
  crearPrendas?: TipoRopa[];
  /** Sin decir nada, el que va con la túnica (ver CINGULO_SEGUN_TUNICA). */
  cingulo?: CinguloEnMesa;
  alturaHombro?: string;
  observaciones?: string;
}

export interface DevolucionEnMesa {
  hermanoId: number;
  /** Las prendas numeradas que devuelve; `rota`, si hay que arreglarla. */
  prendas: { id: number; rota?: boolean }[];
  /** Las papeletas cuyo cíngulo prestado devuelve. */
  cingulos: number[];
}

const centimos = (n: number) => Math.round(n * 100);

/** La altura de hombro dictada, en centímetros; `undefined` si no se dictó. Si no se entiende, para. */
function alturaDictada(texto: string | undefined): number | undefined {
  if (texto === undefined || texto.trim() === '') return undefined;
  const cm = alturaHombroEnCm(texto);
  if (cm === null) throw new HttpError(`No se entiende la altura de hombro «${texto}». Escríbela en metros (1,45) o en centímetros (145).`);
  return cm;
}

/**
 * Las cuotas de hermano que cuentan para recoger, por hermano: las que no
 * están pagadas ni perdonadas ni anuladas. Una devuelta que ya se reemitió
 * no cuenta: la cubre su reemisión.
 */
export async function cuotasQueCuentan(cliente: Cliente, hermanoIds: number[]): Promise<Map<number, CuotaDelHermano[]>> {
  const porHermano = new Map<number, CuotaDelHermano[]>();
  if (hermanoIds.length === 0) return porHermano;
  const recibos = await cliente.recibo.findMany({
    where: { hermanoId: { in: [...new Set(hermanoIds)] }, tipo: TipoRecibo.CUOTA_HERMANO },
    select: { id: true, hermanoId: true, year: true, tipo: true, concepto: true, importe: true, estado: true },
  });
  const reemitidos = idsReemitidos(recibos.filter((r) => r.estado === EstadoPago.DEVUELTO), recibos);
  const vivos: EstadoPago[] = [EstadoPago.PENDIENTE, EstadoPago.DEVUELTO, EstadoPago.REMESADO];
  for (const r of recibos) {
    if (!vivos.includes(r.estado) || reemitidos.has(r.id)) continue;
    const lista = porHermano.get(r.hermanoId) ?? [];
    lista.push({ id: r.id, year: r.year, concepto: r.concepto, importe: Number(r.importe), estado: r.estado });
    porHermano.set(r.hermanoId, lista);
  }
  return porHermano;
}

/**
 * El cíngulo cuando la mesa no dice nada: el que va con la túnica. Si toca
 * prestarlo y no queda ninguno (contando el que trae sin devolver, que se
 * cambia por el nuevo), se le debe: la ropa no se queda sin dar por eso.
 */
async function cinguloPorDefecto(tx: Tx, hermanoId: number, origen: Origen): Promise<Cingulo> {
  const propuesto = CINGULO_SEGUN_TUNICA[origen];
  if (propuesto !== Cingulo.PRESTADO) return propuesto;
  const [{ enElRopero }, trae] = await Promise.all([
    recuentoDeCingulos(tx),
    cingulosSinDevolverDe(tx, [hermanoId]),
  ]);
  return enElRopero + trae.length > 0 ? Cingulo.PRESTADO : Cingulo.DEBIDO;
}

/** Lo que le queda de la salida a una solicitud, según cobre su salida. */
export const pendienteDe = (
  s: Pick<SolicitudConRecibo, 'donativo' | 'recibo'>,
  salida: { cobro: CobroSalida; importeCuota: Prisma.Decimal | number },
) => pendienteDeLaSalida(
  { donativo: s.donativo === null ? null : Number(s.donativo), recibo: s.recibo },
  { cobro: salida.cobro, importeCuota: Number(salida.importeCuota) },
);

/** Un concepto de reemisión libre para ese hermano y año: «Cuota 2025 (reemisión)», «… (reemisión 2)». */
async function conceptoDeReemision(tx: Tx, hermanoId: number, year: number, concepto: string) {
  const usados = new Set((await tx.recibo.findMany({ where: { hermanoId, year }, select: { concepto: true } })).map((r) => claveConcepto(r.concepto)));
  const base = `${concepto.replace(/\s*\(reemisión(?: \d+)?\)$/u, '')} (reemisión)`;
  if (!usados.has(claveConcepto(base))) return base;
  for (let n = 2; ; n += 1) {
    const candidato = base.replace(/\)$/, ` ${n})`);
    if (!usados.has(claveConcepto(candidato))) return candidato;
  }
}

export class ZonasService {
  // =================================================================
  //  INSCRIPCIÓN
  // =================================================================

  /**
   * Apuntar en la mesa a quien viene a salir: nace su solicitud (sin
   * papeleta ni recibo) y pasa a Tesorería o, si lo tiene todo al día,
   * directo a Túnicas.
   */
  static async inscribir(dto: InscripcionEnMesa, clave: string | undefined, meta?: MetaDeAuditoria) {
    const hermano = await db.hermano.findUnique({ where: { id: dto.hermanoId }, select: { activo: true, nombre: true } });
    if (!hermano) throw new NotFoundError('No se encontró a esa persona en el censo.');
    if (!hermano.activo) throw new HttpError(`${hermano.nombre} no está en activo: Secretaría tiene que darla de alta o reactivarla antes.`, 409);
    if (!dto.puesto.trim()) throw new HttpError('Falta el puesto.');
    const alturaHombro = alturaDictada(dto.alturaHombro);
    const year = anioDeLaMesa(dto.salida);

    const { resultado, repetida } = await unaVez(clave, 'inscribir', async (tx) => {
      // Si pidió día para esta salida sin llegar a pedir la papeleta (citas de antes), se enlaza.
      const cita = await tx.cita.findFirst({
        where: { hermanoId: dto.hermanoId, estado: EstadoCita.RESERVADA, papeleta: null, solicitud: null, turno: { salidaId: dto.salida.id } },
        orderBy: { id: 'desc' },
        select: { id: true },
      });
      const solicitud = await PapeletasService.crearSolicitudEnTransaccion(tx, {
        hermanoId: dto.hermanoId, salida: dto.salida, year, puesto: dto.puesto, observaciones: dto.observaciones,
        donativo: dto.donativo, citaId: cita?.id, origen: OrigenSolicitud.MESA,
      });
      if (alturaHombro !== undefined) await tx.hermano.update({ where: { id: dto.hermanoId }, data: { alturaHombro } });
      return { solicitudId: solicitud.id, puesto: solicitud.puesto };
    });

    if (!repetida) {
      await AuditoriaService.log(ACCIONES_AUDITORIA.MESA_INSCRIBIR, meta ?? {}, 'solicitud', resultado.solicitudId, {
        despues: { hermanoId: dto.hermanoId, salidaId: dto.salida.id, year, ...resultado, donativo: dto.donativo ?? null, ...(alturaHombro !== undefined && { alturaHombro }) },
      });
      avisarALaMesa({ que: 'inscrito', hermanoId: dto.hermanoId, salidaId: dto.salida.id });
    }
    const requisitos = await ZonasService.requisitos(db, dto.hermanoId, dto.salida, year);
    return { ...resultado, requisitos };
  }

  // =================================================================
  //  TESORERÍA
  // =================================================================

  /**
   * Cobrar de una vez lo que la persona trae pendiente: sus cuotas y lo de
   * la salida (la cuota de salida o el donativo, que se vuelve recibo al
   * pagarlo). Puede ser de otras fichas de su cuenta (quien paga lo de sus
   * hijos). Una cuota que el banco devolvió no se puede cobrar (su recibo es
   * final): se emite su reemisión ya cobrada.
   */
  static async cobrar(
    dto: CobroEnMesa, clave: string | undefined, meta?: MetaDeAuditoria,
    accion: typeof ACCIONES_AUDITORIA.MESA_COBRAR | typeof ACCIONES_AUDITORIA.PAGO_EN_LINEA = ACCIONES_AUDITORIA.MESA_COBRAR,
  ) {
    const hermano = await db.hermano.findUnique({ where: { id: dto.hermanoId }, select: { userId: true } });
    if (!hermano) throw new NotFoundError('No se encontró a esa persona en el censo.');
    const ids = [...new Set(dto.reciboIds)];
    const deSalida = new Map((dto.solicitudes ?? []).map((s) => [s.solicitudId, s.importe]));
    if (ids.length === 0 && deSalida.size === 0) throw new HttpError('No hay nada que cobrar.');

    // Las categorías contables, antes de abrir la transacción (ver idCategoriaDeRecibos).
    const tipos = new Set((await db.recibo.findMany({ where: { id: { in: ids } }, select: { tipo: true }, distinct: ['tipo'] })).map((r) => r.tipo));
    const salidas = await db.solicitud.findMany({ where: { id: { in: [...deSalida.keys()] } }, select: { salida: { select: { cobro: true } } } });
    for (const { salida } of salidas) tipos.add(tipoReciboDe(salida.cobro));
    const categorias = new Map<TipoRecibo, number>();
    for (const tipo of tipos) categorias.set(tipo, await idCategoriaIngresos(tipo));

    const { resultado, repetida } = await unaVez(clave, 'cobrar', async (tx) => {
      const cobrados: { id: number; hermanoId: number; concepto: string; importe: number; estado: EstadoPago }[] = [];
      const ahora = new Date();
      const ingreso = (r: { id: number; concepto: string; tipo: TipoRecibo; hermanoId: number }, importe: number) => tx.transaccion.create({
        data: {
          tipo: TipoTransaccion.INGRESO, categoriaId: categorias.get(r.tipo)!, concepto: r.concepto,
          importe: new Prisma.Decimal(importe), fecha: ahora, metodoPago: dto.metodoPago, hermanoId: r.hermanoId, reciboId: r.id,
        },
      });

      // Lo de la salida: se vuelve recibo al pagarlo.
      const solicitudes = await tx.solicitud.findMany({ where: { id: { in: [...deSalida.keys()] } }, include: { recibo: true, salida: true, hermano: { select: { userId: true } } } });
      if (solicitudes.length !== deSalida.size) throw new NotFoundError('Alguna solicitud ya no existe. Recarga la ficha.');
      for (const s of solicitudes) {
        if (s.hermano.userId !== hermano.userId) throw new HttpError('Solo se cobra junto lo de una misma familia.', 403);
        if (s.estado !== EstadoSolicitud.PENDIENTE) throw new HttpError('Esa solicitud ya no está pendiente. Recarga la ficha.', 409);
        if (pendienteDe(s, s.salida) === 0 && s.recibo) throw new HttpError(`«${s.recibo.concepto}» ya está pagado.`, 409);
        const libre = s.salida.cobro === 'DONATIVO';
        const dado = deSalida.get(s.id);
        const importe = libre && dado !== undefined ? centimos(dado) / 100 : pendienteDe(s, s.salida);
        // Con donativo queda lo que da al final, aunque sea 0: así ya no debe nada.
        if (libre) await tx.solicitud.update({ where: { id: s.id }, data: { donativo: new Prisma.Decimal(importe) } });
        if (importe === 0) continue;
        const recibo = await PapeletasService.reciboDeSalidaEnTransaccion(tx, s, importe, dto.metodoPago);
        await ingreso(recibo, importe);
        cobrados.push({ id: recibo.id, hermanoId: s.hermanoId, concepto: recibo.concepto, importe, estado: EstadoPago.PAGADO });
      }

      const recibos = await tx.recibo.findMany({ where: { id: { in: ids } }, include: { hermano: { select: { userId: true } } } });
      if (recibos.length !== ids.length) throw new NotFoundError('Algún recibo ya no existe. Recarga la ficha.');
      if (recibos.some((r) => r.hermano.userId !== hermano.userId)) {
        throw new HttpError('Solo se cobra junto lo de una misma familia.', 403);
      }
      for (const r of recibos) {
        const importe = Number(r.importe);
        let cobrado: { id: number; concepto: string } = r;
        if (r.estado === EstadoPago.DEVUELTO) {
          // Final: se cobra su reemisión, que ya nace pagada. Una sola vez.
          await exigirSinReemision(tx, r);
          cobrado = await tx.recibo.create({
            data: {
              hermanoId: r.hermanoId, year: r.year, tipo: r.tipo, importe: r.importe,
              concepto: await conceptoDeReemision(tx, r.hermanoId, r.year, r.concepto),
              estado: EstadoPago.PAGADO, fechaPago: ahora, metodoPago: dto.metodoPago,
              observaciones: `Reemisión del recibo ${r.id}, devuelto por el banco, cobrada en la mesa.`,
            },
          });
        } else {
          if (r.estado === EstadoPago.REMESADO && !estadosCobrablesCon(dto.metodoPago).includes(EstadoPago.REMESADO)) {
            throw new HttpError(`«${r.concepto}» ${MENSAJE_REMESADO_EN_MANO}`, 409);
          }
          const { count } = await tx.recibo.updateMany({
            where: { id: r.id, estado: { in: estadosCobrablesCon(dto.metodoPago) } },
            data: { estado: EstadoPago.PAGADO, fechaPago: ahora, metodoPago: dto.metodoPago },
          });
          if (count !== 1) throw new HttpError(`«${r.concepto}» ya no está pendiente de cobro. Recarga la ficha.`, 409);
        }
        await ingreso({ id: cobrado.id, concepto: cobrado.concepto, tipo: r.tipo, hermanoId: r.hermanoId }, importe);
        cobrados.push({ id: cobrado.id, hermanoId: r.hermanoId, concepto: cobrado.concepto, importe, estado: EstadoPago.PAGADO });
      }
      const total = cobrados.reduce((s, c) => s + centimos(c.importe), 0) / 100;
      return { cobrados, total, metodoPago: dto.metodoPago, hermanos: [...new Set([...cobrados.map((c) => c.hermanoId), ...solicitudes.map((s) => s.hermanoId)])] };
    });

    if (!repetida) {
      await AuditoriaService.log(accion, meta ?? {}, 'hermano', dto.hermanoId, { despues: resultado });
      for (const hermanoId of resultado.hermanos) avisarALaMesa({ que: 'cobrado', hermanoId });
    }
    return { ...resultado, repetida };
  }

  /**
   * Perdonar cuotas de hermano: lo decide el Hermano Mayor y lo marca
   * Tesorería. La cuota queda EXENTA con una nota que lo dice, y eso es lo que
   * ve el hermano en su área. Una devuelta por el banco es final: se perdona
   * su reemisión, que nace exenta.
   */
  static async perdonar(dto: { reciboIds: number[]; motivo?: string }, clave: string | undefined, meta?: MetaDeAuditoria) {
    const ids = [...new Set(dto.reciboIds)];
    if (ids.length === 0) throw new HttpError('No hay ninguna cuota que perdonar.');
    const nota = notaDePerdon(dto.motivo);

    const { resultado, repetida } = await unaVez(clave, 'perdonar', async (tx) => {
      const recibos = await tx.recibo.findMany({ where: { id: { in: ids } } });
      if (recibos.length !== ids.length) throw new NotFoundError('Alguna cuota ya no existe. Recarga la ficha.');
      const perdonadas: { id: number; hermanoId: number; concepto: string; importe: number }[] = [];
      for (const r of recibos) {
        if (r.tipo !== TipoRecibo.CUOTA_HERMANO) throw new HttpError(`«${r.concepto}» no es una cuota de hermano: solo se perdonan cuotas.`, 409);
        if (r.estado === EstadoPago.REMESADO) throw new HttpError(`«${r.concepto}» está en el banco, cobrándose: no se puede perdonar.`, 409);
        const observaciones = [r.observaciones, nota].filter(Boolean).join(' · ');
        if (r.estado === EstadoPago.DEVUELTO) {
          await exigirSinReemision(tx, r);
          const reemision = await tx.recibo.create({
            data: {
              hermanoId: r.hermanoId, year: r.year, tipo: r.tipo, importe: r.importe, estado: EstadoPago.EXENTO,
              concepto: await conceptoDeReemision(tx, r.hermanoId, r.year, r.concepto), observaciones: nota,
            },
          });
          perdonadas.push({ id: reemision.id, hermanoId: r.hermanoId, concepto: reemision.concepto, importe: Number(r.importe) });
          continue;
        }
        const { count } = await tx.recibo.updateMany({
          where: { id: r.id, estado: EstadoPago.PENDIENTE },
          data: { estado: EstadoPago.EXENTO, observaciones },
        });
        if (count !== 1) throw new HttpError(`«${r.concepto}» ya no está pendiente. Recarga la ficha.`, 409);
        perdonadas.push({ id: r.id, hermanoId: r.hermanoId, concepto: r.concepto, importe: Number(r.importe) });
      }
      return { perdonadas };
    });

    if (!repetida) {
      await AuditoriaService.log(ACCIONES_AUDITORIA.RECIBO_PERDONAR, meta ?? {}, 'recibo', ids.join(','), {
        despues: { ...resultado, motivo: dto.motivo?.trim() || null },
      });
      for (const hermanoId of new Set(resultado.perdonadas.map((p) => p.hermanoId))) avisarALaMesa({ que: 'perdonado', hermanoId });
    }
    return { ...resultado, repetida };
  }

  // =================================================================
  //  TÚNICAS
  // =================================================================

  /**
   * Recoger: se le da la ropa del ropero (queda prestada a la persona) y se
   * confirma el puesto —en las salidas sin ropa, solo el puesto— y entonces nace la
   * papeleta. Solo si lo tiene todo pagado o perdonado: la túnica no sale
   * sin eso.
   */
  static async entregar(dto: EntregaEnMesa, clave: string | undefined, meta?: MetaDeAuditoria) {
    const alturaHombro = alturaDictada(dto.alturaHombro);

    const { resultado, repetida } = await unaVez(clave, 'entregar', async (tx) => {
      const s = await tx.solicitud.findUnique({
        where: { id: dto.solicitudId },
        include: { recibo: true, salida: true, hermano: { select: { id: true, activo: true } } },
      });
      if (!s) throw new NotFoundError('Solicitud no encontrada.');
      if (s.estado !== EstadoSolicitud.PENDIENTE) {
        throw new HttpError(s.estado === EstadoSolicitud.RECOGIDA ? 'Ya se recogió. Para cambiar la ropa, corrígela desde el listado.' : 'Esta solicitud se canceló.', 409);
      }

      const requisitos = requisitosParaRecoger({
        activo: s.hermano.activo,
        solicitud: { cobro: s.salida.cobro, salidaPendiente: pendienteDe(s, s.salida) },
        cuotas: (await cuotasQueCuentan(tx, [s.hermanoId])).get(s.hermanoId) ?? [],
      });
      if (!requisitos.puedeRecoger) throw new HttpError(`Todavía no puede recoger: ${requisitos.motivos.join(' ')} Que pase por Tesorería.`, 409);

      const conRopa = s.salida.conRopa;
      const origen = conRopa ? dto.origenTunica ?? 'ROPERO' : null;
      const limpio = (t?: string) => (t?.trim() ? normalizarNumeroPrenda(t) : null);
      const ropa = conRopa
        ? {
            numTunicaAsignada: origen === 'ROPERO' ? limpio(dto.numTunicaAsignada) : null,
            numCapiroteAsignado: limpio(dto.numCapiroteAsignado),
            numFaraonaAsignada: limpio(dto.numFaraonaAsignada),
          }
        : { numTunicaAsignada: null, numCapiroteAsignado: null, numFaraonaAsignada: null };
      if (conRopa) {
        await comprobarQueNoVaEnOtraPapeleta(tx, { year: s.year, salidaId: s.salidaId }, ropa);
        await prestarRopaEnTransaccion(tx, s.hermanoId, ropaPedida({ origenTunica: origen ?? undefined, ...ropa, crearPrendas: dto.crearPrendas }));
      }
      const cingulo: Cingulo | null = conRopa ? dto.cingulo ?? await cinguloPorDefecto(tx, s.hermanoId, origen ?? 'ROPERO') : null;
      if (cingulo === Cingulo.PRESTADO) await prestarCinguloEnTransaccion(tx, s.hermanoId, null);

      const ficha: Prisma.HermanoUpdateInput = {};
      if (alturaHombro !== undefined) ficha.alturaHombro = alturaHombro;
      if (origen === 'PROPIA') ficha.tieneTunicaPropia = true;
      if (origen === 'ROPERO') ficha.tieneTunicaPropia = false;
      if (Object.keys(ficha).length > 0) await tx.hermano.update({ where: { id: s.hermanoId }, data: ficha });

      const papeleta = await PapeletasService.crearPapeletaEnTransaccion(tx, s, {
        ...ropa,
        origenTunica: origen,
        cingulo,
        puesto: dto.puesto?.trim() || s.puesto,
        observaciones: dto.observaciones !== undefined ? dto.observaciones : s.observaciones,
      });

      return {
        papeletaId: papeleta.id, solicitudId: s.id, hermanoId: s.hermanoId, salidaId: s.salidaId, year: s.year,
        puestoPedido: s.puesto, puesto: papeleta.puesto, origenTunica: papeleta.origenTunica,
        numTunicaAsignada: papeleta.numTunicaAsignada, numCapiroteAsignado: papeleta.numCapiroteAsignado, numFaraonaAsignada: papeleta.numFaraonaAsignada,
        cingulo: papeleta.cingulo,
      };
    });

    if (!repetida) {
      await AuditoriaService.log(ACCIONES_AUDITORIA.PAPELETA_ENTREGAR, meta ?? {}, 'papeleta', resultado.papeletaId, {
        despues: { ...resultado, ...(alturaHombro !== undefined && { alturaHombro }) },
      });
      avisarALaMesa({ que: 'entregado', hermanoId: resultado.hermanoId, salidaId: resultado.salidaId });
      await ZonasService.mandarPapeleta(resultado.papeletaId).catch(console.error);
    }
    return { ...resultado, repetida };
  }

  // =================================================================
  //  DEVOLUCIÓN
  // =================================================================

  /**
   * Recibir lo que la persona devuelve después de la salida (el mismo día o
   * cuando lo lleve a la parroquia). Las túnicas van al lavado, todas; lo
   * demás, al ropero; lo roto, al taller. El cíngulo vuelve a contar como
   * del ropero. Lo que no trae sigue a su nombre, sin devolver.
   */
  static async devolver(dto: DevolucionEnMesa, clave: string | undefined, meta?: MetaDeAuditoria) {
    if (dto.prendas.length === 0 && dto.cingulos.length === 0) throw new HttpError('No hay nada que devolver.');
    const { resultado, repetida } = await unaVez(clave, 'devolver', async (tx) => {
      const prendas = await tx.prenda.findMany({ where: { id: { in: dto.prendas.map((p) => p.id) } } });
      const devueltas: { id: number; tipo: string; numero: string; estado: EstadoPrenda }[] = [];
      for (const pedida of dto.prendas) {
        const prenda = prendas.find((p) => p.id === pedida.id);
        if (!prenda) throw new NotFoundError('Alguna prenda ya no está en el ropero. Recarga la ficha.');
        const estado = estadoAlDevolver(prenda.tipo, pedida.rota === true);
        const { count } = await tx.prenda.updateMany({
          where: { id: prenda.id, hermanoId: dto.hermanoId, estado: EstadoPrenda.PRESTADA },
          data: { estado, hermanoId: null, fechaAsignacion: null },
        });
        if (count !== 1) throw new HttpError(`La prenda ${prenda.numero} ya no consta prestada a esta persona. Recarga la ficha.`, 409);
        devueltas.push({ id: prenda.id, tipo: prenda.tipo, numero: prenda.numero, estado });
      }
      const cingulos = [...new Set(dto.cingulos)];
      if (cingulos.length > 0) {
        const count = await devolverCingulosEnTransaccion(tx, dto.hermanoId, cingulos);
        if (count !== cingulos.length) throw new HttpError('El cíngulo ya no consta prestado a esta persona. Recarga la ficha.', 409);
      }
      return { hermanoId: dto.hermanoId, prendas: devueltas, cingulos: cingulos.length };
    });

    if (!repetida) {
      await AuditoriaService.log(ACCIONES_AUDITORIA.MESA_DEVOLVER, meta ?? {}, 'hermano', dto.hermanoId, { despues: resultado });
      avisarALaMesa({ que: 'devuelto', hermanoId: dto.hermanoId });
    }
    return { ...resultado, repetida };
  }

  /**
   * Quién tiene algo del ropero sin devolver, y qué: para reclamarlo. Quien
   * lleva túnica propia o no lleva túnica no tiene nada prestado y no sale.
   */
  static async sinDevolver() {
    const [prendas, cingulos] = await Promise.all([
      db.prenda.findMany({
        where: { estado: EstadoPrenda.PRESTADA, hermanoId: { not: null } },
        select: { id: true, tipo: true, numero: true, fechaAsignacion: true, hermanoId: true },
        orderBy: [{ tipo: 'asc' }, { numero: 'asc' }],
      }),
      cingulosSinDevolverDe(db).then((lista) => lista.map(({ papeletaId, ...c }) => ({ id: papeletaId, ...c }))),
    ]);
    const ids = [...new Set([...prendas.map((p) => p.hermanoId!), ...cingulos.map((c) => c.hermanoId)])];
    const hermanos = await db.hermano.findMany({
      where: { id: { in: ids } },
      select: { id: true, nombre: true, apellidos: true, fechaNacimiento: true, numeroHermano: true, telefono: true },
    });
    return hermanos
      .map((h) => ({
        hermano: h,
        prendas: prendas.filter((p) => p.hermanoId === h.id).map(({ hermanoId: _h, ...p }) => p),
        cingulos: cingulos.filter((c) => c.hermanoId === h.id).map(({ hermanoId: _h, ...c }) => c),
      }))
      .sort((a, b) => a.hermano.apellidos.localeCompare(b.hermano.apellidos, 'es') || a.hermano.nombre.localeCompare(b.hermano.nombre, 'es'));
  }

  /**
   * El correo con la papeleta recogida: el puesto confirmado y, si la salida
   * lleva ropa, la túnica. No espera al envío: la mesa no se queda parada por el correo.
   */
  static async mandarPapeleta(papeletaId: number) {
    const p = await db.papeletaSitio.findUnique({
      where: { id: papeletaId },
      include: { recibo: true, salida: { include: { acto: true } }, hermano: { select: { nombre: true, sexo: true, email: true, user: { select: { email: true } } } } },
    });
    const destino = p?.hermano.user.email ?? p?.hermano.email;
    if (!p || !destino) return;
    const importe = Number(p.recibo.importe);
    // El PDF es un extra: si fallara, el correo sale igual, sin él.
    const pdf = await datosDeLaPapeleta(p.id)
      .then(async (d) => (d ? { nombre: archivoDePapeleta(d), contenido: await papeletaEnPdf(d) } : undefined))
      .catch((e: unknown) => { console.error('[Papeleta] No se pudo generar el PDF para el correo:', e); return undefined; });
    EmailService.enviarPapeleta(destino, p.hermano.nombre, {
      year: p.year,
      salida: { nombre: p.salida.nombre, cobro: p.salida.cobro, conRopa: p.salida.conRopa, indicaciones: p.salida.indicaciones, articulo: articuloDe(p.salida) },
      concepto: p.recibo.concepto,
      importe: importe > 0 && p.recibo.estado === EstadoPago.PAGADO ? euros(importe) : '',
      papeletaId: p.id,
      puesto: p.puesto,
      tramo: p.tramo || '',
      tunica: p.numTunicaAsignada,
      observaciones: p.observaciones || '',
      ...leerDatosEvento(p.salida, p.year),
    }, p.hermano.sexo ?? undefined, pdf).catch(console.error);
  }

  // =================================================================
  //  LO QUE VE CADA ZONA
  // =================================================================

  /** Lo que le falta a una persona para recoger la papeleta de una salida. */
  static async requisitos(cliente: Cliente, hermanoId: number, salida: SalidaConActo, year?: number) {
    const anio = year ?? anioDeLaMesa(salida);
    const [h, solicitud, cuotas] = await Promise.all([
      cliente.hermano.findUnique({ where: { id: hermanoId }, select: { activo: true } }),
      PapeletasService.solicitudPendiente(cliente, hermanoId, anio, salida.id),
      cuotasQueCuentan(cliente, [hermanoId]),
    ]);
    return requisitosParaRecoger({
      activo: h?.activo ?? false,
      solicitud: solicitud && { cobro: salida.cobro, salidaPendiente: pendienteDe(solicitud, salida) },
      cuotas: cuotas.get(hermanoId) ?? [],
    });
  }

  /**
   * Las colas de hoy: a quién espera Tesorería (apuntados con algo por
   * pagar) y a quién espera Túnicas (con todo al día y la ropa por recoger).
   * Cuentan quienes tienen hoy su día de reparto y quienes han pasado hoy
   * por la mesa; a los demás se les encuentra con el buscador.
   */
  static async colas(salida: SalidaConActo) {
    const year = anioDeLaMesa(salida);
    const hoy = diaMadrid(new Date());
    const solicitudes = await db.solicitud.findMany({
      where: { year, salidaId: salida.id, estado: EstadoSolicitud.PENDIENTE },
      include: {
        recibo: true,
        cita: { select: { turno: { select: { fecha: true } } } },
        hermano: { select: { id: true, nombre: true, apellidos: true, fechaNacimiento: true, activo: true, numeroHermano: true } },
      },
    });
    const ids = solicitudes.map((s) => s.hermano.id);
    const cuotas = await cuotasQueCuentan(db, ids);
    // Quien ha pagado o le han perdonado hoy algo (una cuota, sobre todo) acaba de pasar por Tesorería.
    const tocadosHoy = new Map((await db.recibo.groupBy({
      by: ['hermanoId'],
      where: { hermanoId: { in: ids }, updatedAt: { gte: inicioDiaMadrid(hoy) } },
      _max: { updatedAt: true },
    })).map((g) => [g.hermanoId, g._max.updatedAt?.getTime() ?? 0]));
    const deHoy = (d: Date | null | undefined) => (d ? diaMadrid(d) === hoy : false);

    const filas = solicitudes.map((s) => {
      const requisitos = requisitosParaRecoger({
        activo: s.hermano.activo,
        solicitud: { cobro: salida.cobro, salidaPendiente: pendienteDe(s, salida) },
        cuotas: cuotas.get(s.hermano.id) ?? [],
      });
      const { activo: _activo, ...hermano } = s.hermano;
      return {
        solicitudId: s.id,
        hermano,
        puesto: s.puesto,
        conCitaHoy: deHoy(s.cita?.turno.fecha),
        totalPendiente: requisitos.totalPendiente,
        motivos: requisitos.motivos,
        puedeRecoger: requisitos.puedeRecoger,
        hoyEnLaMesa: deHoy(s.createdAt) || deHoy(s.updatedAt) || tocadosHoy.has(s.hermano.id) || deHoy(s.cita?.turno.fecha),
        // El momento en que pasó a esta cola, para poner arriba al último que llega.
        desde: Math.max(s.createdAt.getTime(), s.updatedAt.getTime(), tocadosHoy.get(s.hermano.id) ?? 0),
      };
    }).filter((f) => f.hoyEnLaMesa);

    const porRecencia = (a: { desde: number }, b: { desde: number }) => b.desde - a.desde;
    return {
      salida: salida.slug,
      year,
      porCobrar: filas.filter((f) => !f.puedeRecoger).sort(porRecencia),
      porRecoger: filas.filter((f) => f.puedeRecoger).sort(porRecencia),
    };
  }

  /**
   * La ropa que hay que tener preparada antes del día: quién viene a
   * recogerla (de las solicitudes) y qué se le propone, para buscarla en el
   * ropero con tiempo. Por día de reparto, o todos los pendientes. Solo en
   * las salidas con ropa: en las demás no hay nada que preparar.
   */
  static async preparacion(salida: SalidaConActo, turnoId?: number) {
    if (!salida.conRopa) return [];
    const year = anioDeLaMesa(salida);
    const solicitudes = await db.solicitud.findMany({
      where: { year, salidaId: salida.id, estado: EstadoSolicitud.PENDIENTE, ...(turnoId && { cita: { turnoId } }) },
      orderBy: [{ hermano: { apellidos: 'asc' } }, { hermano: { nombre: 'asc' } }],
      select: {
        id: true, puesto: true,
        cita: { select: { turno: { select: { id: true, fecha: true } } } },
        hermano: {
          select: {
            id: true, nombre: true, apellidos: true, fechaNacimiento: true, alturaHombro: true, tieneTunicaPropia: true, puesto: true,
            prendas: { where: { estado: 'PRESTADA' }, select: { tipo: true, numero: true, talla: true } },
            papeletas: {
              where: { salidaId: salida.id, year: { lt: year } }, orderBy: { year: 'desc' }, take: 1,
              select: { puesto: true, numTunicaAsignada: true, numCapiroteAsignado: true, numFaraonaAsignada: true, origenTunica: true },
            },
          },
        },
      },
    });
    const cuotas = await cuotasQueCuentan(db, solicitudes.map((s) => s.hermano.id));
    // La túnica de su talla, sin dar la misma a dos: primero se apartan las que
    // ya le tocan a alguien (la de casa o la de antes, libre), y luego se
    // reparten las demás por orden de la lista.
    const libres = await tunicasLibres(db, year, salida.id);
    const sinRopero = solicitudes.map((s) => {
      const anterior = s.hermano.papeletas[0] ?? null;
      return propuestaDeRopa({
        anterior: anterior && { ...anterior, origenTunica: anterior.origenTunica as Origen | null },
        prestadas: s.hermano.prendas,
        tieneTunicaPropia: s.hermano.tieneTunicaPropia,
        puestoDeLaFicha: s.puesto,
      });
    });
    const apartadas = new Set(sinRopero.flatMap((p) => (p.tunica.numero ? [p.tunica.numero] : [])));
    let quedan = libres.filter((t) => !apartadas.has(t.numero));
    return solicitudes.map((s, i) => {
      const anterior = s.hermano.papeletas[0] ?? null;
      const propuesta = propuestaDeRopa({
        anterior: anterior && { ...anterior, origenTunica: anterior.origenTunica as Origen | null },
        prestadas: s.hermano.prendas,
        tieneTunicaPropia: s.hermano.tieneTunicaPropia,
        puestoDeLaFicha: s.puesto,
        // La de antes cuenta como libre para él si lo está: la ha apartado arriba.
        ropero: { libres: [...quedan, ...libres.filter((t) => t.numero === sinRopero[i].tunica.numero)], alturaHombro: s.hermano.alturaHombro },
      });
      if (propuesta.tunica.porTalla) quedan = quedan.filter((t) => t.numero !== propuesta.tunica.numero);
      const pendientes = (cuotas.get(s.hermano.id) ?? []).filter((c) => c.estado !== EstadoPago.REMESADO);
      return {
        solicitudId: s.id,
        dia: s.cita?.turno.fecha ?? null,
        hermano: { id: s.hermano.id, nombre: s.hermano.nombre, apellidos: s.hermano.apellidos, fechaNacimiento: s.hermano.fechaNacimiento, alturaHombro: s.hermano.alturaHombro },
        puesto: s.puesto,
        propuesta,
        tallaTunica: s.hermano.prendas.find((x) => x.tipo === 'TUNICA')?.talla ?? null,
        cuotasPendientes: pendientes.length,
      };
    });
  }
}
