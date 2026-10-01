import { useCallback, useEffect, useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, IconButton, Paper, Stack, Tab, Tabs, Tooltip, Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import WifiOffOutlinedIcon from '@mui/icons-material/WifiOffOutlined'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../altas/auth/store'
import { apuntados, colasDeLaMesa, fichaDeMesa, imprimirPapeleta, sinDevolver, type ZonaDeBusqueda } from '../../../lib/api/mesa'
import AvisoSinSalidas from '../../procesion/AvisoSinSalidas'
import SelectorSalida from '../../procesion/SelectorSalida'
import { useSalidaElegida } from '../../procesion/useSalidas'
import CabeceraSeccion from '../CabeceraSeccion'
import CampoBusqueda from '../listados/CampoBusqueda'
import AltaEnMesa from './AltaEnMesa'
import BuscadorPersonas from './BuscadorPersonas'
import ColaDeZona from './ColaDeZona'
import FormularioCorreccion from './FormularioCorreccion'
import ListaSinDevolver from './ListaSinDevolver'
import PreparacionRopa from './PreparacionRopa'
import TablaApuntados from './TablaApuntados'
import ZonaInscripcion from './ZonaInscripcion'
import ZonaTesoreria from './ZonaTesoreria'
import ZonaTunicas from './ZonaTunicas'
import ZonaDevolucion from './ZonaDevolucion'
import type { Aviso } from './piezas'
import { CLAVE_MESA, mensajeDeFallo, useMesaEnVivo } from './enVivo'
import { fechaCorta } from './formato'
import { site } from '../../../config/site'
import { aArticulo } from '../../../domain/articulos'

type Zona = 'inscripcion' | 'tesoreria' | 'tunicas' | 'listado' | 'preparacion' | 'devolucion'
type Modo = { tipo: 'buscar' } | { tipo: 'ficha'; id: number } | { tipo: 'alta' }

const ZONAS: { valor: Zona; etiqueta: string; soloConRopa?: boolean }[] = [
  { valor: 'inscripcion', etiqueta: 'Inscripción' },
  { valor: 'tesoreria', etiqueta: 'Tesorería' },
  { valor: 'tunicas', etiqueta: 'Túnicas' },
  { valor: 'listado', etiqueta: 'Listado' },
  { valor: 'preparacion', etiqueta: 'Preparar ropa', soloConRopa: true },
  // Al final, para no mover los atajos de siempre: Alt+6.
  { valor: 'devolucion', etiqueta: 'Devolución', soloConRopa: true },
]

const BUSQUEDA_DE: Record<'inscripcion' | 'tesoreria' | 'tunicas' | 'listado' | 'devolucion', ZonaDeBusqueda> = {
  inscripcion: 'inscripcion', tesoreria: 'tesoreria', tunicas: 'tunicas', listado: 'todas', devolucion: 'devolucion',
}
const ID_BUSCADOR = 'buscador-mesa'

/** Cada ordenador recuerda su zona (y su salida, en `useSalidaElegida`): al abrir la mesa, sigue donde estaba. */
function recordado<T extends string>(clave: string, validos: readonly T[], porDefecto: T): T {
  try {
    const guardado = localStorage.getItem(clave)
    return validos.includes(guardado as T) ? (guardado as T) : porDefecto
  } catch { return porDefecto }
}
function recordar(clave: string, valor: string) {
  try { localStorage.setItem(clave, valor) } catch { /* sin almacenamiento: no pasa nada */ }
}

/**
 * La mesa de la procesión el día del reparto, por zonas. Cada ordenador es
 * una zona —Inscripción, Tesorería o Túnicas— y la persona pasa de una a
 * otra; cada zona ve al momento a quién le toca (la cola) sin recargar.
 * Además, el listado de apuntados (la hoja de siempre), la ropa por preparar
 * y, después de la salida, la Devolución: todo lo prestado vuelve al ropero.
 *
 * Hecha para ir rápido y con teclado: F2 lleva al buscador, Enter elige y
 * confirma, Esc vuelve a buscar, Alt+1…6 cambia de zona. Si se corta la red,
 * lo dice, y lo que se estaba apuntando no se pierde.
 */
export default function MesaProcesionPage() {
  const role = useAuthStore((s) => s.cms?.role ?? 'USER')
  const queryClient = useQueryClient()
  const { conectado } = useMesaEnVivo()
  const { salidas, salida, elegir, cargando, error: errorSalidas } = useSalidaElegida('mesa.salida')
  // Mientras llegan las salidas no hay ninguna: las consultas esperan (`enabled`).
  const slug = salida?.slug ?? ''
  const conRopa = salida?.conRopa ?? false
  const [zona, setZona] = useState<Zona>(() => recordado('mesa.zona', ZONAS.map((z) => z.valor), 'inscripcion'))
  const [modo, setModo] = useState<Modo>({ tipo: 'buscar' })
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [filtro, setFiltro] = useState<{ q: string; puesto: string; faltaCingulo: boolean }>({ q: '', puesto: '', faltaCingulo: false })

  // En una salida de traje no hay ropa que preparar ni que devolver.
  const zonaVisible: Zona = !conRopa && (zona === 'preparacion' || zona === 'devolucion') ? 'listado' : zona
  const operativa = zonaVisible === 'inscripcion' || zonaVisible === 'tesoreria' || zonaVisible === 'tunicas' || zonaVisible === 'devolucion'

  const listado = useQuery({
    queryKey: [...CLAVE_MESA, 'apuntados', slug, filtro.q, filtro.puesto, filtro.faltaCingulo],
    queryFn: () => apuntados(slug, { ...filtro, faltaCingulo: conRopa && filtro.faltaCingulo }),
    placeholderData: (anterior) => anterior,
    enabled: Boolean(salida) && (zonaVisible === 'listado' || zonaVisible === 'inscripcion' || zonaVisible === 'tunicas'),
  })
  const colas = useQuery({
    queryKey: [...CLAVE_MESA, 'colas', slug],
    queryFn: () => colasDeLaMesa(slug),
    placeholderData: (anterior) => anterior,
    enabled: Boolean(salida) && (zonaVisible === 'tesoreria' || zonaVisible === 'tunicas'),
  })
  const pendientesDeDevolver = useQuery({
    queryKey: [...CLAVE_MESA, 'sin-devolver'],
    queryFn: sinDevolver,
    enabled: zonaVisible === 'devolucion',
  })
  const idFicha = modo.tipo === 'ficha' ? modo.id : null
  const ficha = useQuery({
    queryKey: [...CLAVE_MESA, 'ficha', idFicha, slug],
    queryFn: () => fichaDeMesa(idFicha!, slug),
    enabled: idFicha !== null && Boolean(salida),
  })

  const buscar = useCallback(() => {
    setModo({ tipo: 'buscar' })
    window.setTimeout(() => document.getElementById(ID_BUSCADOR)?.focus(), 0)
  }, [])
  const cambiarZona = useCallback((nueva: Zona) => { setZona(nueva); recordar('mesa.zona', nueva); setAviso(null); buscar() }, [buscar])
  const cambiarSalida = (nueva: string) => { elegir(nueva); setAviso(null); buscar() }
  const abrir = (id: number) => { setAviso(null); setModo({ tipo: 'ficha', id }) }
  const imprimir = async (papeletaId: number) => {
    try { await imprimirPapeleta(papeletaId) } catch (e) { setAviso({ tono: 'warning', texto: mensajeDeFallo(e, 'No se ha podido abrir la papeleta.') }) }
  }
  const deshacer = async (accion: () => Promise<Aviso>) => {
    try { hecho(await accion()) } catch (e) { setAviso({ tono: 'warning', texto: mensajeDeFallo(e, 'No se ha podido deshacer.') }) }
  }
  const hecho = (a: Aviso) => {
    setAviso(a)
    buscar()
    void queryClient.invalidateQueries({ queryKey: CLAVE_MESA })
  }

  // El teclado: F2 al buscador, Esc a buscar otra vez, Alt+número cambia de zona.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); buscar() }
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]')) buscar()
      if (e.altKey && /^[1-6]$/.test(e.key)) {
        const z = ZONAS[Number(e.key) - 1]
        if (z) { e.preventDefault(); cambiarZona(z.valor) }
      }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [buscar, cambiarZona])

  const puestosUsados = listado.data?.puestos.map((p) => p.puesto) ?? []
  const datos = listado.data
  const total = datos?.puestos.reduce((s, p) => s + p.total, 0) ?? 0
  const recogidas = datos?.apuntados.filter((p) => p.estado === 'recogida').length ?? 0

  if (cargando) {
    return <CircularProgress aria-label="Cargando la mesa" />
  }
  if (!salida) {
    return (
      <>
        <CabeceraSeccion titulo="Mesa de la procesión" />
        <AvisoSinSalidas error={errorSalidas} />
      </>
    )
  }

  const panel = (
    <Paper component="section" aria-label="Atender" sx={{ p: 2.5, position: 'sticky', top: 16, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', displayPrint: 'none' }}>
      {aviso && (
        <Alert
          severity={aviso.tono}
          onClose={() => setAviso(null)}
          action={(aviso.deshacer || aviso.papeletaId) && (
            <Stack direction="row" spacing={0.5}>
              {aviso.papeletaId && <Button color="inherit" size="small" onClick={() => void imprimir(aviso.papeletaId!)}>Imprimir papeleta</Button>}
              {aviso.deshacer && <Button color="inherit" size="small" onClick={() => void deshacer(aviso.deshacer!)}>Deshacer</Button>}
            </Stack>
          )}
          sx={{ mb: 2 }}
        >
          {aviso.texto}
        </Alert>
      )}

      {modo.tipo === 'buscar' && (
        <Stack spacing={2}>
          <Typography variant="h5" component="h2">
            {zonaVisible === 'inscripcion' ? 'Apuntar' : zonaVisible === 'tesoreria' ? 'Cobrar' : zonaVisible === 'tunicas' ? (conRopa ? 'Dar la ropa' : 'Confirmar el puesto') : zonaVisible === 'devolucion' ? 'Recibir la ropa' : 'Corregir'}
          </Typography>
          <BuscadorPersonas
            key={`${zonaVisible}-${slug}`}
            id={ID_BUSCADOR}
            autoFocus
            zona={BUSQUEDA_DE[zonaVisible as keyof typeof BUSQUEDA_DE]}
            salida={slug}
            onElegir={(p) => abrir(p.id)}
          />
          {zonaVisible === 'inscripcion' && (
            <Button startIcon={<PersonAddAltOutlinedIcon />} onClick={() => { setAviso(null); setModo({ tipo: 'alta' }) }} sx={{ alignSelf: 'start' }}>
              No está en el censo: darla de alta
            </Button>
          )}
        </Stack>
      )}

      {modo.tipo !== 'buscar' && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <Tooltip title="Buscar a otra persona (Esc)">
            <IconButton aria-label="Buscar a otra persona" onClick={buscar} size="small"><ArrowBackIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Box sx={{ minWidth: 0 }}>
            {modo.tipo === 'alta' && <Typography variant="h5" component="h2">Persona nueva</Typography>}
            {modo.tipo === 'ficha' && ficha.data && (
              <>
                <Typography variant="h5" component="h2" sx={{ overflowWrap: 'anywhere' }}>{ficha.data.nombre} {ficha.data.apellidos}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {ficha.data.numeroHermano ? `N.º ${ficha.data.numeroHermano} · ` : ''}{fechaCorta(ficha.data.fechaNacimiento)}
                </Typography>
              </>
            )}
          </Box>
        </Stack>
      )}

      {modo.tipo === 'alta' && (
        <AltaEnMesa salida={slug} onCancelar={buscar} onHecha={(id, texto) => { setModo({ tipo: 'ficha', id }); setAviso({ tono: 'success', texto }) }} />
      )}

      {modo.tipo === 'ficha' && (
        ficha.isError ? <Alert severity="error">No se ha podido abrir la ficha.</Alert>
          : !ficha.data ? <CircularProgress aria-label="Cargando la ficha" />
            : (() => {
                const f = ficha.data
                const clave = `${zonaVisible}-${f.id}-${f.salida}-${f.solicitud?.id ?? 'sin'}-${f.papeleta?.id ?? 'sin'}-${f.papeleta?.cingulo ?? 'sin'}-${f.situacion}-${f.prendas.map((p) => p.id).join('.')}-${f.cingulosSinDevolver.length}`
                const comun = { ficha: f, salida, role, onHecho: hecho, onRecargar: () => void ficha.refetch() }
                if (zonaVisible === 'inscripcion') return <ZonaInscripcion key={clave} {...comun} puestosUsados={puestosUsados} />
                if (zonaVisible === 'tesoreria') return <ZonaTesoreria key={clave} {...comun} />
                if (zonaVisible === 'devolucion') return <ZonaDevolucion key={clave} ficha={f} onHecho={hecho} />
                if (zonaVisible === 'tunicas') return <ZonaTunicas key={clave} {...comun} puestosUsados={puestosUsados} onATesoreria={() => { setZona('tesoreria'); recordar('mesa.zona', 'tesoreria') }} />
                return f.papeleta || f.solicitud
                  ? <FormularioCorreccion key={clave} {...comun} puestosUsados={puestosUsados} />
                  : <Alert severity="info">{`No está apuntado ${aArticulo(salida.articulo, salida.nombre)}.`}</Alert>
              })()
      )}
    </Paper>
  )

  return (
    <>
      <Helmet><title>{`Mesa de la procesión | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion
        titulo="Mesa de la procesión"
        subtitulo={datos ? `${salida.nombre} ${datos.year} · ${total} ${total === 1 ? 'apuntado' : 'apuntados'}, ${recogidas} ${conRopa ? 'con la ropa' : 'confirmados'}` : salida.nombre}
      >
        <SelectorSalida salidas={salidas} valor={slug} onChange={cambiarSalida} />
      </CabeceraSeccion>

      {!conectado && (
        <Alert severity="warning" icon={<WifiOffOutlinedIcon />} sx={{ mb: 2, displayPrint: 'none' }}>
          <strong>Sin conexión con el servidor.</strong> Lo que estés apuntando no se pierde, pero no se guardará hasta que vuelva la red. Cuando vuelva, pulsa otra vez: no se cobra dos veces.
        </Alert>
      )}

      <Tabs
        value={zonaVisible}
        onChange={(_e, v: Zona) => cambiarZona(v)}
        variant="scrollable"
        aria-label="Zona de la mesa"
        sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider', displayPrint: 'none' }}
      >
        {ZONAS.filter((z) => conRopa || !z.soloConRopa).map((z) => (
          <Tab key={z.valor} value={z.valor} label={z.etiqueta} title={`Alt+${ZONAS.indexOf(z) + 1}`} />
        ))}
      </Tabs>

      {zonaVisible === 'preparacion' && <PreparacionRopa salida={slug} />}

      {zonaVisible !== 'preparacion' && (
        <Box sx={{ containerType: 'inline-size' }}>
          <Box
            sx={{
              display: 'grid', gap: 3, alignItems: 'start',
              gridTemplateColumns: 'minmax(0, 1fr)',
              '@container (min-width: 1000px)': {
                gridTemplateColumns: operativa ? 'minmax(0, 1fr) 380px' : 'minmax(0, 1fr) 440px',
              },
            }}
          >
            {operativa && panel}

            {zonaVisible === 'inscripcion' && (
              <Paper sx={{ p: 2 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', mb: 1 }}>Cómo va</Typography>
                <Typography variant="body2" color="text.secondary">
                  Quien pidió la papeleta en su área y lo tiene todo pagado va directo a Túnicas. Aquí se apunta a quien llega sin haberla pedido: después pasa por Tesorería si debe algo.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  Teclado: <strong>F2</strong> buscar · <strong>Enter</strong> elegir y confirmar · <strong>Esc</strong> volver · <strong>Alt+1…6</strong> zonas.
                </Typography>
              </Paper>
            )}
            {zonaVisible === 'devolucion' && (
              <ListaSinDevolver filas={pendientesDeDevolver.data} error={pendientesDeDevolver.isError} seleccionado={idFicha} onElegir={abrir} />
            )}
            {zonaVisible === 'tesoreria' && (
              <ColaDeZona titulo="Por cobrar" vacia="Nadie esperando para pagar." filas={colas.data?.porCobrar ?? []} seleccionado={idFicha} onElegir={abrir} />
            )}
            {zonaVisible === 'tunicas' && (
              <ColaDeZona
                titulo={conRopa ? 'Listos para la ropa' : 'Listos para confirmar'}
                vacia="Nadie esperando todavía."
                filas={colas.data?.porRecoger ?? []}
                seleccionado={idFicha}
                onElegir={abrir}
              />
            )}

            {zonaVisible === 'listado' && (
              <>
                <Box component="section" aria-label="Apuntados" sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1.5} useFlexGap sx={{ mb: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <CampoBusqueda etiqueta="Buscar entre los apuntados" valor={filtro.q} onCambiar={(q) => setFiltro({ ...filtro, q })} sx={{ maxWidth: 360 }} />
                  </Stack>
                  {conRopa && datos && (datos.faltanCingulos > 0 || filtro.faltaCingulo) && (
                    <Button
                      size="small"
                      variant={filtro.faltaCingulo ? 'contained' : 'outlined'}
                      color={filtro.faltaCingulo ? 'warning' : 'inherit'}
                      aria-pressed={filtro.faltaCingulo}
                      onClick={() => setFiltro({ ...filtro, faltaCingulo: !filtro.faltaCingulo })}
                      sx={{ borderRadius: 999, py: 0.25, mb: 1.5 }}
                    >
                      Le falta el cíngulo · {datos.faltanCingulos}
                    </Button>
                  )}
                  {datos && datos.puestos.length > 0 && (
                    <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 1.5, flexWrap: 'wrap' }} role="group" aria-label="Filtrar por puesto">
                      {[{ puesto: '', total }, ...datos.puestos].map((p) => (
                        <Button
                          key={p.puesto || 'todos'}
                          size="small"
                          variant={filtro.puesto === p.puesto ? 'contained' : 'outlined'}
                          color={filtro.puesto === p.puesto ? 'primary' : 'inherit'}
                          aria-pressed={filtro.puesto === p.puesto}
                          onClick={() => setFiltro({ ...filtro, puesto: p.puesto })}
                          sx={{ borderRadius: 999, py: 0.25 }}
                        >
                          {p.puesto || 'Todos'} · {p.total}
                        </Button>
                      ))}
                    </Stack>
                  )}
                  {listado.isError && <Alert severity="error">No se ha podido cargar el listado de apuntados.</Alert>}
                  {!datos && !listado.isError && <CircularProgress aria-label="Cargando los apuntados" />}
                  {datos && <TablaApuntados apuntados={datos.apuntados} salida={salida} seleccionado={idFicha} onElegir={abrir} onImprimir={(id) => void imprimir(id)} />}
                </Box>
                {panel}
              </>
            )}
          </Box>
        </Box>
      )}
    </>
  )
}
