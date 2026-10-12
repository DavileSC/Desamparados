import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import SeccionAnimada, { Revela } from '../../components/SeccionAnimada'
import TarjetaNoticia, { TarjetaNoticiaEsqueleto } from '../../components/TarjetaNoticia'
import EnCarga, { estadoDeConsulta } from '../../components/esqueleto/EnCarga'
import CintaDestacada from './CintaDestacada'
import { pedirUltimasNoticias } from '../../lib/api/noticias'
import { useDatosDePortada } from './useDatosDePortada'
import { useTextosPortada } from './useContenidoPortada'
import TextoDePortada from './TextoDePortada'
import AvisosDeInicio from './AvisosDeInicio'
import { SERIF, ceja, enlaceBloque } from './estilos'
import { useModulos } from '../../hooks/useModulos'

// En portada caben tres noticias; el resto está en el archivo.
const MAX_NOTICIAS = 3

const rejilla = { listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 3, md: 3.25 } } as const
// En tableta van de dos en dos: la tercera se quedaría sola con medio hueco al
// lado. Ahí se enseñan dos, y el resto está en «Ver todas».
const visibleEnTableta = (i: number) => (i === 2 ? { xs: 'flex', sm: 'none', md: 'flex' } : 'flex')

/**
 * Actualidad: bloque oscuro con tres noticias en tarjetas claras.
 *
 * Las manda el servidor ya ordenadas: la destacada delante, si la hay, y detrás
 * las más recientes. Aquí solo se pinta lo que llega, con su cinta la que venga
 * destacada.
 */
export default function NoticiasDestacadas() {
  const { activos, activo } = useModulos()
  // La lista llega en milisegundos y en esta instalación todo está encendido:
  // mejor un esqueleto mientras no se sabe que un hueco que luego crece.
  const apagado = activos !== null && !activo('noticias')
  const consulta = useDatosDePortada('noticias', pedirUltimasNoticias, activos !== null && activo('noticias'))
  const { data: todas = [], isPending, isError, refetch } = consulta
  const noticias = todas.slice(0, MAX_NOTICIAS)
  const textos = useTextosPortada()
  if (apagado) return null

  return (
    <SeccionAnimada cascada id="actualidad" aria-labelledby="actualidad-titulo" sx={{ py: { xs: 8, md: 11 }, backgroundColor: '#121113' }}>
      <ContenedorDePagina>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, mb: { xs: 4, md: 5.5 } }}>
          <Box>
            <Revela>
              <Typography component="span" sx={ceja}><TextoDePortada anchos={['7em']}>{textos.actualidad.ceja}</TextoDePortada></Typography>
            </Revela>
            <Revela efecto="cortina" orden={1}>
              <Typography id="actualidad-titulo" variant="h2" component="h2" sx={{ fontFamily: SERIF, color: '#fff', m: 0 }}>
                <TextoDePortada anchos={['8em']}>{textos.actualidad.titulo}</TextoDePortada>
              </Typography>
            </Revela>
          </Box>
          <Revela orden={2}>
            <Box component={Link} to="/noticias" sx={enlaceBloque}>
              <TextoDePortada anchos={['5em']}>{textos.actualidad.enlace}</TextoDePortada> <span className="home-visually-hidden">las noticias</span> <ArrowForwardIcon />
            </Box>
          </Revela>
        </Box>
        {isPending || isError ? (
          <EnCarga
            estado={estadoDeConsulta(consulta)}
            que="las noticias"
            alReintentar={() => { void refetch() }}
            esqueleto={(
              <Box sx={rejilla}>
                {Array.from({ length: MAX_NOTICIAS }, (_, i) => (
                  <Box key={i} sx={{ display: visibleEnTableta(i) }}><TarjetaNoticiaEsqueleto /></Box>
                ))}
              </Box>
            )}
          />
        ) : noticias.length === 0 ? (
          <AvisosDeInicio mensaje="No hay noticias publicadas por el momento." />
        ) : (
          <Box component="ul" aria-label={textos.actualidad.titulo} sx={rejilla}>
            {noticias.slice(0, MAX_NOTICIAS).map((noticia, i) => (
              <Revela
                key={noticia.id}
                as="li"
                efecto="crecer"
                orden={3 + i}
                sx={{ display: visibleEnTableta(i), position: 'relative' }}
              >
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
