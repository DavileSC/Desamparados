import { Alert, Box, CircularProgress } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useAuthStore } from '../altas/auth/store'
import { usePanelDeHoy } from '../../app/usePanelDeHoy'
import { tareasDelDia, repartirTareas } from './inicio/tareas'
import Cabecera from './inicio/Cabecera'
import CaminoEstacion from './inicio/CaminoEstacion'
import Cifras from './inicio/Cifras'
import ParaHoy from './inicio/ParaHoy'
import CalendarioMes from './inicio/CalendarioMes'
import Cortejo from './inicio/Cortejo'
import ProximosActos from './inicio/ProximosActos'
import ComoVaElAnio from './inicio/ComoVaElAnio'
import FondoVivo from './inicio/FondoVivo'

/**
 * El Inicio del CMS. Arriba, el camino a la estación y las cuatro cifras;
 * debajo, lo de hoy (qué hay que hacer, el mes, el cortejo y los próximos
 * actos). Al final, «Cómo va el año», que es lo único que cambia con el
 * selector de ejercicio.
 *
 * Rejilla con zonas con nombre y una disposición por ancho: cada pieza tiene
 * su sitio fijo y las de una misma fila se estiran a la misma altura. Antes
 * iban en columnas de periódico, y según lo que trajera el día una tarjeta
 * saltaba de columna o dejaba un hueco al lado.
 *
 * El ancho que manda es el del panel, no el de la ventana (consultas de
 * contenedor): con el menú abierto el panel tiene 250 px menos, y con los
 * cortes de la ventana las piezas se partían en columnas donde no cabían.
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
  const zona = (nombre: string) => ({ gridArea: nombre, minWidth: 0 })

  return (
    // Contexto propio: el fondo animado va detrás de las tarjetas pero
    // delante del lienzo del CMS.
    <Box sx={{ position: 'relative', isolation: 'isolate' }}>
      <FondoVivo />
      <Helmet><title>Inicio | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>

      <Cabecera asuntosPropios={tuyas.length} asuntosDeLaJunta={deLaJunta.length} role={role} />

      <Box sx={{ containerType: 'inline-size', containerName: 'panel' }}>
        <Box
          sx={{
            display: 'grid',
            gap: 2.5,
            alignItems: 'stretch',
            gridTemplateColumns: 'minmax(0, 1fr)',
            gridTemplateAreas: '"camino" "cifras" "hoy" "calendario" "actos" "cortejo"',
            '@container panel (min-width: 720px)': {
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gridTemplateAreas: '"camino camino" "cifras cifras" "hoy hoy" "calendario actos" "cortejo cortejo"',
            },
            '@container panel (min-width: 1080px)': {
              gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)',
              gridTemplateAreas: '"camino camino" "cifras cifras" "hoy calendario" "cortejo actos"',
            },
          }}
        >
          <Box sx={zona('camino')}><CaminoEstacion eventos={data.curso.eventos} /></Box>
          <Box sx={zona('cifras')}><Cifras panel={data} /></Box>
          <Box sx={zona('hoy')}><ParaHoy tareas={tareas} role={role} orden={6} /></Box>
          <Box sx={zona('calendario')}><CalendarioMes calendario={data.calendario} role={role} orden={7} /></Box>
          <Box sx={zona('cortejo')}><Cortejo procesion={data.procesion} orden={8} /></Box>
          <Box sx={zona('actos')}><ProximosActos eventos={data.actividad.proximosEventos} actividad={data.actividad} role={role} orden={9} /></Box>
        </Box>
      </Box>

      <ComoVaElAnio panelDeHoy={data} />
    </Box>
  )
}
