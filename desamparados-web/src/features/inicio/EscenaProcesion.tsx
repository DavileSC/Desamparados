import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMediaQuery } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { m, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { Revela } from '../../components/SeccionAnimada'
import ParrafoQueSeEnciende from '../../components/ParrafoQueSeEnciende'
import { CURVA_ENTRADA } from '../../components/entrada'
import { SERIF } from './estilos'
import { usePortadaEnCarga, useTextosPortada } from './useContenidoPortada'
import TextoDePortada from './TextoDePortada'
import { propsDeFoto } from '../../lib/fotoSubida'
import { useFotoQueFalla } from '../../hooks/useFotoQueFalla'
import { useEnlaceVivo } from '../../hooks/useEnlaceVivo'

// La foto entra posándose desde este zoom, y tarda esto en quedarse quieta.
const ZOOM_DE_ENTRADA = 1.06
const POSADO_S = 2.4

export default function EscenaProcesion() {
  const sectionRef = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()
  const mobile = useMediaQuery('(max-width: 600px)')
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })
  const distance = mobile ? 20 : 56
  const imageY = useTransform(scrollYProgress, [0, 1], [-distance, distance])
  const { sabadoDePasion } = useTextosPortada()
  const enlaceVivo = useEnlaceVivo()
  // Mientras llegan los textos, sus huesos, como los demás bloques de la portada.
  const enCarga = usePortadaEnCarga()
  // Sin foto (vacía en el contenido, o una fija que esta instalación no tiene)
  // la escena se queda con su fondo oscuro y el velo: sin icono roto ni el
  // texto alternativo flotando en el sitio de la foto.
  const { visible, alFallar } = useFotoQueFalla(sabadoDePasion.imagenUrl)

  return (
    <section ref={sectionRef} className="procession-scene" aria-labelledby="procession-title">
      {/* La foto se posa desde un zoom ligero la primera vez que entra en vista,
          además del parallax de siempre al hacer scroll. */}
      <m.div
        className="procession-scene-image"
        style={{ y: reducedMotion ? 0 : imageY }}
        initial={reducedMotion ? false : { scale: ZOOM_DE_ENTRADA }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: POSADO_S, ease: CURVA_ENTRADA }}
      >
        {/* Foto y alt editables desde el CMS. La fija de nazarenos de la instalación
            lleva copias en cuatro tamaños (COPIAS_DE_FOTOS_FIJAS); una subida, las suyas. */}
        {visible && (
          <img
            {...propsDeFoto(sabadoDePasion.imagenUrl, '100vw', alFallar)}
            alt={sabadoDePasion.imagenAlt}
            loading="lazy"
            decoding="async"
          />
        )}
      </m.div>
      <div className="procession-scene-shade" aria-hidden="true" />
      <div className="procession-scene-content">
        <Revela><span className="procession-scene-eyebrow"><TextoDePortada anchos={['9em']}>{sabadoDePasion.ceja}</TextoDePortada></span></Revela>
        <Revela efecto="cortina" orden={1}>
          {/* Guardado como texto solo puede llevar un \n; pre-line es lo único que lo respeta
              y conserva el corte a dos líneas que antes daba el <br /> a mano. */}
          <h2 id="procession-title" style={{ whiteSpace: 'pre-line', fontFamily: SERIF }}><TextoDePortada anchos={['8em', '6em']}>{sabadoDePasion.titulo}</TextoDePortada></h2>
        </Revela>
        {/* Sin entrada propia: su efecto es encenderse palabra a palabra según se baja.
            Mientras carga, un párrafo de huesos con su misma clase (su tamaño y su ancho). */}
        {enCarga
          ? <p className="procession-scene-parrafo"><TextoDePortada anchos={['24em', '20em']}>{null}</TextoDePortada></p>
          : <ParrafoQueSeEnciende texto={sabadoDePasion.parrafo} className="procession-scene-parrafo" />}
        {/* Su página puede ser de un módulo apagado (la de la salida es de
            paginas-propias): mejor sin enlace que con uno a la 404. Mientras
            carga, su hueso, como el resto de la escena. */}
        {(enCarga || enlaceVivo(sabadoDePasion.destino)) && (
          <Revela orden={3}>
            <Link to={sabadoDePasion.destino} className="procession-scene-link">
              <TextoDePortada anchos={['10em']}>{sabadoDePasion.enlace}</TextoDePortada> <ArrowForwardIcon fontSize="small" />
            </Link>
          </Revela>
        )}
      </div>
    </section>
  )
}
