import { Alert, Box, CircularProgress, useMediaQuery } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useAuthStore } from '../altas/auth/store'
import { usePanelDeHoy } from '../../app/usePanelDeHoy'
import { tareasDelDia } from './inicio/tareas'
import Retablo from './inicio/Retablo'
import Cabecera from './inicio/Cabecera'
import Asuntos from './inicio/Asuntos'
import ElCurso from './inicio/ElCurso'
import Cifras from './inicio/Cifras'
import { useAltoDisponible } from './inicio/useAltoDisponible'

/**
 * El Inicio del CMS, en forma de retablo: a la izquierda, la Virgen con los
 * días que faltan para la estación; a la derecha, el saludo, los asuntos que
 * esperan y el curso; y abajo, a todo lo ancho, las cuatro cifras de la casa.
 *
 * Cabe siempre en la pantalla, sin scroll: mide lo que queda de ventana y el
 * curso se queda con el hueco que sobra (si sus actos no caben, se desplazan
 * dentro). Las cifras tienen siempre el mismo alto; con poca altura se ven
 * menos asuntos a la vez.
 *
 * El detalle de cada área (el censo, el dinero, la procesión por años) no va
 * aquí: está en «Datos e informes», de la junta.
 */
export default function PanelPage() {
  const role = useAuthStore((state) => state.cms?.role)
  const { data, isPending, isError } = usePanelDeHoy()
  const { referencia, alto } = useAltoDisponible()
  const holgado = useMediaQuery('(min-height: 900px)')
  const justo = useMediaQuery('(max-height: 720px)')

  if (isPending) {
    return <CircularProgress aria-label="Cargando el Inicio" />
  }

  if (isError || !data) {
    return <Alert severity="error">No se ha podido cargar el Inicio. Inténtalo de nuevo en unos minutos.</Alert>
  }

  return (
    <Box
      ref={referencia}
      sx={{
        // A sangre: el retablo llega a los bordes del panel, sin el margen del marco.
        m: { xs: -2.5, md: -4 },
        height: alto ?? '100dvh', overflow: 'hidden',
        containerType: 'inline-size', containerName: 'inicio',
      }}
    >
      <Helmet><title>Inicio | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      <Box
        sx={{
          height: '100%', display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: 'clamp(96px, 15vh, 170px) minmax(0, 1fr) auto',
          // En ancho, la Virgen se queda arriba y las cifras cruzan todo el
          // retablo por abajo, siempre al mismo alto: así las gráficas no
          // cambian de tamaño con la pantalla.
          '@container inicio (min-width: 720px)': {
            gridTemplateColumns: 'clamp(220px, 28%, 400px) minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr) auto',
            '& > .cifras': { gridColumn: '1 / -1' },
          },
        }}
      >
        <Retablo />
        <Box
          sx={{
            minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', containerType: 'inline-size', containerName: 'columna',
            px: { xs: 2, sm: 3, md: 4, lg: 8 }, pt: 'clamp(12px, min(3vh, 3vw), 32px)', pb: 'clamp(8px, 1.6vh, 16px)', gap: 'clamp(8px, 1.8vh, 18px)',
            '& > *': { flexShrink: 0 },
          }}
        >
          <Cabecera role={role} actividad={data.actividad} />
          <Asuntos tareas={tareasDelDia(data)} role={role} aLaVista={holgado ? 4 : justo ? 2 : 3} />
          <Box sx={{ flex: '1 1 0 !important', minHeight: 110, display: 'flex', flexDirection: 'column' }}>
            <ElCurso eventos={data.curso.eventos} />
          </Box>
        </Box>
        <Box
          className="cifras"
          sx={{
            minWidth: 0, containerType: 'inline-size', containerName: 'cifras',
            px: { xs: 2, sm: 3, md: 4 }, pb: 'clamp(10px, 2vh, 24px)', pt: { xs: 0, md: 'clamp(8px, 1.6vh, 16px)' },
          }}
        >
          <Cifras panel={data} />
        </Box>
      </Box>
    </Box>
  )
}
