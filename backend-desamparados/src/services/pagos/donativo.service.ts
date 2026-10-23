/**
 * El donativo en línea desde la web pública: cualquiera, sin cuenta, desde el
 * bloque «Donativo» de una página, con tarjeta o Bizum.
 *
 * Lo que se ofrece lo decide el bloque (sus importes, sus destinos, su tope),
 * y el servidor lo vuelve a leer de la página al empezar: un destino que no
 * está en el bloque o un importe fuera de los límites no pasan aunque se
 * escriban a mano. Cobrado, el donativo entra en la contabilidad como un
 * ingreso de la categoría de donativos, una sola vez aunque el banco repita
 * el aviso.
 */
import { EstadoPagoEnLinea, Prisma, TipoPagoEnLinea, TipoRecibo, TipoTransaccion, type PagoEnLinea } from '@prisma/client';
import paginas from '../../../../shared/paginas-publicas.json' with { type: 'json' };
import topes from '../../../../shared/topes-contenido.json' with { type: 'json' };
import db from '../../config/db.js';
import { HttpError, NotFoundError } from '../../utils/error.handle.js';
import { esSlugContenido, moduloDePagina } from '../../domain/contenido.js';
import { ModulosService } from '../modulos.service.js';
import { configuracionRedsys, formularioDePago, modoDePago, numeroDePedido } from '../../domain/redsys.js';
import { ContenidoService } from '../contenido.service.js';
import { idCategoriaIngresos } from '../recibos/comunes.js';
import { unaVez } from '../procesion/una-vez.js';
import { urlDeLaWeb } from '../correos/plantilla.js';
import { EmailService } from '../email.service.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from '../auditoria.service.js';
import { claveDelCobro, urlDelAviso, type InicioDePago, type MetodoEnLinea } from './comunes.js';
import { euros } from '../../utils/euros.js';

export interface PeticionDeDonativo {
  /** El slug de la página desde la que se dona: su bloque dice qué se admite. */
  pagina: string;
  /** En euros, con hasta dos decimales. */
  importe: number;
  destino?: string;
  nombre?: string;
  email?: string;
  metodo: MetodoEnLinea;
  /** Si quiere el certificado para desgravar. */
  fiscal?: DatosFiscales | null;
}

export interface DatosFiscales { nif: string; nombre: string; apellidos: string; codigoPostal: string }

/** Lo que se guarda del donativo en el pago. */
export interface DatosDelDonativo {
  pagina: string;
  destino: string | null;
  nombre: string | null;
  email: string | null;
  /**
   * Para el certificado y el Modelo 182, si lo pidió. Los donativos de antes
   * de que existiera no lo llevan: se leen como sin certificado.
   */
  nif?: string | null;
  nombreFiscal?: string | null;
  apellidosFiscales?: string | null;
  codigoPostal?: string | null;
}

interface BloqueDonativo { tipo: 'donativo'; importes: number[]; destinos: string[] }

/** El primer bloque de donativo de un documento, esté donde esté (también dentro de otro bloque). */
export function bloqueDeDonativo(documento: unknown): BloqueDonativo | null {
  if (!documento || typeof documento !== 'object') return null;
  if (Array.isArray(documento)) {
    for (const x of documento) {
      const hallado = bloqueDeDonativo(x);
      if (hallado) return hallado;
    }
    return null;
  }
  const o = documento as Record<string, unknown>;
  if (o.tipo === 'donativo' && Array.isArray(o.importes) && Array.isArray(o.destinos)) return o as unknown as BloqueDonativo;
  return bloqueDeDonativo(Object.values(o));
}

/** La ruta pública de una página, para volver a ella desde el banco. */
const rutaDe = (slug: string) => paginas.paginas.find((p) => p.slug === slug)?.ruta ?? '/';

/** «Donativo en línea · Caridad · de María Pérez», para el apunte de la contabilidad. */
export function conceptoDelDonativo(d: DatosDelDonativo): string {
  return ['Donativo en línea', d.destino, d.nombre && `de ${d.nombre}`].filter(Boolean).join(' · ').slice(0, 150);
}

