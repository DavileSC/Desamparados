import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Box, ButtonBase, CircularProgress, Collapse, Typography } from '@mui/material'
import { agendaPublica, urlDeLaSuscripcion, type ApiEvent } from '../../../lib/api/agenda'
import { GOLD, GRANATE, PAPEL } from '../../inicio/estilos'
import { FILTROS, cuandoEnLista, enTramos, hora, pasaElFiltro, type Filtro } from './cultos'
import CartelDeCulto from './CartelDeCulto'
import EnlacesDelActo from './EnlacesDelActo'

const TINTA = '#1b1c1a'
const TINTA2 = '#4a454a'
const TENUE = '#7b6f5e'
const REGLA = '#eae2d5'
const esFiltro = (valor: string | null): valor is Filtro => FILTROS.some((f) => f.valor === valor)

/**
 * La Agenda pública: lo que viene, de una vez y sin paginar, con los cultos
 * solemnes en su cartel (foto de la Titular, título, dedicatoria, cuándo y
 * dónde) y, entre cartel y cartel, los demás actos en una lista corta.
 *
 * Cada acto se puede añadir al calendario (.ics) y lleva al mapa; al final,
 * la suscripción a la agenda entera. El filtro va en la dirección (`?ver=`):
 * un enlace a «Cultos y salidas» abre eso.
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
  const tramos = enTramos(visibles)

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
      {eventos !== null && tramos.length === 0 && (
        <Typography sx={{ color: 'rgba(255,255,255,0.75)' }}>
          {filtro === 'todo' ? 'No hay actos anunciados por ahora.' : 'No hay actos de este tipo anunciados por ahora.'}
        </Typography>
      )}

      <Box sx={{ display: 'grid', gap: { xs: 2.5, md: 3 } }}>
        {tramos.map((tramo, i) => ('cartel' in tramo
          ? <CartelDeCulto key={`c${tramo.cartel.id}`} evento={tramo.cartel} />
          : <Lista key={`l${tramo.actos[0].id}`} titulo={i === 0 ? 'Próximamente' : 'Y además'} actos={tramo.actos} />))}
      </Box>

      {eventos !== null && <Suscripcion />}
    </Box>
  )
}

/** Los actos de entre dos carteles, en papel: cuándo, a qué hora, qué y dónde. */
function Lista({ titulo, actos }: { titulo: string; actos: ApiEvent[] }) {
  return (
    <Box component="section" aria-label={titulo} sx={{ backgroundColor: PAPEL, color: TINTA, px: { xs: 2, md: 4 }, pt: 2.25, pb: 1.5 }}>
      <Typography component="h3" sx={{ fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', color: TENUE, fontWeight: 600, mb: 0.5 }}>
        {titulo}
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {actos.map((evento, i) => (
          <Box
            component="li"
            key={evento.id}
            sx={{
              // En el móvil, el día y la hora en una línea; debajo, el acto y los enlaces.
              display: 'grid', gridTemplateColumns: { xs: 'auto minmax(0, 1fr)', md: '170px 56px minmax(0, 1fr) auto' }, columnGap: { xs: 1, md: 1.75 },
              alignItems: 'baseline', py: 1.25, borderTop: i === 0 ? 0 : `1px solid ${REGLA}`, fontSize: 15,
            }}
          >
            <Box component="span" sx={{ color: GRANATE, fontWeight: 600 }}>{cuandoEnLista(evento)}</Box>
            <Box component="span" sx={{ color: TINTA2, fontVariantNumeric: 'tabular-nums', '&::before': { content: { xs: '"· "', md: '""' } } }}>{hora(evento)}</Box>
            <Box component="span" sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
              {evento.title}
              {evento.location?.trim() && <Box component="span" sx={{ display: 'block', fontSize: 13.5, color: TINTA2 }}>{evento.location}</Box>}
            </Box>
            <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}><EnlacesDelActo evento={evento} /></Box>
          </Box>
        ))}
      </Box>
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
