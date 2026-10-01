import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Alert, Box, Typography } from '@mui/material'
import { Link, useSearchParams } from 'react-router-dom'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import Boton from '../../components/Boton'
import { bajaDelBoletin } from '../../lib/api/comunicados'
import { site } from '../../config/site'
import { deLaCorporacion } from '../../domain/articulos'

/**
 * La baja del boletín desde el enlace del correo, sin entrar. Pide pulsar un
 * botón en vez de darse de baja al abrir la página: algunos antivirus de
 * correo abren los enlaces por su cuenta, y darían de baja a quien no lo pidió.
 */
export default function BajaBoletinPage() {
  const [params] = useSearchParams()
  const token = params.get('t') ?? ''
  const [estado, setEstado] = useState<'pregunta' | 'enviando' | 'hecho' | 'error'>(token ? 'pregunta' : 'error')
  const [mensaje, setMensaje] = useState(token ? '' : 'Falta el enlace de baja. Ábrelo desde el botón del correo del boletín.')

  const darDeBaja = async () => {
    setEstado('enviando')
    try { setMensaje((await bajaDelBoletin(token)).message); setEstado('hecho') }
    catch (err: unknown) { setMensaje(err instanceof Error ? err.message : 'No se ha podido completar la baja.'); setEstado('error') }
  }

  return (
    <>
      <Helmet>
        <title>{`Baja del boletín | ${site.nombreCorto}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Box component="section" sx={{ py: { xs: 12, md: 18 }, textAlign: 'center' }}>
        <ContenedorDePagina>
          <Typography variant="h2" component="h1" sx={{ fontSize: { xs: '32px', md: '44px' }, mb: 2 }}>
            Baja del boletín
          </Typography>
          {estado === 'pregunta' || estado === 'enviando' ? <>
            <Typography sx={{ color: 'text.secondary', maxWidth: 560, mx: 'auto', mb: 4 }}>
              Dejarás de recibir el boletín {deLaCorporacion()} en este correo. Los avisos que tienen que ver con tu
              ficha (cuotas, cabildos, la papeleta de sitio) te seguirán llegando.
            </Typography>
            <Boton onClick={() => void darDeBaja()} disabled={estado === 'enviando'}>
              {estado === 'enviando' ? 'Un momento…' : 'Darme de baja del boletín'}
            </Boton>
          </> : (
            <Box sx={{ maxWidth: 560, mx: 'auto' }}>
              <Alert severity={estado === 'hecho' ? 'success' : 'error'} sx={{ textAlign: 'left', mb: 4 }}>{mensaje}</Alert>
              <Typography sx={{ color: 'text.secondary', mb: 3 }}>
                Puedes volver a suscribirte cuando quieras desde tu ficha, en el área de hermanos.
              </Typography>
              <Boton component={Link} to="/">Volver a la portada</Boton>
            </Box>
          )}
        </ContenedorDePagina>
      </Box>
    </>
  )
}
