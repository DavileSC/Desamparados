import { useMemo, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react'
import {
  Alert, Box, Button, ButtonBase, Chip, CircularProgress, FormControlLabel, Menu, MenuItem, Paper, Radio, RadioGroup, Stack, TextField, Typography,
  type SxProps, type Theme,
} from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useBlocker } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import CabeceraSeccion from './CabeceraSeccion'
import AvisoCambiosSinGuardar from './ficha/AvisoCambiosSinGuardar'
import { useAvisoAlCerrarLaPestana } from '../../hooks/useAvisoAlCerrarLaPestana'
import {
  guardarRetablo, traerRetablo,
  type AjustesRetablo, type CuentaAtras, type CuentaDeHoy, type OpcionesRetablo, type TiempoCalculado, type TiempoDelRetablo,
} from '../../lib/api/panel'
import { subirImagenPublica } from '../../lib/api/subida'
import { CLAVE_PANEL_HOY } from '../../app/usePanelDeHoy'
import { FOTO_POR_DEFECTO } from './inicio/Retablo'
import { ORO_CLARO } from './inicio/estiloRetablo'
import { conArticulo } from '../../domain/articulos'
import { fotosDelAnio, hoyEnTexto, tiempoDelDia, tramoEnPalabras } from '../../domain/tiemposDelRetablo'
import { site } from '../../config/site'
import { useFotoQueFalla } from '../../hooks/useFotoQueFalla'
import { useAhora } from '../../hooks/useAhora'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024
const DE_SIEMPRE = { foto: null, x: 50, y: 30 }
/** Los tiempos que caben además del de todo el año: el tope del servidor. */
const MAX_TIEMPOS = 8
const acotar = (n: number) => Math.min(100, Math.max(0, Math.round(n)))

const NOMBRES: Record<TiempoCalculado, string> = { cuaresma: 'Cuaresma', 'semana-santa': 'Semana Santa', navidad: 'Navidad' }
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DIAS_DEL_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

const nombreDe = (t: TiempoDelRetablo) => (t.tiempo === 'a-mano' ? t.nombre || 'Fechas a mano' : NOMBRES[t.tiempo])
const fechaLarga = (dia: string) => new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  .format(new Date(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10))))
const diasHasta = (dia: string) => {
  const hoy = new Date()
  return Math.round((Date.UTC(Number(dia.slice(0, 4)), Number(dia.slice(5, 7)) - 1, Number(dia.slice(8, 10))) - Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) / 86_400_000)
}

/**
 * Una foto de las vistas previas, o `hueco` si no hay o falla. La de partida
 * del retablo es una fija de la instalación (`FOTO_POR_DEFECTO`): en la que no
 * la tiene da 404, y el navegador pintaría el icono roto con el texto encima.
 */
function FotoOHueco({ src, alt, sx, hueco = null }: { src: string; alt: string; sx: SxProps<Theme>; hueco?: ReactNode }) {
  const { visible, alFallar } = useFotoQueFalla(src)
  return visible ? <Box component="img" src={src} alt={alt} onError={alFallar} sx={sx} /> : <>{hueco}</>
}

