import { createHmac, timingSafeEqual } from 'node:crypto';
import { deArticulo, type Articulo } from './articulos.js';

/**
 * El boletín y los avisos masivos: a quién van, cómo se pasa el HTML del
 * editor del CMS a un correo y el enlace para darse de baja del boletín.
 *
 * Todo puro. Las consultas (quién está en el segmento) las hace el servicio.
 */

export type TipoComunicado = 'BOLETIN' | 'AVISO';

/** El nombre de una salida con su artículo, para componer `del Sábado de Pasión` / `de la Procesión Magna`. */
export interface SalidaDelSegmento { nombre: string; articulo: Articulo }

/** Los filtros del segmento. Vacíos, no filtran: todos los activos (o los suscritos, en el boletín). */
export interface Segmento {
  /** Solo quien tiene papeleta de esa salida (su id) este año. */
  conPapeleta?: number | null;
  /** Solo quien debe cuotas (pendientes o devueltas). */
  conDeuda?: boolean;
  edad?: 'MAYORES' | 'MENORES' | null;
  /** Solo quien vive en esa población. */
  poblacion?: string | null;
}

/**
 * «Suscritos al boletín · con papeleta del Sábado de Pasión · de Málaga», para
 * enseñar a quién va. `nombres` traduce el id de la salida a su nombre: las
 * salidas son filas del CMS y aquí no hay base de datos.
 */
export function describirSegmento(tipo: TipoComunicado, s: Segmento, salidas: ReadonlyMap<number, SalidaDelSegmento> = new Map()): string {
  const partes = [tipo === 'BOLETIN' ? 'Hermanos activos suscritos al boletín' : 'Hermanos activos'];
  if (s.conPapeleta) {
    const salida = salidas.get(s.conPapeleta);
    partes.push(salida ? `con papeleta ${deArticulo(salida.articulo, salida.nombre)}` : 'con papeleta de la salida');
  }
  if (s.conDeuda) partes.push('con cuotas pendientes');
  if (s.edad) partes.push(s.edad === 'MAYORES' ? 'mayores de edad' : 'menores de edad');
  if (s.poblacion?.trim()) partes.push(`de ${s.poblacion.trim()}`);
  return partes.join(' · ');
}

// --- Los destinatarios ---------------------------------------------------

export interface FichaDestinataria {
  nombre: string;
  sexo: 'HOMBRE' | 'MUJER' | null;
  /** El correo de la ficha, si lo tiene. */
  email: string | null;
  /** El de la cuenta de la que cuelga (el tutor, en los menores). */
  emailCuenta: string;
}

export interface Destinatario {
  email: string;
  /** Solo si la dirección es de una ficha: con varias (una familia), saludo general. */
  nombre: string | null;
  sexo: 'HOMBRE' | 'MUJER' | null;
}

/** Las direcciones que no son de nadie: la cuenta de custodia y las de la demo. */
const esDireccionReal = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.endsWith('.invalido');

/**
 * Un correo por dirección: una familia con tres fichas recibe uno. El de la
 * ficha si lo tiene, el de la cuenta si no (los menores, el de su tutor).
 */
export function destinatariosDe(fichas: FichaDestinataria[]): { destinatarios: Destinatario[]; sinCorreo: number } {
  const porCorreo = new Map<string, FichaDestinataria[]>();
  let sinCorreo = 0;
  for (const f of fichas) {
    const email = (f.email?.trim() || f.emailCuenta.trim()).toLowerCase();
    if (!esDireccionReal(email)) { sinCorreo += 1; continue; }
    porCorreo.set(email, [...(porCorreo.get(email) ?? []), f]);
  }
  const destinatarios = [...porCorreo.entries()].map(([email, lista]) => (
    lista.length === 1 ? { email, nombre: lista[0].nombre, sexo: lista[0].sexo } : { email, nombre: null, sexo: null }
  ));
  return { destinatarios, sinCorreo };
}

// --- El cuerpo, del editor al correo --------------------------------------

/**
 * El HTML del editor, ya saneado, con los estilos en línea que los programas
 * de correo respetan (casi ninguno lee una hoja de estilos) y las direcciones
 * relativas hechas absolutas: en el correo no hay «la web» a la que referirse.
 */
export function adaptarAlCorreo(html: string, web: string, api: string): string {
  const absoluta = (url: string) => {
    if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
    // Las subidas se sirven desde la API (API_URL/storage/public/…).
    if (url.startsWith('/storage/') || url.startsWith('/api/')) return `${api.replace(/\/+$/, '')}${url}`;
    return url.startsWith('/') ? `${web.replace(/\/+$/, '')}${url}` : url;
  };
  const estilos: Record<string, string> = {
    p: 'margin: 0 0 16px 0;',
    h2: 'margin: 26px 0 12px 0; font-size: 21px; line-height: 1.3;',
    h3: 'margin: 22px 0 10px 0; font-size: 18px; line-height: 1.3;',
    ul: 'margin: 0 0 16px 0; padding-left: 22px;',
    ol: 'margin: 0 0 16px 0; padding-left: 22px;',
    li: 'margin: 0 0 6px 0;',
    blockquote: 'margin: 0 0 16px 0; padding: 4px 0 4px 16px; border-left: 3px solid #d9cdb8; font-style: italic;',
    img: 'display: block; max-width: 100%; height: auto; margin: 8px 0 16px 0; border: 0;',
    a: 'color: #6d1a24; text-decoration: underline;',
  };
  return html
    .replace(/<(p|h2|h3|ul|ol|li|blockquote|img|a)(\s[^>]*)?>/gi, (_todo, etiqueta: string, atributos = '') => {
      const sinEstilo = atributos.replace(/\sstyle="[^"]*"/gi, '');
      return `<${etiqueta}${sinEstilo} style="${estilos[etiqueta.toLowerCase()]}">`;
    })
    .replace(/\s(src|href)="([^"]*)"/gi, (_todo, atributo: string, url: string) => ` ${atributo}="${absoluta(url)}"`);
}

// --- La baja del boletín ---------------------------------------------------

const base64url = (texto: string) => Buffer.from(texto, 'utf8').toString('base64url');
const firmaDe = (email: string, secreto: string) => createHmac('sha256', secreto).update(`baja-boletin:${email}`).digest('base64url').slice(0, 32);

/**
 * El enlace de baja lleva la dirección y su firma: quien lo pulsa se da de
 * baja sin entrar, y nadie puede dar de baja a otro cambiando la dirección.
 */
export function tokenDeBaja(email: string, secreto: string): string {
  const limpio = email.trim().toLowerCase();
  return `${base64url(limpio)}.${firmaDe(limpio, secreto)}`;
}

/** La dirección de un enlace de baja, si su firma es buena. */
export function emailDeToken(token: string, secreto: string): string | null {
  const [cuerpo, firma] = token.split('.');
  if (!cuerpo || !firma) return null;
  let email: string;
  try { email = Buffer.from(cuerpo, 'base64url').toString('utf8'); } catch { return null; }
  const esperada = firmaDe(email, secreto);
  if (firma.length !== esperada.length || !timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
  return email;
}
