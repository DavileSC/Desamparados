import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import PageContainer from '../../components/PageContainer'
import AnimatedSection, { Revela } from '../../components/AnimatedSection'
import NewsCard from '../../components/NewsCard'
import { getLatestNews } from '../../lib/api/news'
import { useHomeData } from './useHomeData'
import { useTextosPortada } from './useContenidoPortada'
import HomeFeedback from './HomeFeedback'
import { SERIF, ceja, enlaceBloque } from './estilos'

// En portada caben tres noticias; el resto está en el archivo.
const MAX_NOTICIAS = 3
const fetchNews = () => getLatestNews(MAX_NOTICIAS)

/** Actualidad: bloque oscuro con las tres últimas noticias en tarjetas claras. */
export default function FeaturedNews() {
  const { data: news = [], isPending, isError, refetch } = useHomeData('news', fetchNews)
  const textos = useTextosPortada()

  return (
    <AnimatedSection cascada id="actualidad" aria-labelledby="actualidad-titulo" sx={{ py: { xs: 8, md: 11 }, backgroundColor: '#262326' }}>
      <PageContainer>
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
            <Box component={Link} to="/actualidad/noticias" sx={enlaceBloque}>
              {textos.actualidad.enlace} <span className="home-visually-hidden">las noticias</span> <ArrowForwardIcon />
            </Box>
          </Revela>
        </Box>
        <HomeFeedback loading={isPending} error={isError} empty={!news.length} label="la actualidad" emptyMessage="No hay noticias publicadas por el momento." retry={() => { void refetch() }} />
        {news.length > 0 && (
          <Box
            component="ul"
            aria-label={textos.actualidad.titulo}
            sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 3, md: 3.25 } }}
          >
            {news.slice(0, MAX_NOTICIAS).map((noticia, i) => (
              <Revela key={noticia.id} as="li" efecto="crecer" orden={3 + i} sx={{ display: 'flex' }}>
                <NewsCard news={noticia} indice={i} />
              </Revela>
            ))}
          </Box>
        )}
      </PageContainer>
    </AnimatedSection>
  )
}
