/**
 * El pago en línea, de punta a punta: lo que se paga, el viaje a la página
 * del banco, el aviso del banco y lo que no cuadra. Los recibos del área de
 * hermanos están aquí; el donativo de la web pública, en `donativo.service.ts`,
 * y el aviso del banco reparte a uno u otro.
 *
 * El dinero manda: si el banco avisa de que cobró, ese cobro queda apuntado
 * pase lo que pase. Si ya no se puede aplicar a lo que se pagaba (se pagó en
 * Secretaría mientras tanto, cambió el importe…), el pago queda como
 * INCIDENCIA para que Tesorería devuelva el dinero. Nunca se pierde en silencio.
 */
import { EstadoPago, EstadoPagoEnLinea, EstadoSolicitud, OrigenPago, Prisma, TipoPagoEnLinea } from '@prisma/client';
import db from '../../config/db.js';
import { HttpError, NotFoundError, esFalloPasajero } from '../../utils/error.handle.js';
import { pendienteDeLaSalida } from '../../domain/salidas.js';
import { configuracionRedsys, formularioDePago, leerAviso, modoDePago, numeroDePedido } from '../../domain/redsys.js';
import { urlDeLaWeb } from '../correos/plantilla.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from '../auditoria.service.js';
import { MisRecibosService } from '../mis-recibos.service.js';
import { MENSAJE_YA_REEMITIDO, reemitidosDe } from '../recibos/comunes.js';
import { ZonasService } from '../procesion/zonas.service.js';
import { DonativoService } from './donativo.service.js';
import { aCentimos, claveDelCobro, urlDelAviso, type InicioDePago, type MetodoEnLinea } from './comunes.js';
import { EmailService } from '../email.service.js';
import { AvisosPersonalesService } from '../avisos-personales.service.js';
import { fechaYHoraParaCorreo } from '../../domain/fecha-y-hora.js';
import { eurosDeCentimos } from '../../utils/euros.js';

export type {  MetodoEnLinea } from './comunes.js';

interface LoQueSePaga {
  reciboIds: number[];
  solicitudIds: number[];
}

/**
 * Lo que aplica un pago que no es del área de hermanos (un pedido de la
 * tienda, un apadrinamiento). Cada servicio registra el suyo al cargarse:
 * así la pasarela no importa a la tienda, y la tienda sí a la pasarela.
 * Si no se puede aplicar, lanza un HttpError y el pago queda como incidencia.
 */
type Aplicador = (
  referenciaId: number, metodo: MetodoEnLinea, meta: MetaDeAuditoria,
  /**
   * Lo último que se hace dentro de su transacción: el aviso del banco marca
   * ahí el pago, para que «aplicado» y «pago cerrado» se escriban a la vez.
   */
  alAplicar?: (tx: Prisma.TransactionClient) => Promise<void>,
) => Promise<void>;
interface OrigenDePago {
  aplicar: Aplicador;
  /** El correo de quien pagó sin cuenta, para las incidencias. */
  correo: (referenciaId: number) => Promise<string | null>;
  /**
   * El banco no lo cobró: lo que esperaba el pago, si sigue pendiente, pasa
   * a CANCELADO. Sin esto se quedaba PENDIENTE_PAGO para siempre y la pieza
   * o el producto no se podían quitar.
   */
  cancelar: (referenciaId: number) => Promise<void>;
  /** Deshacer lo pagado al resolver una incidencia (ver `resolver`), si el origen lo admite. */
  anular?: (referenciaId: number, meta: MetaDeAuditoria) => Promise<void>;
}
const ORIGENES: Partial<Record<OrigenPago, OrigenDePago>> = {};

/**
 * Un intento sin pagar de más de un día ya no cuenta como «alguien lo está
 * pagando»: cerrar la pestaña del banco no manda ningún aviso, y sin
 * caducidad bastaba empezar un pago (el alta es pública) para que una pieza
 * o un producto no se pudieran quitar nunca. Si el banco cobrara después, el
 * aviso no encontraría qué aplicar y quedaría como incidencia.
 */
export const INTENTO_CADUCA_MS = 24 * 60 * 60 * 1000;
export const intentosVigentesDesde = () => new Date(Date.now() - INTENTO_CADUCA_MS);

export function registrarOrigenDePago(origen: OrigenPago, o: OrigenDePago) {
  ORIGENES[origen] = o;
}

