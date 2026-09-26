import { useEffect, useState } from 'react'
import { Alert, Box, ButtonBase, CircularProgress, Collapse, Typography } from '@mui/material'
import { agendaPublica, urlDeLaSuscripcion, type ApiEvent } from '../../../lib/api/agenda'
import { GOLD } from '../../inicio/estilos'
import CalendarioDeCultos from './CalendarioDeCultos'
import { ESMALTE, enlaceEsmalte } from '../../../components/esmalte'

/**
 * La Agenda pública: lo que viene, de una vez y sin paginar, en un calendario
 * de pared (CalendarioDeCultos). Cada acto se abre en su ventana, con su .ics
 * y el camino en el mapa; al final, la suscripción a la agenda entera. Sin
 * filtros: con los actos de un mes a la vista no hacen falta.
 */
export default function AgendaDeCultos() {
  const [eventos, setEventos] = useState<ApiEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true
    agendaPublica()
      .then((recibidos) => { if (vigente) setEventos(recibidos) })
      .catch((err: unknown) => { if (vigente) setError(err instanceof Error ? err.message : 'No se ha podido cargar la agenda.') })
    return () => { vigente = false }
  }, [])

  return (
    <Box>
      {error && <Alert severity="error">{error}</Alert>}
      {!error && eventos === null && <CircularProgress aria-label="Cargando la agenda" />}
      {eventos?.length === 0 && (
        <Typography sx={{ color: 'rgba(255,255,255,0.75)' }}>No hay actos anunciados por ahora.</Typography>
      )}
      {!!eventos?.length && <CalendarioDeCultos eventos={eventos} />}
      {eventos !== null && <Suscripcion />}
    </Box>
  )
}

/**
 * La agenda entera en el calendario del móvil: se suscribe una vez y los
 * cultos aparecen solos, y cambian si cambian aquí.
 */
function Suscripcion() {
  const [abierta, setAbierta] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const { https, webcal } = urlDeLaSuscripcion()
  const copiar = () => {
    navigator.clipboard?.writeText(https).then(() => setCopiado(true), () => setCopiado(false))
  }
  // Enlaces esmalte: en minúsculas y sin subrayar, en oro sobre el fondo de la Agenda.
  const enlace = { ...enlaceEsmalte, color: GOLD, fontSize: 14.5, minHeight: 40, fontFamily: 'inherit', '&:hover': { color: '#ffffff' } } as const
  return (
    <Box sx={{ mt: 4, textAlign: 'center' }}>
      <ButtonBase onClick={() => setAbierta((a) => !a)} aria-expanded={abierta} aria-controls="suscripcion-agenda" sx={{ ...ESMALTE.oscuro, fontFamily: 'inherit' }}>
        Suscribirse a la agenda
      </ButtonBase>
      <Collapse in={abierta} id="suscripcion-agenda">
        <Box sx={{ mt: 1.5, mx: 'auto', maxWidth: 520, border: `1px solid rgba(222,199,43,0.4)`, p: 2.5, display: 'grid', gap: 1, textAlign: 'left' }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 14.5 }}>
            Los cultos y actos del Grupo aparecen solos en el calendario de tu móvil, y se actualizan si cambia algo.
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0 22px' }}>
            <Box component="a" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer" sx={enlace}>Google Calendar</Box>
            <Box component="a" href={webcal} sx={enlace}>iPhone, Mac y Outlook</Box>
            <ButtonBase onClick={copiar} sx={enlace}>{copiado ? 'Enlace copiado' : 'Copiar el enlace'}</ButtonBase>
          </Box>
        </Box>
      </Collapse>
    </Box>
  )
}
