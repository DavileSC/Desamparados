import { Box, Typography } from '@mui/material'
import { cuentaAtrasEstacion } from '../../../domain/sabadoDePasion'
import { CORMORANT } from '../../actualidad/agenda/letraAlmanaque'
import { acercar, sinMovimiento, useCuenta } from './animaciones'
import { ORO_CLARO } from './estiloRetablo'
import { site } from '../../../config/site'
import { useModulos } from '../../../hooks/useModulos'
import { conArticulo } from '../../../domain/articulos'
import type { CuentaDeHoy } from '../../../lib/api/panel'

const FECHA_LARGA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
const FECHA_CORTA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })

/**
 * La columna del retablo: la imagen de Nuestra Señora de los Desamparados,
 * con los días que faltan al pie: para la próxima salida, una salida o un
 * acto de la Agenda, según «Ajustes del Inicio».
 * Siempre oscura, en los dos temas: la foto lo es.
 *
 * En un panel ancho va a la izquierda y se queda quieta mientras baja el
 * resto; en uno estrecho es una franja arriba.
 */
interface Rotulo {
  titulo: string
  fecha: Date
  /** Null: se dice la fecha, pero no los días (Procesión apagada en la cuenta de antes). */
  dias: number | null
  /** La línea bajo los días; null en un acto, que ya se nombra arriba. */
  para: string | null
}

const DIA_EN_MS = 24 * 60 * 60 * 1000
/** La fecha sin hora, para restar días sin que el cambio de hora estorbe. */
const soloDia = (f: Date) => Date.UTC(f.getFullYear(), f.getMonth(), f.getDate())

/** Lo que manda el servidor: la próxima salida, una salida elegida o un acto de la Agenda. */
function rotuloDe(c: CuentaDeHoy, hoy: Date): Rotulo {
  const fecha = new Date(Number(c.fecha.slice(0, 4)), Number(c.fecha.slice(5, 7)) - 1, Number(c.fecha.slice(8, 10)))
  return {
    titulo: c.nombre,
    fecha,
    dias: Math.round((soloDia(fecha) - soloDia(hoy)) / DIA_EN_MS),
    para: c.articulo ? `para ${conArticulo(c.articulo, c.nombre)}` : null,
  }
}

/** La de antes de poder elegirla: hasta el Sábado de Pasión, calculado aquí. */
function rotuloDeLaEstacion(hoy: Date, conProcesion: boolean): Rotulo {
  const { fecha, dias } = cuentaAtrasEstacion(hoy)
  return { titulo: 'Sábado de Pasión', fecha, dias: conProcesion ? dias : null, para: 'para la estación de penitencia' }
}

/** La foto de siempre (la del hero de la web) y su encuadre: el rostro de la Virgen. */
export const FOTO_POR_DEFECTO = '/images/hero-960.webp'

export default function Retablo({ hoy = new Date(), foto = FOTO_POR_DEFECTO, x = 50, y = 30, cuenta }: {
  hoy?: Date
  /** La que toca hoy según «Ajustes del Inicio» (la de todo el año o la de su tiempo). */
  foto?: string
  /** El punto de la foto que nunca se recorta, en %. */
  x?: number
  y?: number
  /**
   * Hasta qué cuenta, ya resuelto por el servidor; null, sin cuenta atrás.
   * Sin ella (un backend anterior), la de siempre: el Sábado de Pasión.
   */
  cuenta?: CuentaDeHoy | null
}) {
  // La cuenta atrás de antes es un dato de la procesión, aunque salga de la Pascua: sin su módulo no se enseña.
  const conProcesion = useModulos().activo('procesion')
  const rotulo = cuenta === undefined ? rotuloDeLaEstacion(hoy, conProcesion) : cuenta && rotuloDe(cuenta, hoy)
  const diasContados = Math.round(useCuenta(rotulo?.dias ?? 0, 1600))

  return (
    <Box
      component="section"
      // Sin cuenta atrás no hay rótulo: la sección se nombra por la imagen.
      {...(rotulo ? { 'aria-labelledby': 'retablo-estacion' } : { 'aria-label': site.titular })}
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
        src={foto}
        alt={site.titular}
        sx={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${x}% ${y}%`, transformOrigin: `${x}% ${y}%`, opacity: 0.85,
          animation: `${acercar} 22s ease-out both`, ...sinMovimiento,
        }}
      />
      <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(18,16,19,0) 40%, rgba(18,16,19,.92) 78%, #121013 100%)' }} />
      {rotulo && <Box className="rotulo" sx={{ position: 'relative', px: { xs: 2.5, md: 5.5 }, pb: 'clamp(16px, 6cqh, 48px)', pt: 3, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography id="retablo-estacion" sx={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: ORO_CLARO }}>
          {rotulo.titulo}<Box component="span" className="fecha-corta" sx={{ display: 'none' }}> · {FECHA_CORTA.format(rotulo.fecha).replace('.', '')}</Box>
        </Typography>
        <Typography className="fecha-larga" sx={{ fontFamily: CORMORANT, fontStyle: 'italic', fontSize: 22, color: '#d8cfc6' }}>
          {FECHA_LARGA.format(rotulo.fecha)}
        </Typography>
        {rotulo.dias !== null && <Box className="cuenta" sx={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 1.5, mt: 1.5 }}>
          <Typography component="span" className="dias" sx={{ fontFamily: CORMORANT, fontWeight: 500, fontSize: 'min(136px, 16cqh, 36cqw)', lineHeight: 0.85, fontVariantNumeric: 'lining-nums' }}>
            {diasContados}
          </Typography>
          <Typography component="span" sx={{ fontFamily: CORMORANT, fontStyle: 'italic', fontSize: 30, color: '#d8cfc6' }}>
            {rotulo.dias === 1 ? 'día' : 'días'}
          </Typography>
          {rotulo.para && <Typography component="span" className="para" sx={{ fontSize: 14, color: '#c9bfb6', flexBasis: '100%' }}>{rotulo.para}</Typography>}
        </Box>}
      </Box>}
    </Box>
  )
}
