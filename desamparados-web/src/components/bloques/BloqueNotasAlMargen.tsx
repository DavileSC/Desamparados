import { Box, Typography } from '@mui/material'
import BloqueTexto from './BloqueTexto'
import { SERIF } from '../../features/inicio/estilos'
import { anchoMaximo, siDe, valorDe } from './presentacion'
import type { BloqueNotasAlMargen as Datos, BloqueTexto as Texto } from '../../lib/api/contenido'
import { MARCA, alfa } from '../../theme/marca'

/**
 * Un texto largo y, a su derecha, las notas al margen: cada una, un dato en
 * grande (una fecha, unas siglas) con lo que significa debajo, como las de un
 * libro de horas. Sacan del texto lo que el lector busca de un vistazo sin
 * obligarle a leerlo entero.
 *
 * El texto es el del bloque de texto, con sus mismas opciones (dos columnas,
 * justificado, capitular): se pinta con él para que se lea igual en toda la
 * web. En el móvil las notas pasan debajo, de dos en dos.
 */
export default function BloqueNotasAlMargen({ bloque }: { bloque: Datos }) {
  const justificado = valorDe(bloque, 'alineacion') === 'justificado'
  const texto: Texto = {
    tipo: 'texto',
    titulo: '',
    html: bloque.html,
    presentacion: {
      columnas: valorDe(bloque, 'columnas'),
      // El justificado lo pone la caja de fuera, y solo desde tableta.
      alineacion: 'izquierda',
      capitular: siDe(bloque, 'capitular'),
    },
  }

  return (
    <Box sx={{
      maxWidth: anchoMaximo(bloque, '1200px'), mx: 'auto',
      display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) 220px' }, gap: { xs: 5, md: 8 },
      alignItems: 'start',
    }}>
      {/* Justificado solo desde tableta: en la columna del móvil, y donde el
          navegador no parte palabras con guiones, abría calles en blanco. */}
      <Box lang="es" sx={{ minWidth: 0, hyphens: 'auto', ...(justificado && { '& > div': { textAlign: { md: 'justify' } } }) }}>
        <BloqueTexto bloque={texto} />
      </Box>
      <Box
        component="aside"
        aria-label="Notas al margen"
        sx={{
          display: 'grid', gap: { xs: 3, md: 4.25 },
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'minmax(0, 1fr)' },
          borderTop: { xs: `1px solid ${alfa(MARCA.acento, 0.45)}`, md: 0 },
          borderLeft: { md: `1px solid ${alfa(MARCA.acento, 0.45)}` },
          pt: { xs: 3, md: 0 }, pl: { md: 2.75 },
        }}
      >
        {bloque.notas.map((nota, i) => (
          <Box key={i}>
            <Typography component="p" sx={{ fontFamily: SERIF, fontWeight: 600, fontSize: { xs: 30, md: 38 }, lineHeight: 1, color: MARCA.acento, mb: 0.75, overflowWrap: 'anywhere' }}>
              {nota.dato}
            </Typography>
            {nota.texto && (
              <Typography component="p" sx={{ fontSize: 15, lineHeight: 1.45, color: 'text.secondary' }}>{nota.texto}</Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  )
}
