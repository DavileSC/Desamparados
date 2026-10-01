import { useCallback, useMemo, useRef, useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, LinearProgress, List, ListItem, ListItemText, Paper, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import CabeceraSeccion from '../CabeceraSeccion'
import LectorQr from './LectorQr'
import { deshacerEntrada, entrarAMano, escanearPapeleta, estadoPuerta, type Lectura, type PapeletaEnPuerta, type Veredicto } from '../../../lib/api/puerta'
import type { Salida } from '../../../lib/api/salidas'
import SelectorSalida from '../../procesion/SelectorSalida'
import { useSalidaElegida } from '../../procesion/useSalidas'
import { site } from '../../../config/site'

/** Las cuentas se refrescan solas: varios diputados escanean a la vez en distintas puertas. */
const SONDEO_MS = 5_000
/** Lo que se queda el resultado en pantalla antes de volver a leer. */
const PAUSA_MS = 1_800
/** El mismo código leído otra vez en este tiempo es el mismo gesto, no otra entrada. */
const REPETICION_MS = 4_000

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
const nombre = (p: PapeletaEnPuerta) => `${p.nombre} ${p.apellidos}`
const sitio = (p: PapeletaEnPuerta) => [p.puesto, p.tramo, p.numero !== null ? `n.º ${p.numero}` : null].filter(Boolean).join(' · ')

const TEXTO: Record<Veredicto, { titulo: string; tono: 'success' | 'warning' | 'error' }> = {
  ENTRA: { titulo: 'Adelante', tono: 'success' },
  REPETIDA: { titulo: 'Ya había entrado', tono: 'warning' },
  OTRA_SALIDA: { titulo: 'Papeleta de otra salida', tono: 'error' },
  ANULADA: { titulo: 'Papeleta anulada', tono: 'error' },
  FALSO: { titulo: 'No es una papeleta válida', tono: 'error' },
}

function explicacion(l: Lectura, salida: Salida, salidas: Salida[], year?: number): string {
  const p = l.papeleta
  switch (l.veredicto) {
    case 'ENTRA': return p ? sitio(p) : ''
    case 'REPETIDA': return p?.entradaEl ? `Entró a las ${hora(p.entradaEl)}${p.entradaPor ? `, lo apuntó ${p.entradaPor}` : ''}.` : ''
    case 'OTRA_SALIDA': {
      if (!p) return ''
      // Una salida ya desactivada no está en la lista: se dice sin nombre.
      const otra = salidas.find((s) => s.slug === p.salida)?.nombre
      return `Es ${otra ? `del ${otra}` : 'de otra salida,'} ${p.year}, no del ${salida.nombre}${year ? ` ${year}` : ''}.`
    }
    case 'ANULADA': return 'La papeleta se anuló: que pase por la mesa.'
    case 'FALSO': return 'El código no es de una papeleta del Grupo, o está dañado. Búscalo por su nombre en «Faltan».'
  }
}

function vibrar(v: Veredicto) {
  try { navigator.vibrate?.(v === 'ENTRA' ? 60 : [90, 60, 90]) } catch { /* sin vibración */ }
}

/**
 * La puerta del templo: los diputados leen con el móvil el QR de la papeleta
 * de cada hermano al entrar, y todos ven en vivo cuántos faltan por tramo.
 * Quien llega sin la papeleta se busca en «Faltan» y se marca a mano.
 */
export default function PuertaTemploPage() {
  const cliente = useQueryClient()
  const { salidas, salida, elegir, cargando } = useSalidaElegida('puerta.salida')
  // Mientras llegan las salidas, la consulta espera (`enabled`).
  const slug = salida?.slug ?? ''
  const [camara, setCamara] = useState(false)
  const [lectura, setLectura] = useState<Lectura | null>(null)
  const [pausado, setPausado] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [pestana, setPestana] = useState<'faltan' | 'ultimas'>('faltan')
  const [buscar, setBuscar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const ultimo = useRef<{ texto: string; en: number } | null>(null)

  const clave = ['puerta', slug]
  const { data: estado, error: errorCarga } = useQuery({ queryKey: clave, queryFn: () => estadoPuerta(slug), refetchInterval: SONDEO_MS, staleTime: 0, enabled: Boolean(salida) })
  const refrescar = useCallback(() => cliente.invalidateQueries({ queryKey: ['puerta'] }), [cliente])

  const mostrar = useCallback((l: Lectura) => {
    setLectura(l)
    setError(null)
    vibrar(l.veredicto)
    setPausado(true)
    window.setTimeout(() => setPausado(false), PAUSA_MS)
    void refrescar()
  }, [refrescar])

  const leer = useCallback(async (texto: string) => {
    const limpio = texto.trim()
    if (!limpio) return
    const ahora = Date.now()
    if (ultimo.current && ultimo.current.texto === limpio && ahora - ultimo.current.en < REPETICION_MS) return
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

  const cambiarSalida = (nueva: string) => { elegir(nueva); setLectura(null); setError(null) }
  const tono = lectura ? TEXTO[lectura.veredicto] : null

  if (cargando) return <CircularProgress aria-label="Cargando la puerta" />
  if (!salida) {
    return <>
      <CabeceraSeccion titulo="Puerta del templo" />
      <Alert severity="info">
        No hay salidas activas. Créalas en <Box component={Link} to="/cms/procesion/salidas" sx={{ color: 'inherit', fontWeight: 600 }}>Procesión → Salidas</Box>.
      </Alert>
    </>
  }

  return <>
    <Helmet><title>{`Puerta del templo | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion
      titulo="Puerta del templo"
      subtitulo={estado ? `${salida.nombre} ${estado.year} · ${estado.dentro} de ${estado.total} dentro` : salida.nombre}
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
              <Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{tono.titulo}</Typography>
              {lectura.papeleta && <Typography sx={{ fontSize: 19, fontWeight: 600, mt: 0.5 }}>{nombre(lectura.papeleta)}{lectura.papeleta.numeroHermano ? ` · n.º ${lectura.papeleta.numeroHermano}` : ''}</Typography>}
              <Typography sx={{ mt: 0.25 }}>{explicacion(lectura, salida, salidas, estado?.year)}</Typography>
            </Alert>
          )}
        </Box>
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