type PagoGuardado = Prisma.PagoEnLineaGetPayload<object>;

/**
 * A quién hay que devolverle el dinero de un pago: el correo de su cuenta;
 * sin cuenta, el que dejó el donante o el que dé el servicio del pedido (la
 * tienda, un apadrinamiento).
 */
async function correoDeQuienPago(p: PagoGuardado): Promise<string | null> {
  if (p.userId !== null) return (await db.user.findUnique({ where: { id: p.userId }, select: { email: true } }))?.email ?? null;
  const delDonativo = (p.donativo as { email?: string | null } | null)?.email;
  if (delDonativo) return delDonativo;
  return p.referenciaId !== null ? (await ORIGENES[p.origen]?.correo(p.referenciaId)) ?? null : null;
}

/**
 * Se le dice a quien pagó que se le devuelve el dinero. Nunca lanza: la
 * incidencia ya está apuntada, y es lo que importa para devolverlo.
 */
async function avisarDeLaDevolucion(p: PagoGuardado, centimos: number) {
  try {
    const para = await correoDeQuienPago(p);
    if (!para) return;
    await EmailService.enviarPagoDevuelto(para, { importe: eurosDeCentimos(centimos), pedido: p.pedido ?? String(p.id), fecha: fechaYHoraParaCorreo(p.createdAt) });
  } catch (e) {
    console.error(`[Pagos] No se ha podido avisar de la devolución del pedido ${p.pedido}`, e);
  }
}

/**
 * El justificante de lo pagado desde el área de hermanos: cada recibo con la
 * ficha de quien es. Va como aviso personal (al móvil, o por correo si no
 * tiene). Nunca lanza: el pago ya está cobrado y apuntado.
 */
async function mandarJustificante(p: PagoGuardado, userId: number, cobrados: { hermanoId: number; concepto: string; importe: number }[], centimos: number) {
  try {
    const [cuenta, fichas] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { email: true, nombre: true, hermanos: { where: { esTitular: true }, select: { sexo: true }, take: 1 } } }),
      db.hermano.findMany({ where: { id: { in: [...new Set(cobrados.map((c) => c.hermanoId))] } }, select: { id: true, nombre: true, apellidos: true } }),
    ]);
    if (!cuenta?.email || cobrados.length === 0) return;
    const nombreDe = new Map(fichas.map((f) => [f.id, `${f.nombre} ${f.apellidos ?? ''}`.trim()]));
    const correo = await EmailService.correoJustificantePago(cuenta.nombre, cuenta.hermanos[0]?.sexo ?? undefined, {
      total: eurosDeCentimos(centimos),
      metodo: p.metodo === 'BIZUM' ? 'Bizum' : 'tarjeta',
      fecha: fechaYHoraParaCorreo(new Date()),
      pedido: p.pedido ?? String(p.id),
      lineas: cobrados.map((c) => ({ concepto: c.concepto, detalle: nombreDe.get(c.hermanoId), importe: eurosDeCentimos(aCentimos(c.importe)) })),
    });
    await AvisosPersonalesService.mandar({ userId, email: cuenta.email }, correo);
  } catch (e) {
    console.error(`[Pagos] No se ha podido mandar el justificante del pedido ${p.pedido}`, e);
  }
}

export class PagoEnLineaService {
  /**
   * Un pago sin cuenta (la tienda, un apadrinamiento): apunta el pago
   * pendiente y devuelve el formulario firmado para ir al banco. El importe lo
   * calcula quien llama, en el servidor, nunca el navegador. `{pedido}` en las
   * direcciones de vuelta se cambia por el número de pedido.
   */
  static async iniciarSinCuenta(p: { origen: OrigenPago; referenciaId: number; centimos: number; metodo: MetodoEnLinea; descripcion: string; urlVuelta: string; urlFallo: string }) {
    const config = configuracionRedsys();
    if (p.metodo === 'BIZUM' && !config.bizum) throw new HttpError('El pago con Bizum no está disponible. Paga con tarjeta.', 409);
    const pedido = await db.$transaction(async (tx) => {
      const creado = await tx.pagoEnLinea.create({
        data: { origen: p.origen, referenciaId: p.referenciaId, metodo: p.metodo, importe: new Prisma.Decimal(p.centimos).div(100), reciboIds: [], solicitudIds: [] },
      });
      const numero = numeroDePedido(creado.id);
      await tx.pagoEnLinea.update({ where: { id: creado.id }, data: { pedido: numero } });
      return numero;
    });
    const formulario = formularioDePago({
      pedido, centimos: p.centimos, metodo: p.metodo, descripcion: p.descripcion,
      urlAviso: urlDelAviso(),
      urlVuelta: p.urlVuelta.replace('{pedido}', pedido), urlFallo: p.urlFallo.replace('{pedido}', pedido),
    }, config);
    return { tipo: 'banco' as const, pedido, ...formulario };
  }

