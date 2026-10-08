import { Box, Typography } from '@mui/material'
import { anchoMaximo, valorDe } from './presentacion'
import type { BloqueDatos as Datos } from '../../lib/api/contenido'

/**
 * Pares de etiqueta y valor: el horario de los cultos, los datos de la
 * parroquia, las medidas de un enser. En lista (la de siempre), en cuadrícula
 * (cada par en su recuadro, el valor en grande) o en tabla con filas marcadas.
 *
 * Va siempre en una lista de definiciones (`<dl>`) y no en una tabla ni en dos
 * columnas de `<div>`: es exactamente lo que es —un término y lo que vale—, y
 * así un lector de pantalla anuncia cada valor junto al nombre al que
 * pertenece en vez de leer dos listas sueltas.
 *
 * Un valor vacío es legítimo: el servidor solo exige la etiqueta, con el mismo
 * criterio que `instalacion/datos-entidad.json` —lo que el Grupo Parroquial aún no
 * ha confirmado se deja en blanco antes que inventarlo—.
 */
export default function BloqueDatos({ bloque }: { bloque: Datos }) {
  const disposicion = valorDe(bloque, 'disposicion')

  if (disposicion === 'cuadricula') {
    return (
      <Box component="dl" sx={{
        maxWidth: anchoMaximo(bloque, '1100px'), mx: 'auto', my: 0,
        display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' }, gap: 2,
      }}>
        {bloque.lineas.map((linea, indice) => (
          <Box key={`${linea.etiqueta}-${indice}`} sx={{ p: 3, borderRadius: '8px', border: '1px solid', borderColor: 'divider' }}>
            <Typography component="dt" sx={{ fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'text.secondary', mb: 1 }}>
              {linea.etiqueta}
            </Typography>
            <Typography component="dd" sx={{ m: 0, color: 'text.primary', fontSize: '1.15rem', fontWeight: 600, lineHeight: 1.4 }}>
              {linea.valor}
            </Typography>
          </Box>
        ))}
      </Box>
    )
  }

  const tabla = disposicion === 'tabla'
  return (
    <Box
      component="dl"
      sx={{
        maxWidth: anchoMaximo(bloque, '850px'), mx: 'auto', my: 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) minmax(0, 2fr)' },
        columnGap: tabla ? 0 : 3,
        ...(tabla && { border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden' }),
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
              px: tabla ? 2.5 : 0,
              borderTop: indice === 0 ? 0 : 1,
              borderColor: tabla ? 'divider' : 'rgba(204, 196, 201, 0.1)',
              backgroundColor: tabla && indice % 2 === 1 ? 'action.hover' : 'transparent',
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
