import { Box, Grid } from '@mui/material'
import { TarjetaPublicacionEsqueleto } from '../TarjetaPublicacion'
import Hueso, { Lineas } from '../esqueleto/Hueso'
import { columnasDeFilas, filaSx, marcoCuadradoSx, principalAlto } from './archivoDeNoticiasEstilos'

/*
 * Los esqueletos de los listados largos, aparte de `BloqueListado`: la página
 * los enseña también mientras llega su documento (ver `BloquesEsqueleto`), y
 * `BloqueListado` se carga perezoso; importarlo desde allí lo metería en el
 * trozo de todas las páginas.
 */

/** El archivo de noticias mientras llega: la principal y tres filas de dos, con la forma de las de verdad. */
export function ArchivoDeNoticiasEsqueleto() {
  return (
    <Box>
      <Box sx={{ minHeight: principalAlto, display: 'grid', alignContent: 'end', p: { xs: 2.5, sm: 4, md: 7 }, backgroundColor: '#18161a' }}>
        <Box sx={{ display: 'grid', gap: 2, maxWidth: 860 }}>
          <Lineas anchos={['120px']} linea={16.5} grosor={9} />
          <Lineas anchos={['88%', '54%']} linea={{ xs: 32, sm: 45, md: 58 }} grosor={{ xs: 18, sm: 24, md: 30 }} />
          <Lineas anchos={['70%', '52%']} linea={{ xs: 24, md: 27 }} grosor={10} />
        </Box>
      </Box>
      <Box sx={columnasDeFilas}>
        {Array.from({ length: 6 }, (_, i) => (
          <Box key={i} sx={filaSx}>
            <Box sx={marcoCuadradoSx}><Hueso sx={{ position: 'absolute', inset: 0, borderRadius: 0 }} /></Box>
            <Box sx={{ display: 'grid', gap: 0.75 }}>
              <Lineas anchos={['32%']} linea={16.5} grosor={9} />
              <Lineas anchos={[`${88 - (i % 3) * 12}%`, '48%']} linea={{ xs: 21, md: 26 }} grosor={12} />
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}><Lineas anchos={['96%', '64%']} linea={21.7} grosor={8} /></Box>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

/**
 * Las publicaciones mientras llegan: dos filas, en el móvil, la tableta y el
 * escritorio. Con una sola, la página crecía de golpe al llegar la segunda.
 */
export function PublicacionesEsqueleto({ columnas = 4 }: { columnas?: number }) {
  return (
    <Grid container spacing={3}>
      {Array.from({ length: columnas * 2 }, (_, i) => (
        <Grid key={i} size={{ xs: 12, sm: 6, lg: 12 / columnas }} sx={{ display: { xs: i > 1 ? 'none' : 'block', sm: i > 3 ? 'none' : 'block', lg: 'block' } }}>
          <TarjetaPublicacionEsqueleto />
        </Grid>
      ))}
    </Grid>
  )
}
