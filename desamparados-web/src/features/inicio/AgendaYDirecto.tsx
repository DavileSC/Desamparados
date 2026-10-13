import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box, Typography, type SxProps, type Theme } from '@mui/material'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import ContenedorDePagina from '../../components/ContenedorDePagina'
import SeccionAnimada, { Revela } from '../../components/SeccionAnimada'
import { eventosDelCalendario, type EventoCalendario } from '../../lib/api/agenda'
import { useTextosPortada } from './useContenidoPortada'
import TextoDePortada from './TextoDePortada'
import AvisosDeInicio from './AvisosDeInicio'
import MiniCalendario from './MiniCalendario'
import ListaDeAgenda, { ListaDeAgendaEsqueleto } from './ListaDeAgenda'
import EnCarga from '../../components/esqueleto/EnCarga'
import { inicioDeMes, inicioDelDia, nombreDelMes, sumarMeses } from './agenda'
import { PAPEL, SERIF, TINTA, ceja, enlaceBloque } from './estilos'
import { propsDeFoto } from '../../lib/fotoSubida'
import { useModulos } from '../../hooks/useModulos'

// El tope por página del servidor: sobra para dos meses de actos.
const ACTOS_POR_VENTANA = 100

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
  const { activos, activo } = useModulos()
  // La sección es la agenda: sin ella no se pinta ni se pide nada.
  // La lista llega en milisegundos y en esta instalación todo está encendido: mejor un
  // esqueleto mientras no se sabe que un hueco que luego crece.
  const apagado = activos !== null && !activo('agenda')
  const hoy = inicioDelDia(new Date())
  const [mesElegido, setMesElegido] = useState<Date | null>(null)
  // undefined: nadie ha tocado nada y se abre el próximo acto; null: el visitante lo ha cerrado.
  const [abierto, setAbierto] = useState<string | null | undefined>(undefined)

  // Una sola petición para lo primero que se ve: los próximos actos desde hoy.
  // El primero dice en qué mes se abre el calendario (así nunca arranca en un
  // mes vacío), y la ventana de ese mes y el siguiente es el principio de esa
  // misma lista: van en orden y con el mismo tope. Antes eran dos peticiones
  // en cadena tras la de los módulos; ahora la otra solo sale al cambiar de mes.
  const proximo = useQuery({
    queryKey: ['home', 'agenda', 'proximos', hoy.getTime()],
    queryFn: () => eventosDelCalendario({ desde: hoy, cuantos: ACTOS_POR_VENTANA }),
    enabled: activos !== null && activo('agenda'),
    retry: false,
    staleTime: 60_000,
  })
  const mesInicial = inicioDeMes(proximo.data?.[0]?.start ?? hoy)
  const mes = mesElegido ?? mesInicial
  const iniciales = (proximo.data ?? []).filter((e) => e.start < sumarMeses(mesInicial, 2))

  // Otro mes: la ventana es el mes visible y el siguiente, desde hoy (los actos pasados no se enseñan).
  const ventana = useQuery({
    queryKey: ['home', 'agenda', mes.getTime()],
    queryFn: () => eventosDelCalendario({
      desde: mes.getTime() > hoy.getTime() ? mes : hoy,
      hasta: sumarMeses(mes, 2),
      cuantos: ACTOS_POR_VENTANA,
    }),
    enabled: proximo.isSuccess && mesElegido !== null,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 60_000,
  })

  // Mientras llega la del mes elegido, se queda a la vista la de antes.
  const eventos = mesElegido === null ? iniciales : ventana.data ?? iniciales
  const abiertoId = abierto === undefined ? eventos[0]?.id ?? null : abierto

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
  // Al cambiar de mes no se vuelve al esqueleto: se queda lo de antes, velado, hasta que llega.
  const listaCargando = proximo.isPending || reintentando
  const otroMesLlegando = mesElegido !== null && (ventana.isPending || ventana.isPlaceholderData)
  const listaFallo = !listaCargando && (proximo.isError || ventana.isError)
  const reintentar = () => { void (proximo.isError ? proximo.refetch() : ventana.refetch()) }

  if (apagado) return null

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
        // Un <img> y no un fondo por CSS: así lleva las copias de 640 y 1280.
        // Desenfocada y velada, con media ventana de ancho basta.
        <Box
          component="img"
          alt=""
          aria-hidden="true"
          {...propsDeFoto(textos.agenda.imagenUrl, '50vw')}
          sx={{
            position: 'absolute',
            top: '-16px',
            left: '-16px',
            width: 'calc(100% + 32px)',
            height: 'calc(100% + 32px)',
            maxWidth: 'none',
            zIndex: -2,
            objectFit: 'cover',
            objectPosition: 'center 55%',
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
              <Typography component="span" sx={ceja}><TextoDePortada anchos={['5em']}>{textos.agenda.ceja}</TextoDePortada></Typography>
            </Revela>
            <Revela efecto="cortina" orden={1}>
              <Typography id="agenda-title" variant="h2" component="h2" sx={{ fontFamily: SERIF, color: '#fff', m: 0 }}>
                <TextoDePortada anchos={['7em']}>{textos.agenda.titulo}</TextoDePortada>
              </Typography>
            </Revela>
            <Revela orden={2}>
              <Typography sx={{ mt: 2.75, mb: 3.5, maxWidth: 420, fontSize: 15, lineHeight: 1.7, color: '#e4e2df' }}>
                <TextoDePortada anchos={['26em', '22em', '12em']}>{textos.agenda.parrafo}</TextoDePortada>
              </Typography>
              <Box component={Link} to="/agenda" sx={enlaceBloque}>
                <TextoDePortada anchos={['9em']}>{textos.agenda.enlace}</TextoDePortada> <ArrowForwardIcon />
              </Box>
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
              <Box sx={{ minWidth: 0, opacity: otroMesLlegando ? 0.6 : 1, transition: 'opacity .2s ease' }}>
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
