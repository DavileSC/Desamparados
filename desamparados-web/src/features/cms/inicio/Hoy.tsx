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
 * una franja a lo ancho y, al pie, el curso con lo que viene después, que se
 * queda con el alto que sobra. Con los asuntos
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
        <>
          <ProximoActo acto={proximo} hoy={hoy} />
          <ElCurso actos={actos} hoy={hoy} />
        </>
      )}
    </Box>
  )
}
