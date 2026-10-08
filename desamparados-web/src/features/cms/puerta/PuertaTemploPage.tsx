import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, LinearProgress, List, ListItem, ListItemText, Paper, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import CabeceraSeccion from '../CabeceraSeccion'
import LectorQr from './LectorQr'
import { deshacerEntrada, entrarAMano, escanearPapeleta, estadoPuerta, type Lectura, type PapeletaEnPuerta, type Veredicto } from '../../../lib/api/puerta'
import type { Salida } from '../../../lib/api/salidas'
import AvisoSinSalidas from '../../procesion/AvisoSinSalidas'
import SelectorSalida from '../../procesion/SelectorSalida'
import { useSalidaElegida } from '../../procesion/useSalidas'
import { site } from '../../../config/site'
import { deArticulo, deLaCorporacion } from '../../../domain/articulos'

/** Las cuentas se refrescan solas: varios diputados escanean a la vez en distintas puertas. */
const SONDEO_MS = 5_000
/** Lo que espera la cámara antes de volver a leer. */
const PAUSA_MS = 1_800
/**
 * Lo que dura el resultado en pantalla. Fijo, el aviso de la papeleta anterior
 * se confundía con la siguiente. El mismo código leído en este tiempo es el
 * mismo gesto (la papeleta sigue delante de la cámara), no otra entrada: con un
 * margen menor, un «Adelante» pasaba solo a «Ya había entrado».
 */
const RESULTADO_MS = 4_000

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
// En hora de Madrid, la de la salida, aunque el móvil del diputado tenga otra zona.
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })
const nombre = (p: PapeletaEnPuerta) => `${p.nombre} ${p.apellidos}`
const sitio = (p: PapeletaEnPuerta) => [p.puesto, p.tramo, p.numero !== null ? `n.º ${p.numero}` : null].filter(Boolean).join(' · ')

const TEXTO: Record<Veredicto, { titulo: string; tono: 'success' | 'warning' | 'error' }> = {
  ENTRA: { titulo: 'Adelante', tono: 'success' },
  REPETIDA: { titulo: 'Ya había entrado', tono: 'warning' },
  OTRA_SALIDA: { titulo: 'Papeleta de otra salida', tono: 'error' },
  DE_BAJA: { titulo: 'De baja en el censo', tono: 'error' },
  ANULADA: { titulo: 'Papeleta anulada', tono: 'error' },
  FALSO: { titulo: 'No es una papeleta válida', tono: 'error' },
}

/** El título de una lectura: el QR de una familia sin papeletas no es una «papeleta anulada». */
function titulo(l: Lectura, tono: { titulo: string }): string {
  if (l.familia && l.veredicto === 'ANULADA') return 'Sin papeletas de esta salida'
  if (l.familia && l.veredicto === 'OTRA_SALIDA') return 'QR de familia de otra salida'
  return tono.titulo
}

function explicacion(l: Lectura, salida: Salida, salidas: Salida[], year?: number): string {
  const p = l.papeleta
  if (l.familia && l.veredicto === 'OTRA_SALIDA') return `Es de otra salida o de otro año, no ${deArticulo(salida.articulo, salida.nombre)}${year ? ` ${year}` : ''}.`
  if (l.familia && l.veredicto === 'ANULADA') return 'Esa familia no tiene papeletas recogidas para esta salida: que pase por la mesa.'
  switch (l.veredicto) {
    case 'FAMILIA': return ''
    case 'ENTRA': return p ? sitio(p) : ''
    case 'REPETIDA': return p?.entradaEl ? `Entró a las ${hora(p.entradaEl)}${p.entradaPor ? `, lo apuntó ${p.entradaPor}` : ''}.` : ''
    case 'OTRA_SALIDA': {
      if (!p) return ''
      // Una salida ya desactivada no está en la lista: se dice sin nombre.
      const otra = salidas.find((s) => s.slug === p.salida)
      return `Es ${otra ? deArticulo(otra.articulo, otra.nombre) : 'de otra salida,'} ${p.year}, no ${deArticulo(salida.articulo, salida.nombre)}${year ? ` ${year}` : ''}.`
    }
    case 'DE_BAJA': return 'Está de baja: no puede salir. Que hable con Secretaría.'
    case 'ANULADA': return 'La papeleta se anuló: que pase por la mesa.'
    case 'FALSO': return `El código no es de una papeleta ${deLaCorporacion({ corto: true })}, o está dañado. Búscalo por su nombre en «Faltan».`
  }
}

