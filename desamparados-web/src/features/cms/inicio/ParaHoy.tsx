import { Box, Paper, Typography } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { Link } from 'react-router-dom'
import { useTemaCms } from '../../../app/temaCms'
import { repartirTareas, type Prioridad, type Tarea } from './tareas'
import { contar } from './plural'

const PUNTO: Record<Prioridad, 'error' | 'aviso' | null> = {
  urgente: 'error',
  pendiente: 'aviso',
  programado: null,
}

function Fila({ tarea, conBoton }: { tarea: Tarea; conBoton: boolean }) {
  const { superficies, graficas } = useTemaCms()
  const tono = PUNTO[tarea.prioridad]
  const fondo = tarea.prioridad === 'urgente'
    ? superficies.pillUrgente
    : tarea.prioridad === 'pendiente'
      ? superficies.pillPendiente
      : superficies.pillNeutro

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: { xs: 2, md: 2.75 }, py: 1.625, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
      <Box
        component="span"
        sx={{
          width: 96, flexShrink: 0, height: 26, borderRadius: 13, backgroundColor: fondo,
          display: 'inline-flex', alignItems: 'center', gap: 0.875, px: 1.25,
          fontSize: 12, fontWeight: 600, boxSizing: 'border-box',
        }}
      >
        <Box
          component="span"
          aria-hidden="true"
          sx={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, backgroundColor: tono ? graficas.estados[tono] : 'text.disabled' }}
        />
        {tarea.etiqueta}
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 180 }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{tarea.titulo}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{tarea.detalle}</Typography>
      </Box>
      {conBoton && tarea.accion && (
        <Box
          component={Link}
          to={tarea.accion.href}
          sx={{
            height: 34, px: 1.5, borderRadius: 1.125, flexShrink: 0, textDecoration: 'none',
            backgroundColor: superficies.accionFondo, color: superficies.accionTexto,
            fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 0.75,
          }}
        >
          {tarea.accion.texto}
          <ArrowForwardIcon sx={{ fontSize: 15 }} />
        </Box>
      )}
      {!conBoton && (
        <Box
          component="span"
          sx={{
            height: 28, px: 1.5, borderRadius: 14, flexShrink: 0, whiteSpace: 'nowrap',
            backgroundColor: superficies.pillNeutro, color: 'text.secondary',
            fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center',
          }}
        >
          Lo lleva {tarea.cargo}
        </Box>
      )}
    </Box>
  )
}

/** Lo que hay que hacer hoy: lo tuyo con botón, lo del resto de la junta sin él. */
export default function ParaHoy({ tareas, role }: { tareas: Tarea[]; role?: string }) {
  const { tuyas, deLaJunta } = repartirTareas(tareas, role)

  return (
    <Paper component="section" aria-labelledby="para-hoy" sx={{ borderRadius: 1.75 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2, px: { xs: 2, md: 2.75 }, pt: 2.25, pb: 1.5 }}>
        <Typography id="para-hoy" variant="h5" component="h2">Para hoy</Typography>
        <Typography variant="body2" color="text.secondary">
          {tareas.length === 0
            ? 'Nada pendiente'
            : `${contar(tuyas.length, 'tuyo', 'tuyos')} · ${deLaJunta.length} del resto de la junta`}
        </Typography>
      </Box>

      {tareas.length === 0 && (
        <Box sx={{ px: { xs: 2, md: 2.75 }, pb: 3, borderTop: 1, borderColor: 'divider', pt: 2.5 }}>
          <Typography variant="body1">Todo al día. No queda nada esperando.</Typography>
        </Box>
      )}

      {tuyas.map((tarea) => <Fila key={tarea.clave} tarea={tarea} conBoton />)}

      {deLaJunta.length > 0 && (
        <>
          <Typography
            sx={{
              px: { xs: 2, md: 2.75 }, pt: 1.75, pb: 0.75, borderTop: 1, borderColor: 'divider',
              fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary',
            }}
          >
            En el resto de la junta
          </Typography>
          {deLaJunta.map((tarea) => <Fila key={tarea.clave} tarea={tarea} conBoton={false} />)}
        </>
      )}
      <Box sx={{ pb: 1 }} />
    </Paper>
  )
}
