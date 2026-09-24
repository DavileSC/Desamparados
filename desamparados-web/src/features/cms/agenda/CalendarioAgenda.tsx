import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, Box, Button, ButtonBase, CircularProgress, IconButton, LinearProgress, Paper, Typography, useMediaQuery, useTheme } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { calendarioDelCms, type ApiEvent, type EventoDelCalendario, type ResumenDeHoy } from '../../../lib/api/agenda'
import { TIPOS_EVENTO } from './tiposEvento'
import { actosPorDia, claveDia, colores, leerDia, rejillaDelMes, tituloDelMes } from './calendario'
import VistaMes from './VistaMes'
import PanelDelDia from './PanelDelDia'

interface Props {
  /** El primer día del mes que se ve. */
  primero: Date
  /** El `?dia=` de la URL, tal cual. */
  dia: string
  tipo: ApiEvent['type'] | ''
  /** La consulta de la URL, para que la ficha vuelva al mismo mes y día. */
  volver: string
  /** Sube en uno al borrar un acto: vuelve a pedir el mes. */
  version: number
  hoy?: Date
  /** El conmutador «Mes · Lista», al final de la barra. */
  conmutador: ReactNode
  onMes: (primero: Date) => void
  onDia: (dia: Date) => void
  onTipo: (tipo: ApiEvent['type'] | '') => void
  onResumen: (resumen: ResumenDeHoy) => void
  onBorrar: (evento: EventoDelCalendario) => void
}

/**
 * La agenda del CMS como un calendario: la barra del mes (anterior, siguiente,
 * hoy y los tipos, que filtran), el mes y, al lado, el día elegido.
 *
 * El mes, el día y el tipo viven en la URL (los guarda AgendaAdminPage): al
 * volver de editar un acto se vuelve al mismo sitio. Sin día en la URL se
 * abre hoy si cae en el mes, y si no, el día 1.
 */
export default function CalendarioAgenda({ primero, dia, tipo, volver, version, hoy = new Date(), conmutador, onMes, onDia, onTipo, onResumen, onBorrar }: Props) {
  const { dias, desde, hasta } = useMemo(() => rejillaDelMes(primero), [primero])
  const [eventos, setEventos] = useState<EventoDelCalendario[] | null>(null)
  const [portada, setPortada] = useState<number[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Solo la última petición escribe: pasar tres meses deprisa lanza tres
    // que pueden volver en otro orden.
    let vigente = true
    setCargando(true)
    calendarioDelCms(desde, hasta, tipo)
      .then(({ eventos: recibidos, resumen }) => {
        if (!vigente) return
        setEventos(recibidos); setPortada(resumen.portada.ids); onResumen(resumen); setError(null)
      })
      .catch((err: unknown) => { if (vigente) setError(err instanceof Error ? err.message : 'No se ha podido cargar el calendario.') })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
    // onResumen es un setState del padre: no cambia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde.getTime(), hasta.getTime(), tipo, version])

  const { alto, ref } = useAltoHastaAbajo(useMediaQuery(useTheme().breakpoints.up('lg')) && eventos !== null)
  const porDia = useMemo(() => actosPorDia(eventos ?? [], dias), [eventos, dias])
  const enUrl = leerDia(dia)
  const mismoMes = (fecha: Date) => fecha.getFullYear() === primero.getFullYear() && fecha.getMonth() === primero.getMonth()
  const elegido = enUrl && mismoMes(enUrl) ? enUrl : mismoMes(hoy) ? hoy : primero

  const irA = (desplazamiento: number) => onMes(new Date(primero.getFullYear(), primero.getMonth() + desplazamiento, 1))

  return <>
    <Paper sx={{ p: 1.25, pl: 1.5, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
      <IconButton size="small" aria-label="Mes anterior" onClick={() => irA(-1)}><ChevronLeftIcon /></IconButton>
      <IconButton size="small" aria-label="Mes siguiente" onClick={() => irA(1)}><ChevronRightIcon /></IconButton>
      <Typography component="h2" sx={{ fontSize: 20, fontWeight: 600, mx: 0.75, minWidth: { sm: 190 } }}>{tituloDelMes(primero)}</Typography>
      <Button size="small" variant="outlined" color="inherit" disabled={mismoMes(hoy) && claveDia(elegido) === claveDia(hoy)} onClick={() => { onMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1)); onDia(hoy) }} sx={{ borderColor: 'divider' }}>
        Hoy
      </Button>
      <Box role="group" aria-label="Tipo" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, ml: { md: 'auto' } }}>
        {TIPOS_EVENTO.map((t) => (
          <FiltroTipo key={t.valor} valor={t.valor} nombre={t.nombre} activo={tipo === t.valor} apagado={tipo !== '' && tipo !== t.valor} onClick={() => onTipo(tipo === t.valor ? '' : t.valor)} />
        ))}
      </Box>
      <Box sx={{ ml: { xs: 'auto', md: 0 } }}>{conmutador}</Box>
    </Paper>

    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    {eventos === null ? (cargando && <CircularProgress aria-label="Cargando el calendario" />) : (
      <Box ref={ref} sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 300px' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ position: 'relative', minWidth: 0 }}>
          {cargando && <LinearProgress aria-label="Cargando el mes" sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1, borderRadius: 1 }} />}
          <VistaMes primero={primero} dias={dias} porDia={porDia} elegido={claveDia(elegido)} portada={portada} hoy={hoy} alto={alto} onElegir={onDia} />
        </Box>
        <PanelDelDia dia={elegido} actos={porDia.get(claveDia(elegido)) ?? []} portada={portada} volver={volver} altoMaximo={alto} onBorrar={onBorrar} />
      </Box>
    )}
  </>
}

