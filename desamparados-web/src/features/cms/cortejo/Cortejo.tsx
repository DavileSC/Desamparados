import { useCallback, useEffect, useState } from 'react'
import { Alert, Autocomplete, Box, Button, Chip, CircularProgress, IconButton, Paper, Stack, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { estadoCortejo, guardarTramosCortejo, repartirCortejo, type ConfiguracionCortejo, type EstadoCortejo } from '../../../lib/api/procesion'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
const plural = (n: number, uno: string, varios: string) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`)

interface Props {
  /** El slug de la salida. */
  salida: string
  /** Los nombres de los puestos del catálogo de la salida: los que se ofrecen para repartir. */
  puestos: string[]
  /** Secretaría y la administración: el resto de la Junta lo ve y no lo toca. */
  puedeCambiar: boolean
  onAviso: (texto: string) => void
}

/**
 * El cortejo de la salida: sus tramos y el reparto de las papeletas en ellos
 * por antigüedad (los más nuevos delante, los más antiguos junto al trono).
 * Repartir reescribe el tramo y el lugar de las papeletas de los puestos que
 * se reparten; el resto (trono, acólitos, mantillas…) no se toca.
 */
export default function Cortejo({ salida, puestos, puedeCambiar, onAviso }: Props) {
  const [estado, setEstado] = useState<EstadoCortejo | null>(null)
  const [borrador, setBorrador] = useState<ConfiguracionCortejo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  const cargar = useCallback(async () => {
    const e = await estadoCortejo(salida)
    setEstado(e)
    setBorrador({ tramos: e.config.tramos.map((t) => ({ ...t })), puestos: [...e.config.puestos] })
  }, [salida])

  useEffect(() => {
    // Sin limpiar antes: la pantalla lo monta con `key={salida}`, y cambiar de salida empieza de cero.
    let cancelado = false
    estadoCortejo(salida)
      .then((e) => { if (!cancelado) { setEstado(e); setBorrador({ tramos: e.config.tramos.map((t) => ({ ...t })), puestos: [...e.config.puestos] }) } })
      .catch((err: unknown) => { if (!cancelado) setError(mensaje(err, 'No se ha podido cargar el cortejo.')) })
    return () => { cancelado = true }
  }, [salida])

  if (!estado || !borrador) {
    return (
      <Box component="section" aria-labelledby="cortejo-titulo" sx={{ mt: 4 }}>
        <Typography id="cortejo-titulo" component="h2" sx={{ fontSize: 18, fontWeight: 600, mb: 1 }}>Cortejo</Typography>
        {error ? <Alert severity="error">{error}</Alert> : <CircularProgress aria-label="Cargando el cortejo" />}
      </Box>
    )
  }

  const tramosCambiados = JSON.stringify(borrador) !== JSON.stringify(estado.config)
  const cambiarTramo = (i: number, cambios: Partial<{ nombre: string; plazas: number }>) =>
    setBorrador({ ...borrador, tramos: borrador.tramos.map((t, k) => (k === i ? { ...t, ...cambios } : t)) })

  const guardar = async () => {
    setGuardando(true); setError(null)
    try { await guardarTramosCortejo(salida, borrador); await cargar(); onAviso('Tramos del cortejo guardados.') }
    catch (err: unknown) { setError(mensaje(err, 'No se han podido guardar los tramos.')) }
    finally { setGuardando(false) }
  }

  const repartir = async () => {
    setConfirmar(false); setGuardando(true); setError(null)
    try { onAviso((await repartirCortejo(salida, estado.year)).message); await cargar() }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido repartir el cortejo.')) }
    finally { setGuardando(false) }
  }

  const repartibles = estado.papeletas - estado.reparto.fuera

  return (
    <Box component="section" aria-labelledby="cortejo-titulo" sx={{ mt: 4 }}>
      <Typography id="cortejo-titulo" component="h2" sx={{ fontSize: 18, fontWeight: 600, mb: 0.5 }}>Cortejo {estado.year}</Typography>
      <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 1.5, maxWidth: 760 }}>
        Los tramos, del que abre al del trono, y quién va en cada uno. Al repartir, los hermanos más nuevos van delante y los
        más antiguos junto al trono; cada tramo recibe una parte en proporción a sus plazas.
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper sx={{ p: { xs: 2, md: 2.5 }, mb: 2, maxWidth: 900, display: 'grid', gap: 2 }}>
        <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1.25 }}>
          {borrador.tramos.map((t, i) => {
            const reparto = estado.reparto.tramos.find((r) => r.nombre === t.nombre)
            return (
              <Box component="li" key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography sx={{ width: 24, color: 'text.secondary', fontWeight: 600 }}>{i + 1}.</Typography>
                <TextField size="small" label="Tramo" value={t.nombre} disabled={!puedeCambiar} onChange={(e) => cambiarTramo(i, { nombre: e.target.value })} sx={{ flex: '1 1 220px' }} slotProps={{ htmlInput: { maxLength: 60 } }} />
                {/* Plazas, recuento y quitar van juntos: en el móvil bajan de línea a la vez. */}
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flex: { xs: '1 1 100%', sm: '0 0 auto' }, pl: { xs: 4.5, sm: 0 } }}>
                  <TextField size="small" label="Plazas" type="number" value={t.plazas} disabled={!puedeCambiar} onChange={(e) => cambiarTramo(i, { plazas: Number(e.target.value) })} sx={{ width: 96 }} slotProps={{ htmlInput: { min: 1, max: 500 } }} />
                  <Typography sx={{ fontSize: 14, color: 'text.secondary', minWidth: 120, flex: 1 }}>
                    {!tramosCambiados && reparto ? `${plural(reparto.asignados, 'hermano', 'hermanos')} al repartir` : ''}
                  </Typography>
                  {puedeCambiar && (
                    <IconButton aria-label={`Quitar el tramo ${t.nombre || i + 1}`} disabled={borrador.tramos.length === 1} onClick={() => setBorrador({ ...borrador, tramos: borrador.tramos.filter((_, k) => k !== i) })}>
                      <DeleteOutlineIcon />
                    </IconButton>
                  )}
                </Box>
              </Box>
            )
          })}
        </Box>
        <Autocomplete
          multiple
          freeSolo
          disabled={!puedeCambiar}
          options={puestos}
          value={borrador.puestos}
          onChange={(_, valor) => setBorrador({ ...borrador, puestos: valor.map(String) })}
          renderValue={(valor, getItemProps) => valor.map((opcion, index) => <Chip size="small" label={opcion} {...getItemProps({ index })} key={opcion} />)}
          renderInput={(params) => <TextField {...params} size="small" label="Puestos que se reparten en los tramos" helperText="El resto (trono, acólitos, mantillas…) va en su sitio y no se toca." />}
        />
        {puedeCambiar && (
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Button startIcon={<AddIcon />} onClick={() => setBorrador({ ...borrador, tramos: [...borrador.tramos, { nombre: `Tramo ${borrador.tramos.length + 1}`, plazas: 30 }] })}>Añadir tramo</Button>
            <Button variant="outlined" disabled={!tramosCambiados || guardando} onClick={() => void guardar()}>Guardar tramos</Button>
          </Stack>
        )}
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 2.5 }, mb: 2, maxWidth: 900, display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: 14.5 }}>
          {estado.papeletas === 0
            ? `Aún no hay papeletas de ${estado.year}.`
            : `${plural(estado.papeletas, 'papeleta', 'papeletas')}: ${plural(repartibles, 'se reparte', 'se reparten')} en los tramos${estado.reparto.fuera ? ` y ${plural(estado.reparto.fuera, 'va', 'van')} en su puesto` : ''}. ${estado.reparto.cambios === 0 ? 'El reparto está al día.' : `Al repartir, ${plural(estado.reparto.cambios, 'cambia', 'cambian')} de tramo o de lugar.`}`}
        </Typography>
        {puedeCambiar && (
          <Button variant="contained" disabled={guardando || tramosCambiados || repartibles === 0 || estado.reparto.cambios === 0} onClick={() => setConfirmar(true)}>
            Repartir por antigüedad
          </Button>
        )}
      </Paper>
      {tramosCambiados && puedeCambiar && <Alert severity="info" sx={{ mb: 2, maxWidth: 900 }}>Guarda los tramos antes de repartir.</Alert>}

      {estado.actual.length > 0 && (
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, maxWidth: 900 }}>
          {estado.actual.map((g) => (
            <Paper key={g.tramo ?? 'sin-tramo'} sx={{ p: 2 }}>
              <Typography component="h3" sx={{ fontWeight: 600, mb: 1 }}>
                {g.tramo ?? 'Sin tramo'} <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>· {g.hermanos.length}</Box>
              </Typography>
              <Box component="ol" sx={{ m: 0, pl: 0, listStyle: 'none', display: 'grid', gap: 0.25, maxHeight: 280, overflowY: 'auto' }}>
                {g.hermanos.map((h) => (
                  <Typography component="li" key={h.papeletaId} sx={{ fontSize: 14 }}>
                    <Box component="span" sx={{ display: 'inline-block', minWidth: 28, color: 'text.secondary' }}>{h.numero ?? '—'}</Box>
                    {h.apellidos}, {h.nombre}
                    <Box component="span" sx={{ color: 'text.secondary' }}>{h.numeroHermano !== null ? ` · n.º ${h.numeroHermano}` : ''}{h.seReparte ? '' : ` · ${h.puesto}`}</Box>
                  </Typography>
                ))}
              </Box>
            </Paper>
          ))}
        </Box>
      )}

      <DialogoConfirmacion
        abierto={confirmar}
        titulo="¿Repartir el cortejo?"
        mensaje={`Se escribirá el tramo y el lugar de ${plural(estado.reparto.cambios, 'papeleta', 'papeletas')}, por antigüedad. Lo que se hubiera cambiado a mano en esas papeletas se pierde.`}
        textoConfirmar="Repartir"
        onConfirmar={() => void repartir()}
        onCancelar={() => setConfirmar(false)}
      />
    </Box>
  )
}

