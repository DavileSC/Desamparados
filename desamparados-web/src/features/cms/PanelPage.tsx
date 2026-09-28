import { Alert, Box, CircularProgress } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useAuthStore } from '../altas/auth/store'
import { usePanelDeHoy } from '../../app/usePanelDeHoy'
import { tareasDelDia } from './inicio/tareas'
import Retablo from './inicio/Retablo'
import Cabecera from './inicio/Cabecera'
import Asuntos from './inicio/Asuntos'
import ElCurso from './inicio/ElCurso'
import Cifras from './inicio/Cifras'

/**
 * El Inicio del CMS, en forma de retablo: a la izquierda, la Virgen a todo lo
 * alto con los días que faltan para la estación; a la derecha, el saludo, los
 * asuntos que esperan, el curso y las cuatro cifras de la casa.
 *
 * El detalle de cada área (el censo, el dinero, la procesión por años) no va
 * aquí: está en «Datos e informes», de la junta.
 *
 * El ancho que manda es el del panel, no el de la ventana (consultas de
 * contenedor): con el menú abierto el panel tiene 250 px menos.
 */
export default function PanelPage() {
  const role = useAuthStore((state) => state.cms?.role)
  const { data, isPending, isError } = usePanelDeHoy()

  if (isPending) {
    return <CircularProgress aria-label="Cargando el Inicio" />
  }

  if (isError || !data) {
    return <Alert severity="error">No se ha podido cargar el Inicio. Inténtalo de nuevo en unos minutos.</Alert>
  }

  return (
    <Box
      sx={{
        // A sangre: el retablo llega a los bordes del panel, sin el margen del marco.
        m: { xs: -2.5, md: -4 },
        containerType: 'inline-size', containerName: 'inicio',
      }}
    >
      <Helmet><title>Inicio | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      <Box
        sx={{
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)',
          '@container inicio (min-width: 1000px)': {
            gridTemplateColumns: 'clamp(300px, 28%, 400px) minmax(0, 1fr)',
            // La Virgen se queda quieta mientras baja el resto.
            '& > .retablo': { position: 'sticky', top: 0, height: '100vh', alignSelf: 'start' },
          },
        }}
      >
        <Box className="retablo"><Retablo /></Box>
        <Box sx={{ px: { xs: 2.5, md: 4, lg: 8 }, py: { xs: 3, md: 6.5 }, display: 'flex', flexDirection: 'column', gap: 3.75, minWidth: 0, containerType: 'inline-size' }}>
          <Cabecera role={role} actividad={data.actividad} />
          <Asuntos tareas={tareasDelDia(data)} role={role} />
          <ElCurso eventos={data.curso.eventos} />
          <Cifras panel={data} />
        </Box>
      </Box>
    </Box>
  )
}
