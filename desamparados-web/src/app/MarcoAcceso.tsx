import { Outlet } from 'react-router-dom'
import { Box, Container } from '@mui/material'
import TransicionDePagina from '../components/TransicionDePagina'
import { MarcaEscritorio } from '../components/barra/MarcaDeLaBarra'

/**
 * `aPantalla`: la página ocupa toda la pantalla, sin el contenedor centrado ni
 * sus márgenes. Es el acceso de hermanos, con sus fotos de lado a lado; las
 * demás pantallas de este marco (nueva contraseña, primer acceso) siguen en
 * su caja.
 */
export default function MarcoAcceso({ aPantalla = false }: { aPantalla?: boolean }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        // En el móvil, 100vh es el alto sin las barras del navegador: con ellas a
        // la vista, la página se pasaba y pedía scroll aunque el contenido cupiera.
        '@supports (height: 100dvh)': { minHeight: '100dvh' },
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'background.default',
      }}
    >
      {/* La marca de la barra (escudo y rótulo), arriba en medio: es la misma
          firma que en el resto de la web, y al centro no compite con las dos
          puertas del acceso, que se reparten la pantalla a izquierda y derecha. */}
      {/* De lado a lado y centrada con flex, no con left 50 %: así la caja tiene
          todo el ancho y el rótulo no se encoge en el móvil. */}
      <Box sx={{ position: 'absolute', top: { xs: 16, md: 24 }, left: 16, right: 16, display: 'flex', justifyContent: 'center', zIndex: 10, pointerEvents: 'none', '& > *': { pointerEvents: 'auto' } }}>
        <MarcaEscritorio />
      </Box>

      {aPantalla ? (
        // La transición envuelve la página: se estira para que la página llegue al pie.
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', '& > *': { flex: 1, display: 'flex', flexDirection: 'column' } }}>
          <TransicionDePagina>
            <Outlet />
          </TransicionDePagina>
        </Box>
      ) : (
        // Las pantallas sueltas (nueva contraseña, primer acceso) fijan su ancho, estrecho.
        <Container
          maxWidth="lg"
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // En el móvil, lo justo para no pegarse al escudo, que va encima, y
            // casi nada abajo: el acceso tiene que caber sin hacer scroll.
            pt: { xs: 7, md: 8 },
            pb: { xs: 2, md: 8 },
          }}
        >
          <TransicionDePagina>
            <Outlet />
          </TransicionDePagina>
        </Container>
      )}
    </Box>
  )
}
