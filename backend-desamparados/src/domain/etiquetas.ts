/**
 * Las etiquetas postales: la dirección de cada hermano en una hoja A4 de
 * etiquetas adhesivas, para los que no reciben nada por correo electrónico.
 *
 * Los formatos de hoja están en `shared/formatos-de-etiquetas.json`: la web
 * los ofrece con el mismo nombre con que aquí se dibujan.
 */
import hojas from '../../../shared/formatos-de-etiquetas.json' with { type: 'json' };
import { tratamientoDe, type DestinatarioDeCarta } from './cartas.js';

export interface FormatoDeEtiquetas {
  nombre: string;
  columnas: number;
  filas: number;
  /** Todo en milímetros: ancho y alto de cada etiqueta, márgenes de la hoja y paso de una a la siguiente. */
  ancho: number;
  alto: number;
  izquierda: number;
  arriba: number;
  pasoX: number;
  pasoY: number;
}

export const FORMATOS_DE_ETIQUETAS: Record<string, FormatoDeEtiquetas> = hojas.formatos;

export const CLAVES_DE_FORMATO = Object.keys(FORMATOS_DE_ETIQUETAS);
export const porHoja = (f: FormatoDeEtiquetas) => f.columnas * f.filas;

interface ConDireccion {
  direccion: string | null;
  codigoPostal: string | null;
  poblacion: string | null;
  provincia: string | null;
}

export interface DestinatarioPostal extends DestinatarioDeCarta, ConDireccion {
  esTitular?: boolean;
}

/** Lo que se escribe en una etiqueta (o en la ventana del sobre): a quién y dónde. */
export interface Sobre extends ConDireccion {
  aQuien: string;
}

const vacio = (s: string | null | undefined) => !s || !s.trim();
export const tieneDireccion = (d: ConDireccion) => !vacio(d.direccion);

export const nombreCompleto = (d: DestinatarioDeCarta) => [tratamientoDe(d), d.nombre, d.apellidos].filter(Boolean).join(' ');

/** Las líneas de la dirección, sin las que falten; la provincia, solo si no es la misma población. */
export function lineasDeDireccion(s: Sobre): string[] {
  const localidad = [s.codigoPostal, s.poblacion].filter(Boolean).join(' ');
  const provincia = s.provincia && s.provincia.trim().toLowerCase() !== s.poblacion?.trim().toLowerCase() ? `(${s.provincia})` : null;
  return [s.aQuien, s.direccion, [localidad, provincia].filter(Boolean).join(' ')].filter((l): l is string => Boolean(l && l.trim()));
}

/** La misma casa aunque se haya escrito distinto: sin mayúsculas, tildes, puntos ni espacios de más. */
const claveDeDomicilio = (d: ConDireccion) => [d.direccion, d.codigoPostal]
  .map((p) => (p ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[.,º°ª/\\-]/g, ' ').replace(/\s+/g, ' ').trim())
  .join('|');

/**
 * Una etiqueta por hermano o, `porDomicilio`, una por casa: si en la misma
 * dirección viven varios, la etiqueta va a la «Familia» con los apellidos del
 * titular (o del primero, si el titular no sale en la búsqueda). Los que no
 * tienen dirección no tienen etiqueta: se cuentan aparte.
 */
export function sobresDe(destinatarios: DestinatarioPostal[], porDomicilio: boolean): Sobre[] {
  const conDireccion = destinatarios.filter(tieneDireccion);
  if (!porDomicilio) return conDireccion.map((d) => ({ ...direccionDe(d), aQuien: nombreCompleto(d) }));
  const casas = new Map<string, DestinatarioPostal[]>();
  for (const d of conDireccion) {
    const clave = claveDeDomicilio(d);
    casas.set(clave, [...(casas.get(clave) ?? []), d]);
  }
  return [...casas.values()].map((vecinos) => {
    const cabeza = vecinos.find((v) => v.esTitular) ?? vecinos[0];
    return { ...direccionDe(cabeza), aQuien: vecinos.length === 1 ? nombreCompleto(cabeza) : `Familia ${cabeza.apellidos}` };
  });
}

const direccionDe = (d: ConDireccion): ConDireccion => ({ direccion: d.direccion, codigoPostal: d.codigoPostal, poblacion: d.poblacion, provincia: d.provincia });

/**
 * Dónde cae la etiqueta número `i` (contando las que se saltan al principio,
 * las que ya se gastaron de una hoja empezada): hoja, y esquina en milímetros.
 * Se rellena por filas, de izquierda a derecha, como se leen.
 */
export function posicionDe(f: FormatoDeEtiquetas, i: number): { hoja: number; x: number; y: number } {
  const n = porHoja(f);
  const enHoja = i % n;
  return {
    hoja: Math.floor(i / n),
    x: f.izquierda + (enHoja % f.columnas) * f.pasoX,
    y: f.arriba + Math.floor(enHoja / f.columnas) * f.pasoY,
  };
}
