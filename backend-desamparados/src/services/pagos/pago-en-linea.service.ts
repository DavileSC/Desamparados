/**
 * El pago en línea del área de hermanos, de punta a punta: lo que se paga,
 * el viaje a la página del banco, el aviso del banco y lo que no cuadra.
 *
 * El dinero manda: si el banco avisa de que cobró, ese cobro queda apuntado
 * pase lo que pase. Si ya no se puede aplicar a lo que se pagaba (se pagó en
 * Secretaría mientras tanto, cambió el importe…), el pago queda como
 * INCIDENCIA para que Tesorería devuelva el dinero. Nunca se pierde en silencio.
 */
import { EstadoPago, EstadoPagoEnLinea, EstadoSolicitud, Prisma } from '@prisma/client';
import db from '../../config/db.js';
import { HttpError, NotFoundError } from '../../utils/error.handle.js';
import { pendienteDeLaSalida } from '../../domain/salidas.js';
import { configuracionRedsys, formularioDePago, leerAviso, modoDePago, numeroDePedido, type FormularioRedsys } from '../../domain/redsys.js';
import { urlDeLaWeb } from '../correos/plantilla.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from '../auditoria.service.js';
import { MisRecibosService } from '../mis-recibos.service.js';
import { PapeletasService } from '../procesion/papeletas.service.js';
import { ZonasService } from '../procesion/zonas.service.js';

export type MetodoEnLinea = 'TARJETA' | 'BIZUM';

export interface LoQueSePaga {
  reciboIds: number[];
  solicitudIds: number[];
}

/** Lo que devuelve empezar un pago: hecho ya (simulado) o el formulario para ir al banco. */
export type InicioDePago =
  | { tipo: 'hecho'; total: number; repetida: boolean }
  | ({ tipo: 'banco'; pedido: string } & FormularioRedsys);

const aCentimos = (importe: Prisma.Decimal | number) => Math.round(Number(importe) * 100);

/** La clave de la operación del cobro: la misma en cada aviso repetido del mismo pedido. */
const claveDelCobro = (pedido: string) => `redsys-${pedido}`;

