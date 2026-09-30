import { Helmet } from 'react-helmet-async'
import { Box, Typography } from '@mui/material'
import { Link, useLocation } from 'react-router-dom'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import Boton from '../../components/Boton'
import { site } from '../../config/site'

export default function NoEncontradaPage() {
  const location = useLocation()

  return (
    <>
      <Helmet>
        <title>{`Página no encontrada | ${site.nombreCorto}`}</title>
        {/* Una SPA no puede devolver un 404 HTTP: al menos evitamos que se indexe */}
        <meta name="robots" content="noindex" />
      </Helmet>

      <Box component="section" sx={{ py: { xs: 12, md: 18 }, textAlign: 'center' }}>
        <ContenedorDePagina>
          <Typography variant="overline" sx={{ color: 'secondary.main', display: 'block', mb: 2 }}>
            Error 404
          </Typography>
          <Typography variant="h2" component="h1" sx={{ fontSize: { xs: '32px', md: '48px' }, mb: 2 }}>
            Página no encontrada
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: 'text.secondary', maxWidth: '560px', mx: 'auto', mb: 5 }}
          >
            La dirección <Box component="code" sx={{ color: 'text.primary' }}>{location.pathname}</Box> no existe
            o ha sido movida. Puede que el enlace esté mal escrito o que la página ya no esté disponible.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Boton component={Link} to="/">
              Volver a la portada
            </Boton>
            <Boton appVariant="outline" component={Link} to="/contacto">
              Contactar
            </Boton>
          </Box>
        </ContenedorDePagina>
      </Box>
    </>
  )
}
