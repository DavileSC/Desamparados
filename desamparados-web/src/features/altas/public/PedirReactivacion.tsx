import { useState, type FormEvent } from 'react'
import { Alert, Box, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import Boton from '../../../components/Boton'
import { pedirReactivacion } from '../../../lib/api/auth'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { esDniValido } from '../../../lib/validacion/identidad'

const EMAIL = /^[^\s@,;<>()":\\[\]]+@[^\s@,;<>()":\\[\]]+\.[^\s@,;<>()":\\[\]]+$/

/**
 * El camino de vuelta de quien fue hermano y causó baja. Antes solo aparecía
 * cuando el alta chocaba con un DNI del censo, pero el alta ya no lo dice (el
 * formulario servía para averiguar quién es hermano): ahora el acceso está
 * siempre, y el correo de un alta no tramitada remite aquí. La respuesta del
 * servidor es la misma exista o no la ficha, y se enseña tal cual.
 */
export default function PedirReactivacion({ sx }: { sx?: object }) {
  const [abierto, setAbierto] = useState(false)
  const [dni, setDni] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const abrir = () => { setDni(''); setEmail(''); setError(null); setHecho(null); setAbierto(true) }

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault()
    setError(null)
    if (!esDniValido(dni)) { setError('Revisa el DNI o NIE: la letra no corresponde con el número.'); return }
    if (!EMAIL.test(email.trim())) { setError('Escribe un correo electrónico válido.'); return }
    setEnviando(true)
    try {
      const { message } = await pedirReactivacion(dni, email.trim())
      setHecho(message)
    } catch (e) {
      setError(e instanceof ErrorDeApi ? e.message : 'No se ha podido enviar la petición. Inténtalo más tarde.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <Box component="button" type="button" onClick={abrir} sx={{ appearance: 'none', background: 'none', border: 0, p: 0, cursor: 'pointer', font: 'inherit', ...sx }}>
        ¿Fuiste hermano? Pide la reactivación
        <ArrowForwardIcon />
      </Box>
      <Dialog open={abierto} onClose={() => setAbierto(false)} fullWidth maxWidth="xs" aria-labelledby="reactivacion-titulo">
        <Box component="form" noValidate onSubmit={(e) => void enviar(e)}>
          <DialogTitle id="reactivacion-titulo">Pedir la reactivación</DialogTitle>
          <DialogContent sx={{ display: 'grid', gap: 2 }}>
            {hecho ? (
              <Alert severity="success" role="status">{hecho}</Alert>
            ) : (
              <>
                <Typography sx={{ fontSize: 15, lineHeight: 1.6, color: 'text.secondary' }}>
                  Si fuiste hermano y causaste baja, no hace falta rellenar el alta de nuevo: déjanos tu DNI y un
                  correo, y Secretaría lo revisará.
                </Typography>
                <TextField
                  label="DNI/NIE" value={dni} onChange={(e) => setDni(e.target.value)} fullWidth autoComplete="off"
                  slotProps={{ htmlInput: { autoCapitalize: 'characters', spellCheck: false } }}
                />
                <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth autoComplete="email" />
                {error && <Alert severity="error" role="alert">{error}</Alert>}
              </>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            {hecho ? (
              <Boton type="button" onClick={() => setAbierto(false)}>Cerrar</Boton>
            ) : (
              <>
                <Boton type="button" appVariant="outline" onClick={() => setAbierto(false)}>Cancelar</Boton>
                <Boton type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Pedir la reactivación'}</Boton>
              </>
            )}
          </DialogActions>
        </Box>
      </Dialog>
    </>
  )
}
