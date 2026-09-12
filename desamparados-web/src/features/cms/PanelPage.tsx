import { Alert, Box, CircularProgress } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useAuthStore } from '../members/auth/store'
import { usePanelDeHoy } from '../../app/usePanelDeHoy'
import { tareasDelDia, repartirTareas } from './inicio/tareas'
import Cabecera from './inicio/Cabecera'
import ParaHoy from './inicio/ParaHoy'
import Cifras from './inicio/Cifras'
import CuentaAtras from './inicio/CuentaAtras'
import ProximosActos from './inicio/ProximosActos'
import ActividadEquipo from './inicio/ActividadEquipo'
import ComoVaElAnio from './inicio/ComoVaElAnio'

/**
 * El Inicio del CMS. Arriba, lo de hoy: qué hay que hacer, las cuatro cifras,
 * los próximos actos y cuánto queda para la estación. Debajo, «Cómo va el año»,
 * que es lo único que cambia con el selector de ejercicio.
 */
export default function PanelPage() {
  const role = useAuthStore((state) => state.user?.role)
  const { data, isPending, isError } = usePanelDeHoy()

  if (isPending) {
    return <CircularProgress aria-label="Cargando el Inicio" />
  }

  if (isError || !data) {
    return <Alert severity="error">No se ha podido cargar el Inicio. Inténtalo de nuevo en unos minutos.</Alert>
  }

  const tareas = tareasDelDia(data)
  const { tuyas, deLaJunta } = repartirTareas(tareas, role)

  return (
    <>
      <Helmet><title>Inicio | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>

      <Cabecera asuntosPropios={tuyas.length} asuntosDeLaJunta={deLaJunta.length} role={role} />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 352px' }, gap: 3, alignItems: 'start' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <ParaHoy tareas={tareas} role={role} />
          <Cifras panel={data} />
          <ActividadEquipo registro={data.actividad.registro} role={role} />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <CuentaAtras />
          <ProximosActos eventos={data.actividad.proximosEventos} role={role} />
        </Box>
      </Box>

      <ComoVaElAnio panelDeHoy={data} />
    </>
  )
}
