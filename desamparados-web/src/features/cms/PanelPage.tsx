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
import ComoVaElAnio from './inicio/ComoVaElAnio'

/**
 * El Inicio del CMS. Arriba, lo de hoy: las cuatro cifras, qué hay que hacer,
 * los próximos actos y cuánto queda para la estación. Debajo, «Cómo va el año»,
 * que es lo único que cambia con el selector de ejercicio.
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

  const tareas = tareasDelDia(data)
  const { tuyas, deLaJunta } = repartirTareas(tareas, role)

  return (
    <>
      <Helmet><title>Inicio | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>

      <Cabecera asuntosPropios={tuyas.length} asuntosDeLaJunta={deLaJunta.length} role={role} />

      {/* Las cifras, a todo lo ancho y antes que nada: son el resumen de la
          casa. «Para hoy» va debajo, que es donde se actúa. */}
      <Cifras panel={data} />

      {/* Mosaico: las tres piezas se reparten solas entre las columnas según lo
          que ocupa cada una. Con dos asuntos pendientes, «Para hoy» encogía y
          dejaba media pantalla en blanco al lado de una agenda larga; ahora el
          navegador equilibra las columnas y no queda hueco, tenga el día lo que
          tenga. `breakInside` impide que una tarjeta se parta entre columnas. */}
      <Box
        sx={{
          mt: 2.5,
          columnCount: { xs: 1, lg: 2 },
          columnGap: 3,
          '& > *': { breakInside: 'avoid', mb: 2.5 },
        }}
      >
        <ParaHoy tareas={tareas} role={role} />
        <CuentaAtras />
        <ProximosActos eventos={data.actividad.proximosEventos} actividad={data.actividad} role={role} />
      </Box>

      <ComoVaElAnio panelDeHoy={data} />
    </>
  )
}
