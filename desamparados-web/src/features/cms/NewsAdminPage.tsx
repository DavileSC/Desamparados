import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, CircularProgress, Paper, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import AddIcon from '@mui/icons-material/Add'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Link, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import CabeceraSeccion from './CabeceraSeccion'
import CampoBusqueda from './listados/CampoBusqueda'
import { useFiltrosUrl } from './listados/useFiltrosUrl'
import FilaRedaccion from './redaccion/FilaRedaccion'
import { CabeceraColumnas, FiltroEstado, Grupo, LineaPortada, ResumenRedaccion } from './redaccion/Listado'
import { piezasDeNoticia } from './redaccion/completitud'
import { CLAVE_PANEL_HOY } from '../../app/usePanelDeHoy'
import { deleteNews, getAdminNews, updateNews, type ApiNews, type EstadoNoticia, type ResumenNoticias } from '../../lib/api/news'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'

const ESTADOS = ['publicadas', 'borradores', 'incompletas'] as const
const FILTROS = { q: {}, estado: { validos: ESTADOS } }

/**
 * La mesa de redacción de Noticias.
 *
 * Arriba lo que está a medio escribir, con lo que le falta a cada borrador;
 * debajo lo publicado, con una línea que marca hasta dónde llega la portada de
 * la web: las tres más recientes, las que caben en su rejilla (el número no se
 * cambia desde aquí; lo pone el diseño, como en Publicaciones). Cada fila avisa si le falta la foto o el extracto, que es lo que en
 * la web se nota. Para escribir se entra en la ficha (NewsEditPage), también
 * para una noticia nueva: una ventana se queda corta para el texto de una
 * noticia y es fácil cerrarla sin querer.
 */
