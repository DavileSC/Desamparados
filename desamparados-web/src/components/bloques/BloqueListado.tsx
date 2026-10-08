import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Alert, Box, Button, Grid, Typography } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import TituloDeSeccion from '../TituloDeSeccion'
import TarjetaNoticia, { TarjetaNoticiaEsqueleto } from '../TarjetaNoticia'
import TarjetaEvento, { TarjetaEventoEsqueleto } from '../TarjetaEvento'
import TarjetaPublicacion, { TarjetaPublicacionEsqueleto } from '../TarjetaPublicacion'
import EnCarga from '../esqueleto/EnCarga'
import { Lineas } from '../esqueleto/Hueso'
import Paginador from '../Paginador'
import { noticiasDePortada, archivoDeNoticias, CLAVE_ARCHIVO_DE_NOTICIAS } from '../../lib/api/noticias'
import { traerProximosEventos } from '../../lib/api/agenda'
import AgendaDeCultos, { SuscribirseALaAgenda } from '../../features/actualidad/agenda/AgendaDeCultos'
import { type Pagina } from '../../hooks/useListadoPaginado'
import { useCargarMas } from '../../hooks/useCargarMas'
import { usePublicacionesPaginadas } from '../../features/publicaciones/usePublicacionesPaginadas'
import type { Acto, Noticia } from '../../types'
import type { BloqueListado as Datos, FuenteListado } from '../../lib/api/contenido'
import { valorDe } from './presentacion'
import { BOTON, enlaceConFlecha } from '../estiloDeBoton'
import AvisoSuave from '../AvisoSuave'

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
 * Los paginados llevan la página en la dirección (`?pagina=`), y el archivo de
 * noticias cuántas enseña (`?mostrar=`): dos en la misma página compartirían
 * paginador. El CMS no lo impide porque no hay ninguna página que lo pida, y
 * no es un fallo sino una rareza visible.
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
    <Publicaciones titulo={titulo} bloque={bloque} etiqueta="publicaciones" que="las publicaciones"
      vacio="No hay publicaciones disponibles." fallo="No se han podido cargar las publicaciones." />
  ),
  boletines: ({ titulo, bloque }) => (
    <Publicaciones titulo={titulo} bloque={bloque} categoria="boletin" etiqueta="boletines" que="los boletines"
      vacio="No hay boletines disponibles." fallo="No se han podido cargar los boletines." />
  ),
  dossier: ({ titulo, bloque }) => (
    <Publicaciones titulo={titulo} bloque={bloque} categoria="dossier" etiqueta="dossieres de prensa" que="los dossieres de prensa"
      vacio="No hay dossieres disponibles." fallo="No se han podido cargar los dossieres." />
  ),
}

/**
 * Título del bloque, con el enlace al listado entero si lo hay. Sin título, el
 * enlace va solo y a la derecha: un `TituloDeSeccion` vacío dejaría un encabezado
 * sin texto, que un lector de pantalla anuncia igual.
 */
function Encabezado({ titulo, enlace, accion }: { titulo: string; enlace?: { texto: string; ruta: string }; accion?: ReactNode }) {
  if (titulo) return <TituloDeSeccion title={titulo} actionLabel={enlace?.texto} actionHref={enlace?.ruta} accion={accion} />
  if (accion) return <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>{accion}</Box>
  if (!enlace) return null
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
      <Box component={Link} to={enlace.ruta} sx={enlaceConFlecha}>
        {enlace.texto} <ArrowForwardIcon aria-hidden />
      </Box>
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

/** Una fila de la lista: la fecha a un lado y el texto al otro. La comparten la lista y su esqueleto. */
const filaDeListaSx = (i: number) => ({
  display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '140px minmax(0, 1fr)' }, columnGap: 3, rowGap: 0.5,
  py: 1.75, borderTop: i === 0 ? 0 : '1px solid', borderColor: 'divider',
}) as const
const listaSx = { listStyle: 'none', m: 0, p: 0, maxWidth: 850, mx: 'auto' } as const

interface FilaDeLista { clave: string; fecha: string; texto: string; ruta?: string; detalle?: string }

/**
 * Un listado en lista y no en tarjetas: una línea por elemento, con la fecha
 * a un lado. Ocupa mucho menos y cabe bien entre otros bloques.
 */
