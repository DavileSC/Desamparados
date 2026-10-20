import { useState } from 'react'
import { Alert, Button, MenuItem, TextField } from '@mui/material'
import { activarPersona, type FichaDeMesa } from '../../../lib/api/mesa'
import type { PuestoDelCatalogo } from '../../../lib/api/salidas'
import { mensajeDe } from './formato'

/**
 * Lo que dice la mesa al terminar con una persona, y en qué tono. Con
 * `deshacer`, el aviso lleva un botón para echarlo atrás en el acto (un clic
 * equivocado); devuelve el aviso de después.
 */
export interface Aviso {
  texto: string
  tono: 'success' | 'info' | 'warning'
  deshacer?: () => Promise<Aviso>
  /** La papeleta recién recogida: el aviso ofrece imprimirla para dársela en mano. */
  papeletaId?: number
}

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

/**
 * El puesto, solo de la lista de la salida: escrito a mano salían erratas
 * («Nazareno de ciriod») que luego no casaban con nada (20-10-2026). Si ya
 * tenía uno que no está en la lista, se ve como está, para cambiarlo.
 */
export function CampoPuesto({ valor, onCambiar, puestos, autoFocus }: {
  valor: string; onCambiar: (v: string) => void; puestos: PuestoDelCatalogo[]; autoFocus?: boolean
}) {
  const nombres = puestos.map((p) => p.nombre)
  const fuera = valor && !nombres.includes(valor) ? valor : null
  return (
    <TextField select fullWidth size="small" label="Puesto" required autoFocus={autoFocus} value={valor} onChange={(e) => onCambiar(e.target.value)}>
      {fuera && <MenuItem value={fuera} disabled>{fuera} (no está en la lista)</MenuItem>}
      {nombres.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
    </TextField>
  )
}
