import { useRef, useState, type FormEvent } from 'react'
import { Alert, Box, CircularProgress, MenuItem, TextField } from '@mui/material'
import Boton from '../../../components/Boton'
import { actualizarFicha, type ApiProfile, type CambiosDeFicha } from '../../../lib/api/perfil'
import { esCodigoPostalValido, esDniValido, esTelefonoValido, esTextoValido, normalizarTelefono } from '../../../lib/validacion/identidad'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { ESTADO_CIVIL, SEXO, aDia } from '../perfil/etiquetas'
import { aniosCumplidos } from '../../altas/public/schema'
import { enfocarCampo } from '../perfil/enfocarCampo'
import type { CampoDeFicha } from './obligatorios'

const EMAIL = /^[^\s@,;<>()":\\[\]]+@[^\s@,;<>()":\\[\]]+\.[^\s@,;<>()":\\[\]]+$/

/** Qué le pasa a un valor escrito, o null si vale. Va bajo su campo: no repite la etiqueta. */
function problemaDe({ campo, tipo }: CampoDeFicha, valor: string, ficha: ApiProfile): string | null {
  const v = valor.trim()
  if (tipo === 'dni') return esDniValido(v) ? null : 'La letra no corresponde con el número.'
  if (tipo === 'telefono') return esTelefonoValido(v) ? null : 'Tiene que tener 9 cifras.'
  if (tipo === 'codigoPostal') return esCodigoPostalValido(v) ? null : 'Tiene que tener 5 cifras.'
  if (tipo === 'correo') return EMAIL.test(v) ? null : 'Revisa el correo: falta algo o sobra un espacio.'
  if (tipo === 'fecha') {
    // Lo mismo que rechaza el servidor al guardar la ficha.
    if (v > aDia(new Date().toISOString())) return 'No puede ser posterior a hoy.'
    if (campo === 'fechaBautismo' && ficha.fechaNacimiento && v < aDia(ficha.fechaNacimiento)) return 'No puede ser anterior al nacimiento.'
    if (campo === 'fechaNacimiento' && ficha.esTitular && aniosCumplidos(v) < 18) return 'Con esa fecha serías menor de edad: revísala.'
    return null
  }
  if (tipo === 'texto') return esTextoValido(v) ? null : 'No puede llevar «<» ni «>».'
  return null
}

/**
 * Unos pocos campos sueltos de la ficha, con su botón de guardar: lo que le
 * falta (todos obligatorios) o lo opcional que quiera añadir (lo que deje en
 * blanco no se manda). Pide solo eso para no hacerle pasar por el formulario
 * entero del apartado. Es un formulario de verdad: Intro guarda, y cada
 * aviso va en su campo (antes solo se avisaba del primero, en una alerta suelta).
 */
export default function CamposDeFicha({ ficha, campos, opcionales = false, onGuardada }: {
  ficha: ApiProfile
  campos: CampoDeFicha[]
  opcionales?: boolean
  onGuardada: (ficha: ApiProfile) => void
}) {
  const [valores, setValores] = useState<Record<string, string>>({})
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const formulario = useRef<HTMLFormElement>(null)

  const marcar = (fallos: Record<string, string>) => {
    setErrores(fallos)
    const primero = campos.find((c) => fallos[c.campo])
    if (primero) enfocarCampo(formulario.current, primero.campo)
  }

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault()
    setError(null)
    const escritos = campos.filter((c) => (valores[c.campo] ?? '').trim() !== '')
    if (opcionales && escritos.length === 0) { setErrores({}); setError('Escribe al menos uno, o déjalo para otro momento.'); return }
    const fallos: Record<string, string> = {}
    for (const c of campos) {
      const valor = valores[c.campo] ?? ''
      const problema = valor.trim() === '' ? (opcionales ? null : 'Falta este dato.') : problemaDe(c, valor, ficha)
      if (problema) fallos[c.campo] = problema
    }
    if (Object.keys(fallos).length > 0) { marcar(fallos); return }

    const cambios = Object.fromEntries(escritos.map((c) => {
      const valor = valores[c.campo].trim()
      return [c.campo, c.tipo === 'telefono' ? normalizarTelefono(valor) : valor]
    })) as CambiosDeFicha
    setGuardando(true); setErrores({})
    try {
      const { data } = await actualizarFicha(ficha.id, cambios)
      setValores({})
      onGuardada(data)
    } catch (e) {
      if (e instanceof ErrorDeApi) marcar(Object.fromEntries(Object.entries(e.fields).filter(([campo]) => campos.some((c) => c.campo === campo))))
      setError(e instanceof ErrorDeApi ? e.message : 'No se ha podido guardar. Inténtalo otra vez.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Box component="form" ref={formulario} noValidate onSubmit={(e: FormEvent) => void guardar(e)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
        {campos.map((c) => {
          const fallo = errores[c.campo]
          const comun = {
            name: c.campo,
            label: c.etiqueta,
            value: valores[c.campo] ?? '',
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              setValores((v) => ({ ...v, [c.campo]: e.target.value }))
              if (fallo) setErrores((actuales) => ({ ...actuales, [c.campo]: '' }))
            },
            required: !opcionales,
            error: !!fallo,
            helperText: fallo || undefined,
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
      <Boton type="submit" appVariant="claro" disabled={guardando} sx={{ alignSelf: { sm: 'flex-start' } }}>
        {guardando ? <CircularProgress size={20} color="inherit" aria-label="Guardando" /> : 'Guardar'}
      </Boton>
    </Box>
  )
}
