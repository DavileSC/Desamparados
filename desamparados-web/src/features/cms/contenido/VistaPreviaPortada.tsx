import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import temaPublico from '../../../theme'
import { BorradorPortadaContext } from '../../home/useContenidoPortada'
import type { Portada } from '../../../lib/api/portada'
import '../../home/home.css'

/**
 * Ancho al que se pinta el bloque antes de encogerlo: el de un portátil
 * corriente. Se dibuja a ese tamaño y se escala entero, en vez de meterlo en la
 * columna del CMS, porque a 900 px el bloque se maquetaría como en una tableta y
 * la vista previa enseñaría algo que ningún visitante de escritorio ve.
 */
export const ANCHO_ESCRITORIO = 1440

/** Por debajo de esto, encoger un escritorio entero no deja nada legible. */
export const ANCHO_MINIMO_ESCRITORIO = 700

/**
 * Lo alto que ocupa la vista previa en un móvil. A tamaño real, la cabecera mide
 * una pantalla entera y el formulario quedaba debajo del todo: se le pone este
 * tope y el bloque se recorre dentro de su marco, con el dedo.
 */
export const ALTO_MAXIMO_MOVIL = 320

/**
 * Cómo queda un bloque de la portada con lo que se está escribiendo, antes de
 * guardar. Pinta el componente REAL de la portada (no una imitación), con su
 * tema, sus estilos y lo escrito en el formulario en lugar de lo guardado.
 *
 * Es solo para mirar: `inert` impide pulsar sus enlaces (llevarían fuera del
 * CMS a mitad de edición) y lo saca del orden de tabulación y de los lectores
 * de pantalla, que ya tienen los campos del formulario.
 */
export default function VistaPreviaPortada({ portada, children }: { portada: Portada; children: ReactNode }) {
  const marco = useRef<HTMLDivElement>(null)
  const lienzo = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(0)
  const [alto, setAlto] = useState(0)

  useEffect(() => {
    if (!marco.current || !lienzo.current) return
    const observador = new ResizeObserver(() => {
      setAncho(marco.current?.clientWidth ?? 0)
      setAlto(lienzo.current?.offsetHeight ?? 0)
    })
    observador.observe(marco.current)
    observador.observe(lienzo.current)
    return () => observador.disconnect()
  }, [])

  // En una pantalla estrecha no se encoge un escritorio de 1440 px: a esa
  // escala (0,19) los textos son rayas. Se pinta a tamaño real, y entonces el
  // bloque se maqueta como lo verá quien entre desde el móvil.
  const enMovil = ancho > 0 && ancho < ANCHO_MINIMO_ESCRITORIO
  const anchoLienzo = enMovil ? ancho : ANCHO_ESCRITORIO
  const escala = enMovil ? 1 : ancho > 0 ? ancho / ANCHO_ESCRITORIO : 0.5

  return (
    <Box>
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, fontWeight: 600, letterSpacing: '0.04em' }}
      >
        <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
        {enMovil
          ? 'Vista previa en móvil · se actualiza mientras escribes, pero no se publica hasta que guardes'
          : 'Vista previa · se actualiza mientras escribes, pero no se publica hasta que guardes'}
      </Typography>
      <Box
        ref={marco}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          height: enMovil ? ALTO_MAXIMO_MOVIL : alto > 0 ? alto * escala : undefined,
          // En móvil el bloque va a tamaño real: se recorre dentro del marco.
          overflowY: enMovil ? 'auto' : 'hidden',
          overscrollBehavior: 'contain',
          // Mientras se mide, un alto razonable: sin él, el formulario pega un salto.
          minHeight: alto > 0 ? undefined : 240,
          backgroundColor: '#1d1b1e',
        }}
      >
        <Box
          ref={lienzo}
          inert
          aria-hidden="true"
          data-testid="vista-previa-portada"
          sx={{
            width: anchoLienzo,
            transform: enMovil ? 'none' : `scale(${escala})`,
            transformOrigin: 'top left',
            position: enMovil ? 'relative' : 'absolute',
            top: 0,
            left: 0,
            userSelect: 'none',
          }}
        >
          <ThemeProvider theme={temaPublico}>
            <BorradorPortadaContext.Provider value={portada}>
              <Box className="home-refined" sx={{ backgroundColor: 'background.default', color: 'text.primary' }}>
                {children}
              </Box>
            </BorradorPortadaContext.Provider>
          </ThemeProvider>
        </Box>
      </Box>
    </Box>
  )
}
