import { useState } from 'react'
import { Alert, Box, CircularProgress, MenuItem, TextField } from '@mui/material'
import Boton from '../../../components/Boton'
import { actualizarFicha, type ApiProfile, type CambiosDeFicha } from '../../../lib/api/perfil'
import { esCodigoPostalValido, esDniValido, esTelefonoValido, esTextoValido, normalizarTelefono } from '../../../lib/validacion/identidad'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { ESTADO_CIVIL, SEXO } from '../perfil/etiquetas'
import type { CampoDeFicha } from './obligatorios'

const EMAIL = /^[^\s@,;<>()":\\[\]]+@[^\s@,;<>()":\\[\]]+\.[^\s@,;<>()":\\[\]]+$/

/** Qué le pasa a un valor escrito, o null si vale. */
function problemaDe({ etiqueta, tipo }: CampoDeFicha, valor: string): string | null {
  const v = valor.trim()
  if (tipo === 'dni') return esDniValido(v) ? null : 'Revisa el DNI o NIE: la letra no corresponde con el número.'
  if (tipo === 'telefono') return esTelefonoValido(v) ? null : `${etiqueta}: tiene que tener 9 cifras.`
  if (tipo === 'codigoPostal') return esCodigoPostalValido(v) ? null : 'El código postal tiene que tener 5 cifras.'
  if (tipo === 'correo') return EMAIL.test(v) ? null : `Revisa el ${etiqueta.toLowerCase()}.`
  if (tipo === 'fecha') return v > new Date().toISOString().slice(0, 10) ? `${etiqueta}: no puede ser posterior a hoy.` : null
  if (tipo === 'texto') return esTextoValido(v) ? null : `${etiqueta}: no puede llevar «<» ni «>».`
  return null
}

/**
 * Unos pocos campos sueltos de la ficha, con su botón de guardar: lo que le
 * falta (todos obligatorios) o lo opcional que quiera añadir (lo que deje en
 * blanco no se manda). Pide solo eso para no hacerle pasar por el formulario
 * entero del apartado.
 */
export default function CamposDeFicha({ ficha, campos, opcionales = false, onGuardada }: {
  ficha: ApiProfile
  campos: CampoDeFicha[]
  opcionales?: boolean
  onGuardada: (ficha: ApiProfile) => void
}) {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const guardar = async () => {
    const escritos = campos.filter((c) => (valores[c.campo] ?? '').trim() !== '')
    const vacio = opcionales ? undefined : campos.find((c) => !escritos.includes(c))
    if (vacio) { setError(`Falta: ${vacio.etiqueta.toLowerCase()}.`); return }
    if (escritos.length === 0) { setError('Escribe al menos uno, o déjalo para otro momento.'); return }
    const problema = escritos.map((c) => problemaDe(c, valores[c.campo])).find(Boolean)
    if (problema) { setError(problema); return }

    const cambios = Object.fromEntries(escritos.map((c) => {
      const valor = valores[c.campo].trim()
      return [c.campo, c.tipo === 'telefono' ? normalizarTelefono(valor) : valor]
    })) as CambiosDeFicha
    setGuardando(true); setError(null)
    try {
      const { data } = await actualizarFicha(ficha.id, cambios)
      setValores({})
      onGuardada(data)
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e.message : 'No se ha podido guardar. Inténtalo otra vez.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
        {campos.map((c) => {
          const comun = {
            label: c.etiqueta,
            value: valores[c.campo] ?? '',
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValores((v) => ({ ...v, [c.campo]: e.target.value })),
            required: !opcionales,
            fullWidth: true,
          }
          if (c.tipo === 'sexo' || c.tipo === 'estadoCivil') {
            const opciones = c.tipo === 'sexo' ? SEXO : ESTADO_CIVIL
            return (
              <TextField key={c.campo} select {...comun}>
                {Object.entries(opciones).map(([valor, texto]) => <MenuItem key={valor} value={valor}>{texto}</MenuItem>)}
              </TextField>
            )
          }
          return (
            <TextField
              key={c.campo}
              {...comun}
              type={c.tipo === 'fecha' ? 'date' : c.tipo === 'correo' ? 'email' : c.tipo === 'telefono' ? 'tel' : 'text'}
              slotProps={c.tipo === 'fecha' ? { inputLabel: { shrink: true } } : undefined}
            />
          )
        })}
      </Box>
      {error && <Alert severity="error">{error}</Alert>}
      <Boton appVariant="claro" onClick={() => void guardar()} disabled={guardando} sx={{ alignSelf: { sm: 'flex-start' } }}>
        {guardando ? <CircularProgress size={20} color="inherit" aria-label="Guardando" /> : 'Guardar'}
      </Boton>
    </Box>
  )
}
