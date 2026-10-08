import { Box, Typography } from '@mui/material'
import FotoAmpliable from './FotoAmpliable'
import { GOLD } from '../../features/inicio/estilos'
import { anchoMaximo, siDe, valorDe } from './presentacion'
import type { BloqueFoto as Datos } from '../../lib/api/contenido'
import { propsDeFoto } from '../../lib/fotoSubida'

/** Ancho de la foto según su tamaño. `grande` es el de siempre. */
const TAMANOS = { pequena: '480px', mediana: '720px', grande: '1000px', completa: 'none' } as const

/** Los marcos: ninguno (el de siempre), un filete fino o un paspartú dorado. */
const MARCOS = {
  ninguno: {},
  fino: { p: 1, border: '1px solid rgba(204, 196, 201, 0.25)', borderRadius: '10px' },
  dorado: { p: { xs: 1.25, md: 2 }, border: `1px solid ${GOLD}`, borderRadius: '4px', backgroundColor: 'rgba(222, 199, 43, 0.05)' },
} as const

/**
 * Una foto con su pie opcional, del tamaño, recorte y marco que diga su
 * presentación. A tamaño `completa` sale de la columna de la página y va de
 * lado a lado de la ventana, sin redondear.
 *
 * El `alt` es obligatorio en el servidor (`bloques.schema.ts`): aquí nunca
 * llega vacío.
 */
export default function BloqueFoto({ bloque }: { bloque: Datos }) {
  // Sin foto todavía (un bloque recién añadido, en la vista previa del CMS),
  // nada: un <img src=""> vuelve a pedir la página entera.
  if (bloque.url === '') return null
  const tamano = valorDe(bloque, 'tamano') as keyof typeof TAMANOS
  const completa = tamano === 'completa'
  const proporcion = valorDe(bloque, 'proporcion')
  const marco = MARCOS[valorDe(bloque, 'marco') as keyof typeof MARCOS] ?? MARCOS.ninguno

  const imagen = (
    <Box component="img" {...propsDeFoto(bloque.url, completa ? '100vw' : '(min-width: 1000px) 1000px, 100vw')} alt={bloque.alt} loading="lazy" decoding="async"
      sx={{
        width: '100%', height: 'auto', display: 'block', borderRadius: completa ? 0 : 2,
        ...(proporcion !== 'original' && { aspectRatio: proporcion.replace(':', ' / '), objectFit: 'cover' }),
      }} />
  )

  return (
    <Box sx={{ maxWidth: completa ? 'none' : anchoMaximo(bloque, TAMANOS[tamano] ?? TAMANOS.grande), mx: completa ? 'calc(50% - 50vw)' : 'auto' }}>
      <Box sx={completa ? undefined : marco}>
        {siDe(bloque, 'ampliable')
          ? <FotoAmpliable url={bloque.url} alt={bloque.alt} pie={bloque.pie}>{imagen}</FotoAmpliable>
          : imagen}
      </Box>
      {bloque.pie && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5, textAlign: 'center', px: completa ? 2 : 0 }}>
          {bloque.pie}
        </Typography>
      )}
    </Box>
  )
}
