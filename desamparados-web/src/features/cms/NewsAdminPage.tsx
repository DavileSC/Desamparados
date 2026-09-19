import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import AddIcon from '@mui/icons-material/Add'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Link, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import CabeceraSeccion from './CabeceraSeccion'
import VentanaFormulario from './VentanaFormulario'
import CampoBusqueda from './listados/CampoBusqueda'
import { useFiltrosUrl } from './listados/useFiltrosUrl'
import FilaNoticia from './noticias/FilaNoticia'
import { REJILLA_FILA } from './noticias/rejilla'
import { haceCuanto } from './noticias/completitud'
import { useTemaCms } from '../../app/temaCms'
import { CLAVE_PANEL_HOY } from '../../app/usePanelDeHoy'
import { deleteNews, getAdminNews, setLimitePortada, updateNews, type ApiNews, type EstadoNoticia, type ResumenNoticias } from '../../lib/api/news'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'

const ESTADOS = ['publicadas', 'borradores', 'incompletas'] as const
const FILTROS = { q: {}, estado: { validos: ESTADOS } }

/** Cuántas puede enseñar la portada: los topes del servidor (LIMITE_PORTADA_MIN y _MAX). */
const LIMITES_PORTADA = Array.from({ length: 20 }, (_, i) => i + 1)

