import { useCallback, useState } from 'react'
import { useMediaQuery, useTheme } from '@mui/material'
import { useReducedMotion } from 'framer-motion'
import type { MedioGaleria } from '../lib/api/contenido'
import Escenario from './galeria/Escenario'
import CarrilMovil from './galeria/CarrilMovil'
import VisorGaleria from './galeria/VisorGaleria'
import { useMedidas } from './galeria/formato'

interface Props {
  medios: MedioGaleria[]
  /** Fuerza una disposición; sin ella, la decide el ancho de la pantalla. */
  disposicion?: 'escritorio' | 'movil'
}

/**
 * Galería de fotos y vídeos.
 *
 * - En escritorio, un escenario: la foto grande sobre su propio fondo
 *   desenfocado, con pase automático (que se puede parar), contador y
 *   miniaturas.
 * - En el móvil, un carril que se pasa deslizando.
 * - En los dos, al pulsar se abre un visor a pantalla completa donde cada foto
 *   se ajusta sin recortarse, sea horizontal, vertical o cuadrada.
 *
 * El formato de cada foto se aprende al cargarla (`useMedidas`): no se le pide
 * a quien la sube.
 *
 * El vídeo se enseña con una **portada nuestra** y no se carga el marco de
 * YouTube hasta que alguien pulsa el play: incrustarlo de entrada deja cookies
 * de terceros y avisa a YouTube de cada visita, sin que el visitante haya
 * pedido ver nada. La dirección ya viene normalizada del servidor a la forma
 * `-nocookie` (`domain/video-galeria.ts`).
 */
export default function GaleriaMedios({ medios, disposicion }: Props) {
  const theme = useTheme()
  const anchoEscritorio = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const escritorio = disposicion ? disposicion === 'escritorio' : anchoEscritorio
  const sinMovimiento = useReducedMotion() ?? false
  const { medir, medidaDe } = useMedidas()
  const [actual, setActual] = useState(0)
  const [visor, setVisor] = useState<number | null>(null)
  const [reproduciendo, setReproduciendo] = useState<string[]>([])

  const total = medios.length
  // En bucle: después de la última, la primera.
  const ir = useCallback((indice: number) => setActual(((indice % total) + total) % total), [total])
  const irEnVisor = useCallback((indice: number) => {
    const destino = ((indice % total) + total) % total
    setVisor(destino)
    setActual(destino)
  }, [total])
  const reproducir = useCallback((url: string) => setReproduciendo((actuales) => (actuales.includes(url) ? actuales : [...actuales, url])), [])

  const abrir = (indice: number, conReproduccion: boolean) => {
    // Pulsar el play de un vídeo es pedir verlo: se abre ya reproduciéndose.
    if (conReproduccion) reproducir(medios[indice].url)
    setVisor(indice)
  }

  if (total === 0) return null
  const indiceSeguro = Math.min(actual, total - 1)

  return (
    <>
      {escritorio
        ? <Escenario medios={medios} actual={indiceSeguro} onIr={ir} onAbrir={abrir} medidaDe={medidaDe} medir={medir} quieta={visor !== null || sinMovimiento} />
        : <CarrilMovil medios={medios} actual={indiceSeguro} onIr={ir} onAbrir={abrir} medidaDe={medidaDe} medir={medir} />}
      <VisorGaleria
        medios={medios}
        actual={visor}
        onIr={irEnVisor}
        onCerrar={() => setVisor(null)}
        reproduciendo={reproduciendo}
        onReproducir={reproducir}
        medidaDe={medidaDe}
        medir={medir}
        escritorio={escritorio}
      />
    </>
  )
}
