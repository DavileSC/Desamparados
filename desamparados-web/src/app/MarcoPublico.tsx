import { useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { Box } from '@mui/material'
import BarraDeNavegacion from '../components/BarraDeNavegacion'
import PieDePagina from '../components/PieDePagina'
import AvisoDeCookies from '../components/AvisoDeCookies'
import TransicionDePagina from '../components/TransicionDePagina'
import { designTokens } from '../theme'
import { useFocoAlCambiarDePagina } from '../hooks/useFocoAlCambiarDePagina'

export default function MarcoPublico() {
  const principal = useRef<HTMLElement>(null)
  useFocoAlCambiarDePagina(principal)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Para quien navega con teclado: sin él, cada página obliga a tabular por
          todo el menú antes de llegar al contenido. Invisible hasta que se
          enfoca, que es el primer Tab de la página. Se enfoca a mano en vez de
          dejar el #ancla, que cambiaría la dirección y no movería el foco. */}
      <Box
        component="a"
        href="#contenido"
        onClick={(e: React.MouseEvent) => {
          e.preventDefault()
          principal.current?.focus()
        }}
        sx={{
          position: 'fixed', top: 8, left: 8, zIndex: (t) => t.zIndex.tooltip + 1,
          px: 2, py: 1.25, borderRadius: '6px',
          bgcolor: designTokens.colors.primary, color: 'text.primary',
          fontWeight: 600, textDecoration: 'none',
          outline: `2px solid ${designTokens.colors.tertiaryContainer}`, outlineOffset: 2,
          transform: 'translateY(-200%)',
          '&:focus': { transform: 'none' },
        }}
      >
        Saltar al contenido
      </Box>
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
    </Box>
  )
}
