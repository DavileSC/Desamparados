/**
 * El Modelo 182 y los certificados de donación de un ejercicio.
 *
 * Qué se declara (art. 17 de la Ley 49/2002):
 *
 * - Los recibos pagados de **donativo** y, si Tesorería no lo apaga, de
 *   **cuota de hermano** (las cuotas de afiliación sin contraprestación
 *   también son donativo). Nunca lo pagado por una salida (papeleta o
 *   solicitud), aunque sea un donativo como el del Rosario: es el precio de
 *   un puesto, con contraprestación.
 * - Los **donativos en línea** y los **apadrinamientos** de quien pidió el
 *   certificado y dio su NIF. Los anónimos se cuentan, pero no se declaran.
 *
 * Los recibos de un menor sin DNI se atribuyen al titular de su cuenta, que
 * es quien paga; los de un menor de 14 años con DNI llevan el de su titular
 * como representante, como pide Hacienda.
 *
 * Los datos del declarante (el NIF del Grupo, quién firma) viven en la
 * `Configuracion` y se rellenan desde Tesorería: el NIF no va en el
 * repositorio ni se publica en la web.
 */
import { EstadoPago, EstadoPagoEnLinea, EstadoPedido, TipoPagoEnLinea, TipoRecibo, type Prisma } from '@prisma/client';
import db from '../config/db.js';
import { HttpError, NotFoundError } from '../utils/error.handle.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';
import { identidad, secretaria } from '../domain/datos-entidad.js';
import { deLaCorporacion } from '../domain/articulos.js';
import { aniosCumplidos, diaDe } from '../domain/fechas-hermano.js';
import { nifValido, normalizarNif } from '../domain/nif.js';
import {
  apellidosYNombre, declaradosDelEjercicio, ficheroModelo182, provinciaDelCodigoPostal,
  type Aportacion, type Declarado,
} from '../domain/modelo-182.js';
import type { DatosDelDonativo } from './pagos/donativo.service.js';
import { certificadosEnPdf } from './modelo-182-pdf.js';
import { enviarCorreo } from './correos/envio.js';
import { PlantillasCorreoService } from './plantillas-correo.service.js';

