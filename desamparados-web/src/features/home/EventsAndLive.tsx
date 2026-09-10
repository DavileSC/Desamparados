import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box, Typography, type SxProps, type Theme } from '@mui/material'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import PageContainer from '../../components/PageContainer'
import AnimatedSection, { Revela } from '../../components/AnimatedSection'
import { getEventosCalendario, type EventoCalendario } from '../../lib/api/events'
import { site } from '../../config/site'
import HomeFeedback from './HomeFeedback'
import MiniCalendar from './MiniCalendar'
import AgendaList from './AgendaList'
import { inicioDeMes, inicioDelDia, nombreDelMes, sumarMeses } from './agenda'
import { GOLD, PAPEL, SERIF, TINTA, ceja, enlaceBloque } from './estilos'

// El tope por página del servidor: sobra para dos meses de actos.
const ACTOS_POR_VENTANA = 100

function AvisoDirecto({ url }: { url: string }) {
  return (
    <Box
      component="a"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.75,
        p: 2,
        maxWidth: 320,
        borderRadius: '10px',
        backgroundColor: 'rgba(16, 14, 17, 0.52)',
        backdropFilter: 'blur(14px) saturate(1.15)',
        color: '#fff',
        textDecoration: 'none',
        transition: 'background-color .3s ease',
        '@media (hover: hover)': {
          '&:hover': { backgroundColor: 'rgba(28, 23, 20, 0.66)' },
          '&:hover .directo-titulo': { color: GOLD },
        },
      }}
    >
      <PlayCircleIcon aria-hidden="true" sx={{ fontSize: 34, color: GOLD }} />
      <Box component="span">
        <Box component="span" className="directo-titulo" sx={{ display: 'block', fontFamily: SERIF, fontSize: 16, transition: 'color .3s ease' }}>
          Ver en directo
        </Box>
        <Box component="span" sx={{ display: 'block', fontSize: 13, color: 'rgba(228, 226, 223, 0.7)' }}>
          Retransmisión desde la sede <span className="home-visually-hidden">(nueva pestaña)</span>
        </Box>
      </Box>
    </Box>
  )
}

/**
 * Al cambiar de mes la tarjeta no cambia de alto: guarda la mayor altura que ha tenido con este
 * ancho y solo la recalcula si cambia el ancho (girar el móvil, redimensionar). El alto mínimo se
 * escribe en el propio elemento para poder medir su altura natural cuando cambia el ancho.
 */
function AlturaSostenida({ children, className, sx }: { children: ReactNode; className?: string; sx?: SxProps<Theme> }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let ancho = -1
    let maximo = 0
    const observador = new ResizeObserver(([entrada]) => {
      const { width } = entrada.contentRect
      if (width !== ancho) {
        ancho = width
        el.style.minHeight = ''
        maximo = el.offsetHeight
      } else {
        maximo = Math.max(maximo, el.offsetHeight)
      }
      el.style.minHeight = `${maximo}px`
    })
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  return <Box ref={ref} className={className} sx={sx}>{children}</Box>
}

