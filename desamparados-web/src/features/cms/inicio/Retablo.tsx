import { Box, Typography } from '@mui/material'
import { cuentaAtrasEstacion } from '../../../domain/sabadoDePasion'
import { CORMORANT } from '../../actualidad/agenda/letraAlmanaque'
import { acercar, sinMovimiento, useCuenta } from './animaciones'
import { ORO_CLARO } from './estiloRetablo'

const FECHA_LARGA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
const FECHA_CORTA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

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
        height: '100%', minHeight: 0, display: 'flex', alignItems: 'flex-end',
        containerType: 'size', containerName: 'retablo',
        // Franja baja (móvil): la fecha en corto y los días en una línea con su frase.
        '@container retablo (max-height: 260px)': {
          '& .fecha-larga': { display: 'none' },
          '& .fecha-corta': { display: 'inline' },
          '& #retablo-estacion': { fontSize: 11, letterSpacing: '0.16em' },
          '& .para': { flexBasis: 'auto' },
          '& .cuenta': { mt: 0 },
          '& .dias': { fontSize: 'min(64px, 42cqh)' },
          '& .rotulo': { gap: 0.5, pb: 1.5, pt: 1.5 },
        },
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
      <Box className="rotulo" sx={{ position: 'relative', px: { xs: 2.5, md: 5.5 }, pb: 'clamp(16px, 6cqh, 48px)', pt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography id="retablo-estacion" sx={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: ORO_CLARO }}>
          Sábado de Pasión<Box component="span" className="fecha-corta" sx={{ display: 'none' }}> · {FECHA_CORTA.format(fecha).replace('.', '')}</Box>
        </Typography>
        <Typography className="fecha-larga" sx={{ fontFamily: CORMORANT, fontStyle: 'italic', fontSize: 22, color: '#d8cfc6' }}>
          {FECHA_LARGA.format(fecha)}
        </Typography>
        <Box className="cuenta" sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1.5, mt: 1.5 }}>
          <Typography component="span" className="dias" sx={{ fontFamily: CORMORANT, fontWeight: 500, fontSize: 'min(136px, 16cqh, 36cqw)', lineHeight: 0.85, fontVariantNumeric: 'lining-nums' }}>
            {diasContados}
          </Typography>
          <Typography component="span" sx={{ fontFamily: CORMORANT, fontStyle: 'italic', fontSize: 30, color: '#d8cfc6' }}>
            {dias === 1 ? 'día' : 'días'}
          </Typography>
          <Typography component="span" className="para" sx={{ fontSize: 14, color: '#c9bfb6', flexBasis: '100%' }}>para la estación de penitencia</Typography>
        </Box>
      </Box>
    </Box>
  )
}
