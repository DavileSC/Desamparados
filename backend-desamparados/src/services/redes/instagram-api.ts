/**
 * Las llamadas a la API de Instagram (la «API de Instagram con inicio de
 * sesión de Instagram», que no necesita página de Facebook).
 *
 * Sin versión en la URL a propósito: una fija caduca a los dos años y dejaría
 * de publicar sin que nadie tocara nada. Estos cinco puntos no han cambiado
 * de forma entre versiones.
 *
 * El token viaja en el cuerpo o en la consulta, nunca en un registro: los
 * errores que se escriben llevan el mensaje de Instagram, no la URL.
 *
 * Dentro de `node --test` no se sale a la red: lo que se haga va al cliente
 * que ponga la prueba con `fijarClienteDePrueba`, y sin él, falla.
 */

const BASE = 'https://graph.instagram.com';
/** Lo que se espera a que Instagram descargue la foto antes de darla por fallida. */
const ESPERAS_AL_PREPARAR = 10;
const PAUSA_AL_PREPARAR = 2000;

/** Un error que dice Instagram, con su código para distinguir el token caducado. */
export class ErrorDeInstagram extends Error {
  constructor(mensaje: string, readonly codigo?: number) {
    super(mensaje);
    this.name = 'ErrorDeInstagram';
  }
  /** 190: el token ya no vale (caducado, revocado o la contraseña cambiada). */
  get tokenCaducado() { return this.codigo === 190; }
}

export interface ClienteInstagram {
  /** Para quién es el token: comprueba que vale y que es una cuenta profesional. */
  quienSoy(token: string): Promise<{ cuentaId: string; usuario: string; tipo: string }>;
  /** Un token nuevo de 60 días a partir del actual. */
  renovar(token: string): Promise<{ token: string; caducaEn: number }>;
  /** Publica una foto con su pie. `imagen` es una URL pública. */
  publicarFoto(token: string, cuentaId: string, imagen: string, pie: string): Promise<{ id: string; enlace: string | null }>;
}

async function llamar(metodo: 'GET' | 'POST', ruta: string, parametros: Record<string, string>): Promise<any> {
  const datos = new URLSearchParams(parametros);
  const respuesta = metodo === 'GET'
    ? await fetch(`${BASE}${ruta}?${datos}`, { signal: AbortSignal.timeout(30_000) })
    : await fetch(`${BASE}${ruta}`, { method: 'POST', body: datos, signal: AbortSignal.timeout(30_000) });
  const cuerpo: any = await respuesta.json().catch(() => null);
  if (!respuesta.ok || cuerpo?.error) {
    const error = cuerpo?.error;
    // `error_user_msg` es el que Meta escribe para personas; el otro, para programadores.
    throw new ErrorDeInstagram(error?.error_user_msg || error?.message || `Instagram respondió ${respuesta.status}.`, error?.code);
  }
  return cuerpo;
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

const clienteDeVerdad: ClienteInstagram = {
  async quienSoy(token) {
    const yo = await llamar('GET', '/me', { fields: 'user_id,username,account_type', access_token: token });
    return { cuentaId: String(yo.user_id), usuario: String(yo.username), tipo: String(yo.account_type ?? '') };
  },

  async renovar(token) {
    const nuevo = await llamar('GET', '/refresh_access_token', { grant_type: 'ig_refresh_token', access_token: token });
    return { token: String(nuevo.access_token), caducaEn: Number(nuevo.expires_in) };
  },

  async publicarFoto(token, cuentaId, imagen, pie) {
    // Tres pasos: el contenedor (Instagram se descarga la foto), esperar a que
    // esté listo y publicarlo. Publicar antes de FINISHED da error.
    const contenedor = await llamar('POST', `/${cuentaId}/media`, { image_url: imagen, caption: pie, access_token: token });
    for (let intento = 0; ; intento++) {
      const { status_code: estado } = await llamar('GET', `/${contenedor.id}`, { fields: 'status_code', access_token: token });
      if (estado === 'FINISHED') break;
      if (estado === 'ERROR' || estado === 'EXPIRED') throw new ErrorDeInstagram('Instagram no ha podido preparar la foto.');
      if (intento >= ESPERAS_AL_PREPARAR) throw new ErrorDeInstagram('Instagram tarda demasiado en preparar la foto. Prueba otra vez en un rato.');
      await pausa(PAUSA_AL_PREPARAR);
    }
    const publicada = await llamar('POST', `/${cuentaId}/media_publish`, { creation_id: contenedor.id, access_token: token });
    // El enlace es un lujo: si no llega, la publicación ya está hecha.
    const enlace = await llamar('GET', `/${publicada.id}`, { fields: 'permalink', access_token: token })
      .then((m) => (typeof m.permalink === 'string' ? m.permalink : null))
      .catch(() => null);
    return { id: String(publicada.id), enlace };
  },
};

const sinRedEnPruebas: ClienteInstagram = {
  quienSoy: () => Promise.reject(new Error('En las pruebas no se llama a Instagram: fija un cliente con fijarClienteDePrueba.')),
  renovar: () => Promise.reject(new Error('En las pruebas no se llama a Instagram: fija un cliente con fijarClienteDePrueba.')),
  publicarFoto: () => Promise.reject(new Error('En las pruebas no se llama a Instagram: fija un cliente con fijarClienteDePrueba.')),
};

let clienteDePrueba: ClienteInstagram | null = null;

/** Para las pruebas: el Instagram de mentira que contesta. Sin argumento, ninguno. */
export function fijarClienteDePrueba(cliente: ClienteInstagram | null = null): void {
  clienteDePrueba = cliente;
}

export function instagram(): ClienteInstagram {
  if (process.env.NODE_TEST_CONTEXT !== undefined) return clienteDePrueba ?? sinRedEnPruebas;
  return clienteDeVerdad;
}