export class DonativoService {
  /** Comprueba el donativo contra el bloque de su página y lo deja listo para guardar. */
  static async comprobar(p: PeticionDeDonativo): Promise<{ centimos: number; datos: DatosDelDonativo }> {
    if (!esSlugContenido(p.pagina)) throw new NotFoundError('Esa página no existe.');
    // Una página de un módulo apagado no se sirve: tampoco recoge donativos.
    const modulo = moduloDePagina(p.pagina);
    if (modulo && !(await ModulosService.activo(modulo))) throw new NotFoundError('Esa página no existe.');
    const bloque = bloqueDeDonativo(await ContenidoService.leer(p.pagina));
    if (!bloque) throw new HttpError('Esta página ya no recoge donativos. Recárgala.', 409);

    const centimos = Math.round(p.importe * 100);
    if (Math.abs(p.importe * 100 - centimos) > 1e-6) throw new HttpError('El importe admite como mucho dos decimales.');
    if (centimos < topes.donativoMinimoEuros * 100 || centimos > topes.donativoMaximoEuros * 100) {
      throw new HttpError(`El donativo tiene que estar entre ${topes.donativoMinimoEuros} y ${topes.donativoMaximoEuros} €.`);
    }

    const nombre = p.nombre?.trim() || null;
    const email = p.email?.trim() || null;
    // El certificado se manda por correo: sin él, no hay certificado.
    if (p.fiscal && !email) throw new HttpError('Para el certificado de donación hace falta tu correo.');
    const fiscal = p.fiscal
      ? { nif: p.fiscal.nif, nombreFiscal: p.fiscal.nombre.trim(), apellidosFiscales: p.fiscal.apellidos.trim(), codigoPostal: p.fiscal.codigoPostal }
      : { nif: null, nombreFiscal: null, apellidosFiscales: null, codigoPostal: null };
    const destino = p.destino?.trim() || null;
    if (bloque.destinos.length > 0) {
      const elegido = bloque.destinos.find((d) => d.trim().toLocaleLowerCase('es-ES') === destino?.toLocaleLowerCase('es-ES'));
      if (!elegido) throw new HttpError('Elige a qué quieres destinar el donativo.');
      return { centimos, datos: { pagina: p.pagina, destino: elegido.trim(), nombre, email, ...fiscal } };
    }
    if (destino) throw new HttpError('Este donativo no lleva destino.');
    return { centimos, datos: { pagina: p.pagina, destino: null, nombre, email, ...fiscal } };
  }

  /**
   * Empieza un donativo. Con Redsys, se apunta pendiente y se devuelve el
   * formulario para ir al banco; simulado, se da por cobrado en el acto.
   */
  static async iniciar(p: PeticionDeDonativo, meta: MetaDeAuditoria): Promise<InicioDePago> {
    const modo = modoDePago();
    if (!modo) throw new HttpError('Los donativos en línea todavía no están disponibles.', 409);
    const config = modo === 'redsys' ? configuracionRedsys() : null;
    if (p.metodo === 'BIZUM' && !config?.bizum) throw new HttpError('El donativo con Bizum no está disponible. Hazlo con tarjeta.', 409);
    const { centimos, datos } = await this.comprobar(p);

    const pago = await db.$transaction(async (tx) => {
      const creado = await tx.pagoEnLinea.create({
        data: {
          tipo: TipoPagoEnLinea.DONATIVO, metodo: p.metodo, importe: new Prisma.Decimal(centimos).div(100),
          reciboIds: [], solicitudIds: [], donativo: { ...datos },
        },
      });
      return tx.pagoEnLinea.update({ where: { id: creado.id }, data: { pedido: numeroDePedido(creado.id) } });
    });
    const pedido = pago.pedido!;

    if (!config) {
      await this.aplicar(pago, {}, meta);
      return { tipo: 'hecho', total: centimos / 100, repetida: false };
    }
    const vuelta = `${rutaDe(datos.pagina)}?donativo=${pedido}`;
    const formulario = formularioDePago({
      pedido,
      centimos,
      metodo: p.metodo,
      descripcion: datos.destino ? `Donativo · ${datos.destino}` : 'Donativo',
      urlAviso: urlDelAviso(),
      urlVuelta: urlDeLaWeb(vuelta),
      urlFallo: urlDeLaWeb(`${vuelta}&resultado=no`),
    }, config);
    return { tipo: 'banco', pedido, ...formulario };
  }

  /**
   * Apunta el donativo cobrado en la contabilidad y le da las gracias al
   * donante si dejó su correo. Una sola vez por pedido aunque se repita.
   */
  static async aplicar(pago: PagoEnLinea, banco: { respuesta?: string; autorizacion?: string | null }, meta: MetaDeAuditoria) {
    const datos = pago.donativo as unknown as DatosDelDonativo;
    const categoriaId = await idCategoriaIngresos(TipoRecibo.DONATIVO);
    const { repetida } = await unaVez(claveDelCobro(pago.pedido!), 'donativo', async (tx) => {
      const apunte = await tx.transaccion.create({
        data: {
          tipo: TipoTransaccion.INGRESO, categoriaId, concepto: conceptoDelDonativo(datos),
          importe: pago.importe, fecha: new Date(), metodoPago: pago.metodo,
        },
      });
      // El pago guarda su apunte: así la contabilidad sabe que no es manual.
      await tx.pagoEnLinea.updateMany({ where: { id: pago.id, estado: EstadoPagoEnLinea.PENDIENTE }, data: { estado: EstadoPagoEnLinea.PAGADO, transaccionId: apunte.id, ...banco } });
      return { transaccionId: apunte.id };
    });
    if (repetida) return;
    await AuditoriaService.log(ACCIONES_AUDITORIA.PAGO_EN_LINEA, meta, 'PagoEnLinea', pago.id, { donativo: { importe: Number(pago.importe), destino: datos.destino } });
    if (datos.email) {
      EmailService.enviarGraciasDonativo(datos.email, datos.nombre, euros(Number(pago.importe)), datos.destino).catch(console.error);
    }
  }

  /** Cómo va un donativo, a la vuelta del banco. Solo el estado y el importe: nada de quién donó. */
  static async estado(pedido: string) {
    const pago = await db.pagoEnLinea.findFirst({ where: { pedido, tipo: TipoPagoEnLinea.DONATIVO }, select: { estado: true, importe: true } });
    if (!pago) throw new NotFoundError('No se encontró ese donativo.');
    return { estado: pago.estado, importe: Number(pago.importe) };
  }
}

