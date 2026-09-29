import { useEffect, useRef, useState } from 'react'
import { Box, Chip, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import VentanaFormulario from '../VentanaFormulario'
import { crearAviso, type CargoJunta } from '../../../lib/api/panel'
import { CLAVE_PANEL_HOY } from '../../../app/usePanelDeHoy'
import { NOMBRE_CARGO } from '../../../app/cmsNavegacion'
import { ORO } from './estiloRetablo'

const CARGOS: (CargoJunta | null)[] = [null, 'HERMANO_MAYOR', 'SECRETARIA', 'TESORERIA', 'REDES', 'ALBACERIA', 'ADMIN']
const MAXIMO = 160

/**
 * La ventana del aviso nuevo: qué hay que hacer, para quién (un cargo o toda
 * la junta), hasta cuándo y si es urgente desde ya. Al crearlo, el Inicio se
 * vuelve a pedir y el aviso sale entre los asuntos.
 */
export default function NuevoAviso({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const cliente = useQueryClient()
  const [texto, setTexto] = useState('')
  const [para, setPara] = useState<CargoJunta | null>(null)
  const [hasta, setHasta] = useState('')
  const [urgente, setUrgente] = useState(false)
  const campo = useRef<HTMLInputElement>(null)

  // El foco, a «Qué hay que hacer» nada más abrir: con `autoFocus` se lo quedaba
  // la propia ventana y lo primero que se tecleaba se perdía.
  useEffect(() => {
    if (!abierto) return
    const t = setTimeout(() => campo.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [abierto])

  const limpiar = () => { setTexto(''); setPara(null); setHasta(''); setUrgente(false) }
  const guardar = useMutation({
    mutationFn: () => crearAviso({ texto: texto.trim(), para, hasta: hasta || null, urgente }),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: CLAVE_PANEL_HOY })
      limpiar()
      onCerrar()
    },
  })
  const cerrar = () => { limpiar(); guardar.reset(); onCerrar() }

  return (
    <VentanaFormulario
      abierto={abierto}
      titulo="Nuevo aviso"
      sucio={texto.trim() !== '' || hasta !== '' || urgente || para !== null}
      guardando={guardar.isPending}
      puedeGuardar={texto.trim().length > 0 && !/[<>]/.test(texto)}
      textoGuardar="Crear aviso"
      error={guardar.isError ? guardar.error.message : null}
      onGuardar={() => guardar.mutate()}
      onCerrar={cerrar}
    >
      <Stack spacing={2.5}>
        <Typography variant="body2" color="text.secondary">
          Saldrá en «Hoy» a quien lo lleve, hasta que alguien lo dé por hecho.
        </Typography>
        <TextField
          label="Qué hay que hacer"
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, MAXIMO))}
          required
          inputRef={campo}
          fullWidth
          error={/[<>]/.test(texto)}
          helperText={/[<>]/.test(texto) ? 'Sin los signos < ni >.' : `${texto.length}/${MAXIMO}`}
        />
        <Box role="group" aria-labelledby="aviso-para">
          <Typography id="aviso-para" variant="body2" color="text.secondary" sx={{ mb: 1 }}>Para</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {CARGOS.map((c) => {
              const elegido = c === para
              return (
                <Chip
                  key={c ?? 'junta'}
                  label={c ? NOMBRE_CARGO[c] : 'Toda la junta'}
                  onClick={() => setPara(c)}
                  aria-pressed={elegido}
                  variant="outlined"
                  sx={elegido
                    ? { borderColor: ORO, color: ORO, backgroundColor: `color-mix(in srgb, ${ORO} 14%, transparent)`, fontWeight: 600, '&&:hover': { backgroundColor: `color-mix(in srgb, ${ORO} 20%, transparent)` } }
                    : { color: 'text.secondary' }}
                />
              )
            })}
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, alignItems: 'center' }}>
          <TextField
            label="Hasta (opcional)"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormControlLabel control={<Switch checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />} label="Urgente desde ya" />
        </Box>
        <Typography variant="caption" color="text.secondary">Si pasa la fecha y sigue sin hacer, se pone urgente solo.</Typography>
      </Stack>
    </VentanaFormulario>
  )
}
