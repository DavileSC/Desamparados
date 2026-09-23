import { Box, Typography } from '@mui/material'

interface Props {
  titulo: string
  columnas: string[]
  filas: (string | number)[][]
}

/**
 * Los mismos datos de la gráfica, en tabla. Va plegada en un `<details>`: el
 * resumen ya es un control con teclado y no hace falta estado ni diálogo.
 */
export default function TablaDeDatos({ titulo, columnas, filas }: Props) {
  if (filas.length === 0) return null

  return (
    <Box component="details" sx={{ mt: 0.5 }}>
      <Box
        component="summary"
        sx={{
          cursor: 'pointer', listStyle: 'none', display: 'inline-flex', alignItems: 'center',
          // El granate primario no llega a 3:1 sobre la tarjeta oscura: en oscuro, rosa.
          fontSize: 13, fontWeight: 600, color: 'light-dark(#6e1822, #ffb3b4)',
          '&::-webkit-details-marker': { display: 'none' },
        }}
      >
        Ver tabla
      </Box>
      <Box sx={{ mt: 1.5, overflowX: 'auto' }}>
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <Box component="caption" sx={{ textAlign: 'left', pb: 1 }}>
            <Typography variant="caption" color="text.secondary">{titulo}</Typography>
          </Box>
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