function vibrar(v: Lectura['veredicto']) {
  try { navigator.vibrate?.(v === 'ENTRA' || v === 'FAMILIA' ? 60 : [90, 60, 90]) } catch { /* sin vibración */ }
}

/** La puerta no le deja entrar (ni a mano): no se le ofrece, aunque venga en el QR de su familia. */
const puedeEntrar = (p: PapeletaEnPuerta) => !p.entradaEl && !p.deBaja

/** El QR de una familia leído: quiénes son y a quiénes va a dejar pasar el diputado. */
interface FamiliaEnPuerta {
  papeletas: PapeletaEnPuerta[]
  marcadas: Set<number>
}

/**
 * La puerta del templo: los diputados leen con el móvil el QR de la papeleta
 * de cada hermano al entrar, y todos ven en vivo cuántos faltan por tramo.
 * Quien llega sin la papeleta se busca en «Faltan» y se marca a mano.
 */
export default function PuertaTemploPage() {
  const cliente = useQueryClient()
  const { salidas, salida, elegir, cargando, error: errorSalidas } = useSalidaElegida('puerta.salida')
  // Mientras llegan las salidas, la consulta espera (`enabled`).
  const slug = salida?.slug ?? ''
  const [camara, setCamara] = useState(false)
  const [lectura, setLectura] = useState<Lectura | null>(null)
  const [familia, setFamilia] = useState<FamiliaEnPuerta | null>(null)
  // Los de la familia que acaban de entrar, para decirlo como una lectura más.
  const [entraron, setEntraron] = useState<PapeletaEnPuerta[] | null>(null)
  const [dejandoPasar, setDejandoPasar] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [pestana, setPestana] = useState<'faltan' | 'ultimas'>('faltan')
  const [buscar, setBuscar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ultimo = useRef<{ texto: string; en: number } | null>(null)
  const temporizadores = useRef<{ pausa?: number; resultado?: number }>({})
  useEffect(() => () => {
    window.clearTimeout(temporizadores.current.pausa)
    window.clearTimeout(temporizadores.current.resultado)
  }, [])

  const clave = ['puerta', slug]
  const { data: estado, error: errorCarga } = useQuery({ queryKey: clave, queryFn: () => estadoPuerta(slug), refetchInterval: SONDEO_MS, staleTime: 0, enabled: Boolean(salida) })
  const refrescar = useCallback(() => cliente.invalidateQueries({ queryKey: ['puerta'] }), [cliente])

  /** Cada resultado empieza su cuenta: el anterior no puede borrar el nuevo antes de tiempo. */
  const contar = useCallback(() => {
    window.clearTimeout(temporizadores.current.pausa)
    window.clearTimeout(temporizadores.current.resultado)
    temporizadores.current.pausa = window.setTimeout(() => setPausado(false), PAUSA_MS)
    temporizadores.current.resultado = window.setTimeout(() => { setLectura(null); setEntraron(null) }, RESULTADO_MS)
  }, [])

  const mostrar = useCallback((l: Lectura) => {
    setError(null)
    setEntraron(null)
    vibrar(l.veredicto)
    setPausado(true)
    if (l.veredicto === 'FAMILIA' && l.familia) {
      // La familia espera a que el diputado diga quién está: ni se borra sola
      // ni se lee otra papeleta encima hasta entonces.
      window.clearTimeout(temporizadores.current.pausa)
      window.clearTimeout(temporizadores.current.resultado)
      setLectura(null)
      setFamilia({ papeletas: l.familia, marcadas: new Set(l.familia.filter(puedeEntrar).map((p) => p.id)) })
      return
    }
    setFamilia(null)
    setLectura(l)
    contar()
    void refrescar()
  }, [contar, refrescar])

  const marcar = (id: number) => setFamilia((f) => {
    if (!f) return f
    const marcadas = new Set(f.marcadas)
    if (marcadas.has(id)) marcadas.delete(id)
    else marcadas.add(id)
    return { ...f, marcadas }
  })

  const cancelarFamilia = () => { setFamilia(null); setPausado(false) }

  /** Entran los marcados, de uno en uno como a mano: el que no vino entra luego con su QR. */
  const dejarPasar = async () => {
    if (!familia) return
    setDejandoPasar(true)
    const resultados = await Promise.allSettled([...familia.marcadas].map((id) => entrarAMano(id, slug)))
    setDejandoPasar(false)
    const dentro = resultados.flatMap((r) => (r.status === 'fulfilled' && r.value.veredicto === 'ENTRA' && r.value.papeleta ? [r.value.papeleta] : []))
    const fallos = resultados.length - dentro.length
    setFamilia(null)
    setEntraron(dentro)
    setError(fallos > 0 ? `${fallos === 1 ? 'Una entrada no se ha podido apuntar' : `${fallos} entradas no se han podido apuntar`}: búscalas en «Faltan».` : null)
    contar()
    void refrescar()
  }

  const leer = useCallback(async (texto: string) => {
    const limpio = texto.trim()
    if (!limpio) return
    const ahora = Date.now()
    if (ultimo.current && ultimo.current.texto === limpio && ahora - ultimo.current.en < RESULTADO_MS) return
    ultimo.current = { texto: limpio, en: ahora }
    try { mostrar(await escanearPapeleta(limpio.slice(0, 64), slug)) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido comprobar la papeleta. Vuelve a intentarlo.')) }
  }, [mostrar, slug])

  const aMano = async (p: PapeletaEnPuerta) => {
    try { mostrar(await entrarAMano(p.id, slug)) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido apuntar la entrada.')) }
  }

  const deshacer = async (p: PapeletaEnPuerta) => {
    try { await deshacerEntrada(p.id); setLectura(null); await refrescar() }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido deshacer la entrada.')) }
  }

  const faltan = useMemo(() => {
    const q = buscar.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
    const lista = estado?.faltan ?? []
    if (!q) return lista
    return lista.filter((p) => `${nombre(p)} ${p.numeroHermano ?? ''} ${p.tramo ?? ''}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q))
  }, [estado, buscar])

  const cambiarSalida = (nueva: string) => { elegir(nueva); setLectura(null); setFamilia(null); setEntraron(null); setError(null) }
  const tono = lectura && lectura.veredicto !== 'FAMILIA' ? TEXTO[lectura.veredicto] : null
  const porEntrar = familia ? familia.papeletas.filter(puedeEntrar).length : 0
  const familiaDeBaja = familia ? familia.papeletas.some((p) => p.deBaja && !p.entradaEl) : false

  if (cargando) return <CircularProgress aria-label="Cargando la puerta" />
  if (!salida) {
    return <>
      <CabeceraSeccion titulo="Puerta del templo" />
      <AvisoSinSalidas error={errorSalidas} />
    </>
  }

  return <>
    <Helmet><title>{`Puerta del templo | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion
      titulo="Puerta del templo"
      subtitulo={estado ? `${salida.nombre} ${estado.year} · ${estado.dentro} de ${estado.total} dentro${estado.deBaja > 0 ? ` · ${estado.deBaja} de baja` : ''}` : salida.nombre}
    >
      <SelectorSalida salidas={salidas} valor={slug} onChange={cambiarSalida} />
    </CabeceraSeccion>

    <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 5fr) minmax(0, 4fr)' }, alignItems: 'start' }}>
      <Stack spacing={2}>
        {/* El resultado, grande: se lee de un vistazo con la papeleta todavía en la mano. */}
        <Box role="status" aria-live="assertive">
          {lectura && tono && (
            <Alert severity={tono.tono} variant="filled" sx={{ '& .MuiAlert-message': { width: '100%' } }}
              action={lectura.veredicto === 'ENTRA' && lectura.papeleta ? <Button color="inherit" size="small" onClick={() => void deshacer(lectura.papeleta!)}>Deshacer</Button> : undefined}>
              <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{titulo(lectura, tono)}</Typography>
              {lectura.papeleta && <Typography sx={{ fontSize: 19, fontWeight: 600, mt: 0.5 }}>{nombre(lectura.papeleta)}{lectura.papeleta.numeroHermano ? ` · n.º ${lectura.papeleta.numeroHermano}` : ''}</Typography>}
              <Typography sx={{ mt: 0.25 }}>{explicacion(lectura, salida, salidas, estado?.year)}</Typography>
            </Alert>
          )}
          {entraron && entraron.length > 0 && (
            <Alert severity="success" variant="filled" sx={{ '& .MuiAlert-message': { width: '100%' } }}>
              <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{entraron.length === 1 ? 'Adelante' : `Adelante, los ${entraron.length}`}</Typography>
              {entraron.map((p) => <Typography key={p.id} sx={{ fontSize: 17, fontWeight: 600, mt: 0.25 }}>{nombre(p)} <Box component="span" sx={{ fontWeight: 400, fontSize: 15 }}>· {sitio(p)}</Box></Typography>)}
            </Alert>
          )}
        </Box>

        {/* El QR de una familia: el diputado mira quién está y deja pasar a esos. */}
        {familia && (
          <Paper role="group" aria-label="QR de familia" sx={{ p: 2, border: 2, borderColor: 'success.main' }}>
            <Typography sx={{ fontSize: 20, fontWeight: 700 }}>QR de familia · {familia.papeletas.length} papeletas</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.25, mb: 1 }}>
              {porEntrar > 0 ? 'Desmarca al que no esté: entrará luego con su propia papeleta.'
                : familiaDeBaja ? 'No queda nadie que pueda entrar.' : 'Ya habían entrado todos.'}
            </Typography>
            <Stack>
              {familia.papeletas.map((p) => p.entradaEl
                ? (
                  <Box key={p.id} sx={{ py: 0.75, pl: 4 }}>
                    <Typography sx={{ fontWeight: 600 }}>{nombre(p)}</Typography>
                    <Typography variant="body2" sx={{ color: 'warning.main' }}>Ya entró a las {hora(p.entradaEl)}{p.entradaPor ? `, lo apuntó ${p.entradaPor}` : ''}</Typography>
                  </Box>
                )
                : p.deBaja
                  ? (
                    <Box key={p.id} sx={{ py: 0.75, pl: 4 }}>
                      <Typography sx={{ fontWeight: 600 }}>{nombre(p)}</Typography>
                      <Typography variant="body2" sx={{ color: 'error.main' }}>De baja en el censo: no puede salir. Que hable con Secretaría.</Typography>
                    </Box>
                  )
                : (
                  <FormControlLabel
                    key={p.id}
                    control={<Checkbox checked={familia.marcadas.has(p.id)} onChange={() => marcar(p.id)} />}
                    label={<><Typography component="span" sx={{ fontWeight: 600, display: 'block' }}>{nombre(p)}</Typography><Typography component="span" variant="body2" color="text.secondary">{sitio(p)}</Typography></>}
                    sx={{ py: 0.25, alignItems: 'center' }}
                  />
                ))}
            </Stack>
            <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
              {porEntrar > 0 && (
                <Button variant="contained" color="success" size="large" disabled={familia.marcadas.size === 0 || dejandoPasar} onClick={() => void dejarPasar()} sx={{ flexGrow: 1 }}>
                  {familia.marcadas.size === 1 ? 'Dejar pasar a 1' : `Dejar pasar a los ${familia.marcadas.size}`}
                </Button>
              )}
              <Button variant="outlined" size="large" onClick={cancelarFamilia} disabled={dejandoPasar}>{porEntrar === 0 ? 'Cerrar' : 'Cancelar'}</Button>
            </Stack>
          </Paper>
        )}
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

        {camara
          ? <>
            <LectorQr onCodigo={(t) => void leer(t)} pausado={pausado} />
            <Button variant="outlined" onClick={() => setCamara(false)}>Cerrar la cámara</Button>
          </>
          : <Button size="large" variant="contained" onClick={() => setCamara(true)} sx={{ py: 2, fontSize: 18 }}>Abrir la cámara y leer papeletas</Button>}

        {/* Un lector de mano escribe el código y pulsa Intro: entra por aquí, como escrito a mano. */}
        <Box component="form" onSubmit={(e) => { e.preventDefault(); void leer(codigo); setCodigo('') }}>
          <TextField fullWidth size="small" label="Código de la papeleta" value={codigo} onChange={(e) => setCodigo(e.target.value)}
            helperText="Con un lector de mano, o escrito: DSP1.…" slotProps={{ htmlInput: { autoComplete: 'off', autoCapitalize: 'off', spellCheck: false, maxLength: 64 } }} />
        </Box>
      </Stack>

      <Stack spacing={2}>
        {errorCarga && !estado && <Alert severity="error">{mensaje(errorCarga, 'No se ha podido cargar la puerta.')}</Alert>}
        {estado && (
          <Paper sx={{ p: 2 }}>
            <Typography component="h2" sx={{ fontWeight: 600, mb: 1.5 }}>Por tramos</Typography>
            {estado.tramos.length === 0 && <Typography color="text.secondary">No hay papeletas de esta salida todavía.</Typography>}
            <Stack spacing={1.25}>
              {estado.tramos.map((t) => (
                <Box key={t.tramo ?? 'sin-tramo'}>
                  <Stack direction="row" sx={{ mb: 0.25, justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{t.tramo ?? 'Sin tramo'}</Typography>
                    <Typography variant="body2" color="text.secondary">{t.dentro} de {t.total}{t.total > t.dentro ? ` · faltan ${t.total - t.dentro}` : ' · completo'}</Typography>
                  </Stack>
                  <LinearProgress variant="determinate" value={t.total ? (100 * t.dentro) / t.total : 0} aria-label={`${t.tramo ?? 'Sin tramo'}: ${t.dentro} de ${t.total} dentro`} sx={{ height: 8, borderRadius: 4 }} />
                </Box>
              ))}
            </Stack>
          </Paper>
        )}

        {estado && (
          <Paper sx={{ p: 2 }}>
            <Tabs value={pestana} onChange={(_e, v: 'faltan' | 'ultimas') => setPestana(v)} sx={{ mb: 1 }}>
              <Tab value="faltan" label={`Faltan (${estado.total - estado.dentro})`} />
              <Tab value="ultimas" label="Últimas entradas" />
            </Tabs>
            {pestana === 'faltan' ? <>
              <TextField fullWidth size="small" label="Buscar por nombre, número o tramo" value={buscar} onChange={(e) => setBuscar(e.target.value)} sx={{ my: 1 }} />
              <List dense sx={{ maxHeight: 360, overflow: 'auto' }}>
                {faltan.slice(0, 200).map((p) => (
                  <ListItem key={p.id} divider secondaryAction={<Button size="small" onClick={() => void aMano(p)}>Ha entrado</Button>} sx={{ pr: 14 }}>
                    <ListItemText primary={nombre(p)} secondary={sitio(p)} />
                  </ListItem>
                ))}
                {faltan.length === 0 && <Typography color="text.secondary" sx={{ py: 1 }}>{buscar ? 'Nadie con ese nombre por entrar.' : 'Ya han entrado todos.'}</Typography>}
              </List>
            </> : (
              <List dense>
                {estado.ultimas.map((p) => (
                  <ListItem key={p.id} divider secondaryAction={<Button size="small" onClick={() => void deshacer(p)}>Deshacer</Button>} sx={{ pr: 12 }}>
                    <ListItemText primary={nombre(p)} secondary={`${p.entradaEl ? hora(p.entradaEl) : ''} · ${sitio(p)}${p.entradaPor ? ` · ${p.entradaPor}` : ''}`} />
                  </ListItem>
                ))}
                {estado.ultimas.length === 0 && <Typography color="text.secondary" sx={{ py: 1 }}>Todavía no ha entrado nadie.</Typography>}
              </List>
            )}
          </Paper>
        )}
      </Stack>
    </Box>
  </>
}
