import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Box, Typography, useMediaQuery, type SxProps, type Theme } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import TarjetaCristal from '../../../components/TarjetaCristal'
import Boton from '../../../components/Boton'
import { MARCA, alfa } from '../../../theme/marca'
import { CORMORANT } from '../../actualidad/agenda/letraAlmanaque'
import { FOTO_DEL_ACCESO, FOTO_DE_LA_PUERTA_DEL_ALTA } from '../../../config/fotosDeLaInstalacion'
import { useFotoQueFalla } from '../../../hooks/useFotoQueFalla'
import { MOVIL_ESTRECHO, MOVIL_MEDIO, MOVIL_MINIMO } from './pantallaDeAcceso'
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
  // En el ordenador, dos puertas; en el móvil y la tableta, un solo panel con
  // el alta al pie del formulario. Se decide aquí y no con CSS: así el bloque
  // del alta está una sola vez en la página, también para el lector de pantalla.
  // 900 px es el `md` de MUI, escrito tal cual: la página no depende de que haya tema.
  const dosPuertas = useMediaQuery('(min-width:900px)', { noSsr: true })

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

  // Sin el alta por la web, «Hazte hermano» no existe: no hay segunda puerta, y
  // la del formulario se queda sola y más estrecha, sin el «Ya soy hermano».
  const conAlta = activo('alta-web')
  const segundaPuerta = conAlta && dosPuertas

  // Lo mismo en su puerta (ordenador) que al pie del formulario (móvil); al
  // pie, algo más pequeño, que el protagonista es el formulario.
  const alta = (alPie: boolean) => (
    <>
      {!alPie && <Typography component="p" sx={ANTETITULO}>Aún no lo soy</Typography>}
      <Typography component="h2" sx={{ fontFamily: CORMORANT, fontWeight: 600, fontSize: alPie ? 22 : 34, lineHeight: 1.1, mb: alPie ? 1.25 : 1.5, ...(alPie && { [MOVIL_MINIMO]: { display: 'none' } }) }}>
        ¿Aún no eres hermano?
      </Typography>
      {/* Al pie, en un móvil que no da para todo, sobra la explicación: el botón ya lo dice. */}
      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, mb: alPie ? 2 : 3, ...(alPie && { [MOVIL_MEDIO]: { display: 'none' } }) }}>
        Pide el alta desde la web; se formaliza en la Secretaría y allí se activa tu acceso.
      </Typography>
      <Boton appVariant="claro" href="/hazte-hermano">Solicita tu alta</Boton>
    </>
  )

  return (
    <>
      <Helmet>
        <title>{`Acceso hermanos | ${site.nombreCorto}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Box
        component="main"
        sx={{
          width: '100%',
          maxWidth: segundaPuerta ? 'none' : 640,
          mx: 'auto',
          display: 'flex',
          gap: 3,
          minHeight: { md: 520 },
        }}
      >
        <Puerta foto={FOTO_DEL_ACCESO} encuadre="center 30%" sx={{ flex: '1 1 0', p: { xs: 2, sm: 5, md: '44px 56px' }, [MOVIL_ESTRECHO]: { p: 1.5 }, [MOVIL_MINIMO]: { pb: 1 } }}>
          {segundaPuerta && <Typography component="p" sx={ANTETITULO}>Ya soy hermano</Typography>}
          <Typography variant="h3" component="h1" sx={{ mb: 1, fontSize: { xs: '26px', md: '34px' }, [MOVIL_MINIMO]: { mb: 0.5 } }}>
            Acceso hermanos
          </Typography>
          <Box sx={{ maxWidth: 460 }}>
            <FormularioAccesoHermano alIzquierda alEntrar={alEntrar} subtitulo="Introduce tus credenciales para acceder a tu área privada." />
          </Box>
          {conAlta && !dosPuertas && (
            <Box sx={{ mt: 2.5, pt: 2.5, [MOVIL_MINIMO]: { mt: 1.5, pt: 1.5 }, borderTop: `1px solid ${alfa(MARCA.acentoApagado, 0.3)}` }}>{alta(true)}</Box>
          )}
        </Puerta>

        {segundaPuerta && (
          <Puerta
            foto={FOTO_DE_LA_PUERTA_DEL_ALTA}
            encuadre="62% center"
            sx={{ width: { md: 380, lg: 420 }, flexShrink: 0, p: '44px 40px' }}
          >
            {alta(false)}
          </Puerta>
        )}
      </Box>
    </>
  )
}

/** El fondo de las dos puertas: el de las tarjetas, ya sin el cristal. */
const FONDO_PUERTA = '#1a181b'
/** La foto apenas se intuye: la letra de encima no pierde contraste. */
const OPACIDAD_FOTO = 0.07

const ANTETITULO = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: MARCA.acento,
  mb: 1,
} as const

/**
 * Cada una de las dos puertas del acceso: un panel liso con su foto velada
 * detrás. La foto es de la instalación (`config/fotosDeLaInstalacion.ts`):
 * donde no está, se quita y queda el panel liso.
 */
function Puerta({ foto, encuadre, sx, children }: { foto: string; encuadre: string; sx?: SxProps<Theme>; children: ReactNode }) {
  const { visible, alFallar } = useFotoQueFalla(foto)
  return (
    <Box
      sx={[
        { position: 'relative', overflow: 'hidden', backgroundColor: FONDO_PUERTA, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {visible && (
        <Box
          component="img"
          src={foto}
          alt=""
          aria-hidden="true"
          decoding="async"
          onError={alFallar}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: encuadre, opacity: OPACIDAD_FOTO, pointerEvents: 'none' }}
        />
      )}
      <Box sx={{ position: 'relative', width: '100%' }}>{children}</Box>
    </Box>
  )
}
