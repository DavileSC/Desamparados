/**
 * Publicar las noticias en la cuenta de X del Grupo, por su API de pago.
 *
 * La cuenta se conecta pegando en el CMS las cuatro claves de la app de
 * console.x.com (los pasos, en docs/despliegue.md). No caducan: no hay nada
 * que renovar, a diferencia de Instagram.
 *
 * A diferencia de Instagram, la foto se sube desde aquí: X no la descarga de
 * una URL, así que no hace falta copia pública ni que X llegue al servidor.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import db from '../../config/db.js';
import { HttpError, NotFoundError } from '../../utils/error.handle.js';
import { cifrarSecretoTotp, leerSecretoTotp } from '../../utils/cifrado-totp.js';
import { enFilaDeFotos } from '../../utils/fila-de-fotos.js';
import { nombreDeSubida } from '../../utils/ficheros-publicos.js';
import { publicStorageDir } from '../../middleware/upload.middleware.js';
import { LADO_FOTO_X, enlaceDelPost, problemaDelTextoX } from '../../domain/x.js';
import { ErrorDeX, x, type ClavesX } from './x-api.js';

/** Lo que el CMS sabe de la cuenta: nunca las claves. */
export interface EstadoX {
  conectada: boolean
  usuario: string | null
  conectadoEl: string | null
  /** Por qué falló la última publicación por culpa de las claves, para pedir que se vuelvan a pegar; null si no. */
  errorDeClaves: string | null
}

/** Las noticias que se están mandando ahora: dos clics seguidos no las publican dos veces. */
const enCamino = new Set<number>();

const CLAVES_MALAS = 'X ya no acepta las claves (regeneradas o la app borrada): vuelve a conectar la cuenta.';
const SOLO_LECTURA = 'Las claves son de solo lectura. En console.x.com pon la app en «Read and write» y vuelve a generar el Access Token y su Secret; después, vuelve a conectar la cuenta.';

/** El mensaje para el CMS de un error de X. */
function errorParaElCms(e: unknown): HttpError {
  if (e instanceof ErrorDeX) {
    if (e.clavesMalas) return new HttpError(CLAVES_MALAS, 409);
    if (e.soloLectura) return new HttpError(SOLO_LECTURA, 409);
    if (e.duplicado) return new HttpError('X no deja publicar dos veces el mismo texto: cámbialo un poco.', 409);
    if (e.sinSaldo) return new HttpError('La cuenta de desarrollador de X no tiene saldo para publicar: recárgala en console.x.com.', 409);
    if (e.demasiadas) return new HttpError('X no deja publicar más por ahora. Prueba otra vez en un rato.', 429);
    return new HttpError(`X no lo ha aceptado: ${e.message}`, 502);
  }
  console.error('❌ [X] Fallo al hablar con X:', e);
  return new HttpError('No se ha podido hablar con X. Prueba otra vez en un rato.', 502);
}

async function clavesGuardadas() {
  const cuenta = await db.cuentaX.findUnique({ where: { id: 1 } });
  if (!cuenta) return null;
  const { secreto, recifrar } = leerSecretoTotp(cuenta.claves);
  // Tras rotar la clave, las de X se pasan a la nueva en cuanto se leen, como el 2FA.
  if (recifrar) await db.cuentaX.update({ where: { id: 1 }, data: { claves: cifrarSecretoTotp(secreto) } });
  return { ...cuenta, claves: JSON.parse(secreto) as ClavesX };
}

export class XService {
  static async estado(): Promise<EstadoX> {
    const cuenta = await db.cuentaX.findUnique({ where: { id: 1 }, select: { usuario: true, conectadoEl: true, errorDeClaves: true } });
    return {
      conectada: cuenta !== null,
      usuario: cuenta?.usuario ?? null,
      conectadoEl: cuenta?.conectadoEl.toISOString() ?? null,
      errorDeClaves: cuenta?.errorDeClaves ?? null,
    };
  }

