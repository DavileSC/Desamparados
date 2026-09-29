import { useState } from 'react'
import { Box } from '@mui/material'
import type { PanelResponse } from '../../../lib/api/panel'
import Asuntos from './Asuntos'
import ProximoActo from './ProximoActo'
import ElCurso from './ElCurso'
import { actosDelCurso } from './tandas'
import type { Tarea } from './tareas'

/**
 * La pestaña «Hoy»: arriba los asuntos que esperan; debajo, el próximo acto en
 * grande y, a su lado, el curso con lo que viene después. Con los asuntos
 * abiertos («Ver los N»), la lista se queda con todo el hueco y el curso
 * vuelve con «Ver menos».
 */
export default function Hoy({ tareas, role, eventos, hoy = new Date() }: {
  tareas: Tarea[]; role?: string; eventos: PanelResponse['curso']['eventos']; hoy?: Date
}) {
  const [todos, setTodos] = useState(false)
  const actos = actosDelCurso(hoy, eventos)
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
      <Asuntos tareas={tareas} role={role} todos={todos} onTodos={setTodos} />
      {!todos && (
        <Box
          sx={{
            flex: '1 1 0', minHeight: 0, display: 'grid', gap: 'clamp(8px, 1.6vh, 14px)',
            // En estrecho, una encima de otra: el curso se queda con lo que sobre.
            gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: 'auto minmax(260px, 1fr)',
            '@container columna (min-width: 560px)': { gridTemplateColumns: 'minmax(210px, 250px) minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr)' },
            // En el móvil la pestaña se desplaza: aquí cada pieza mide lo suyo.
            '@container columna (max-width: 559px)': { flex: '1 0 auto' },
          }}
        >
          <ProximoActo acto={proximo} hoy={hoy} />
          <ElCurso actos={actos} hoy={hoy} />
        </Box>
      )}
    </Box>
  )
}
