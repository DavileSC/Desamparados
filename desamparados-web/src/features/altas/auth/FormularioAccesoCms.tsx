import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { Alert, Box, Button, Checkbox, FormControlLabel, TextField, Typography } from '@mui/material'
import CampoContrasena from '../../../components/CampoContrasena'
import { loginSchema, twoFactorSchema, type LoginFormInput, type LoginFormData, type TwoFactorFormData } from './schema'
import { isStaffRole, type AuthUser } from './store'
import { login as apiLogin, verify2FA, cerrarSesionApi, type LoginResponse } from '../../../lib/api/auth'
import { leerEsteMovil, type MovilDeEsteNavegador } from '../../../lib/movilApuntado'
import { codigoError, errorMessage } from './errores'
import { EntrarDesdeEsteMovil, EsperaDeLaAprobacion } from './AprobarEnElMovil'

/**
 * El segundo paso. `espera`: el número en pantalla mientras el móvil aprueba;
 * `este-movil`: se entra desde un móvil apuntado y aprueba él mismo; `codigo`:
 * el de la app, que vale siempre. `aviso` cuenta por qué se llegó al código
 * sin elegirlo (el número fallado, el aviso caducado…).
 */
type SegundoPaso =
  | { modo: 'espera'; message: string; numero: number; expiraEn: string }
  | { modo: 'este-movil'; message: string; nombre: string }
  | { modo: 'codigo'; message: string; aviso?: string }

interface Props {
  /** Ya hay sesión del CMS con un usuario del equipo: qué hacer con ella. */
  alEntrar: (user: AuthUser) => void
  /** Lo que se lee encima de los campos en el primer paso. */
  subtitulo: string
  emailInicial?: string
  /**
   * Dentro de la ventana de sesión caducada no se ofrece «¿Has olvidado tu
   * contraseña?»: lleva a otra página y desmontaría lo que se quería salvar.
   */
  sinEnlaceDeOlvido?: boolean
  /** Al entrar y salir de la espera del móvil, que pide una tarjeta más ancha. */
  alCambiarDeAncho?: (ancho: boolean) => void
}

/**
 * Los dos pasos de entrar al CMS (contraseña y segundo factor). Vive aparte de
 * `AccesoCmsPage` porque se usa también en la ventana que sale cuando la
 * sesión caduca a media edición: dos copias del login acabarían tratando
 * distinto el 2FA caducado o la cuenta sin rol del equipo.
 */