  /**
   * Comprueba que todo es de la familia y está pendiente, y calcula el total
   * aquí: el importe no lo dice nunca el navegador.
   */
  static async preparar(userId: number, pago: LoQueSePaga) {
    const reciboIds = [...new Set(pago.reciboIds)];
    const solicitudIds = [...new Set(pago.solicitudIds)];
    const [recibos, solicitudes] = await Promise.all([
      db.recibo.findMany({
        where: { id: { in: reciboIds }, hermano: { userId, activo: true } },
        select: { id: true, estado: true, hermanoId: true, year: true, tipo: true, concepto: true, importe: true },
      }),
      db.solicitud.findMany({
        where: { id: { in: solicitudIds }, hermano: { userId, activo: true } },
        select: {
          id: true, hermanoId: true, estado: true, donativo: true, recibo: { select: { estado: true, concepto: true } },
          salida: { select: { cobro: true, importeCuota: true } },
        },
      }),
    ]);
    if (recibos.length !== reciboIds.length || solicitudes.length !== solicitudIds.length) throw new NotFoundError('Recibo no encontrado');
    const alguno = recibos[0]?.hermanoId ?? solicitudes[0]?.hermanoId;
    if (alguno === undefined) throw new HttpError('No hay nada que pagar.');

    const noPagable = recibos.find((r) => r.estado !== EstadoPago.PENDIENTE && r.estado !== EstadoPago.DEVUELTO);
    if (noPagable) throw new HttpError(`«${noPagable.concepto}» no está pendiente de pago.`, 409);
    // Un devuelto con reemisión ya no se debe: se debe (o se pagó) la reemisión.
    // Aquí avisa pronto; quien lo impide de verdad es el cobro, en su transacción.
    const reemitidos = await reemitidosDe(recibos.filter((r) => r.estado === EstadoPago.DEVUELTO));
    const yaReemitido = recibos.find((r) => reemitidos.has(r.id));
    if (yaReemitido) throw new HttpError(MENSAJE_YA_REEMITIDO(yaReemitido.concepto), 409);
    let centimos = recibos.reduce((s, r) => s + aCentimos(r.importe), 0);
    for (const s of solicitudes) {
      if (s.estado !== EstadoSolicitud.PENDIENTE) throw new HttpError('Esa solicitud ya no está pendiente. Recarga la página.', 409);
      const pendiente = pendienteDeLaSalida(
        { donativo: s.donativo === null ? null : Number(s.donativo), recibo: s.recibo },
        { cobro: s.salida.cobro, importeCuota: Number(s.salida.importeCuota) },
      );
      if (pendiente === 0) throw new HttpError('Lo de esa salida ya está pagado. Recarga la página.', 409);
      centimos += aCentimos(pendiente);
    }
    if (centimos <= 0) throw new HttpError('No hay nada que pagar.');
    const conceptos = recibos.map((r) => r.concepto);
    return { hermanoId: alguno, reciboIds, solicitudIds, centimos, conceptos };
  }

