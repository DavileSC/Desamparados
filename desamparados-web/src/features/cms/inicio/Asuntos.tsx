import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { darAvisoPorHecho } from '../../../lib/api/panel'
import { CLAVE_PANEL_HOY } from '../../../app/usePanelDeHoy'
import { repartirTareas, type Prioridad, type Tarea } from './tareas'
import { contar } from './plural'
import { latido } from './animaciones'
import { FILETE, FILETE_SUAVE, ORO, ROSA_URGENTE } from './estiloRetablo'

/**
 * Cuántos se ven de entrada: si caben todos en `filas`, todos; si no, uno
 * menos y «Ver los N». Así la lista nunca pasa de ese alto y lo de debajo no
 * se mueve. `filas` es 4 en pantallas altas y 3 en las bajas, donde con cuatro
 * el curso se quedaba sin sitio.
 */
export const aLaVista = (cuantos: number, filas = 4) => (cuantos <= filas ? cuantos : filas - 1)
const PY = 'clamp(5px, 1vh, 9px)'

const COLOR: Record<Prioridad, string> = {
  urgente: ROSA_URGENTE,
  pendiente: ORO,
  programado: 'text.secondary',
}

/** «Hecho»: el aviso desaparece del Inicio de todos al volver a pedir el panel. */
function BotonHecho({ id, titulo }: { id: number; titulo: string }) {
  const cliente = useQueryClient()
  const hecho = useMutation({
    mutationFn: () => darAvisoPorHecho(id),
    onSuccess: () => cliente.invalidateQueries({ queryKey: CLAVE_PANEL_HOY }),
  })
  return (
    <Box
      component="button"
      type="button"
      onClick={() => hecho.mutate()}
      disabled={hecho.isPending}
      aria-label={`Dar por hecho: ${titulo}`}
      title={hecho.isError ? hecho.error.message : undefined}
      sx={{
        px: 1.5, py: 0.25, borderRadius: 1.5, border: '1px solid', cursor: 'pointer', background: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
        borderColor: hecho.isError ? ROSA_URGENTE : `color-mix(in srgb, ${ORO} 50%, transparent)`, color: hecho.isError ? ROSA_URGENTE : ORO,
        '&:hover': { backgroundColor: `color-mix(in srgb, ${ORO} 10%, transparent)` }, '&:disabled': { opacity: 0.5, cursor: 'default' },
        '&:focus-visible': { outline: `2px solid ${ORO}`, outlineOffset: 2 },
      }}
    >
      {hecho.isError ? 'Reintentar' : 'Hecho'}
    </Box>
  )
}

/** La marca de los avisos puestos a mano, para distinguirlos de los que salen solos. */
const MarcaAviso = () => (
  <Box component="span" sx={{ flexShrink: 0, px: 0.9, borderRadius: 999, border: `1px solid ${FILETE}`, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary', lineHeight: 1.6 }}>
    Aviso
  </Box>
)

function Fila({ tarea, conBoton, userId }: { tarea: Tarea; conBoton: boolean; userId?: number }) {
  const color = COLOR[tarea.prioridad]
  // Un aviso lo da por hecho quien lo lleva y también quien lo puso.
  const puedeHacerlo = tarea.aviso !== undefined && (conBoton || (userId !== undefined && tarea.aviso.creadoPorId === userId))
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
      <Box sx={{ gridArea: 'texto', minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography component="span" title={`${tarea.titulo} · ${tarea.detalle}`} sx={{ fontSize: 'clamp(13.5px, 1.8vh, 15px)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {tarea.titulo} <Box component="span" sx={{ color: 'text.secondary' }}>· {tarea.detalle}</Box>
        </Typography>
        {tarea.aviso && <MarcaAviso />}
      </Box>
      <Box sx={{ gridArea: 'accion', justifySelf: 'end' }}>
        {puedeHacerlo && tarea.aviso && <BotonHecho id={tarea.aviso.id} titulo={tarea.titulo} />}
        {conBoton && tarea.accion && (
          <Box component={Link} to={tarea.accion.href} sx={{ fontSize: 14, fontWeight: 600, color: ORO, textDecoration: 'none', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}>
            {tarea.accion.texto} →
          </Box>
        )}
        {!conBoton && !puedeHacerlo && (
          <Typography component="span" sx={{ fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap' }}>Lo lleva {tarea.cargo}</Typography>
        )}
      </Box>
    </Box>
  )
}

/**
 * Los asuntos que esperan, uno por línea: primero los tuyos, con su enlace;
 * luego los del resto de la junta, con quién los lleva. Entre ellos van los
 * avisos que la junta pone a mano, con su marca y su «Hecho». Si no caben,
 * «Ver los N» los abre todos: entonces la lista se queda con todo el hueco
 * (lo decide quien la pone, con `todos`) y se desplaza dentro.
 */
export default function Asuntos({ tareas, role, userId, todos, onTodos, filas = 4, onNuevoAviso }: {
  tareas: Tarea[]; role?: string; userId?: number; todos: boolean; onTodos: (todos: boolean) => void
  /** Cuántas filas caben antes de pasar a «Ver los N». */
  filas?: number
  /** Abre la ventana del aviso nuevo; sin ella no se ofrece. */
  onNuevoAviso?: () => void
}) {
  const { tuyas, deLaJunta } = repartirTareas(tareas, role)
  const ordenadas = [...tuyas.map((t) => ({ t, conBoton: true })), ...deLaJunta.map((t) => ({ t, conBoton: false }))]
  const vista = aLaVista(ordenadas.length, filas)
  const visibles = todos ? ordenadas : ordenadas.slice(0, vista)

  return (
    <Box
      component="section"
      aria-labelledby="asuntos"
      sx={{
        border: `1px solid ${FILETE}`, borderRadius: 2, overflow: 'hidden', containerType: 'inline-size', containerName: 'asuntos',
        ...(todos && { flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column' }),
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, px: 2.5, py: PY, backgroundColor: 'action.hover' }}>
        <Typography id="asuntos" component="h2" sx={{ flexShrink: 0, fontSize: 12, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600 }}>
          {tareas.length === 0 ? 'Nada pendiente' : `${contar(tareas.length, 'asunto esperando', 'asuntos esperando')}`}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, minWidth: 0 }}>
          {tareas.length > 0 && (
            <Typography sx={{ fontSize: 13, color: 'text.secondary', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              {contar(tuyas.length, 'tuyo', 'tuyos')} · {deLaJunta.length} del resto de la junta
            </Typography>
          )}
          {onNuevoAviso && (
            <Box
              component="button"
              type="button"
              onClick={onNuevoAviso}
              sx={{
                flexShrink: 0, p: 0, border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: ORO, whiteSpace: 'nowrap',
                '&:hover': { textDecoration: 'underline' }, '&:focus-visible': { outline: `2px solid ${ORO}`, outlineOffset: 2 },
              }}
            >
              + Nuevo aviso
            </Box>
          )}
        </Box>
      </Box>

      {tareas.length === 0 ? (
        <Typography sx={{ px: 2.5, py: PY, borderTop: `1px solid ${FILETE_SUAVE}`, fontSize: 15, color: 'text.secondary' }}>
          Todo al día. No queda nada esperando.
        </Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, overflowY: 'auto', scrollbarWidth: 'thin', ...(todos && { flex: '1 1 0', minHeight: 0 }) }}>
          {visibles.map(({ t, conBoton }) => <Fila key={t.clave} tarea={t} conBoton={conBoton} userId={userId} />)}
        </Box>
      )}

      {ordenadas.length > vista && (
        <Box
          component="button"
          type="button"
          onClick={() => onTodos(!todos)}
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
