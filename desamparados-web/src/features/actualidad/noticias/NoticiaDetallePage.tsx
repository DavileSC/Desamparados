import { useEffect, useState } from 'react'
import MetaDePagina from '../../../components/MetaDePagina'
import FichaDeNoticia from '../../../components/FichaDeNoticia'
import { Link, useParams } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import { noticiaPorDireccion } from '../../../lib/api/noticias'
import type { Noticia } from '../../../types'
import NoEncontradaPage from '../../noEncontrado/NoEncontradaPage'
import { limpiarHtml } from '../../../lib/limpiarHtml'
import { useVolverAlListado } from '../../../hooks/useVolverAlListado'
import EnCarga from '../../../components/esqueleto/EnCarga'
import { Lineas } from '../../../components/esqueleto/Hueso'

// La cabecera y el cuerpo de la ficha: los comparten la ficha y su esqueleto.
const cabeceraSx = { position: 'relative', py: { xs: 10, md: 14 }, mb: { xs: 4, md: 6 }, backgroundColor: 'background.paper', overflow: 'hidden' } as const
const columna = { maxWidth: '900px !important' } as const

export default function NoticiaDetallePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  // El archivo de noticias del que se vino, con su página: sin esto, «Volver a
  // todas las noticias» devolvía siempre a la primera.
  const volverAlArchivo = useVolverAlListado('/noticias')
  const [noticia, setNoticia] = useState<Noticia | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)

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
  }, [slug, intento])

  const reintentar = () => {
    setError(null)
    setLoading(true)
    setIntento((n) => n + 1)
  }

  if (loading || error) {
    return <EnCarga avisoArriba estado={loading ? 'cargando' : 'error'} que="la noticia" alReintentar={reintentar} esqueleto={<FichaEsqueleto />} />
  }
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

      <Box component="header" sx={cabeceraSx}>
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
        <ContenedorDePagina sx={{ position: 'relative', zIndex: 2, ...columna }}>
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
        <ContenedorDePagina sx={columna}>
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

/**
 * La ficha mientras llega la noticia: la cabecera con la categoría y la fecha,
 * dos líneas de título y dos de entradilla, y unos párrafos del cuerpo.
 */
function FichaEsqueleto() {
  return (
    <>
      <Box sx={cabeceraSx}>
        <ContenedorDePagina sx={columna}>
          <Box sx={{ mb: 2 }}><Lineas anchos={['220px']} linea={32} grosor={9} /></Box>
          <Box sx={{ mb: 2 }}><Lineas anchos={['90%', '55%']} linea={{ xs: 38.4, md: 62.4 }} grosor={{ xs: 22, md: 36 }} /></Box>
          <Lineas anchos={['96%', '68%']} linea={{ xs: 24, md: 27 }} grosor={10} />
        </ContenedorDePagina>
      </Box>
      <Box sx={{ pb: { xs: 8, md: 12 } }}>
        <ContenedorDePagina sx={columna}>
          <Lineas anchos={['100%', '97%', '99%', '62%']} linea={{ xs: 28.8, md: 32.4 }} grosor={10} />
          <Box sx={{ mt: { xs: 3.5, md: 4 } }}>
            <Lineas anchos={['98%', '100%', '94%', '40%']} linea={{ xs: 28.8, md: 32.4 }} grosor={10} />
          </Box>
        </ContenedorDePagina>
      </Box>
    </>
  )
}
