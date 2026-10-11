import { Box, Typography } from '@mui/material'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import { anchoMaximo, valorDe } from './presentacion'
import type { BloqueDescargas as Datos } from '../../lib/api/contenido'
import { MARCA, alfa } from '../../theme/marca'

/**
 * Documentos para descargar: los PDF que se suben desde el CMS, en lista o en
 * tarjetas. Cada uno es un enlace de descarga normal (`download`): no hay nada
 * de fuera, lo exige el servidor.
 */
export default function BloqueDescargas({ bloque }: { bloque: Datos }) {
  const tarjetas = valorDe(bloque, 'disposicion') === 'tarjetas'
  const archivos = bloque.archivos.filter((a) => a.url !== '')
  if (archivos.length === 0) return null
  return (
    <Box component="ul" sx={{
      listStyle: 'none', m: 0, p: 0, mx: 'auto', maxWidth: anchoMaximo(bloque, tarjetas ? '1100px' : '850px'),
      display: 'grid', gap: tarjetas ? 2 : 0,
      gridTemplateColumns: tarjetas ? { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(3, minmax(0, 1fr))' } : '1fr',
    }}>
      {archivos.map((archivo, i) => (
        <Box component="li" key={`${archivo.url}-${i}`} sx={tarjetas ? undefined : { borderTop: i === 0 ? 0 : '1px solid', borderColor: 'divider' }}>
          <Box component="a" href={archivo.url} download target="_blank" rel="noopener"
            sx={{
              display: 'flex', alignItems: tarjetas ? 'flex-start' : 'center', gap: 2, textDecoration: 'none', color: 'inherit',
              ...(tarjetas
                ? { flexDirection: 'column', height: '100%', p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '8px' }
                : { py: 2 }),
              transition: 'border-color .2s ease',
              '&:hover .titulo': { color: 'secondary.main' }, '&:hover': tarjetas ? { borderColor: alfa(MARCA.acento, 0.5) } : {},
              '&:focus-visible': { outline: `2px solid ${MARCA.acento}`, outlineOffset: 2 },
            }}>
            <PictureAsPdfOutlinedIcon aria-hidden sx={{ color: 'secondary.main', fontSize: tarjetas ? 36 : 28 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography className="titulo" sx={{ color: 'text.primary', fontWeight: 600, transition: 'color .2s ease' }}>{archivo.titulo}</Typography>
              {archivo.descripcion && <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>{archivo.descripcion}</Typography>}
            </Box>
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: 'secondary.main', fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <FileDownloadOutlinedIcon aria-hidden sx={{ fontSize: 20 }} /> PDF
            </Box>
          </Box>
        </Box>
      ))}
    </Box>
  )
}
