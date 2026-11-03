/**
 * Publicar las noticias en la cuenta de Instagram del Grupo.
 *
 * La cuenta se conecta pegando en el CMS un token de larga duración que se
 * saca del panel de desarrolladores de Meta (los pasos, en docs/despliegue.md).
 * No hay ida y vuelta por Instagram para iniciar sesión: haría falta que Meta
 * revisara la app, y para publicar en la cuenta propia no lo pide.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import db from '../../config/db.js';
import { HttpError, NotFoundError } from '../../utils/error.handle.js';
import { cifrarSecretoTotp, leerSecretoTotp } from '../../utils/cifrado-totp.js';
import { enFilaDeFotos } from '../../utils/fila-de-fotos.js';
import { nombreDeSubida } from '../../utils/ficheros-publicos.js';
import { publicStorageDir } from '../../middleware/upload.middleware.js';
import { ANCHO_INSTAGRAM, DURACION_TOKEN, problemaDelPie, recorteParaInstagram, tocaRenovar } from '../../domain/instagram.js';
import { ErrorDeInstagram, instagram } from './instagram-api.js';

/**
 * Donde esperan las fotos en JPEG mientras Instagram se las descarga.
 * Dentro de `storage/public` porque Instagram las pide por URL pública, y en
 * subcarpeta para que el barrido de huérfanos (solo mira la raíz) no las toque.
 * Se borran al terminar, salga bien o mal.
 */
export const carpetaParaInstagram = () => path.join(publicStorageDir, 'instagram');

/** Lo que el CMS sabe de la cuenta: nunca el token. */
export interface EstadoInstagram {
  conectada: boolean
  usuario: string | null
  caducaEl: string | null
  conectadoEl: string | null
  errorAlRenovar: string | null
}

/** Las noticias que se están mandando ahora: dos clics seguidos no las publican dos veces. */
const enCamino = new Set<number>();

/** El mensaje para el CMS de un error de Instagram. */
function errorParaElCms(e: unknown): HttpError {
  if (e instanceof ErrorDeInstagram) {
    if (e.tokenCaducado) return new HttpError('La conexión con Instagram ha caducado o se ha retirado: vuelve a conectar la cuenta.', 409);
    return new HttpError(`Instagram no lo ha aceptado: ${e.message}`, 502);
  }
  console.error('❌ [Instagram] Fallo al hablar con Instagram:', e);
  return new HttpError('No se ha podido hablar con Instagram. Prueba otra vez en un rato.', 502);
}

async function tokenGuardado() {
  const cuenta = await db.cuentaInstagram.findUnique({ where: { id: 1 } });
  if (!cuenta) return null;
  const { secreto, recifrar } = leerSecretoTotp(cuenta.token);
  // Tras rotar la clave, el token se pasa a la nueva en cuanto se lee, como el 2FA.
  if (recifrar) await db.cuentaInstagram.update({ where: { id: 1 }, data: { token: cifrarSecretoTotp(secreto) } });
  return { ...cuenta, token: secreto };
}

export class InstagramService {
  static async estado(): Promise<EstadoInstagram> {
    const cuenta = await db.cuentaInstagram.findUnique({
      where: { id: 1 },
      select: { usuario: true, caducaEl: true, conectadoEl: true, errorAlRenovar: true },
    });
    return {
      conectada: cuenta !== null,
      usuario: cuenta?.usuario ?? null,
      caducaEl: cuenta?.caducaEl.toISOString() ?? null,
      conectadoEl: cuenta?.conectadoEl.toISOString() ?? null,
      errorAlRenovar: cuenta?.errorAlRenovar ?? null,
    };
  }

  /**
   * Guarda el token después de preguntar a Instagram de quién es. Un token
   * que no vale, o de una cuenta personal (que no puede publicar por la API),
   * no se guarda: se dice aquí y no al primer intento de publicar.
   */
  static async conectar(token: string, quienId: number | undefined): Promise<EstadoInstagram> {
    let cuenta;
    try {
      cuenta = await instagram().quienSoy(token);
    } catch (e) {
      if (e instanceof ErrorDeInstagram) throw new HttpError('Instagram no reconoce ese token. Cópialo otra vez entero desde el panel de Meta.', 400);
      throw errorParaElCms(e);
    }
    if (cuenta.tipo === 'PERSONAL') {
      throw new HttpError(`@${cuenta.usuario} es una cuenta personal: pásala a profesional en la app de Instagram y vuelve a sacar el token.`, 400);
    }
    const conectadoPor = quienId === undefined ? null : (await db.user.findUnique({ where: { id: quienId }, select: { email: true } }))?.email ?? null;
    const ahora = new Date();
    // Un token recién sacado del panel dura 60 días; Instagram no dice cuántos
    // le quedan sin renovarlo, y no deja renovarlo hasta pasadas 24 horas.
    const datos = {
      cuentaId: cuenta.cuentaId, usuario: cuenta.usuario.slice(0, 60), token: cifrarSecretoTotp(token),
      caducaEl: new Date(ahora.getTime() + DURACION_TOKEN), renovadoEl: ahora, conectadoEl: ahora, conectadoPor, errorAlRenovar: null,
    };
    await db.cuentaInstagram.upsert({ where: { id: 1 }, create: { id: 1, ...datos }, update: datos });
    return InstagramService.estado();
  }

  /** Quita la cuenta. Lo publicado sigue en Instagram: eso se borra allí. */
  static async desconectar(): Promise<void> {
    await db.cuentaInstagram.deleteMany({ where: { id: 1 } });
  }

