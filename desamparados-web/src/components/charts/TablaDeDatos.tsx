import { Box } from '@mui/material'

interface Props {
  titulo: string
  columnas: string[]
  filas: (string | number)[][]
}

/** Fuera de la vista, pero en la página: la leen los lectores de pantalla. */
const OCULTA = {
  position: 'absolute', width: 1, height: 1, p: 0, m: '-1px', overflow: 'hidden',
  clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0,
} as const

/**
 * Los mismos datos de la gráfica, en tabla, solo para lectores de pantalla:
 * quien ve la gráfica no la necesita (antes iba plegada tras un «Ver tabla»
 * que se quitó del Inicio), pero quien no la ve sí.
 */
export default function TablaDeDatos({ titulo, columnas, filas }: Props) {
  if (filas.length === 0) return null

  return (
    <Box sx={OCULTA}>
      <Box>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <caption>{titulo}</caption>
          <thead>
            <tr>
              {columnas.map((columna, i) => (
                <Box
                  key={columna}
                  component="th"
                  scope="col"
                  sx={{
                    textAlign: i === 0 ? 'left' : 'right', py: 0.75, px: 1,
                    borderBottom: 1, borderColor: 'divider', color: 'text.secondary', fontWeight: 600,
                  }}
                >
                  {columna}
                </Box>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={String(fila[0])}>
                {fila.map((celda, i) => (
                  <Box
                    key={columnas[i]}
                    component="td"
                    sx={{
                      textAlign: i === 0 ? 'left' : 'right', py: 0.75, px: 1,
                      borderBottom: 1, borderColor: 'divider',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {celda}
                  </Box>
                ))}
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
    </Box>
  )
}