  /**
   * Empieza un pago. Simulado, se cobra en el acto; con Redsys, se apunta el
   * pago pendiente y se devuelve el formulario firmado que la web envía al banco.
   */
  static async iniciar(userId: number, pago: LoQueSePaga & { metodo: MetodoEnLinea }, clave: string | undefined, meta?: MetaDeAuditoria): Promise<InicioDePago> {
    const modo = modoDePago();
    if (!modo) throw new HttpError('El pago en línea todavía no está disponible. Puedes pagar en Secretaría o el día del reparto.', 409);
    if (modo === 'simulado') {
      const hecho = await MisRecibosService.pagarEnLinea(userId, pago, clave, meta);
      return { tipo: 'hecho', total: hecho.total, repetida: hecho.repetida };
    }

    const config = configuracionRedsys();
    if (pago.metodo === 'BIZUM' && !config.bizum) throw new HttpError('El pago con Bizum no está disponible. Paga con tarjeta.', 409);
    const listo = await this.preparar(userId, pago);
    const pedido = await db.$transaction(async (tx) => {
      const creado = await tx.pagoEnLinea.create({
        data: {
          userId, metodo: pago.metodo, importe: new Prisma.Decimal(listo.centimos).div(100),
          reciboIds: listo.reciboIds, solicitudIds: listo.solicitudIds,
        },
      });
      const numero = numeroDePedido(creado.id);
      await tx.pagoEnLinea.update({ where: { id: creado.id }, data: { pedido: numero } });
      return numero;
    });
    const formulario = formularioDePago({
      pedido,
      centimos: listo.centimos,
      metodo: pago.metodo,
      descripcion: listo.conceptos.length ? listo.conceptos.join(', ') : 'Salida procesional',
      urlAviso: urlDelAviso(),
      urlVuelta: urlDeLaWeb(`/area-hermano/procesion?pago=${pedido}`),
      urlFallo: urlDeLaWeb(`/area-hermano/procesion?pago=${pedido}&resultado=no`),
    }, config);
    return { tipo: 'banco', pedido, ...formulario };
  }

