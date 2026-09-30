import { useState } from 'react'
import { Box, useMediaQuery } from '@mui/material'
import type { PanelResponse } from '../../../lib/api/panel'
import Asuntos from './Asuntos'
import NuevoAviso from './NuevoAviso'
import ProximoActo from './ProximoActo'
import ElAnio from './ElAnio'
import { actosDelAnio } from './tandas'
import type { Tarea } from './tareas'

/**
 * La pestaña «Hoy»: arriba los asuntos que esperan; debajo, el próximo acto en
 * una franja a lo ancho y, al pie, el año con lo que viene después, que se
 * queda con el alto que sobra. Con los asuntos
 * abiertos («Ver los N»), la lista se queda con todo el hueco y el año
 * vuelve con «Ver menos».
 *
 * En pantallas bajas (un portátil con el escalado de Windows) caben tres filas
 * de asuntos y no cuatro: con cuatro, el año se quedaba sin sitio.
 */
export default function Hoy({ tareas, role, userId, eventos, hoy = new Date() }: {
  tareas: Tarea[]; role?: string; userId?: number; eventos: PanelResponse['anio']['eventos']; hoy?: Date
}) {
  const [todos, setTodos] = useState(false)
  const [avisoNuevo, setAvisoNuevo] = useState(false)
  const alta = useMediaQuery('(min-height: 700px)')
  const actos = actosDelAnio(hoy, eventos)
  const proximo = actos.find((a) => !a.pasado)

  return (
    <Box
      sx={{
        flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'clamp(8px, 1.6vh, 14px)',
        '& > section': { flexShrink: 0 },
        // En el móvil la pestaña se desplaza: mide lo que lleva.
        '@container columna (max-width: 559px)': { flex: '1 0 auto' },
      }}
    >
      <Asuntos tareas={tareas} role={role} userId={userId} todos={todos} onTodos={setTodos} filas={alta ? 4 : 3} onNuevoAviso={() => setAvisoNuevo(true)} />
      <NuevoAviso abierto={avisoNuevo} onCerrar={() => setAvisoNuevo(false)} />
      {!todos && (
        <>
          <ProximoActo acto={proximo} hoy={hoy} />
          <ElAnio actos={actos} hoy={hoy} />
        </>
      )}
    </Box>
  )
}
