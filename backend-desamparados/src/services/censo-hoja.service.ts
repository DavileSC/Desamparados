/**
 * El censo en Excel o CSV: exportarlo (para la Junta, para una copia fuera del
 * programa) e importarlo (el censo de siempre de una corporación que empieza a
 * usar el programa).
 *
 * Importar es de dos pasos, como el extracto del banco: la vista previa dice
 * qué filas entran y por qué no entran las otras, sin tocar nada, y «importar»
 * vuelve a leer el mismo fichero y crea las fichas. Una persona que ya está en
 * el censo (por DNI o, sin él, por nombre, apellidos y nacimiento) no se
 * vuelve a crear: importar dos veces el mismo fichero no duplica a nadie.
 *
 * Las cuentas: quien trae DNI y un correo libre recibe su propia cuenta, sin
 * contraseña: entra por la invitación del primer acceso, que le pide revisar
 * su ficha. Quien comparte ese correo (los hijos que el censo apuntaba con el
 * correo de su padre o su madre) cuelga de esa cuenta, y su titular revisa
 * también sus fichas. El resto (sin correo, o con el de alguien que no está
 * en el censo) queda bajo una cuenta de custodia que nadie usa para entrar;
 * Secretaría le da cuenta propia con «emancipar» cuando la pida.
 */
import crypto from 'node:crypto';
import ExcelJS from 'exceljs';
import { MetodoPago, Prisma, Role } from '@prisma/client';
import db from '../config/db';
import { HttpError } from '../utils/error.handle';
import { revisarZip } from '../utils/zip-acotado.js';
import { encrypt } from '../utils/bcrypt.handle.js';
import { AuditoriaService, ACCIONES_AUDITORIA, MetaDeAuditoria } from './auditoria.service.js';
import { diaDeHoy, diaDe, instanteDeDia } from '../domain/fechas-hermano.js';
import {
  COLUMNAS_EXPORTACION, clavePersona, detectarColumnas, escribirCsv, leerCsv, leerFila, quitarRepetidas, texto, tituloDe,
  type ClaveColumna, type FichaImportada,
} from '../domain/censo-hoja.js';
import { textoDeFichero } from '../middleware/upload.middleware.js';

/** La cuenta de custodia de las fichas importadas sin cuenta propia. */
export const CUENTA_CENSO_IMPORTADO = {
  email: 'censo-importado@cuentas.invalido',
  dni: 'CENSO-IMPORTADO',
  nombre: 'Censo',
  apellidos: 'importado',
  telefono: '000000000',
};

/** Un tope razonable: el censo más grande de una corporación cabe de sobra. */
const MAX_FILAS = 5000;

/**
 * Lo que puede ocupar el Excel ya descomprimido. Un censo de 5000 filas no
 * llega ni a 5 MB; por encima solo cabe una bomba zip.
 */
export const MAX_BYTES_XLSX_DESCOMPRIMIDO = 50 * 1024 * 1024;

type Celda = unknown;

/** Lo que haya en una celda de Excel, como valor simple: texto, número o fecha. */
function valorExcel(v: ExcelJS.CellValue): Celda {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v !== 'object') return v;
  if ('richText' in v) return v.richText.map((t) => t.text).join('');
  if ('text' in v) return v.text;
  if ('result' in v) return v.result instanceof Date || typeof v.result !== 'object' ? v.result : null;
  return null;
}

