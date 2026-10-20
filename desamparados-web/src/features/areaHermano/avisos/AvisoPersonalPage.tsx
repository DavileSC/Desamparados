import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Skeleton, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Helmet } from 'react-helmet-async'
import { Link, useParams } from 'react-router-dom'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import { miAvisoPersonal } from '../../../lib/api/avisos'
import { site } from '../../../config/site'
import { fechaDelAviso } from './fechaDelAviso'

/**
 * Los enlaces de la carta (el botón al área, el mapa de Secretaría) abren en
 * la propia pestaña y no dentro del recuadro.
 */
const conEnlacesFuera = (html: string) =>
  /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, '<head$1><base target="_top">') : `<base target="_top">${html}`

/**
 * La carta en su hoja blanca, a su alto: sin barra de desplazamiento propia,
 * se lee como el resto de la página. `allow-same-origin` es para medirla; sin
 * `allow-scripts`, nada de lo que traiga se ejecuta.
 */
function Carta({ html, titulo }: { html: string; titulo: string }) {
  const marco = useRef<HTMLIFrameElement>(null)
  const observador = useRef<ResizeObserver | null>(null)
  const [alto, setAlto] = useState(640)

  useEffect(() => () => observador.current?.disconnect(), [])

  // Con `onLoad` y no con un efecto: React lo engancha antes de que el marco cargue.
  const alCargar = () => {
    const doc = marco.current?.contentDocument
    if (!doc?.documentElement) return
    const medir = () => setAlto(doc.documentElement.scrollHeight)
    medir()
    // La carta se recoloca al cambiar el ancho (girar el móvil): se vuelve a medir.
    observador.current?.disconnect()
    if (typeof ResizeObserver !== 'undefined') {
      observador.current = new ResizeObserver(medir)
      observador.current.observe(doc.body)
    }
  }

  return (
    <Box
      component="iframe"
      ref={marco}
      title={titulo}
      sandbox="allow-same-origin allow-top-navigation-by-user-activation"
      srcDoc={conEnlacesFuera(html)}
      onLoad={alCargar}
      sx={{ display: 'block', width: '100%', height: alto, border: 0, borderRadius: '8px', bgcolor: '#fff' }}
    />
  )
}

/** Un aviso personal entero: la misma carta que le habría llegado por correo. */
export default function AvisoPersonalPage() {
  const id = Number(useParams().id)
  const { data, isPending, isError } = useQuery({
    queryKey: ['mis-avisos', 'personal', id],
    queryFn: () => miAvisoPersonal(id),
    enabled: Number.isInteger(id),
  })

  return (
    <>
      <Helmet>
        <title>{`${data ? `${data.asunto} | ` : ''}Avisos | ${site.nombreCorto}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <SeccionAnimada sx={{ py: { xs: 4, md: 6 } }}>
        <ContenedorDePagina sx={{ maxWidth: 760 }}>
          <Box
            component={Link}
            to="/area-hermano/avisos"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minHeight: 44, mb: 2, color: 'text.secondary', textDecoration: 'none', '&:hover': { color: 'text.primary' } }}
          >
            <ArrowBackIcon fontSize="small" /> Avisos
          </Box>

          {isPending && (
            <Box aria-busy="true" aria-label="Cargando el aviso">
              <Skeleton variant="text" width="70%" sx={{ fontSize: 40 }} />
              <Skeleton variant="text" width="30%" sx={{ mb: 3 }} />
              <Skeleton variant="rounded" height={480} />
            </Box>
          )}
          {isError && <Alert severity="error">No se ha podido cargar el aviso.</Alert>}

          {data && (
            <article>
              <Typography variant="h2" component="h1" sx={{ mb: 0.5, textWrap: 'balance' }}>{data.asunto}</Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 14, mb: 3 }}>{fechaDelAviso(data.enviadoEl)}</Typography>
              <Carta html={data.html} titulo={data.asunto} />
            </article>
          )}
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}
