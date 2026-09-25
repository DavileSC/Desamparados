import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Alert, Box, Button, CircularProgress, Grid, Typography } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import TituloDeSeccion from '../TituloDeSeccion'
import TarjetaNoticia from '../TarjetaNoticia'
import TarjetaEvento from '../TarjetaEvento'
import TarjetaPublicacion from '../TarjetaPublicacion'
import Paginador from '../Paginador'
import { noticiasDePortada, archivoDeNoticias } from '../../lib/api/noticias'
import { traerProximosEventos } from '../../lib/api/agenda'
import AgendaDeCultos from '../../features/actualidad/agenda/AgendaDeCultos'
import { useListadoPaginado, type Pagina } from '../../hooks/useListadoPaginado'
import { usePublicacionesPaginadas } from '../../features/publicaciones/usePublicacionesPaginadas'
import type { Acto, Noticia } from '../../types'
import type { BloqueListado as Datos, FuenteListado } from '../../lib/api/contenido'
import { valorDe } from './presentacion'

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
  return <Listado titulo={bloque.titulo} bloque={bloque} />
}

/**
 * Lo que recibe cada listado: su título y el bloque, del que lee su
 * presentación (cuántos, en tarjetas o en lista, cuántas columnas).
 */
type PropsListado = { titulo: string; bloque: Datos }

/** Cuántos elementos enseña un listado corto: los de siempre (`auto`) o los que diga. */
const cantidadDe = (bloque: Datos, siempre: number) => {
  const valor = valorDe(bloque, 'cantidad')
  return valor === 'auto' ? siempre : Number(valor)
}

/** Las columnas de una rejilla en escritorio: las de siempre (`auto`) o las que diga. */
const columnasDe = (bloque: Datos, siempre: number) => {
  const valor = valorDe(bloque, 'columnas')
  return valor === 'auto' ? siempre : Number(valor)
}

const enLista = (bloque: Datos) => valorDe(bloque, 'disposicion') === 'lista'

const LISTADOS: Record<FuenteListado, (props: PropsListado) => ReactNode> = {
  'noticias-recientes': NoticiasRecientes,
  'agenda-proxima': AgendaProxima,
  noticias: ArchivoDeNoticias,
  agenda: Agenda,
  publicaciones: ({ titulo, bloque }) => (
    <Publicaciones titulo={titulo} bloque={bloque} etiqueta="publicaciones"
      vacio="No hay publicaciones disponibles." fallo="No se han podido cargar las publicaciones." />
  ),
  boletines: ({ titulo, bloque }) => (
    <Publicaciones titulo={titulo} bloque={bloque} categoria="boletin" etiqueta="boletines"
      vacio="No hay boletines disponibles." fallo="No se han podido cargar los boletines." />
  ),
  dossier: ({ titulo, bloque }) => (
    <Publicaciones titulo={titulo} bloque={bloque} categoria="dossier" etiqueta="dossieres de prensa"
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

const rejillaDeNoticias = (columnas = 3) => ({
  listStyle: 'none', m: 0, p: 0, display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: `repeat(${columnas}, 1fr)` },
  gap: { xs: 3, md: 3.25 },
}) as const

/** «3 oct 2026», como en las tarjetas de noticia. */
const fechaDeLista = (iso: string) => {
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return iso
  return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface FilaDeLista { clave: string; fecha: string; texto: string; ruta?: string; detalle?: string }

/**
 * Un listado en lista y no en tarjetas: una línea por elemento, con la fecha
 * a un lado. Ocupa mucho menos y cabe bien entre otros bloques.
 */
function ListaSencilla({ etiqueta, filas }: { etiqueta: string; filas: FilaDeLista[] }) {
  return (
    <Box component="ul" aria-label={etiqueta} sx={{ listStyle: 'none', m: 0, p: 0, maxWidth: 850, mx: 'auto' }}>
      {filas.map((fila, i) => {
        const texto = (
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: 'text.primary', fontWeight: 600 }}>{fila.texto}</Typography>
            {fila.detalle && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{fila.detalle}</Typography>}
          </Box>
        )
        return (
          <Box component="li" key={fila.clave}
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '140px minmax(0, 1fr)' }, columnGap: 3, rowGap: 0.5, py: 1.75, borderTop: i === 0 ? 0 : '1px solid', borderColor: 'divider' }}>
            <Typography component="span" sx={{ color: 'secondary.main', fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', pt: '3px' }}>
              {fila.fecha}
            </Typography>
            {fila.ruta
              ? <Box component={Link} to={fila.ruta} sx={{ textDecoration: 'none', color: 'inherit', '&:hover p:first-of-type': { color: 'secondary.main' } }}>{texto}</Box>
              : texto}
          </Box>
        )
      })}
    </Box>
  )
}

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

