import topes from '../../../shared/topes-video.json' with { type: 'json' };

/**
 * Lo que hace falta saber de un MP4 para aceptarlo, leído de sus cabeceras.
 *
 * Por qué a mano y no con ffmpeg: el servidor es un VPS de 2 núcleos y 4 GB, y
 * ffmpeg es un binario de cientos de megas que, para recomprimir un vídeo, deja
 * la CPU al 100 % varios minutos. Aquí NO se recomprime nada: el vídeo tiene que
 * llegar ya preparado para la web y el servidor solo comprueba que lo está.
 * Recorrer las cajas de un MP4 son unas decenas de lecturas de bytes: nada.
 *
 * Un MP4 es una lista de cajas (tamaño de 4 bytes + tipo de 4 letras) que
 * pueden anidarse. Lo que se lee:
 *
 *   moov ─ mvhd                        → duración (y su escala de tiempo)
 *        └ trak ─ mdia ─ hdlr          → qué es la pista: 'vide' o 'soun'
 *                      └ minf ─ stbl ─ stsd → códec ('avc1' = H.264) y, en la
 *                                             de vídeo, ancho y alto
 *
 * Puro y sin dependencias, para probarlo sin levantar nada. Nunca lanza: un
 * fichero roto o recortado devuelve `null`.
 */

interface PistaMp4 {
  /** 'vide', 'soun'… el tipo de la pista según su `hdlr`. */
  tipo: string;
  /** El códec de la muestra: 'avc1' (H.264), 'hvc1' (H.265), 'mp4a' (AAC)… */
  formato: string;
  ancho?: number;
  alto?: number;
}

interface InfoMp4 {
  /** En segundos. */
  duracion: number;
  pistas: PistaMp4[];
  /**
   * Si el índice (`moov`) va antes que los datos (`mdat`): lo que HandBrake
   * llama «optimizado para web». Con él, el navegador empieza a reproducir
   * según llega el principio del fichero. No se exige; se informa.
   */
  empiezaEnSeguida: boolean;
}

interface Caja { tipo: string; inicio: number; fin: number }

/** Las cajas hijas entre `desde` y `hasta`. Se para en la primera que no cuadra. */
function cajas(datos: Buffer, desde: number, hasta: number): Caja[] {
  const lista: Caja[] = [];
  let pos = desde;
  // Un tope a las vueltas: un fichero hecho a mala idea no tiene por qué
  // poder tener al servidor contando cajas.
  for (let vueltas = 0; pos + 8 <= hasta && vueltas < 10_000; vueltas++) {
    let tamano = datos.readUInt32BE(pos);
    const tipo = datos.toString('latin1', pos + 4, pos + 8);
    let cabecera = 8;
    if (tamano === 1) {
      if (pos + 16 > hasta) break;
      const grande = datos.readBigUInt64BE(pos + 8);
      if (grande > BigInt(hasta - pos)) break;
      tamano = Number(grande);
      cabecera = 16;
    } else if (tamano === 0) {
      tamano = hasta - pos; // «hasta el final»: solo vale en la última caja.
    }
    if (tamano < cabecera || pos + tamano > hasta) break;
    lista.push({ tipo, inicio: pos + cabecera, fin: pos + tamano });
    pos += tamano;
  }
  return lista;
}

const hija = (datos: Buffer, caja: Caja | undefined, tipo: string) =>
  caja ? cajas(datos, caja.inicio, caja.fin).find((c) => c.tipo === tipo) : undefined;

/** Duración de la película en segundos (`mvhd`, versiones 0 y 1). */
function duracionDe(datos: Buffer, mvhd: Caja): number | null {
  const version = datos.readUInt8(mvhd.inicio);
  if (version === 1) {
    if (mvhd.inicio + 32 > mvhd.fin) return null;
    const escala = datos.readUInt32BE(mvhd.inicio + 20);
    const duracion = Number(datos.readBigUInt64BE(mvhd.inicio + 24));
    return escala > 0 ? duracion / escala : null;
  }
  if (mvhd.inicio + 20 > mvhd.fin) return null;
  const escala = datos.readUInt32BE(mvhd.inicio + 12);
  const duracion = datos.readUInt32BE(mvhd.inicio + 16);
  return escala > 0 ? duracion / escala : null;
}

function pistaDe(datos: Buffer, trak: Caja): PistaMp4 | null {
  const mdia = hija(datos, trak, 'mdia');
  const hdlr = hija(datos, mdia, 'hdlr');
  const stsd = hija(datos, hija(datos, hija(datos, mdia, 'minf'), 'stbl'), 'stsd');
  if (!hdlr || !stsd || hdlr.inicio + 12 > hdlr.fin) return null;
  const tipo = datos.toString('latin1', hdlr.inicio + 8, hdlr.inicio + 12);
  // stsd: versión y banderas (4), número de entradas (4) y la primera entrada.
  const [entrada] = cajas(datos, stsd.inicio + 8, stsd.fin);
  if (!entrada) return null;
  const pista: PistaMp4 = { tipo, formato: entrada.tipo };
  // En una entrada de vídeo, el ancho y el alto van tras 24 bytes fijos.
  if (tipo === 'vide' && entrada.inicio + 28 <= entrada.fin) {
    pista.ancho = datos.readUInt16BE(entrada.inicio + 24);
    pista.alto = datos.readUInt16BE(entrada.inicio + 26);
  }
  return pista;
}

