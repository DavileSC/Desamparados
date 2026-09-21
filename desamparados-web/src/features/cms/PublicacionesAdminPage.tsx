import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, CircularProgress, MenuItem, Paper, TextField, Typography } from '@mui/material'
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
import { CabeceraColumnas, FiltroEstado, Grupo, LineaPortada, ResumenRedaccion, textoPortada } from './redaccion/Listado'
import { piezasDePublicacion } from './redaccion/completitud'
import { TIPOS_PUBLICACION, nombreTipo } from './portadaPublicacion'
import { eliminarPublicacion, publicacionesDelCms, actualizarPublicacion, type ApiPublication, type EstadoPublicacion, type ResumenPublicaciones } from '../../lib/api/publicaciones'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'
import type { PublicationItem } from '../../types'

const ESTADOS = ['publicadas', 'borradores', 'incompletas'] as const
// Lo que useHomeData('publications') tiene cacheado 60 s: tras destacar hay que
// pedirlo de nuevo o la portada seguiría con el orden de antes.
const CLAVE_PUBLICACIONES_PORTADA = ['home', 'publications']
const FILTROS = { q: {}, estado: { validos: ESTADOS }, tipo: { validos: TIPOS_PUBLICACION.map((t) => t.value) } }

/**
 * La mesa de redacción de Publicaciones, igual que la de Noticias.
 *
 * Arriba lo que está a medio preparar, con lo que le falta a cada borrador;
 * debajo lo publicado, con una línea que marca las que salen en la portada de
 * la web (las tres primeras, de cualquier tipo: por fecha, salvo que haya una
 * destacada, que encabeza mientras lo esté). Cada fila avisa si le
 * falta la portada o la descripción, que es lo que en la web se nota, o si
 * sigue con el PDF de relleno del seed. Para preparar una se entra en la
 * ficha (PublicacionEditPage), también para una nueva.
 */