/** La foto recortada como en el Inicio: en columna (ordenador) o en franja (móvil), con su cuenta atrás. */
function Vista({ foto, x, y, forma, cuenta }: { foto: string; x: number; y: number; forma: 'columna' | 'franja'; cuenta: CuentaDeHoy | null }) {
  const columna = forma === 'columna'
  const dias = cuenta ? diasHasta(cuenta.fecha) : null
  return (
    <Stack spacing={0.75} sx={{ minWidth: 0 }}>
      <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: 1.5, backgroundColor: '#0b0a0c', ...(columna ? { width: 140, aspectRatio: '9 / 19' } : { width: '100%', maxWidth: 420, aspectRatio: '4 / 1' }) }}>
        <FotoOHueco src={foto} alt="" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${x}% ${y}%`, opacity: 0.85 }} />
        <Box sx={{ position: 'absolute', inset: 0, background: columna ? 'linear-gradient(180deg, rgba(18,16,19,0) 45%, #121013 100%)' : 'linear-gradient(90deg, rgba(18,16,19,.85), rgba(18,16,19,.1))' }} />
        {cuenta && dias !== null && (
          <Box sx={{ position: 'absolute', left: 12, right: 8, bottom: 8, color: '#f7f1e8', display: 'flex', flexDirection: columna ? 'column' : 'row', alignItems: columna ? 'flex-start' : 'baseline', columnGap: 1 }}>
            <Typography component="span" sx={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 30, lineHeight: 1 }}>
              {dias} <Box component="em" sx={{ fontSize: 15, color: '#d8cfc6' }}>{dias === 1 ? 'día' : 'días'}</Box>
            </Typography>
            <Typography component="span" sx={{ fontSize: 11, lineHeight: 1.3, color: '#c9bfb6' }}>
              {cuenta.articulo ? `para ${conArticulo(cuenta.articulo, cuenta.nombre)}` : cuenta.nombre}
            </Typography>
          </Box>
        )}
      </Box>
      <Typography variant="caption" color="text.secondary">{columna ? 'En el ordenador' : 'En el móvil'}</Typography>
    </Stack>
  )
}

/** El día y el mes de unas fechas a mano (`MM-DD`), con dos desplegables. */
function DiaDelAnio({ etiqueta, valor, onCambiar }: { etiqueta: string; valor: string; onCambiar: (v: string) => void }) {
  const mes = Number(valor.slice(0, 2))
  const dia = Number(valor.slice(3, 5))
  const poner = (m: number, d: number) => onCambiar(`${String(m).padStart(2, '0')}-${String(Math.min(d, DIAS_DEL_MES[m - 1])).padStart(2, '0')}`)
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Typography variant="body2" sx={{ width: 48 }}>{etiqueta}</Typography>
      <TextField select size="small" label="Día" value={dia} onChange={(e) => poner(mes, Number(e.target.value))} sx={{ width: 86 }}>
        {Array.from({ length: DIAS_DEL_MES[mes - 1] }, (_, i) => <MenuItem key={i + 1} value={i + 1}>{i + 1}</MenuItem>)}
      </TextField>
      <TextField select size="small" label="Mes" value={mes} onChange={(e) => poner(Number(e.target.value), dia)} sx={{ width: 150 }}>
        {MESES.map((m, i) => <MenuItem key={m} value={i + 1}>{m}</MenuItem>)}
      </TextField>
    </Stack>
  )
}

/** Cada día del año con la foto que le toca, en tramos: se ve de un vistazo cuándo cambia. */
function BarraDelAnio({ ajustes }: { ajustes: AjustesRetablo }) {
  const hoy = useAhora()
  const anio = hoy.getFullYear()
  const tramos = useMemo(() => {
    const dias = fotosDelAnio(ajustes.tiempos, anio)
    const lista: { indice: number; dias: number }[] = []
    for (const i of dias) {
      const ultimo = lista[lista.length - 1]
      if (ultimo && ultimo.indice === i) ultimo.dias += 1
      else lista.push({ indice: i, dias: 1 })
    }
    return { lista, total: dias.length }
  }, [ajustes.tiempos, anio])
  const diaDelAnio = Math.round((Date.UTC(anio, hoy.getMonth(), hoy.getDate()) - Date.UTC(anio, 0, 1)) / 86_400_000)
  const encuadre = (i: number) => (i < 0 ? { foto: ajustes.foto ?? FOTO_POR_DEFECTO, x: ajustes.x, y: ajustes.y } : ajustes.tiempos[i])
  return (
    <Stack spacing={0.75} aria-label={`Qué foto toca cada día de ${anio}`} role="img">
      <Box sx={{ position: 'relative', display: 'flex', height: 56, borderRadius: 1.5, overflow: 'hidden', bgcolor: '#0b0a0c' }}>
        {tramos.lista.map((t, n) => {
          const e = encuadre(t.indice)
          return <Box key={n} title={t.indice < 0 ? 'Todo el año' : nombreDe(ajustes.tiempos[t.indice])} sx={{ flexGrow: t.dias, flexBasis: 0, backgroundImage: e.foto ? `url(${e.foto})` : 'none', backgroundSize: 'cover', backgroundPosition: `${e.x}% ${e.y}%`, borderRight: '1px solid rgba(0,0,0,.35)' }} />
        })}
        <Box sx={{ position: 'absolute', top: 0, bottom: 0, width: 2, bgcolor: ORO_CLARO, left: `${(diaDelAnio / tramos.total) * 100}%` }} />
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)' }}>
        {MESES_CORTOS.map((m) => <Typography key={m} variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m}</Typography>)}
      </Box>
      <Typography variant="caption" color="text.secondary">La raya dorada es hoy.</Typography>
    </Stack>
  )
}

/** Lo que contaría el retablo con lo elegido, para la vista previa. */
function cuentaElegida(cuenta: CuentaAtras, opciones: OpcionesRetablo): CuentaDeHoy | null {
  if (cuenta.tipo === 'proxima') return opciones.proxima
  if (cuenta.tipo === 'salida') {
    const s = opciones.salidas?.find((x) => x.id === cuenta.salidaId)
    return s?.fecha ? { nombre: s.nombre, articulo: s.articulo, fecha: s.fecha } : null
  }
  if (cuenta.tipo === 'acto') {
    const a = opciones.actos?.find((x) => x.id === cuenta.eventoId)
    return a ? { nombre: a.nombre, articulo: null, fecha: a.fecha } : null
  }
  return null
}

/**
 * Sistema › Ajustes del Inicio: el retablo que ve toda la junta al entrar al
 * CMS. Hasta qué cuenta los días (la próxima salida, una salida, un acto de
 * la Agenda o nada) y sus fotos: la de todo el año y, si se quiere, otras
 * para la Cuaresma, la Semana Santa, la Navidad o unas fechas a mano. De
 * cada foto se pulsa lo que nunca debe cortarse (el rostro): en el ordenador
 * el retablo es una columna alta y en el móvil una franja baja, así que un
 * encuadre solo vertical no bastaba. Con las flechas del teclado también se
 * mueve el punto.
 */
export default function AjustesInicioPage() {
  const cliente = useQueryClient()
  const { data, isPending, isError } = useQuery({ queryKey: ['panel', 'retablo'], queryFn: traerRetablo })
  const [ajustes, setAjustes] = useState<AjustesRetablo>({ ...DE_SIEMPRE, tiempos: [], cuenta: { tipo: 'proxima' } })
  // -1 es la foto de todo el año; si no, el tiempo de esa posición.
  const [elegido, setElegido] = useState(-1)
  const [menuTiempos, setMenuTiempos] = useState<HTMLElement | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)

  // Lo del servidor pasa al formulario cada vez que llega (al pintar y no en un
  // efecto, que enseñaba un instante los ajustes de siempre).
  const [copiado, setCopiado] = useState<typeof data>(undefined)
  if (data && data !== copiado) {
    setCopiado(data)
    setAjustes({ foto: data.foto, x: data.x, y: data.y, tiempos: data.tiempos, cuenta: data.cuenta })
  }

  const guardar = useMutation({
    mutationFn: () => guardarRetablo(ajustes),
    onSuccess: async (guardado) => {
      cliente.setQueryData(['panel', 'retablo'], guardado)
      await cliente.invalidateQueries({ queryKey: CLAVE_PANEL_HOY })
    },
  })

  // Antes de los `return` de abajo, porque los avisos son hooks. Mientras lo
  // del servidor aún no ha pasado al formulario, no hay nada sin guardar.
  const sinGuardar = Boolean(data && data === copiado) &&
    JSON.stringify(ajustes) !== JSON.stringify({ foto: data!.foto, x: data!.x, y: data!.y, tiempos: data!.tiempos, cuenta: data!.cuenta })
  // Una foto movida, un tiempo nuevo: al ir a otra pantalla del CMS o cerrar
  // la pestaña se perdían sin preguntar, como no pasa en las demás fichas.
  const bloqueo = useBlocker(({ currentLocation, nextLocation }) => sinGuardar && currentLocation.pathname !== nextLocation.pathname)
  useAvisoAlCerrarLaPestana(sinGuardar)

  if (isPending) return <CircularProgress aria-label="Cargando los ajustes del Inicio" />
  if (isError) return <Alert severity="error">No se han podido cargar los ajustes del Inicio. Inténtalo de nuevo en unos minutos.</Alert>

  const opciones = data.opciones
  const cambiar = (cambio: Partial<AjustesRetablo>) => { setAjustes((a) => ({ ...a, ...cambio })); guardar.reset() }
  const ponerTiempo = (i: number, cambio: Partial<TiempoDelRetablo>) =>
    cambiar({ tiempos: ajustes.tiempos.map((t, j) => (j === i ? { ...t, ...cambio } as TiempoDelRetablo : t)) })

  const encuadre = elegido < 0 ? { foto: ajustes.foto, x: ajustes.x, y: ajustes.y } : ajustes.tiempos[elegido]
  const fotoVisible = encuadre.foto || FOTO_POR_DEFECTO
  const indiceDeHoy = tiempoDelDia(ajustes.tiempos, hoyEnTexto())
  const deHoy = indiceDeHoy < 0 ? { foto: ajustes.foto ?? FOTO_POR_DEFECTO, x: ajustes.x, y: ajustes.y } : ajustes.tiempos[indiceDeHoy]
  const cuentaPrevia = cuentaElegida(ajustes.cuenta, opciones)

  const sinFoto = ajustes.tiempos.find((t) => !t.foto)
  const sinNombre = ajustes.tiempos.find((t) => t.tiempo === 'a-mano' && !t.nombre.trim())
  const falta = sinFoto ? `Falta la foto de «${nombreDe(sinFoto)}».` : sinNombre ? 'Ponle nombre a las fechas a mano.' : null

  const mover = (x: number, y: number) => {
    if (elegido < 0) cambiar({ x: acotar(x), y: acotar(y) })
    else ponerTiempo(elegido, { x: acotar(x), y: acotar(y) })
  }
  const pulsar = (e: MouseEvent<HTMLDivElement>) => {
    const caja = e.currentTarget.getBoundingClientRect()
    mover(((e.clientX - caja.left) / caja.width) * 100, ((e.clientY - caja.top) / caja.height) * 100)
  }
  const conTeclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const paso = e.shiftKey ? 10 : 2
    const cambio: Record<string, [number, number]> = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }
    const d = cambio[e.key]
    if (!d) return
    e.preventDefault()
    mover(encuadre.x + d[0], encuadre.y + d[1])
  }

  const elegirFoto = async (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return
    setErrorFoto(null)
    if (!TIPOS.includes(archivo.type)) return setErrorFoto('La foto tiene que ser JPG, PNG o WebP.')
    if (archivo.size > MAX_BYTES) return setErrorFoto('La foto pesa más de 5 MB. Redúcela antes de subirla.')
    setSubiendo(true)
    try {
      const ruta = await subirImagenPublica(archivo)
      // Una foto nueva empieza con el punto en el centro, un poco arriba: donde suele estar el rostro.
      const nueva = { foto: ruta, x: 50, y: 35 }
      if (elegido < 0) cambiar(nueva)
      else ponerTiempo(elegido, nueva)
    } catch (e: unknown) {
      setErrorFoto(e instanceof Error ? e.message : 'No se ha podido subir la foto.')
    } finally {
      setSubiendo(false)
    }
  }

  const anadirTiempo = (tiempo: TiempoCalculado | 'a-mano') => {
    setMenuTiempos(null)
    const nuevo: TiempoDelRetablo = tiempo === 'a-mano'
      ? { tiempo, nombre: '', desde: '05-01', hasta: '05-31', foto: '', x: 50, y: 35 }
      : { tiempo, foto: '', x: 50, y: 35 }
    cambiar({ tiempos: [...ajustes.tiempos, nuevo] })
    setElegido(ajustes.tiempos.length)
  }
  const quitarTiempo = (i: number) => {
    cambiar({ tiempos: ajustes.tiempos.filter((_, j) => j !== i) })
    setElegido(-1)
  }
  const yaEsta = (t: TiempoCalculado) => ajustes.tiempos.some((x) => x.tiempo === t)

  const ponerCuenta = (tipo: CuentaAtras['tipo']) => {
    if (tipo === 'salida') cambiar({ cuenta: { tipo, salidaId: opciones.salidas?.[0]?.id ?? 0 } })
    else if (tipo === 'acto') cambiar({ cuenta: { tipo, eventoId: opciones.actos?.[0]?.id ?? 0 } })
    else cambiar({ cuenta: { tipo } })
  }
  const filas: { indice: number; nombre: string; detalle: string; foto: string | null; x: number; y: number }[] = [
    { indice: -1, nombre: 'Todo el año', detalle: ajustes.foto ? 'Cuando no toca otra.' : 'La de siempre, cuando no toca otra.', foto: ajustes.foto ?? FOTO_POR_DEFECTO, x: ajustes.x, y: ajustes.y },
    ...ajustes.tiempos.map((t, i) => ({ indice: i, nombre: nombreDe(t), detalle: tramoEnPalabras(t), foto: t.foto || null, x: t.x, y: t.y })),
  ]

  return (
    <>
      <Helmet><title>{`Ajustes del Inicio | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion titulo="Ajustes del Inicio" subtitulo="El retablo que ve toda la junta al entrar al CMS: su cuenta atrás y sus fotos." />
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 420px)' } }}>
          <Stack spacing={1.5} sx={{ minWidth: 0 }}>
            <Typography variant="h3" component="h2" sx={{ fontSize: 22 }}>Cuenta atrás</Typography>
            <Typography variant="body2" color="text.secondary">
              Los días que salen al pie de la Virgen. Con «La próxima salida» cambia sola: cuando pasa una salida, cuenta hacia la siguiente.
            </Typography>
            <RadioGroup aria-label="Hasta qué cuenta el retablo" value={ajustes.cuenta.tipo} onChange={(e) => ponerCuenta(e.target.value as CuentaAtras['tipo'])}>
              <FormControlLabel value="proxima" disabled={!opciones.salidas} control={<Radio />} label={
                <Box><Typography>La próxima salida</Typography><Typography variant="body2" color="text.secondary">
                  {!opciones.salidas ? 'Procesión está apagada.' : opciones.proxima ? `Ahora: ${opciones.proxima.nombre}, ${fechaLarga(opciones.proxima.fecha)}` : 'Ninguna salida tiene fecha por delante.'}
                </Typography></Box>} />
              <FormControlLabel value="salida" disabled={!opciones.salidas?.length} control={<Radio />} label={
                <Box><Typography>Una salida concreta</Typography><Typography variant="body2" color="text.secondary">
                  {!opciones.salidas ? 'Procesión está apagada.' : 'Se queda fija aunque haya otra antes.'}
                </Typography></Box>} />
              {ajustes.cuenta.tipo === 'salida' && opciones.salidas && (
                <TextField select size="small" label="Salida" value={ajustes.cuenta.salidaId} onChange={(e) => cambiar({ cuenta: { tipo: 'salida', salidaId: Number(e.target.value) } })} sx={{ ml: 4, mb: 1, maxWidth: 420 }}>
                  {opciones.salidas.map((s) => <MenuItem key={s.id} value={s.id}>{s.nombre}{s.fecha ? ` · ${fechaLarga(s.fecha)}` : ' · sin fecha'}</MenuItem>)}
                </TextField>
              )}
              <FormControlLabel value="acto" disabled={!opciones.actos?.length} control={<Radio />} label={
                <Box><Typography>Un acto de la Agenda</Typography><Typography variant="body2" color="text.secondary">
                  {!opciones.actos ? 'La Agenda está apagada.' : opciones.actos.length ? 'Un culto, el triduo, una convivencia… Cuando pasa, el retablo se queda sin cuenta.' : 'No hay actos por delante en la Agenda.'}
                </Typography></Box>} />
              {ajustes.cuenta.tipo === 'acto' && opciones.actos && (
                <TextField select size="small" label="Acto" value={ajustes.cuenta.eventoId} onChange={(e) => cambiar({ cuenta: { tipo: 'acto', eventoId: Number(e.target.value) } })} sx={{ ml: 4, mb: 1, maxWidth: 420 }}>
                  {opciones.actos.map((a) => <MenuItem key={a.id} value={a.id}>{a.nombre} · {fechaLarga(a.fecha)}</MenuItem>)}
                </TextField>
              )}
              <FormControlLabel value="ninguna" control={<Radio />} label={<Box><Typography>Sin cuenta atrás</Typography><Typography variant="body2" color="text.secondary">Solo la foto.</Typography></Box>} />
            </RadioGroup>
          </Stack>
          <Stack spacing={1.5} sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary">Así se verá hoy</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', gap: 2, alignItems: 'start' }}>
              <Vista foto={deHoy.foto || FOTO_POR_DEFECTO} x={deHoy.x} y={deHoy.y} forma="columna" cuenta={cuentaPrevia} />
              <Vista foto={deHoy.foto || FOTO_POR_DEFECTO} x={deHoy.x} y={deHoy.y} forma="franja" cuenta={cuentaPrevia} />
            </Box>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 420px)' } }}>
          <Stack spacing={1.5} sx={{ minWidth: 0 }}>
            <Typography variant="h3" component="h2" sx={{ fontSize: 22 }}>Fotos del retablo</Typography>
            <Typography variant="body2" color="text.secondary">
              Una para todo el año y, si quieres, otras para tiempos concretos. La Cuaresma y la Semana Santa se calculan solas cada año. Si coinciden dos, manda la más corta. Pulsa una para cambiar su foto o su encuadre.
            </Typography>
            <Stack spacing={1} role="list" aria-label="Fotos del retablo">
              {filas.map((f) => {
                const activa = f.indice === elegido
                return (
                  <Box key={f.indice} role="listitem" sx={{ display: 'flex', alignItems: 'center', gap: 1, border: 1, borderColor: activa ? 'primary.main' : 'divider', borderRadius: 1.5, pr: 1 }}>
                    <ButtonBase onClick={() => setElegido(f.indice)} aria-pressed={activa} aria-label={`${f.nombre}: cambiar su foto o su encuadre`}
                      sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', gap: 1.5, p: 1, textAlign: 'left', borderRadius: 1.5 }}>
                      <Box sx={{ width: 48, height: 60, flex: 'none', borderRadius: 1, overflow: 'hidden', bgcolor: '#0b0a0c' }}>
                        {f.foto && <FotoOHueco src={f.foto} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${f.x}% ${f.y}%`, display: 'block' }} />}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        {/* Un `div`: las etiquetas de MUI son bloques y no caben dentro de un párrafo. */}
                        <Typography component="div" sx={{ fontWeight: 600 }}>
                          {f.nombre}
                          {f.indice === indiceDeHoy && <Chip label="En uso hoy" size="small" color="primary" sx={{ ml: 1, height: 20, fontSize: 11 }} />}
                          {!f.foto && <Chip label="Sin foto" size="small" color="warning" sx={{ ml: 1, height: 20, fontSize: 11 }} />}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">{f.detalle}</Typography>
                      </Box>
                    </ButtonBase>
                    {f.indice >= 0 && <Button size="small" color="inherit" onClick={() => quitarTiempo(f.indice)} aria-label={`Quitar ${f.nombre}`}>Quitar</Button>}
                  </Box>
                )
              })}
            </Stack>
            <Box>
              <Button variant="outlined" disabled={ajustes.tiempos.length >= MAX_TIEMPOS} onClick={(e) => setMenuTiempos(e.currentTarget)}>Añadir un tiempo</Button>
              <Menu anchorEl={menuTiempos} open={Boolean(menuTiempos)} onClose={() => setMenuTiempos(null)}>
                {(Object.keys(NOMBRES) as TiempoCalculado[]).map((t) => (
                  <MenuItem key={t} disabled={yaEsta(t)} onClick={() => anadirTiempo(t)}>{NOMBRES[t]}{yaEsta(t) ? ' (ya está)' : ''}</MenuItem>
                ))}
                <MenuItem onClick={() => anadirTiempo('a-mano')}>Fechas a mano…</MenuItem>
              </Menu>
            </Box>
            <Typography variant="overline" color="text.secondary" sx={{ pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
              Foto de «{elegido < 0 ? 'Todo el año' : nombreDe(ajustes.tiempos[elegido])}»
            </Typography>
            {elegido >= 0 && ajustes.tiempos[elegido].tiempo === 'a-mano' && (() => {
              const t = ajustes.tiempos[elegido] as Extract<TiempoDelRetablo, { tiempo: 'a-mano' }>
              return (
                <Stack spacing={1.25}>
                  <TextField size="small" label="Nombre" value={t.nombre} slotProps={{ htmlInput: { maxLength: 40 } }} placeholder="Mes de mayo" onChange={(e) => ponerTiempo(elegido, { nombre: e.target.value })} />
                  <DiaDelAnio etiqueta="Desde" valor={t.desde} onCambiar={(desde) => ponerTiempo(elegido, { desde })} />
                  <DiaDelAnio etiqueta="Hasta" valor={t.hasta} onCambiar={(hasta) => ponerTiempo(elegido, { hasta })} />
                </Stack>
              )
            })()}
            <Typography id="punto-ayuda" variant="body2" color="text.secondary">
              Pulsa en la foto lo que nunca debe cortarse: se queda a la vista en el ordenador y en el móvil. También puedes moverlo con las flechas.
            </Typography>
            {encuadre.foto || elegido < 0 ? (
              <Box
                role="slider"
                tabIndex={0}
                aria-label="Punto de la foto que no se recorta"
                aria-describedby="punto-ayuda"
                aria-valuetext={`${encuadre.x} % desde la izquierda, ${encuadre.y} % desde arriba`}
                aria-valuenow={encuadre.x}
                aria-valuemin={0}
                aria-valuemax={100}
                onClick={pulsar}
                onKeyDown={conTeclas}
                sx={{ position: 'relative', alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 1.5, overflow: 'hidden', cursor: 'crosshair', backgroundColor: '#0b0a0c', '&:focus-visible': { outline: `2px solid ${ORO_CLARO}`, outlineOffset: 2 } }}
              >
                <FotoOHueco
                  src={fotoVisible}
                  alt="Foto del retablo"
                  sx={{ display: 'block', width: 'auto', maxWidth: '100%', height: 'auto', maxHeight: 280, userSelect: 'none', pointerEvents: 'none' }}
                  // Sin foto, un hueco del tamaño de la columna: el punto se sigue pudiendo poner.
                  hueco={<Box sx={{ width: 133, height: 280, display: 'grid', placeItems: 'center', p: 2, textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,.6)' }}>Sin foto: elige una</Box>}
                />
                <Box aria-hidden="true" sx={{ position: 'absolute', left: `${encuadre.x}%`, top: `${encuadre.y}%`, width: 34, height: 34, ml: '-17px', mt: '-17px', borderRadius: '50%', border: `2px solid ${ORO_CLARO}`, boxShadow: '0 0 0 3px rgba(0,0,0,.45)' }} />
              </Box>
            ) : (
              <Box sx={{ py: 5, textAlign: 'center', border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 1.5, color: 'text.secondary', maxWidth: 360 }}>Este tiempo aún no tiene foto.</Box>
            )}
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <Button component="label" variant="outlined" disabled={subiendo} startIcon={subiendo ? <CircularProgress size={16} /> : undefined}>
                {subiendo ? 'Subiendo…' : encuadre.foto ? 'Cambiar foto' : 'Elegir foto'}
                <Box component="input" type="file" accept={TIPOS.join(',')} onChange={elegirFoto} sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }} />
              </Button>
              {elegido < 0 && (
                <Button variant="outlined" disabled={ajustes.foto === null && ajustes.x === DE_SIEMPRE.x && ajustes.y === DE_SIEMPRE.y} onClick={() => cambiar(DE_SIEMPRE)}>
                  Volver a la de siempre
                </Button>
              )}
            </Stack>
            {errorFoto && <Alert severity="error">{errorFoto}</Alert>}
          </Stack>

          <Stack spacing={1.5} sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary">Así se verá</Typography>
            {encuadre.foto || elegido < 0 ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', gap: 2, alignItems: 'start' }}>
                <Vista foto={fotoVisible} x={encuadre.x} y={encuadre.y} forma="columna" cuenta={null} />
                <Vista foto={fotoVisible} x={encuadre.x} y={encuadre.y} forma="franja" cuenta={null} />
              </Box>
            ) : <Typography variant="body2" color="text.secondary">Elige una foto para verla aquí.</Typography>}
            {/* Con una sola foto, la barra sería una franja entera de la misma: no dice nada. */}
            {ajustes.tiempos.length > 0 && <>
              <Typography variant="overline" color="text.secondary" sx={{ pt: 1 }}>El año, foto a foto</Typography>
              <BarraDelAnio ajustes={ajustes} />
            </>}
          </Stack>
        </Paper>

        {guardar.isError && <Alert severity="error">{guardar.error.message}</Alert>}
        {guardar.isSuccess && !sinGuardar && <Alert severity="success">Guardado: la junta ya lo ve en el Inicio.</Alert>}
        <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
          {falta && sinGuardar && <Typography variant="body2" color="text.secondary">{falta}</Typography>}
          <Button variant="contained" disabled={!sinGuardar || Boolean(falta) || guardar.isPending || subiendo} onClick={() => guardar.mutate()}>
            {guardar.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </Stack>
      </Stack>
      <AvisoCambiosSinGuardar bloqueo={bloqueo} deQue="los ajustes del Inicio" />
    </>
  )
}
