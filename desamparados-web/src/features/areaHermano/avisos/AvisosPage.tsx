import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Skeleton, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import TarjetaCristal from '../../../components/TarjetaCristal'
import { enlaceDelAviso, misAvisos } from '../../../lib/api/avisos'
import { site } from '../../../config/site'
import { fechaDelAviso } from './fechaDelAviso'

/**
 * Lo que la cuenta tiene pendiente con su papeleta (sin recoger, la cita para
 * recogerla), por fecha. Lo mismo que le llegó por correo, para leerlo aunque
 * lo haya borrado. Lo demás (justificantes, avisos de la Junta) va solo por
 * correo: esto es lo que todavía hay que hacer.
 */
export default function AvisosPage() {
  const { data, isPending, isError } = useQuery({ queryKey: ['mis-avisos'], queryFn: misAvisos })

  return (
    <>
      <Helmet>
        <title>{`Avisos | ${site.nombreCorto}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <SeccionAnimada sx={{ py: { xs: 4, md: 6 } }}>
        <ContenedorDePagina sx={{ maxWidth: 760 }}>
          <Typography variant="h2" component="h1" sx={{ mb: 1 }}>Avisos</Typography>
          <Typography sx={{ color: 'text.secondary', mb: 3, maxWidth: '62ch' }}>
            Lo que tienes pendiente con tu papeleta: si está sin recoger o cuándo es tu cita para recogerla. También te llega por correo.
          </Typography>

          {isPending && (
            <Box aria-busy="true" aria-label="Cargando los avisos" sx={{ display: 'grid', gap: 1.5 }}>
              {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={92} />)}
            </Box>
          )}
          {isError && <Alert severity="error">No se han podido cargar los avisos.</Alert>}
          {data?.length === 0 && (
            <Typography sx={{ color: 'text.secondary' }}>Todavía no has recibido ningún aviso.</Typography>
          )}

          {data && data.length > 0 && (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5 }}>
              {data.map((aviso) => (
                <li key={aviso.id}>
                  <Box component={Link} to={enlaceDelAviso(aviso)} sx={{ display: 'block', color: 'inherit', textDecoration: 'none', borderRadius: '8px', '&:hover > *': { background: 'rgba(40, 36, 40, 0.9)' } }}>
                    <TarjetaCristal sx={{ p: { xs: 2, md: 2.5 } }}>
                      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{fechaDelAviso(aviso.enviadoEl)}</Typography>
                      <Typography component="h2" sx={{ fontSize: 18, fontWeight: 600, my: 0.25 }}>{aviso.asunto}</Typography>
                      <Typography sx={{ fontSize: 15, color: 'text.secondary', overflowWrap: 'anywhere' }}>{aviso.extracto}</Typography>
                    </TarjetaCristal>
                  </Box>
                </li>
              ))}
            </Box>
          )}
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}
