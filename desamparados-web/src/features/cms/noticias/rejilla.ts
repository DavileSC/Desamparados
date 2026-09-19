/**
 * Columnas de una fila del listado. En el móvil, foto y texto arriba y la
 * acción debajo; el estado y la fecha pasan a una línea bajo el título.
 */
export const REJILLA_FILA = {
  display: 'grid',
  columnGap: 2,
  rowGap: 1,
  alignItems: 'center',
  gridTemplateColumns: { xs: '56px minmax(0, 1fr)', md: '72px minmax(0, 1fr) 116px 140px 196px' },
  gridTemplateAreas: { xs: '"foto texto" ". acciones"', md: '"foto texto estado fecha acciones"' },
} as const
