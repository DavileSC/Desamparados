import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import SeccionAnimada, { Revela } from '../../components/SeccionAnimada'
import TarjetaNoticia from '../../components/TarjetaNoticia'
import CintaDestacada from './CintaDestacada'
import { noticiasDePortada } from '../../lib/api/noticias'
import { useDatosDePortada } from './useDatosDePortada'
import { useTextosPortada } from './useContenidoPortada'
import AvisosDeInicio from './AvisosDeInicio'
import { SERIF, ceja, enlaceBloque } from './estilos'

// En portada caben tres noticias; el resto está en el archivo.
const MAX_NOTICIAS = 3
const pedirNoticias = () => noticiasDePortada(MAX_NOTICIAS)

/**
 * Actualidad: bloque oscuro con tres noticias en tarjetas claras.
 *
 * Las manda el servidor ya ordenadas: la destacada delante, si la hay, y detrás
 * las más recientes. Aquí solo se pinta lo que llega, con su cinta la que venga
 * destacada.
 */
export default function NoticiasDestacadas() {
  const { data: noticias = [], isPending, isError, refetch } = useDatosDePortada('noticias', pedirNoticias)
  const textos = useTextosPortada()

  return (
    <SeccionAnimada cascada id="actualidad" aria-labelledby="actualidad-titulo" sx={{ py: { xs: 8, md: 11 }, backgroundColor: '#121113' }}>
      <ContenedorDePagina>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, mb: { xs: 4, md: 5.5 } }}>
          <Box>
            <Revela>
              <Typography component="span" sx={ceja}>{textos.actualidad.ceja}</Typography>
            </Revela>
            <Revela efecto="cortina" orden={1}>
              <Typography id="actualidad-titulo" variant="h2" component="h2" sx={{ fontFamily: SERIF, color: '#fff', m: 0 }}>
                {textos.actualidad.titulo}
              </Typography>
            </Revela>
          </Box>
          <Revela orden={2}>
            <Box component={Link} to="/noticias" sx={enlaceBloque}>
              {textos.actualidad.enlace} <span className="home-visually-hidden">las noticias</span> <ArrowForwardIcon />
            </Box>
          </Revela>
        </Box>
        <AvisosDeInicio loading={isPending} error={isError} empty={!noticias.length} label="la actualidad" emptyMessage="No hay noticias publicadas por el momento." retry={() => { void refetch() }} />
        {noticias.length > 0 && (
          <Box
            component="ul"
            aria-label={textos.actualidad.titulo}
            sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 3, md: 3.25 } }}
          >
            {noticias.slice(0, MAX_NOTICIAS).map((noticia, i) => (
              <Revela key={noticia.id} as="li" efecto="crecer" orden={3 + i} sx={{ display: 'flex', position: 'relative' }}>
                {noticia.fijada && <CintaDestacada />}
                <TarjetaNoticia noticia={noticia} indice={i} />
              </Revela>
            ))}
          </Box>
        )}
      </ContenedorDePagina>
    </SeccionAnimada>
  )
}
