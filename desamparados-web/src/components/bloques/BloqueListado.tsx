import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Alert, Box, Button, CircularProgress, Grid } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import TituloDeSeccion from '../TituloDeSeccion'
import TarjetaNoticia from '../TarjetaNoticia'
import TarjetaEvento from '../TarjetaEvento'
import TarjetaPublicacion from '../TarjetaPublicacion'
import Paginador from '../Paginador'
import { noticiasDePortada, archivoDeNoticias } from '../../lib/api/noticias'
import { traerProximosEventos, eventosPublicos } from '../../lib/api/agenda'
import { useListadoPaginado, type Pagina } from '../../hooks/useListadoPaginado'
import { usePublicacionesPaginadas } from '../../features/publicaciones/usePublicacionesPaginadas'
import type { EventItem, NewsItem } from '../../types'
import type { BloqueListado as Datos, FuenteListado } from '../../lib/api/contenido'

/**
 * Lo que el Grupo Parroquial publica desde otras pantallas del CMS —noticias,
 * actos de la agenda, publicaciones—, pintado donde se ponga el bloque.
 *
 * El bloque solo sabe de dónde sale la lista (`fuente`); los elementos se piden
 * al abrir la página, igual que los pedían las pantallas de Actualidad y
 * Publicaciones cuando eran componentes escritos a mano. Lo que se pinta con
 * cada fuente es lo mismo que pintaban ellas.
 *
 * Este bloque pinta su propio título (ver `pintaSuTitulo` en `registro.tsx`):
 * los listados cortos llevan a su lado el enlace al listado entero, como antes.
 *
 * Los paginados llevan la página en la dirección (`?pagina=`): dos en la misma
 * página compartirían paginador. El CMS no lo impide porque no hay ninguna
 * página que lo pida, y no es un fallo sino una rareza visible.
 */
export default function BloqueListado({ bloque }: { bloque: Datos }) {
  const Listado = LISTADOS[bloque.fuente]
  // Una fuente que esta versión de la web no conoce (un documento guardado por
  // una versión más nueva) no pinta nada, como un tipo de bloque desconocido.
  if (!Listado) return null
  return <Listado titulo={bloque.titulo} />
}

type PropsListado = { titulo: string }

const LISTADOS: Record<FuenteListado, (props: PropsListado) => ReactNode> = {
  'noticias-recientes': NoticiasRecientes,
  'agenda-proxima': AgendaProxima,
  noticias: ArchivoDeNoticias,
  agenda: Agenda,
  publicaciones: ({ titulo }) => (
    <Publicaciones titulo={titulo} etiqueta="publicaciones"
      vacio="No hay publicaciones disponibles." fallo="No se han podido cargar las publicaciones." />
  ),
  boletines: ({ titulo }) => (
    <Publicaciones titulo={titulo} categoria="boletin" etiqueta="boletines"
      vacio="No hay boletines disponibles." fallo="No se han podido cargar los boletines." />
  ),
  dossier: ({ titulo }) => (
    <Publicaciones titulo={titulo} categoria="dossier" etiqueta="dossieres de prensa"
      vacio="No hay dossieres disponibles." fallo="No se han podido cargar los dossieres." />
  ),
}

/**
 * Título del bloque, con el enlace al listado entero si lo hay. Sin título, el
 * enlace va solo y a la derecha: un `TituloDeSeccion` vacío dejaría un encabezado
 * sin texto, que un lector de pantalla anuncia igual.
 */
function Encabezado({ titulo, enlace }: { titulo: string; enlace?: { texto: string; ruta: string } }) {
  if (titulo) return <TituloDeSeccion title={titulo} actionLabel={enlace?.texto} actionHref={enlace?.ruta} />
  if (!enlace) return null
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
      <Button component={Link} to={enlace.ruta} endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
        sx={{ color: 'secondary.main', typography: 'overline', fontSize: '12px', minHeight: 44, px: 0 }}>
        {enlace.texto}
      </Button>
    </Box>
  )
}

const rejillaDeNoticias = {
  listStyle: 'none', m: 0, p: 0, display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
  gap: { xs: 3, md: 3.25 },
} as const

/**
 * Carga de una sola vez, sin paginar: los listados cortos de Actualidad.
 * `pedir` va fuera de los componentes para que no cambie en cada render.
 */
function useCargaUnica<T>(pedir: () => Promise<T[]>, mensajeError: string) {
  const [items, setItems] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    pedir()
      .then((datos) => { if (!cancelado) setItems(datos) })
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : mensajeError) })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [pedir, mensajeError])

  return { items, loading, error }
}

// Tres noticias: las tarjetas van de tres en tres, como en la portada y el archivo.
const pedirRecientes = () => noticiasDePortada(3)
const pedirProximos = () => traerProximosEventos(4)

function NoticiasRecientes({ titulo }: PropsListado) {
  const { items, loading, error } = useCargaUnica<NewsItem>(pedirRecientes, 'No se han podido cargar las noticias.')
  return (
    <>
      <Encabezado titulo={titulo} enlace={{ texto: 'Ver todas las noticias', ruta: '/actualidad/noticias' }} />
      {loading && <CircularProgress aria-label="Cargando noticias" />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && items.length === 0 && <Alert severity="info">No hay noticias publicadas.</Alert>}
      {!loading && !error && items.length > 0 && (
        <Box component="ul" aria-label={titulo || 'Últimas noticias'} sx={rejillaDeNoticias}>
          {items.map((noticia, i) => (
            <Box component="li" key={noticia.id} sx={{ display: 'flex' }}>
              <TarjetaNoticia news={noticia} indice={i} />
            </Box>
          ))}
        </Box>
      )}
    </>
  )
}

