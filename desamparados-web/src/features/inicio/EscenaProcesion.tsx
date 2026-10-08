import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMediaQuery } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { Revela } from '../../components/SeccionAnimada'
import ParrafoQueSeEnciende from '../../components/ParrafoQueSeEnciende'
import { CURVA_ENTRADA } from '../../components/entrada'
import { SERIF } from './estilos'
import { useTextosPortada } from './useContenidoPortada'
import { caerALaOriginal, srcsetDeSubida } from '../../lib/fotoSubida'

// La foto entra posándose desde este zoom, y tarda esto en quedarse quieta.
const ZOOM_DE_ENTRADA = 1.06
const POSADO_S = 2.4

// El srcset solo vale para la foto que viene en el repositorio, que existe en
// cuatro tamaños. Una foto subida desde el CMS es un solo fichero: darle este
// srcset pediría al navegador rutas que no existen.
const FOTO_DEL_REPOSITORIO = '/images/nazarenos-1280.webp'
const SRCSET_DEL_REPOSITORIO =
  '/images/nazarenos-1200.webp 1200w, /images/nazarenos-1280.webp 1280w, /images/nazarenos-1600.webp 1600w, /images/nazarenos-1920.webp 1920w'

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
  const esLaDelRepositorio = sabadoDePasion.imagenUrl === FOTO_DEL_REPOSITORIO

  return (
    <section ref={sectionRef} className="procession-scene" aria-labelledby="procession-title">
      {/* La foto se posa desde un zoom ligero la primera vez que entra en vista,
          además del parallax de siempre al hacer scroll. */}
      <motion.div
        className="procession-scene-image"
        style={{ y: reducedMotion ? 0 : imageY }}
        initial={reducedMotion ? false : { scale: ZOOM_DE_ENTRADA }}
        whileInView={{ scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: POSADO_S, ease: CURVA_ENTRADA }}
      >
        {/* Nazarenos del Grupo en la salida procesional, con la bandera blanca en el centro.
            Recortada en vertical sobre ella: fuera quedan casi todo el público y el rótulo
            de una tienda. Foto y alt editables desde el CMS; ver FOTO_DEL_REPOSITORIO arriba. */}
        <img
          src={sabadoDePasion.imagenUrl}
          srcSet={esLaDelRepositorio ? SRCSET_DEL_REPOSITORIO : srcsetDeSubida(sabadoDePasion.imagenUrl)}
          sizes="100vw"
          onError={(e) => { caerALaOriginal(e.currentTarget) }}
          alt={sabadoDePasion.imagenAlt}
          loading="lazy"
          decoding="async"
        />
      </motion.div>
      <div className="procession-scene-shade" aria-hidden="true" />
      <div className="procession-scene-content">
        <Revela><span className="procession-scene-eyebrow">{sabadoDePasion.ceja}</span></Revela>
        <Revela efecto="cortina" orden={1}>
          {/* Guardado como texto solo puede llevar un \n; pre-line es lo único que lo respeta
              y conserva el corte a dos líneas que antes daba el <br /> a mano. */}
          <h2 id="procession-title" style={{ whiteSpace: 'pre-line', fontFamily: SERIF }}>{sabadoDePasion.titulo}</h2>
        </Revela>
        {/* Sin entrada propia: su efecto es encenderse palabra a palabra según se baja. */}
        <ParrafoQueSeEnciende texto={sabadoDePasion.parrafo} className="procession-scene-parrafo" />
        <Revela orden={3}>
          <Link to="/sabado-de-pasion" className="procession-scene-link">
            {sabadoDePasion.enlace} <ArrowForwardIcon fontSize="small" />
          </Link>
        </Revela>
      </div>
    </section>
  )
}
