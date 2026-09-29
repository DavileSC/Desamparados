import { Box, Typography } from '@mui/material'
import { cuentaAtrasEstacion } from '../../../domain/sabadoDePasion'
import { diaMes, type Acto } from './tandas'
import { contar } from './plural'
import { crecerX, entrada, sinMovimiento } from './animaciones'
import { FILETE, FILETE_SUAVE, FONDO_PIEZA, ORO_GRAFICA, SERIF, VERSALITAS } from './estiloRetablo'

/**
 * El curso, de un Sábado de Pasión al siguiente: cuánto se ha andado y lo que
 * viene después del próximo acto (ese va en grande a su lado). La lista llena
 * lo que queda de la pieza y lo que no cabe se desplaza dentro.
 */
export default function ElCurso({ actos, hoy = new Date() }: { actos: Acto[]; hoy?: Date }) {
  const { porcentaje } = cuentaAtrasEstacion(hoy)
  const porDelante = actos.filter((a) => !a.pasado)
  const despues = porDelante.slice(1)

  return (
    <Box
      component="section"
      aria-labelledby="el-curso"
      sx={{
        flex: '1 1 0 !important', minWidth: 0, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0.75,
        containerType: 'inline-size', containerName: 'curso',
        // En el móvil la pestaña se desplaza: el curso se da un alto propio.
        '@container columna (max-width: 559px)': { flex: '1 0 auto !important', minHeight: 300 },
        px: 'clamp(14px, 2vw, 22px)', py: 'clamp(10px, 1.8vh, 16px)',
        borderRadius: 2.5, border: `1px solid ${FILETE}`, backgroundColor: FONDO_PIEZA,
        '& > *': { flexShrink: 0 }, ...entrada(2),
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '2px 16px', flexWrap: 'wrap' }}>
        <Typography id="el-curso" component="h2" sx={{ ...SERIF, fontSize: 'clamp(20px, 2.6vh, 25px)', lineHeight: 1.1 }}>El curso</Typography>
        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
          {porcentaje} % recorrido · {porDelante.length ? `${contar(porDelante.length, 'acto', 'actos')} por delante` : 'sin actos por delante'}
        </Typography>
      </Box>
      <Box role="progressbar" aria-label="Curso recorrido" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100} sx={{ height: 3, borderRadius: 2, backgroundColor: FILETE, my: 0.5 }}>
        <Box sx={{ width: `${porcentaje}%`, height: '100%', borderRadius: 2, backgroundColor: ORO_GRAFICA, transformOrigin: 'left', animation: `${crecerX} 1.2s cubic-bezier(.3, .7, .2, 1) .3s backwards`, ...sinMovimiento }} />
      </Box>
      <Typography component="h3" sx={{ ...VERSALITAS, fontSize: 10.5 }}>Después</Typography>
      {despues.length === 0 ? (
        <Typography sx={{ fontSize: 14, color: 'text.secondary', pt: 0.5 }}>Nada más hasta la estación de penitencia.</Typography>
      ) : (
        <Box
          component="ul"
          sx={{
            flex: '1 1 0 !important', minHeight: 0, overflowY: 'auto', scrollbarWidth: 'thin', listStyle: 'none', m: 0, p: 0,
            display: 'grid', alignContent: 'start', columnGap: 3.5,
            // Con sitio, en dos columnas: se ven el doble de actos de un vistazo.
            '@container curso (min-width: 520px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
          }}
        >
          {despues.map((acto, i) => (
            <Box component="li" key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline', py: 'clamp(4px, .9vh, 8px)', borderTop: `1px solid ${FILETE_SUAVE}` }}>
              <Box component="span" sx={{ ...SERIF, width: 52, flexShrink: 0, fontSize: 18, color: 'text.secondary' }}>{diaMes(acto.fecha)}</Box>
              <Box component="span" title={acto.titulo} sx={{ fontSize: 14, minWidth: 0, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{acto.titulo}</Box>
              {acto.hora && <Box component="span" sx={{ fontSize: 12.5, color: 'text.secondary', flexShrink: 0 }}>{acto.hora}</Box>}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