function AgendaProxima({ titulo }: PropsListado) {
  const { items, loading, error } = useCargaUnica<EventItem>(pedirProximos, 'No se ha podido cargar la agenda.')
  return (
    <>
      <Encabezado titulo={titulo} enlace={{ texto: 'Ver agenda completa', ruta: '/actualidad/agenda' }} />
      <ListaDeEventos eventos={items} loading={loading} error={error} />
    </>
  )
}

function ListaDeEventos({ eventos, loading, error }: { eventos: EventItem[]; loading: boolean; error: string | null }) {
  return (
    <>
      {loading && <CircularProgress aria-label="Cargando agenda" />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && eventos.length === 0 && <Alert severity="info">No hay próximos eventos publicados.</Alert>}
      {!loading && !error && eventos.length > 0 && (
        <Grid container spacing={4}>
          {eventos.map((evento) => (
            <Grid key={evento.id} size={{ xs: 12, md: 6 }}>
              <TarjetaEvento event={evento} />
            </Grid>
          ))}
        </Grid>
      )}
    </>
  )
}

// Fuera del componente para que no cambie de identidad en cada render: el hook
// la lleva en las dependencias de su efecto. El listado habla en `data`; la
// agenda devuelve `eventos` porque el CMS necesita el evento crudo.
const pedirAgenda = (pagina: Pagina) =>
  eventosPublicos(pagina).then(({ eventos, meta }) => ({ data: eventos, meta }))

function Agenda({ titulo }: PropsListado) {
  const { items, meta, loading, error, alCambiarPagina } =
    useListadoPaginado(pedirAgenda, 'No se ha podido cargar la agenda.')
  return (
    <>
      <Encabezado titulo={titulo} />
      <ListaDeEventos eventos={items} loading={loading} error={error} />
      {meta && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Paginador meta={meta} onPagina={alCambiarPagina} etiqueta="la agenda" />
        </Box>
      )}
    </>
  )
}

// Igual que `pedirAgenda`: el archivo de noticias devuelve `noticias` porque el
// CMS necesita la noticia cruda.
const pedirNoticias = (pagina: Pagina) =>
  archivoDeNoticias(pagina).then(({ noticias, meta }) => ({ data: noticias, meta }))

// El tono de las placas sin foto va por el índice, módulo 3, y la rejilla tiene
// tres columnas: con el índice tal cual, cada columna repetía color fila tras
// fila. Sumando la fila, los tonos corren en diagonal y no se tocan ni en
// horizontal ni en vertical.
const indiceEnDiagonal = (posicion: number) => posicion + Math.floor(posicion / 3)
// La placa de la destacada queda encima de las dos primeras columnas: la
// «piedra» (2) no coincide con ninguna de las dos tarjetas de debajo.
const INDICE_DESTACADA = 2

function ArchivoDeNoticias({ titulo }: PropsListado) {
  const { items, meta, loading, error, alCambiarPagina } =
    useListadoPaginado(pedirNoticias, 'No se han podido cargar las noticias.')
  // La página en la que está el visitante viaja con cada tarjeta: al volver
  // desde la ficha de una noticia aterriza donde estaba, no en la primera.
  const { search: consultaArchivo } = useLocation()
  // Solo la primera de la primera página es la última noticia publicada; en la
  // página 3, destacar la primera sería destacar una cualquiera.
  const hayDestacada = meta?.page === 1

  return (
    <>
      <Encabezado titulo={titulo} />
      {loading && <CircularProgress aria-label="Cargando noticias" />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && items.length === 0 && <Alert severity="info">No hay noticias publicadas.</Alert>}
      {!loading && !error && items.length > 0 && (
        <Box component="ul" aria-label={titulo || 'Noticias'} sx={rejillaDeNoticias}>
          {items.map((noticia, i) => {
            const destacada = hayDestacada && i === 0
            return (
              <Box component="li" key={noticia.id} sx={{ display: 'flex', gridColumn: destacada ? '1 / -1' : undefined }}>
                <TarjetaNoticia news={noticia} indice={destacada ? INDICE_DESTACADA : indiceEnDiagonal(hayDestacada ? i - 1 : i)} destacada={destacada} volver={consultaArchivo} />
              </Box>
            )
          })}
        </Box>
      )}
      {meta && <Paginador meta={meta} onPagina={alCambiarPagina} etiqueta="noticias" />}
    </>
  )
}

function Publicaciones({ titulo, categoria, etiqueta, vacio, fallo }: PropsListado & {
  categoria?: 'boletin' | 'dossier'
  /** Lo que se pagina: para el paginador y el aviso de carga. */
  etiqueta: string
  vacio: string
  fallo: string
}) {
  const { items, meta, loading, error, alCambiarPagina } = usePublicacionesPaginadas(categoria, fallo)
  return (
    <>
      <Encabezado titulo={titulo} />
      {loading && <CircularProgress aria-label={`Cargando ${etiqueta}`} />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && items.length === 0 && <Alert severity="info">{vacio}</Alert>}
      <Grid container spacing={3}>
        {items.map((publicacion) => (
          <Grid key={publicacion.id} size={{ xs: 12, sm: 6, lg: 3 }}>
            <TarjetaPublicacion publication={publicacion} />
          </Grid>
        ))}
      </Grid>
      {meta && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Paginador meta={meta} onPagina={alCambiarPagina} etiqueta={etiqueta} />
        </Box>
      )}
    </>
  )
}