/** Lo que deja el contenido del CMS por debajo (su relleno en escritorio, MarcoCms). */
const RELLENO_ABAJO = 32
/** Por debajo de esto las casillas no dan para un acto: mejor el alto de siempre y scroll. */
const ALTO_MINIMO = 480

/**
 * El alto que queda desde el principio del calendario hasta el final de la
 * ventana, para que el mes quepa entero sin scroll. Se vuelve a medir al
 * cambiar la ventana o lo de arriba (un aviso que aparece). `null` si no se
 * mide (móvil y tabletas, donde el panel va debajo) o no da para el mes.
 */
function useAltoHastaAbajo(activo: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [alto, setAlto] = useState<number | null>(null)
  useLayoutEffect(() => {
    const caja = ref.current
    if (!activo || !caja) { setAlto(null); return }
    const medir = () => {
      const arriba = caja.getBoundingClientRect().top + window.scrollY
      const libre = Math.floor(window.innerHeight - arriba - RELLENO_ABAJO)
      setAlto((antes) => {
        const nuevo = libre >= ALTO_MINIMO ? libre : null
        return antes !== null && nuevo !== null && Math.abs(antes - nuevo) < 2 ? antes : nuevo
      })
    }
    medir()
    window.addEventListener('resize', medir)
    // Lo de arriba (un aviso, el título que salta de línea) mueve el calendario sin cambiar la ventana.
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    if (caja.parentElement) observador?.observe(caja.parentElement)
    return () => { window.removeEventListener('resize', medir); observador?.disconnect() }
  }, [activo])
  return { alto, ref }
}

/** Un tipo en la barra: pulsado, el mes enseña solo ese; pulsado otra vez, todos. */
function FiltroTipo({ valor, nombre, activo, apagado, onClick }: { valor: ApiEvent['type']; nombre: string; activo: boolean; apagado: boolean; onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={activo}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.4, borderRadius: 99, fontFamily: 'inherit', fontSize: 12.5,
        border: 1, borderColor: activo ? 'text.primary' : 'divider', color: activo ? 'text.primary' : 'text.secondary',
        opacity: apagado ? 0.5 : 1, fontWeight: activo ? 600 : 400,
        '&:hover': { opacity: 1, borderColor: 'text.secondary' },
        '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'text.primary', outlineOffset: 2 },
      }}
    >
      <Box component="span" aria-hidden="true" sx={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: colores(valor).filete }} />
      {nombre}
    </ButtonBase>
  )
}