  /**
   * El aviso del banco. Devuelve false si no es un aviso válido (firma mala,
   * pedido desconocido): no se toca nada. Un aviso repetido no cobra dos veces.
   */
  static async avisoDelBanco(cuerpo: Record<string, unknown>, meta: MetaDeAuditoria): Promise<boolean> {
    const aviso = leerAviso(cuerpo, configuracionRedsys().clave);
    if (!aviso) {
      console.warn('[Pagos] Aviso del banco con firma o datos no válidos: ignorado.');
      return false;
    }
    const pago = await db.pagoEnLinea.findUnique({ where: { pedido: aviso.pedido } });
    if (!pago) {
      console.warn(`[Pagos] Aviso del banco de un pedido que no existe: ${aviso.pedido}.`);
      return false;
    }
    if (pago.estado !== EstadoPagoEnLinea.PENDIENTE) return true;
    const banco = { respuesta: aviso.respuesta, autorizacion: aviso.autorizacion };

    if (!aviso.cobrado) {
      const { count } = await db.pagoEnLinea.updateMany({ where: { id: pago.id, estado: EstadoPagoEnLinea.PENDIENTE }, data: { estado: EstadoPagoEnLinea.RECHAZADO, ...banco } });
      if (count === 1 && pago.origen !== OrigenPago.AREA_HERMANOS && pago.referenciaId !== null) await ORIGENES[pago.origen]?.cancelar(pago.referenciaId);
      return true;
    }

    const incidencia = async (motivo: string) => {
      // Si otro aviso del mismo pedido ya lo cobró, no es incidencia: es el repetido.
      if (await db.operacionMesa.findUnique({ where: { clave: claveDelCobro(aviso.pedido) }, select: { clave: true } })) {
        await PagoEnLineaService.marcarPagado(pago.id, banco);
        return;
      }
      const { count } = await db.pagoEnLinea.updateMany({ where: { id: pago.id, estado: EstadoPagoEnLinea.PENDIENTE }, data: { estado: EstadoPagoEnLinea.INCIDENCIA, motivo, ...banco } });
      console.error(`[Pagos] Incidencia en el pedido ${aviso.pedido}: ${motivo}`);
      await AuditoriaService.log(ACCIONES_AUDITORIA.PAGO_EN_LINEA_INCIDENCIA, { ...meta, userId: pago.userId ?? undefined }, 'PagoEnLinea', pago.id, { pedido: aviso.pedido, motivo });
      // Solo quien la apuntó avisa: un aviso repetido del banco no manda otro correo.
      // Lo que se devuelve es lo que cobró el banco, no lo que se esperaba.
      if (count === 1) void avisarDeLaDevolucion(pago, aviso.centimos);
    };

    const esperado = aCentimos(pago.importe);
    if (aviso.centimos !== esperado) {
      await incidencia(`El banco cobró ${(aviso.centimos / 100).toFixed(2)} € y se esperaban ${(esperado / 100).toFixed(2)} €.`);
      return true;
    }
    // El donativo no tiene nada que casar: se apunta tal cual.
    if (pago.tipo === TipoPagoEnLinea.DONATIVO) {
      await DonativoService.aplicar(pago, banco, meta);
      return true;
    }

    // Lo que no es del área de hermanos lo aplica su propio servicio, con la
    // misma regla: lo que ya no se puede aplicar es incidencia.
    if (pago.origen !== OrigenPago.AREA_HERMANOS) {
      const aplicar = ORIGENES[pago.origen]?.aplicar;
      // El pedido se reserva antes de aplicarlo, con la misma clave que el
      // cobro del área. Un segundo aviso del banco que llegue mientras se
      // aplica el primero choca con ella y es el repetido; sin esto, su
      // aplicador decía «ya no estaba pendiente» y quedaba una incidencia falsa.
      const clave = claveDelCobro(aviso.pedido);
      try {
        await db.operacionMesa.create({ data: { clave, tipo: 'aviso-del-banco' } });
      } catch (e) {
        // El otro aviso lo está aplicando o ya lo aplicó (y entonces cerró el
        // pago en la misma transacción): no hay nada más que hacer.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return true;
        throw e;
      }
      try {
        if (!aplicar || pago.referenciaId === null) throw new HttpError('El pago no dice qué se pagaba.');
        // El pago se marca dentro de la transacción del aplicador: antes se
        // marcaba después, y si la base se cortaba entre medias el pedido
        // quedaba pagado y el pago PENDIENTE para siempre, sin incidencia
        // que lo dijera ni aviso repetido que lo cerrara.
        await aplicar(pago.referenciaId, pago.metodo as MetodoEnLinea, { ...meta }, (tx) => PagoEnLineaService.marcarPagado(pago.id, banco, tx));
      } catch (e) {
        // No se aplicó nada (todo o nada): la reserva sobra, y con ella
        // `incidencia` lo tomaría por cobrado y un reenvío por el repetido.
        await db.operacionMesa.deleteMany({ where: { clave } });
        // Un choque que agotó los reintentos o la base caída no dicen nada del
        // pedido: el pago se queda PENDIENTE y el error sube (el banco no
        // recibe su 200 y reenvía el aviso, que entonces lo aplica). Con
        // INCIDENCIA, el reenvío se paraba en «ya no está pendiente» y había
        // que devolver el dinero de un pedido que se podía servir.
        if (esFalloPasajero(e)) throw e;
        // Lo demás es incidencia, no solo lo esperado: el banco ha cobrado, y
        // un pedido «sin pagar» sin rastro no lo ve nadie. Ya está apuntada,
        // así que se responde que sí: un 500 no lo arreglaría el reenvío.
        if (!(e instanceof HttpError)) console.error(`[Pagos] Error al aplicar el pedido ${aviso.pedido}:`, e);
        await incidencia(e instanceof HttpError
          ? `No se pudo aplicar el pago: ${e.message}`
          : 'No se pudo aplicar el pago por un error del servidor: revísalo antes de devolverlo.');
      }
      return true;
    }

    const reciboIds = pago.reciboIds as number[];
    const solicitudIds = pago.solicitudIds as number[];
    const userId = pago.userId;
    if (userId === null) {
      await incidencia('El pago de recibos no tiene de quién es.');
      return true;
    }
    try {
      const ahora = await this.preparar(userId, { reciboIds, solicitudIds });
      if (ahora.centimos !== esperado) {
        await incidencia(`Mientras pagaba cambió lo que debía: ahora son ${(ahora.centimos / 100).toFixed(2)} €.`);
        return true;
      }
      const cobro = await ZonasService.cobrar(
        { hermanoId: ahora.hermanoId, reciboIds, solicitudes: solicitudIds.map((solicitudId) => ({ solicitudId })), metodoPago: pago.metodo as MetodoEnLinea },
        claveDelCobro(aviso.pedido), { ...meta, userId }, ACCIONES_AUDITORIA.PAGO_EN_LINEA,
      );
      await PagoEnLineaService.marcarPagado(pago.id, banco);
      // Un aviso repetido del banco no manda otro justificante.
      if (!cobro.repetida) void mandarJustificante(pago, userId, cobro.cobrados, aviso.centimos);
    } catch (e) {
      // Lo que ya no se puede cobrar (pagado en Secretaría, solicitud anulada…) es incidencia; lo demás, un fallo de verdad.
      if (!(e instanceof HttpError)) throw e;
      await incidencia(`No se pudo aplicar el pago: ${e.message}`);
    }
    return true;
  }

