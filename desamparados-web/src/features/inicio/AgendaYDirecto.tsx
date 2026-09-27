import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box, Typography, type SxProps, type Theme } from '@mui/material'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import SeccionAnimada, { Revela } from '../../components/SeccionAnimada'
import { eventosDelCalendario, type EventoCalendario } from '../../lib/api/agenda'
import { site } from '../../config/site'
import { useTextosPortada } from './useContenidoPortada'
import AvisosDeInicio from './AvisosDeInicio'
import MiniCalendario from './MiniCalendario'
import ListaDeAgenda, { ListaDeAgendaEsqueleto } from './ListaDeAgenda'
import EnCarga from '../../components/esqueleto/EnCarga'
import { inicioDeMes, inicioDelDia, nombreDelMes, sumarMeses } from './agenda'
import { GOLD, PAPEL, SERIF, TINTA, ceja, enlaceBloque } from './estilos'

// El tope por página del servidor: sobra para dos meses de actos.
const ACTOS_POR_VENTANA = 100

function AvisoDirecto({ url, titulo, texto }: { url: string; titulo: string; texto: string }) {
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
        backgroundColor: 'rgba(7, 6, 8, 0.52)',
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
          {titulo}
        </Box>
        <Box component="span" sx={{ display: 'block', fontSize: 13, color: 'rgba(228, 226, 223, 0.7)' }}>
          {texto} <span className="home-visually-hidden">(nueva pestaña)</span>
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

export default function AgendaYDirecto() {
  const textos = useTextosPortada()
  const hoy = inicioDelDia(new Date())
  const [mesElegido, setMesElegido] = useState<Date | null>(null)
  // undefined: nadie ha tocado nada y se abre el próximo acto; null: el visitante lo ha cerrado.
  const [abierto, setAbierto] = useState<string | null | undefined>(undefined)

  // El calendario se abre en el mes del próximo acto: así nunca arranca en un mes vacío.
  const proximo = useQuery({
    queryKey: ['home', 'agenda', 'proximo'],
    queryFn: () => eventosDelCalendario({ cuantos: 1 }),
    retry: false,
    staleTime: 60_000,
  })
  const mes = mesElegido ?? inicioDeMes(proximo.data?.[0]?.start ?? hoy)

  // La ventana es el mes visible y el siguiente, desde hoy: los actos pasados no se enseñan.
  const ventana = useQuery({
    queryKey: ['home', 'agenda', mes.getTime()],
    queryFn: () => eventosDelCalendario({
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
  // La tarjeta sale siempre: el mes no depende del servidor. Lo que espera es
  // la lista, que lleva su esqueleto mientras llegan el próximo acto y los de
  // la ventana, y el aviso si no llegan.
  const reintentando = (proximo.isError || ventana.isError) && (proximo.isFetching || ventana.isFetching)
  const listaCargando = proximo.isPending || (proximo.isSuccess && ventana.isPending) || reintentando
  const listaFallo = !listaCargando && (proximo.isError || ventana.isError)
  const reintentar = () => { void (proximo.isError ? proximo.refetch() : ventana.refetch()) }

  return (
    <SeccionAnimada
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
      {/* Bloque de foto a sangre con bordes rectos. La foto va detrás de la tarjeta:
          desenfocada y velada, sirve de ambiente sin competir con el calendario.
          Se cambia en el CMS; sin foto, el bloque queda sobre el fondo oscuro. */}
      {textos.agenda.imagenUrl && (
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            inset: '-16px',
            zIndex: -2,
            backgroundImage: `url("${textos.agenda.imagenUrl}")`,
            backgroundRepeat: 'no-repeat',
            backgroundSize: 'cover',
            backgroundPosition: 'center 55%',
            filter: 'blur(3px)',
          }}
        />
      )}
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          background: {
            xs: 'rgba(7, 6, 8, 0.76)',
            md: 'linear-gradient(90deg, rgba(7, 6, 8, 0.9), rgba(7, 6, 8, 0.68) 45%, rgba(7, 6, 8, 0.55))',
          },
        }}
      />
      <ContenedorDePagina>
        {/* Texto y tarjeta, lado a lado solo desde 1200 px: entre 900 y 1200 el
            texto (300 px) y el calendario (280) dejaban a la lista unos 150 px, y
            cada título salía palabra por palabra. Ahí, el texto va encima. */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '300px 1fr' }, gap: { xs: 4, lg: 7 }, alignItems: 'start' }}>
          <Box>
            <Revela>
              <Typography component="span" sx={ceja}>{textos.agenda.ceja}</Typography>
            </Revela>
            <Revela efecto="cortina" orden={1}>
              <Typography id="agenda-title" variant="h2" component="h2" sx={{ fontFamily: SERIF, color: '#fff', m: 0 }}>
                {textos.agenda.titulo}
              </Typography>
            </Revela>
            <Revela orden={2}>
              <Typography sx={{ mt: 2.75, mb: 3.5, maxWidth: 420, fontSize: 15, lineHeight: 1.7, color: '#e4e2df' }}>
                {textos.agenda.parrafo}
              </Typography>
              <Box component={Link} to="/agenda" sx={enlaceBloque}>
                {textos.agenda.enlace} <ArrowForwardIcon />
              </Box>
              {stream && (
                <Box sx={{ mt: 4 }}>
                  <AvisoDirecto url={stream} titulo={textos.agenda.directoTitulo} texto={textos.agenda.directoTexto} />
                </Box>
              )}
            </Revela>
          </Box>

          {/* La tarjeta de papel es el objeto del bloque: crece al posarse. */}
          <Revela efecto="crecer" orden={2}>
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
                <MiniCalendario
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
                {listaCargando || listaFallo ? (
                  <EnCarga papel estado={listaFallo ? 'error' : 'cargando'} que="la agenda" alReintentar={reintentar} esqueleto={<ListaDeAgendaEsqueleto />} />
                ) : eventos.length === 0 ? (
                  <Box sx={{ p: { xs: 2, sm: 3 } }}>
                    <AvisosDeInicio
                      claro
                      mensaje={`No hay actos publicados para ${nombreDelMes(mes, false).toLowerCase()} ni ${nombreDelMes(sumarMeses(mes, 1), false).toLowerCase()}. Publicaremos aquí los nuevos encuentros.`}
                    />
                  </Box>
                ) : (
                  <ListaDeAgenda eventos={eventos} abiertoId={abiertoId} hoy={hoy} onAlternar={alternar} />
                )}
              </Box>
            </AlturaSostenida>
          </Revela>
        </Box>
      </ContenedorDePagina>
    </SeccionAnimada>
  )
}
