/**
 * Apadrinar sobre una foto: cada campaña es una foto (el trono, el manto, la
 * candelería) con sus piezas marcadas encima, y cada pieza la costea quien
 * quiera, sin cuenta y pagando por la pasarela de siempre, como la tienda.
 *
 * Una pieza se apadrina una vez. Queda apadrinada con el aviso firmado del
 * banco (o en el acto, con el pago simulado); si mientras tanto la apadrinó
 * otro, el pago queda como incidencia para devolverlo. El nombre de quien
 * apadrina solo sale en la foto si lo pidió.
 */
import crypto from 'node:crypto';
import { EstadoPedido, MetodoPago, OrigenPago, Prisma, TipoTransaccion } from '@prisma/client';
import db from '../config/db';
import { HttpError, NotFoundError } from '../utils/error.handle';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service.js';
import { PagoEnLineaService, intentosVigentesDesde, registrarOrigenDePago, type MetodoEnLinea } from './pagos/pago-en-linea.service.js';
import { idCategoriaDeRecibos } from './recibos/comunes.js';
import { transactionWithRetry } from '../utils/transaction-retry.js';
import { enviarCorreo } from './correos/envio.js';
import { PlantillasCorreoService } from './plantillas-correo.service.js';
import { datos, esc, firma, maquetar, parrafo, urlDeLaWeb } from './correos/plantilla.js';
import { modoDePago, pagoParaLaWeb } from '../domain/redsys.js';
import { aCentimos } from '../domain/sepa.js';
import type { DatosFiscales } from './pagos/donativo.service.js';
import { eurosDeCentimos } from '../utils/euros.js';

const CATEGORIA_APADRINAMIENTOS = 'Apadrinamientos';
const PAGADOS = [EstadoPedido.PAGADO, EstadoPedido.ENTREGADO];

export interface DatosCampana { titulo: string; descripcion: string; foto: string; activa: boolean }
export interface DatosPieza { nombre: string; precio: number; x: number; y: number }
export interface DatosApadrinar {
  piezaId: number; nombre: string; email: string; telefono: string; dedicatoria: string | null; mostrarNombre: boolean; metodo: MetodoEnLinea;
  /** Si quiere el certificado de donación para desgravar. */
  fiscal?: DatosFiscales | null;
}


/** La campaña con sus piezas y, de cada una, si está apadrinada y por quién (si lo quiso decir). */
async function campanaCompleta(id: number, conDatosPrivados: boolean) {
  const c = await db.campanaApadrinamiento.findUnique({
    where: { id },
    include: { piezas: { orderBy: { id: 'asc' }, include: { apadrinamientos: { where: { estado: { in: PAGADOS } }, orderBy: { id: 'asc' }, take: 1 } } } },
  });
  if (!c) throw new NotFoundError('Campaña no encontrada.');
  return {
    id: c.id, titulo: c.titulo, descripcion: c.descripcion, foto: c.foto, activa: c.activa,
    piezas: c.piezas.map((p) => {
      const a = p.apadrinamientos[0];
      return {
        id: p.id, nombre: p.nombre, precio: Number(p.precio), x: Number(p.x), y: Number(p.y),
        apadrinada: Boolean(a),
        padrino: a && (a.mostrarNombre || conDatosPrivados) ? a.nombre : null,
        dedicatoria: a && (a.mostrarNombre || conDatosPrivados) ? a.dedicatoria : null,
        ...(conDatosPrivados && a ? { contacto: { email: a.email, telefono: a.telefono, pagadoEl: a.pagadoEl, mostrarNombre: a.mostrarNombre } } : {}),
      };
    }),
  };
}

/** El correo de las gracias, de su plantilla (Emails → «Gracias por apadrinar»). */
function correoDeApadrinamiento(a: { nombre: string; importe: Prisma.Decimal; dedicatoria: string | null; nif: string | null; pieza: { nombre: string; campana: { titulo: string } } }) {
  return PlantillasCorreoService.correo('apadrinamiento', {
    campos: { nombre: a.nombre, pieza: a.pieza.nombre, campana: a.pieza.campana.titulo },
    bloques: {
      datos: datos([
        ['Pieza', esc(a.pieza.nombre)],
        ['Donativo', esc(eurosDeCentimos(aCentimos(a.importe)))],
        ...(a.dedicatoria ? [['Dedicatoria', esc(a.dedicatoria)] as [string, string]] : []),
      ]),
      certificado: parrafo(a.nif
        ? 'Como pediste, te mandaremos el certificado para la renta cuando acabe el año.'
        : 'Si necesitas el certificado del donativo para la declaración de la renta, pídelo en Secretaría respondiendo a este correo.'),
    },
  });
}