/** El fichero subido a filas de celdas: Excel (.xlsx) si es un zip, si no CSV. */
async function leerHoja(buffer: Buffer): Promise<Celda[][]> {
  const esXlsx = buffer.subarray(0, 2).toString('latin1') === 'PK';
  if (!esXlsx) return leerCsv(textoDeFichero(buffer));
  // Antes de dárselo a ExcelJS, que lo descomprime entero en memoria.
  const veredicto = revisarZip(buffer, MAX_BYTES_XLSX_DESCOMPRIMIDO);
  if (veredicto === 'grande') throw new HttpError('El Excel es demasiado grande una vez abierto: pártelo en varios o guárdalo como CSV.', 413);
  if (veredicto === 'roto') throw new HttpError('El fichero no se puede abrir: guárdalo como Excel (.xlsx) o como CSV.');
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new HttpError('El fichero no se puede abrir: guárdalo como Excel (.xlsx) o como CSV.');
  }
  const hoja = libro.worksheets[0];
  if (!hoja) throw new HttpError('El Excel no tiene ninguna hoja.');
  const filas: Celda[][] = [];
  hoja.eachRow({ includeEmpty: false }, (fila) => {
    const valores = (fila.values as ExcelJS.CellValue[]).slice(1).map(valorExcel);
    if (valores.some((v) => texto(v) !== '')) filas.push(valores);
  });
  return filas;
}

async function analizar(buffer: Buffer) {
  const hoy = diaDeHoy();
  const filas = await leerHoja(buffer);
  if (filas.length < 2) throw new HttpError('El fichero está vacío: hace falta una fila de títulos y al menos una persona.');
  if (filas.length - 1 > MAX_FILAS) throw new HttpError(`El fichero tiene más de ${MAX_FILAS} filas: pártelo en varios.`);

  const [cabecera, ...cuerpo] = filas;
  const columnas = detectarColumnas(cabecera);
  if (!columnas.includes('nombre')) {
    throw new HttpError('No se encuentra la columna del nombre. La primera fila tiene que llevar los títulos (Nombre, Apellidos, DNI, Fecha de nacimiento…).');
  }

  const errores: { fila: number; errores: string[] }[] = [];
  const leidas: FichaImportada[] = [];
  cuerpo.forEach((valores, i) => {
    const r = leerFila(valores, columnas, i + 2, hoy);
    if ('ficha' in r) leidas.push(r.ficha);
    else errores.push(r);
  });
  const { fichas: unicas, errores: repetidas } = quitarRepetidas(leidas);
  errores.push(...repetidas);

  // Lo que ya está en el censo, en una consulta por tipo de clave.
  const dnis = unicas.flatMap((f) => (f.dni ? [f.dni] : []));
  const numeros = unicas.flatMap((f) => (f.numeroHermano ? [f.numeroHermano] : []));
  const [conDni, conNumero, sinDni] = await Promise.all([
    dnis.length ? db.hermano.findMany({ where: { dni: { in: dnis } }, select: { dni: true } }) : [],
    numeros.length ? db.hermano.findMany({ where: { numeroHermano: { in: numeros } }, select: { numeroHermano: true } }) : [],
    db.hermano.findMany({ where: { dni: null }, select: { nombre: true, apellidos: true, fechaNacimiento: true } }),
  ]);
  const dnisOcupados = new Set(conDni.map((h) => h.dni));
  const numerosOcupados = new Set(conNumero.map((h) => h.numeroHermano));
  const personasSinDni = new Set(sinDni.map((h) => clavePersona(h.nombre, h.apellidos, h.fechaNacimiento.toISOString().slice(0, 10))));

  const fichas: FichaImportada[] = [];
  for (const f of unicas) {
    const apellidos = [f.primerApellido, f.segundoApellido].filter(Boolean).join(' ');
    const motivo = f.dni && dnisOcupados.has(f.dni) ? `Ya hay una ficha con el DNI ${f.dni} en el censo.`
      : f.numeroHermano && numerosOcupados.has(f.numeroHermano) ? `El número ${f.numeroHermano} ya lo tiene otro hermano del censo.`
        : !f.dni && personasSinDni.has(clavePersona(f.nombre, apellidos, f.fechaNacimiento)) ? 'Ya está en el censo (mismo nombre, apellidos y nacimiento).'
          : null;
    if (motivo) errores.push({ fila: f.fila, errores: [motivo] });
    else fichas.push(f);
  }

  // Cuenta propia: DNI y un correo que no tenga ya otra cuenta ni otra fila.
  const correos = fichas.flatMap((f) => (f.dni && f.email ? [f.email] : []));
  const [correosOcupados, dnisConCuenta] = await Promise.all([
    correos.length ? db.user.findMany({ where: { email: { in: correos } }, select: { email: true } }) : [],
    dnis.length ? db.user.findMany({ where: { dni: { in: dnis } }, select: { dni: true } }) : [],
  ]);
  const ocupados = new Set([...correosOcupados.map((u) => u.email), ...dnisConCuenta.map((u) => u.dni)]);
  const conCuenta = new Set<number>();
  const titularDe = new Map<string, FichaImportada>();
  for (const f of fichas) {
    if (f.dni && f.email && !ocupados.has(f.email) && !ocupados.has(f.dni)) {
      conCuenta.add(f.fila);
      ocupados.add(f.email);
      titularDe.set(f.email, f);
    }
  }
  // A cargo: las filas en alta con el correo de un titular que también está
  // en alta. De una cuenta de baja no se puede colgar nada: no entra nadie.
  const aCargo = new Map<number, string>();
  for (const f of fichas) {
    const titular = f.email ? titularDe.get(f.email) : undefined;
    if (titular && titular.fila !== f.fila && !f.fechaBaja && !titular.fechaBaja) aCargo.set(f.fila, f.email!);
  }

  errores.sort((a, b) => a.fila - b.fila);
  return {
    fichas,
    conCuenta,
    aCargo,
    resumen: {
      filas: cuerpo.length,
      importables: fichas.length,
      conCuenta: conCuenta.size,
      aCargo: aCargo.size,
      deBaja: fichas.filter((f) => f.fechaBaja).length,
      sinNumero: fichas.filter((f) => !f.fechaBaja && !f.numeroHermano).length,
      domiciliadas: fichas.filter((f) => f.iban).length,
      columnas: cabecera.map((c, i) => ({ titulo: texto(c), clave: columnas[i] })),
      errores,
    },
  };
}

