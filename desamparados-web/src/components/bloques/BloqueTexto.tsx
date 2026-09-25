import { Box } from '@mui/material'
import { limpiarHtml } from '../../lib/limpiarHtml'
import { SERIF } from '../../features/inicio/estilos'
import { anchoMaximo, siDe, valorDe } from './presentacion'
import type { BloqueTexto as Datos } from '../../lib/api/contenido'

/** Lo que cambia cada estilo del texto. `normal` es el de siempre. */
const ESTILOS = {
  normal: {},
  // La entradilla: el texto que abre una página, más grande y en tinta plena.
  entradilla: { fontSize: { xs: '1.15rem', md: '1.3rem' }, lineHeight: 1.7, color: 'text.primary' },
  // Destacado: con un filete dorado a la izquierda, como un aviso.
  destacado: { borderLeft: '3px solid', borderColor: 'secondary.main', pl: { xs: 2.5, md: 4 }, py: 0.5, fontSize: '1.08rem', color: 'text.primary' },
} as const

/** Cuerpo de texto con formato. El HTML llega saneado del servidor y se vuelve
 *  a sanear aquí: son dos barreras a propósito, como en las noticias. */
export default function BloqueTexto({ bloque }: { bloque: Datos }) {
  const estilo = ESTILOS[valorDe(bloque, 'estilo') as keyof typeof ESTILOS] ?? ESTILOS.normal
  const dosColumnas = valorDe(bloque, 'columnas') === '2'
  const alineacion = valorDe(bloque, 'alineacion')
  return (
    <Box
      sx={{
        maxWidth: anchoMaximo(bloque, dosColumnas ? '1100px' : '850px'), mx: 'auto', color: 'text.secondary', lineHeight: 1.8,
        textAlign: alineacion === 'justificado' ? 'justify' : alineacion === 'centro' ? 'center' : 'left',
        '& p': { mb: 3 }, '& h2, & h3': { color: 'text.primary', mt: 4, mb: 2 },
        '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1 },
        // El primer párrafo traía el margen de arriba del navegador y el último
        // el suyo de abajo: se sumaban al espacio entre bloques, que ya lo pone la página.
        '& > :first-child': { mt: 0 }, '& > :last-child': { mb: 0 },
        // En dos columnas, un título no se parte entre las dos.
        ...(dosColumnas && { columnCount: { xs: 1, md: 2 }, columnGap: 6, '& h2, & h3, & img': { breakInside: 'avoid' } }),
        ...(siDe(bloque, 'capitular') && {
          '& > p:first-of-type::first-letter': {
            float: 'left', fontFamily: SERIF, fontSize: '4.1em', lineHeight: 0.82, pr: 1.25, pt: 0.75, color: 'secondary.main',
          },
        }),
        ...estilo,
      }}
      dangerouslySetInnerHTML={{ __html: limpiarHtml(bloque.html) }}
    />
  )
}