  /**
   * El último paso de un aviso cobrado: el pago, a PAGADO, dentro de la
   * transacción de lo que se aplica si la hay (`tx`). Aparte y público para
   * que las pruebas puedan hacerlo fallar.
   */
  static async marcarPagado(id: number, banco: { respuesta: string | null; autorizacion: string | null }, tx?: Prisma.TransactionClient) {
    await (tx ?? db).pagoEnLinea.updateMany({ where: { id, estado: EstadoPagoEnLinea.PENDIENTE }, data: { estado: EstadoPagoEnLinea.PAGADO, ...banco } });
  }

  /** Cómo va un pago propio, para la vuelta del banco (el aviso puede llegar después). */
  static async estado(userId: number, pedido: string) {
    const pago = await db.pagoEnLinea.findFirst({ where: { pedido, userId, tipo: TipoPagoEnLinea.RECIBOS }, select: { estado: true, importe: true } });
    if (!pago) throw new NotFoundError('No se encontró ese pago.');
    return { estado: pago.estado, importe: Number(pago.importe) };
  }

  /** Lo que el banco cobró y no cuadró, sin resolver: Tesorería tiene que devolverlo. */
  static async incidencias() {
    const filas = await db.pagoEnLinea.findMany({
      where: { estado: EstadoPagoEnLinea.INCIDENCIA, resueltaEl: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    const usuarios = await db.user.findMany({ where: { id: { in: filas.flatMap((f) => (f.userId === null ? [] : [f.userId])) } }, select: { id: true, email: true } });
    const correo = new Map(usuarios.map((u) => [u.id, u.email]));
    // Sin cuenta: de un donativo, el correo que dejó el donante; de la tienda o
    // de un apadrinamiento, el que dé su servicio. Es a quien hay que devolverle el dinero.
    const sinCuenta = await Promise.all(filas.map((f) => (f.userId === null && f.referenciaId !== null ? ORIGENES[f.origen]?.correo(f.referenciaId) ?? null : null)));
    const deQuien = (f: (typeof filas)[number], i: number) =>
      (f.userId !== null ? correo.get(f.userId) : (f.donativo as { email?: string | null } | null)?.email ?? sinCuenta[i]) ?? null;
    // `origen` y `anulable`, para que Tesorería vea de dónde viene y la web
    // solo ofrezca «Resolver y anular» donde `resolver({ anular })` lo admite.
    return filas.map((f, i) => ({
      id: f.id, pedido: f.pedido, fecha: f.createdAt, importe: Number(f.importe), metodo: f.metodo,
      autorizacion: f.autorizacion, motivo: f.motivo, correo: deQuien(f, i), donativo: f.tipo === TipoPagoEnLinea.DONATIVO,
      origen: f.origen, anulable: !!ORIGENES[f.origen]?.anular && f.referenciaId !== null,
    }));
  }

  /**
   * Tesorería devolvió el dinero (o lo aplicó a mano): la incidencia deja de
   * salir. Con `anular`, además se anula lo que se pagaba (un pedido de la
   * tienda agotado), si su origen lo admite: antes el pedido se quedaba
   * «sin pagar» para siempre.
   */
  static async resolver(id: number, meta: MetaDeAuditoria, { anular = false } = {}) {
    if (anular) {
      const pago = await db.pagoEnLinea.findUnique({ where: { id }, select: { estado: true, resueltaEl: true, origen: true, referenciaId: true } });
      if (!pago || pago.estado !== EstadoPagoEnLinea.INCIDENCIA || pago.resueltaEl) throw new NotFoundError('Esa incidencia no existe o ya está resuelta.');
      const deshacer = ORIGENES[pago.origen]?.anular;
      if (!deshacer || pago.referenciaId === null) throw new HttpError('Lo que se pagaba con esta incidencia no se puede anular desde aquí.', 409);
      await deshacer(pago.referenciaId, meta);
    }
    const { count } = await db.pagoEnLinea.updateMany({
      where: { id, estado: EstadoPagoEnLinea.INCIDENCIA, resueltaEl: null },
      data: { resueltaEl: new Date(), resueltaPor: meta.userId ?? null },
    });
    if (count !== 1) throw new NotFoundError('Esa incidencia no existe o ya está resuelta.');
    await AuditoriaService.log(ACCIONES_AUDITORIA.PAGO_EN_LINEA_RESOLVER, meta, 'PagoEnLinea', id, { anulado: anular });
  }
}
