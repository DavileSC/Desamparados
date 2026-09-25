import { useCallback, useState } from 'react'
import { Box, ButtonBase, useMediaQuery, useTheme } from '@mui/material'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import { useReducedMotion } from 'framer-motion'
import type { MedioGaleria } from '../lib/api/contenido'
import Escenario from './galeria/Escenario'
import CarrilMovil from './galeria/CarrilMovil'
import VisorGaleria from './galeria/VisorGaleria'
import { imagenDe, useMedidas } from './galeria/formato'

interface Props {
  medios: MedioGaleria[]
  /** Fuerza una disposición; sin ella, la decide el ancho de la pantalla. */
  disposicion?: 'escritorio' | 'movil'
  /**
   * Cómo se enseñan: en pase (el de siempre), en una cuadrícula de recortes
   * iguales o en mosaico, cada foto con su forma. Las dos últimas abren el
   * mismo visor a pantalla completa al pulsar.
   */
  formato?: 'pase' | 'cuadricula' | 'mosaico'
  /** Columnas de la cuadrícula o del mosaico en escritorio. */
  columnas?: number
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
export default function GaleriaMedios({ medios, disposicion, formato = 'pase', columnas = 3 }: Props) {
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
      {formato !== 'pase'
        ? <Rejilla medios={medios} mosaico={formato === 'mosaico'} columnas={columnas} onAbrir={abrir} />
        : escritorio
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

/**
 * La cuadrícula o el mosaico: todas las fotos a la vista, cada una un botón
 * que abre el visor. En la cuadrícula se recortan a cuadrado; en el mosaico
 * conservan su forma y se reparten en columnas, como en un tablero.
 */
function Rejilla({ medios, mosaico, columnas, onAbrir }: {
  medios: MedioGaleria[]
  mosaico: boolean
  columnas: number
  onAbrir: (indice: number, reproducir: boolean) => void
}) {
  const hueco = { xs: 1, md: 1.5 }
  return (
    <Box
      component="ul"
      sx={{
        listStyle: 'none', m: 0, p: 0,
        ...(mosaico
          ? { columnCount: { xs: 2, md: columnas }, columnGap: hueco }
          : { display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: `repeat(${columnas}, minmax(0, 1fr))` }, gap: hueco }),
      }}
    >
      {medios.map((medio, i) => {
        const video = medio.tipo === 'video'
        return (
          <Box component="li" key={`${medio.url}-${i}`} sx={mosaico ? { breakInside: 'avoid', mb: hueco } : undefined}>
            <ButtonBase
              onClick={() => onAbrir(i, video)}
              aria-label={`${video ? 'Ver el vídeo' : 'Ampliar la foto'}: ${medio.alt}`}
              sx={{
                display: 'block', width: '100%', position: 'relative', overflow: 'hidden', borderRadius: '6px',
                '& img': { transition: 'transform .5s ease' }, '&:hover img, &.Mui-focusVisible img': { transform: 'scale(1.04)' },
                '&.Mui-focusVisible': { outline: '2px solid #dec72b', outlineOffset: 2 },
              }}
            >
              <Box component="img" src={imagenDe(medio)} alt="" loading="lazy" decoding="async"
                sx={{ display: 'block', width: '100%', height: mosaico ? 'auto' : '100%', aspectRatio: mosaico ? undefined : '1 / 1', objectFit: 'cover' }} />
              {video && (
                <Box aria-hidden sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)' }}>
                  <PlayArrowRoundedIcon sx={{ fontSize: 56, color: '#fff' }} />
                </Box>
              )}
            </ButtonBase>
          </Box>
        )
      })}
    </Box>
  )
}
