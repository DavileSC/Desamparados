import { useState } from 'react'
import {
  Alert, Box, Button, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import { darDeAltaEnMesa, type DatosDeAlta } from '../../../lib/api/mesa'
import BuscadorPersonas from './BuscadorPersonas'
import { mensajeDe } from './formato'

interface Props {
  onHecha: (id: number, aviso: string) => void
  onCancelar: () => void
}

type Quien = 'ADULTO' | 'MENOR'
type Tutor = { tipo: 'censo'; id: number; nombre: string } | { tipo: 'nuevo' } | null

const PARENTESCOS = [
  { valor: 'HIJO', etiqueta: 'Hijo o hija' },
  { valor: 'NIETO', etiqueta: 'Nieto o nieta' },
  { valor: 'SOBRINO', etiqueta: 'Sobrino o sobrina' },
  { valor: 'AHIJADO', etiqueta: 'Ahijado o ahijada' },
  { valor: 'OTRO', etiqueta: 'Otro' },
] as const

const VACIA = { nombre: '', primerApellido: '', segundoApellido: '', fechaNacimiento: '', sexo: '', dni: '', telefono: '', email: '' }
const VACIO_TUTOR = { nombre: '', primerApellido: '', segundoApellido: '', dni: '', telefono: '', email: '' }

/**
 * Dar de alta en el momento a quien viene a salir y no está en el censo. Un
 * adulto abre su cuenta con su DNI, correo y teléfono; un menor cuelga de la
 * de su tutor, que puede estar ya en el censo o abrirse aquí mismo. La ficha
 * nace en activo y con número de hermano.
 */
export default function AltaEnMesa({ onHecha, onCancelar }: Props) {
  const [quien, setQuien] = useState<Quien>('ADULTO')
  const [persona, setPersona] = useState(VACIA)
  const [tutor, setTutor] = useState<Tutor>(null)
  const [tutorNuevo, setTutorNuevo] = useState(VACIO_TUTOR)
  const [parentesco, setParentesco] = useState<DatosDeAlta['parentesco']>('HIJO')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const campo = (clave: keyof typeof VACIA, etiqueta: string, extra: object = {}) => (
    <TextField size="small" fullWidth label={etiqueta} value={persona[clave]} onChange={(e) => setPersona({ ...persona, [clave]: e.target.value })} {...extra} />
  )
  const campoTutor = (clave: keyof typeof VACIO_TUTOR, etiqueta: string, extra: object = {}) => (
    <TextField size="small" fullWidth required={clave !== 'segundoApellido'} label={etiqueta} value={tutorNuevo[clave]} onChange={(e) => setTutorNuevo({ ...tutorNuevo, [clave]: e.target.value })} {...extra} />
  )
  const opcional = (texto: string) => texto.trim() || undefined

  const enviar = async () => {
    setEnviando(true); setError(null)
    try {
      const alta = await darDeAltaEnMesa({
        nombre: persona.nombre.trim(),
        primerApellido: persona.primerApellido.trim(),
        segundoApellido: opcional(persona.segundoApellido),
        fechaNacimiento: persona.fechaNacimiento,
        sexo: (persona.sexo || undefined) as DatosDeAlta['sexo'],
        dni: opcional(persona.dni),
        telefono: opcional(persona.telefono),
        email: opcional(persona.email),
        ...(quien === 'MENOR' && { parentesco }),
        ...(quien === 'MENOR' && tutor?.tipo === 'censo' && { tutorHermanoId: tutor.id }),
        ...(quien === 'MENOR' && tutor?.tipo === 'nuevo' && {
          tutorNuevo: {
            nombre: tutorNuevo.nombre.trim(), primerApellido: tutorNuevo.primerApellido.trim(), segundoApellido: opcional(tutorNuevo.segundoApellido),
            dni: tutorNuevo.dni.trim(), telefono: tutorNuevo.telefono.trim(), email: tutorNuevo.email.trim(),
          },
        }),
      })
      onHecha(alta.id, `${alta.nombre} ${alta.apellidos}, dado de alta con el n.º ${alta.numeroHermano}.`)
    } catch (e: unknown) {
      setError(mensajeDe(e, 'No se ha podido dar de alta.'))
    } finally {
      setEnviando(false)
    }
  }

  const listo = persona.nombre.trim() && persona.primerApellido.trim() && persona.fechaNacimiento
    && (quien === 'ADULTO' ? persona.dni.trim() && persona.telefono.trim() && persona.email.trim() : tutor !== null)

  return (
    <Stack spacing={2} component="form" onSubmit={(e) => { e.preventDefault(); void enviar() }}>
      <ToggleButtonGroup exclusive size="small" fullWidth value={quien} onChange={(_e, v: Quien | null) => v && setQuien(v)} aria-label="Quién se da de alta">
        <ToggleButton value="ADULTO">Adulto</ToggleButton>
        <ToggleButton value="MENOR">Menor de edad</ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <Box sx={{ gridColumn: '1 / -1' }}>{campo('nombre', 'Nombre', { required: true, autoFocus: true })}</Box>
        {campo('primerApellido', 'Primer apellido', { required: true })}
        {campo('segundoApellido', 'Segundo apellido')}
        {campo('fechaNacimiento', 'Nacimiento', { type: 'date', required: true, slotProps: { inputLabel: { shrink: true } } })}
        <TextField size="small" select label="Sexo" value={persona.sexo} onChange={(e) => setPersona({ ...persona, sexo: e.target.value })} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
          <MenuItem value="">Sin indicar</MenuItem>
          <MenuItem value="HOMBRE">Hombre</MenuItem>
          <MenuItem value="MUJER">Mujer</MenuItem>
        </TextField>
        {campo('dni', quien === 'ADULTO' ? 'DNI' : 'DNI (si tiene)', { required: quien === 'ADULTO' })}
        {campo('telefono', quien === 'ADULTO' ? 'Teléfono' : 'Teléfono (si no, el del tutor)', { required: quien === 'ADULTO', slotProps: { htmlInput: { inputMode: 'tel' } } })}
        <Box sx={{ gridColumn: '1 / -1' }}>{campo('email', quien === 'ADULTO' ? 'Correo' : 'Correo (si no, el del tutor)', { type: 'email', required: quien === 'ADULTO' })}</Box>
      </Box>

      {quien === 'ADULTO' && (
        <Typography variant="body2" color="text.secondary">
          Se le abre su cuenta con ese correo. Para entrar al área de hermanos, «He olvidado mi contraseña».
        </Typography>
      )}

      {quien === 'MENOR' && (
        <Stack spacing={1.5}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary' }}>Tutor</Typography>
          {tutor?.tipo === 'censo' ? (
            <Alert severity="success" icon={false} action={<Button color="inherit" size="small" onClick={() => setTutor(null)}>Cambiar</Button>}>
              Cuelga de la cuenta de {tutor.nombre}.
            </Alert>
          ) : tutor?.tipo === 'nuevo' ? (
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <Box sx={{ gridColumn: '1 / -1' }}>{campoTutor('nombre', 'Nombre del tutor')}</Box>
              {campoTutor('primerApellido', 'Primer apellido')}
              {campoTutor('segundoApellido', 'Segundo apellido')}
              {campoTutor('dni', 'DNI')}
              {campoTutor('telefono', 'Teléfono', { slotProps: { htmlInput: { inputMode: 'tel' } } })}
              <Box sx={{ gridColumn: '1 / -1' }}>{campoTutor('email', 'Correo', { type: 'email' })}</Box>
              <Button size="small" onClick={() => setTutor(null)} sx={{ justifySelf: 'start' }}>Buscar tutor en el censo</Button>
            </Box>
          ) : (
            <>
              <BuscadorPersonas etiqueta="Buscar al tutor en el censo" onElegir={(p) => setTutor({ tipo: 'censo', id: p.id, nombre: `${p.nombre} ${p.apellidos}` })} />
              <Button size="small" onClick={() => setTutor({ tipo: 'nuevo' })} sx={{ alignSelf: 'start' }}>El tutor no está en el censo</Button>
            </>
          )}
          <TextField size="small" select label="Qué es del tutor" value={parentesco} onChange={(e) => setParentesco(e.target.value as DatosDeAlta['parentesco'])}>
            {PARENTESCOS.map((p) => <MenuItem key={p.valor} value={p.valor}>{p.etiqueta}</MenuItem>)}
          </TextField>
        </Stack>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
        <Button onClick={onCancelar} disabled={enviando}>Cancelar</Button>
        <Button type="submit" variant="contained" disabled={enviando || !listo}>Dar de alta</Button>
      </Stack>
    </Stack>
  )
}
