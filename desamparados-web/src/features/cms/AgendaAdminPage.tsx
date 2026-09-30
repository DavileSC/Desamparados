import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import AddIcon from '@mui/icons-material/Add'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Link, useLocation } from 'react-router-dom'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import CabeceraSeccion from './CabeceraSeccion'
import CampoBusqueda from './listados/CampoBusqueda'
import { useFiltrosUrl } from './listados/useFiltrosUrl'
import { Grupo, LineaPortada } from './redaccion/Listado'
import FilaEvento from './agenda/FilaEvento'
import CalendarioAgenda from './agenda/CalendarioAgenda'
import { claveDia, claveMes, leerMes } from './agenda/calendario'
import { rejillaEvento } from './agenda/rejilla'
import { TIPOS_EVENTO } from './agenda/tiposEvento'
import { agruparPorMes, cuandoEs, hora } from './agenda/fechas'
import { eliminarEvento, eventosDelCms, type ApiEvent, type PeriodoAgenda, type ResumenAgenda, type ResumenDeHoy } from '../../lib/api/agenda'
import { usePaginacion } from '../../hooks/usePaginacion'
import Paginador from '../../components/Paginador'
import type { MetaPaginacion } from '../../lib/api/tipos'
import { site } from '../../config/site'

type Vista = 'mes' | 'lista'

const FILTROS = {
  // El calendario, salvo que se pida la lista. El mes y el día abiertos, en
  // la URL como lo demás: al volver de la ficha se vuelve al mismo sitio.
  vista: { porDefecto: 'mes', validos: ['mes', 'lista'] },
  mes: {},
  dia: {},
  q: {},
  periodo: { porDefecto: 'proximos', validos: ['proximos', 'pasados'] },
  tipo: { validos: TIPOS_EVENTO.map((t) => t.valor) },
}

/**
 * La agenda del CMS, sin borradores: un acto se ve en la web en cuanto se
 * guarda. Se ve de dos maneras, con un conmutador:
 *
 * - El mes (la de entrada): un calendario de pared con el día elegido al lado
 *   (CalendarioAgenda).
 * - La lista, en la misma línea que las mesas de Noticias y Publicaciones,
 *   que es donde se busca y donde están los actos pasados.
 *
 * Arriba, cuál es el siguiente; en la lista, los
 * actos por meses, con el día como en la agenda de la portada, una marca en
 * los que salen ahora en ella y una raya donde se corta. Cada fila avisa si le
 * falta el lugar o la descripción, que es lo que en la web se nota. Para
 * preparar uno se entra en la ficha (AgendaEditPage), también para uno nuevo
 * o para duplicar otro.
 */
