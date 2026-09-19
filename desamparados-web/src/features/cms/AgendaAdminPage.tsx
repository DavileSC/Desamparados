import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import AddIcon from '@mui/icons-material/Add'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Link, useLocation } from 'react-router-dom'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import CabeceraSeccion from './CabeceraSeccion'
import CampoBusqueda from './listados/CampoBusqueda'
import { useFiltrosUrl } from './listados/useFiltrosUrl'
import { Grupo, LineaPortada } from './redaccion/Listado'
import FilaEvento from './agenda/FilaEvento'
import { rejillaEvento } from './agenda/rejilla'
import { TIPOS_EVENTO } from './agenda/tiposEvento'
import { agruparPorMes, cuandoEs, hora } from './agenda/fechas'
import { deleteEvent, getAdminEvents, type ApiEvent, type PeriodoAgenda, type ResumenAgenda } from '../../lib/api/events'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'

const FILTROS = {
  q: {},
  periodo: { porDefecto: 'proximos', validos: ['proximos', 'pasados'] },
  tipo: { validos: TIPOS_EVENTO.map((t) => t.valor) },
  visibilidad: { validos: ['public', 'members_only'] },
}

/**
 * La agenda del CMS, en la misma línea que las mesas de Noticias y
 * Publicaciones, pero sin borradores: un acto se ve en la web en cuanto se
 * guarda.
 *
 * Arriba, cuál es el siguiente y cuántos son solo para hermanos; debajo, los
 * actos por meses, con el día como en la agenda de la portada, una marca en
 * los que salen ahora en ella y una raya donde se corta. Cada fila avisa si le
 * falta el lugar o la descripción, que es lo que en la web se nota. Para
 * preparar uno se entra en la ficha (AgendaEditPage), también para uno nuevo
 * o para duplicar otro.
 */