  /**
   * Renueva el token si hace una semana de la última vez. Lo llama el
   * arranque cada hora; nunca lanza. Si falla se apunta el motivo, que el
   * CMS enseña, y se vuelve a probar en la siguiente vuelta.
   */
  static async renovarSiToca(ahora: Date = new Date()): Promise<void> {
    try {
      const cuenta = await tokenGuardado();
      if (!cuenta || !tocaRenovar(cuenta.renovadoEl, ahora)) return;
      try {
        const nuevo = await instagram().renovar(cuenta.token);
        await db.cuentaInstagram.update({
          where: { id: 1 },
          data: {
            token: cifrarSecretoTotp(nuevo.token),
            caducaEl: new Date(ahora.getTime() + (Number.isFinite(nuevo.caducaEn) && nuevo.caducaEn > 0 ? nuevo.caducaEn * 1000 : DURACION_TOKEN)),
            renovadoEl: ahora,
            errorAlRenovar: null,
          },
        });
      } catch (e) {
        const motivo = e instanceof ErrorDeInstagram && e.tokenCaducado
          ? 'El token ha caducado o se ha retirado: hay que volver a conectar la cuenta.'
          : `No se ha podido renovar: ${e instanceof Error ? e.message : String(e)}`;
        await db.cuentaInstagram.update({ where: { id: 1 }, data: { errorAlRenovar: motivo.slice(0, 500) } });
        console.error('❌ [Instagram] No se ha podido renovar el token:', motivo);
      }
    } catch (e) {
      console.error('❌ [Instagram] No se ha podido comprobar el token:', e);
    }
  }

  /**
   * Publica una noticia en Instagram con el pie que se ha revisado en el CMS.
   * Solo una publicada (en Instagram el enlace del perfil lleva a la web, y a
   * un borrador no se llega) y con foto (Instagram no admite solo texto).
   * Una ya mandada solo se vuelve a mandar si se pide expresamente.
   */
  static async publicarNoticia(id: number, pie: string, { otraVez = false }: { otraVez?: boolean } = {}) {
    const problema = problemaDelPie(pie);
    if (problema) throw new HttpError(problema, 400);

    const noticia = await db.noticia.findUnique({ where: { id }, select: { visible: true, imagenUrl: true, instagramId: true } });
    if (!noticia) throw new NotFoundError('Noticia no encontrada');
    if (!noticia.visible) throw new HttpError('Publícala antes en la web: desde Instagram se llega a la noticia por el enlace del perfil.', 409);
    if (noticia.instagramId && !otraVez) throw new HttpError('Esta noticia ya está en Instagram.', 409, { yaPublicada: true });
    const foto = nombreDeSubida(noticia.imagenUrl);
    if (!foto) {
      throw new HttpError(noticia.imagenUrl
        ? 'Instagram necesita una foto subida desde el CMS, y esta es de las que trae la web. Sube la foto de la noticia.'
        : 'Instagram no publica sin foto: ponle una a la noticia.', 409);
    }

    const cuenta = await tokenGuardado();
    if (!cuenta) throw new HttpError('No hay ninguna cuenta de Instagram conectada.', 409);

    if (enCamino.has(id)) throw new HttpError('Esta noticia ya se está mandando a Instagram.', 409);
    enCamino.add(id);
    let jpeg: string | null = null;
    try {
      jpeg = await prepararJpeg(foto);
      const url = `${process.env.API_URL || 'http://localhost:3001'}/storage/public/instagram/${path.basename(jpeg)}`;
      let publicada;
      try {
        publicada = await instagram().publicarFoto(cuenta.token, cuenta.cuentaId, url, pie);
      } catch (e) {
        // Que el CMS lo diga también fuera de esta ventana, como un fallo al renovar.
        if (e instanceof ErrorDeInstagram && e.tokenCaducado) {
          await db.cuentaInstagram.update({ where: { id: 1 }, data: { errorAlRenovar: 'El token ha caducado o se ha retirado: hay que volver a conectar la cuenta.' } }).catch(() => {});
        }
        throw errorParaElCms(e);
      }
      return db.noticia.update({
        where: { id },
        data: { instagramId: publicada.id.slice(0, 40), instagramEnlace: publicada.enlace?.slice(0, 300) ?? null, instagramEl: new Date() },
        select: { instagramId: true, instagramEnlace: true, instagramEl: true },
      });
    } finally {
      enCamino.delete(id);
      // Ya está en Instagram (o no va a estar): la copia no la necesita nadie.
      if (jpeg) await fs.unlink(jpeg).catch(() => {});
    }
  }
}

/**
 * La foto de la noticia en JPEG (Instagram no acepta WebP), recortada a lo que
 * admite y con un nombre al azar, que no se pueda adivinar mientras espera.
 */
async function prepararJpeg(foto: string): Promise<string> {
  let original: Buffer;
  try {
    original = await fs.readFile(path.join(publicStorageDir, foto));
  } catch {
    throw new HttpError('La foto de la noticia ya no está en el servidor: vuelve a subirla.', 409);
  }
  const jpeg = await enFilaDeFotos(async () => {
    // `rotate()` primero: las medidas que cuentan son las de la foto ya derecha.
    const derecha = sharp(original, { animated: false }).rotate();
    const { data, info } = await derecha.toBuffer({ resolveWithObject: true });
    return sharp(data)
      .extract(recorteParaInstagram(info.width, info.height))
      .resize({ width: ANCHO_INSTAGRAM, withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90, mozjpeg: true })
      .toBuffer();
  });
  await fs.mkdir(carpetaParaInstagram(), { recursive: true });
  const destino = path.join(carpetaParaInstagram(), `${crypto.randomBytes(16).toString('hex')}.jpg`);
  await fs.writeFile(destino, jpeg);
  return destino;
}