  /**
   * Guarda las claves después de preguntar a X de quién son: unas que no
   * valen no se guardan. Que tengan permiso de escritura no se puede saber
   * sin publicar; si no lo tienen, lo dice el primer intento.
   */
  static async conectar(claves: ClavesX, quienId: number | undefined): Promise<EstadoX> {
    let cuenta;
    try {
      cuenta = await x().quienSoy(claves);
    } catch (e) {
      if (e instanceof ErrorDeX && e.clavesMalas) throw new HttpError('X no reconoce esas claves. Cópialas otra vez desde console.x.com, cada una en su sitio.', 400);
      throw errorParaElCms(e);
    }
    const conectadoPor = quienId === undefined ? null : (await db.user.findUnique({ where: { id: quienId }, select: { email: true } }))?.email ?? null;
    const datos = {
      cuentaId: cuenta.cuentaId.slice(0, 40), usuario: cuenta.usuario.slice(0, 60),
      claves: cifrarSecretoTotp(JSON.stringify(claves)), conectadoEl: new Date(), conectadoPor, errorDeClaves: null,
    };
    await db.cuentaX.upsert({ where: { id: 1 }, create: { id: 1, ...datos }, update: datos });
    return XService.estado();
  }

  /** Quita la cuenta. Lo publicado sigue en X: eso se borra allí. */
  static async desconectar(): Promise<void> {
    await db.cuentaX.deleteMany({ where: { id: 1 } });
  }

  /**
   * Publica una noticia en X con el texto revisado en el CMS y, si se pide,
   * con su foto. Solo una publicada: el post enlaza a ella. Una ya mandada
   * solo se vuelve a mandar si se pide expresamente.
   */
  static async publicarNoticia(id: number, texto: string, { conFoto, otraVez = false }: { conFoto: boolean; otraVez?: boolean }) {
    const problema = problemaDelTextoX(texto);
    if (problema) throw new HttpError(problema, 400);

    const noticia = await db.noticia.findUnique({ where: { id }, select: { visible: true, imagenUrl: true, xId: true } });
    if (!noticia) throw new NotFoundError('Noticia no encontrada');
    if (!noticia.visible) throw new HttpError('Publícala antes en la web: el post enlaza a la noticia.', 409);
    if (noticia.xId && !otraVez) throw new HttpError('Esta noticia ya está en X.', 409, { yaPublicada: true });
    const foto = conFoto ? nombreDeSubida(noticia.imagenUrl) : null;
    if (conFoto && !foto) {
      throw new HttpError(noticia.imagenUrl
        ? 'Esta foto es de las que trae la web y no se puede mandar: sube la foto de la noticia, o publícala sin foto.'
        : 'La noticia no tiene foto: publícala sin ella.', 409);
    }

    const cuenta = await clavesGuardadas();
    if (!cuenta) throw new HttpError('No hay ninguna cuenta de X conectada.', 409);

    if (enCamino.has(id)) throw new HttpError('Esta noticia ya se está mandando a X.', 409);
    enCamino.add(id);
    try {
      const jpeg = foto ? await prepararJpeg(foto) : null;
      let publicado;
      try {
        const fotoId = jpeg ? await x().subirFoto(cuenta.claves, jpeg) : null;
        publicado = await x().publicar(cuenta.claves, texto, fotoId);
      } catch (e) {
        // Que el CMS lo diga también fuera de esta ventana: hasta que se vuelvan a pegar, no se publicará nada.
        if (e instanceof ErrorDeX && (e.clavesMalas || e.soloLectura)) {
          await db.cuentaX.update({ where: { id: 1 }, data: { errorDeClaves: e.clavesMalas ? CLAVES_MALAS : SOLO_LECTURA } }).catch(() => {});
        }
        throw errorParaElCms(e);
      }
      // Si se llega aquí, las claves valen: un aviso de antes ya no hace falta.
      if (cuenta.errorDeClaves) await db.cuentaX.update({ where: { id: 1 }, data: { errorDeClaves: null } });
      return db.noticia.update({
        where: { id },
        data: { xId: publicado.id.slice(0, 40), xEnlace: enlaceDelPost(cuenta.usuario, publicado.id).slice(0, 300), xEl: new Date() },
        select: { xId: true, xEnlace: true, xEl: true },
      });
    } finally {
      enCamino.delete(id);
    }
  }
}

/**
 * La foto de la noticia en JPEG, entera y derecha. X admite WebP, pero no en
 * todas sus apps se ve igual: el JPEG llega bien a todas. Sin recortar: X la
 * encuadra en el timeline y la enseña entera al pulsarla.
 */
async function prepararJpeg(foto: string): Promise<Buffer> {
  let original: Buffer;
  try {
    original = await fs.readFile(path.join(publicStorageDir, foto));
  } catch {
    throw new HttpError('La foto de la noticia ya no está en el servidor: vuelve a subirla, o publícala sin foto.', 409);
  }
  return enFilaDeFotos(() => sharp(original, { animated: false })
    .rotate()
    .resize({ width: LADO_FOTO_X, height: LADO_FOTO_X, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer());
}
