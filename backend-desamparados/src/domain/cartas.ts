/**
 * Los campos de una carta: lo que Secretaría escribe entre llaves dobles
 * («{{nombre}}») y se rellena con los datos de cada hermano al imprimirla.
 */

const CAMPOS_DE_CARTA = ['saludo', 'tratamiento', 'nombre', 'apellidos', 'numero'] as const;
type CampoDeCarta = (typeof CAMPOS_DE_CARTA)[number];

export interface DestinatarioDeCarta {
  nombre: string;
  apellidos: string;
  sexo: 'HOMBRE' | 'MUJER' | null;
  tratamiento: string | null;
  numeroHermano: number | null;
}

/** El tratamiento que se le da: el de su ficha o, si no, «D.» / «Dña.» según el sexo (vacío sin sexo). */
export function tratamientoDe(d: DestinatarioDeCarta): string {
  return d.tratamiento?.trim() || (d.sexo === 'MUJER' ? 'Dña.' : d.sexo === 'HOMBRE' ? 'D.' : '');
}

/** «Estimado» / «Estimada» / «Estimado/a», como en los correos. */
const saludoDe = (d: DestinatarioDeCarta) => (d.sexo === 'MUJER' ? 'Estimada' : d.sexo === 'HOMBRE' ? 'Estimado' : 'Estimado/a');

/** El valor de cada campo para un hermano. */
function valoresDe(d: DestinatarioDeCarta): Record<CampoDeCarta, string> {
  return {
    saludo: saludoDe(d),
    tratamiento: tratamientoDe(d),
    nombre: d.nombre,
    apellidos: d.apellidos,
    numero: d.numeroHermano ? String(d.numeroHermano) : '',
  };
}

/**
 * Rellena los campos. Admite espacios dentro de las llaves y mayúsculas
 * («{{ Nombre }}»); un campo que no existe se deja tal cual, para que se vea
 * en la vista previa que está mal escrito en vez de desaparecer.
 */
export function rellenar(texto: string, d: DestinatarioDeCarta): string {
  const valores = valoresDe(d);
  return texto.replace(/\{\{\s*([a-zA-Záéíóú]+)\s*\}\}/g, (entero, campo: string) => {
    const clave = campo.toLowerCase() as CampoDeCarta;
    return (CAMPOS_DE_CARTA as readonly string[]).includes(clave) ? valores[clave] : entero;
  }).replace(/ {2,}/g, ' ');
}

/** Los campos mal escritos de un texto: los que no se van a rellenar. */
export function camposDesconocidos(texto: string): string[] {
  const vistos = [...texto.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(vistos.filter((c) => !(CAMPOS_DE_CARTA as readonly string[]).includes(c.toLowerCase())))];
}