export default function FormularioAccesoCms({ alEntrar, subtitulo, emailInicial = '', sinEnlaceDeOlvido = false, alCambiarDeAncho }: Props) {
  const [pending2FA, setPendiente] = useState<SegundoPaso | null>(null)
  const [rechazado, setRechazado] = useState(false)

  const setPending2FA = (paso: SegundoPaso | null) => {
    setPendiente(paso)
    alCambiarDeAncho?.(paso?.modo === 'espera')
  }

  const credentialsForm = useForm<LoginFormInput, unknown, LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: emailInicial, password: '', recordarme: false },
  })

  const twoFactorForm = useForm<TwoFactorFormData>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: { code: '' },
  })

  /** `esteMovil`: el móvil apuntado en este navegador, si se leyó al mandar la contraseña. */
  const alResponder = async (response: LoginResponse, esteMovil?: MovilDeEsteNavegador | null) => {
    if (response.status === '2FA_NEEDED') {
      if (response.esteMovil && esteMovil) {
        setPending2FA({ modo: 'este-movil', message: response.message, nombre: esteMovil.nombre })
      } else if (response.aprobacion) {
        setPending2FA({ modo: 'espera', message: response.message, ...response.aprobacion })
      } else {
        setPending2FA({ modo: 'codigo', message: response.message })
      }
      return
    }

    // Red de seguridad: el backend ya no da sesión del CMS a una cuenta sin
    // rol del equipo (responde 403 CUENTA_SIN_CMS). Si aun así llegara una,
    // se cierra en el acto: este acceso no reparte sesiones del área de hermanos.
    if (!isStaffRole(response.user.role)) {
      await cerrarSesionApi('cms').catch(() => undefined)
      setRechazado(true)
      return
    }

    alEntrar(response.user)
  }

  const onSubmitCredentials = async (data: LoginFormData) => {
    setRechazado(false)
    try {
      // Si este navegador es un móvil apuntado, se dice: así no se manda el
      // aviso a sí mismo y puede aprobar aquí mismo.
      const movil = await leerEsteMovil()
      await alResponder(await apiLogin(data.email, data.password, data.recordarme, 'cms', movil?.dispositivo), movil)
    } catch (e) {
      // Cuenta de hermano con la contraseña correcta: el servidor no crea la
      // sesión y se le indica su acceso, con enlace, en vez del error genérico.
      if (codigoError(e) === 'CUENTA_SIN_CMS') {
        setRechazado(true)
        return
      }
      credentialsForm.setError('root', { message: errorMessage(e, 'Email o contraseña incorrectos') })
    }
  }

  /** Del aviso al código de la app, con el porqué si no lo eligió quien entra. */
  const usarCodigo = (aviso?: string) => {
    setPending2FA({ modo: 'codigo', message: 'Introduce el código de tu aplicación de autenticación.', aviso })
  }

  /** A la contraseña otra vez: el testigo del primer paso ya no vale. */
  const volver = (aviso?: string) => {
    setPending2FA(null)
    twoFactorForm.reset()
    if (aviso) credentialsForm.setError('root', { message: aviso })
  }

  const onSubmit2FA = async (data: TwoFactorFormData) => {
    try {
      await alResponder(await verify2FA(data.code))
    } catch (e) {
      // El paso de la contraseña caducó (5 min) o su testigo ya se usó: de
      // nada sirve seguir probando códigos, hay que volver al primer paso.
      if (codigoError(e) === 'PENDING_2FA_REQUIRED') {
        setPending2FA(null)
        twoFactorForm.reset()
        credentialsForm.setError('root', { message: errorMessage(e, 'La verificación ha caducado. Vuelve a introducir tu email y contraseña.') })
        return
      }
      twoFactorForm.setError('root', { message: errorMessage(e, 'Código incorrecto o expirado') })
    }
  }

  return (
    <>
      {rechazado && (
        <Alert severity="error" role="alert" sx={{ mb: 2 }}>
          Esta cuenta no pertenece al equipo del CMS. Si eres hermano, entra por el{' '}
          <Link to="/acceso">acceso del área de hermanos</Link>.
        </Alert>
      )}

      {pending2FA?.modo === 'espera' ? (
        <>
          <Typography variant="body2" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
            Te hemos mandado un aviso al móvil. Ábrelo y toca este número.
          </Typography>
          <EsperaDeLaAprobacion
            numero={pending2FA.numero}
            expiraEn={pending2FA.expiraEn}
            alAprobar={(user) => { void alResponder({ status: 'OK', user }) }}
            alUsarCodigo={usarCodigo}
            alVolver={volver}
          />
        </>
      ) : pending2FA?.modo === 'este-movil' ? (
        <EntrarDesdeEsteMovil
          nombre={pending2FA.nombre}
          alAprobar={(user) => { void alResponder({ status: 'OK', user }) }}
          alUsarCodigo={usarCodigo}
          alVolver={volver}
        />
      ) : pending2FA ? (
        <>
          <Typography variant="body2" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
            {pending2FA.message}
          </Typography>
          {pending2FA.aviso && <Alert severity="info" sx={{ mb: 3 }}>{pending2FA.aviso}</Alert>}
          <Box
            component="form"
            onSubmit={twoFactorForm.handleSubmit(onSubmit2FA)}
            sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
          >
            {twoFactorForm.formState.errors.root && (
              <Alert severity="error" role="alert">{twoFactorForm.formState.errors.root.message}</Alert>
            )}
            <TextField
              label="Código de verificación"
              autoComplete="one-time-code"
              inputMode="numeric"
              autoFocus
              fullWidth
              error={!!twoFactorForm.formState.errors.code}
              helperText={twoFactorForm.formState.errors.code?.message ?? 'Código de tu app de autenticación o un código de respaldo.'}
              {...twoFactorForm.register('code')}
            />
            <Button type="submit" variant="contained" fullWidth disabled={twoFactorForm.formState.isSubmitting}>
              Verificar
            </Button>
            <Button
              type="button"
              onClick={() => setPending2FA(null)}
              sx={{ color: 'text.secondary', alignSelf: 'center' }}
            >
              Volver
            </Button>
          </Box>
        </>
      ) : (
        <>
          <Typography variant="body2" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
            {subtitulo}
          </Typography>
          <Box
            component="form"
            onSubmit={credentialsForm.handleSubmit(onSubmitCredentials)}
            sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
          >
            {credentialsForm.formState.errors.root && (
              <Alert severity="error" role="alert">{credentialsForm.formState.errors.root.message}</Alert>
            )}

            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              fullWidth
              error={!!credentialsForm.formState.errors.email}
              helperText={credentialsForm.formState.errors.email?.message}
              {...credentialsForm.register('email')}
            />

            <CampoContrasena
              label="Contraseña"
              autoComplete="current-password"
              fullWidth
              error={!!credentialsForm.formState.errors.password}
              helperText={credentialsForm.formState.errors.password?.message}
              {...credentialsForm.register('password')}
            />

            <FormControlLabel
              control={<Checkbox {...credentialsForm.register('recordarme')} />}
              label="Recuérdame"
            />

            <Button type="submit" variant="contained" fullWidth disabled={credentialsForm.formState.isSubmitting}>
              Entrar
            </Button>
            {!sinEnlaceDeOlvido && (
              <Box component={Link} to="/reset-password?area=cms" sx={{ color: 'text.primary', textDecoration: 'underline', textUnderlineOffset: '3px', textAlign: 'center', fontSize: '14px', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                ¿Has olvidado tu contraseña?
              </Box>
            )}
          </Box>
        </>
      )}
    </>
  )
}
