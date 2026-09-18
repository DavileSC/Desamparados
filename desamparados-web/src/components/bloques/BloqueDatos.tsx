import { Box, Typography } from '@mui/material'
import type { BloqueDatos as Datos } from '../../lib/api/contenido'

/**
 * Pares de etiqueta y valor: el horario de los cultos, los datos de la
 * parroquia, las medidas de un enser.
 *
 * Va en una lista de definiciones (`<dl>`) y no en una tabla ni en dos
 * columnas de `<div>`: es exactamente lo que es —un término y lo que vale—, y
 * así un lector de pantalla anuncia cada valor junto al nombre al que
 * pertenece en vez de leer dos listas sueltas.
 *
 * Un valor vacío es legítimo: el servidor solo exige la etiqueta, con el mismo
 * criterio que `shared/datos-entidad.json` —lo que el Grupo Parroquial aún no
 * ha confirmado se deja en blanco antes que inventarlo—.
 */
export default function BloqueDatos({ bloque }: { bloque: Datos }) {
  return (
    <Box
      component="dl"
      sx={{
        maxWidth: '850px', mx: 'auto', my: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(0, 2fr)' },
        columnGap: 3,
      }}
    >
      {bloque.lineas.map((linea, indice) => (
        <Box
          key={`${linea.etiqueta}-${indice}`}
          sx={{
            display: 'contents',
            // El borde va en las celdas, no aquí: `display: contents` saca a
            // este Box de la rejilla y con él cualquier estilo propio.
            '& > *': {
              py: 1.5,
              borderTop: indice === 0 ? 0 : 1,
              borderColor: 'rgba(204, 196, 201, 0.1)',
            },
          }}
        >
          <Typography component="dt" variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
            {linea.etiqueta}
          </Typography>
          <Typography component="dd" variant="body2" sx={{ color: 'text.secondary', m: 0, lineHeight: 1.7 }}>
            {linea.valor}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}
