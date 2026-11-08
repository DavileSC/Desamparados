/**
 * Las llamadas a la API de X (v2), firmadas con OAuth 1.0a en nombre de la
 * cuenta del Grupo: las cuatro claves de la app que se pegan en el CMS.
 *
 * OAuth 1.0a y no OAuth 2.0 porque sus claves no caducan: con OAuth 2.0 el
 * token dura dos horas y habría que guardar y rotar el de refresco, y para
 * publicar en una sola cuenta propia no aporta nada.
 *
 * Las claves no salen en ningún registro: los errores llevan el mensaje de X,
 * no las cabeceras.
 *
 * Dentro de `node --test` no se sale a la red: lo que se haga va al cliente
 * que ponga la prueba con `fijarClienteDePrueba`, y sin él, falla.
 */
import crypto from 'node:crypto';

const BASE = 'https://api.x.com';

export interface ClavesX {
  apiKey: string
  apiSecret: string
  accessToken: string
  accessSecret: string
}

/** Un error que dice X, con el estado HTTP y el tipo de problema para distinguirlos. */
export class ErrorDeX extends Error {
  constructor(mensaje: string, readonly estado?: number, readonly tipo?: string) {
    super(mensaje);
    this.name = 'ErrorDeX';
  }
  /** 401: las claves no valen (mal copiadas, regeneradas o la app borrada). */
  get clavesMalas() { return this.estado === 401; }
  /** Las claves son de solo lectura: el Access Token se sacó antes de dar permiso de escritura. */
  get soloLectura() {
    return this.estado === 403 && (/oauth1-permissions/.test(this.tipo ?? '') || /not permitted/i.test(this.message));
  }
  /** X no deja publicar dos veces el mismo texto. */
  get duplicado() { return this.estado === 403 && /duplicate/i.test(this.message); }
  /** 402: la cuenta de desarrollador no tiene saldo ni plan con el que publicar. */
  get sinSaldo() { return this.estado === 402; }
  /** 429: X ha puesto tope por ahora. */
  get demasiadas() { return this.estado === 429; }
}

export interface ClienteX {
  /** De quién son las claves: comprueba que valen. */
  quienSoy(claves: ClavesX): Promise<{ cuentaId: string; usuario: string }>;
  /** Sube una foto y da su id, para ponerla en un post. */
  subirFoto(claves: ClavesX, jpeg: Buffer): Promise<string>;
  /** Publica un post, con foto o sin ella. */
  publicar(claves: ClavesX, texto: string, fotoId: string | null): Promise<{ id: string }>;
}

/** Como pide OAuth (RFC 3986): `encodeURIComponent` deja sin codificar !'()*. */
const codificar = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

/**
 * La cabecera Authorization de OAuth 1.0a (HMAC-SHA1). `parametros` son los de
 * la consulta y los de un cuerpo de formulario; uno JSON o multipart no entra
 * en la firma, así que ahí se pasan solo los de la consulta.
 *
 * `nonce` y `momento` se pasan en las pruebas, para comparar con el ejemplo de
 * la documentación de X; si no, salen al azar y de la hora.
 */
export function firmaOAuth(
  metodo: string,
  url: string,
  claves: ClavesX,
  parametros: Record<string, string> = {},
  { nonce = crypto.randomBytes(16).toString('hex'), momento = Math.floor(Date.now() / 1000) }: { nonce?: string; momento?: number } = {},
): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: claves.apiKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(momento),
    oauth_token: claves.accessToken,
    oauth_version: '1.0',
  };
  const todos = Object.entries({ ...parametros, ...oauth })
    .map(([k, v]) => [codificar(k), codificar(v)] as const)
    .sort(([a, va], [b, vb]) => (a === b ? (va < vb ? -1 : 1) : a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const base = `${metodo.toUpperCase()}&${codificar(url)}&${codificar(todos)}`;
  const clave = `${codificar(claves.apiSecret)}&${codificar(claves.accessSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', clave).update(base).digest('base64');
  return 'OAuth ' + Object.entries(oauth).map(([k, v]) => `${codificar(k)}="${codificar(v)}"`).join(', ');
}

async function llamar(claves: ClavesX, metodo: 'GET' | 'POST', ruta: string, cuerpo?: { json: unknown } | { formulario: FormData }): Promise<any> {
  const url = `${BASE}${ruta}`;
  const cabeceras: Record<string, string> = { Authorization: firmaOAuth(metodo, url, claves) };
  let body: string | FormData | undefined;
  if (cuerpo && 'json' in cuerpo) {
    cabeceras['Content-Type'] = 'application/json';
    body = JSON.stringify(cuerpo.json);
  } else if (cuerpo) {
    body = cuerpo.formulario; // fetch pone el Content-Type con su separador.
  }
  const respuesta = await fetch(url, { method: metodo, headers: cabeceras, body, signal: AbortSignal.timeout(30_000) });
  const datos: any = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    // X contesta con dos formas de error: la de la v2 (`detail`, `type`) y la antigua (`errors[]`).
    const mensaje = datos?.detail || datos?.errors?.[0]?.message || datos?.title || `X respondió ${respuesta.status}.`;
    throw new ErrorDeX(String(mensaje), respuesta.status, typeof datos?.type === 'string' ? datos.type : undefined);
  }
  return datos;
}

const clienteDeVerdad: ClienteX = {
  async quienSoy(claves) {
    const { data } = await llamar(claves, 'GET', '/2/users/me');
    return { cuentaId: String(data.id), usuario: String(data.username) };
  },

  async subirFoto(claves, jpeg) {
    // La subida de una vez, que vale hasta 5 MB; la de trozos es para vídeos.
    const formulario = new FormData();
    formulario.append('media', new Blob([new Uint8Array(jpeg)], { type: 'image/jpeg' }), 'foto.jpg');
    formulario.append('media_category', 'tweet_image');
    formulario.append('media_type', 'image/jpeg');
    const { data } = await llamar(claves, 'POST', '/2/media/upload', { formulario });
    return String(data.id);
  },

  async publicar(claves, texto, fotoId) {
    const { data } = await llamar(claves, 'POST', '/2/tweets', {
      json: { text: texto, ...(fotoId && { media: { media_ids: [fotoId] } }) },
    });
    return { id: String(data.id) };
  },
};

const sinRed = () => Promise.reject(new Error('En las pruebas no se llama a X: fija un cliente con fijarClienteDePrueba.'));
const sinRedEnPruebas: ClienteX = { quienSoy: sinRed, subirFoto: sinRed, publicar: sinRed };

let clienteDePrueba: ClienteX | null = null;

/** Para las pruebas: la X de mentira que contesta. Sin argumento, ninguna. */
export function fijarClienteDePrueba(cliente: ClienteX | null = null): void {
  clienteDePrueba = cliente;
}

export function x(): ClienteX {
  if (process.env.NODE_TEST_CONTEXT !== undefined) return clienteDePrueba ?? sinRedEnPruebas;
  return clienteDeVerdad;
}
