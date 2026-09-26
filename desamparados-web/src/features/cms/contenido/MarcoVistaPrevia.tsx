import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import { Box, Typography } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import temaPublico from '../../../theme'

/**
 * Ancho al que se pinta la web antes de encogerla: el de un portátil
 * corriente. Se dibuja a ese tamaño y se escala entera, en vez de meterla en la
 * columna del CMS, porque a 900 px se maquetaría como en una tableta y la
 * vista previa enseñaría algo que ningún visitante de escritorio ve.
 */
export const ANCHO_ESCRITORIO = 1440

/** Por debajo de esto, encoger un escritorio entero no deja nada legible. */
export const ANCHO_MINIMO_ESCRITORIO = 700

/**
 * Lo alto que ocupa la vista previa en un móvil. A tamaño real, una cabecera
 * mide una pantalla entera y el formulario quedaba debajo del todo: se le pone
 * este tope y se recorre dentro de su marco, con el dedo.
 */
export const ALTO_MAXIMO_MOVIL = 320

interface Props {
  children: ReactNode
  /** En la vista de la página entera no hay tope: se recorre con la ventana. */
  sinTope?: boolean
  /** Sin la línea de encima («Vista previa · …»), cuando ya la dice quien la monta. */
  sinAviso?: boolean
  /**
   * Se puede tocar lo que se mueve (pasar las fotos de una galería, ampliar una,
   * darle al play de un vídeo), pero ningún enlace lleva a ninguna parte ni se
   * envía ningún formulario. Sin esto, la vista previa es solo para mirar.
   */
  interactiva?: boolean
  testId?: string
}

/**
 * Cómo queda en la web pública lo que se está escribiendo, antes de guardar.
 * Pinta los componentes REALES (no una imitación), con el tema y la fuente de
 * la web pública: sin fijarla aquí, lo que no es un componente de MUI heredaría
 * la del CMS.
 *
 * Escritorio encogido, o tamaño real cuando el propio CMS está en un móvil. No
 * hay un «ver como en móvil» desde el ordenador: la web elige su maquetación por
 * el ancho de la VENTANA (media queries), no por el del recuadro, y un móvil
 * simulado saldría como un escritorio apretado.
 *
 * Por defecto es solo para mirar: `inert` impide pulsar sus enlaces (llevarían
 * fuera del CMS a mitad de edición) y la saca del orden de tabulación y de los
 * lectores de pantalla, que ya tienen los campos del formulario. Con
 * `interactiva`, lo que se mueve responde y los enlaces siguen sin llevar a
 * ninguna parte.
 */
export default function MarcoVistaPrevia({ children, sinTope = false, sinAviso = false, interactiva = false, testId }: Props) {
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
  // escala (0,19) los textos son rayas. Se pinta a tamaño real, y entonces se
  // maqueta como lo verá quien entre desde el móvil.
  const realMovil = ancho > 0 && ancho < ANCHO_MINIMO_ESCRITORIO
  const anchoLienzo = realMovil ? ancho : ANCHO_ESCRITORIO
  const escala = realMovil ? 1 : ancho > 0 ? ancho / ANCHO_ESCRITORIO : 0.5
  const conTope = realMovil && !sinTope

  // Cortado en la captura, antes de que llegue al formulario: con solo
  // `preventDefault`, el `onSubmit` de la página se ejecutaba igual, y el de
  // Contacto habría mandado el mensaje de verdad desde la vista previa.
  const noEnviar = (evento: FormEvent) => {
    evento.preventDefault()
    evento.stopPropagation()
  }

  // Un enlace de la página llevaría fuera del CMS con los cambios sin guardar.
  const sinSalir = (evento: MouseEvent) => {
    if ((evento.target as HTMLElement).closest('a[href]')) {
      evento.preventDefault()
      evento.stopPropagation()
    }
  }

  return (
    <Box>
      {!sinAviso && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1, fontWeight: 600, letterSpacing: '0.04em' }}
        >
          <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />
          {realMovil ? 'Vista previa en móvil' : 'Vista previa'}
          {interactiva ? ' · puedes pasar las fotos y probarla' : ''}
          {' · se actualiza mientras escribes, pero no se publica hasta que guardes'}
        </Typography>
      )}
      <Box
        ref={marco}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          height: conTope ? ALTO_MAXIMO_MOVIL : realMovil ? undefined : alto > 0 ? alto * escala : undefined,
          // En móvil va a tamaño real: se recorre dentro del marco.
          overflowY: conTope ? 'auto' : 'hidden',
          overscrollBehavior: 'contain',
          // Mientras se mide, un alto razonable: sin él, el formulario pega un salto.
          minHeight: alto > 0 ? undefined : 240,
          backgroundColor: '#0c0b0d',
        }}
      >
        <Box
          ref={lienzo}
          inert={!interactiva}
          aria-hidden={interactiva ? undefined : 'true'}
          aria-label={interactiva ? 'Vista previa, sin publicar' : undefined}
          role={interactiva ? 'region' : undefined}
          onClickCapture={interactiva ? sinSalir : undefined}
          onSubmitCapture={interactiva ? noEnviar : undefined}
          data-testid={testId}
          sx={{
            width: anchoLienzo,
            transform: realMovil ? 'none' : `scale(${escala})`,
            transformOrigin: 'top left',
            position: realMovil ? 'relative' : 'absolute',
            top: 0,
            left: 0,
            userSelect: 'none',
          }}
        >
          <ThemeProvider theme={temaPublico}>
            <Box sx={{ backgroundColor: 'background.default', color: 'text.primary', fontFamily: temaPublico.typography.fontFamily }}>
              {children}
            </Box>
          </ThemeProvider>
        </Box>
      </Box>
    </Box>
  )
}
