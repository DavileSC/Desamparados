import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Button, Stack } from '@mui/material'
import CampoContrasena from '../../../components/CampoContrasena'
import Boton from '../../../components/Boton'
import { cambiarContrasena, sesionActual } from '../../../lib/api/auth'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { useAuthStore } from './store'
import { cambiarContrasenaSchema, type CambiarContrasenaFormData } from './schema'

interface Props {
  /** El CMS pinta sus botones con los de MUI; el área de hermanos, con `Boton`. */
  variante: 'cms' | 'area'
  /** Con él aparece «Cancelar»: el área de hermanos lo abre y lo cierra. */
  onCancelar?: () => void
  /** Tras cambiarla, con el mensaje del servidor. */
  onHecho?: (mensaje: string) => void
  /**
   * Si hay algo escrito, para que quien lo contiene pregunte antes de tirarlo
   * (el área de hermanos, al cambiar de pestaña o de pantalla).
   */
  onSucio?: (sucio: boolean) => void
}

const VACIO: CambiarContrasenaFormData = { actual: '', nueva: '', confirmacion: '' }
const CAMPOS = ['actual', 'nueva'] as const

/**
 * Cambiar la contraseña con la sesión abierta: la actual y la nueva dos veces.
 * Sirve igual en el área de hermanos y en el CMS porque es la misma cuenta.
 *
 * El servidor corta todas las sesiones y da cookies nuevas a las de este
 * navegador, así que al terminar se vuelve a preguntar por ellas: lo que tenía
 * el store eran las de antes del corte.
 */
export default function CambiarContrasena({ variante, onCancelar, onHecho, onSucio }: Props) {
  const ponerSesiones = useAuthStore((state) => state.ponerSesiones)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  const { register, handleSubmit, reset, control, setError: marcarCampo, formState: { errors, isSubmitting } } = useForm<CambiarContrasenaFormData>({
    resolver: zodResolver(cambiarContrasenaSchema),
    defaultValues: VACIO,
  })

  // Cualquiera de los tres cuenta: aunque solo esté la actual, volver a
  // escribirla tras perderla por un clic en otra pestaña es lo que se evita.
  const escritos = useWatch({ control })
  const sucio = Object.values(escritos).some((valor) => !!valor)
  useEffect(() => {
    onSucio?.(sucio)
    // Al cerrarse (Cancelar, hecho, otra pestaña) ya no queda nada a medias.
    return () => onSucio?.(false)
  }, [sucio, onSucio])

  const enviar = async (datos: CambiarContrasenaFormData) => {
    setError(null)
    setHecho(null)
    try {
      const { message } = await cambiarContrasena(datos.actual, datos.nueva)
      reset(VACIO)
      setHecho(message)
      onHecho?.(message)
      // Si /auth/me falla, las cookies nuevas ya están puestas: la siguiente
      // petición que lo necesite volverá a preguntar.
      await sesionActual().then(ponerSesiones).catch(() => undefined)
    } catch (e) {
      if (e instanceof ErrorDeApi) {
        // Los errores de un campo, bajo su casilla; el resto (la actual
        // equivocada, demasiados intentos), arriba con el texto del servidor.
        const porCampo = CAMPOS.filter((campo) => e.fields[campo])
        for (const campo of porCampo) marcarCampo(campo, { type: 'server', message: e.fields[campo] })
        if (porCampo.length === 0) setError(e.message)
        return
      }
      setError('No se ha podido cambiar la contraseña. Inténtalo de nuevo.')
    }
  }

  const texto = isSubmitting ? 'Cambiando…' : 'Cambiar la contraseña'

  return (
    <Box component="form" noValidate onSubmit={(e) => void handleSubmit(enviar)(e)} sx={{ display: 'grid', gap: 2.25, maxWidth: 440 }}>
      {error && <Alert severity="error" role="alert">{error}</Alert>}
      {hecho && <Alert severity="success" role="status">{hecho}</Alert>}
      <CampoContrasena label="Contraseña actual" autoComplete="current-password" fullWidth error={!!errors.actual} helperText={errors.actual?.message} {...register('actual')} />
      <CampoContrasena label="Contraseña nueva" autoComplete="new-password" fullWidth error={!!errors.nueva} helperText={errors.nueva?.message} {...register('nueva')} />
      <CampoContrasena label="Repite la contraseña nueva" autoComplete="new-password" fullWidth error={!!errors.confirmacion} helperText={errors.confirmacion?.message} {...register('confirmacion')} />
      <Stack direction="row" spacing={1} sx={{ justifyContent: variante === 'area' ? 'flex-end' : 'flex-start' }}>
        {variante === 'cms' ? (
          <>
            <Button type="submit" variant="contained" disabled={isSubmitting}>{texto}</Button>
            {onCancelar && <Button onClick={onCancelar} disabled={isSubmitting}>Cancelar</Button>}
          </>
        ) : (
          <>
            {onCancelar && <Button onClick={onCancelar} disabled={isSubmitting} sx={{ color: 'text.secondary' }}>Cancelar</Button>}
            <Boton type="submit" disabled={isSubmitting} sx={{ py: 1.25, px: 3 }}>{texto}</Boton>
          </>
        )}
      </Stack>
    </Box>
  )
}
