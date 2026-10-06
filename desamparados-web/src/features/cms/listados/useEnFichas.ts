import { useMediaQuery, useTheme } from '@mui/material'

/**
 * Por debajo de este ancho las tablas del CMS pasan a fichas. Con su ancho
 * mínimo (640 a 980px) en un móvil no se veían las últimas columnas (Debe,
 * Haber, Estado…), sin nada que avisara de que la tabla seguía, y las del
 * medio partían cada palabra en una línea. Una tableta en vertical también.
 */
export function useEnFichas() {
  const tema = useTheme()
  return useMediaQuery(tema.breakpoints.down('md'), { noSsr: true })
}
