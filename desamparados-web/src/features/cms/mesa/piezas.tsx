import { useState } from 'react'
import { Alert, Autocomplete, Button, TextField } from '@mui/material'
import { activarPersona, type FichaDeMesa, type Salida } from '../../../lib/api/mesa'
import { PUESTOS_POR_SALIDA, mensajeDe } from './formato'

/** Lo que dice la mesa al terminar con una persona, y en qué tono. */
export interface Aviso { texto: string; tono: 'success' | 'info' | 'warning' }

const ETIQUETA_SITUACION = { baja: 'está de baja', pendiente: 'tiene el alta pendiente de aprobar' } as const

/**
 * Quien no está en activo no sale: si está de baja se reactiva, y si su alta
 * por la web esperaba, la aprueba Secretaría (la mesa no lo hace por su cuenta).
 */
export function AvisoSituacion({ ficha, role, onRecargar }: { ficha: FichaDeMesa; role: string; onRecargar: () => void }) {
  const [activando, setActivando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (ficha.situacion === 'activo') return null
  const puede = role === 'ADMIN' || role === 'SECRETARIA'
  const activar = async () => {
    setActivando(true); setError(null)
    try { await activarPersona(ficha.id); onRecargar() } catch (e) { setError(mensajeDe(e, 'No se ha podido poner en activo.')) } finally { setActivando(false) }
  }
  return (
    <Alert
      severity="warning"
      action={puede && <Button color="inherit" size="small" onClick={() => void activar()} disabled={activando}>{ficha.situacion === 'baja' ? 'Reactivar' : 'Aprobar alta'}</Button>}
    >
      {ficha.nombre} {ETIQUETA_SITUACION[ficha.situacion as 'baja' | 'pendiente']}.
      {puede ? ' Ponla en activo para seguir.' : ' Para seguir, Secretaría tiene que ponerla en activo.'}
      {error && <><br />{error}</>}
    </Alert>
  )
}

/** El puesto: los del catálogo de la salida y los que ya se han dado, o uno escrito a mano. */
export function CampoPuesto({ valor, onCambiar, salida, usados, autoFocus }: {
  valor: string; onCambiar: (v: string) => void; salida: Salida; usados: string[]; autoFocus?: boolean
}) {
  const opciones = [...new Set([...PUESTOS_POR_SALIDA[salida].map((p) => p.nombre), ...usados])]
  return (
    <Autocomplete
      freeSolo
      autoSelect
      options={opciones}
      value={valor}
      onChange={(_e, nuevo) => onCambiar(nuevo ?? '')}
      onInputChange={(_e, texto, motivo) => { if (motivo === 'input') onCambiar(texto) }}
      renderInput={(params) => <TextField {...params} size="small" label="Puesto" required autoFocus={autoFocus} />}
    />
  )
}
