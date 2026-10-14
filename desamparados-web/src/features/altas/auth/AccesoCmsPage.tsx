import { useState } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Box, GlobalStyles, Paper, ThemeProvider, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { ESTILOS_GLOBALES_CMS, crearTemaCms } from '../../../theme/cms'
import { useAuthStore } from './store'
import FormularioAccesoCms from './FormularioAccesoCms'
import { site } from '../../../config/site'
import { deLaCorporacion } from '../../../domain/articulos'

// Modo fijo en esta pantalla: se calcula una sola vez al cargar el módulo, no
// en cada render. `crearTemaCms` construye el tema entero con `createTheme`;
// repetirlo en cada re-render (el 2FA y react-hook-form provocan varios) es
// trabajo de más y, sobre todo, rompe la identidad del objeto del tema, así
// que Emotion reinyecta estilos y se invalida cualquier hijo que dependa de esa identidad.
const TEMA_ACCESO = crearTemaCms('claro')

/**
 * Acceso propio del CMS. Misma cuentas que el área de hermanos, pero aquí solo
 * entra el equipo: una cuenta USER con credenciales válidas no consigue sesión,
 * se le cierra y se le indica el acceso que le corresponde.
 */
export default function AccesoCmsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const cms = useAuthStore((state) => state.cms)
  const entrarSesion = useAuthStore((state) => state.entrarSesion)
  // La espera del móvil lleva el número y los pasos lado a lado (maqueta 1B).
  const [ancha, setAncha] = useState(false)

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/cms'

  // Quien ya tiene sesión del CMS no ve este formulario: directo al panel. Una
  // sesión del área de hermanos no cuenta aquí: es una cookie distinta, y esta
  // pantalla ni la mira. Esa persona tiene que identificarse aquí, donde se le
  // pide el segundo factor.
  if (cms) {
    return <Navigate to="/cms" replace />
  }

  return (
    <ThemeProvider theme={TEMA_ACCESO}>
      <GlobalStyles styles={ESTILOS_GLOBALES_CMS} />
      <Helmet>
        <title>{`Acceso a la administración | CMS ${site.nombreCorto}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.default',
          color: 'text.primary',
          p: 2,
        }}
      >
        <Paper sx={{ p: { xs: 3, md: 5 }, maxWidth: ancha ? 760 : 440, width: '100%' }}>
          <Typography
            variant="h3"
            component="h1"
            sx={{ mb: 1, textAlign: 'center', fontSize: { xs: '26px', md: '32px' } }}
          >
            Acceso a la administración
          </Typography>

          <FormularioAccesoCms
            subtitulo={`Área reservada al equipo ${deLaCorporacion()}.`}
            alCambiarDeAncho={setAncha}
            alEntrar={(user) => {
              entrarSesion('cms', user)
              navigate(from, { replace: true })
            }}
          />
        </Paper>
      </Box>
    </ThemeProvider>
  )
}
