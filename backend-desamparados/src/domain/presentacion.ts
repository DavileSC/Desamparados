import catalogo from '../../../shared/presentacion-de-bloques.json' with { type: 'json' };
import topes from '../../../shared/topes-contenido.json' with { type: 'json' };
import { ANCLA } from './destinos.js';
import { esImagenPropia } from '../utils/rutas-propias.js';

/**
 * La presentación de un bloque: cómo se ve (fondo, ancho, espaciado, su
 * variante…), no qué dice. Es opcional y cada opción también: lo que falta se
 * pinta como siempre, porque el primer valor de cada lista del catálogo
 * (`shared/presentacion-de-bloques.json`) es el aspecto de antes.
 *
 * Se valida a mano y no con un esquema de arktype por dos razones: las
 * opciones salen de un JSON (un `type({...})` construido en un bucle pierde
 * sus tipos) y los mensajes tienen que decir qué opción falla con su nombre,
 * que es lo que el CMS enseña.
 */

type Opcion = { valores: string[] } | { siNo: boolean };

const COMUNES = catalogo.comunes as Record<string, Opcion>;
const POR_TIPO = catalogo.porTipo as Record<string, Record<string, Opcion>>;

/** Los campos de texto con reglas propias, comunes a todos los bloques. */
const LIBRES = ['fondoFoto', 'ancla', 'desde', 'hasta'] as const;

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Una fecha del calendario de verdad: 2026-02-30 tiene la forma, pero no existe. */
function esFecha(valor: string): boolean {
  const partes = FECHA.exec(valor);
  if (!partes) return false;
  const [anio, mes, dia] = partes.slice(1).map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

/** Las opciones que admite un tipo de bloque: las comunes y las suyas. */
const opcionesDe = (tipo: string): Record<string, Opcion> => ({ ...COMUNES, ...POR_TIPO[tipo] });

interface ProblemaDePresentacion { campo: string; problema: string }

/**
 * Qué falla en la presentación de un bloque, o `null` si está bien (o no hay).
 * `campo` es la opción, para que el error diga cuál.
 */
export function problemaDePresentacion(tipo: string, presentacion: unknown): ProblemaDePresentacion | null {
  if (presentacion === undefined) return null;
  if (typeof presentacion !== 'object' || presentacion === null || Array.isArray(presentacion)) {
    return { campo: '', problema: 'tiene que ser un objeto con las opciones' };
  }
  const opciones = opcionesDe(tipo);
  const datos = presentacion as Record<string, unknown>;

  for (const [campo, valor] of Object.entries(datos)) {
    if ((LIBRES as readonly string[]).includes(campo)) {
      if (typeof valor !== 'string') return { campo, problema: 'tiene que ser un texto' };
      continue;
    }
    const opcion = opciones[campo];
    // Una opción de otro tipo de bloque o inventada: se rechaza en vez de
    // guardarla, o se quedaría en el documento sin hacer nada.
    if (!opcion) return { campo, problema: 'no es una opción de este bloque' };
    if ('siNo' in opcion) {
      if (typeof valor !== 'boolean') return { campo, problema: 'tiene que ser sí o no' };
    } else if (typeof valor !== 'string' || !opcion.valores.includes(valor)) {
      return { campo, problema: `tiene que ser uno de: ${opcion.valores.join(', ')}` };
    }
  }

  const texto = (campo: string) => (typeof datos[campo] === 'string' ? (datos[campo] as string) : '');

  const fondoFoto = texto('fondoFoto');
  if (fondoFoto !== '' && !esImagenPropia(fondoFoto)) {
    return { campo: 'fondoFoto', problema: 'tiene que ser una foto subida desde el CMS' };
  }
  if (datos.fondo === 'foto' && fondoFoto === '') {
    return { campo: 'fondoFoto', problema: 'falta: el fondo de foto necesita una foto' };
  }

  const ancla = texto('ancla');
  if (ancla !== '' && (ancla.length > topes.ancla || !ANCLA.test(ancla))) {
    return { campo: 'ancla', problema: `solo minúsculas, cifras y guiones, hasta ${topes.ancla}` };
  }

  const desde = texto('desde');
  const hasta = texto('hasta');
  if (desde !== '' && !esFecha(desde)) return { campo: 'desde', problema: 'no es una fecha' };
  if (hasta !== '' && !esFecha(hasta)) return { campo: 'hasta', problema: 'no es una fecha' };
  // Las dos son AAAA-MM-DD: se comparan como texto.
  if (desde !== '' && hasta !== '' && desde > hasta) {
    return { campo: 'hasta', problema: 'es anterior a «desde»: el bloque no se vería nunca' };
  }
  return null;
}

/** El ancla de un bloque, o `''`. */
export const anclaDe = (bloque: unknown): string => {
  const presentacion = (bloque as { presentacion?: { ancla?: unknown } } | null)?.presentacion;
  return typeof presentacion?.ancla === 'string' ? presentacion.ancla : '';
};
