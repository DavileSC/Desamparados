/**
 * Columnas de una fila de los listados de redacción (noticias, publicaciones).
 * En el móvil, foto y texto arriba y la acción debajo; el estado y la fecha
 * pasan a una línea bajo el título.
 *
 * Con `fotoVertical` (la portada de una publicación, 3:4) la columna de la
 * foto se estrecha: a 72 px de ancho, cada fila mediría cerca de 100 de alto.
 */
export function rejillaFila(fotoVertical = false) {
  const foto = fotoVertical ? { xs: '44px', md: '48px' } : { xs: '56px', md: '72px' }
  return {
    display: 'grid',
    columnGap: 2,
    rowGap: 1,
    alignItems: 'center',
    gridTemplateColumns: { xs: `${foto.xs} minmax(0, 1fr)`, md: `${foto.md} minmax(0, 1fr) 116px 140px 196px` },
    gridTemplateAreas: { xs: '"foto texto" ". acciones"', md: '"foto texto estado fecha acciones"' },
  } as const
}
