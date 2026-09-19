import { Box } from '@mui/material'
import { sanitizeHtml } from '../../lib/sanitizeHtml'
import type { BloqueTexto as Datos } from '../../lib/api/contenido'

/** Cuerpo de texto con formato. El HTML llega saneado del servidor y se vuelve
 *  a sanear aquí: son dos barreras a propósito, como en las noticias. */
export default function BloqueTexto({ bloque }: { bloque: Datos }) {
  return (
    <Box
      sx={{
        maxWidth: '850px', mx: 'auto', color: 'text.secondary', lineHeight: 1.8,
        '& p': { mb: 3 }, '& h2, & h3': { color: 'text.primary', mt: 4, mb: 2 },
        '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1 },
        // El primer párrafo traía el margen de arriba del navegador y el último
        // el suyo de abajo: se sumaban al espacio entre bloques, que ya lo pone la página.
        '& > :first-child': { mt: 0 }, '& > :last-child': { mb: 0 },
      }}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(bloque.html) }}
    />
  )
}
