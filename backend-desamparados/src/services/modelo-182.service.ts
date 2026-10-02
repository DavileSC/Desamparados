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

const POR_DEFECTO: ConfiguracionModelo182 = {
  nif: null,
  telefono: (secretaria.telefono ?? '').replace(/\D/g, '').slice(-9),
  contacto: '',
  firmanteNombre: '',
  firmanteCargo: 'Secretario',
  cuotas: true,
};

/** La provincia de la sede: la de quien no tiene código postal en su ficha. */
const PROVINCIA_DEL_GRUPO = provinciaDelCodigoPostal(/\b(\d{5})\b/.exec(secretaria.direccion ?? '')?.[1] ?? null);

export interface Excluido {
  nombre: string;
  centimos: number;
  motivo: string;
}

export interface ResumenModelo182 {
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
  if (!fila) return { ...POR_DEFECTO };
  try { return { ...POR_DEFECTO, ...(JSON.parse(fila.value) as Partial<ConfiguracionModelo182>) }; }
  catch { return { ...POR_DEFECTO }; }
}

function faltaParaElFichero(c: ConfiguracionModelo182): string[] {
  const falta: string[] = [];
  if (!c.nif) falta.push(`el NIF ${deLaCorporacion({ corto: true })}`);
  if (!/^\d{9}$/.test(c.telefono)) falta.push('un teléfono de contacto de nueve cifras');
  if (!c.contacto.trim()) falta.push('la persona de contacto');
  return falta;
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
  const recibos = await db.recibo.findMany({
    where: { estado: EstadoPago.PAGADO, tipo: { in: tipos }, fechaPago: { gte: desde, lt: hasta }, papeleta: null, solicitud: null },
    select: {
      id: true, importe: true, fechaPago: true, concepto: true,
      hermano: { select: { id: true, nombre: true, apellidos: true, dni: true, fechaNacimiento: true, codigoPostal: true, email: true, userId: true, esTitular: true } },
    },
    orderBy: [{ fechaPago: 'asc' }, { id: 'asc' }],
  });
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
        codigoPostal: h.codigoPostal, email: h.email ?? titular?.email ?? null, centimos, fecha, concepto: r.concepto,
      });
    } else if (titular?.dni && titular.id !== h.id) {
      // Sin DNI (un niño): lo pagó el titular de la cuenta, y a él se le declara.
      lista.push({
        nif: titular.dni, nifRepresentante: null, apellidosYNombre: apellidosYNombre(titular), nombre: `${titular.nombre} ${titular.apellidos}`,
        codigoPostal: titular.codigoPostal, email: titular.email, centimos, fecha, concepto: `${r.concepto} (de ${h.nombre})`,
      });
    } else if (Number(fecha.slice(0, 4)) === ejercicio) {
      excluidos.push({ nombre: quien, centimos, motivo: 'Sin DNI en la ficha.' });
    }
  }

  // --- Donativos en línea desde la web. Siempre, aunque su módulo esté apagado: apagar es ocultar, y lo cobrado se declara.
  const donativos = await db.pagoEnLinea.findMany({
    where: { tipo: TipoPagoEnLinea.DONATIVO, estado: EstadoPagoEnLinea.PAGADO, createdAt: { gte: desde, lt: hasta } },
    select: { id: true, importe: true, createdAt: true, donativo: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  for (const p of donativos) {
    const fecha = diaDe(p.createdAt);
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
      firmanteCargo: c.firmanteCargo.trim() || POR_DEFECTO.firmanteCargo,
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
      provincia: d.provincia ?? PROVINCIA_DEL_GRUPO ?? '99',
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
      const ok = await enviarCorreo(d.email!, correo.asunto, correo.html, undefined, null,
        [{ filename: `certificado-donativos-${ejercicio}.pdf`, content: pdf, contentType: 'application/pdf' }]);
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
   * de su cuenta (sus hijos con DNI). Los recibos de un niño sin DNI ya van a
   * nombre del titular.
   */
  static async nifsDeLaCuenta(userId: number): Promise<string[]> {
    const fichas = await db.hermano.findMany({ where: { userId, dni: { not: null } }, select: { dni: true } });
    return fichas.map((f) => f.dni!);
  }

  /** Los certificados que tiene el hermano: por ejercicio cerrado de los cuatro últimos, lo que suma cada NIF. */
  static async misCertificados(userId: number, hoy = new Date()) {
    const nifs = await Modelo182Service.nifsDeLaCuenta(userId);
    const configuracion = await leerConfiguracion();
    const actual = Number(diaDe(hoy).slice(0, 4));
    const salida: { ejercicio: number; nif: string; nombre: string; centimos: number }[] = [];
    for (let ejercicio = actual - 1; ejercicio >= actual - 4; ejercicio--) {
      const { lista } = await aportaciones(ejercicio, configuracion.cuotas);
      for (const d of declaradosDelEjercicio(lista.filter((a) => nifs.includes(a.nif)), ejercicio)) {
        salida.push({ ejercicio, nif: d.nif, nombre: d.nombre, centimos: d.centimos });
      }
    }
    return { disponibles: Boolean(configuracion.nif), certificados: salida };
  }

  static async miCertificado(userId: number, ejercicio: number, nif: string, hoy = new Date()) {
    if (ejercicio >= Number(diaDe(hoy).slice(0, 4))) throw new HttpError('El certificado se saca cuando acaba el año.', 409);
    const nifs = await Modelo182Service.nifsDeLaCuenta(userId);
    // Solo los NIF de su cuenta: el de otro no existe para él.
    if (!nifs.includes(nif)) throw new NotFoundError('No hay donativos con ese NIF en el ejercicio.');
    return Modelo182Service.certificados(ejercicio, [nif]);
  }
}

