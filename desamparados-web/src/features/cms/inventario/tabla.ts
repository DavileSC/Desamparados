/** La fila de cabecera de las tablas del inventario, como la del libro de caja. */
export const cabeceraTabla = (fondo: string) => ({
  '& th': { fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', backgroundColor: fondo, whiteSpace: 'nowrap' },
}) as const

/** Texto solo para el lector de pantalla: la columna de acciones no necesita título a la vista. */
export const soloLector = { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const
