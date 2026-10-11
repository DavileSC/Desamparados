/**
 * Cómo se puede ordenar cada listado del CMS.
 *
 * El cliente pide un nombre (`?orden=numero`), nunca un campo: así no puede
 * ordenar por el IBAN ni por una columna sin índice, y el esquema de cada ruta
 * rechaza con 400 lo que no esté aquí. Cada orden acaba en el `id`: con
 * skip/take, un criterio con empates (dos «Pérez», veinte recibos del mismo
 * `createdAt`) deja que MariaDB los reparta a su antojo entre la página 1 y la
 * 2, y uno saldría dos veces y otro ninguna.
 *
 * Lo que puede faltar (número de hermano, categoría, talla) va al final en los
 * dos sentidos: una lista por número que empieza con cuarenta fichas sin número
 * no sirve para buscar el 12.
 */
import type { Prisma } from '@prisma/client';

const alFinal = (sort: Prisma.SortOrder) => ({ sort, nulls: 'last' as const });

export const ORDENES_CENSO = {
  apellidos: [{ apellidos: 'asc' }, { nombre: 'asc' }, { id: 'asc' }],
  numero: [{ numeroHermano: alFinal('asc') }, { apellidos: 'asc' }, { id: 'asc' }],
  antiguedad: [{ fechaAlta: 'asc' }, { id: 'asc' }],
  recientes: [{ fechaAlta: 'desc' }, { id: 'desc' }],
} satisfies Record<string, Prisma.HermanoOrderByWithRelationInput[]>;

export const ORDENES_ENSERES = {
  nombre: [{ nombre: 'asc' }, { id: 'asc' }],
  categoria: [{ categoria: alFinal('asc') }, { nombre: 'asc' }, { id: 'asc' }],
  ubicacion: [{ ubicacion: alFinal('asc') }, { nombre: 'asc' }, { id: 'asc' }],
  unidades: [{ cantidadTotal: 'desc' }, { nombre: 'asc' }, { id: 'asc' }],
  reparar: [{ cantidadReparar: 'desc' }, { nombre: 'asc' }, { id: 'asc' }],
} satisfies Record<string, Prisma.EnserOrderByWithRelationInput[]>;

export const ORDENES_PRENDAS = {
  numero: [{ numero: 'asc' }, { id: 'asc' }],
  tipo: [{ tipo: 'asc' }, { numero: 'asc' }, { id: 'asc' }],
  estado: [{ estado: 'asc' }, { numero: 'asc' }, { id: 'asc' }],
  talla: [{ talla: alFinal('asc') }, { numero: 'asc' }, { id: 'asc' }],
} satisfies Record<string, Prisma.PrendaOrderByWithRelationInput[]>;

export const ORDENES_RECIBOS = {
  recientes: [{ year: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
  antiguos: [{ year: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  hermano: [{ hermano: { apellidos: 'asc' } }, { hermano: { nombre: 'asc' } }, { year: 'desc' }, { id: 'asc' }],
  numero: [{ hermano: { numeroHermano: alFinal('asc') } }, { year: 'desc' }, { id: 'asc' }],
  importeDesc: [{ importe: 'desc' }, { year: 'desc' }, { id: 'asc' }],
  importeAsc: [{ importe: 'asc' }, { year: 'desc' }, { id: 'asc' }],
} satisfies Record<string, Prisma.ReciboOrderByWithRelationInput[]>;

export const ORDENES_LIBRO = {
  recientes: [{ fecha: 'desc' }, { id: 'asc' }],
  antiguos: [{ fecha: 'asc' }, { id: 'asc' }],
  importeDesc: [{ importe: 'desc' }, { fecha: 'desc' }, { id: 'asc' }],
  importeAsc: [{ importe: 'asc' }, { fecha: 'desc' }, { id: 'asc' }],
  concepto: [{ concepto: 'asc' }, { fecha: 'desc' }, { id: 'asc' }],
} satisfies Record<string, Prisma.TransaccionOrderByWithRelationInput[]>;

/**
 * El orden pedido, o el primero de la tabla si no se pidió ninguno (o si llega
 * uno desconocido sin pasar por el esquema, como desde un script).
 */
export function ordenDe<T>(tabla: Record<string, T>, pedido: unknown): T {
  const claves = Object.keys(tabla);
  return typeof pedido === 'string' && claves.includes(pedido) ? tabla[pedido] : tabla[claves[0]];
}

