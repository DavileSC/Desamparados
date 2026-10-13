import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { Alert, Box, Button, Checkbox, FormControlLabel, TextField, Typography } from '@mui/material'
import Boton from '../../../components/Boton'
import CampoContrasena from '../../../components/CampoContrasena'
import { loginSchema, twoFactorSchema, type LoginFormInput, type LoginFormData, type TwoFactorFormData } from './schema'
import type { AuthUser } from './store'
import { login as apiLogin, verify2FA, type LoginResponse } from '../../../lib/api/auth'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { enlaceConFlecha } from '../../../components/estiloDeBoton'

function errorMessage(e: unknown, fallback: string) {
  return e instanceof ErrorDeApi ? e.message : fallback
}

interface Props {
  /** Ya hay sesión del área de hermanos: qué hacer con ella. */
  alEntrar: (user: AuthUser) => void
  /** Lo que se lee encima de los campos en el primer paso. */
  subtitulo: string
  emailInicial?: string
  /**
   * Dentro de la ventana de sesión caducada no se ofrece «¿Has olvidado tu
   * contraseña?»: lleva a otra página y desmontaría lo que se quería salvar.
   */
  sinEnlaceDeOlvido?: boolean
}

/**
 * Los dos pasos de entrar al área de hermanos (contraseña y segundo factor).
 * Vive aparte de `AccesoPage`, como `FormularioAccesoCms`, porque se usa
 * también en la ventana que sale cuando la sesión caduca con Mi perfil o la
 * revisión del primer acceso a medias: dos copias del login acabarían
 * tratando distinto el segundo factor.
 */
export default function FormularioAccesoHermano({ alEntrar, subtitulo, emailInicial = '', sinEnlaceDeOlvido = false }: Props) {
  // Segundo paso del login cuando la cuenta tiene 2FA activado. Al usuario lo
  // identifica una cookie de vida corta que emitio el servidor, no este estado.
  const [pending2FA, setPending2FA] = useState<{ message: string } | null>(null)

  const credentialsForm = useForm<LoginFormInput, unknown, LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: emailInicial, password: '', recordarme: false },
  })

  const twoFactorForm = useForm<TwoFactorFormData>({
    resolver: zodResolver(twoFactorSchema),
    defaultValues: { code: '' },
  })

  const alResponder = (response: LoginResponse) => {
    if (response.status === '2FA_NEEDED') {
      setPending2FA({ message: response.message })
      return
    }
    alEntrar(response.user)
  }

  const onSubmitCredentials = async (data: LoginFormData) => {
    try {
      alResponder(await apiLogin(data.email, data.password, data.recordarme, 'hermanos'))
    } catch (e) {
      credentialsForm.setError('root', { message: errorMessage(e, 'Email o contraseña incorrectos') })
    }
  }

  const onSubmit2FA = async (data: TwoFactorFormData) => {
    if (!pending2FA) return
    try {
      alResponder(await verify2FA(data.code))
    } catch (e) {
      twoFactorForm.setError('root', { message: errorMessage(e, 'Código incorrecto o expirado') })
    }
  }

  if (pending2FA) {
    return (
      <>
        <Typography variant="body2" sx={{ mb: 4, textAlign: 'center', color: 'text.secondary' }}>
          {pending2FA.message}
        </Typography>
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
          <Boton type="submit" fullWidth disabled={twoFactorForm.formState.isSubmitting}>
            Verificar
          </Boton>
          <Button
            type="button"
            onClick={() => setPending2FA(null)}
            sx={{ ...enlaceConFlecha, color: 'text.secondary', alignSelf: 'center' }}
          >
            Volver
          </Button>
        </Box>
      </>
    )
  }

  return (
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

        <Boton type="submit" fullWidth disabled={credentialsForm.formState.isSubmitting}>
          Entrar
        </Boton>
        {!sinEnlaceDeOlvido && (
          <Box component={Link} to="/reset-password" sx={{ color: 'secondary.main', textAlign: 'center', fontSize: '14px', minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            ¿Has olvidado tu contraseña?
          </Box>
        )}
      </Box>
    </>
  )
}
