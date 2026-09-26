import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Box, ButtonBase, CircularProgress, Collapse, Typography } from '@mui/material'
import { agendaPublica, urlDeLaSuscripcion, type ApiEvent } from '../../../lib/api/agenda'
import { GOLD } from '../../inicio/estilos'
import { FILTROS, pasaElFiltro, type Filtro } from './cultos'
import CalendarioDeCultos from './CalendarioDeCultos'

const esFiltro = (valor: string | null): valor is Filtro => FILTROS.some((f) => f.valor === valor)

/**
 * La Agenda pública: lo que viene, de una vez y sin paginar, en un calendario
 * de pared (CalendarioDeCultos). Cada acto se abre en su ventana, con su .ics
 * y el camino en el mapa; al final, la suscripción a la agenda entera. El
 * filtro va en la dirección (`?ver=`): un enlace a «Cultos y salidas» abre eso.
 */
export default function AgendaDeCultos() {
  const [eventos, setEventos] = useState<ApiEvent[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [params] = useSearchParams()
  const [filtro, setFiltro] = useState<Filtro>(() => {
    const ver = params.get('ver')
    return esFiltro(ver) ? ver : 'todo'
  })

  useEffect(() => {
    let vigente = true
    agendaPublica()
      .then((recibidos) => { if (vigente) setEventos(recibidos) })
      .catch((err: unknown) => { if (vigente) setError(err instanceof Error ? err.message : 'No se ha podido cargar la agenda.') })
    return () => { vigente = false }
  }, [])

  // El filtro cambia aquí y la dirección se reescribe aparte: pasarlo por el
  // router volvía a pintar la web entera (barra, cabecera, bloques) en cada
  // clic y el cambio se notaba lento.
  const elegir = (valor: Filtro) => {
    setFiltro(valor)
    const url = new URL(window.location.href)
    if (valor === 'todo') url.searchParams.delete('ver')
    else url.searchParams.set('ver', valor)
    window.history.replaceState(window.history.state, '', url)
  }

  const visibles = (eventos ?? []).filter((e) => pasaElFiltro(e, filtro))

  return (
    <Box>
      <Box role="group" aria-label="Qué ver" sx={{ display: 'flex', gap: '0 22px', overflowX: 'auto', scrollbarWidth: 'none', mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, mb: 3 }}>
        {FILTROS.map((f) => (
          <ButtonBase
            key={f.valor}
            onClick={() => elegir(f.valor)}
            disableRipple
            aria-pressed={filtro === f.valor}
            sx={{
              minHeight: 44, fontFamily: 'inherit', fontSize: 15, whiteSpace: 'nowrap',
              color: filtro === f.valor ? '#fff' : 'rgba(255,255,255,0.7)',
              borderBottom: '1px solid', borderColor: filtro === f.valor ? GOLD : 'transparent',
              '&:hover': { color: '#fff' },
              '&.Mui-focusVisible': { outline: `2px solid ${GOLD}`, outlineOffset: 2 },
            }}
          >
            {f.nombre}
          </ButtonBase>
        ))}
      </Box>

      {error && <Alert severity="error">{error}</Alert>}
      {!error && eventos === null && <CircularProgress aria-label="Cargando la agenda" />}
      {eventos !== null && visibles.length === 0 && (
        <Typography sx={{ color: 'rgba(255,255,255,0.75)' }}>
          {filtro === 'todo' ? 'No hay actos anunciados por ahora.' : 'No hay actos de este tipo anunciados por ahora.'}
        </Typography>
      )}

      {visibles.length > 0 && <CalendarioDeCultos eventos={visibles} />}

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
  const enlace = {
    color: GOLD, fontWeight: 600, fontSize: 14.5, minHeight: 40, display: 'inline-flex', alignItems: 'center',
    textUnderlineOffset: '3px', textDecorationThickness: '1px', fontFamily: 'inherit',
  } as const
  return (
    <Box sx={{ mt: 4, textAlign: 'center' }}>
      <ButtonBase onClick={() => setAbierta((a) => !a)} aria-expanded={abierta} aria-controls="suscripcion-agenda" sx={{ ...enlace, textDecoration: 'underline' }}>
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
            <ButtonBase onClick={copiar} sx={{ ...enlace, textDecoration: 'underline' }}>{copiado ? 'Enlace copiado' : 'Copiar el enlace'}</ButtonBase>
          </Box>
        </Box>
      </Collapse>
    </Box>
  )
}
