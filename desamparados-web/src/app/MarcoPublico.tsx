import { useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Box, Link as EnlaceMui } from '@mui/material'
import BarraDeNavegacion from '../components/BarraDeNavegacion'
import PieDePagina from '../components/PieDePagina'
import AvisoDeCookies from '../components/AvisoDeCookies'
import TransicionDePagina from '../components/TransicionDePagina'
import { designTokens } from '../theme'
import { useFocoAlCambiarDePagina } from '../hooks/useFocoAlCambiarDePagina'
import SaltarAlContenido from '../components/SaltarAlContenido'
import { useContarVisitas } from '../hooks/useContarVisitas'
import { useEstadoDeLaWeb } from '../hooks/useEstadoDeLaWeb'
import { useAuthStore } from '../features/altas/auth/store'
import ProximamentePage from '../features/proximamente/ProximamentePage'
import { rolesPorRutaCms } from './rolesCms'
import { siempreAbierta } from './siempreAbierta'

/**
 * Con la web cerrada (Sistema → Abrir la web), quien no tiene sesión del CMS
 * ve «Próximamente»; la Junta con sesión ve la web entera, con un aviso. Es lo
 * que se pinta, no un permiso: el contenido sigue saliendo por la API.
 */
export default function MarcoPublico() {
  const { pathname } = useLocation()
  const { estado, fallo } = useEstadoDeLaWeb()
  const sesion = useAuthStore((s) => s.status)
  const junta = useAuthStore((s) => s.cms)
  const cerrada = estado?.abierta === false && !estado.siempreAbiertaAqui && !siempreAbierta(pathname)

  // Hasta saber si está abierta (y, cerrada, si quien entra es de la Junta),
  // nada: un instante de la web de verdad ya la enseñaría. Si la API no
  // contesta, abierta, que es como estaría sin esto.
  if ((!estado && !fallo) || (cerrada && sesion === 'cargando')) {
    return <Box sx={{ minHeight: '100vh', bgcolor: designTokens.colors.primaryContainer }} />
  }
  if (cerrada && !junta) return <ProximamentePage estado={estado} />
  return <MarcoAbierto avisoDeCerrada={cerrada} puedeAbrirla={Boolean(junta && rolesPorRutaCms.web.includes(junta.role))} />
}

function MarcoAbierto({ avisoDeCerrada, puedeAbrirla }: { avisoDeCerrada: boolean; puedeAbrirla: boolean }) {
  const principal = useRef<HTMLElement>(null)
  useFocoAlCambiarDePagina(principal)
  useContarVisitas()

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Con los colores que ya tenía en la web pública. */}
      <SaltarAlContenido
        destino={principal}
        sx={{ bgcolor: designTokens.colors.primary, color: 'text.primary', outlineColor: designTokens.colors.tertiaryContainer }}
      />
      <BarraDeNavegacion />
      <Box
        component="main"
        id="contenido"
        ref={principal}
        tabIndex={-1}
        sx={{
          flex: 1,
          // El foco que llega por programa (al cambiar de página o desde
          // «Saltar al contenido») no es una acción del usuario sobre ese
          // elemento: un recuadro alrededor de toda la página o del título solo
          // confundiría.
          '&:focus, & h1[tabindex="-1"]:focus': { outline: 'none' },
        }}
      >
        <TransicionDePagina>
          <Outlet />
        </TransicionDePagina>
      </Box>
      <PieDePagina />
      <AvisoDeCookies />
      {avisoDeCerrada && <AvisoWebCerrada puedeAbrirla={puedeAbrirla} />}
    </Box>
  )
}

/**
 * Abajo a la izquierda y pequeño: arriba lo taparía la barra, que en el
 * portátil va fija sobre la foto, y la Junta tiene que poder ver la web tal
 * como se verá. Con un cargo que no la abre, solo el aviso.
 */
function AvisoWebCerrada({ puedeAbrirla }: { puedeAbrirla: boolean }) {
  return (
    <Box
      role="status"
      sx={{
        position: 'fixed',
        left: 'max(12px, env(safe-area-inset-left, 0px))',
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        zIndex: (t) => t.zIndex.appBar + 1,
        maxWidth: 'calc(100vw - 24px)',
        px: 1.75,
        py: 1,
        borderRadius: 1,
        bgcolor: designTokens.colors.footer,
        border: `1px solid ${designTokens.colors.tertiaryContainer}`,
        color: 'text.primary',
        fontSize: 14,
        boxShadow: '0 6px 24px rgba(0, 0, 0, 0.45)',
      }}
    >
      La web está cerrada: el público ve «Próximamente».
      {puedeAbrirla && <>{' '}<EnlaceMui component={Link} to="/cms/web" sx={{ color: designTokens.colors.tertiaryFixedDim, fontWeight: 600 }}>Abrirla</EnlaceMui></>}
    </Box>
  )
}
