import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { repartirTareas, type Prioridad, type Tarea } from './tareas'
import { contar } from './plural'
import { latido } from './animaciones'
import { FILETE, FILETE_SUAVE, ORO, ROSA_URGENTE } from './estiloRetablo'

/** Cuántos asuntos se ven de entrada si no se dice otra cosa; el resto, con «Ver los N». */
export const A_LA_VISTA = 4
const PY = 'clamp(6px, 1.4vh, 12px)'

const COLOR: Record<Prioridad, string> = {
  urgente: ROSA_URGENTE,
  pendiente: ORO,
  programado: 'text.secondary',
}

function Fila({ tarea, conBoton }: { tarea: Tarea; conBoton: boolean }) {
  const color = COLOR[tarea.prioridad]
  return (
    <Box
      component="li"
      sx={{
        display: 'grid', alignItems: 'center', gap: '2px 16px', px: 2.5, py: PY, borderTop: `1px solid ${FILETE_SUAVE}`,
        gridTemplateColumns: 'minmax(0, 1fr) auto', gridTemplateAreas: '"estado accion" "texto texto"',
        '@container asuntos (min-width: 560px)': { gridTemplateColumns: '110px minmax(0, 1fr) auto', gridTemplateAreas: '"estado texto accion"' },
      }}
    >
      <Box
        component="span"
        sx={{ gridArea: 'estado', display: 'flex', alignItems: 'center', gap: 1, fontSize: 12, letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600, color }}
      >
        <Box
          component="span"
          aria-hidden="true"
          sx={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0, backgroundColor: 'currentColor',
            // Lo urgente late tres veces al entrar y se queda quieto.
            ...(tarea.prioridad === 'urgente' && { animation: `${latido} 2.2s ease-out 1.2s 3`, '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }),
          }}
        />
        {tarea.etiqueta}
      </Box>
      <Typography component="span" sx={{ gridArea: 'texto', fontSize: 'clamp(13.5px, 1.8vh, 15px)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {tarea.titulo} <Box component="span" sx={{ color: 'text.secondary' }}>· {tarea.detalle}</Box>
      </Typography>
      <Box sx={{ gridArea: 'accion', justifySelf: 'end' }}>
        {conBoton && tarea.accion && (
          <Box component={Link} to={tarea.accion.href} sx={{ fontSize: 14, fontWeight: 600, color: ORO, textDecoration: 'none', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}>
            {tarea.accion.texto} →
          </Box>
        )}
        {!conBoton && (
          <Typography component="span" sx={{ fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap' }}>Lo lleva {tarea.cargo}</Typography>
        )}
      </Box>
    </Box>
  )
}

/**
 * Los asuntos que esperan, uno por línea: primero los tuyos, con su enlace;
 * luego los del resto de la junta, con quién los lleva. Cada uno en una sola
 * línea. Si hay muchos, se ven `aLaVista` (menos cuanto más baja es la
 * pantalla) y el resto se abre con «Ver los N», desplazándose dentro.
 */
export default function Asuntos({ tareas, role, aLaVista = A_LA_VISTA }: { tareas: Tarea[]; role?: string; aLaVista?: number }) {
  const { tuyas, deLaJunta } = repartirTareas(tareas, role)
  const [todos, setTodos] = useState(false)
  const ordenadas = [...tuyas.map((t) => ({ t, conBoton: true })), ...deLaJunta.map((t) => ({ t, conBoton: false }))]
  const visibles = todos ? ordenadas : ordenadas.slice(0, aLaVista)

  return (
    <Box component="section" aria-labelledby="asuntos" sx={{ border: `1px solid ${FILETE}`, borderRadius: 2, overflow: 'hidden', containerType: 'inline-size', containerName: 'asuntos' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, px: 2.5, py: PY, backgroundColor: 'action.hover' }}>
        <Typography id="asuntos" component="h2" sx={{ flexShrink: 0, fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
          {tareas.length === 0 ? 'Nada pendiente' : `${contar(tareas.length, 'asunto esperando', 'asuntos esperando')}`}
        </Typography>
        {tareas.length > 0 && (
          <Typography sx={{ fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
            {contar(tuyas.length, 'tuyo', 'tuyos')} · {deLaJunta.length} del resto de la junta
          </Typography>
        )}
      </Box>

      {tareas.length === 0 ? (
        <Typography sx={{ px: 2.5, py: PY, borderTop: `1px solid ${FILETE_SUAVE}`, fontSize: 15, color: 'text.secondary' }}>
          Todo al día. No queda nada esperando.
        </Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, maxHeight: '34vh', overflowY: 'auto', scrollbarWidth: 'thin' }}>
          {visibles.map(({ t, conBoton }) => <Fila key={t.clave} tarea={t} conBoton={conBoton} />)}
        </Box>
      )}

      {ordenadas.length > aLaVista && (
        <Box
          component="button"
          type="button"
          onClick={() => setTodos((v) => !v)}
          aria-expanded={todos}
          sx={{
            display: 'block', width: '100%', px: 2.5, py: PY, border: 0, borderTop: `1px solid ${FILETE_SUAVE}`, background: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: ORO, textAlign: 'left',
            '&:hover': { backgroundColor: 'action.hover' }, '&:focus-visible': { outline: '2px solid currentColor', outlineOffset: -2 },
          }}
        >
          {todos ? 'Ver menos' : `Ver los ${ordenadas.length}`}
        </Box>
      )}
    </Box>
  )
}