async function aplicarPago(apadrinamientoId: number, metodo: MetodoEnLinea, meta: MetaDeAuditoria, alAplicar?: (tx: Prisma.TransactionClient) => Promise<void>) {
  const categoriaId = await idCategoriaDeRecibos(TipoTransaccion.INGRESO, CATEGORIA_APADRINAMIENTOS);
  // Con reintento: dos padrinos de la misma pieza acaban en interbloqueo
  // (1213), y el que pierde tiene que llegar a «la apadrinó otra persona»
  // (incidencia) en vez de quedarse pendiente sin rastro.
  const hecho = await transactionWithRetry(async (tx) => {
    const a = await tx.apadrinamiento.findUnique({ where: { id: apadrinamientoId }, include: { pieza: { include: { campana: true } } } });
    if (!a) throw new HttpError('El apadrinamiento ya no existe.');
    if (a.estado !== EstadoPedido.PENDIENTE_PAGO) throw new HttpError('El apadrinamiento ya no estaba pendiente de pago.');
    const otro = await tx.apadrinamiento.findFirst({ where: { piezaId: a.piezaId, estado: { in: PAGADOS } }, select: { id: true } });
    if (otro) throw new HttpError(`«${a.pieza.nombre}» la apadrinó otra persona mientras se pagaba.`);
    const apunte = await tx.transaccion.create({
      data: {
        tipo: TipoTransaccion.INGRESO, categoriaId, concepto: `Apadrinamiento: ${a.pieza.nombre} (${a.pieza.campana.titulo})`.slice(0, 190),
        importe: a.importe, fecha: new Date(), metodoPago: metodo as MetodoPago,
      },
    });
    // Guarda su apunte: así la contabilidad sabe que no es manual.
    // El aviso del banco cierra aquí su pago: lo aplicado y el pago, a la vez.
    await alAplicar?.(tx);
    return tx.apadrinamiento.update({
      where: { id: apadrinamientoId },
      data: { estado: EstadoPedido.PAGADO, metodo: metodo as MetodoPago, pagadoEl: new Date(), transaccionId: apunte.id },
      include: { pieza: { include: { campana: true } } },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await AuditoriaService.log(ACCIONES_AUDITORIA.APADRINAMIENTO_PAGADO, meta, 'apadrinamiento', apadrinamientoId, { despues: { piezaId: hecho.piezaId, importe: hecho.importe.toString() } });
  void correoDeApadrinamiento(hecho).then(({ asunto, html, uso }) => enviarCorreo(hecho.email, asunto, html, { uso })).catch(console.error);
}

registrarOrigenDePago(OrigenPago.APADRINAMIENTO, {
  aplicar: aplicarPago,
  correo: async (id) => (await db.apadrinamiento.findUnique({ where: { id }, select: { email: true } }))?.email ?? null,
  cancelar: async (id) => { await db.apadrinamiento.updateMany({ where: { id, estado: EstadoPedido.PENDIENTE_PAGO }, data: { estado: EstadoPedido.CANCELADO } }); },
});

export class ApadrinamientosService {
  /** Las campañas activas, para la web pública, con cuántas piezas quedan libres. */
  static async campanasPublicas() {
    const lista = await db.campanaApadrinamiento.findMany({ where: { activa: true }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } });
    const campanas = await Promise.all(lista.map(({ id }) => campanaCompleta(id, false)));
    return {
      pagoDisponible: modoDePago() !== null,
      metodos: modoDePago() === 'redsys' ? pagoParaLaWeb()?.metodos ?? ['TARJETA'] : ['TARJETA'],
      campanas: campanas.map((c) => ({ ...c, libres: c.piezas.filter((p) => !p.apadrinada).length })),
    };
  }

  /** Apadrinar una pieza libre: se apunta y se va al banco (o se paga en el acto, simulado). */
  static async apadrinar(d: DatosApadrinar, meta: MetaDeAuditoria) {
    const modo = modoDePago();
    if (!modo) throw new HttpError('Todavía no se puede apadrinar en línea. Pregunta en Secretaría.', 409);
    const pieza = await db.piezaApadrinable.findUnique({
      where: { id: d.piezaId },
      include: { campana: true, apadrinamientos: { where: { estado: { in: PAGADOS } }, select: { id: true }, take: 1 } },
    });
    if (!pieza || !pieza.campana.activa) throw new NotFoundError('Esa pieza ya no se puede apadrinar.');
    if (pieza.apadrinamientos.length > 0) throw new HttpError(`«${pieza.nombre}» ya está apadrinada. Elige otra.`, 409);

    const a = await db.apadrinamiento.create({
      data: {
        token: crypto.randomBytes(16).toString('hex'), piezaId: pieza.id,
        nombre: d.nombre.trim(), email: d.email.trim().toLowerCase(), telefono: d.telefono.trim(),
        dedicatoria: d.dedicatoria?.trim() || null, mostrarNombre: d.mostrarNombre, importe: pieza.precio,
        nif: d.fiscal?.nif ?? null, nombreFiscal: d.fiscal?.nombre.trim() ?? null, apellidosFiscales: d.fiscal?.apellidos.trim() ?? null,
        codigoPostal: d.fiscal?.codigoPostal ?? null,
      },
    });
    if (modo === 'simulado') {
      await aplicarPago(a.id, d.metodo, meta);
      return { tipo: 'hecho' as const, token: a.token };
    }
    const banco = await PagoEnLineaService.iniciarSinCuenta({
      origen: OrigenPago.APADRINAMIENTO, referenciaId: a.id, centimos: aCentimos(pieza.precio), metodo: d.metodo,
      descripcion: `Apadrinamiento: ${pieza.nombre}`.slice(0, 120),
      urlVuelta: urlDeLaWeb(`/apadrina/gracias/${a.token}`),
      urlFallo: urlDeLaWeb(`/apadrina/gracias/${a.token}?resultado=no`),
    });
    return { ...banco, token: a.token };
  }

  /** Cómo va un apadrinamiento, para quien lo hizo (con su enlace). */
  static async apadrinamientoPublico(token: string) {
    const a = await db.apadrinamiento.findUnique({ where: { token }, include: { pieza: { include: { campana: true } } } });
    if (!a) throw new NotFoundError('No se encuentra ese apadrinamiento.');
    return { estado: a.estado, nombre: a.nombre, pieza: a.pieza.nombre, campana: a.pieza.campana.titulo, campanaId: a.pieza.campanaId, importe: Number(a.importe) };
  }

  // --- La gestión, desde el CMS ---

  static async campanas() {
    const lista = await db.campanaApadrinamiento.findMany({ orderBy: [{ activa: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }], select: { id: true } });
    const campanas = await Promise.all(lista.map(({ id }) => campanaCompleta(id, true)));
    // Lo cobrado, como en Contabilidad, y no el precio actual de cada pieza:
    // si cambió con un pago en curso, las dos cifras no casaban.
    const cobrado = await Promise.all(lista.map(({ id }) => db.apadrinamiento.aggregate({
      where: { estado: { in: PAGADOS }, pieza: { campanaId: id } }, _sum: { importe: true },
    })));
    return campanas.map((c, i) => ({
      id: c.id, titulo: c.titulo, foto: c.foto, activa: c.activa, piezas: c.piezas.length,
      apadrinadas: c.piezas.filter((p) => p.apadrinada).length,
      recaudado: Number(cobrado[i]._sum.importe ?? 0),
    }));
  }

  static campana(id: number) {
    return campanaCompleta(id, true);
  }

  static async crearCampana(d: DatosCampana) {
    const c = await db.campanaApadrinamiento.create({ data: { ...d, titulo: d.titulo.trim(), descripcion: d.descripcion.trim() } });
    return campanaCompleta(c.id, true);
  }

  static async actualizarCampana(id: number, d: DatosCampana) {
    await db.campanaApadrinamiento.update({ where: { id }, data: { ...d, titulo: d.titulo.trim(), descripcion: d.descripcion.trim() } }).catch(() => { throw new NotFoundError('Campaña no encontrada.'); });
    return campanaCompleta(id, true);
  }

  static async ponerPieza(campanaId: number, d: DatosPieza) {
    await db.piezaApadrinable.create({ data: { campanaId, nombre: d.nombre.trim(), precio: new Prisma.Decimal(d.precio), x: new Prisma.Decimal(d.x), y: new Prisma.Decimal(d.y) } });
    return campanaCompleta(campanaId, true);
  }

  static async cambiarPieza(campanaId: number, piezaId: number, d: DatosPieza) {
    const pagada = await db.apadrinamiento.count({ where: { piezaId, estado: { in: PAGADOS } } });
    const pieza = await db.piezaApadrinable.findFirst({ where: { id: piezaId, campanaId } });
    if (!pieza) throw new NotFoundError('Pieza no encontrada.');
    // Apadrinada, se puede mover o renombrar, pero no cambiar lo que se pagó.
    if (pagada > 0 && Number(pieza.precio) !== d.precio) throw new HttpError('Esa pieza ya está apadrinada: su precio no se cambia.', 409);
    await db.piezaApadrinable.update({ where: { id: piezaId }, data: { nombre: d.nombre.trim(), precio: new Prisma.Decimal(d.precio), x: new Prisma.Decimal(d.x), y: new Prisma.Decimal(d.y) } });
    return campanaCompleta(campanaId, true);
  }

  /**
   * Solo una pieza sin apadrinar y sin nadie en el banco con ella. Se mira y
   * se borra en la misma transacción, serializable como el cobro: fuera, un
   * pago que llegara entre medias se perdía con la pieza. Los intentos que el
   * banco no cobró (CANCELADO) y los caducados (`intentosVigentesDesde`) no
   * son de nadie y se van con ella.
   */
  static async quitarPieza(campanaId: number, piezaId: number) {
    await transactionWithRetry(async (tx) => {
      const vivos = await tx.apadrinamiento.count({
        where: { piezaId, estado: { not: EstadoPedido.CANCELADO }, NOT: { estado: EstadoPedido.PENDIENTE_PAGO, createdAt: { lt: intentosVigentesDesde() } } },
      });
      if (vivos > 0) throw new HttpError('Esa pieza ya está apadrinada, o alguien la está pagando ahora: no se quita.', 409);
      if (!(await tx.piezaApadrinable.findFirst({ where: { id: piezaId, campanaId }, select: { id: true } }))) return;
      await tx.apadrinamiento.deleteMany({ where: { piezaId } });
      await tx.piezaApadrinable.delete({ where: { id: piezaId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return campanaCompleta(campanaId, true);
  }
}