export class PagoEnLineaService {
  /**
   * Comprueba que todo es de la familia y está pendiente, y calcula el total
   * aquí: el importe no lo dice nunca el navegador.
   */
  static async preparar(userId: number, pago: LoQueSePaga) {
    const reciboIds = [...new Set(pago.reciboIds)];
    const solicitudIds = [...new Set(pago.solicitudIds)];
    const [recibos, solicitudes, cuotaSalida] = await Promise.all([
      db.recibo.findMany({
        where: { id: { in: reciboIds }, hermano: { userId, activo: true } },
        select: { id: true, estado: true, hermanoId: true, concepto: true, importe: true },
      }),
      db.solicitud.findMany({
        where: { id: { in: solicitudIds }, hermano: { userId, activo: true } },
        select: { id: true, hermanoId: true, salida: true, estado: true, donativo: true, recibo: { select: { estado: true, concepto: true } } },
      }),
      PapeletasService.cuotaDeSalida(),
    ]);
    if (recibos.length !== reciboIds.length || solicitudes.length !== solicitudIds.length) throw new NotFoundError('Recibo no encontrado');
    const alguno = recibos[0]?.hermanoId ?? solicitudes[0]?.hermanoId;
    if (alguno === undefined) throw new HttpError('No hay nada que pagar.');

    const noPagable = recibos.find((r) => r.estado !== EstadoPago.PENDIENTE && r.estado !== EstadoPago.DEVUELTO);
    if (noPagable) throw new HttpError(`«${noPagable.concepto}» no está pendiente de pago.`, 409);
    let centimos = recibos.reduce((s, r) => s + aCentimos(r.importe), 0);
    for (const s of solicitudes) {
      if (s.estado !== EstadoSolicitud.PENDIENTE) throw new HttpError('Esa solicitud ya no está pendiente. Recarga la página.', 409);
      const pendiente = pendienteDeLaSalida({ salida: s.salida, donativo: s.donativo === null ? null : Number(s.donativo), recibo: s.recibo }, cuotaSalida);
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
      urlAviso: `${process.env.API_URL || 'http://localhost:3001'}/api/pagos/redsys/notificacion`,
      urlVuelta: urlDeLaWeb(`/area-hermano/procesion?pago=${pedido}`),
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
      await db.pagoEnLinea.updateMany({ where: { id: pago.id, estado: EstadoPagoEnLinea.PENDIENTE }, data: { estado: EstadoPagoEnLinea.RECHAZADO, ...banco } });
      return true;
    }

    const incidencia = async (motivo: string) => {
      // Si otro aviso del mismo pedido ya lo cobró, no es incidencia: es el repetido.
      if (await db.operacionMesa.findUnique({ where: { clave: claveDelCobro(aviso.pedido) }, select: { clave: true } })) {
        await db.pagoEnLinea.updateMany({ where: { id: pago.id, estado: EstadoPagoEnLinea.PENDIENTE }, data: { estado: EstadoPagoEnLinea.PAGADO, ...banco } });
        return;
      }
      await db.pagoEnLinea.updateMany({ where: { id: pago.id, estado: EstadoPagoEnLinea.PENDIENTE }, data: { estado: EstadoPagoEnLinea.INCIDENCIA, motivo, ...banco } });
      console.error(`[Pagos] Incidencia en el pedido ${aviso.pedido}: ${motivo}`);
      await AuditoriaService.log(ACCIONES_AUDITORIA.PAGO_EN_LINEA_INCIDENCIA, { ...meta, userId: pago.userId }, 'PagoEnLinea', pago.id, { pedido: aviso.pedido, motivo });
    };

    const esperado = aCentimos(pago.importe);
    if (aviso.centimos !== esperado) {
      await incidencia(`El banco cobró ${(aviso.centimos / 100).toFixed(2)} € y se esperaban ${(esperado / 100).toFixed(2)} €.`);
      return true;
    }
    const reciboIds = pago.reciboIds as number[];
    const solicitudIds = pago.solicitudIds as number[];
    try {
      const ahora = await this.preparar(pago.userId, { reciboIds, solicitudIds });
      if (ahora.centimos !== esperado) {
        await incidencia(`Mientras pagaba cambió lo que debía: ahora son ${(ahora.centimos / 100).toFixed(2)} €.`);
        return true;
      }
      await ZonasService.cobrar(
        { hermanoId: ahora.hermanoId, reciboIds, solicitudes: solicitudIds.map((solicitudId) => ({ solicitudId })), metodoPago: pago.metodo as MetodoEnLinea },
        claveDelCobro(aviso.pedido), { ...meta, userId: pago.userId }, ACCIONES_AUDITORIA.PAGO_EN_LINEA,
      );
      await db.pagoEnLinea.updateMany({ where: { id: pago.id, estado: EstadoPagoEnLinea.PENDIENTE }, data: { estado: EstadoPagoEnLinea.PAGADO, ...banco } });
    } catch (e) {
      // Lo que ya no se puede cobrar (pagado en Secretaría, solicitud anulada…) es incidencia; lo demás, un fallo de verdad.
      if (!(e instanceof HttpError)) throw e;
      await incidencia(`No se pudo aplicar el pago: ${e.message}`);
    }
    return true;
  }

  /** Cómo va un pago propio, para la vuelta del banco (el aviso puede llegar después). */
  static async estado(userId: number, pedido: string) {
    const pago = await db.pagoEnLinea.findFirst({ where: { pedido, userId }, select: { estado: true, importe: true } });
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
    const usuarios = await db.user.findMany({ where: { id: { in: filas.map((f) => f.userId) } }, select: { id: true, email: true } });
    const correo = new Map(usuarios.map((u) => [u.id, u.email]));
    return filas.map((f) => ({
      id: f.id, pedido: f.pedido, fecha: f.createdAt, importe: Number(f.importe), metodo: f.metodo,
      autorizacion: f.autorizacion, motivo: f.motivo, correo: correo.get(f.userId) ?? null,
    }));
  }

  /** Tesorería devolvió el dinero (o lo aplicó a mano): la incidencia deja de salir. */
  static async resolver(id: number, meta: MetaDeAuditoria) {
    const { count } = await db.pagoEnLinea.updateMany({
      where: { id, estado: EstadoPagoEnLinea.INCIDENCIA, resueltaEl: null },
      data: { resueltaEl: new Date(), resueltaPor: meta.userId ?? null },
    });
    if (count !== 1) throw new NotFoundError('Esa incidencia no existe o ya está resuelta.');
    await AuditoriaService.log(ACCIONES_AUDITORIA.PAGO_EN_LINEA_RESOLVER, meta, 'PagoEnLinea', id);
  }
}