export default function NewsAdminPage() {
  const [items, setItems] = useState<ApiNews[]>([])
  const [resumen, setResumen] = useState<ResumenNoticias | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const location = useLocation()
  // El aviso que deja la ficha al guardar («Noticia publicada.»).
  const [notice, setNotice] = useState<string | null>((location.state as { aviso?: string } | null)?.aviso ?? null)
  const [porBorrar, setPorBorrar] = useState<ApiNews | null>(null)
  const [porCambiar, setPorCambiar] = useState<ApiNews | null>(null)
  // La consulta actual viaja con el enlace de editar (página, tamaño y filtros):
  // así la pantalla de edición sabe a qué página del listado devolver.
  const consultaListado = location.search
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion()
  const [filtros, cambiarFiltros] = useFiltrosUrl(FILTROS)
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)

  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // clics rápidos en el paginador lanzan dos cargas que pueden resolverse en
  // orden inverso y dejar en pantalla los datos de una página con la URL
  // diciendo otra. Solo la última carga en marcha tiene derecho a escribir.
  // Las llamadas de después de borrar o publicar la omiten: no hay carrera.
  const load = useCallback(
    (vigente: () => boolean = () => true) => getAdminNews({ pagina, porPagina }, { q: filtros.q, estado: filtros.estado as EstadoNoticia | '' })
      .then((response) => { if (!vigente()) return; setItems(response.data); setMeta(response.meta); setResumen(response.resumen) }),
    [pagina, porPagina, filtros.q, filtros.estado]
  )

  useEffect(() => {
    let cancelado = false
    load(() => !cancelado)
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se han podido cargar las noticias.') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [load])

  // El menú cuenta los borradores con el panel del Inicio: tras borrar o
  // publicar, se le pide el número nuevo en vez de esperar a que caduque.
  const queryClient = useQueryClient()
  const refrescarMenu = () => void queryClient.invalidateQueries({ queryKey: CLAVE_PANEL_HOY })

  const borrar = async () => {
    if (!porBorrar) return
    setNotice(null)
    try { await deleteNews(porBorrar.id); refrescarMenu(); await load(); setNotice('Noticia eliminada.') }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido eliminar la noticia.') }
    finally { setPorBorrar(null) }
  }

  const cambiarVisible = async () => {
    if (!porCambiar) return
    const publicar = !porCambiar.visible
    setNotice(null)
    try {
      await updateNews(porCambiar.id, { visible: publicar })
      refrescarMenu()
      await load()
      setNotice(publicar ? 'Noticia publicada: ya se ve en la web.' : 'Noticia pasada a borrador: ya no se ve en la web.')
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido cambiar la noticia.') }
    finally { setPorCambiar(null) }
  }

  const portada = resumen?.portada.ids ?? []
  // La línea de la portada solo es exacta si se ve el archivo publicado entero,
  // en orden: con búsqueda o con «incompletas» faltan filas entre medias.
  const conLineaPortada = !filtros.q && (filtros.estado === '' || filtros.estado === 'publicadas')
  const borradores = items.filter((n) => !n.visible)
  const publicadas = items.filter((n) => n.visible)
  const hayFiltro = Boolean(filtros.q || filtros.estado)
  const fila = (noticia: ApiNews, enPortada: boolean) => (
    <FilaRedaccion
      key={noticia.id}
      titulo={noticia.titulo} visible={noticia.visible} fecha={noticia.fecha} editadaEl={noticia.updatedAt}
      imagenUrl={noticia.imagenUrl} enPortada={enPortada}
      piezas={piezasDeNoticia(noticia)} avisos={{ foto: 'Sin foto', extracto: 'Sin extracto' }} resumen={noticia.extracto}
      editar={`/cms/noticias/${noticia.id}/editar`} volver={consultaListado}
      enLaWeb={{ href: `/actualidad/noticias/${noticia.slug}`, texto: 'Ver en la web' }}
      onCambiarVisible={() => setPorCambiar(noticia)} onBorrar={() => setPorBorrar(noticia)}
    />
  )

  return <>
    <Helmet><title>Noticias | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Noticias" subtitulo={resumen && <ResumenRedaccion cifras={resumen} />}>
      <Button variant="outlined" color="inherit" startIcon={<OpenInNewIcon />} href="/actualidad/noticias" target="_blank" rel="noopener" sx={{ borderColor: 'divider' }}>Ver en la web</Button>
      <Button variant="contained" startIcon={<AddIcon />} component={Link} to="/cms/noticias/nueva" state={{ volver: consultaListado }}>Nueva noticia</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice(null)}>{notice}</Alert>}

    <Paper sx={{ p: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
      <CampoBusqueda etiqueta="Buscar" placeholder="En el título o el extracto" valor={filtros.q} onCambiar={(q) => cambiarFiltros({ q })} sx={{ flex: '2 1 260px' }} />
      <FiltroEstado etiqueta="Qué noticias ver" valor={filtros.estado} cifras={resumen} onCambiar={(estado) => cambiarFiltros({ estado })} />
    </Paper>

    <DialogoConfirmacion abierto={porBorrar !== null} titulo="¿Eliminar la noticia?" mensaje={porBorrar ? porBorrar.titulo : ''} textoConfirmar="Eliminar" peligro onConfirmar={() => void borrar()} onCancelar={() => setPorBorrar(null)} />
    <DialogoConfirmacion
      abierto={porCambiar !== null}
      titulo={porCambiar?.visible ? '¿Pasar la noticia a borrador?' : '¿Publicar la noticia?'}
      mensaje={porCambiar ? `${porCambiar.titulo}. ${porCambiar.visible ? `Dejará de verse en la web${portada.includes(porCambiar.id) ? ' y en la portada' : ''}.` : 'Se verá en la web al momento.'}` : ''}
      textoConfirmar={porCambiar?.visible ? 'Pasar a borrador' : 'Publicar'}
      onConfirmar={() => void cambiarVisible()}
      onCancelar={() => setPorCambiar(null)}
    />

    {loading ? <CircularProgress aria-label="Cargando noticias" /> : items.length === 0 ? (
      <Vacio hayFiltro={hayFiltro} estado={filtros.estado} busqueda={filtros.q} onQuitar={() => cambiarFiltros({ q: '', estado: '' })} />
    ) : (
      <Paper sx={{ overflow: 'hidden' }}>
        <CabeceraColumnas nombre="Noticia" />
        {borradores.length > 0 && (
          <Grupo titulo="En preparación" cifra={filtros.estado === '' && !filtros.q ? resumen?.borradores : undefined}>
            {borradores.map((n) => fila(n, false))}
          </Grupo>
        )}
        {publicadas.length > 0 && (
          <Grupo titulo="Publicadas" cifra={filtros.estado === '' && !filtros.q ? resumen?.publicadas : undefined}>
            {publicadas.map((n, i) => {
              const siguiente = publicadas[i + 1]
              const corte = conLineaPortada && portada.at(-1) === n.id && siguiente !== undefined
              return [
                fila(n, portada.includes(n.id)),
                corte && <LineaPortada key="corte" limite={resumen?.portada.limite ?? portada.length} />,
              ]
            })}
          </Grupo>
        )}
      </Paper>
    )}
    {meta && items.length > 0 && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="noticias" />}
  </>
}

function Vacio({ hayFiltro, estado, busqueda, onQuitar }: { hayFiltro: boolean; estado: string; busqueda: string; onQuitar: () => void }) {
  if (!hayFiltro) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ fontWeight: 600 }}>Todavía no hay noticias</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>Escribe la primera con «Nueva noticia».</Typography>
      </Paper>
    )
  }
  const texto = busqueda
    ? `Ninguna noticia coincide con «${busqueda}».`
    : estado === 'borradores' ? 'No hay borradores: todo lo escrito está publicado.'
    : estado === 'incompletas' ? 'Todas las noticias tienen foto y extracto.'
    : 'No hay noticias publicadas.'
  return (
    <Paper sx={{ p: 4, textAlign: 'center' }}>
      <Typography>{texto}</Typography>
      <Button onClick={onQuitar} sx={{ mt: 1 }}>Ver todas</Button>
    </Paper>
  )
}
