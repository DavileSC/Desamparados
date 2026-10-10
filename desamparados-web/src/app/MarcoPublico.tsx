import { useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { Box } from '@mui/material'
import BarraDeNavegacion from '../components/BarraDeNavegacion'
import PieDePagina from '../components/PieDePagina'
import AvisoDeCookies from '../components/AvisoDeCookies'
import TransicionDePagina from '../components/TransicionDePagina'
import { designTokens } from '../theme'
import { useFocoAlCambiarDePagina } from '../hooks/useFocoAlCambiarDePagina'
import SaltarAlContenido from '../components/SaltarAlContenido'

export default function MarcoPublico() {
  const principal = useRef<HTMLElement>(null)
  useFocoAlCambiarDePagina(principal)

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
    </Box>
  )
}
