import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import TarjetaCristal from '../../../components/TarjetaCristal'
import FormularioAccesoHermano from './FormularioAccesoHermano'
import { useAuthStore, type AuthUser } from './store'
import { site } from '../../../config/site'
import { useModulos } from '../../../hooks/useModulos'

export default function AccesoPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const hermano = useAuthStore((state) => state.hermano)
  const caducada = useAuthStore((state) => state.hermanoCaducada)
  const entrarSesion = useAuthStore((state) => state.entrarSesion)
  const { activo, activos } = useModulos()

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/area-hermano'

  // Sin rebote: un cargo que entra por aquí crea sesión de hermano válida y
  // va al área de hermanos igual que cualquiera. Si además quiere el CMS,
  // entra por /cms/acceso, que es el acceso con segundo factor y su propia
  // cookie; por eso las dos sesiones son independientes.
  const alEntrar = (user: AuthUser) => {
    entrarSesion('hermanos', user)
    navigate(from, { replace: true })
  }

  // Quien ya tiene sesión del área de hermanos no ve este formulario: directo al área.
  // Con la sesión caducada dentro del área (`hermanoCaducada`), `hermano`
  // sigue puesto a propósito, pero aquí se viene a entrar otra vez.
  if (hermano && !caducada) {
    return <Navigate to="/area-hermano" replace />
  }

  // Con el área apagada, el servidor rechaza el login con un 404; mejor decirlo
  // antes de que nadie escriba su contraseña. A la junta se le enseña su acceso.
  if (activos && !activo('area-hermanos')) {
    // En la misma tarjeta que el formulario, y como contenido principal con su
    // título: es la página entera, no un aviso suelto en el marco.
    return (
      <>
        <Helmet>
          <title>{`Área de hermanos no activada | ${site.nombreCorto}`}</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <TarjetaCristal component="main" sx={{ width: '100%', p: { xs: 3, md: 5 }, maxWidth: 440, mx: 'auto', textAlign: 'center' }}>
          <Typography component="h1" variant="h5" sx={{ mb: 1.5 }}>El área de hermanos no está activada</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>En esta instalación los hermanos no entran por la web.</Typography>
          <Typography>Si eres de la Junta de Gobierno, entra por el <Link to="/cms/acceso">acceso del CMS</Link>.</Typography>
        </TarjetaCristal>
      </>
    )
  }

  return (
    <>
      <Helmet>
        <title>{`Acceso hermanos | ${site.nombreCorto}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <TarjetaCristal component="main" sx={{ width: '100%', p: { xs: 3, md: 5 }, maxWidth: 440, mx: 'auto' }}>
        <Typography
          variant="h3"
          component="h1"
          sx={{ mb: 1, textAlign: 'center', fontSize: { xs: '28px', md: '36px' } }}
        >
          Acceso hermanos
        </Typography>

        <FormularioAccesoHermano alEntrar={alEntrar} subtitulo="Introduce tus credenciales para acceder a tu área privada." />

        {/* Sin el alta por la web, «Hazte hermano» no existe: no se ofrece. */}
        {activo('alta-web') && (
          <Typography
            variant="body2"
            sx={{ mt: 3, textAlign: 'center', color: 'text.secondary', fontSize: '13px' }}
          >
            ¿Aún no eres hermano?{' '}
            <Box component="a" href="/hazte-hermano" sx={{ color: 'secondary.main', textDecoration: 'underline', display: 'inline-block', py: '12px', my: '-12px' }}>
              Solicita tu alta
            </Box>
          </Typography>
        )}
      </TarjetaCristal>
    </>
  )
}
