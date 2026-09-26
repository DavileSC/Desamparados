import { useEffect, useState } from 'react'
import MetaDePagina from '../../../components/MetaDePagina'
import FichaDeNoticia from '../../../components/FichaDeNoticia'
import { Link, useParams } from 'react-router-dom'
import { Alert, Box, CircularProgress, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import { noticiaPorDireccion } from '../../../lib/api/noticias'
import type { Noticia } from '../../../types'
import NoEncontradaPage from '../../noEncontrado/NoEncontradaPage'
import { limpiarHtml } from '../../../lib/limpiarHtml'
import { useVolverAlListado } from '../../../hooks/useVolverAlListado'

export default function NoticiaDetallePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  // El archivo de noticias del que se vino, con su página: sin esto, «Volver a
  // todas las noticias» devolvía siempre a la primera.
  const volverAlArchivo = useVolverAlListado('/noticias')
  const [noticia, setNoticia] = useState<Noticia | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false

    noticiaPorDireccion(slug)
      .then((data) => {
        if (!cancelado) setNoticia(data)
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se ha podido cargar la noticia.')
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })

    return () => {
      cancelado = true
    }
  }, [slug])

  if (loading) return <CircularProgress aria-label="Cargando noticia" />
  if (error) return <Alert severity="error">{error}</Alert>
  if (!noticia) return <NoEncontradaPage />

  const fecha = new Date(noticia.fecha).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <>
      <MetaDePagina titulo={noticia.titulo} descripcion={noticia.extracto} />
      <FichaDeNoticia noticia={noticia} />

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
        {noticia.imagen && (
          <>
            <Box
              component="img"
              src={noticia.imagen}
              alt=""
              aria-hidden="true"
              decoding="async"
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }}
            />
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(18, 17, 19, 0.97) 0%, rgba(18, 17, 19, 0.6) 100%)',
              }}
            />
          </>
        )}
        <ContenedorDePagina sx={{ position: 'relative', zIndex: 2, maxWidth: '900px !important' }}>
          <Typography variant="overline" sx={{ color: 'secondary.main', display: 'block', mb: 2 }}>
            {noticia.categoria} · <time dateTime={noticia.fecha}>{fecha}</time>
          </Typography>
          <Typography variant="h2" component="h1" sx={{ fontSize: { xs: '32px', md: '52px' }, mb: 2 }}>
            {noticia.titulo}
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: { xs: '16px', md: '18px' } }}>
            {noticia.extracto}
          </Typography>
        </ContenedorDePagina>
      </Box>

      <SeccionAnimada sx={{ pb: { xs: 8, md: 12 } }}>
        <ContenedorDePagina sx={{ maxWidth: '900px !important' }}>
          <Typography
            component="article"
            variant="body1"
            sx={{ color: 'text.primary', fontSize: { xs: '16px', md: '18px' }, lineHeight: 1.8, whiteSpace: 'pre-line' }}
          >
            <span dangerouslySetInnerHTML={{ __html: limpiarHtml(noticia.contenido ?? noticia.extracto ?? '') }} />
          </Typography>

          <Box
            component={Link}
            to={volverAlArchivo}
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
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}
