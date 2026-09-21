import { useEffect, useState } from 'react'
import { Alert, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField, Typography } from '@mui/material'
import Boton from '../../../components/Boton'
import CampoContrasena from '../../../components/CampoContrasena'
import { LONGITUD_MINIMA } from '../../../lib/passwordPolicy'
import { emanciparFicha, type ApiProfile } from '../../../lib/api/perfil'
import { ApiError } from '../../../lib/api/client'
import { esDniValido } from '../../../lib/validacion/identidad'

interface Props {
  ficha: ApiProfile | null
  onCerrar: () => void
  onHecho: (mensaje: string) => void
}

/**
 * Darle cuenta propia a quien ya tiene 18.
 *
 * Es una puerta de salida, no un ajuste: la ficha deja de colgar de esta cuenta
 * y pasa a ser suya, con su correo y su contraseña. Quien la gestionaba deja de
 * verla, y por eso se avisa antes de hacerlo.
 */
export default function DialogoEmancipar({ ficha, onCerrar, onHecho }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [dni, setDni] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (ficha) {
      // El correo que tenga en su ficha, si es suyo de verdad y no el del tutor.
      setEmail('')
      setPassword('')
      setDni(ficha.dni ?? '')
      setError(null)
    }
  }, [ficha])

  const guardar = async () => {
    if (!ficha) return
    setError(null)
    if (!email.trim()) { setError('Hace falta un correo suyo, distinto del tuyo.'); return }
    if (password.length < LONGITUD_MINIMA) { setError(`La contraseña necesita al menos ${LONGITUD_MINIMA} caracteres.`); return }
    if (dni && !esDniValido(dni)) { setError('Revisa el DNI o NIE: la letra no corresponde con el número.'); return }

    setGuardando(true)
    try {
      await emanciparFicha(ficha.id, { newEmail: email.trim(), newPassword: password, ...(dni ? { newDni: dni } : {}) })
      onHecho(`${ficha.nombre} ya tiene su propia cuenta. A partir de ahora entra con su correo y gestiona sus datos.`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se ha podido crear la cuenta. Inténtalo de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={ficha !== null} onClose={onCerrar} fullWidth maxWidth="sm">
      <DialogTitle>Darle cuenta propia a {ficha?.nombre}</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: 'text.secondary', fontSize: 15, mb: 2 }}>
          Su ficha dejará de estar a tu cargo: pasará a gestionarla él mismo con el correo y la contraseña que pongáis
          aquí. Tú dejarás de verla en «Mi familia». Su número de hermano y su historial no cambian.
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth label="Su email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              helperText="Uno suyo: será con el que entre, y no puede ser el tuyo."
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 7 }}>
            <CampoContrasena
              fullWidth label="Su contraseña" value={password} onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              helperText={`Al menos ${LONGITUD_MINIMA} caracteres. Podrá cambiarla al entrar.`}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 5 }}>
            <TextField
              fullWidth label="Su DNI/NIE" value={dni} onChange={(e) => setDni(e.target.value)}
              helperText="Si ya lo tiene."
              slotProps={{ htmlInput: { autoCapitalize: 'characters', spellCheck: false } }}
            />
          </Grid>
          {error && <Grid size={{ xs: 12 }}><Alert severity="error" role="alert">{error}</Alert></Grid>}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Boton appVariant="outline" onClick={onCerrar}>Cancelar</Boton>
        <Boton onClick={() => void guardar()} disabled={guardando}>
          {guardando ? 'Creando…' : 'Crear su cuenta'}
        </Boton>
      </DialogActions>
    </Dialog>
  )
}
