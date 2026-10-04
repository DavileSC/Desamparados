import { useRef, useState, type KeyboardEvent } from 'react'
import { Alert, Box, CircularProgress } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useAuthStore } from '../altas/auth/store'
import { usePanelDeHoy } from '../../app/usePanelDeHoy'
import { useModulos } from '../../hooks/useModulos'
import { tareasDelDia } from './inicio/tareas'
import Retablo from './inicio/Retablo'
import Cabecera from './inicio/Cabecera'
import Hoy from './inicio/Hoy'
import Cifras from './inicio/Cifras'
import { useAltoDisponible } from './inicio/useAltoDisponible'
import { ORO, ROSA_URGENTE, FILETE } from './inicio/estiloRetablo'
import { site } from '../../config/site'

const PESTANAS = [
  { clave: 'hoy', texto: 'Hoy' },
  { clave: 'cifras', texto: 'Cifras' },
] as const
type Pestana = (typeof PESTANAS)[number]['clave']

/** La última pestaña abierta se recuerda en este navegador; si no se puede leer, «Hoy». */
const GUARDADA = 'cms.inicio.pestana'
function pestanaGuardada(): Pestana {
  try {
    return localStorage.getItem(GUARDADA) === 'cifras' ? 'cifras' : 'hoy'
  } catch {
    return 'hoy'
  }
}

/**
 * El Inicio del CMS, en forma de retablo: a la izquierda, la Virgen a todo lo
 * alto con los días que faltan para la estación; a la derecha, el saludo y dos
 * pestañas: «Hoy» (los asuntos, el próximo acto y el curso) y «Cifras» (las
 * cuatro cifras de la casa, una en grande).
 *
 * Cabe siempre en la pantalla, sin scroll: mide lo que queda de ventana y la
 * pestaña abierta se queda con el hueco que sobra.
 *
 * El detalle de cada área (el censo, el dinero, la procesión por años) no va
 * aquí: está en «Datos e informes», de la junta.
 */
export default function PanelPage() {
  const role = useAuthStore((state) => state.cms?.role)
  const userId = useAuthStore((state) => state.cms?.id)
  const { data, isPending, isError } = usePanelDeHoy()
  const { activos } = useModulos()
  const { referencia, alto } = useAltoDisponible()
  const [pestana, setPestana] = useState<Pestana>(pestanaGuardada)
  const botones = useRef<(HTMLButtonElement | null)[]>([])

  if (isPending) {
    return <CircularProgress aria-label="Cargando el Inicio" />
  }

  if (isError || !data) {
    return <Alert severity="error">No se ha podido cargar el Inicio. Inténtalo de nuevo en unos minutos.</Alert>
  }

  // Sin lista de módulos todavía, no se enseñan tareas de módulo: mejor que aparecer y desaparecer.
  const tareas = tareasDelDia(data, undefined, activos ?? new Set())
  const hayUrgente = tareas.some((t) => t.prioridad === 'urgente')

  const abrir = (clave: Pestana) => {
    setPestana(clave)
    try { localStorage.setItem(GUARDADA, clave) } catch { /* sin almacenamiento, se abre «Hoy» la próxima vez */ }
  }
  // Las flechas pasan de una pestaña a otra, como en cualquier lista de pestañas.
  const conTeclas = (e: KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    const siguiente = (i + (e.key === 'ArrowRight' ? 1 : -1) + PESTANAS.length) % PESTANAS.length
    abrir(PESTANAS[siguiente].clave)
    botones.current[siguiente]?.focus()
  }

  return (
    <Box
      ref={referencia}
      sx={{
        // A sangre: el retablo llega a los bordes del panel, sin el margen del marco.
        m: { xs: -2.5, md: -4 },
        height: alto ?? '100dvh', overflow: 'hidden',
        containerType: 'inline-size', containerName: 'inicio',
      }}
    >
      <Helmet><title>{`Inicio | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <Box
        sx={{
          height: '100%', display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: 'clamp(96px, 15vh, 170px) minmax(0, 1fr)',
          '@container inicio (min-width: 720px)': {
            gridTemplateColumns: 'clamp(220px, 28%, 400px) minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr)',
          },
        }}
      >
        <Retablo foto={data.retablo?.foto ?? undefined} x={data.retablo?.x} y={data.retablo?.y} cuenta={data.retablo?.cuenta} />
        <Box
          sx={{
            minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', containerType: 'inline-size', containerName: 'columna',
            px: { xs: 2, sm: 3, md: 4, lg: 6 }, pt: 'clamp(12px, min(3vh, 3vw), 32px)', pb: 'clamp(10px, 2vh, 24px)', gap: 'clamp(8px, 1.6vh, 14px)',
            '& > *': { flexShrink: 0 },
          }}
        >
          <Cabecera role={role} actividad={data.actividad} />
          <Box role="tablist" aria-label="Inicio" sx={{ display: 'flex', gap: 3.5, borderBottom: `1px solid ${FILETE}` }}>
            {PESTANAS.map((p, i) => {
              const activa = p.clave === pestana
              return (
                <Box
                  key={p.clave}
                  component="button"
                  type="button"
                  role="tab"
                  id={`inicio-pestana-${p.clave}`}
                  aria-selected={activa}
                  aria-controls="inicio-panel"
                  tabIndex={activa ? 0 : -1}
                  ref={(nodo: HTMLButtonElement | null) => { botones.current[i] = nodo }}
                  onClick={() => abrir(p.clave)}
                  onKeyDown={(e: KeyboardEvent) => conTeclas(e, i)}
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 1, height: 'clamp(34px, 5.4vh, 42px)', px: 0.25, mb: '-1px',
                    border: 0, borderBottom: '2px solid', borderColor: activa ? ORO : 'transparent', background: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 12, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase',
                    color: activa ? 'text.primary' : 'text.secondary',
                    '&:hover': { color: 'text.primary' },
                    '&:focus-visible': { outline: `2px solid ${ORO}`, outlineOffset: 2 },
                  }}
                >
                  {p.texto}
                  {p.clave === 'hoy' && hayUrgente && (
                    <Box component="span" role="img" aria-label="hay algo urgente" sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: ROSA_URGENTE }} />
                  )}
                </Box>
              )
            })}
          </Box>
          <Box
            id="inicio-panel"
            role="tabpanel"
            aria-labelledby={`inicio-pestana-${pestana}`}
            sx={{
              flex: '1 1 0 !important', minHeight: 0, display: 'flex', flexDirection: 'column',
              // En el móvil no cabe todo: la pestaña se desplaza dentro y la página no.
              '@container columna (max-width: 559px)': { overflowY: 'auto' },
            }}
          >
            {pestana === 'hoy'
              ? <Hoy tareas={tareas} role={role} userId={userId} eventos={data.anio.eventos} />
              : <Cifras panel={data} />}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
