import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import PageContainer from '../../components/PageContainer'
import AnimatedSection, { Revela } from '../../components/AnimatedSection'
import { getLatestNews } from '../../lib/api/news'
import type { NewsItem } from '../../types'
import { useHomeData } from './useHomeData'
import HomeFeedback from './HomeFeedback'
import { GOLD, GRANATE, SERIF, ceja, enlaceBloque } from './estilos'

// En portada caben tres noticias; el resto está en el archivo.
const MAX_NOTICIAS = 3
const fetchNews = () => getLatestNews(MAX_NOTICIAS)

// Tres letras siempre («sep», no «sept.»): la abreviatura de cada motor varía.
const fechaCorta = (iso: string) => {
  const fecha = new Date(iso)
  return `${fecha.getDate()} ${fecha.toLocaleDateString('es-ES', { month: 'long' }).slice(0, 3)} ${fecha.getFullYear()}`
}

const tresLineas = { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as const

// Las placas de las noticias sin foto alternan tono: tres seguidas del mismo color pesan como un solo bloque.
const TONOS_PLACA = [
  { tono: 'granate', fondo: GRANATE, letra: '#fbe9e7' },
  { tono: 'tinta', fondo: '#121012', letra: GOLD },
  { tono: 'piedra', fondo: '#3a3538', letra: '#e3d8bf' },
] as const

function Tarjeta({ news, indice }: { news: NewsItem; indice: number }) {
  const tono = TONOS_PLACA[indice % TONOS_PLACA.length]

  return (
    <Revela as="li" orden={2 + indice} sx={{ display: 'flex' }}>
      <Box
        component={Link}
        to={`/actualidad/noticias/${news.slug}`}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          backgroundColor: '#fbf9f6',
          color: '#1b1c1a',
          textDecoration: 'none',
          boxShadow: '0 24px 50px -30px rgba(0, 0, 0, 0.8)',
          transition: 'transform .3s ease',
          '@media (hover: hover)': {
            '&:hover': { transform: 'translateY(-3px)' },
            '&:hover .noticia-titulo': { color: GRANATE },
          },
        }}
      >
        {news.image ? (
          <Box component="img" src={news.image} alt="" loading="lazy" decoding="async" sx={{ display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover' }} />
        ) : (
          // Sin foto, una placa con la inicial: la tarjeta nunca queda con un hueco.
          <Box
            data-testid="placa-noticia"
            data-tono={tono.tono}
            aria-hidden="true"
            sx={{ aspectRatio: '4 / 3', p: { xs: 2.5, md: 3 }, backgroundColor: tono.fondo, color: tono.letra, fontFamily: SERIF, fontSize: { xs: 120, md: 150 }, lineHeight: 0.8 }}
          >
            {news.title.trim().charAt(0).toUpperCase()}
          </Box>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, p: { xs: 2.5, md: 3 } }}>
          <Typography component="time" dateTime={news.date} sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: GRANATE }}>
            {fechaCorta(news.date)}
          </Typography>
          <Typography variant="h3" component="h3" className="noticia-titulo" sx={{ fontFamily: SERIF, fontSize: { xs: 20, md: 21 }, lineHeight: 1.3, color: '#1b1c1a', textWrap: 'balance', transition: 'color .3s ease' }}>
            {news.title}
          </Typography>
          {news.excerpt && (
            <Typography sx={{ ...tresLineas, fontSize: 14, lineHeight: 1.6, color: '#4a454a' }}>
              {news.excerpt}
            </Typography>
          )}
          <Box component="span" sx={{ mt: 'auto', pt: 1, display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: 13, fontWeight: 600, '& svg': { fontSize: 16 } }}>
            Leer noticia <ArrowForwardIcon />
          </Box>
        </Box>
      </Box>
    </Revela>
  )
}

/** Actualidad: bloque oscuro con las tres últimas noticias en tarjetas claras. */
export default function FeaturedNews() {
  const { data: news = [], isPending, isError, refetch } = useHomeData('news', fetchNews)

  return (
    <AnimatedSection cascada id="actualidad" aria-labelledby="actualidad-titulo" sx={{ py: { xs: 8, md: 11 }, backgroundColor: '#262326' }}>
      <PageContainer>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2, mb: { xs: 4, md: 5.5 } }}>
          <Revela>
            <Typography component="span" sx={ceja}>Actualidad</Typography>
            <Typography id="actualidad-titulo" variant="h2" component="h2" sx={{ fontFamily: SERIF, color: '#fff', m: 0 }}>
              Últimas noticias
            </Typography>
          </Revela>
          <Revela orden={1}>
            <Box component={Link} to="/actualidad/noticias" sx={enlaceBloque}>
              Ver todas <span className="home-visually-hidden">las noticias</span> <ArrowForwardIcon />
            </Box>
          </Revela>
        </Box>
        <HomeFeedback loading={isPending} error={isError} empty={!news.length} label="la actualidad" emptyMessage="No hay noticias publicadas por el momento." retry={() => { void refetch() }} />
        {news.length > 0 && (
          <Box
            component="ul"
            aria-label="Últimas noticias"
            sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: { xs: 3, md: 3.25 } }}
          >
            {news.slice(0, MAX_NOTICIAS).map((noticia, i) => <Tarjeta key={noticia.id} news={noticia} indice={i} />)}
          </Box>
        )}
      </PageContainer>
    </AnimatedSection>
  )
}
