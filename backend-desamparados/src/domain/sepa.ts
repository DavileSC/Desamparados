import { esIbanValido, normalizarIban } from '../config/common';
import { diaMadrid, esDiaValido } from './contabilidad';

/**
 * Remesas SEPA: el fichero de adeudos domiciliados (pain.008.001.02, SEPA CORE)
 * que Tesorería sube a la banca en línea, y las reglas que deciden qué recibos
 * entran en él.
 *
 * Todo puro, sin base de datos: un fichero mal formado no da error aquí, lo da
 * el banco días después, con el lote entero rechazado. Lo que cuesta dinero
 * cuando se equivoca (importes, sumas de control, fechas) queda cubierto por
 * pruebas que corren en cualquier máquina.
 *
 * Decisiones que no se ven en el código:
 * - Todos los adeudos van como RCUR. Desde noviembre de 2016 el EPC no obliga a
 *   marcar el primero como FRST, y los bancos españoles aceptan RCUR siempre;
 *   así no hace falta llevar la cuenta de qué adeudo es el primero de cada uno.
 * - El banco del deudor va como NOTPROVIDED: con IBAN basta en toda la zona SEPA.
 * - La referencia del mandato lleva la fecha de firma: una cuenta nueva es un
 *   mandato nuevo, y con otra referencia el banco no lo toma por una
 *   modificación (que exigiría mandar también la cuenta anterior).
 */

// --- Datos del Grupo como acreedor ---------------------------------------

export interface AcreedorSepa {
  nombre: string;
  /** Identificador de acreedor SEPA (AT-02), p. ej. ES12000G12345678. */
  id: string;
  iban: string;
  bic: string | null;
}

export const VARIABLES_ACREEDOR = ['SEPA_ACREEDOR_NOMBRE', 'SEPA_ACREEDOR_ID', 'SEPA_ACREEDOR_IBAN'] as const;

const definida = (valor: string | undefined): valor is string => valor !== undefined && valor.trim() !== '';

/**
 * Letra → número como en el IBAN (A=10 … Z=35), y el resto módulo 97 del
 * número resultante, cifra a cifra para no desbordar.
 */
function resto97(texto: string): number {
  let resto = 0;
  for (const caracter of texto) {
    const cifras = /[A-Z]/.test(caracter) ? String(caracter.charCodeAt(0) - 55) : caracter;
    for (const cifra of cifras) resto = (resto * 10 + Number(cifra)) % 97;
  }
  return resto;
}

/**
 * Identificador de acreedor SEPA: país, dos dígitos de control, tres
 * caracteres de sufijo (que no entran en el control) y el identificador
 * nacional (en España, el NIF). El control es el del IBAN (ISO 7064 97-10)
 * sobre identificador nacional + país + «00».
 */
export function esIdentificadorAcreedorValido(valor: string): boolean {
  const id = valor.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{3}[A-Z0-9]{1,28}$/.test(id)) return false;
  const nacional = id.slice(7);
  const control = 98 - resto97(`${nacional}${id.slice(0, 2)}00`);
  return control === Number(id.slice(2, 4));
}

/**
 * Lee los datos del acreedor del entorno. Sin alguno, la lista de lo que
 * falta o está mal, en frases que Tesorería pueda pasar a quien administra
 * el servidor: sin ellos no se genera ningún fichero.
 */
export function leerAcreedorSepa(entorno: Record<string, string | undefined> = process.env):
  { acreedor: AcreedorSepa; problemas: [] } | { acreedor: null; problemas: string[] } {
  const problemas: string[] = [];
  for (const nombre of VARIABLES_ACREEDOR) {
    if (!definida(entorno[nombre])) problemas.push(`Falta ${nombre} en la configuración del servidor.`);
  }
  const id = entorno.SEPA_ACREEDOR_ID?.replace(/\s/g, '').toUpperCase() ?? '';
  const iban = normalizarIban(entorno.SEPA_ACREEDOR_IBAN ?? '');
  const bic = entorno.SEPA_ACREEDOR_BIC?.replace(/\s/g, '').toUpperCase() ?? '';
  if (id && !esIdentificadorAcreedorValido(id)) {
    problemas.push('SEPA_ACREEDOR_ID no es un identificador de acreedor válido (revisa los dígitos de control; lo da el banco).');
  }
  if (iban && !esIbanValido(iban)) problemas.push('SEPA_ACREEDOR_IBAN no es un IBAN válido.');
  if (bic && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) problemas.push('SEPA_ACREEDOR_BIC no es un BIC válido (8 u 11 caracteres).');
  if (problemas.length > 0) return { acreedor: null, problemas };
  return {
    acreedor: { nombre: textoSepa(entorno.SEPA_ACREEDOR_NOMBRE!, 70), id, iban, bic: bic || null },
    problemas: [],
  };
}

