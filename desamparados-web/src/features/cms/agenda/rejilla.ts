/**
 * Columnas de una fila de la agenda. En el móvil, el día y el texto arriba y
 * las acciones debajo; el tipo pasa bajo el título.
 */
export const rejillaEvento = {
  display: 'grid',
  columnGap: 2,
  rowGap: 1,
  alignItems: 'center',
  gridTemplateColumns: { xs: '48px minmax(0, 1fr)', md: '56px minmax(0, 1fr) 132px 196px' },
  gridTemplateAreas: { xs: '"dia texto" ". acciones"', md: '"dia texto tipo acciones"' },
} as const
