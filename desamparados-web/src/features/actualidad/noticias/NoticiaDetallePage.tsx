import { useQuery } from '@tanstack/react-query'
import MetaDePagina from '../../../components/MetaDePagina'
import FichaDeNoticia from '../../../components/FichaDeNoticia'
import { Link, useParams } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import { noticiaPorDireccion } from '../../../lib/api/noticias'
import { ErrorDeApi } from '../../../lib/api/cliente'
import NoEncontradaPage from '../../noEncontrado/NoEncontradaPage'
import { limpiarHtml } from '../../../lib/limpiarHtml'
import { useVolverAlListado } from '../../../hooks/useVolverAlListado'
import EnCarga from '../../../components/esqueleto/EnCarga'
import { Lineas } from '../../../components/esqueleto/Hueso'
import { enlaceConFlecha } from '../../../components/estiloDeBoton'
import { propsDeFoto } from '../../../lib/fotoSubida'

// La cabecera y el cuerpo de la ficha: los comparten la ficha y su esqueleto.
const cabeceraSx = { position: 'relative', pt: { xs: 10, md: 14 }, pb: { xs: 4, md: 5 }, mb: { xs: 3, md: 4 }, backgroundColor: 'background.paper', overflow: 'hidden' } as const
const columna = { maxWidth: '900px !important' } as const

export default function NoticiaDetallePage() {
  const { slug = '' } = useParams<{ slug: string }>()
  // El archivo de noticias del que se vino, con su página: sin esto, «Volver a
  // todas las noticias» devolvía siempre a la primera.
  const volverAlArchivo = useVolverAlListado('/noticias')
  // Con el slug en la clave: al ir atrás o adelante entre noticias, cada una
  // trae lo suyo (antes se veía la anterior, o un error viejo que no se
  // limpiaba), y volver a una ya vista no la pide otra vez.
  const consulta = useQuery({
    queryKey: ['noticias', 'ficha', slug],
    queryFn: () => noticiaPorDireccion(slug),
    // Una dirección que no existe no es un fallo pasajero: ni se reintenta ni
    // se ofrece «Volver a intentar», y la página de no encontrada lleva el
    // noindex que la saca de los buscadores.
    retry: (veces, error) => !(error instanceof ErrorDeApi && error.status === 404) && veces < 1,
  })

  if (consulta.error instanceof ErrorDeApi && consulta.error.status === 404) return <NoEncontradaPage />
  if (consulta.isPending || consulta.isError) {
    return <EnCarga avisoArriba estado={consulta.isPending ? 'cargando' : 'error'} que="la noticia" alReintentar={() => void consulta.refetch()} esqueleto={<FichaEsqueleto />} />
  }
  const noticia = consulta.data

  const cuerpo = noticia.contenido ?? noticia.extracto ?? ''
  // Un texto en HTML ya trae sus párrafos: con `pre-line`, los saltos de línea
  // entre etiquetas se pintaban como líneas en blanco de más. Solo el texto
  // plano (el de antes del editor) necesita que se respeten sus saltos.
  const esHtml = /<(p|br|h[1-6]|ul|ol|blockquote|div)[\s>]/i.test(cuerpo)
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
              {...propsDeFoto(noticia.imagen, '100vw')}
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
            sx={{ color: 'text.primary', fontSize: { xs: '16px', md: '18px' }, lineHeight: 1.8, whiteSpace: esHtml ? 'normal' : 'pre-line', '& p': { m: 0, mb: 2.5 }, '& p:last-child': { mb: 0 } }}
          >
            <span dangerouslySetInnerHTML={{ __html: limpiarHtml(cuerpo) }} />
          </Typography>

          <Box
            component={Link}
            to={volverAlArchivo}
            // Como los demás enlaces con flecha de la web, con la flecha hacia atrás.
            sx={{ ...enlaceConFlecha, mt: 6, '&:hover svg': { transform: 'translateX(-3px)' } }}
          >
            <ArrowBackIcon aria-hidden /> Volver a todas las noticias
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
