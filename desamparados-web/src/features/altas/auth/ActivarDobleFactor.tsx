import { useState } from 'react'
import { Alert, Box, Button, GlobalStyles, Paper, Stack, TextField, ThemeProvider, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { ESTILOS_GLOBALES_CMS, crearTemaCms } from '../../../theme/cms'
import { useAuthStore } from './store'
import { cerrarSesion } from './session'
import { sesionActual, activar2FA, generarQr2FA } from '../../../lib/api/auth'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { site } from '../../../config/site'
import { useModulos } from '../../../hooks/useModulos'
import PasoAvisosEnElMovil from './PasoAvisosEnElMovil'

// Como en AccesoCmsPage: el tema se crea una vez, no en cada render.
const TEMA = crearTemaCms('claro')

function mensajeDe(e: unknown, porDefecto: string) {
  return e instanceof ErrorDeApi ? e.message : porDefecto
}

/**
 * Lo único que ve una cuenta del equipo sin doble factor al entrar al CMS.
 *
 * Es obligatorio porque cada persona usa una sola cuenta, con la misma
 * contraseña para el área de hermanos y el CMS: sin el 2FA, esa contraseña
 * bastaba para administrar. El servidor ya rechaza todo lo demás
 * (FALTA_DOBLE_FACTOR); esta pantalla es la forma de salir de ahí.
 *
 * La sesión no se refresca al activarlo sino al salir del último paso: en
 * cuanto el store sabe que está activo, `ExigeRol` cambia esta pantalla por el
 * CMS, y los códigos de respaldo, que solo se enseñan una vez, se perderían.
 * Con los avisos en el móvil encendidos, después de los respaldos se ofrece
 * apuntar el móvil (`PasoAvisosEnElMovil`), para dejarlo todo hecho de una vez.
 */
export default function ActivarDobleFactor() {
  const cms = useAuthStore((state) => state.cms)
  const entrarSesion = useAuthStore((state) => state.entrarSesion)
  const { activo } = useModulos()

  const [qr, setQr] = useState<{ qrCodeUrl: string; secret: string } | null>(null)
  const [respaldos, setRespaldos] = useState<string[] | null>(null)
  // Tras guardar los respaldos, con el módulo encendido: apuntar el móvil.
  const [pasoAvisos, setPasoAvisos] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const refrescarSesion = async () => {
    const { cms: actualizado } = await sesionActual()
    if (actualizado) entrarSesion('cms', actualizado)
  }

  const pedirQr = async () => {
    setOcupado(true)
    setError(null)
    try {
      setQr(await generarQr2FA())
    } catch (e) {
      // 409: ya lo activó desde otra pestaña. Con la sesión al día, entra.
      if (e instanceof ErrorDeApi && e.status === 409) await refrescarSesion().catch(() => undefined)
      else setError(mensajeDe(e, 'No se ha podido generar el QR. Inténtalo de nuevo.'))
    } finally {
      setOcupado(false)
    }
  }

  const activar = async () => {
    setOcupado(true)
    setError(null)
    try {
      const { backupCodes } = await activar2FA(codigo.trim())
      setRespaldos(backupCodes)
      setQr(null)
      setCodigo('')
    } catch (e) {
      setError(mensajeDe(e, 'Código incorrecto. Comprueba que tu app muestra estos 6 dígitos.'))
    } finally {
      setOcupado(false)
    }
  }

  const continuar = async () => {
    setOcupado(true)
    try {
      await refrescarSesion()
    } catch {
      setError('Está activado, pero no se ha podido abrir el CMS. Recarga la página.')
      setOcupado(false)
    }
  }

  return (
    <ThemeProvider theme={TEMA}>
      <GlobalStyles styles={ESTILOS_GLOBALES_CMS} />
      <Helmet>
        <title>{`Activa el doble factor | CMS ${site.nombreCorto}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'background.default',
          color: 'text.primary',
          p: 2,
        }}
      >
        <Paper sx={{ p: { xs: 3, md: 5 }, maxWidth: 520, width: '100%' }}>
          <Typography variant="h3" component="h1" sx={{ mb: 1, fontSize: { xs: '26px', md: '32px' } }}>
            Activa el doble factor
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Para entrar en la administración, tu cuenta ({cms?.email}) necesita, además de la
            contraseña, un código que genera tu móvil. Es un momento, y solo se hace una vez.
          </Typography>

          <Stack spacing={2.5}>
            {error && <Alert severity="error" role="alert">{error}</Alert>}

            {pasoAvisos ? (
              <PasoAvisosEnElMovil ocupado={ocupado} alSeguir={() => { void continuar() }} />
            ) : respaldos ? (
              <>
                <Alert severity="warning">
                  Guarda ahora estos códigos de respaldo (en papel o en un gestor de contraseñas).
                  Solo se muestran esta vez: si pierdes el móvil, son la única forma de entrar.
                </Alert>
                <Box
                  component="ul"
                  sx={{ columns: { xs: 1, sm: 2 }, columnGap: 4, m: 0, p: 0, pl: 3, fontFamily: 'monospace' }}
                >
                  {respaldos.map((c) => <Box component="li" key={c} sx={{ mb: 0.5 }}>{c}</Box>)}
                </Box>
                <Button
                  variant="contained"
                  disabled={ocupado}
                  onClick={() => { if (activo('avisos-en-el-movil')) setPasoAvisos(true); else void continuar() }}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Los he guardado
                </Button>
              </>
            ) : qr ? (
              <>
                <Typography variant="body2" color="text.secondary">
                  Escanea el QR con tu app de autenticación (Google Authenticator, Aegis,
                  1Password…) y escribe el código de 6 dígitos que muestre.
                </Typography>
                <Box
                  component="img"
                  src={qr.qrCodeUrl}
                  alt="QR para configurar el doble factor"
                  sx={{ width: 220, height: 220, border: '1px solid rgba(0,0,0,0.12)', borderRadius: 1 }}
                />
                <Typography variant="body2" color="text.secondary">
                  ¿Sin cámara? Introduce esta clave a mano:{' '}
                  <Box component="span" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{qr.secret}</Box>
                </Typography>
                <TextField
                  label="Código de 6 dígitos"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  sx={{ maxWidth: 320 }}
                />
                <Button
                  variant="contained"
                  disabled={ocupado || !/^[0-9]{6}$/.test(codigo.trim())}
                  onClick={() => { void activar() }}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Activar
                </Button>
              </>
            ) : (
              <Button variant="contained" disabled={ocupado} onClick={() => { void pedirQr() }} sx={{ alignSelf: 'flex-start' }}>
                Empezar
              </Button>
            )}

            <Button onClick={() => { void cerrarSesion('cms') }} sx={{ alignSelf: 'flex-start', color: 'text.secondary' }}>
              Salir
            </Button>
          </Stack>
        </Paper>
      </Box>
    </ThemeProvider>
  )
}
