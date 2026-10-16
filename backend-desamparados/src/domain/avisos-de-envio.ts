import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Los avisos que manda el servicio de envío (Brevo) cuando un correo que ya
 * aceptó no llega: el rebote de verdad llega minutos después, del servidor del
 * destinatario, y sin este aviso el correo seguía como «Enviado».
 *
 * Todo puro. Qué se hace con cada aviso lo decide `correos/rebotes.service`.
 */

export type MotivoRebote = 'REBOTE' | 'INVALIDO' | 'BLOQUEADO' | 'SPAM';

export interface AvisoDeEnvio {
  /** En minúsculas, como la guarda la cola de correos. */
  email: string;
  /** Por qué no le llegan los correos; null si el aviso no lo dice (una baja). */
  motivo: MotivoRebote | null;
  /** Deja de recibir el boletín: lo pidió o se quejó de él. */
  bajaDelBoletin: boolean;
  /** Lo que contestó el servidor del destinatario, recortado. */
  detalle: string | null;
}

/**
 * Los eventos de Brevo que importan. El rebote blando (buzón lleno, servidor
 * caído) no está: Brevo reintenta, y si no llega acaba en un `hard_bounce`.
 * Tampoco las aperturas ni los clics: no se siguen.
 */
const EVENTOS: Record<string, { motivo: MotivoRebote | null; bajaDelBoletin: boolean }> = {
  hard_bounce: { motivo: 'REBOTE', bajaDelBoletin: false },
  invalid_email: { motivo: 'INVALIDO', bajaDelBoletin: false },
  blocked: { motivo: 'BLOQUEADO', bajaDelBoletin: false },
  // Quien marca un correo como no deseado no quiere más: además de no
  // escribirle, deja el boletín, que es lo único que recibe sin pedirlo.
  spam: { motivo: 'SPAM', bajaDelBoletin: true },
  unsubscribed: { motivo: null, bajaDelBoletin: true },
};

const esDireccion = (email: string) => email.length <= 191 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email);

/**
 * Lo que sirve del cuerpo de un aviso. Brevo manda un objeto por evento, o una
 * lista si el webhook se crea «por lotes»: se aceptan las dos. Lo que no se
 * entiende se descarta sin error: un evento nuevo de Brevo no puede hacer que
 * reintente el mismo aviso durante días.
 */
export function leerAvisos(cuerpo: unknown): AvisoDeEnvio[] {
  const lista = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
  const avisos: AvisoDeEnvio[] = [];
  for (const aviso of lista.slice(0, 500)) {
    if (!aviso || typeof aviso !== 'object') continue;
    const { event, email, reason } = aviso as Record<string, unknown>;
    if (typeof event !== 'string' || typeof email !== 'string') continue;
    const tipo = EVENTOS[event];
    const direccion = email.trim().toLowerCase();
    if (!tipo || !esDireccion(direccion)) continue;
    avisos.push({
      email: direccion,
      ...tipo,
      detalle: typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 250) : null,
    });
  }
  return avisos;
}

const huella = (texto: string) => createHash('sha256').update(texto, 'utf8').digest();

/**
 * Si la cabecera Authorization trae la clave del aviso. Brevo la pone de dos
 * formas según cómo se dé de alta el webhook: como token («Bearer …») o como
 * usuario y contraseña en la dirección (https://usuario:clave@…), que llega en
 * «Basic …»; ahí manda la contraseña y el usuario da igual. Se comparan las
 * huellas, de largo fijo, para no dar pistas por el tiempo que tarda.
 */
export function claveDelAvisoValida(cabecera: string | undefined, secreto: string): boolean {
  if (!cabecera || !secreto) return false;
  const [esquema, valor = ''] = cabecera.trim().split(/\s+/, 2);
  let recibida: string | null = null;
  if (/^bearer$/i.test(esquema)) recibida = valor;
  if (/^basic$/i.test(esquema)) {
    const claro = Buffer.from(valor, 'base64').toString('utf8');
    const dosPuntos = claro.indexOf(':');
    recibida = dosPuntos >= 0 ? claro.slice(dosPuntos + 1) : null;
  }
  return recibida !== null && timingSafeEqual(huella(recibida), huella(secreto));
}
