import { Box, Typography } from '@mui/material'
import { useTemaCms } from '../../../app/useTemaCms'
import { cuentaAtrasEstacion } from '../../../domain/sabadoDePasion'
import { designTokens } from '../../../theme'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const corta = (f: Date) => `${f.getDate()} ${MESES[f.getMonth()]} ${f.getFullYear()}`

/**
 * El bloque destacado del Inicio. Va siempre en el tono CONTRARIO al tema: papel
 * sobre el lienzo oscuro y tinta sobre el claro. Es lo que lo hace destacar en
 * los dos modos sin añadir ningún color nuevo.
 */
export default function CuentaAtras({ hoy = new Date() }: { hoy?: Date }) {
  const { superficies } = useTemaCms()
  const { fecha, anterior, dias, porcentaje } = cuentaAtrasEstacion(hoy)

  return (
    <Box
      component="section"
      aria-labelledby="cuenta-atras"
      sx={{ backgroundColor: superficies.inverso, color: superficies.inversoTexto, borderRadius: 1.75, p: 2.75 }}
    >
      <Typography
        id="cuenta-atras"
        sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: superficies.inversoTenue }}
      >
        Sábado de Pasión · {corta(fecha)}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, mt: 1, mb: 0.25 }}>
        <Typography component="span" sx={{ fontFamily: designTokens.fonts.cms.heading, fontSize: 68, lineHeight: 1 }}>
          {dias}
        </Typography>
        <Typography component="span" sx={{ fontFamily: designTokens.fonts.cms.heading, fontSize: 20, color: superficies.inversoTenue }}>
          {dias === 1 ? 'día' : 'días'}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: 14, color: superficies.inversoTenue }}>para la estación de penitencia</Typography>

      <Box
        role="progressbar"
        aria-label="Parte del curso recorrida"
        aria-valuenow={porcentaje}
        aria-valuemin={0}
        aria-valuemax={100}
        sx={{ mt: 2.25, height: 6, borderRadius: 3, backgroundColor: superficies.inversoPista, overflow: 'hidden' }}
      >
        <Box sx={{ width: `${porcentaje}%`, height: '100%', backgroundColor: designTokens.colors.secondary }} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, fontSize: 11, color: superficies.inversoTenue }}>
        <span>{corta(anterior)}</span>
        <span>{porcentaje} % del curso</span>
        <span>{corta(fecha)}</span>
      </Box>
    </Box>
  )
}