function ListaSencilla({ etiqueta, filas }: { etiqueta: string; filas: FilaDeLista[] }) {
  return (
    <Box component="ul" aria-label={etiqueta} sx={listaSx}>
      {filas.map((fila, i) => {
        const texto = (
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ color: 'text.primary', fontWeight: 600 }}>{fila.texto}</Typography>
            {fila.detalle && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{fila.detalle}</Typography>}
          </Box>
        )
        return (
          <Box component="li" key={fila.clave} sx={filaDeListaSx(i)}>
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

/** La lista sencilla mientras llega: `filas` filas con la fecha y el texto en huesos. */
function ListaSencillaEsqueleto({ filas }: { filas: number }) {
  return (
    <Box sx={listaSx}>
      {Array.from({ length: filas }, (_, i) => (
        <Box key={i} sx={filaDeListaSx(i)}>
          <Box sx={{ pt: '3px' }}><Lineas anchos={['90px']} linea={20} grosor={9} /></Box>
          <Box>
            <Lineas anchos={[`${78 - (i % 3) * 10}%`]} linea={24} grosor={12} />
            <Lineas anchos={['52%']} linea={20} grosor={9} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

/** Las tarjetas de noticia mientras llegan, en la misma rejilla. */
function RejillaDeNoticiasEsqueleto({ cuantas, columnas }: { cuantas: number; columnas: number }) {
  return (
    <Box sx={rejillaDeNoticias(columnas)}>
      {Array.from({ length: cuantas }, (_, i) => <Box key={i} sx={{ display: 'flex' }}><TarjetaNoticiaEsqueleto /></Box>)}
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
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let cancelado = false
    pedir()
      .then((datos) => { if (!cancelado) setItems(datos) })
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : mensajeError) })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [pedir, mensajeError, intento])

  const reintentar = () => {
    setError(null)
    setLoading(true)
    setIntento((n) => n + 1)
  }

  return { items, loading, error, reintentar }
}

// De siempre, tres noticias (las tarjetas van de tres en tres, como en la
// portada y el archivo) y cuatro actos a dos columnas.
function NoticiasRecientes({ titulo, bloque }: PropsListado) {
  const cuantas = cantidadDe(bloque, 3)
  const pedir = useCallback(() => noticiasDePortada(cuantas), [cuantas])
  const { items, loading, error, reintentar } = useCargaUnica<Noticia>(pedir, 'No se han podido cargar las noticias.')
  return (
    <>
      <Encabezado titulo={titulo} enlace={{ texto: 'Ver todas las noticias', ruta: '/noticias' }} />
      {(loading || error) && (
        <EnCarga
          estado={loading ? 'cargando' : 'error'}
          que="las noticias"
          alReintentar={reintentar}
          esqueleto={enLista(bloque) ? <ListaSencillaEsqueleto filas={cuantas} /> : <RejillaDeNoticiasEsqueleto cuantas={cuantas} columnas={columnasDe(bloque, 3)} />}
        />
      )}
      {!loading && !error && items.length === 0 && <AvisoSuave>No hay noticias publicadas.</AvisoSuave>}
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
  const { items, loading, error, reintentar } = useCargaUnica<Acto>(pedir, 'No se ha podido cargar la agenda.')
  const columnas = columnasDe(bloque, 2)
  if (loading || error) {
    return (
      <>
        <Encabezado titulo={titulo} enlace={{ texto: 'Ver agenda completa', ruta: '/agenda' }} />
        <EnCarga
          estado={loading ? 'cargando' : 'error'}
          que="la agenda"
          alReintentar={reintentar}
          esqueleto={enLista(bloque)
            ? <ListaSencillaEsqueleto filas={cuantos} />
            : (
              <Grid container spacing={4}>
                {Array.from({ length: cuantos }, (_, i) => <Grid key={i} size={{ xs: 12, md: 12 / columnas }}><TarjetaEventoEsqueleto /></Grid>)}
              </Grid>
            )}
        />
      </>
    )
  }
  const lista = enLista(bloque) && items.length > 0
  return (
    <>
      <Encabezado titulo={titulo} enlace={{ texto: 'Ver agenda completa', ruta: '/agenda' }} />
      {lista
        ? <ListaSencilla etiqueta={titulo || 'Próximos actos'}
            filas={items.map((a) => ({ clave: a.id, fecha: a.fecha, texto: a.titulo, detalle: [a.hora, a.lugar].filter(Boolean).join(' · ') }))} />
        : <ListaDeEventos eventos={items} columnas={columnas} />}
    </>
  )
}

function ListaDeEventos({ eventos, columnas }: { eventos: Acto[]; columnas: number }) {
  return (
    <>
      {eventos.length === 0 && <AvisoSuave>No hay próximos eventos publicados.</AvisoSuave>}
      {eventos.length > 0 && (
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
 * La agenda entera, en su calendario de pared (AgendaDeCultos): sin paginar,
 * porque un curso cabe en una página. La suscripción va junto al título, a la
 * vista nada más entrar.
 */
function Agenda({ titulo }: PropsListado) {
  return (
    <>
      <Encabezado titulo={titulo} accion={<SuscribirseALaAgenda />} />
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
// «piedra» (2) no coincide con ninguna de las dos tarjetas de debajo. La
// destacada es siempre la primera: con «Cargar más» no hay otras páginas.
const INDICE_DESTACADA = 2

/** La primera carga: la destacada y tres filas de tres. */
const PRIMERA_CARGA = 10
/** Cada «Cargar más»: tres filas más. */
const LOTE = 9

/**
 * El archivo de noticias: la última destacada a lo ancho y el resto en
 * tarjetas, con «Cargar más» al pie en vez de paginador. Las nuevas se añaden
 * debajo, sin mover lo que ya se estaba viendo.
 */
function ArchivoDeNoticias({ titulo, bloque }: PropsListado) {
  const { items, loading, cargandoMas, hayMas, error, cargarMas } =
    useCargarMas(CLAVE_ARCHIVO_DE_NOTICIAS, pedirNoticias, 'No se han podido cargar las noticias.', { primera: PRIMERA_CARGA, lote: LOTE })
  // Cuántas hay a la vista viaja con cada tarjeta: al volver desde la ficha de
  // una noticia la dirección pide las mismas, y la caché ya las tiene.
  const { search: consultaArchivo } = useLocation()

  return (
    <>
      <Encabezado titulo={titulo} />
      {items.length === 0 && (loading || error) && (
        <EnCarga
          // Tras un fallo sin ninguna noticia a la vista, «Volver a intentar» pide lo mismo.
          estado={loading || cargandoMas ? 'cargando' : 'error'}
          que="las noticias"
          alReintentar={cargarMas}
          esqueleto={(
            <Box sx={rejillaDeNoticias(columnasDe(bloque, 3))}>
              <Box sx={{ display: 'flex', gridColumn: '1 / -1' }}><TarjetaNoticiaEsqueleto destacada /></Box>
              {Array.from({ length: 3 }, (_, i) => <Box key={i} sx={{ display: 'flex' }}><TarjetaNoticiaEsqueleto /></Box>)}
            </Box>
          )}
        />
      )}
      {!loading && !error && items.length === 0 && <AvisoSuave>No hay noticias publicadas.</AvisoSuave>}
      {items.length > 0 && (
        <Box component="ul" aria-label={titulo || 'Noticias'} sx={rejillaDeNoticias(columnasDe(bloque, 3))}>
          {items.map((noticia, i) => {
            const destacada = i === 0
            return (
              <Box component="li" key={noticia.id} sx={{ display: 'flex', gridColumn: destacada ? '1 / -1' : undefined }}>
                <TarjetaNoticia noticia={noticia} indice={destacada ? INDICE_DESTACADA : indiceEnDiagonal(i - 1)} destacada={destacada} volver={consultaArchivo} />
              </Box>
            )
          })}
        </Box>
      )}
      {items.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: { xs: 5, md: 6 } }}>
          {error && <Alert severity="error">{error}</Alert>}
          {hayMas && (
            <Button onClick={cargarMas} disabled={cargandoMas} sx={{ ...BOTON.claro, minWidth: 220 }}>
              {cargandoMas ? 'Cargando…' : error ? 'Volver a intentarlo' : 'Cargar más noticias'}
            </Button>
          )}
          {/* Para el lector de pantalla: cuántas hay ya, al llegar las nuevas. */}
          <Box role="status" sx={visualmenteOculto}>
            {cargandoMas ? '' : `${items.length} noticias a la vista${hayMas ? '' : ', todas'}.`}
          </Box>
        </Box>
      )}
    </>
  )
}

const visualmenteOculto = {
  position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: 0, border: 0,
  overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
} as const

function Publicaciones({ titulo, bloque, categoria, etiqueta, que, vacio, fallo }: PropsListado & {
  categoria?: 'boletin' | 'dossier'
  /** Lo que se pagina: para el paginador. */
  etiqueta: string
  /** Lo mismo con su artículo, para el aviso de carga: «los boletines». */
  que: string
  vacio: string
  fallo: string
}) {
  const { items, meta, loading, error, alCambiarPagina, reintentar } = usePublicacionesPaginadas(categoria, fallo)
  const columnas = columnasDe(bloque, 4)
  return (
    <>
      <Encabezado titulo={titulo} />
      {(loading || error) && (
        <EnCarga
          estado={loading ? 'cargando' : 'error'}
          que={que}
          alReintentar={reintentar}
          esqueleto={(
            <Grid container spacing={3}>
              {Array.from({ length: columnas }, (_, i) => (
                // Una fila: una tarjeta en el móvil, dos en tableta y todas en escritorio.
                <Grid key={i} size={{ xs: 12, sm: 6, lg: 12 / columnas }} sx={{ display: { xs: i > 0 ? 'none' : 'block', sm: i > 1 ? 'none' : 'block', lg: 'block' } }}>
                  <TarjetaPublicacionEsqueleto />
                </Grid>
              ))}
            </Grid>
          )}
        />
      )}
      {!loading && !error && items.length === 0 && <AvisoSuave>{vacio}</AvisoSuave>}
      <Grid container spacing={3}>
        {items.map((publicacion) => (
          <Grid key={publicacion.id} size={{ xs: 12, sm: 6, lg: 12 / columnas }}>
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
