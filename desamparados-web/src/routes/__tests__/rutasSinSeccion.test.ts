import { describe, it, expect } from 'vitest'
import fuente from '../index.tsx?raw'

describe('las rutas declaradas', () => {
  it('ninguna empieza por un parámetro: cada una cuelga de su sección', () => {
    // El 25-09-2026, al quitar a las páginas públicas el prefijo de su sección,
    // la ficha del censo se quedó en `:id/editar` en vez de
    // `hermanos/:id/editar`: «Editar ficha» llevaba a la página de no
    // encontrada y nadie lo vio en seis semanas. Una ruta que empieza por un
    // parámetro se traga cualquier dirección de dos tramos.
    const sueltas = [...fuente.matchAll(/path: '(:[^']*)'/g)].map((m) => m[1])
    expect(sueltas).toEqual([])
  })
})
