/**
 * Las calles del recorrido (16-10-2026): con ellas, la lista de al lado del
 * mapa cambia de calle cuando el trono entra en otra, y las paradas pasan a
 * sitios de interés. Se sacan de la línea con un botón y la Junta las repasa:
 * el mapa puede confundir calles paralelas o tomar una esquina por una calle,
 * y los cruces se marcan a mano. Las horas se reparten entre la salida y la
 * entrada; una escrita a mano manda.
 *
 * Usa el mapa del barrio, así que se carga aparte, como el editor del mapa.
 */
import { useMemo, useState } from 'react'
import { Alert, Box, Button, Checkbox, FormControlLabel, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import CallMergeIcon from '@mui/icons-material/CallMerge'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import topes from '../../../../../../shared/topes-contenido.json'
import DialogoConfirmacion from '../../../../components/DialogoConfirmacion'
import { cargarBarrio } from '../../../../components/mapa/barrio'
import { callesDeLaLinea } from '../../../../components/mapa/callesDeLaLinea'
import { lecturaDelRecorrido } from '../../../../components/bloques/recorrido'
import type { BloqueItinerario, CalleDelRecorrido, RecorridoEnMapa } from '../../../../lib/api/contenido'

interface Props {
  bloque: BloqueItinerario & { recorrido: RecorridoEnMapa }
  onRecorrido: (recorrido: RecorridoEnMapa) => void
}

export default function CallesDelRecorrido({ bloque, onRecorrido }: Props) {
  const { recorrido } = bloque
  const calles = recorrido.calles ?? []
  const [sacando, setSacando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preguntar, setPreguntar] = useState(false)
  /** Lo que dudó el cálculo, por fila, hasta que se vuelva a sacar: no se guarda. */
  const [dudas, setDudas] = useState<(string | undefined)[]>([])

  const total = useMemo(() => {
    let m = 0
    for (let i = 1; i < recorrido.linea.length; i++) {
      const [a, b] = [recorrido.linea[i - 1], recorrido.linea[i]]
      const coseno = Math.cos((a[1] * Math.PI) / 180)
      m += Math.hypot((b[0] - a[0]) * 111320 * coseno, (b[1] - a[1]) * 111320)
    }
    return m
  }, [recorrido.linea])
  // Las horas que verá la web, para enseñarlas al lado de cada calle.
  const { filas } = useMemo(() => lecturaDelRecorrido(bloque), [bloque])

  const guardar = (cambios: Partial<RecorridoEnMapa>) => onRecorrido({ ...recorrido, ...cambios })
  const cambiarCalle = (i: number, cambios: Partial<CalleDelRecorrido>) =>
    guardar({ calles: calles.map((c, j) => (j === i ? { ...c, ...cambios } : c)) })

  const sacar = async () => {
    setPreguntar(false)
    setSacando(true)
    setError(null)
    try {
      const barrio = await cargarBarrio()
      if (!barrio) { setError('Esta instalación no tiene mapa del barrio: las calles se escriben a mano.'); return }
      const sugeridas = callesDeLaLinea(recorrido.linea, recorrido.esquinas, barrio).slice(0, topes.callesPorRecorrido)
      setDudas(sugeridas.map((c) => c.dudaCon))
      guardar({ calles: sugeridas.map(({ nombre, desde }) => ({ nombre, desde })) })
    } catch {
      setError('No se pudo leer el mapa del barrio. Prueba otra vez en un momento.')
    } finally {
      setSacando(false)
    }
  }

  /** Une una calle con la anterior: la anterior llega hasta donde acababa esta. */
  const unir = (i: number) => {
    guardar({ calles: calles.filter((_, j) => j !== i) })
    setDudas((d) => d.filter((_, j) => j !== i))
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="subtitle2">Calles del recorrido</Typography>
      <Typography variant="body2" color="text.secondary">
        Con las calles, la lista de al lado del mapa cambia cuando el trono entra en otra calle, y las paradas pasan a ser sitios de interés, numerados en el mapa. Se sacan solas de la línea, cortándola en las esquinas; repásalas: el mapa puede confundir dos calles paralelas o tomar una esquina por una calle. Si cambias la línea, vuelve a sacarlas.
      </Typography>

      <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <TextField label="Salida" size="small" value={recorrido.salida ?? ''} onChange={(e) => guardar({ salida: e.target.value })}
          placeholder="18:00" sx={{ width: 120 }} slotProps={{ htmlInput: { maxLength: 5, inputMode: 'numeric' } }} />
        <TextField label="Entrada" size="small" value={recorrido.entrada ?? ''} onChange={(e) => guardar({ entrada: e.target.value })}
          placeholder="00:00" sx={{ width: 120 }} slotProps={{ htmlInput: { maxLength: 5, inputMode: 'numeric' } }} />
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', maxWidth: 420 }}>
          Las horas de cada calle se reparten entre las dos, descontando los minutos que el trono se para en los sitios de interés.
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Button size="small" variant="outlined" startIcon={<AutoFixHighIcon />} disabled={sacando}
          onClick={() => (calles.length > 0 ? setPreguntar(true) : void sacar())}>
          {sacando ? 'Sacando las calles…' : calles.length > 0 ? 'Volver a sacarlas de la línea' : 'Sacar las calles de la línea'}
        </Button>
        {calles.length > 0 && (
          <Button size="small" color="error" onClick={() => { setDudas([]); guardar({ calles: [] }) }}>
            Quitar las calles
          </Button>
        )}
      </Stack>
      {error && <Alert severity="warning">{error}</Alert>}

      {calles.length > 0 && (
        <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1 }}>
          {calles.map((calle, i) => {
            const metros = Math.round(((calles[i + 1]?.desde ?? 1) - calle.desde) * total)
            return (
              <Box component="li" key={i} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '64px minmax(0, 1fr) auto auto auto' }, gap: 1, alignItems: 'center' }}>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
                  {filas[i]?.hora || '—'}
                </Typography>
                <TextField
                  size="small" fullWidth label={calle.cruce ? 'Cruce' : `Calle ${i + 1}`} value={calle.nombre}
                  onChange={(e) => cambiarCalle(i, { nombre: e.target.value })}
                  helperText={[`${metros} m`, metros < 25 ? 'muy corta: ¿una esquina?' : '', dudas[i] ? `¿o ${dudas[i]}?` : ''].filter(Boolean).join(' · ')}
                  slotProps={{ htmlInput: { maxLength: topes.lugar } }}
                />
                <TextField
                  size="small" label="Hora fija" value={calle.hora ?? ''} placeholder={filas[i]?.hora ?? ''}
                  onChange={(e) => cambiarCalle(i, { hora: e.target.value || undefined })}
                  sx={{ width: 110 }} slotProps={{ htmlInput: { maxLength: 5, inputMode: 'numeric' } }}
                />
                <FormControlLabel
                  control={<Checkbox size="small" checked={calle.cruce === true} onChange={(e) => cambiarCalle(i, { cruce: e.target.checked || undefined })} />}
                  label="Cruce"
                />
                <Tooltip title={i === 0 ? 'La primera no tiene anterior' : 'Unir con la anterior (era una esquina)'}><span>
                  <IconButton size="small" aria-label={`Unir la calle ${i + 1} con la anterior`} disabled={i === 0} onClick={() => unir(i)}>
                    <CallMergeIcon fontSize="small" />
                  </IconButton>
                </span></Tooltip>
              </Box>
            )
          })}
        </Box>
      )}

      <DialogoConfirmacion
        abierto={preguntar}
        titulo="¿Volver a sacar las calles?"
        mensaje="Se cambian por las que salgan de la línea: los nombres corregidos, los cruces y las horas fijas de ahora se pierden."
        textoConfirmar="Sacarlas de nuevo"
        onConfirmar={() => void sacar()}
        onCancelar={() => setPreguntar(false)}
      />
    </Stack>
  )
}
