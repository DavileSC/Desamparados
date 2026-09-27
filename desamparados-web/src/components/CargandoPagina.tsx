import { Box, CircularProgress, GlobalStyles } from '@mui/material'
import { keyframes } from '@mui/material/styles'

const aparece = keyframes`from { opacity: 0 } to { opacity: 1 }`

/**
 * Lo que se ve mientras llega el código de una página (cada una se descarga
 * aparte la primera vez).
 *
 * Ocupa la pantalla entera bajo la barra: con media pantalla, al recargar el
 * pie subía hasta arriba y luego la página lo empujaba hacia abajo, un salto
 * de todo que se veía a menudo. Y el círculo solo sale si la espera se alarga:
 * casi siempre el código llega antes y no hay nada que enseñar.
 *
 * Mientras está, el pie de la web pública no se pinta. Con él, la página medía
 * pantalla y media sin nada que leer y, al recargar, el navegador (o el router)
 * la bajaba al intentar devolverla a donde estaba: se quedaba a la vista el pie
 * solo hasta que llegaba la página y todo volvía arriba de golpe. Sin pie, mide
 * justo una pantalla y no hay nada que desplazar.
 */
export default function CargandoPagina() {
  return (
    <>
      <GlobalStyles styles={{ '[data-pie-publico]': { display: 'none' } }} />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: { xs: 'calc(100svh - 64px)', md: '100svh' },
        }}
      >
        <CircularProgress
          color="primary"
          aria-label="Cargando la página"
          sx={{ opacity: 0, animation: `${aparece} .3s ease-out .4s forwards` }}
        />
      </Box>
    </>
  )
}
