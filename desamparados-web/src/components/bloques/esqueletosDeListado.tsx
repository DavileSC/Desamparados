import { Box, Grid } from '@mui/material'
import { TarjetaNoticiaEsqueleto } from '../TarjetaNoticia'
import { TarjetaPublicacionEsqueleto } from '../TarjetaPublicacion'

/*
 * Los esqueletos de los listados largos, aparte de `BloqueListado`: la página
 * los enseña también mientras llega su documento (ver `BloquesEsqueleto`), y
 * `BloqueListado` se carga perezoso; importarlo desde allí lo metería en el
 * trozo de todas las páginas.
 */

export const rejillaDeNoticias = (columnas = 3) => ({
  listStyle: 'none', m: 0, p: 0, display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: `repeat(${columnas}, 1fr)` },
  gap: { xs: 3, md: 3.25 },
}) as const

/** El archivo de noticias mientras llega: la destacada a lo ancho y una fila debajo. */
export function ArchivoDeNoticiasEsqueleto({ columnas = 3 }: { columnas?: number }) {
  return (
    <Box sx={rejillaDeNoticias(columnas)}>
      <Box sx={{ display: 'flex', gridColumn: '1 / -1' }}><TarjetaNoticiaEsqueleto destacada /></Box>
      {Array.from({ length: columnas }, (_, i) => <Box key={i} sx={{ display: 'flex' }}><TarjetaNoticiaEsqueleto /></Box>)}
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