export function leerMp4(datos: Buffer): InfoMp4 | null {
  try {
    const raiz = cajas(datos, 0, datos.length);
    if (raiz[0]?.tipo !== 'ftyp') return null;
    const moov = raiz.find((c) => c.tipo === 'moov');
    const mvhd = hija(datos, moov, 'mvhd');
    if (!moov || !mvhd) return null;
    const duracion = duracionDe(datos, mvhd);
    if (duracion === null) return null;
    const pistas = cajas(datos, moov.inicio, moov.fin)
      .filter((c) => c.tipo === 'trak')
      .map((trak) => pistaDe(datos, trak))
      .filter((p): p is PistaMp4 => p !== null);
    const mdat = raiz.findIndex((c) => c.tipo === 'mdat');
    return { duracion, pistas, empiezaEnSeguida: mdat === -1 || raiz.indexOf(moov) < mdat };
  } catch {
    return null;
  }
}

/** Dónde va el vídeo: cada sitio tiene su tope de peso y de duración. */
type UsoDeVideo = 'hero' | 'galeria';
const USOS_DE_VIDEO: readonly UsoDeVideo[] = ['hero', 'galeria'];
export const esUsoDeVideo = (valor: unknown): valor is UsoDeVideo =>
  typeof valor === 'string' && (USOS_DE_VIDEO as readonly string[]).includes(valor);

export const topesDeVideo = (uso: UsoDeVideo) => topes[uso];

/**
 * Margen sobre la duración máxima: los programas redondean y un vídeo cortado
 * «a 30 segundos» sale a veces de 30,03.
 */
const MARGEN_SEGUNDOS = 0.5;

/** «45 segundos», «2 minutos», «1 min 30 s»: la duración como se dice. */
export function duracionEnPalabras(segundos: number): string {
  const s = Math.round(segundos);
  if (s < 60) return `${s} segundos`;
  const minutos = Math.floor(s / 60);
  const resto = s % 60;
  if (resto) return `${minutos} min ${resto} s`;
  return minutos === 1 ? '1 minuto' : `${minutos} minutos`;
}

const COMO_PREPARARLO = 'Pásalo por HandBrake (gratuito) con el formato MP4 y el códec H.264.';

/**
 * Qué le pasa a un vídeo para no poder publicarse, o `null` si vale. Los
 * mensajes son para quien lo sube: dicen qué cambiar, no qué falló por dentro.
 */
export function problemaDelVideo(info: InfoMp4 | null, uso: UsoDeVideo): string | null {
  if (!info) return `No se ha podido leer el vídeo. ${COMO_PREPARARLO}`;
  const videos = info.pistas.filter((p) => p.tipo === 'vide');
  if (videos.length !== 1) return `El vídeo tiene que llevar una sola pista de imagen. ${COMO_PREPARARLO}`;
  const [video] = videos;
  // H.264 es el único códec que ve cualquier navegador sin gastar batería: el
  // H.265 de los iPhone, por ejemplo, no se ve en Firefox ni en muchos Windows.
  if (video.formato !== 'avc1' && video.formato !== 'avc3') {
    return `El vídeo no está en H.264 (viene en «${video.formato.trim()}»). ${COMO_PREPARARLO}`;
  }
  const otraPista = info.pistas.find((p) => p.tipo === 'soun' && p.formato !== 'mp4a');
  if (otraPista) return `El sonido tiene que ir en AAC (viene en «${otraPista.formato.trim()}»), o quitarlo. ${COMO_PREPARARLO}`;

  const { maxSegundos } = topesDeVideo(uso);
  if (!(info.duracion > 0)) return `No se ha podido leer la duración del vídeo. ${COMO_PREPARARLO}`;
  if (info.duracion > maxSegundos + MARGEN_SEGUNDOS) {
    return `El vídeo dura ${duracionEnPalabras(info.duracion)} y aquí el máximo son ${duracionEnPalabras(maxSegundos)}. `
      + 'Recórtalo antes de subirlo, o súbelo a YouTube o Vimeo.';
  }

  const ancho = video.ancho ?? 0;
  const alto = video.alto ?? 0;
  if (!ancho || !alto) return `No se ha podido leer el tamaño del vídeo. ${COMO_PREPARARLO}`;
  if (Math.max(ancho, alto) > topes.ladoMayor || Math.min(ancho, alto) > topes.ladoMenor) {
    return `El vídeo es de ${ancho}×${alto} y el máximo es ${topes.ladoMayor}×${topes.ladoMenor} (1080p), `
      + 'en horizontal o en vertical. Redúcelo antes de subirlo.';
  }
  return null;
}
