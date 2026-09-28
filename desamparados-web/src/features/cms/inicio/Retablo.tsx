import { Box, Typography } from '@mui/material'
import { cuentaAtrasEstacion } from '../../../domain/sabadoDePasion'
import { CORMORANT } from '../../actualidad/agenda/letraAlmanaque'
import { acercar, sinMovimiento, useCuenta } from './animaciones'
import { ORO_CLARO } from './estiloRetablo'

const FECHA_LARGA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

/**
 * La columna del retablo: la imagen de Nuestra Señora de los Desamparados a
 * todo lo alto, con los días que faltan para la estación de penitencia al pie.
 * Siempre oscura, en los dos temas: la foto lo es.
 *
 * En un panel ancho va a la izquierda y se queda quieta mientras baja el
 * resto; en uno estrecho es una franja arriba.
 */
export default function Retablo({ hoy = new Date() }: { hoy?: Date }) {
  const { fecha, dias } = cuentaAtrasEstacion(hoy)
  const diasContados = Math.round(useCuenta(dias, 1600))

  return (
    <Box
      component="section"
      aria-labelledby="retablo-estacion"
      sx={{
        position: 'relative', overflow: 'hidden', backgroundColor: '#0b0a0c', color: '#f7f1e8',
        minHeight: 300, height: '100%', display: 'flex', alignItems: 'flex-end',
      }}
    >
      <Box
        component="img"
        src="/images/hero-960.webp"
        alt="Nuestra Señora de los Desamparados"
        sx={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 30%', opacity: 0.85,
          animation: `${acercar} 22s ease-out both`, ...sinMovimiento,
        }}
      />
      <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(18,16,19,0) 40%, rgba(18,16,19,.92) 78%, #121013 100%)' }} />
      <Box sx={{ position: 'relative', px: { xs: 3, md: 5.5 }, pb: { xs: 3, md: 6 }, pt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography id="retablo-estacion" sx={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: ORO_CLARO }}>
          Sábado de Pasión
        </Typography>
        <Typography sx={{ fontFamily: CORMORANT, fontStyle: 'italic', fontSize: 22, color: '#d8cfc6' }}>
          {FECHA_LARGA.format(fecha)}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, mt: 1.5 }}>
          <Typography component="span" sx={{ fontFamily: CORMORANT, fontWeight: 500, fontSize: { xs: 96, md: 136 }, lineHeight: 0.85, fontVariantNumeric: 'lining-nums' }}>
            {diasContados}
          </Typography>
          <Typography component="span" sx={{ fontFamily: CORMORANT, fontStyle: 'italic', fontSize: 30, color: '#d8cfc6' }}>
            {dias === 1 ? 'día' : 'días'}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 14, color: '#c9bfb6' }}>para la estación de penitencia</Typography>
      </Box>
    </Box>
  )
}