export default function AgendaAdminPage() {
  const [items, setItems] = useState<ApiEvent[]>([])
  const [resumen, setResumen] = useState<ResumenAgenda | null>(null)
  // Lo de hoy (el siguiente y los de la portada), lo traiga el mes o la lista.
  const [deHoy, setDeHoy] = useState<ResumenDeHoy | null>(null)
  // Sube al borrar un acto desde el calendario: vuelve a pedir el mes.
  const [version, setVersion] = useState(0)
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
  const vista = filtros.vista as Vista
  const primero = useMemo(() => leerMes(filtros.mes), [filtros.mes])
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)

  // `vigente` es la guarda de cancelación de useListadoPaginado traída aquí: dos
  // clics rápidos en el paginador lanzan dos cargas que pueden resolverse en
  // orden inverso y dejar en pantalla los datos de una página con la URL
  // diciendo otra. Solo la última carga en marcha tiene derecho a escribir.
  // Las llamadas de después de borrar la omiten: no hay carrera.
  const cargar = useCallback(
    // Una carga buena borra el error de la anterior: si no, la alerta se queda puesta para siempre.
    (vigente: () => boolean = () => true) => eventosDelCms(
      { pagina, porPagina },
      periodo,
      { q: filtros.q, tipo: filtros.tipo as ApiEvent['type'] | '' },
    ).then((respuesta) => { if (!vigente()) return; setItems(respuesta.eventos); setMeta(respuesta.meta); setResumen(respuesta.resumen); setDeHoy(respuesta.resumen); setError(null) }),
    [pagina, porPagina, periodo, filtros.q, filtros.tipo]
  )

  useEffect(() => {
    // En el mes la lista no se pide: el calendario trae lo suyo.
    if (vista !== 'lista') return
    let cancelado = false
    cargar(() => !cancelado)
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se ha podido cargar la agenda.') })
      .finally(() => { if (!cancelado) setLoading(false) })
    return () => { cancelado = true }
  }, [cargar, vista])

  const borrar = async () => {
    if (!porBorrar) return
    setNotice(null)
    try {
      await eliminarEvento(porBorrar.id)
      if (vista === 'lista') await cargar()
      else setVersion((v) => v + 1)
      setNotice('Evento eliminado.')
    }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'No se ha podido eliminar el evento.') }
    finally { setPorBorrar(null) }
  }

  const portada = deHoy?.portada.ids ?? []
  // La raya solo es exacta si se ven los próximos enteros, en orden: con
  // búsqueda, con un tipo o solo con los de hermanos faltan filas entre medias.
  const conLineaPortada = periodo === 'proximos' && !filtros.q && !filtros.tipo
  const hayFiltro = Boolean(filtros.q || filtros.tipo)
  const grupos = agruparPorMes(items)

  const conmutador = (
    <ToggleButtonGroup
      exclusive
      size="small"
      aria-label="Cómo ver la agenda"
      value={vista}
      onChange={(_, valor: Vista | null) => { if (valor) cambiarFiltros({ vista: valor }) }}
      sx={{ '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5, gap: 0.75, whiteSpace: 'nowrap' }, '& svg': { fontSize: 18 } }}
    >
      <ToggleButton value="mes"><CalendarMonthOutlinedIcon />Mes</ToggleButton>
      <ToggleButton value="lista"><ViewListOutlinedIcon />Lista</ToggleButton>
    </ToggleButtonGroup>
  )

  return <>
    <Helmet><title>{`Agenda | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo="Agenda" subtitulo={deHoy && <Resumen resumen={deHoy} />}>
      <Button variant="outlined" color="inherit" startIcon={<OpenInNewIcon />} href="/agenda" target="_blank" rel="noopener" sx={{ borderColor: 'divider' }}>Ver en la web</Button>
      <Button variant="contained" startIcon={<AddIcon />} component={Link} to="/cms/agenda/nuevo" state={{ volver: consultaListado }}>Nuevo evento</Button>
    </CabeceraSeccion>
    {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice(null)}>{notice}</Alert>}

    {vista === 'mes' ? (
      <CalendarioAgenda
        primero={primero}
        dia={filtros.dia}
        tipo={filtros.tipo as ApiEvent['type'] | ''}
        volver={consultaListado}
        version={version}
        conmutador={conmutador}
        onMes={(fecha) => cambiarFiltros({ mes: claveMes(fecha), dia: '' })}
        onDia={(fecha) => cambiarFiltros({ mes: claveMes(fecha), dia: claveDia(fecha) })}
        onTipo={(tipo) => cambiarFiltros({ tipo })}
        onResumen={setDeHoy}
        onBorrar={setPorBorrar}
      />
    ) : <>
    <Paper sx={{ p: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
      <CampoBusqueda etiqueta="Buscar" placeholder="En el título, la descripción o el lugar" valor={filtros.q} onCambiar={(q) => cambiarFiltros({ q })} sx={{ flex: '2 1 240px' }} />
      <TextField select size="small" label="Tipo" value={filtros.tipo} onChange={(e) => cambiarFiltros({ tipo: e.target.value })} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ flex: '0 1 170px', minWidth: 140 }}>
        <MenuItem value="">Todos los tipos</MenuItem>
        {TIPOS_EVENTO.map((t) => <MenuItem key={t.valor} value={t.valor}>{t.nombre}</MenuItem>)}
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
      <Box sx={{ ml: 'auto' }}>{conmutador}</Box>
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
      <Vacio periodo={periodo} hayFiltro={hayFiltro} busqueda={filtros.q} onQuitar={() => cambiarFiltros({ q: '', tipo: '' })} />
    ) : (
      <Paper sx={{ overflow: 'hidden' }}>
        <Box aria-hidden="true" sx={{ ...rejillaEvento, display: { xs: 'none', md: 'grid' }, px: 2.5, py: 1.25, gridTemplateAreas: undefined, '& span': { fontSize: 11.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' } }}>
          <span>Día</span><span>Acto</span><span>Tipo</span><span />
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
                    texto={`Hasta aquí sale en la portada: ${portada.length === 1 ? 'el próximo acto' : `los ${portada.length} próximos actos`}.`}
                  />
                ),
              ]
            })}
          </Grupo>
        ))}
      </Paper>
    )}
    {meta && items.length > 0 && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="la agenda" />}
    </>}
  </>
}

/** «Lo siguiente: Besapiés, mañana a las 20:00». */
function Resumen({ resumen }: { resumen: ResumenDeHoy }) {
  const { siguiente } = resumen
  return <>{siguiente ? `Lo siguiente: ${siguiente.title}, ${cuandoEs(siguiente.startDate)} a las ${hora(new Date(siguiente.startDate))}` : 'No hay nada en la agenda desde hoy'}</>
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

