import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useMediaQuery } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { Revela } from '../../components/AnimatedSection'

export default function ProcessionScene() {
  const sectionRef = useRef<HTMLElement>(null)
  const reducedMotion = useReducedMotion()
  const mobile = useMediaQuery('(max-width: 600px)')
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })
  const distance = mobile ? 20 : 56
  const imageY = useTransform(scrollYProgress, [0, 1], [-distance, distance])

  return (
    <section ref={sectionRef} className="procession-scene" aria-labelledby="procession-title">
      <motion.div
        className="procession-scene-image"
        style={{ y: reducedMotion ? 0 : imageY }}
      >
        {/* Nazarenos de capirote blanco en la avenida de Andalucía (Quino Al, Unsplash, licencia Unsplash).
            Va recortada por la derecha: el original pixela caras del público a la izquierda. */}
        <img
          src="/images/nazarenos-1280.webp"
          srcSet="/images/nazarenos-1200.webp 1200w, /images/nazarenos-1280.webp 1280w, /images/nazarenos-1600.webp 1600w, /images/nazarenos-1920.webp 1920w"
          sizes="100vw"
          alt="Nazarenos de capirote blanco durante la procesión"
          loading="lazy"
          decoding="async"
        />
      </motion.div>
      <div className="procession-scene-shade" aria-hidden="true" />
      <div className="procession-scene-content">
        <Revela><span className="procession-scene-eyebrow">Sábado de Pasión</span></Revela>
        <Revela orden={1}><h2 id="procession-title">Una devoción que<br />camina con nosotros.</h2></Revela>
        <Revela orden={2}><p>La fe compartida, el encuentro y la emoción de acompañar a Nuestra Señora por las calles de Málaga.</p></Revela>
        <Revela orden={3}>
          <Link to="/corporacion/sabado-de-pasion" className="procession-scene-link">
            Vive el Sábado de Pasión <ArrowForwardIcon fontSize="small" />
          </Link>
        </Revela>
      </div>
    </section>
  )
}