// De siempre, tres noticias (las tarjetas van de tres en tres, como en la
// portada y el archivo) y cuatro actos a dos columnas.
function NoticiasRecientes({ titulo, bloque }: PropsListado) {
  const cuantas = cantidadDe(bloque, 3)
  const pedir = useCallback(() => noticiasDePortada(cuantas), [cuantas])
  const { items, loading, error } = useCargaUnica<Noticia>(pedir, 'No se han podido cargar las noticias.')
  return (
    <>
      <Encabezado titulo={titulo} enlace={{ texto: 'Ver todas las noticias', ruta: '/noticias' }} />
      {loading && <CircularProgress aria-label="Cargando noticias" />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && items.length === 0 && <Alert severity="info">No hay noticias publicadas.</Alert>}
      {!loading && !error && items.length > 0 && enLista(bloque) && (
        <ListaSencilla etiqueta={titulo || 'Últimas noticias'}
          filas={items.map((n) => ({ clave: n.id, fecha: fechaDeLista(n.fecha), texto: n.titulo, detalle: n.extracto, ruta: `/noticias/${n.slug}` }))} />
      )}
      {!loading && !error && items.length > 0 && !enLista(bloque) && (
        <Box component="ul" aria-label={titulo || 'Últimas noticias'} sx={rejillaDeNoticias(columnasDe(bloque, 3))}>
          {items.map((noticia, i) => (
            <Box component="li" key={noticia.id} sx={{ display: 'flex' }}>
              <TarjetaNoticia noticia={noticia} indice={i} />
            </Box>
          ))}
        </Box>
      )}
    </>
  )
}

function AgendaProxima({ titulo, bloque }: PropsListado) {
  const cuantos = cantidadDe(bloque, 4)
  const pedir = useCallback(() => traerProximosEventos(cuantos), [cuantos])
  const { items, loading, error } = useCargaUnica<Acto>(pedir, 'No se ha podido cargar la agenda.')
  const lista = enLista(bloque) && !loading && !error && items.length > 0
  return (
    <>
      <Encabezado titulo={titulo} enlace={{ texto: 'Ver agenda completa', ruta: '/agenda' }} />
      {lista
        ? <ListaSencilla etiqueta={titulo || 'Próximos actos'}
            filas={items.map((a) => ({ clave: a.id, fecha: a.fecha, texto: a.titulo, detalle: [a.hora, a.lugar].filter(Boolean).join(' · ') }))} />
        : <ListaDeEventos eventos={items} loading={loading} error={error} columnas={columnasDe(bloque, 2)} />}
    </>
  )
}

function ListaDeEventos({ eventos, loading, error, columnas }: { eventos: Acto[]; loading: boolean; error: string | null; columnas: number }) {
  return (
    <>
      {loading && <CircularProgress aria-label="Cargando agenda" />}
      {error && <Alert severity="error">{error}</Alert>}
      {!loading && !error && eventos.length === 0 && <Alert severity="info">No hay próximos eventos publicados.</Alert>}
      {!loading && !error && eventos.length > 0 && (
        <Grid container spacing={4}>
          {eventos.map((evento) => (
            <Grid key={evento.id} size={{ xs: 12, md: 12 / columnas }}>
              <TarjetaEvento acto={evento} />
            </Grid>
          ))}
        </Grid>
      )}
    </>
  )
}

/**
 * La agenda entera, con los cultos solemnes en su cartel (AgendaDeCultos):
 * sin paginar, porque un curso cabe en una página.
 */
function Agenda({ titulo }: PropsListado) {
  return (
    <>
      <Encabezado titulo={titulo} />
      <AgendaDeCultos />
    </>
  )
}

// El archivo de noticias devuelve `noticias` porque el CMS necesita la noticia
// cruda; el listado habla en `data`.
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

function ArchivoDeNoticias({ titulo, bloque }: PropsListado) {
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
        <Box component="ul" aria-label={titulo || 'Noticias'} sx={rejillaDeNoticias(columnasDe(bloque, 3))}>
          {items.map((noticia, i) => {
            const destacada = hayDestacada && i === 0
            return (
              <Box component="li" key={noticia.id} sx={{ display: 'flex', gridColumn: destacada ? '1 / -1' : undefined }}>
                <TarjetaNoticia noticia={noticia} indice={destacada ? INDICE_DESTACADA : indiceEnDiagonal(hayDestacada ? i - 1 : i)} destacada={destacada} volver={consultaArchivo} />
              </Box>
            )
          })}
        </Box>
      )}
      {meta && <Paginador meta={meta} onPagina={alCambiarPagina} etiqueta="noticias" />}
    </>
  )
}

function Publicaciones({ titulo, bloque, categoria, etiqueta, vacio, fallo }: PropsListado & {
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
          <Grid key={publicacion.id} size={{ xs: 12, sm: 6, lg: 12 / columnasDe(bloque, 4) }}>
            <TarjetaPublicacion publicacion={publicacion} />
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
