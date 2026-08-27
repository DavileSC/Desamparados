import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useParams } from 'react-router-dom'
import { Alert, Box, CircularProgress, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PageContainer from '../../../components/PageContainer'
import AnimatedSection from '../../../components/AnimatedSection'
import { getNewsBySlug } from '../../../lib/api/news'
import type { NewsItem } from '../../../types'
import NotFoundPage from '../../notFound/NotFoundPage'

export default function NoticiaDetallePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const [news, setNews] = useState<NewsItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    getNewsBySlug(slug)
      .then((data) => {
        if (!cancelled) setNews(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No se ha podido cargar la noticia.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  if (loading) return <CircularProgress aria-label="Cargando noticia" />
  if (error) return <Alert severity="error">{error}</Alert>
  if (!news) return <NotFoundPage />

  const fecha = new Date(news.date).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <>
      <Helmet>
        <title>{news.title} | Desamparados</title>
        <meta name="description" content={news.excerpt} />
      </Helmet>

      <Box
        component="header"
        sx={{
          position: 'relative',
          py: { xs: 10, md: 14 },
          mb: { xs: 4, md: 6 },
          backgroundColor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        {news.image && (
          <>
            <Box
              component="img"
              src={news.image}
              alt=""
              aria-hidden="true"
              decoding="async"
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }}
            />
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(38, 35, 38, 0.97) 0%, rgba(38, 35, 38, 0.6) 100%)',
              }}
            />
          </>
        )}
        <PageContainer sx={{ position: 'relative', zIndex: 2, maxWidth: '900px !important' }}>
          <Typography variant="overline" sx={{ color: 'secondary.main', display: 'block', mb: 2 }}>
            {news.category} · <time dateTime={news.date}>{fecha}</time>
          </Typography>
          <Typography variant="h2" component="h1" sx={{ fontSize: { xs: '32px', md: '52px' }, mb: 2 }}>
            {news.title}
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: { xs: '16px', md: '18px' } }}>
            {news.excerpt}
          </Typography>
        </PageContainer>
      </Box>

      <AnimatedSection sx={{ pb: { xs: 8, md: 12 } }}>
        <PageContainer sx={{ maxWidth: '900px !important' }}>
          <Typography
            component="article"
            variant="body1"
            sx={{ color: 'text.primary', fontSize: { xs: '16px', md: '18px' }, lineHeight: 1.8, whiteSpace: 'pre-line' }}
          >
            <span dangerouslySetInnerHTML={{ __html: news.content ?? news.excerpt }} />
          </Typography>

          <Box
            component={Link}
            to="/actualidad/noticias"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              mt: 6,
              color: 'secondary.main',
              fontWeight: 600,
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            <ArrowBackIcon fontSize="small" /> Volver a todas las noticias
          </Box>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