const eurosTexto = (c: number) => `${(c / 100).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** El correo del certificado, de su plantilla (Emails → «Certificado de donativos»). */
function correoDelCertificado(nombre: string, ejercicio: number, centimos: number) {
  return PlantillasCorreoService.correo('certificado_donativos', { campos: { nombre, ejercicio, importe: eurosTexto(centimos) } });
}

const CLAVE = 'modelo_182';

export interface ConfiguracionModelo182 {
  /** El NIF del Grupo. Null hasta que Tesorería lo ponga. */
  nif: string | null;
  /** Nueve cifras: el teléfono de quien responde a Hacienda. */
  telefono: string;
  /** Apellidos y nombre de esa persona. */
  contacto: string;
  /** Quién firma los certificados y con qué cargo. */
  firmanteNombre: string;
  firmanteCargo: string;
  /** Si las cuotas de hermano se declaran como donativo. */
  cuotas: boolean;
}

// Funciones y no constantes: los datos de Secretaría se cambian en el CMS, y
// leídos al cargar el módulo se quedaban con los del arranque.
const porDefecto = (): ConfiguracionModelo182 => ({
  nif: null,
  telefono: (secretaria.telefono ?? '').replace(/\D/g, '').slice(-9),
  contacto: '',
  firmanteNombre: '',
  firmanteCargo: 'Secretario',
  cuotas: true,
});

/** La provincia de la sede: la de quien no tiene código postal en su ficha. */
const provinciaDelGrupo = () => provinciaDelCodigoPostal(/\b(\d{5})\b/.exec(secretaria.direccion ?? '')?.[1] ?? null);

interface Excluido {
  nombre: string;
  centimos: number;
  motivo: string;
}

interface ResumenModelo182 {
  ejercicio: number;
  configuracion: ConfiguracionModelo182;
  declarados: (Omit<Declarado, 'aportaciones' | 'provincia'> & { provincia: string; provinciaSupuesta: boolean; aportaciones: Aportacion[] })[];
  total: number;
  excluidos: Excluido[];
  anonimos: { cuantos: number; centimos: number };
  /** Lo que falta para poder sacar el fichero. Vacío: se puede. */
  faltaParaElFichero: string[];
  /** Cuándo se mandaron por correo los certificados de este ejercicio, y a cuántos. */
  enviados: { el: string; cuantos: number } | null;
}

const claveEnviados = (ejercicio: number) => `modelo_182_enviados_${ejercicio}`;

const inicio = (anio: number) => new Date(Date.UTC(anio - 1, 11, 31)); // un día antes: el día se mira en hora de Madrid
const fin = (anio: number) => new Date(Date.UTC(anio + 1, 0, 2));
const centimosDe = (d: Prisma.Decimal | number) => Math.round(Number(d) * 100);

async function leerConfiguracion(): Promise<ConfiguracionModelo182> {
  const fila = await db.configuracion.findUnique({ where: { key: CLAVE } });
  if (!fila) return porDefecto();
  try { return { ...porDefecto(), ...(JSON.parse(fila.value) as Partial<ConfiguracionModelo182>) }; }
  catch { return porDefecto(); }
}

function faltaParaElFichero(c: ConfiguracionModelo182): string[] {
  const falta: string[] = [];
  if (!c.nif) falta.push(`el NIF ${deLaCorporacion({ corto: true })}`);
  if (!/^\d{9}$/.test(c.telefono)) falta.push('un teléfono de contacto de nueve cifras');
  if (!c.contacto.trim()) falta.push('la persona de contacto');
  return falta;
}

/**
 * De estos recibos, los que reemiten (directa o indirectamente) uno pagado
 * por una salida. La reemisión de Tesorería no lleva ni papeleta ni
 * solicitud, pero sigue siendo el precio de un puesto, no un donativo: hereda
 * el origen de lo que reemite y no entra en el 182.
 */
async function reemisionesDeUnaSalida(recibos: { id: number; reemisionDeId: number | null }[]): Promise<Set<number>> {
  const fuera = new Set<number>();
  // Cada reemisión, hacia atrás por su cadena hasta el recibo original.
  let pendientes = new Map(recibos.flatMap((r) => (r.reemisionDeId === null ? [] : [[r.id, r.reemisionDeId] as const])));
  for (let vuelta = 0; pendientes.size > 0 && vuelta < 20; vuelta += 1) {
    const anteriores = new Map((await db.recibo.findMany({
      where: { id: { in: [...new Set(pendientes.values())] } },
      select: { id: true, reemisionDeId: true, papeleta: { select: { id: true } }, solicitud: { select: { id: true } } },
    })).map((a) => [a.id, a]));
    const siguen = new Map<number, number>();
    for (const [id, anteriorId] of pendientes) {
      const anterior = anteriores.get(anteriorId);
      if (!anterior) continue;
      if (anterior.papeleta || anterior.solicitud) fuera.add(id);
      else if (anterior.reemisionDeId !== null) siguen.set(id, anterior.reemisionDeId);
    }
    pendientes = siguen;
  }
  return fuera;
}

/**
 * Las aportaciones con NIF de los cuatro últimos ejercicios hasta `ejercicio`
 * (los tres de antes sirven para saber si es recurrente), lo que no se puede
 * declarar y por qué, y los donativos anónimos.
 */
async function aportaciones(ejercicio: number, cuotas: boolean) {
  const desde = inicio(ejercicio - 3);
  const hasta = fin(ejercicio);
  const enRango = (dia: string) => {
    const a = Number(dia.slice(0, 4));
    return a >= ejercicio - 3 && a <= ejercicio;
  };
  const lista: Aportacion[] = [];
  const excluidos: Excluido[] = [];
  const anonimos = { cuantos: 0, centimos: 0 };

  // --- Recibos de los hermanos.
  const tipos: TipoRecibo[] = cuotas ? [TipoRecibo.DONATIVO, TipoRecibo.CUOTA_HERMANO] : [TipoRecibo.DONATIVO];
  const pagados = await db.recibo.findMany({
    where: { estado: EstadoPago.PAGADO, tipo: { in: tipos }, fechaPago: { gte: desde, lt: hasta }, papeleta: null, solicitud: null },
    select: {
      id: true, importe: true, fechaPago: true, concepto: true, reemisionDeId: true,
      hermano: { select: { id: true, nombre: true, apellidos: true, dni: true, fechaNacimiento: true, codigoPostal: true, email: true, userId: true, esTitular: true } },
    },
    orderBy: [{ fechaPago: 'asc' }, { id: 'asc' }],
  });
  const deSalida = await reemisionesDeUnaSalida(pagados);
  const recibos = pagados.filter((r) => !deSalida.has(r.id));
  const titulares = new Map((await db.hermano.findMany({
    where: { esTitular: true, userId: { in: [...new Set(recibos.map((r) => r.hermano.userId))] } },
    select: { id: true, userId: true, nombre: true, apellidos: true, dni: true, codigoPostal: true, email: true },
  })).map((t) => [t.userId, t]));

  for (const r of recibos) {
    const fecha = diaDe(r.fechaPago!);
    if (!enRango(fecha)) continue;
    const h = r.hermano;
    const titular = titulares.get(h.userId);
    const centimos = centimosDe(r.importe);
    const quien = `${h.nombre} ${h.apellidos}`;
    if (h.dni) {
      const menor14 = aniosCumplidos(h.fechaNacimiento, `${fecha.slice(0, 4)}-12-31`) < 14;
      const representante = menor14 && titular && titular.id !== h.id ? titular.dni : null;
      if (menor14 && !representante) {
        if (Number(fecha.slice(0, 4)) === ejercicio) excluidos.push({ nombre: quien, centimos, motivo: 'Menor de 14 años: falta el DNI del titular de su cuenta, que es su representante.' });
        continue;
      }
      lista.push({
        nif: h.dni, nifRepresentante: representante, apellidosYNombre: apellidosYNombre(h), nombre: quien,
        codigoPostal: h.codigoPostal, email: h.email ?? titular?.email ?? null, centimos, fecha, concepto: r.concepto, userId: h.userId,
      });
    } else if (titular?.dni && titular.id !== h.id) {
      // Sin DNI (un niño): lo pagó el titular de la cuenta, y a él se le declara.
      lista.push({
        nif: titular.dni, nifRepresentante: null, apellidosYNombre: apellidosYNombre(titular), nombre: `${titular.nombre} ${titular.apellidos}`,
        codigoPostal: titular.codigoPostal, email: titular.email, centimos, fecha, concepto: `${r.concepto} (de ${h.nombre})`, userId: h.userId,
      });
    } else if (Number(fecha.slice(0, 4)) === ejercicio) {
      excluidos.push({ nombre: quien, centimos, motivo: 'Sin DNI en la ficha.' });
    }
  }

  // --- Donativos en línea desde la web. Siempre, aunque su módulo esté apagado: apagar es ocultar, y lo cobrado se declara.
  // Por la fecha del cobro (su apunte en la contabilidad), no por cuándo se
  // empezó a pagar: uno empezado el 31-12 y cobrado el 1-1 es del año nuevo.
  // Solo si el apunte ya no está, la de inicio.
  const donativos = await db.pagoEnLinea.findMany({
    where: {
      tipo: TipoPagoEnLinea.DONATIVO, estado: EstadoPagoEnLinea.PAGADO,
      OR: [{ transaccion: { fecha: { gte: desde, lt: hasta } } }, { transaccionId: null, createdAt: { gte: desde, lt: hasta } }],
    },
    select: { id: true, importe: true, createdAt: true, donativo: true, transaccion: { select: { fecha: true } } },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  for (const p of donativos) {
    const fecha = diaDe(p.transaccion?.fecha ?? p.createdAt);
    if (!enRango(fecha)) continue;
    const d = p.donativo as unknown as DatosDelDonativo;
    if (!d?.nif || !d.nombreFiscal) {
      if (Number(fecha.slice(0, 4)) === ejercicio) { anonimos.cuantos += 1; anonimos.centimos += centimosDe(p.importe); }
      continue;
    }
    lista.push({
      nif: d.nif, nifRepresentante: null, apellidosYNombre: apellidosYNombre({ apellidos: d.apellidosFiscales ?? '', nombre: d.nombreFiscal }),
      nombre: [d.nombreFiscal, d.apellidosFiscales].filter(Boolean).join(' '),
      codigoPostal: d.codigoPostal ?? null, email: d.email, centimos: centimosDe(p.importe), fecha,
      concepto: ['Donativo en línea', d.destino].filter(Boolean).join(' · '),
    });
  }

  // --- Apadrinamientos: igual, siempre; una declaración fiscal no depende de qué pantallas se ven.
  const apadrinados = await db.apadrinamiento.findMany({
    where: { estado: { in: [EstadoPedido.PAGADO, EstadoPedido.ENTREGADO] }, pagadoEl: { gte: desde, lt: hasta } },
    select: { id: true, importe: true, pagadoEl: true, nombreFiscal: true, apellidosFiscales: true, nif: true, codigoPostal: true, email: true, pieza: { select: { nombre: true } } },
    orderBy: [{ pagadoEl: 'asc' }, { id: 'asc' }],
  });
  for (const a of apadrinados) {
    const fecha = diaDe(a.pagadoEl!);
    if (!enRango(fecha)) continue;
    if (!a.nif || !a.nombreFiscal) {
      if (Number(fecha.slice(0, 4)) === ejercicio) { anonimos.cuantos += 1; anonimos.centimos += centimosDe(a.importe); }
      continue;
    }
    lista.push({
      nif: a.nif, nifRepresentante: null, apellidosYNombre: apellidosYNombre({ apellidos: a.apellidosFiscales ?? '', nombre: a.nombreFiscal }),
      nombre: [a.nombreFiscal, a.apellidosFiscales].filter(Boolean).join(' '),
      codigoPostal: a.codigoPostal, email: a.email, centimos: centimosDe(a.importe), fecha, concepto: `Apadrinamiento: ${a.pieza.nombre}`,
    });
  }

  return { lista, excluidos, anonimos };
}

export class Modelo182Service {
  static configuracion = leerConfiguracion;

  static async guardarConfiguracion(c: ConfiguracionModelo182, meta: MetaDeAuditoria) {
    const nif = c.nif ? normalizarNif(c.nif) : null;
    if (nif && !nifValido(nif)) throw new HttpError(`El NIF ${deLaCorporacion({ corto: true })} no es válido: revisa la letra o la cifra de control.`);
    const limpia: ConfiguracionModelo182 = {
      nif,
      telefono: c.telefono.replace(/\D/g, ''),
      contacto: c.contacto.trim(),
      firmanteNombre: c.firmanteNombre.trim(),
      firmanteCargo: c.firmanteCargo.trim() || porDefecto().firmanteCargo,
      cuotas: c.cuotas,
    };
    const antes = await leerConfiguracion();
    await db.configuracion.upsert({
      where: { key: CLAVE },
      update: { value: JSON.stringify(limpia) },
      create: { key: CLAVE, value: JSON.stringify(limpia), descripcion: 'Datos del declarante del Modelo 182 y de quien firma los certificados de donación' },
    });
    // El NIF del Grupo no es un dato personal, pero tampoco se publica: en la auditoría, solo si cambió.
    await AuditoriaService.log(ACCIONES_AUDITORIA.CONFIG_UPDATE, meta, 'configuracion', CLAVE, {
      antes: { ...antes, nif: antes.nif ? 'puesto' : null },
      despues: { ...limpia, nif: limpia.nif ? (limpia.nif === antes.nif ? 'puesto' : 'cambiado') : null },
    });
    return limpia;
  }

  static async resumen(ejercicio: number): Promise<ResumenModelo182> {
    const configuracion = await leerConfiguracion();
    const { lista, excluidos, anonimos } = await aportaciones(ejercicio, configuracion.cuotas);
    const declarados = declaradosDelEjercicio(lista, ejercicio).map((d) => ({
      ...d,
      provincia: d.provincia ?? provinciaDelGrupo() ?? '99',
      provinciaSupuesta: d.provincia === null,
    }));
    const enviados = await db.configuracion.findUnique({ where: { key: claveEnviados(ejercicio) } });
    return {
      ejercicio,
      configuracion,
      declarados,
      total: declarados.reduce((s, d) => s + d.centimos, 0),
      excluidos,
      anonimos,
      faltaParaElFichero: faltaParaElFichero(configuracion),
      enviados: enviados ? JSON.parse(enviados.value) as { el: string; cuantos: number } : null,
    };
  }

  /** El fichero para la Sede de Hacienda, en ISO-8859-1 (el juego de caracteres que espera). */
  static async fichero(ejercicio: number, justificante: string, meta: MetaDeAuditoria) {
    const r = await Modelo182Service.resumen(ejercicio);
    if (r.faltaParaElFichero.length > 0) throw new HttpError(`Para sacar el fichero falta ${r.faltaParaElFichero.join(', ')}.`, 409);
    if (r.declarados.length === 0) throw new HttpError(`No hay donativos con NIF en ${ejercicio}: no hay nada que declarar.`, 409);
    const texto = ficheroModelo182({
      nif: r.configuracion.nif!, denominacion: identidad.nombre, telefono: r.configuracion.telefono,
      contacto: r.configuracion.contacto, justificante,
    }, ejercicio, r.declarados);
    await AuditoriaService.log(ACCIONES_AUDITORIA.MODELO_182_FICHERO, meta, 'modelo182', ejercicio, {
      despues: { ejercicio, declarados: r.declarados.length, total: r.total / 100, justificante },
    });
    return { nombre: `modelo182-${ejercicio}.txt`, contenido: Buffer.from(texto, 'latin1') };
  }

  /** Los certificados en un PDF: todos los del ejercicio o solo los de unos NIF. */
  static async certificados(ejercicio: number, nifs?: string[]): Promise<Buffer> {
    const r = await Modelo182Service.resumen(ejercicio);
    if (!r.configuracion.nif) throw new HttpError(`Falta el NIF ${deLaCorporacion({ corto: true })} (Tesorería → Modelo 182 → Datos ${deLaCorporacion({ corto: true })}).`, 409);
    const elegidos = nifs ? r.declarados.filter((d) => nifs.includes(d.nif)) : r.declarados;
    if (elegidos.length === 0) throw new NotFoundError('No hay donativos con ese NIF en el ejercicio.');
    return certificadosEnPdf(r.configuracion, ejercicio, elegidos);
  }

  /**
   * Manda a cada donante con correo su certificado en PDF. Se apunta cuándo y
   * a cuántos, para que Tesorería vea que ya salieron y no los mande dos veces
   * sin querer (puede, si corrige algo: el aviso solo lo dice).
   */
  static async enviarCertificados(ejercicio: number, meta: MetaDeAuditoria) {
    const r = await Modelo182Service.resumen(ejercicio);
    if (!r.configuracion.nif) throw new HttpError(`Falta el NIF ${deLaCorporacion({ corto: true })} (Tesorería → Modelo 182 → Datos ${deLaCorporacion({ corto: true })}).`, 409);
    const conCorreo = r.declarados.filter((d) => d.email);
    if (conCorreo.length === 0) throw new HttpError('Ningún donante de este año tiene correo: los certificados se descargan y se entregan a mano.', 409);
    let enviados = 0;
    for (const d of conCorreo) {
      const pdf = await certificadosEnPdf(r.configuracion, ejercicio, [d]);
      const correo = await correoDelCertificado(d.nombre, ejercicio, d.centimos);
      const ok = await enviarCorreo(d.email!, correo.asunto, correo.html, {
        uso: correo.uso, adjuntos: [{ filename: `certificado-donativos-${ejercicio}.pdf`, content: pdf, contentType: 'application/pdf' }],
      });
      if (ok) enviados += 1;
    }
    const valor = JSON.stringify({ el: new Date().toISOString(), cuantos: enviados });
    await db.configuracion.upsert({
      where: { key: claveEnviados(ejercicio) },
      update: { value: valor },
      create: { key: claveEnviados(ejercicio), value: valor, descripcion: `Cuándo se mandaron los certificados de donativos de ${ejercicio}` },
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.MODELO_182_ENVIAR, meta, 'modelo182', ejercicio, { despues: { ejercicio, conCorreo: conCorreo.length, enviados } });
    return {
      enviados, fallidos: conCorreo.length - enviados, sinCorreo: r.declarados.length - conCorreo.length,
      message: `Certificados enviados: ${enviados} de ${conCorreo.length}.${r.declarados.length > conCorreo.length ? ` ${r.declarados.length - conCorreo.length} sin correo: se descargan y se entregan a mano.` : ''}`,
    };
  }

  /**
   * Los NIF que el hermano puede ver desde su área: el suyo y los de las fichas
   * de su cuenta (sus hijos con DNI), solo de fichas activas. Una ficha
   * pendiente la crea el propio hermano con el DNI que quiera: con ella
   * bastaba escribir el DNI de un donante que no es hermano para ver lo que
   * había donado (y donar dice de las creencias de alguien, art. 9 RGPD).
   */
  static async nifsDeLaCuenta(userId: number): Promise<string[]> {
    const fichas = await db.hermano.findMany({ where: { userId, activo: true, dni: { not: null } }, select: { dni: true } });
    return fichas.map((f) => f.dni!);
  }

  /**
   * De la lista de un ejercicio, los NIF de la cuenta cuyas aportaciones son
   * todas suyas: recibos de sus fichas o pagos en línea hechos con uno de sus
   * correos. Si con ese NIF hay algo pagado por otra persona, el certificado
   * (que lo suma todo) no se enseña aquí: lo manda Tesorería por correo.
   */
  private static async nifsVisibles(userId: number, lista: Aportacion[]): Promise<Set<string>> {
    const nifs = await Modelo182Service.nifsDeLaCuenta(userId);
    if (nifs.length === 0) return new Set();
    const cuenta = await db.user.findUnique({ where: { id: userId }, select: { email: true, hermanos: { select: { email: true } } } });
    const correos = new Set([cuenta?.email, ...(cuenta?.hermanos.map((h) => h.email) ?? [])].filter((e): e is string => !!e).map((e) => e.trim().toLowerCase()));
    const esSuya = (a: Aportacion) => a.userId === userId || (a.userId === undefined && !!a.email && correos.has(a.email.trim().toLowerCase()));
    return new Set(nifs.filter((nif) => lista.every((a) => a.nif !== nif || esSuya(a))));
  }

  /** Los certificados que tiene el hermano: por ejercicio cerrado de los cuatro últimos, lo que suma cada NIF. */
  static async misCertificados(userId: number, hoy = new Date()) {
    const configuracion = await leerConfiguracion();
    const actual = Number(diaDe(hoy).slice(0, 4));
    const salida: { ejercicio: number; nif: string; nombre: string; centimos: number }[] = [];
    for (let ejercicio = actual - 1; ejercicio >= actual - 4; ejercicio--) {
      const { lista } = await aportaciones(ejercicio, configuracion.cuotas);
      const nifs = await Modelo182Service.nifsVisibles(userId, lista);
      for (const d of declaradosDelEjercicio(lista.filter((a) => nifs.has(a.nif)), ejercicio)) {
        salida.push({ ejercicio, nif: d.nif, nombre: d.nombre, centimos: d.centimos });
      }
    }
    return { disponibles: Boolean(configuracion.nif), certificados: salida };
  }

  static async miCertificado(userId: number, ejercicio: number, nif: string, hoy = new Date()) {
    if (ejercicio >= Number(diaDe(hoy).slice(0, 4))) throw new HttpError('El certificado se saca cuando acaba el año.', 409);
    const { lista } = await aportaciones(ejercicio, (await leerConfiguracion()).cuotas);
    // Solo los NIF de su cuenta y con todo pagado por ella: el de otro no existe para él.
    if (!(await Modelo182Service.nifsVisibles(userId, lista)).has(nif)) throw new NotFoundError('No hay donativos con ese NIF en el ejercicio.');
    return Modelo182Service.certificados(ejercicio, [nif]);
  }
}