export default function AgendaAdminPage() {
  const [items, setItems] = useState<ApiEvent[]>([])
  const [resumen, setResumen] = useState<ResumenAgenda | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const location = useLocation()
  // El aviso que deja la ficha al guardar («Añadido a la agenda: ya se ve en la web»).
  const [notice, setNotice] = useState<string | null>((location.state as { aviso?: string } | null)?.aviso ?? null)
  const [porBorrar, setPorBorrar] = useState<ApiEvent | null>(null)
  // La consulta actual viaja con el enlace de editar (página, tamaño y filtros):
  // así la pantalla de edición sabe a qué página del listado devolver.
  const consultaListado = location.search
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion()
  // Próximos o pasados, en la URL como la página: al volver de editar un evento
  // pasado se vuelve a su pestaña. Sin la de pasados, un evento fechado por
  // error antes de hoy desaparecía del CMS y no se podía corregir ni borrar.
  const [filtros, cambiarFiltros] = useFiltrosUrl(FILTROS)
  const periodo = filtros.periodo as PeriodoAgenda
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)

  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // clics rápidos en el paginador lanzan dos cargas que pueden resolverse en
  // orden inverso y dejar en pantalla los datos de una página con la URL
  // diciendo otra. Solo la última carga en marcha tiene derecho a escribir.
  // Las llamadas de después de borrar la omiten: no hay carrera.
  const load = useCallback(
    // Una carga buena borra el error de la anterior: si no, la alerta se queda puesta para siempre.
    (vigente: () => boolean = () => true) => getAdminEvents(
      { pagina, porPagina },
      periodo,
      { q: filtros.q, tipo: filtros.tipo as ApiEvent['type'] | '', visibilidad: filtros.visibilidad as ApiEvent['visibility'] | '' },
    ).then((respuesta) => { if (!vigente()) return; setItems(respuesta.eventos); setMeta(respuesta.meta); setResumen(respuesta.resumen); setError(null) }),
    [pagina, porPagina, periodo, filtros.q, filtros.tipo, filtros.visibilidad]
  )

  useEffect(() => {
    let cancelado = false
    load(() => !cancelado)
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se ha podido cargar la agenda.') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [load])

  const borrar = async () => {
    if (!porBorrar) return
    setNotice(null)
    try { await deleteEvent(porBorrar.id); await load(); setNotice('Evento eliminado.') }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido eliminar el evento.') }
    finally { setPorBorrar(null) }
  }

  const portada = resumen?.portada.ids ?? []
  // La raya solo es exacta si se ven los próximos enteros, en orden: con
  // búsqueda, con un tipo o solo con los de hermanos faltan filas entre medias.
  const conLineaPortada = periodo === 'proximos' && !filtros.q && !filtros.tipo && filtros.visibilidad !== 'members_only'
  const hayFiltro = Boolean(filtros.q || filtros.tipo || filtros.visibilidad)
  const grupos = agruparPorMes(items)

  return <>
    <Helmet><title>Agenda | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Agenda" subtitulo={resumen && <Resumen resumen={resumen} />}>
      <Button variant="outlined" color="inherit" startIcon={<OpenInNewIcon />} href="/actualidad/agenda" target="_blank" rel="noopener" sx={{ borderColor: 'divider' }}>Ver en la web</Button>
      <Button variant="contained" startIcon={<AddIcon />} component={Link} to="/cms/agenda/nuevo" state={{ volver: consultaListado }}>Nuevo evento</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice(null)}>{notice}</Alert>}

    <Paper sx={{ p: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
      <CampoBusqueda etiqueta="Buscar" placeholder="En el título, la descripción o el lugar" valor={filtros.q} onCambiar={(q) => cambiarFiltros({ q })} sx={{ flex: '2 1 240px' }} />
      <TextField select size="small" label="Tipo" value={filtros.tipo} onChange={(e) => cambiarFiltros({ tipo: e.target.value })} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ flex: '0 1 170px', minWidth: 140 }}>
        <MenuItem value="">Todos los tipos</MenuItem>
        {TIPOS_EVENTO.map((t) => <MenuItem key={t.valor} value={t.valor}>{t.nombre}</MenuItem>)}
      </TextField>
      <TextField select size="small" label="Quién lo ve" value={filtros.visibilidad} onChange={(e) => cambiarFiltros({ visibilidad: e.target.value })} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ flex: '0 1 170px', minWidth: 140 }}>
        <MenuItem value="">Todos</MenuItem>
        <MenuItem value="public">Público</MenuItem>
        <MenuItem value="members_only">Solo hermanos</MenuItem>
      </TextField>
      <ToggleButtonGroup
        exclusive
        size="small"
        aria-label="Qué actos ver"
        value={periodo}
        onChange={(_, valor: PeriodoAgenda | null) => { if (valor) cambiarFiltros({ periodo: valor }) }}
        sx={{ '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5, gap: 0.75, whiteSpace: 'nowrap' } }}
      >
        <ToggleButton value="proximos">Próximos<Cifra n={resumen?.proximos} /></ToggleButton>
        <ToggleButton value="pasados">Pasados<Cifra n={resumen?.pasados} /></ToggleButton>
      </ToggleButtonGroup>
    </Paper>

    <DialogoConfirmacion
      abierto={porBorrar !== null}
      titulo="¿Eliminar el evento?"
      mensaje={porBorrar ? `${porBorrar.title}. ${portada.includes(porBorrar.id) ? 'Dejará de verse en la web y en la portada.' : 'Dejará de verse en la web.'}` : ''}
      textoConfirmar="Eliminar"
      peligro
      onConfirmar={() => void borrar()}
      onCancelar={() => setPorBorrar(null)}
    />

    {loading ? <CircularProgress aria-label="Cargando agenda" /> : items.length === 0 ? (
      <Vacio periodo={periodo} hayFiltro={hayFiltro} busqueda={filtros.q} onQuitar={() => cambiarFiltros({ q: '', tipo: '', visibilidad: '' })} />
    ) : (
      <Paper sx={{ overflow: 'hidden' }}>
        <Box aria-hidden="true" sx={{ ...rejillaEvento, display: { xs: 'none', md: 'grid' }, px: 2.5, py: 1.25, gridTemplateAreas: undefined, '& span': { fontSize: 11.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' } }}>
          <span>Día</span><span>Acto</span><span>Tipo</span><span>Quién lo ve</span><span />
        </Box>
        {grupos.map((grupo) => (
          <Grupo key={grupo.clave} titulo={grupo.titulo}>
            {grupo.eventos.map((evento) => {
              const corte = conLineaPortada && portada.at(-1) === evento.id && items.at(-1)?.id !== evento.id
              return [
                <FilaEvento key={evento.id} evento={evento} enPortada={portada.includes(evento.id)} volver={consultaListado} onBorrar={() => setPorBorrar(evento)} />,
                corte && (
                  <LineaPortada
                    key="corte"
                    limite={portada.length}
                    texto={`Hasta aquí sale en la portada: ${portada.length === 1 ? 'el próximo acto público' : `los ${portada.length} próximos actos públicos`}.`}
                  />
                ),
              ]
            })}
          </Grupo>
        ))}
      </Paper>
    )}
    {meta && items.length > 0 && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="la agenda" />}
  </>
}

/** «Lo siguiente: Besapiés, mañana a las 20:00 · 3 de los próximos son solo para hermanos». */
function Resumen({ resumen }: { resumen: ResumenAgenda }) {
  const { siguiente, soloHermanos } = resumen
  const partes = [siguiente ? `Lo siguiente: ${siguiente.title}, ${cuandoEs(siguiente.startDate)} a las ${hora(new Date(siguiente.startDate))}` : 'No hay nada en la agenda desde hoy']
  if (soloHermanos > 0) partes.push(`${soloHermanos} de los próximos ${soloHermanos === 1 ? 'es' : 'son'} solo para hermanos`)
  return <>{partes.join(' · ')}</>
}

function Cifra({ n }: { n?: number }) {
  if (n === undefined) return null
  return <Box component="span" sx={{ opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>{n}</Box>
}

function Vacio({ periodo, hayFiltro, busqueda, onQuitar }: { periodo: PeriodoAgenda; hayFiltro: boolean; busqueda: string; onQuitar: () => void }) {
  if (!hayFiltro) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Typography sx={{ fontWeight: 600 }}>{periodo === 'pasados' ? 'No hay eventos pasados' : 'No hay eventos próximos'}</Typography>
        {periodo === 'proximos' && <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>Añade el siguiente con «Nuevo evento»: la portada lo enseña en cuanto se guarda.</Typography>}
      </Paper>
    )
  }
  const cuales = periodo === 'pasados' ? 'pasado' : 'próximo'
  return (
    <Paper sx={{ p: 4, textAlign: 'center' }}>
      <Typography>{busqueda ? `Ningún evento ${cuales} coincide con «${busqueda}».` : `Ningún evento ${cuales} con estos filtros.`}</Typography>
      <Button onClick={onQuitar} sx={{ mt: 1 }}>Quitar los filtros</Button>
    </Paper>
  )
}