/** La cuenta de custodia, que se crea la primera vez que hace falta. */
export async function cuentaDeCustodia(tx: Prisma.TransactionClient): Promise<number> {
  const existente = await tx.user.findUnique({ where: { email: CUENTA_CENSO_IMPORTADO.email }, select: { id: true } });
  if (existente) return existente.id;
  const creada = await tx.user.create({
    data: { ...CUENTA_CENSO_IMPORTADO, password: await encrypt(crypto.randomBytes(32).toString('hex')), role: Role.USER, active: false },
    select: { id: true },
  });
  return creada.id;
}

export class CensoHojaService {
  /**
   * El censo entero, o solo los activos, en Excel o CSV. Sin datos bancarios:
   * el censo no los enseña. Queda en la auditoría: es una salida de datos
   * personales de todo el Grupo.
   */
  static async exportar(formato: 'xlsx' | 'csv', incluirBajas: boolean, meta?: MetaDeAuditoria) {
    const hermanos = await db.hermano.findMany({
      where: incluirBajas ? {} : { activo: true },
      select: {
        numeroHermano: true, nombre: true, primerApellido: true, segundoApellido: true, apellidos: true, dni: true,
        fechaNacimiento: true, sexo: true, telefono: true, email: true, direccion: true, poblacion: true, codigoPostal: true,
        provincia: true, fechaAlta: true, fechaBaja: true, activo: true,
      },
      orderBy: [{ numeroHermano: { sort: 'asc', nulls: 'last' } }, { apellidos: 'asc' }, { id: 'asc' }],
    });
    const valor: Record<ClaveColumna, (h: (typeof hermanos)[number]) => string | number | null> = {
      numeroHermano: (h) => h.numeroHermano,
      nombre: (h) => h.nombre,
      primerApellido: (h) => h.primerApellido ?? h.apellidos,
      segundoApellido: (h) => h.segundoApellido,
      apellidos: (h) => h.apellidos,
      dni: (h) => h.dni,
      fechaNacimiento: (h) => h.fechaNacimiento.toISOString().slice(0, 10),
      sexo: (h) => (h.sexo === 'HOMBRE' ? 'Hombre' : h.sexo === 'MUJER' ? 'Mujer' : null),
      telefono: (h) => h.telefono,
      email: (h) => h.email,
      direccion: (h) => h.direccion,
      poblacion: (h) => h.poblacion,
      codigoPostal: (h) => h.codigoPostal,
      provincia: (h) => h.provincia,
      fechaAlta: (h) => diaDe(h.fechaAlta),
      fechaBaja: (h) => (h.fechaBaja ? diaDe(h.fechaBaja) : null),
      iban: () => null,
      estado: (h) => (h.activo ? 'Activo' : 'De baja'),
    };
    const filas = [COLUMNAS_EXPORTACION.map(tituloDe), ...hermanos.map((h) => COLUMNAS_EXPORTACION.map((c) => valor[c](h)))];

    let contenido: Buffer;
    if (formato === 'csv') contenido = Buffer.from(escribirCsv(filas), 'utf8');
    else {
      const libro = new ExcelJS.Workbook();
      const hoja = libro.addWorksheet('Censo', { views: [{ state: 'frozen', ySplit: 1 }] });
      hoja.addRows(filas.map((f) => f.map((v, i) => {
        // Las fechas como fechas de Excel, para que se puedan ordenar y filtrar.
        const clave = COLUMNAS_EXPORTACION[i];
        return typeof v === 'string' && ['fechaNacimiento', 'fechaAlta', 'fechaBaja'].includes(clave) && /^\d{4}-\d{2}-\d{2}$/.test(v)
          ? new Date(`${v}T00:00:00Z`) : v;
      })));
      hoja.getRow(1).font = { bold: true };
      hoja.columns.forEach((columna, i) => {
        const clave = COLUMNAS_EXPORTACION[i];
        columna.width = ['direccion', 'email'].includes(clave) ? 32 : ['nombre', 'primerApellido', 'segundoApellido', 'poblacion'].includes(clave) ? 18 : 14;
        if (['fechaNacimiento', 'fechaAlta', 'fechaBaja'].includes(clave)) columna.numFmt = 'dd/mm/yyyy';
      });
      contenido = Buffer.from(await libro.xlsx.writeBuffer());
    }

    await AuditoriaService.log(ACCIONES_AUDITORIA.CENSO_EXPORTAR, meta ?? {}, 'censo', formato, {
      despues: { formato, incluirBajas, fichas: hermanos.length },
    });
    const dia = diaDeHoy();
    return {
      contenido,
      nombre: `censo-${incluirBajas ? 'completo' : 'activos'}-${dia}.${formato}`,
      tipo: formato === 'csv' ? 'text/csv; charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  /** Qué entraría del fichero y qué no, sin tocar nada. */
  static async previa(buffer: Buffer) {
    return (await analizar(buffer)).resumen;
  }

  /**
   * Crea las fichas que la vista previa daba por buenas, todas o ninguna. Un
   * activo no puede quedarse sin número (el censo lo da por imposible): los que
   * no lo traen se numeran a continuación del último, por antigüedad.
   */
  static async importar(buffer: Buffer, meta?: MetaDeAuditoria) {
    const { fichas, conCuenta, aCargo, resumen } = await analizar(buffer);
    if (fichas.length === 0) throw new HttpError('No hay ninguna fila que se pueda importar.', 409);

    // Una contraseña que nadie sabe, la misma para todas: se entra con el
    // enlace de la invitación (o con «¿Has olvidado tu contraseña?»). Cifrarla
    // una vez por ficha tardaría minutos con un censo grande.
    const inutilizable = await encrypt(crypto.randomBytes(32).toString('hex'));

    await db.$transaction(async (tx) => {
      const custodia = fichas.some((f) => !conCuenta.has(f.fila) && !aCargo.has(f.fila)) ? await cuentaDeCustodia(tx) : null;
      const { _max } = await tx.hermano.aggregate({ _max: { numeroHermano: true } });
      let siguiente = Math.max(_max.numeroHermano ?? 0, ...fichas.map((f) => f.numeroHermano ?? 0)) + 1;
      const numeroDe = new Map<number, number>();
      for (const f of [...fichas].filter((x) => !x.fechaBaja && !x.numeroHermano).sort((a, b) => a.fechaAlta.localeCompare(b.fechaAlta) || a.fila - b.fila)) {
        numeroDe.set(f.fila, siguiente++);
      }
      const apellidosDe = (f: FichaImportada) => [f.primerApellido, f.segundoApellido].filter(Boolean).join(' ');
      // Las cuentas primero: un hijo puede venir en el fichero antes que su padre.
      const cuentaDe = new Map<string, number>();
      for (const f of fichas.filter((x) => conCuenta.has(x.fila))) {
        const { id } = await tx.user.create({
          data: {
            email: f.email!, dni: f.dni!, nombre: f.nombre, apellidos: apellidosDe(f), telefono: f.telefono ?? '',
            direccion: f.direccion, poblacion: f.poblacion, codigoPostal: f.codigoPostal,
            password: inutilizable, role: Role.USER, active: !f.fechaBaja,
            // Una cuenta de baja no entra: no tiene nada que revisar.
            primerAccesoPendiente: !f.fechaBaja,
          },
          select: { id: true },
        });
        cuentaDe.set(f.email!, id);
      }
      for (const f of fichas) {
        const propia = conCuenta.has(f.fila);
        const apellidos = apellidosDe(f);
        const correoDelTitular = aCargo.get(f.fila);
        const userId = propia ? cuentaDe.get(f.email!)! : correoDelTitular ? cuentaDe.get(correoDelTitular)! : custodia!;
        await tx.hermano.create({
          data: {
            userId,
            esTitular: propia,
            nombre: f.nombre,
            apellidos,
            primerApellido: f.primerApellido,
            segundoApellido: f.segundoApellido,
            dni: f.dni,
            fechaNacimiento: instanteDeDia(f.fechaNacimiento, 'fechaNacimiento'),
            sexo: f.sexo,
            telefono: f.telefono,
            email: f.email,
            direccion: f.direccion,
            poblacion: f.poblacion,
            codigoPostal: f.codigoPostal,
            provincia: f.provincia,
            fechaAlta: instanteDeDia(f.fechaAlta, 'fechaAlta'),
            fechaBaja: f.fechaBaja ? instanteDeDia(f.fechaBaja, 'fechaBaja') : null,
            activo: !f.fechaBaja,
            numeroHermano: f.fechaBaja ? null : f.numeroHermano ?? numeroDe.get(f.fila)!,
            ...(f.iban ? {
              formaPagoPref: MetodoPago.DOMICILIACION,
              iban: f.iban,
              // Dio la cuenta al darse de alta: la fecha de su mandato SEPA.
              fechaMandato: instanteDeDia(f.fechaAlta, 'fechaAlta'),
            } : {}),
          },
        });
      }
    }, { timeout: 120_000, maxWait: 10_000 });

    await AuditoriaService.log(ACCIONES_AUDITORIA.CENSO_IMPORTAR, meta ?? {}, 'censo', 'importacion', {
      despues: {
        filas: resumen.filas, importadas: fichas.length, conCuenta: resumen.conCuenta, aCargo: resumen.aCargo, deBaja: resumen.deBaja,
        sinNumero: resumen.sinNumero, conErrores: resumen.errores.length,
      },
    });

    const partes = [`Se han importado ${fichas.length === 1 ? '1 ficha' : `${fichas.length} fichas`}.`];
    if (resumen.errores.length) partes.push(`${resumen.errores.length === 1 ? '1 fila se ha quedado' : `${resumen.errores.length} filas se han quedado`} fuera.`);
    if (resumen.sinNumero) partes.push(`${resumen.sinNumero === 1 ? 'El activo que no traía número lo ha recibido' : `Los ${resumen.sinNumero} activos que no traían número lo han recibido`} a continuación del último, por antigüedad.`);
    if (resumen.conCuenta) partes.push(`${resumen.conCuenta === 1 ? 'La cuenta nueva espera' : `Las ${resumen.conCuenta} cuentas nuevas esperan`} su invitación en la pestaña «Primer acceso».`);
    return { message: partes.join(' '), importadas: fichas.length };
  }
}
