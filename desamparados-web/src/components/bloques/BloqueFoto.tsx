import { Box, Typography } from '@mui/material'
import type { BloqueFoto as Datos } from '../../lib/api/contenido'

/** Foto a ancho de página con su pie opcional. El `alt` es obligatorio en el
 *  servidor (`bloques.schema.ts`): aquí nunca llega vacío. */
export default function BloqueFoto({ bloque }: { bloque: Datos }) {
  // Sin foto todavía (un bloque recién añadido, en la vista previa del CMS),
  // nada: un <img src=""> vuelve a pedir la página entera.
  if (bloque.url === '') return null
  return (
    <Box sx={{ maxWidth: '1000px', mx: 'auto' }}>
      <Box component="img" src={bloque.url} alt={bloque.alt} loading="lazy" decoding="async"
        sx={{ width: '100%', height: 'auto', borderRadius: 2, display: 'block' }} />
      {bloque.pie && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5, textAlign: 'center' }}>
          {bloque.pie}
        </Typography>
      )}
    </Box>
  )
}
