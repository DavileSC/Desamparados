import { useState, type ReactNode } from 'react'
import {
  Alert, Box, Button, CircularProgress, FormControlLabel, IconButton, MenuItem, Paper, Stack, Switch, TextField, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { Helmet } from 'react-helmet-async'
import { Link, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../altas/auth/store'
import { useSalidas } from '../../procesion/useSalidas'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import { CLAVE_SALIDAS, editarSalida, fijarFechaDeSalida, type DatosSalida, type PuestoDelCatalogo, type Salida } from '../../../lib/api/salidas'
import CabeceraSeccion from '../CabeceraSeccion'
import { fechaConDia } from './formato'
import { site } from '../../../config/site'

const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto)

function Seccion({ titulo, detalle, children }: { titulo: string; detalle?: string; children: ReactNode }) {
  return (
    <Paper component="section" sx={{ p: { xs: 2, md: 3 }, mb: 3, maxWidth: 900, display: 'grid', gap: 2 }}>
      <Box>
        <Typography component="h2" sx={{ fontSize: 18, fontWeight: 600 }}>{titulo}</Typography>
        {detalle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{detalle}</Typography>}
      </Box>
      {children}
    </Paper>
  )
}

interface SeccionProps {
  salida: Salida
  puedeGuardar: boolean
  /** Tras guardar: invalida la caché, para que el listado y esta pantalla vean lo nuevo. */
  onGuardado: () => void
}

/** Datos: nombre, slug, orden y si está activa. */
function SeccionDatos({ salida, puedeGuardar, onGuardado }: SeccionProps) {
  const [nombre, setNombre] = useState(salida.nombre)
  const [slug, setSlug] = useState(salida.slug)
  const [orden, setOrden] = useState(String(salida.orden))
  const [activa, setActiva] = useState(salida.activa)
  const [confirmandoBaja, setConfirmandoBaja] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valido = nombre.trim() !== '' && slug.trim() !== '' && /^\d+$/.test(orden.trim())

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      await editarSalida(salida.id, { nombre: nombre.trim(), slug: slug.trim(), orden: Number(orden), activa })
      onGuardado()
    } catch (e: unknown) {
      setError(mensaje(e, 'No se ha podido guardar.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Seccion titulo="Datos">
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={!puedeGuardar} fullWidth />
      <TextField label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={!puedeGuardar} fullWidth />
      <TextField
        label="Orden"
        type="number"
        value={orden}
        onChange={(e) => setOrden(e.target.value)}
        disabled={!puedeGuardar}
        slotProps={{ htmlInput: { min: 0, step: 1 } }}
        sx={{ maxWidth: 160 }}
      />
      <FormControlLabel
        control={
          <Switch
            checked={activa}
            disabled={!puedeGuardar}
            onChange={(_e, marcada) => (marcada ? setActiva(true) : setConfirmandoBaja(true))}
          />
        }
        label="Activa"
      />
      {puedeGuardar && (
        <Box>
          <Button variant="contained" disabled={guardando || !valido} onClick={() => void guardar()}>Guardar</Button>
        </Box>
      )}

      <DialogoConfirmacion
        abierto={confirmandoBaja}
        titulo="¿Desactivar esta salida?"
        mensaje="Deja de salir en la mesa y en el área de hermanos. Sus papeletas se conservan."
        textoConfirmar="Desactivar"
        peligro
        onConfirmar={() => { setActiva(false); setConfirmandoBaja(false) }}
        onCancelar={() => setConfirmandoBaja(false)}
      />
    </Seccion>
  )
}

/** Fecha: por la Pascua (con hora y lugar) o a mano (que mueve el acto de la Agenda). */
function SeccionFecha({ salida, puedeGuardar, onGuardado }: SeccionProps) {
  const [tipo, setTipo] = useState<DatosSalida['fecha']>(salida.fecha)
  const [diasDesdePascua, setDiasDesdePascua] = useState(salida.diasDesdePascua !== null ? String(salida.diasDesdePascua) : '')
  const [horaPascua, setHoraPascua] = useState(salida.horaSalida ?? '')
  const [lugarPascua, setLugarPascua] = useState(salida.lugar ?? '')
  // A mano: la fecha de este año no trae la hora exacta del acto (solo el día,
  // en fechaDelAnio), así que el campo empieza vacío y hay que volver a escribirla
  // para moverla; no es una limitación de esta pantalla, es lo que da la API.
  const [fechaHoraManual, setFechaHoraManual] = useState('')
  const [lugarManual, setLugarManual] = useState('')
  const [fechaDelAnio, setFechaDelAnio] = useState(salida.fechaDelAnio)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const diasValidos = /^-?\d+$/.test(diasDesdePascua.trim())
  const valido = tipo === 'MANUAL' || diasValidos

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      if (tipo === 'PASCUA') {
        const actualizada = await editarSalida(salida.id, {
          fecha: 'PASCUA',
          diasDesdePascua: Number(diasDesdePascua.trim()),
          horaSalida: horaPascua.trim() || null,
          lugar: lugarPascua.trim() || null,
        })
        setFechaDelAnio(actualizada.fechaDelAnio)
      } else {
        // Primero se pasa la fila a «a mano» (si no lo era ya): fijar la fecha
        // exige que la salida ya esté en ese modo, o el servidor responde 409.
        if (salida.fecha !== 'MANUAL') await editarSalida(salida.id, { fecha: 'MANUAL' })
        if (fechaHoraManual) {
          const fijada = await fijarFechaDeSalida(salida.id, { inicio: new Date(fechaHoraManual).toISOString(), lugar: lugarManual.trim() || null })
          setFechaDelAnio(fijada.fechaDelAnio)
          setFechaHoraManual('')
          setLugarManual('')
        }
      }
      onGuardado()
    } catch (e: unknown) {
      setError(mensaje(e, 'No se ha podido guardar la fecha.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Seccion titulo="Fecha">
      {error && <Alert severity="error">{error}</Alert>}
      <Typography variant="body2" color="text.secondary">
        {fechaDelAnio ? `Este año: ${fechaConDia(fechaDelAnio)}.` : 'Todavía sin fecha para este año.'}
      </Typography>

      <Stack spacing={0.5}>
        <TextField select label="Cuándo es" value={tipo} onChange={(e) => setTipo(e.target.value as DatosSalida['fecha'])} disabled={!puedeGuardar} sx={{ maxWidth: 280 }}>
          <MenuItem value="PASCUA">Por la Pascua</MenuItem>
          <MenuItem value="MANUAL">A mano</MenuItem>
        </TextField>
      </Stack>

      {tipo === 'PASCUA' ? (
        <Stack spacing={2}>
          <TextField
            label="Días desde el Domingo de Resurrección"
            type="number"
            value={diasDesdePascua}
            onChange={(e) => setDiasDesdePascua(e.target.value)}
            helperText="−8 es el Sábado de Pasión."
            disabled={!puedeGuardar}
            sx={{ maxWidth: 320 }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Hora" type="time" value={horaPascua} onChange={(e) => setHoraPascua(e.target.value)} disabled={!puedeGuardar} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Lugar" value={lugarPascua} onChange={(e) => setLugarPascua(e.target.value)} disabled={!puedeGuardar} fullWidth />
          </Stack>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Al guardar se crea (o se mueve) el acto de esta salida en la Agenda.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Día y hora" type="datetime-local" value={fechaHoraManual} onChange={(e) => setFechaHoraManual(e.target.value)} disabled={!puedeGuardar} slotProps={{ inputLabel: { shrink: true } }} />
            <TextField label="Lugar" value={lugarManual} onChange={(e) => setLugarManual(e.target.value)} disabled={!puedeGuardar} fullWidth />
          </Stack>
        </Stack>
      )}

      {puedeGuardar && (
        <Box>
          <Button variant="contained" disabled={guardando || !valido} onClick={() => void guardar()}>Guardar</Button>
        </Box>
      )}
    </Seccion>
  )
}

/** Cobro: cuota (con su importe) o donativo libre. */
function SeccionCobro({ salida, puedeGuardar, onGuardado }: SeccionProps) {
  const [cobro, setCobro] = useState<DatosSalida['cobro']>(salida.cobro)
  const [importe, setImporte] = useState(String(salida.importeCuota).replace('.', ','))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const importeValido = /^\d{1,8}(?:[.,]\d{1,2})?$/.test(importe.trim())
  const valido = cobro === 'DONATIVO' || importeValido

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      await editarSalida(salida.id, { cobro, importeCuota: cobro === 'CUOTA' ? Number(importe.trim().replace(',', '.')) : 0 })
      onGuardado()
    } catch (e: unknown) {
      setError(mensaje(e, 'No se ha podido guardar el cobro.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Seccion titulo="Cobro">
      {error && <Alert severity="error">{error}</Alert>}
      <TextField select label="Cómo se cobra" value={cobro} onChange={(e) => setCobro(e.target.value as DatosSalida['cobro'])} disabled={!puedeGuardar} sx={{ maxWidth: 280 }}>
        <MenuItem value="CUOTA">Cuota</MenuItem>
        <MenuItem value="DONATIVO">Donativo</MenuItem>
      </TextField>
      {cobro === 'CUOTA' && (
        <Stack spacing={0.5}>
          <TextField label="Importe de la cuota (€)" value={importe} onChange={(e) => setImporte(e.target.value)} error={!importeValido} disabled={!puedeGuardar} sx={{ maxWidth: 220 }} />
          {importeValido && Number(importe.replace(',', '.')) === 0 && (
            <Alert severity="info">Con 0 €, el hermano no ve nada que pagar.</Alert>
          )}
        </Stack>
      )}
      {puedeGuardar && (
        <Box>
          <Button variant="contained" disabled={guardando || !valido} onClick={() => void guardar()}>Guardar</Button>
        </Box>
      )}
    </Seccion>
  )
}

/** Ropa: si esta salida reparte ropa del ropero. */
function SeccionRopa({ salida, puedeGuardar, onGuardado }: SeccionProps) {
  const [conRopa, setConRopa] = useState(salida.conRopa)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      await editarSalida(salida.id, { conRopa })
      onGuardado()
    } catch (e: unknown) {
      setError(mensaje(e, 'No se ha podido guardar.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Seccion titulo="Ropa">
      {error && <Alert severity="error">{error}</Alert>}
      <FormControlLabel
        control={<Switch checked={conRopa} disabled={!puedeGuardar} onChange={(_e, marcada) => setConRopa(marcada)} />}
        label="Se da ropa del ropero (túnica, capirote…)"
      />
      {puedeGuardar && (
        <Box>
          <Button variant="contained" disabled={guardando} onClick={() => void guardar()}>Guardar</Button>
        </Box>
      )}
    </Seccion>
  )
}

const PUESTO_VACIO: PuestoDelCatalogo = { nombre: '', tunica: false, tocado: null, alturaHombro: false }

/** Puestos: el catálogo de puestos que se pueden pedir al pedir la papeleta. Mínimo uno. */
function SeccionPuestos({ salida, puedeGuardar, onGuardado }: SeccionProps) {
  const [puestos, setPuestos] = useState<PuestoDelCatalogo[]>(salida.puestos.length > 0 ? salida.puestos : [PUESTO_VACIO])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cambiar = <K extends keyof PuestoDelCatalogo>(i: number, clave: K, valor: PuestoDelCatalogo[K]) =>
    setPuestos((actuales) => actuales.map((p, j) => (i === j ? { ...p, [clave]: valor } : p)))

  const anadir = () => setPuestos((actuales) => [...actuales, PUESTO_VACIO])
  const quitar = (i: number) => setPuestos((actuales) => actuales.filter((_, j) => j !== i))
  const mover = (i: number, hacia: -1 | 1) =>
    setPuestos((actuales) => {
      const destino = i + hacia
      if (destino < 0 || destino >= actuales.length) return actuales
      const copia = [...actuales]
      ;[copia[i], copia[destino]] = [copia[destino], copia[i]]
      return copia
    })

  const valido = puestos.length > 0 && puestos.every((p) => p.nombre.trim() !== '')

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      await editarSalida(salida.id, { puestos: puestos.map((p) => ({ ...p, nombre: p.nombre.trim() })) })
      onGuardado()
    } catch (e: unknown) {
      setError(mensaje(e, 'No se han podido guardar los puestos.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Seccion titulo="Puestos" detalle="Lo que se puede elegir al pedir la papeleta. Al menos uno.">
      {error && <Alert severity="error">{error}</Alert>}
      <Stack spacing={1.5}>
        {puestos.map((p, i) => (
          <Stack key={i} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
            <TextField label="Nombre" value={p.nombre} onChange={(e) => cambiar(i, 'nombre', e.target.value)} disabled={!puedeGuardar} error={p.nombre.trim() === ''} sx={{ flex: '1 1 220px' }} />
            <FormControlLabel control={<Switch checked={p.tunica} disabled={!puedeGuardar} onChange={(_e, v) => cambiar(i, 'tunica', v)} />} label="Túnica" />
            <TextField
              select
              label="Tocado"
              value={p.tocado ?? ''}
              onChange={(e) => cambiar(i, 'tocado', (e.target.value || null) as PuestoDelCatalogo['tocado'])}
              disabled={!puedeGuardar}
              sx={{ minWidth: 160 }}
            >
              <MenuItem value=""><em>Ninguno</em></MenuItem>
              <MenuItem value="CAPIROTE">Capirote</MenuItem>
              <MenuItem value="FARAONA">Faraona</MenuItem>
            </TextField>
            <FormControlLabel control={<Switch checked={p.alturaHombro} disabled={!puedeGuardar} onChange={(_e, v) => cambiar(i, 'alturaHombro', v)} />} label="Altura al hombro" />
            {puedeGuardar && (
              <Stack direction="row" spacing={0.5}>
                <IconButton size="small" aria-label={`Subir ${p.nombre || 'el puesto'}`} disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton>
                <IconButton size="small" aria-label={`Bajar ${p.nombre || 'el puesto'}`} disabled={i === puestos.length - 1} onClick={() => mover(i, 1)}><ArrowDownwardIcon fontSize="small" /></IconButton>
                <IconButton size="small" aria-label={`Quitar ${p.nombre || 'el puesto'}`} disabled={puestos.length === 1} onClick={() => quitar(i)}><DeleteOutlineIcon fontSize="small" /></IconButton>
              </Stack>
            )}
          </Stack>
        ))}
      </Stack>
      {puedeGuardar && (
        <Box>
          <Button startIcon={<AddIcon />} onClick={anadir}>Añadir puesto</Button>
        </Box>
      )}
      {puedeGuardar && (
        <Box>
          <Button variant="contained" disabled={guardando || !valido} onClick={() => void guardar()}>Guardar</Button>
        </Box>
      )}
    </Seccion>
  )
}

/** Indicaciones: texto libre para la papeleta y los correos. */
function SeccionIndicaciones({ salida, puedeGuardar, onGuardado }: SeccionProps) {
  const [texto, setTexto] = useState(salida.indicaciones ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      await editarSalida(salida.id, { indicaciones: texto.trim() || null })
      onGuardado()
    } catch (e: unknown) {
      setError(mensaje(e, 'No se han podido guardar las indicaciones.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Seccion titulo="Indicaciones">
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label="Indicaciones"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        helperText="Van en la papeleta y en los correos: vestimenta, medalla, puntualidad…"
        disabled={!puedeGuardar}
        multiline
        minRows={3}
        fullWidth
      />
      {puedeGuardar && (
        <Box>
          <Button variant="contained" disabled={guardando} onClick={() => void guardar()}>Guardar</Button>
        </Box>
      )}
    </Seccion>
  )
}

/**
 * Edición de una salida, por secciones y cada una con su propio «Guardar»
 * (como las fichas del CMS: ver `ProcesionAdminPage`). El Hermano Mayor ve la
 * pantalla entera pero sin ningún botón de guardar: solo ADMIN y SECRETARIA
 * pueden tocar `/api/cms/salidas`.
 */
export default function SalidaEditPage() {
  const { id } = useParams()
  const cliente = useQueryClient()
  const role = useAuthStore((state) => state.cms?.role ?? 'USER')
  const puedeGuardar = role === 'ADMIN' || role === 'SECRETARIA'
  const { data: salidas, isLoading, error } = useSalidas({ delCms: true })
  const salida = salidas?.find((s) => s.id === Number(id)) ?? null

  const onGuardado = () => void cliente.invalidateQueries({ queryKey: CLAVE_SALIDAS })

  if (!salida) {
    if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress aria-label="Cargando la salida" /></Box>
    return <Alert severity="error">{mensaje(error, 'No existe esa salida.')}</Alert>
  }

  return <>
    <Helmet><title>{`${salida.nombre} | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    <CabeceraSeccion titulo={salida.nombre} subtitulo="Fecha, cobro, ropa, puestos e indicaciones de la salida.">
      <Button component={Link} to="/cms/procesion/salidas">Volver</Button>
    </CabeceraSeccion>

    <SeccionDatos salida={salida} puedeGuardar={puedeGuardar} onGuardado={onGuardado} />
    <SeccionFecha salida={salida} puedeGuardar={puedeGuardar} onGuardado={onGuardado} />
    <SeccionCobro salida={salida} puedeGuardar={puedeGuardar} onGuardado={onGuardado} />
    <SeccionRopa salida={salida} puedeGuardar={puedeGuardar} onGuardado={onGuardado} />
    <SeccionPuestos salida={salida} puedeGuardar={puedeGuardar} onGuardado={onGuardado} />
    <SeccionIndicaciones salida={salida} puedeGuardar={puedeGuardar} onGuardado={onGuardado} />
  </>
}
