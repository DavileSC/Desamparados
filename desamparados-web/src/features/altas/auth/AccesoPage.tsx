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
        {/* El marco del acceso va a pantalla completa y no centra nada: lo centra esta caja. */}
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, pt: 10, pb: 4 }}>
        <TarjetaCristal component="main" sx={{ width: '100%', p: { xs: 3, md: 5 }, maxWidth: 440, mx: 'auto', textAlign: 'center' }}>
          <Typography component="h1" variant="h5" sx={{ mb: 1.5 }}>El área de hermanos no está activada</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>En esta instalación los hermanos no entran por la web.</Typography>
          <Typography>Si eres de la Junta de Gobierno, entra por el <Link to="/cms/acceso">acceso del CMS</Link>.</Typography>
        </TarjetaCristal>
        </Box>
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
      <Box component="main" sx={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <Puerta
          foto={FOTO_DEL_ACCESO}
          encuadre="center 28%"
          velo={segundaPuerta ? VELO_IZQUIERDA : dosPuertas ? VELO_SOLA : VELO_MOVIL}
          sx={{
            // En el móvil, el hueco de arriba es el de la marca, que va encima.
            pt: { xs: '76px', md: '112px' },
            pb: { xs: 2, md: 6 },
            px: { xs: 2.5, sm: 5, md: 6, lg: 9 },
            ...(!segundaPuerta && dosPuertas && { alignItems: 'center' }),
            [MOVIL_ESTRECHO]: { px: 2 },
            [MOVIL_MINIMO]: { pt: '68px', pb: 1 },
          }}
        >
          <Box sx={{ maxWidth: 420, width: '100%' }}>
            {segundaPuerta && <Typography component="p" sx={ANTETITULO}>Ya soy hermano</Typography>}
            <Typography variant="h3" component="h1" sx={{ mb: 1, fontSize: { xs: '26px', md: '34px' }, [MOVIL_MINIMO]: { mb: 0.5 } }}>
              Acceso hermanos
            </Typography>
            <FormularioAccesoHermano alIzquierda alEntrar={alEntrar} subtitulo="Introduce tus credenciales para acceder a tu área privada." />
            {conAlta && !dosPuertas && (
              <Box sx={{ mt: 2.5, pt: 2.5, [MOVIL_MINIMO]: { mt: 1.5, pt: 1.5 }, borderTop: `1px solid ${alfa(MARCA.acentoApagado, 0.3)}` }}>{alta(true)}</Box>
            )}
          </Box>
        </Puerta>

        {segundaPuerta && (
          <Puerta
            foto={FOTO_DE_LA_PUERTA_DEL_ALTA}
            encuadre="62% center"
            velo={VELO_DERECHA}
            sx={{
              pt: '112px',
              pb: 6,
              px: { md: 6, lg: 9 },
              alignItems: 'flex-end',
              // El divisor: un filete blanco que nace bajo la marca y baja
              // hasta el borde, sin apagarse, para que se lea como un corte y
              // no como una raya suelta. Pasa por la parte oscura de los velos.
              '&::before': { content: '""', position: 'absolute', left: 0, top: 84, bottom: 0, width: '1px', backgroundColor: alfa(TINTA, 0.45), zIndex: 1 },
            }}
          >
            <Box sx={{ maxWidth: 400, width: '100%' }}>{alta(false)}</Box>
          </Puerta>
        )}
      </Box>
    </>
  )
}

/** El fondo de la web: sobre él se funden las fotos. */
const FONDO = '#121113'
/** La letra clara de la web, para el filete. */
const TINTA = '#f3efe9'

// Las fotos van a color y enteras; lo que las apaga es el velo, más denso
// donde va la letra (el borde de fuera) y también junto al divisor, para que
// el filete pase siempre por oscuro.
const VELO_IZQUIERDA = `linear-gradient(90deg, ${alfa(FONDO, 0.92)} 0%, ${alfa(FONDO, 0.74)} 55%, ${alfa(FONDO, 0.74)} 85%, ${alfa(FONDO, 0.9)} 100%)`
const VELO_DERECHA = `linear-gradient(270deg, ${alfa(FONDO, 0.9)} 0%, ${alfa(FONDO, 0.7)} 55%, ${alfa(FONDO, 0.7)} 85%, ${alfa(FONDO, 0.9)} 100%)`
/** Sin la puerta del alta, el formulario va en medio: el velo, parejo. */
const VELO_SOLA = alfa(FONDO, 0.82)
/** En el móvil, la foto se deja ver arriba y se cierra donde empiezan los campos. */
const VELO_MOVIL = `linear-gradient(to bottom, ${alfa(FONDO, 0.55)}, ${alfa(FONDO, 0.86)} 40%, ${alfa(FONDO, 0.95)})`

const ANTETITULO = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: MARCA.acento,
  mb: 1,
} as const

/**
 * Cada una de las dos puertas del acceso: media pantalla con su foto a todo
 * el alto y un velo encima. La foto es de la instalación
 * (`config/fotosDeLaInstalacion.ts`): donde no está, se quita y queda el
 * fondo liso.
 */
function Puerta({ foto, encuadre, velo, sx, children }: { foto: string; encuadre: string; velo: string; sx?: SxProps<Theme>; children: ReactNode }) {
  const { visible, alFallar } = useFotoQueFalla(foto)
  return (
    <Box
      sx={[
        { position: 'relative', flex: '1 1 0', minWidth: 0, overflow: 'hidden', backgroundColor: FONDO, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start' },
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
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: encuadre, pointerEvents: 'none' }}
        />
      )}
      <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, background: velo, pointerEvents: 'none' }} />
      <Box sx={{ position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'inherit' }}>{children}</Box>
    </Box>
  )
}
