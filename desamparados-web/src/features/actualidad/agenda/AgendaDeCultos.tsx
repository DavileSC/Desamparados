import { useEffect, useState } from 'react'
import { Box, ButtonBase, Popover, Typography } from '@mui/material'
import { agendaPublica, urlDeLaSuscripcion, type ApiEvent } from '../../../lib/api/agenda'
import { GRANATE } from '../../inicio/estilos'
import CalendarioDeCultos, { TINTA } from './CalendarioDeCultos'
import CalendarioDeCultosEsqueleto from './CalendarioDeCultosEsqueleto'
import EnCarga from '../../../components/esqueleto/EnCarga'
import { BOTON, enlaceConFlecha } from '../../../components/estiloDeBoton'
import { deLaCorporacion } from '../../../domain/articulos'

/** La hoja de la suscripción, la misma que la ventana de un acto. */
const HOJA = '#fbf8f2'

/**
 * La Agenda pública: lo que viene, de una vez y sin paginar, en un calendario
 * de pared (CalendarioDeCultos). Cada acto se abre en su ventana, con su .ics
 * y el camino en el mapa. Sin filtros: con los actos de un mes a la vista no
 * hacen falta. La suscripción (SuscribirseALaAgenda) va arriba, junto al
 * título del bloque.
 */
export default function AgendaDeCultos() {
  const [eventos, setEventos] = useState<ApiEvent[] | null>(null)
  const [error, setError] = useState(false)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    agendaPublica()
      .then((recibidos) => { if (vigente) setEventos(recibidos) })
      .catch(() => { if (vigente) setError(true) })
    return () => { vigente = false }
  }, [intento])

  const reintentar = () => {
    setError(false)
    setIntento((n) => n + 1)
  }

  return (
    <Box>
      {eventos === null && (
        <EnCarga estado={error ? 'error' : 'cargando'} que="la agenda" alReintentar={reintentar} esqueleto={<CalendarioDeCultosEsqueleto />} />
      )}
      {eventos?.length === 0 && (
        <Typography sx={{ color: 'rgba(255,255,255,0.75)' }}>No hay actos anunciados por ahora.</Typography>
      )}
      {!!eventos?.length && <CalendarioDeCultos eventos={eventos} />}
    </Box>
  )
}

/**
 * La agenda entera en el calendario del móvil: se suscribe una vez y los
 * cultos aparecen solos, y cambian si cambian aquí. Va junto al título de la
 * Agenda, y lo que explica se abre debajo del botón, en una hoja como la del
 * calendario.
 */
export function SuscribirseALaAgenda() {
  const [ancla, setAncla] = useState<HTMLElement | null>(null)
  const [copiado, setCopiado] = useState(false)
  const { https, webcal } = urlDeLaSuscripcion()
  const copiar = () => {
    navigator.clipboard?.writeText(https).then(() => setCopiado(true), () => setCopiado(false))
  }
  const enlace = {
    ...enlaceConFlecha, color: GRANATE, fontSize: 14.5, fontWeight: 600, minHeight: 40, fontFamily: 'inherit',
    '&:hover': { color: TINTA }, '&:focus-visible, &.Mui-focusVisible': { outline: `2px solid ${GRANATE}`, outlineOffset: 2 },
  } as const
  return (
    <>
      <ButtonBase
        onClick={(e) => setAncla(ancla ? null : e.currentTarget)}
        aria-expanded={!!ancla}
        aria-controls="suscripcion-agenda"
        sx={{ ...BOTON.claro, fontFamily: 'inherit', minHeight: { xs: 42, md: 48 }, px: { xs: 2.5, md: 3.5 }, fontSize: { xs: 14, md: 15 } }}
      >
        Suscribirse a la agenda
      </ButtonBase>
      <Popover
        id="suscripcion-agenda"
        open={!!ancla}
        anchorEl={ancla}
        onClose={() => setAncla(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 1, maxWidth: 'min(420px, calc(100vw - 32px))', bgcolor: HOJA, color: TINTA, borderRadius: '3px', border: '1px solid #d9cfc1', boxShadow: '0 24px 48px -18px rgba(20,14,16,0.45)' } } }}
      >
        <Box sx={{ p: 2.5, display: 'grid', gap: 1 }}>
          <Typography sx={{ color: '#5b4f53', fontSize: 14.5 }}>
            {`Los cultos y actos ${deLaCorporacion({ corto: true })} aparecen solos en el calendario de tu móvil, y se actualizan si cambia algo.`}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0 22px' }}>
            <Box component="a" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noopener noreferrer" sx={enlace}>Google Calendar</Box>
            <Box component="a" href={webcal} sx={enlace}>iPhone, Mac y Outlook</Box>
            <ButtonBase onClick={copiar} sx={enlace}>{copiado ? 'Enlace copiado' : 'Copiar el enlace'}</ButtonBase>
          </Box>
        </Box>
      </Popover>
    </>
  )
}
