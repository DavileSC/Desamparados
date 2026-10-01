// prisma/seed-salidas.ts

import { CobroSalida, FechaSalida, type Prisma } from '@prisma/client';
import db from '../src/config/db';
import type { PuestoDelCatalogo } from '../src/domain/salidas';

/**
 * Las dos salidas de siempre, con los mismos valores que les dio la migración
 * `salidas_configurables`. Los puestos vivían en shared/puestos-procesion.json;
 * desde que las salidas son filas del CMS, este es su único origen en el
 * código: lo que se cambie después se cambia en el CMS.
 */

const PUESTOS_PASION: PuestoDelCatalogo[] = [
  { nombre: 'Nazareno', tunica: true, tocado: 'CAPIROTE', alturaHombro: false },
  { nombre: 'Trono', tunica: true, tocado: null, alturaHombro: true },
  { nombre: 'Guardería', tunica: true, tocado: 'FARAONA', alturaHombro: false },
  { nombre: 'Viacrucis', tunica: true, tocado: 'CAPIROTE', alturaHombro: false },
  { nombre: 'Bocina', tunica: true, tocado: 'CAPIROTE', alturaHombro: false },
  { nombre: 'Diputado de tramo', tunica: true, tocado: 'CAPIROTE', alturaHombro: false },
  { nombre: 'Acólito', tunica: true, tocado: null, alturaHombro: false },
  { nombre: 'Monaguillo', tunica: true, tocado: null, alturaHombro: false },
  { nombre: 'Monaguillo guardería', tunica: true, tocado: null, alturaHombro: false },
  { nombre: 'Mayordomo guardería', tunica: true, tocado: null, alturaHombro: false },
  { nombre: 'Mantilla', tunica: false, tocado: null, alturaHombro: false },
];

// En el Rosario vespertino se va de traje: nadie lleva túnica.
const PUESTOS_ROSARIO: PuestoDelCatalogo[] = [
  { nombre: 'Cruz de guía', tunica: false, tocado: null, alturaHombro: false },
  { nombre: 'Farol', tunica: false, tocado: null, alturaHombro: false },
  { nombre: 'Estandarte', tunica: false, tocado: null, alturaHombro: false },
  { nombre: 'Simpecado', tunica: false, tocado: null, alturaHombro: false },
  { nombre: 'Vela', tunica: false, tocado: null, alturaHombro: false },
  { nombre: 'Rezo de un misterio', tunica: false, tocado: null, alturaHombro: false },
  { nombre: 'Acólito', tunica: false, tocado: null, alturaHombro: false },
  { nombre: 'Trono', tunica: false, tocado: null, alturaHombro: true },
];

export const SALIDAS_DE_SIEMPRE: Prisma.SalidaCreateInput[] = [
  {
    slug: 'sabado-de-pasion',
    nombre: 'Sábado de Pasión',
    articulo: 'el',
    orden: 1,
    conRopa: true,
    cobro: CobroSalida.CUOTA,
    importeCuota: 0,
    fecha: FechaSalida.PASCUA,
    diasDesdePascua: -8,
    puestos: PUESTOS_PASION as unknown as Prisma.InputJsonValue,
    indicaciones: 'Se ruega puntualidad y decoro en la vestimenta. Es obligatorio portar la medalla del Grupo Parroquial y calzado oscuro. Guarde silencio durante la formación.',
  },
  {
    slug: 'rosario-vespertino',
    nombre: 'Rosario vespertino',
    articulo: 'el',
    orden: 2,
    conRopa: false,
    cobro: CobroSalida.DONATIVO,
    fecha: FechaSalida.MANUAL,
    puestos: PUESTOS_ROSARIO as unknown as Prisma.InputJsonValue,
    indicaciones: 'Se va en traje oscuro, con la medalla del Grupo Parroquial. Se ruega puntualidad y recogimiento durante el rezo.',
  },
];

/** Crea las que falten. Las que ya existen no se tocan: desde ahí las edita el CMS. */
export async function sembrarSalidas(): Promise<void> {
  for (const salida of SALIDAS_DE_SIEMPRE) {
    await db.salida.upsert({ where: { slug: salida.slug }, update: {}, create: salida });
  }
  console.log(`   ${SALIDAS_DE_SIEMPRE.length} salidas procesionales`);
}