// --- Texto ---------------------------------------------------------------

/**
 * El juego de caracteres que todo banco SEPA acepta es el latino básico:
 * letras sin tilde, cifras y / - ? : ( ) . , ' + y el espacio. Una «ñ» o una
 * tilde pueden hacer que un banco rechace el lote entero: se quitan las
 * tildes (Peña → Pena) y lo demás se vuelve espacio.
 */
export function textoSepa(texto: string, maximo: number): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9/\-?:().,'+ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maximo)
    .trim();
}

// Tras textoSepa no quedan & < >, pero los identificadores y el nombre del
// acreedor pasan por aquí igual: el XML no depende de lo que haya limpiado otro.
const escapar = (texto: string) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- Fechas: el calendario de los bancos (TARGET2) ------------------------

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
function domingoDePascua(anio: number): string {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

const aUtc = (dia: string) => new Date(`${dia}T00:00:00Z`);
const sumarDias = (dia: string, n: number) => new Date(aUtc(dia).getTime() + n * 86_400_000).toISOString().slice(0, 10);

/**
 * ¿Abren los bancos ese día? TARGET2 cierra los fines de semana, el 1 de
 * enero, Viernes Santo, Lunes de Pascua, el 1 de mayo y el 25 y 26 de
 * diciembre. Los festivos locales no cuentan: la compensación es europea.
 */
export function esDiaHabilBancario(dia: string): boolean {
  const semana = aUtc(dia).getUTCDay();
  if (semana === 0 || semana === 6) return false;
  const mesDia = dia.slice(5);
  if (['01-01', '05-01', '12-25', '12-26'].includes(mesDia)) return false;
  const pascua = domingoDePascua(Number(dia.slice(0, 4)));
  return dia !== sumarDias(pascua, -2) && dia !== sumarDias(pascua, 1);
}

/** El día que queda `n` días hábiles bancarios después de `dia`. */
export function sumarDiasHabiles(dia: string, n: number): string {
  let actual = dia;
  let quedan = n;
  while (quedan > 0) {
    actual = sumarDias(actual, 1);
    if (esDiaHabilBancario(actual)) quedan -= 1;
  }
  return actual;
}

/**
 * Días hábiles de margen entre generar el fichero y el cobro. La norma pide
 * uno para los recurrentes, pero el fichero hay que subirlo al banco, y el
 * banco lo quiere antes de su hora de corte: con dos no se llega tarde.
 */
export const DIAS_HABILES_DE_MARGEN = 2;

export function fechaCobroMinima(hoy: string): string {
  return sumarDiasHabiles(hoy, DIAS_HABILES_DE_MARGEN);
}

/** `null` si la fecha de cobro vale; si no, por qué, para decírselo a Tesorería. */
export function problemaFechaCobro(fechaCobro: string, hoy: string): string | null {
  if (!esDiaValido(fechaCobro)) return 'La fecha de cobro no es una fecha válida.';
  const minima = fechaCobroMinima(hoy);
  if (fechaCobro < minima) {
    return `El banco necesita margen: la fecha de cobro tiene que ser el ${formatoDia(minima)} o después.`;
  }
  if (!esDiaHabilBancario(fechaCobro)) return `El ${formatoDia(fechaCobro)} los bancos no abren: elige un día laborable.`;
  if (fechaCobro > sumarDias(hoy, 365)) return 'La fecha de cobro no puede estar a más de un año.';
  return null;
}

const formatoDia = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;

// --- Qué recibos entran -------------------------------------------------

export interface ReciboCandidato {
  id: number;
  concepto: string;
  /** En céntimos: el dinero no pasa por coma flotante. */
  centimos: number;
  hermano: {
    id: number;
    nombre: string;
    apellidos: string;
    activo: boolean;
    iban: string | null;
    titularCuenta: string | null;
    fechaMandato: Date | null;
    fechaAlta: Date;
  };
}

export type MotivoExclusion = 'SIN_IBAN' | 'IBAN_NO_VALIDO' | 'DE_BAJA' | 'IMPORTE_CERO';

export const TEXTO_EXCLUSION: Record<MotivoExclusion, string> = {
  SIN_IBAN: 'No tiene cuenta en la ficha',
  IBAN_NO_VALIDO: 'La cuenta de la ficha no es un IBAN válido',
  DE_BAJA: 'Está de baja',
  IMPORTE_CERO: 'El importe es cero',
};

export interface Adeudo {
  reciboId: number;
  /** EndToEndId: vuelve en la devolución y la casa con su recibo. */
  endToEndId: string;
  centimos: number;
  concepto: string;
  mandato: { referencia: string; fechaFirma: string };
  deudor: { nombre: string; iban: string };
}

/** `REC-123`: único por recibo y corto (el banco admite 35). */
export const endToEndDeRecibo = (reciboId: number) => `REC-${reciboId}`;

/** La referencia del mandato: el hermano y el día en que lo firmó. */
export function referenciaMandato(hermanoId: number, fechaFirma: string): string {
  return `HERMANO-${String(hermanoId).padStart(6, '0')}-${fechaFirma.replace(/-/g, '')}`;
}

/**
 * Separa los recibos que pueden ir al banco de los que no, con el motivo. El
 * que no puede ir se queda pendiente: Tesorería lo cobra en mano o corrige la
 * ficha y lo manda en la siguiente remesa.
 */
export function clasificarRecibos(candidatos: ReciboCandidato[]): {
  adeudos: Adeudo[];
  excluidos: { reciboId: number; hermanoId: number; motivo: MotivoExclusion }[];
} {
  const adeudos: Adeudo[] = [];
  const excluidos: { reciboId: number; hermanoId: number; motivo: MotivoExclusion }[] = [];
  for (const r of candidatos) {
    const h = r.hermano;
    const iban = h.iban ? normalizarIban(h.iban) : '';
    const motivo: MotivoExclusion | null =
      r.centimos <= 0 ? 'IMPORTE_CERO'
        : !h.activo ? 'DE_BAJA'
          : !iban ? 'SIN_IBAN'
            : !esIbanValido(iban) ? 'IBAN_NO_VALIDO'
              : null;
    if (motivo) {
      excluidos.push({ reciboId: r.id, hermanoId: h.id, motivo });
      continue;
    }
    const fechaFirma = diaMadrid(h.fechaMandato ?? h.fechaAlta);
    adeudos.push({
      reciboId: r.id,
      endToEndId: endToEndDeRecibo(r.id),
      centimos: r.centimos,
      concepto: textoSepa(r.concepto, 140) || `Recibo ${r.id}`,
      mandato: { referencia: referenciaMandato(h.id, fechaFirma), fechaFirma },
      // El titular de la cuenta, si no es el propio hermano.
      deudor: { nombre: textoSepa(h.titularCuenta?.trim() || `${h.nombre} ${h.apellidos}`, 70) || 'Titular', iban },
    });
  }
  return { adeudos, excluidos };
}

/** Euros (Decimal, texto o número) → céntimos enteros, sin errores de redondeo. */
export function aCentimos(importe: { toString(): string } | number | string): number {
  const texto = typeof importe === 'number' ? importe.toFixed(2) : importe.toString();
  const [enteros, decimales = ''] = texto.split('.');
  const signo = enteros.startsWith('-') ? -1 : 1;
  return signo * (Math.abs(Number(enteros)) * 100 + Number((decimales + '00').slice(0, 2)));
}

/** Céntimos → «12.50», como lo quiere el XML. */
export const importeXml = (centimos: number) => `${Math.floor(centimos / 100)}.${String(centimos % 100).padStart(2, '0')}`;

// --- El fichero ------------------------------------------------------------

export interface DatosRemesa {
  mensajeId: string;
  creadaEl: Date;
  fechaCobro: string;
  acreedor: AcreedorSepa;
  adeudos: Adeudo[];
}

/** `REMESA-000012-20261020`: único por remesa y legible en la banca en línea. */
export function mensajeIdDeRemesa(remesaId: number, fechaCobro: string): string {
  return `REMESA-${String(remesaId).padStart(6, '0')}-${fechaCobro.replace(/-/g, '')}`;
}

/**
 * El XML pain.008.001.02 con un único bloque de pago: una fecha de cobro,
 * una cuenta del Grupo, todos los adeudos RCUR CORE.
 */
export function generarPain008(datos: DatosRemesa): string {
  const { acreedor, adeudos } = datos;
  if (adeudos.length === 0) throw new Error('Una remesa sin adeudos no se puede generar.');
  const total = importeXml(adeudos.reduce((suma, a) => suma + a.centimos, 0));
  const n = String(adeudos.length);
  const agenteAcreedor = acreedor.bic
    ? `<FinInstnId><BIC>${escapar(acreedor.bic)}</BIC></FinInstnId>`
    : '<FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId>';
  const idAcreedor = `<Id><PrvtId><Othr><Id>${escapar(acreedor.id)}</Id><SchmeNm><Prtry>SEPA</Prtry></SchmeNm></Othr></PrvtId></Id>`;

  const operaciones = adeudos.map((a) => [
    '      <DrctDbtTxInf>',
    `        <PmtId><EndToEndId>${escapar(a.endToEndId)}</EndToEndId></PmtId>`,
    `        <InstdAmt Ccy="EUR">${importeXml(a.centimos)}</InstdAmt>`,
    `        <DrctDbtTx><MndtRltdInf><MndtId>${escapar(a.mandato.referencia)}</MndtId><DtOfSgntr>${a.mandato.fechaFirma}</DtOfSgntr></MndtRltdInf></DrctDbtTx>`,
    '        <DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>',
    `        <Dbtr><Nm>${escapar(a.deudor.nombre)}</Nm></Dbtr>`,
    `        <DbtrAcct><Id><IBAN>${escapar(a.deudor.iban)}</IBAN></Id></DbtrAcct>`,
    `        <RmtInf><Ustrd>${escapar(a.concepto)}</Ustrd></RmtInf>`,
    '      </DrctDbtTxInf>',
  ].join('\n'));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    '  <CstmrDrctDbtInitn>',
    '    <GrpHdr>',
    `      <MsgId>${escapar(datos.mensajeId)}</MsgId>`,
    `      <CreDtTm>${datos.creadaEl.toISOString().slice(0, 19)}</CreDtTm>`,
    `      <NbOfTxs>${n}</NbOfTxs>`,
    `      <CtrlSum>${total}</CtrlSum>`,
    `      <InitgPty><Nm>${escapar(acreedor.nombre)}</Nm>${idAcreedor}</InitgPty>`,
    '    </GrpHdr>',
    '    <PmtInf>',
    `      <PmtInfId>${escapar(`${datos.mensajeId}-1`)}</PmtInfId>`,
    '      <PmtMtd>DD</PmtMtd>',
    '      <BtchBookg>true</BtchBookg>',
    `      <NbOfTxs>${n}</NbOfTxs>`,
    `      <CtrlSum>${total}</CtrlSum>`,
    '      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>RCUR</SeqTp></PmtTpInf>',
    `      <ReqdColltnDt>${datos.fechaCobro}</ReqdColltnDt>`,
    `      <Cdtr><Nm>${escapar(acreedor.nombre)}</Nm></Cdtr>`,
    `      <CdtrAcct><Id><IBAN>${escapar(acreedor.iban)}</IBAN></Id></CdtrAcct>`,
    `      <CdtrAgt>${agenteAcreedor}</CdtrAgt>`,
    '      <ChrgBr>SLEV</ChrgBr>',
    `      <CdtrSchmeId>${idAcreedor}</CdtrSchmeId>`,
    ...operaciones,
    '    </PmtInf>',
    '  </CstmrDrctDbtInitn>',
    '</Document>',
    '',
  ].join('\n');
}

// --- El mandato ------------------------------------------------------------

/**
 * ¿Firma el hermano un mandato nuevo con este cambio de la ficha? Sí al pasar
 * a domiciliación y al cambiar de cuenta domiciliando: el banco trata una
 * cuenta nueva como un mandato nuevo. Cambiar el nombre del titular, no.
 */
export function renuevaMandato(
  antes: { formaPagoPref: string; iban: string | null },
  despues: { formaPagoPref: string; iban: string | null },
): boolean {
  if (despues.formaPagoPref !== 'DOMICILIACION' || !despues.iban) return false;
  if (antes.formaPagoPref !== 'DOMICILIACION') return true;
  return normalizarIban(antes.iban ?? '') !== normalizarIban(despues.iban);
}
