import { lazy, Suspense, useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import MetaDePagina from '../../components/MetaDePagina'
import Boton from '../../components/Boton'
import { enlaceConFlecha } from '../../components/estiloDeBoton'
import { hayWebGL } from '../../components/mapa/barrio'
import { CLAVE_RECORRIDO, getContenido, type BloqueItinerario, type Coordenada, type PaginaDeBloques } from '../../lib/api/contenido'
import { useModulos } from '../../hooks/useModulos'
import { ahorraDatos } from '../../lib/videoPropio'

// Aparte: el mapa trae MapLibre (unos 280 KB y su worker), y la 404 la usan
// también páginas que no lo necesitan (una noticia que no existe, un módulo
// apagado). Solo se descarga si hay mapa que pintar.
const MapaFueraDelRecorrido = lazy(() => import('./MapaFueraDelRecorrido'))

/** El sitio del mapa mientras llega, del mismo tamaño para que nada salte. */
const huecoDelMapa = <Box sx={{ aspectRatio: { xs: '1.1 / 1', sm: '1.5 / 1', md: '1.05 / 1' }, borderRadius: '8px', bgcolor: '#0b0a0c' }} />

/** La línea del recorrido de la salida, si la página del recorrido tiene una dibujada sobre el mapa. */
function lineaDelRecorrido(pagina: PaginaDeBloques | undefined): Coordenada[] | null {
  const bloque = pagina?.bloques.find((b): b is BloqueItinerario => b.tipo === 'itinerario' && (b.recorrido?.linea.length ?? 0) >= 2)
  return bloque?.recorrido?.linea ?? null
}

/**
 * La página de «no existe». «Esta calle no está en el recorrido»: al lado, el
 * mapa del recorrido con una calle que se sale de él, marcada como 404. Si no
 * hay recorrido dibujado, o el navegador no puede pintar el mapa, queda el
 * texto solo, que dice lo mismo.
 */
export default function NoEncontradaPage() {
  const location = useLocation()
  const { activo } = useModulos()
  // La misma consulta que la página del recorrido: si se viene de ella, ya está en caché.
  // Una vez: preguntar por WebGL crea un lienzo, y no hace falta en cada
  // pintado. Con el ahorro de datos o una conexión lenta, como el vídeo del
  // hero, el mapa no se descarga: el texto dice lo mismo.
  const [conMapa] = useState(() => hayWebGL() && !ahorraDatos())
  const recorrido = useQuery({
    queryKey: CLAVE_RECORRIDO,
    queryFn: () => getContenido<PaginaDeBloques>('recorrido'),
    staleTime: 5 * 60_000,
    retry: false,
    enabled: conMapa,
  })
  const linea = conMapa ? lineaDelRecorrido(recorrido.data) : null
  // El mapa espera a que el navegador quede libre: lo primero es el texto.
  const [desocupado, setDesocupado] = useState(false)
  useEffect(() => {
    if (!linea || desocupado) return
    // Safari no tiene requestIdleCallback: ahí, un respiro corto.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => setDesocupado(true), { timeout: 1500 })
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(() => setDesocupado(true), 300)
    return () => clearTimeout(id)
  }, [linea, desocupado])

  return (
    <>
      {/* Una SPA no puede devolver un 404 HTTP: al menos evitamos que se indexe, y sin canonical a la dirección rota. */}
      <MetaDePagina titulo="Página no encontrada" sinIndexar />

      <Box component="section" sx={{ py: { xs: 4, md: 10 }, minHeight: { md: 'calc(100svh - 72px)' }, display: 'flex', alignItems: 'center' }}>
        <ContenedorDePagina>
          <Box sx={{
            display: 'grid', alignItems: 'center',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: linea ? 'minmax(0, .9fr) minmax(0, 1.1fr)' : 'minmax(0, 1fr)' },
            gap: { xs: 3, md: 7 },
          }}>
            <Box sx={{ display: 'grid', gap: 2.25, justifyItems: 'start', maxWidth: linea ? 'none' : 640 }}>
              <Typography variant="overline" sx={{ color: 'secondary.main', letterSpacing: '0.22em', lineHeight: 1.6 }}>
                Error 404
              </Typography>
              <Typography variant="h2" component="h1" sx={{ fontSize: { xs: '32px', sm: '44px', md: '56px' }, lineHeight: 1.05, textWrap: 'balance' }}>
                Esta calle no está en el recorrido
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: { xs: 16, md: 18 }, maxWidth: '44ch' }}>
                La dirección{' '}
                <Box component="code" sx={{ color: 'text.primary', bgcolor: 'rgba(243,239,230,.08)', px: 0.75, py: 0.25, borderRadius: '4px', overflowWrap: 'anywhere' }}>{location.pathname}</Box>{' '}
                no existe o ha cambiado de sitio. Puede que el enlace esté mal escrito. El cortejo sigue por aquí:
              </Typography>
              {/* Biblia de la Conferencia Episcopal Española. */}
              <Box component="blockquote" sx={{ m: 0, pl: 2, borderLeft: '2px solid', borderColor: 'secondary.main', maxWidth: '46ch' }}>
                <Typography sx={{ fontStyle: 'italic', fontSize: { xs: 15, md: 16 }, color: 'text.primary' }}>
                  «Yo soy el camino y la verdad y la vida».
                </Typography>
                <Typography component="cite" sx={{ display: 'block', fontStyle: 'normal', fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'secondary.main', mt: 0.75 }}>
                  Juan 14, 6
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 1.5, sm: 2.5 }, mt: 1, width: '100%' }}>
                <Boton component={Link} to="/" sx={{ width: { xs: '100%', sm: 'auto' } }}>Volver a la portada</Boton>
                {activo('agenda') && <Boton appVariant="outline" component={Link} to="/agenda">Ver la agenda</Boton>}
                <Box component={Link} to="/contacto" sx={enlaceConFlecha}>
                  Contacto <ArrowForwardIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
                </Box>
              </Box>
            </Box>
            {linea && (
              // En el móvil y la tableta, el mapa va primero: es lo que dice de un vistazo qué ha pasado.
              <Box sx={{ order: { xs: -1, md: 0 }, width: '100%', maxWidth: { xs: 640, md: 'none' }, justifySelf: 'center' }}>
                <Suspense fallback={huecoDelMapa}>
                  {desocupado ? <MapaFueraDelRecorrido linea={linea} /> : huecoDelMapa}
                </Suspense>
              </Box>
            )}
          </Box>
        </ContenedorDePagina>
      </Box>
    </>
  )
}
