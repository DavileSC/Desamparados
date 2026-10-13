import { useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from '@mui/material'
import CampoContrasena from '../../../components/CampoContrasena'
import TarjetaCristal from '../../../components/TarjetaCristal'
import { borrarMiCuenta, descargarMisDatos } from '../../../lib/api/auth'
import { guardarEnDisco } from '../../../lib/api/datos'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { cerrarSesion } from '../../altas/auth/session'
import { laCorporacion } from '../../../domain/articulos'

/**
 * Descargar los datos de la cuenta y borrarla (arts. 15 y 17 del RGPD). Va en
 * «Mi perfil» y también en la revisión del primer acceso: quien llega con el
 * censo importado puede querer irse sin dar antes el DNI o el IBAN que le
 * faltan, y el servidor deja estas dos rutas abiertas para eso.
 */
export default function MisDerechos() {
  const navigate = useNavigate()
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [password, setPassword] = useState('')
  const [borrando, setBorrando] = useState(false)
  const [errorBorrado, setErrorBorrado] = useState<string | null>(null)
  const [borrada, setBorrada] = useState<string | null>(null)

  const descargar = async () => {
    setDescargando(true); setErrorDescarga(null)
    try {
      guardarEnDisco(await descargarMisDatos(), 'mis-datos.json')
    } catch (e) {
      setErrorDescarga(e instanceof ErrorDeApi ? e.message : 'No se han podido descargar tus datos. Inténtalo otra vez.')
    } finally {
      setDescargando(false)
    }
  }

  const borrar = async (evento: FormEvent) => {
    evento.preventDefault()
    if (!password) { setErrorBorrado('Escribe tu contraseña para confirmarlo.'); return }
    setBorrando(true); setErrorBorrado(null)
    try {
      setBorrada((await borrarMiCuenta(password)).message)
    } catch (e) {
      setErrorBorrado(e instanceof ErrorDeApi ? e.message : 'No se ha podido borrar la cuenta. Inténtalo otra vez.')
    } finally {
      setBorrando(false)
    }
  }

  const cerrar = () => { setAbierto(false); setPassword(''); setErrorBorrado(null) }

  // La cuenta ya no existe y su sesión tampoco: se sale sin pasar por la
  // ventana de «sesión caducada», que pediría entrar con una cuenta borrada.
  const salir = async () => {
    await cerrarSesion('hermanos')
    navigate('/', { replace: true })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={() => void descargar()} disabled={descargando} sx={{ color: 'primary.light', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
          {descargando ? 'Preparando tus datos…' : 'Descargar mis datos'}
        </Button>
        <Button onClick={() => setAbierto(true)} sx={{ color: 'error.light', fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
          Borrar mi cuenta
        </Button>
      </Box>
      {errorDescarga && <Alert severity="error">{errorDescarga}</Alert>}

      <Dialog open={abierto} onClose={borrada || borrando ? undefined : cerrar} aria-labelledby="borrar-cuenta-titulo" fullWidth maxWidth="sm">
        <DialogTitle id="borrar-cuenta-titulo">{borrada ? 'Cuenta borrada' : '¿Borrar tu cuenta?'}</DialogTitle>
        {borrada ? (
          <>
            <DialogContent><DialogContentText role="status">{borrada}</DialogContentText></DialogContent>
            <DialogActions><Button variant="contained" onClick={() => void salir()} autoFocus>Salir</Button></DialogActions>
          </>
        ) : (
          <Box component="form" noValidate onSubmit={(e) => void borrar(e)}>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <DialogContentText>
                No se puede deshacer. Tus fichas y las de tu familia en esta cuenta pasan a baja en el censo, sin datos
                de contacto, y las papeletas pedidas y sin pagar se anulan. Los recibos se conservan el plazo que obliga
                la ley, sin tus datos. Si quieres, descarga antes tus datos.
              </DialogContentText>
              <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>
                Si solo quieres dejar la web y seguir en {laCorporacion()}, habla con Secretaría en vez de borrarla.
              </Typography>
              <CampoContrasena
                label="Tu contraseña"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={!!errorBorrado}
                fullWidth
              />
              {errorBorrado && <Alert severity="error">{errorBorrado}</Alert>}
            </DialogContent>
            <DialogActions>
              <Button onClick={cerrar} disabled={borrando}>Volver</Button>
              <Button type="submit" variant="contained" color="error" disabled={borrando}>
                {borrando ? 'Borrando…' : 'Borrar mi cuenta'}
              </Button>
            </DialogActions>
          </Box>
        )}
      </Dialog>
    </Box>
  )
}

/** En «Mi perfil», junto a la contraseña: como ella, es de la cuenta y no de una ficha. */
export function ApartadoMisDatos() {
  const idTitulo = useId()
  return (
    <TarjetaCristal component="section" aria-labelledby={idTitulo} sx={{ p: { xs: 2.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography id={idTitulo} component="h2" sx={{ fontSize: 20, fontWeight: 600 }}>Tus datos y tu cuenta</Typography>
      <Typography sx={{ fontSize: 15, color: 'text.secondary', maxWidth: '62ch' }}>
        Puedes descargar todo lo que guardamos de tu cuenta y de las fichas de tu familia, o borrar la cuenta.
      </Typography>
      <MisDerechos />
    </TarjetaCristal>
  )
}