export default function PublicacionesAdminPage() {
  const [items, setItems] = useState<ApiPublication[]>([])
  const [resumen, setResumen] = useState<ResumenPublicaciones | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const location = useLocation()
  // El aviso que deja la ficha al guardar («Publicada: ya se puede descargar…»).
  const [notice, setNotice] = useState<string | null>((location.state as { aviso?: string } | null)?.aviso ?? null)
  const [porBorrar, setPorBorrar] = useState<ApiPublication | null>(null)
  const [porCambiar, setPorCambiar] = useState<ApiPublication | null>(null)
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
    (vigente: () => boolean = () => true) => publicacionesDelCms(
      { pagina, porPagina },
      { q: filtros.q, estado: filtros.estado as EstadoPublicacion | '', categoria: filtros.tipo as PublicationItem['category'] | '' },
    ).then((respuesta) => { if (!vigente()) return; setItems(respuesta.data); setMeta(respuesta.meta); setResumen(respuesta.resumen) }),
    [pagina, porPagina, filtros.q, filtros.estado, filtros.tipo]
  )

  useEffect(() => {
    let cancelado = false
    load(() => !cancelado)
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se han podido cargar las publicaciones.') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [load])

  const borrar = async () => {
    if (!porBorrar) return
    setNotice(null)
    try { await eliminarPublicacion(porBorrar.id); await load(); setNotice('Publicación eliminada.') }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido eliminar la publicación.') }
    finally { setPorBorrar(null) }
  }

  const cambiarVisible = async () => {
    if (!porCambiar) return
    const publicar = !porCambiar.visible
    setNotice(null)
    try {
      await actualizarPublicacion(porCambiar.id, { visible: publicar })
      await load()
      setNotice(publicar ? 'Publicada: ya se puede descargar desde la web.' : 'Pasada a borrador: ya no se ve en la web.')
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido cambiar la publicación.') }
    finally { setPorCambiar(null) }
  }

  const queryClient = useQueryClient()
  // Sin diálogo: destacar no rompe nada y se deshace con el mismo clic.
  const fijar = async (publicacion: ApiPublication) => {
    const destacar = !publicacion.fijada
    setNotice(null)
    try {
      await actualizarPublicacion(publicacion.id, { fijada: destacar })
      void queryClient.invalidateQueries({ queryKey: CLAVE_PUBLICACIONES_PORTADA })
      await load()
      setNotice(destacar
        ? 'Destacada: va la primera de la portada hasta que destaques otra.'
        : 'Ya no está destacada: la portada vuelve a ir por fecha.')
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido destacar la publicación.') }
  }

  const portada = resumen?.portada.ids ?? []
  // La línea de la portada solo es exacta si se ve lo publicado entero, en
  // orden: con búsqueda, con un tipo o con «incompletas» faltan filas entre medias.
  const conLineaPortada = !filtros.q && !filtros.tipo && (filtros.estado === '' || filtros.estado === 'publicadas')
  const borradores = items.filter((p) => !p.visible)
  const publicadas = items.filter((p) => p.visible)
  const hayFiltro = Boolean(filtros.q || filtros.estado || filtros.tipo)
  const conCifra = filtros.estado === '' && !filtros.q
  const fila = (publicacion: ApiPublication, enPortada: boolean) => (
    <FilaRedaccion
      key={publicacion.id}
      titulo={publicacion.titulo} visible={publicacion.visible} fecha={publicacion.fecha} editadaEl={publicacion.updatedAt}
      imagenUrl={publicacion.imagenUrl} fotoVertical antetitulo={nombreTipo(publicacion.categoria)} enPortada={enPortada} fijada={publicacion.fijada}
      piezas={piezasDePublicacion(publicacion)}
      avisos={{ portada: 'Sin portada', descripcion: 'Sin descripción', pdf: 'PDF de relleno' }}
      resumen={publicacion.descripcion}
      editar={`/cms/publicaciones/${publicacion.id}/editar`} volver={consultaListado}
      enLaWeb={{ href: publicacion.archivoUrl, texto: 'Abrir el PDF' }}
      onCambiarVisible={() => setPorCambiar(publicacion)} onFijar={() => void fijar(publicacion)} onBorrar={() => setPorBorrar(publicacion)}
    />
  )

  return <>
    <Helmet><title>Publicaciones | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Publicaciones" subtitulo={resumen && <ResumenRedaccion cifras={resumen} />}>
      <Button variant="outlined" color="inherit" startIcon={<OpenInNewIcon />} href="/publicaciones" target="_blank" rel="noopener" sx={{ borderColor: 'divider' }}>Ver en la web</Button>
      <Button variant="contained" startIcon={<AddIcon />} component={Link} to="/cms/publicaciones/nueva" state={{ volver: consultaListado }}>Nueva publicación</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice(null)}>{notice}</Alert>}

    <Paper sx={{ p: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
      <CampoBusqueda etiqueta="Buscar" placeholder="En el título o la descripción" valor={filtros.q} onCambiar={(q) => cambiarFiltros({ q })} sx={{ flex: '2 1 240px' }} />
      <TextField select size="small" label="Tipo" value={filtros.tipo} onChange={(e) => cambiarFiltros({ tipo: e.target.value })} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ flex: '0 1 190px', minWidth: 150 }}>
        <MenuItem value="">Todos los tipos</MenuItem>
        {TIPOS_PUBLICACION.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
      </TextField>
      <FiltroEstado etiqueta="Qué publicaciones ver" valor={filtros.estado} cifras={resumen} onCambiar={(estado) => cambiarFiltros({ estado })} />
    </Paper>

    <DialogoConfirmacion abierto={porBorrar !== null} titulo="¿Eliminar la publicación?" mensaje={porBorrar ? `${porBorrar.titulo}. Se borran también su PDF y su portada.` : ''} textoConfirmar="Eliminar" peligro onConfirmar={() => void borrar()} onCancelar={() => setPorBorrar(null)} />
    <DialogoConfirmacion
      abierto={porCambiar !== null}
      titulo={porCambiar?.visible ? '¿Pasarla a borrador?' : '¿Publicarla en la web?'}
      mensaje={porCambiar ? `${porCambiar.titulo}. ${porCambiar.visible ? `Dejará de verse en la web${portada.includes(porCambiar.id) ? ' y en la portada' : ''}.` : 'Se podrá descargar desde la web al momento.'}` : ''}
      textoConfirmar={porCambiar?.visible ? 'Pasar a borrador' : 'Publicar'}
      onConfirmar={() => void cambiarVisible()}
      onCancelar={() => setPorCambiar(null)}
    />

    {loading ? <CircularProgress aria-label="Cargando publicaciones" /> : items.length === 0 ? (
      <Vacio hayFiltro={hayFiltro} estado={filtros.estado} busqueda={filtros.q} tipo={filtros.tipo} onQuitar={() => cambiarFiltros({ q: '', estado: '', tipo: '' })} />
    ) : (
      <Paper sx={{ overflow: 'hidden' }}>
        <CabeceraColumnas nombre="Publicación" fotoVertical />
        {borradores.length > 0 && (
          <Grupo titulo="En preparación" cifra={conCifra ? resumen?.borradores : undefined}>
            {borradores.map((p) => fila(p, false))}
          </Grupo>
        )}
        {publicadas.length > 0 && (
          <Grupo titulo="Publicadas" cifra={conCifra ? resumen?.publicadas : undefined}>
            {publicadas.map((p, i) => {
              const corte = conLineaPortada && portada.at(-1) === p.id && publicadas[i + 1] !== undefined
              return [
                fila(p, portada.includes(p.id)),
                corte && <LineaPortada key="corte" limite={resumen?.portada.limite ?? portada.length} texto={textoPortada(resumen)} />,
              ]
            })}
          </Grupo>
        )}
      </Paper>
    )}
    {meta && items.length > 0 && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="publicaciones" />}
  </>
}

function Vacio({ hayFiltro, estado, busqueda, tipo, onQuitar }: { hayFiltro: boolean; estado: string; busqueda: string; tipo: string; onQuitar: () => void }) {
  if (!hayFiltro) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ fontWeight: 600 }}>Todavía no hay publicaciones</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>Sube la primera con «Nueva publicación».</Typography>
      </Paper>
    )
  }
  const deTipo = tipo ? ` de tipo «${nombreTipo(tipo)}»` : ''
  const texto = busqueda
    ? `Ninguna publicación${deTipo} coincide con «${busqueda}».`
    : estado === 'borradores' ? `No hay borradores${deTipo}: todo lo preparado está publicado.`
    : estado === 'incompletas' ? `Todas las publicaciones${deTipo} tienen portada, descripción y su PDF.`
    : `No hay publicaciones${deTipo}.`
  return (
    <Paper sx={{ p: 4, textAlign: 'center' }}>
      <Typography>{texto}</Typography>
      <Button onClick={onQuitar} sx={{ mt: 1 }}>Ver todas</Button>
    </Paper>
  )
}
