import { Box, Typography } from '@mui/material'
import { SERIF } from '../../features/inicio/estilos'
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

  if (disposicion === 'ficha') return <Ficha bloque={bloque} />

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
            // En el móvil el valor va debajo de su concepto: sin raya entre los
            // dos (parecerían dos filas) y pegado a él.
            '& > dd': { borderTop: { xs: 0, sm: indice === 0 ? 0 : 1 }, pt: { xs: 0, sm: 1.5 } },
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

/**
 * La ficha (Sagrada titular, 27-11-2026): el título a la izquierda y los
 * datos a la derecha en dos columnas, separados por filetes finos; el valor en
 * grande, con la letra de los títulos, y su aclaración (`nota`) debajo en
 * pequeño. Para unos pocos datos que merecen leerse uno a uno: autor,
 * bendición, material. Pinta su propio título, al lado y no encima.
 */
function Ficha({ bloque }: { bloque: Datos }) {
  return (
    <Box sx={{
      maxWidth: anchoMaximo(bloque, '1200px'), mx: 'auto',
      display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 4fr) minmax(0, 7fr)' }, gap: { xs: 3, md: 9 }, alignItems: 'start',
    }}>
      {bloque.titulo && (
        <Typography variant="h2" component="h2" sx={{ fontSize: { xs: '32px', md: '48px' }, m: 0 }}>{bloque.titulo}</Typography>
      )}
      <Box component="dl" sx={{
        m: 0, gridColumn: bloque.titulo ? undefined : '1 / -1',
        display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, columnGap: 4,
        borderTop: '1px solid', borderColor: 'divider',
      }}>
        {bloque.lineas.map((linea, indice) => (
          // Cada par en su caja, con un filete debajo: en dos columnas las
          // filas quedan alineadas sin sangrar la segunda.
          <Box key={`${linea.etiqueta}-${indice}`} sx={{ py: { xs: 2.25, md: 3 }, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography component="dt" sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'text.secondary', mb: 1 }}>
              {linea.etiqueta}
            </Typography>
            <Typography component="dd" sx={{ m: 0, fontFamily: SERIF, fontWeight: 600, fontSize: { xs: 22, md: 26 }, lineHeight: 1.2, color: 'text.primary' }}>
              {linea.valor}
              {linea.nota && (
                <Box component="span" sx={{ display: 'block', fontFamily: (t) => t.typography.fontFamily, fontWeight: 400, fontSize: 14, lineHeight: 1.5, color: 'text.secondary', mt: 0.75 }}>
                  {linea.nota}
                </Box>
              )}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
