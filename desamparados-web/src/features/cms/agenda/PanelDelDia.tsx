import { Box, Button, Paper, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { Link } from 'react-router-dom'
import type { EventoDelCalendario } from '../../../lib/api/agenda'
import AccionesActo from './AccionesActo'
import { Aviso, EnPortada } from './FilaEvento'
import PuntoTipo from './PuntoTipo'
import { claveDia, type Tramo } from './calendario'
import { finEnOtroDia, hora, loQueFalta } from './fechas'

interface Props {
  dia: Date
  actos: { evento: EventoDelCalendario; tramo: Tramo }[]
  portada: number[]
  /** La consulta del calendario, para que la ficha vuelva al mismo mes y día. */
  volver: string
  /** Con el mes a la medida de la ventana, el panel no pasa de ahí: hace scroll dentro. */
  altoMaximo?: number | null
  onBorrar: (evento: EventoDelCalendario) => void
}

const deMes = (fecha: Date) => fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })

/**
 * El día elegido en el calendario: sus actos enteros, con lo que en la
 * casilla no cabe (el lugar, lo que le falta), y los botones de cada uno.
 * Abajo, un acto nuevo que nace ya con este día puesto.
 */
export default function PanelDelDia({ dia, actos, portada, volver, altoMaximo, onBorrar }: Props) {
  const nombre = deMes(dia)
  return (
    <Paper component="section" aria-label={`Actos del ${nombre}`} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, ...(altoMaximo ? { maxHeight: altoMaximo, overflowY: 'auto' } : { position: { lg: 'sticky' }, top: { lg: 16 } }) }}>
      <div>
        <Typography sx={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary' }}>
          {dia.toLocaleDateString('es-ES', { weekday: 'long' })}
        </Typography>
        <Typography component="h2" sx={{ fontSize: 20, fontWeight: 600, lineHeight: 1.25 }}>{nombre}</Typography>
      </div>

      {actos.length === 0
        ? <Typography variant="body2" sx={{ color: 'text.secondary' }}>Nada este día.</Typography>
        : actos.map(({ evento }) => (
          <Acto key={evento.id} evento={evento} enPortada={portada.includes(evento.id)} volver={volver} onBorrar={() => onBorrar(evento)} />
        ))}

      <Button
        variant="outlined"
        color="inherit"
        startIcon={<AddIcon />}
        component={Link}
        to="/cms/agenda/nuevo"
        state={{ volver, fecha: claveDia(dia) }}
        sx={{ borderStyle: 'dashed', borderColor: 'divider', textTransform: 'none', fontWeight: 500 }}
      >
        Nuevo acto el {nombre}
      </Button>
    </Paper>
  )
}

/** Cuándo, dicho entero: «Del 3 al 5 de noviembre, a las 19:00», «18:00 a 21:00» o «19:00». */
function cuando(evento: EventoDelCalendario) {
  const inicio = new Date(evento.startDate)
  const finOtroDia = finEnOtroDia(evento)
  if (finOtroDia) return `Del ${deMes(inicio)} al ${deMes(finOtroDia)}, a las ${hora(inicio)}`
  return evento.endDate ? `${hora(inicio)} a ${hora(new Date(evento.endDate))}` : hora(inicio)
}

function Acto({ evento, enPortada, volver, onBorrar }: { evento: EventoDelCalendario; enPortada: boolean; volver: string; onBorrar: () => void }) {
  const avisos = evento.reparto ? [] : loQueFalta(evento)
  return (
    <Box
      component="article"
      sx={{
        p: 1.5, borderRadius: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5,
        border: 1, borderColor: 'divider', ...(evento.reparto && { borderStyle: 'dashed' }),
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {evento.reparto
          ? <Typography component="span" sx={{ fontSize: 13.5 }}>Reparto de papeletas</Typography>
          : <PuntoTipo tipo={evento.type} />}
        {enPortada && <EnPortada />}
      </Box>
      <Typography component="h3" sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{evento.title}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: 13.5 }}>
        {[cuando(evento), evento.location?.trim()].filter(Boolean).join(' · ')}
      </Typography>
      {avisos.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          {avisos.map((texto) => <Aviso key={texto}>{texto}</Aviso>)}
        </Box>
      )}
      {evento.reparto ? (
        // Lo crea y lo borra el turno de reparto: cambiado aquí, el turno lo
        // pisaría la próxima vez que alguien lo toque.
        <>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Lo pone el turno de reparto: se cambia desde Procesión.</Typography>
          <Box><Button size="small" endIcon={<ArrowForwardIcon />} component={Link} to="/cms/procesion" sx={{ px: 0 }}>Ir a Procesión</Button></Box>
        </>
      ) : (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.5 }}>
          <AccionesActo evento={evento} volver={volver} onBorrar={onBorrar} />
        </Box>
      )}
    </Box>
  )
}