/**
 * La mesa de redacción de Noticias.
 *
 * Arriba lo que está a medio escribir, con lo que le falta a cada borrador;
 * debajo lo publicado, con una línea que marca hasta dónde llega la portada de
 * la web. Cada fila avisa si le falta la foto o el extracto, que es lo que en
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
  const [editandoPortada, setEditandoPortada] = useState(false)
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
  const recargar = () => load().catch((err: unknown) => setError(err instanceof Error ? err.message : 'No se han podido cargar las noticias.'))

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

  return <>
    <Helmet><title>Noticias | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Noticias" subtitulo={resumen && <Resumen resumen={resumen} />}>
      <Button variant="outlined" color="inherit" startIcon={<OpenInNewIcon />} href="/actualidad/noticias" target="_blank" rel="noopener" sx={{ borderColor: 'divider' }}>Ver en la web</Button>
      <Button variant="contained" startIcon={<AddIcon />} component={Link} to="/cms/noticias/nueva" state={{ volver: consultaListado }}>Nueva noticia</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice(null)}>{notice}</Alert>}

    <Paper sx={{ p: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
      <CampoBusqueda etiqueta="Buscar" placeholder="En el título o el extracto" valor={filtros.q} onCambiar={(q) => cambiarFiltros({ q })} sx={{ flex: '2 1 260px' }} />
      {/* Con los contadores no caben en un móvil: ahí se parten en botones sueltos, para que ninguno quede escondido. */}
      <ToggleButtonGroup
          exclusive
          size="small"
          aria-label="Qué noticias ver"
          value={filtros.estado}
          onChange={(_, estado: string | null) => { if (estado !== null) cambiarFiltros({ estado }) }}
          sx={(tema) => ({
            '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5, gap: 0.75, whiteSpace: 'nowrap' },
            [tema.breakpoints.down('sm')]: {
              flexWrap: 'wrap', gap: 0.75,
              '& .MuiToggleButtonGroup-grouped': { m: 0, border: 1, borderColor: 'divider', borderRadius: 1 },
            },
          })}
        >
          <ToggleButton value="">Todas<Cifra n={resumen ? resumen.publicadas + resumen.borradores : undefined} /></ToggleButton>
          <ToggleButton value="publicadas">Publicadas<Cifra n={resumen?.publicadas} /></ToggleButton>
          <ToggleButton value="borradores">Borradores<Cifra n={resumen?.borradores} /></ToggleButton>
          <ToggleButton value="incompletas">Incompletas<Cifra n={resumen?.incompletas} /></ToggleButton>
        </ToggleButtonGroup>
    </Paper>

    <VentanaLimitePortada abierto={editandoPortada} actual={resumen?.portada.limite ?? 3} onCerrar={() => setEditandoPortada(false)} onGuardado={(limite) => { setEditandoPortada(false); setNotice(`La portada enseña ahora ${limite === 1 ? 'la noticia más reciente' : `las ${limite} noticias más recientes`}.`); void recargar() }} />
    <DialogoConfirmacion abierto={porBorrar !== null} titulo="¿Eliminar la noticia?" mensaje={porBorrar ? porBorrar.titulo : ''} textoConfirmar="Eliminar" peligro onConfirmar={() => void borrar()} onCancelar={() => setPorBorrar(null)} />
    <DialogoConfirmacion
      abierto={porCambiar !== null}
      titulo={porCambiar?.visible ? '¿Pasar la noticia a borrador?' : '¿Publicar la noticia?'}
      mensaje={porCambiar ? `${porCambiar.titulo}. ${porCambiar.visible ? 'Dejará de verse en la web y en la portada.' : 'Se verá en la web al momento.'}` : ''}
      textoConfirmar={porCambiar?.visible ? 'Pasar a borrador' : 'Publicar'}
      onConfirmar={() => void cambiarVisible()}
      onCancelar={() => setPorCambiar(null)}
    />

    {loading ? <CircularProgress aria-label="Cargando noticias" /> : items.length === 0 ? (
      <Vacio hayFiltro={hayFiltro} estado={filtros.estado} busqueda={filtros.q} onQuitar={() => cambiarFiltros({ q: '', estado: '' })} />
    ) : (
      <Paper sx={{ overflow: 'hidden' }}>
        <Box aria-hidden="true" sx={{ ...REJILLA_FILA, display: { xs: 'none', md: 'grid' }, px: 2.5, py: 1.25, gridTemplateAreas: undefined, '& span': { fontSize: 11.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' } }}>
          <span /><span>Noticia</span><span>Estado</span><span>Fecha</span><span />
        </Box>
        {borradores.length > 0 && (
          <Grupo titulo="En preparación" cifra={filtros.estado === '' && !filtros.q ? resumen?.borradores : undefined}>
            {borradores.map((n) => <FilaNoticia key={n.id} noticia={n} enPortada={false} volver={consultaListado} onCambiarVisible={setPorCambiar} onBorrar={setPorBorrar} />)}
          </Grupo>
        )}
        {publicadas.length > 0 && (
          <Grupo titulo="Publicadas" cifra={filtros.estado === '' && !filtros.q ? resumen?.publicadas : undefined}>
            {publicadas.map((n, i) => {
              const siguiente = publicadas[i + 1]
              const corte = conLineaPortada && portada.at(-1) === n.id && siguiente !== undefined
              return [
                <FilaNoticia key={n.id} noticia={n} enPortada={portada.includes(n.id)} volver={consultaListado} onCambiarVisible={setPorCambiar} onBorrar={setPorBorrar} />,
                corte && <LineaPortada key="corte" limite={resumen?.portada.limite ?? portada.length} onCambiar={() => setEditandoPortada(true)} />,
              ]
            })}
          </Grupo>
        )}
      </Paper>
    )}
    {meta && items.length > 0 && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="noticias" />}
  </>
}

/** «40 publicadas · 3 borradores · la última salió hace 7 días». */
function Resumen({ resumen }: { resumen: ResumenNoticias }) {
  const partes = [
    `${resumen.publicadas} ${resumen.publicadas === 1 ? 'publicada' : 'publicadas'}`,
    `${resumen.borradores} ${resumen.borradores === 1 ? 'borrador' : 'borradores'}`,
  ]
  if (resumen.ultimaPublicacion) partes.push(`la última salió ${haceCuanto(resumen.ultimaPublicacion)}`)
  return <>{partes.join(' · ')}</>
}

function Cifra({ n }: { n?: number }) {
  if (n === undefined) return null
  return <Box component="span" sx={{ opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>{n}</Box>
}

function Grupo({ titulo, cifra, children }: { titulo: string; cifra?: number; children: React.ReactNode }) {
  return (
    <Box component="section">
      <Typography component="h2" sx={{ px: { xs: 2, md: 2.5 }, py: 0.75, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary', backgroundColor: 'action.hover', borderTop: 1, borderColor: 'divider' }}>
        {titulo}{cifra !== undefined && ` · ${cifra}`}
      </Typography>
      <Box component="ul" sx={{ m: 0, p: 0 }}>{children}</Box>
    </Box>
  )
}

/** La raya bajo la última noticia que sale en la portada. */
function LineaPortada({ limite, onCambiar }: { limite: number; onCambiar: () => void }) {
  const { superficies } = useTemaCms()
  return (
    <Box component="li" sx={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', px: { xs: 2, md: 2.5 }, py: 0.5, borderTop: '1.5px dashed', borderColor: superficies.enlace, color: superficies.enlace, fontSize: 12.5, '& svg': { fontSize: 16 } }}>
      <HomeOutlinedIcon aria-hidden="true" />
      <span>Hasta aquí sale en la portada: {limite === 1 ? 'la más reciente' : `las ${limite} más recientes`}.</span>
      <Button size="small" onClick={onCambiar} sx={{ color: 'inherit', minWidth: 0, px: 0.75, fontSize: 12.5, textDecoration: 'underline' }}>Cambiar cuántas</Button>
    </Box>
  )
}

function VentanaLimitePortada({ abierto, actual, onCerrar, onGuardado }: { abierto: boolean; actual: number; onCerrar: () => void; onGuardado: (limite: number) => void }) {
  const [limite, setLimite] = useState(actual)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Al abrir, se parte de lo que hay guardado.
  const [abiertoAntes, setAbiertoAntes] = useState(abierto)
  if (abierto !== abiertoAntes) { setAbiertoAntes(abierto); if (abierto) { setLimite(actual); setError(null) } }

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try { await setLimitePortada(limite); onGuardado(limite) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'No se ha podido cambiar la portada.') }
    finally { setGuardando(false) }
  }

  return (
    <VentanaFormulario abierto={abierto} titulo="Noticias en la portada" sucio={limite !== actual} guardando={guardando} puedeGuardar={limite !== actual} error={error} onGuardar={guardar} onCerrar={onCerrar}>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        La portada de la web enseña las noticias publicadas más recientes. Los borradores no cuentan.
      </Typography>
      <TextField select label="Cuántas enseña" value={limite} onChange={(e) => setLimite(Number(e.target.value))} sx={{ maxWidth: 200 }}>
        {LIMITES_PORTADA.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
      </TextField>
    </VentanaFormulario>
  )
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
