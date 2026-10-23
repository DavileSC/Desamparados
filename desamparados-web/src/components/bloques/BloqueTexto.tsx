import { Box } from '@mui/material'
import { limpiarHtml } from '../../lib/limpiarHtml'
import { SERIF } from '../../features/inicio/estilos'
import { anchoMaximo, siDe, valorDe } from './presentacion'
import type { BloqueTexto as Datos } from '../../lib/api/contenido'
import { MARCA } from '../../theme/marca'

/** Lo que cambia cada estilo del texto. `normal` es el de siempre. */
const ESTILOS = {
  normal: {},
  // La entradilla: el texto que abre una página, más grande y en tinta plena.
  entradilla: { fontSize: { xs: '1.15rem', md: '1.3rem' }, lineHeight: 1.7, color: 'text.primary' },
  // Destacado: con un filete dorado a la izquierda, como un aviso.
  destacado: { borderLeft: '3px solid', borderColor: 'secondary.main', pl: { xs: 2.5, md: 4 }, py: 0.5, fontSize: '1.08rem', color: 'text.primary' },
  // Carta: una columna estrecha que se lee como una página de libro. El primer
  // párrafo, algo mayor; los subtítulos, en versalitas doradas y pequeñas.
  carta: {
    fontSize: '1.06rem', lineHeight: 1.85,
    '& > p:first-of-type': { fontSize: { xs: '1.12rem', md: '1.2rem' }, color: 'text.primary' },
    '& h2, & h3': { fontSize: 13, fontWeight: 600, letterSpacing: '0.26em', textTransform: 'uppercase', color: MARCA.acentoApagado, mt: 5, mb: 1 },
    '& h2 + p, & h3 + p': { mt: 0 },
  },
  // Preguntas grandes: cada párrafo, una pregunta en letra grande y fina, con
  // su signo de cierre en dorado. Abren una página antes de explicarla.
  preguntas: {
    '& p': { m: 0, color: 'text.primary', fontWeight: 200, fontSize: { xs: 32, sm: 44, md: 58 }, lineHeight: 1.12, letterSpacing: '-0.01em', textWrap: 'balance' },
    '& p + p': { mt: { xs: 1, md: 0.75 } },
    '& .signo': { color: MARCA.acentoApagado },
  },
  // Título al margen: el primer subtítulo, en versalitas doradas a la
  // izquierda, y el resto del texto, mayor, a su derecha. En el móvil, encima.
  margen: {
    display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px minmax(0, 1fr)' }, columnGap: 5, alignItems: 'baseline',
    fontSize: { xs: '1.06rem', md: '1.25rem' }, fontWeight: 300, lineHeight: 1.6, color: 'text.primary',
    '& > *': { gridColumn: { md: 2 } },
    '& > h2:first-of-type, & > h3:first-of-type': {
      gridColumn: { md: 1 }, gridRow: { md: '1 / span 9' }, alignSelf: 'start',
      fontSize: 12, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: MARCA.acentoApagado, mt: { xs: 0, md: '0.55em' }, mb: { xs: 1.5, md: 0 },
    },
  },
} as const

/** Ancho de cada estilo cuando el bloque no pide otro. */
const ANCHO: Partial<Record<keyof typeof ESTILOS, string>> = { carta: '680px', preguntas: '1100px', margen: '1100px' }

/**
 * En «Preguntas grandes», el signo de cierre de cada pregunta va en dorado. Se
 * envuelve después de sanear: el marcado lo pone el código, no quien escribe.
 */
function conSignos(html: string) {
  return html.replace(/\?(\s*<\/p>)/g, '<span class="signo">?</span>$1')
}

/** Cuerpo de texto con formato. El HTML llega saneado del servidor y se vuelve
 *  a sanear aquí: son dos barreras a propósito, como en las noticias. */
export default function BloqueTexto({ bloque }: { bloque: Datos }) {
  const nombre = valorDe(bloque, 'estilo') as keyof typeof ESTILOS
  const estilo = ESTILOS[nombre] ?? ESTILOS.normal
  const dosColumnas = valorDe(bloque, 'columnas') === '2'
  const alineacion = valorDe(bloque, 'alineacion')
  return (
    <Box
      sx={{
        maxWidth: anchoMaximo(bloque, dosColumnas ? '1100px' : ANCHO[nombre] ?? '850px'), mx: 'auto', color: 'text.secondary', lineHeight: 1.8,
        textAlign: alineacion === 'justificado' ? 'justify' : alineacion === 'centro' ? 'center' : 'left',
        '& p': { mb: 3 }, '& h2, & h3': { color: 'text.primary', mt: 4, mb: 2 },
        '& img': { maxWidth: '100%', height: 'auto', borderRadius: 1 },
        // Sin esto, un enlace en el texto salía del mismo color y sin subrayar:
        // no se distinguía del resto. El acento del tema, para que valga sobre papel.
        '& a': { color: 'secondary.main', textDecoration: 'underline', textDecorationThickness: '1px', textUnderlineOffset: '0.2em' },
        '& a:hover': { textDecorationThickness: '2px' },
        // El primer párrafo traía el margen de arriba del navegador y el último
        // el suyo de abajo: se sumaban al espacio entre bloques, que ya lo pone la página.
        // «:not(* + *)» es el primer hijo: con :first-child, Emotion avisa en la consola.
        '& > :not(* + *)': { mt: 0 }, '& > :last-child': { mb: 0 },
        // En dos columnas, un título no se parte entre las dos.
        ...(dosColumnas && { columnCount: { xs: 1, md: 2 }, columnGap: 6, '& h2, & h3, & img': { breakInside: 'avoid' } }),
        ...(siDe(bloque, 'capitular') && {
          '& > p:first-of-type::first-letter': {
            float: 'left', fontFamily: SERIF, fontSize: '4.1em', lineHeight: 0.82, pr: 1.25, pt: 0.75, color: 'secondary.main',
          },
        }),
        ...estilo,
      }}
      dangerouslySetInnerHTML={{ __html: nombre === 'preguntas' ? conSignos(limpiarHtml(bloque.html)) : limpiarHtml(bloque.html) }}
    />
  )
}