export default function EventsAndLive() {
  const hoy = inicioDelDia(new Date())
  const [mesElegido, setMesElegido] = useState<Date | null>(null)
  // undefined: nadie ha tocado nada y se abre el próximo acto; null: el visitante lo ha cerrado.
  const [abierto, setAbierto] = useState<string | null | undefined>(undefined)

  // El calendario se abre en el mes del próximo acto: así nunca arranca en un mes vacío.
  const proximo = useQuery({
    queryKey: ['home', 'agenda', 'proximo'],
    queryFn: () => getEventosCalendario({ cuantos: 1 }),
    retry: false,
    staleTime: 60_000,
  })
  const mes = mesElegido ?? inicioDeMes(proximo.data?.[0]?.start ?? hoy)

  // La ventana es el mes visible y el siguiente, desde hoy: los actos pasados no se enseñan.
  const ventana = useQuery({
    queryKey: ['home', 'agenda', mes.getTime()],
    queryFn: () => getEventosCalendario({
      desde: mes.getTime() > hoy.getTime() ? mes : hoy,
      hasta: sumarMeses(mes, 2),
      cuantos: ACTOS_POR_VENTANA,
    }),
    enabled: proximo.isSuccess,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 60_000,
  })

  const eventos = ventana.data ?? []
  const abiertoId = abierto === undefined ? eventos[0]?.id ?? null : abierto
  const stream = site.directo.urlAlternativa

  const cambiarMes = (salto: number) => {
    setMesElegido(sumarMeses(mes, salto))
    setAbierto(undefined)
  }
  const elegir = (evento: EventoCalendario) => setAbierto(evento.id)
  const alternar = (id: string) => setAbierto(id === abiertoId ? null : id)
  const sinLista = ventana.isPending || ventana.isError || !eventos.length

  return (
    <AnimatedSection
      id="agenda"
      cascada
      aria-labelledby="agenda-title"
      sx={{
        position: 'relative',
        isolation: 'isolate',
        // `clip` recorta la foto sin hacer de la sección un contenedor con scroll:
        // con `hidden`, un scrollIntoView dentro la desplazaba y asomaba una franja de foto.
        overflow: 'hidden',
        '@supports (overflow: clip)': { overflow: 'clip' },
        py: { xs: 8, md: 13 },
        backgroundColor: TINTA,
      }}
    >
      {/* Bloque de foto a sangre con bordes rectos. La foto es pequeña y va detrás de la tarjeta:
          desenfocada y velada, sirve de ambiente sin competir con el calendario. */}
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          inset: '-16px',
          zIndex: -2,
          backgroundImage: 'url(/images/procesion.jpg)',
          backgroundRepeat: 'no-repeat',
          backgroundSize: 'cover',
          backgroundPosition: 'center 55%',
          filter: 'blur(3px)',
        }}
      />
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          background: {
            xs: 'rgba(16, 14, 17, 0.76)',
            md: 'linear-gradient(90deg, rgba(16, 14, 17, 0.9), rgba(16, 14, 17, 0.68) 45%, rgba(16, 14, 17, 0.55))',
          },
        }}
      />
      <PageContainer>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '300px 1fr' }, gap: { xs: 4, md: 7 }, alignItems: 'start' }}>
          <Revela>
            <Typography component="span" sx={ceja}>Cultos</Typography>
            <Typography id="agenda-title" variant="h2" component="h2" sx={{ fontFamily: SERIF, color: '#fff', m: 0 }}>
              Agenda y Cultos
            </Typography>
            <Typography sx={{ mt: 2.75, mb: 3.5, maxWidth: 420, fontSize: 15, lineHeight: 1.7, color: '#e4e2df' }}>
              La vida de oración del Grupo Parroquial a lo largo del año litúrgico: cultos, formación y convivencia.
            </Typography>
            <Box component={Link} to="/actualidad/agenda" sx={enlaceBloque}>
              Calendario completo <ArrowForwardIcon />
            </Box>
            {stream && <Box sx={{ mt: 4 }}><AvisoDirecto url={stream} /></Box>}
          </Revela>

          <Revela orden={1}>
            {!proximo.isSuccess ? (
              <HomeFeedback loading={proximo.isPending} error={proximo.isError} empty={false} label="la agenda" emptyMessage="" retry={() => { void proximo.refetch() }} />
            ) : (
              <AlturaSostenida
                className="home-papel"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '280px 1fr' },
                  gridTemplateRows: { xs: 'auto 1fr', sm: '1fr' },
                  backgroundColor: PAPEL,
                  color: '#1b1c1a',
                  boxShadow: '0 30px 60px -30px rgba(0, 0, 0, 0.9)',
                }}
              >
                <Box sx={{ boxShadow: { xs: 'inset 0 -1px 0 #e3dccf', sm: 'inset -1px 0 0 #e3dccf' } }}>
                  <MiniCalendar
                    mes={mes}
                    hoy={hoy}
                    eventos={eventos}
                    abiertoId={abiertoId}
                    puedeRetroceder={mes.getTime() > inicioDeMes(hoy).getTime()}
                    onCambiarMes={cambiarMes}
                    onElegir={elegir}
                  />
                </Box>
                <Box sx={{ minWidth: 0, opacity: ventana.isPlaceholderData ? 0.6 : 1, transition: 'opacity .2s ease' }}>
                  {sinLista && (
                    <Box sx={{ p: { xs: 2, sm: 3 } }}>
                      <HomeFeedback
                        claro
                        loading={ventana.isPending}
                        error={ventana.isError}
                        empty={!eventos.length}
                        label="la agenda"
                        emptyMessage={`No hay actos publicados para ${nombreDelMes(mes, false).toLowerCase()} ni ${nombreDelMes(sumarMeses(mes, 1), false).toLowerCase()}. Publicaremos aquí los nuevos encuentros.`}
                        retry={() => { void ventana.refetch() }}
                      />
                    </Box>
                  )}
                  <AgendaList eventos={eventos} abiertoId={abiertoId} hoy={hoy} onAlternar={alternar} />
                </Box>
              </AlturaSostenida>
            )}
          </Revela>
        </Box>
      </PageContainer>
    </AnimatedSection>
  )
}
