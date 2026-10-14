import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Skeleton, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { Helmet } from 'react-helmet-async'
import { Link, useParams } from 'react-router-dom'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import { miAviso } from '../../../lib/api/avisos'
import { limpiarHtml } from '../../../lib/limpiarHtml'
import { site } from '../../../config/site'
import { fechaDelAviso } from './fechaDelAviso'

/** Un aviso de la Junta entero: adonde lleva el aviso del móvil. */
export default function AvisoPage() {
  const id = Number(useParams().id)
  const { data, isPending, isError } = useQuery({ queryKey: ['mis-avisos', id], queryFn: () => miAviso(id), enabled: Number.isInteger(id) })

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
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="text" />)}
            </Box>
          )}
          {isError && <Alert severity="error">No se ha podido cargar el aviso.</Alert>}

          {data && (
            <article>
              <Typography variant="h2" component="h1" sx={{ mb: 0.5, textWrap: 'balance' }}>{data.asunto}</Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: 14, mb: 3 }}>{fechaDelAviso(data.enviadoEl)}</Typography>
              <Box
                sx={{ fontSize: 17, lineHeight: 1.65, overflowWrap: 'anywhere', '& img': { maxWidth: '100%', height: 'auto' }, '& a': { color: 'primary.light' }, '& p': { mt: 0, mb: 2 } }}
                dangerouslySetInnerHTML={{ __html: limpiarHtml(data.cuerpo) }}
              />
            </article>
          )}
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}
