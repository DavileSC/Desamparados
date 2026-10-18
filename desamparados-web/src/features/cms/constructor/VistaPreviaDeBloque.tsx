import { useEffect, useRef, useState } from 'react'
import { Box, useMediaQuery } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import temaPublico from '../../../theme'
import BloquesDePagina from '../../../components/bloques/BloquesDePagina'
import { ModoEdicionContext } from '../../../components/bloques/modoEdicion'
import type { Bloque } from '../../../lib/api/contenido'

/**
 * El ancho al que se maqueta el bloque antes de encogerlo: el de la columna de
 * una página en un portátil, o el de un móvil. Va con la ventana porque la web
 * decide su maqueta por ella: en un móvil, el bloque ya se pinta como en el
 * móvil, y a ancho de portátil quedaba una tira diminuta.
 */
const ANCHO_DE_PAGINA = { ordenador: 1180, movil: 420 }

/** Como en la vista en vivo: nada está abierto en el editor y pulsar no hace nada. */
const SIN_EDITOR = { seleccionado: null, alPulsar: () => {} }

/**
 * Un bloque tal como se ve en la web, encogido para caber en la galería de
 * «Añadir bloque».
 *
 * Es el mismo componente que pinta la página, con el tema de la web (el del
 * CMS es otro) y en modo constructor: así las animaciones salen quietas, ya
 * terminadas, como en la vista en vivo. Se maqueta al ancho de una página y se
 * encoge entero, para que las columnas y los tamaños sean los de verdad.
 *
 * Es solo una imagen: `inert` lo saca del tabulador, de los clics y de los
 * lectores de pantalla, que ya tienen el nombre y la descripción al lado.
 */
export default function VistaPreviaDeBloque({ bloques }: { bloques: Bloque[] }) {
  const marco = useRef<HTMLDivElement>(null)
  const contenido = useRef<HTMLDivElement>(null)
  const [medida, setMedida] = useState({ ancho: 0, alto: 0 })
  const [altoDelBloque, setAltoDelBloque] = useState(0)
  const movil = useMediaQuery(temaPublico.breakpoints.down('md'), { noSsr: true })
  const anchoDePagina = movil ? ANCHO_DE_PAGINA.movil : ANCHO_DE_PAGINA.ordenador

  useEffect(() => {
    if (!marco.current || !contenido.current) return
    const observador = new ResizeObserver(() => {
      if (marco.current) setMedida({ ancho: marco.current.clientWidth, alto: marco.current.clientHeight })
      if (contenido.current) setAltoDelBloque(contenido.current.offsetHeight)
    })
    observador.observe(marco.current)
    observador.observe(contenido.current)
    return () => observador.disconnect()
  }, [])

  const escala = medida.ancho > 0 ? medida.ancho / anchoDePagina : 0
  // El alto del marco en píxeles del bloque, antes de encoger.
  const altoUtil = escala > 0 ? medida.alto / escala : 0
  // Un bloque más alto que el marco se corta abajo, con un fundido: se ve que sigue.
  const cortado = altoUtil > 0 && altoDelBloque > altoUtil + 1

  return (
    <Box ref={marco} aria-hidden inert sx={{
      // Sin encoger: en una columna flexible con poco alto, se quedaba en nada.
      // En el móvil, cuadrada: allí los bloques se apilan y crecen hacia abajo.
      position: 'relative', width: '100%', aspectRatio: movil ? '1 / 1' : '16 / 10', flexShrink: 0, overflow: 'hidden', borderRadius: 2,
      border: 1, borderColor: 'divider', backgroundColor: '#121113', userSelect: 'none',
    }}>
      <ThemeProvider theme={temaPublico}>
        <ModoEdicionContext.Provider value={SIN_EDITOR}>
          <Box sx={{
            position: 'absolute', left: 0, top: 0, width: anchoDePagina, minHeight: altoUtil || undefined,
            transform: `scale(${escala})`, transformOrigin: 'top left', visibility: escala > 0 ? 'visible' : 'hidden',
            display: 'flex', flexDirection: 'column', justifyContent: cortado ? 'flex-start' : 'center',
            backgroundColor: 'background.default', color: 'text.primary', fontFamily: temaPublico.typography.fontFamily,
          }}>
            <Box ref={contenido} sx={{ px: movil ? 2.5 : 6, py: movil ? 3 : 5 }}>
              <BloquesDePagina bloques={bloques} />
            </Box>
          </Box>
        </ModoEdicionContext.Provider>
      </ThemeProvider>
      {cortado && (
        <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, background: 'linear-gradient(transparent, #121113)' }} />
      )}
    </Box>
  )
}
