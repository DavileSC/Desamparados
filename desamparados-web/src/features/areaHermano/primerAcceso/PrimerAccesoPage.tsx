import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Skeleton, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import TarjetaCristal from '../../../components/TarjetaCristal'
import Boton from '../../../components/Boton'
import CampoContrasena from '../../../components/CampoContrasena'
import { datosInvitacion, estrenarCuenta } from '../../../lib/api/auth'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { contrasenaNueva } from '../../../lib/politicaDeContrasena'
import { useAuthStore } from '../../altas/auth/store'
import { laCorporacion, mayuscula } from '../../../domain/articulos'
import { site } from '../../../config/site'

const ENLACE = /^[a-f0-9]{64}$/i

const contrasenaSchema = z.object({ password: contrasenaNueva })
type ContrasenaFormData = z.infer<typeof contrasenaSchema>

/**
 * Adonde lleva el correo de la invitación del censo importado. Saluda por el
 * nombre, pide la contraseña y entra directamente a revisar la ficha: abrir
 * el enlace ya prueba que la cuenta es suya.
 */
export default function PrimerAccesoPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const entrarSesion = useAuthStore((s) => s.entrarSesion)
  const token = params.get('token') ?? ''
  const valido = ENLACE.test(token)

  const invitacion = useQuery({
    queryKey: ['primer-acceso', 'invitacion', token],
    queryFn: () => datosInvitacion(token),
    enabled: valido,
    retry: false,
    // El enlace se gasta al usarlo: no tiene sentido volver a preguntar.
    staleTime: Infinity,
  })

  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ContrasenaFormData>({
    resolver: zodResolver(contrasenaSchema),
    defaultValues: { password: '' },
  })

  const empezar = async (datos: ContrasenaFormData) => {
    try {
      const { user } = await estrenarCuenta(token, datos.password, false)
      entrarSesion('hermanos', user)
      navigate('/primer-acceso/ficha', { replace: true })
    } catch (e) {
      setError('root', { message: e instanceof ErrorDeApi ? e.message : 'No se ha podido guardar la contraseña. Inténtalo otra vez.' })
    }
  }

  const caducado = !valido || invitacion.isError
  const nombre = invitacion.data?.nombre

  return (
    <>
      <Helmet><title>{`Primer acceso | ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <TarjetaCristal sx={{ width: '100%', p: { xs: 3, md: 5 }, maxWidth: 520, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {caducado ? (
          <>
            <Typography variant="h3" component="h1" sx={{ fontSize: { xs: '26px', md: '32px' } }}>El enlace ya no vale</Typography>
            <Alert severity="warning">
              {invitacion.error instanceof ErrorDeApi ? invitacion.error.message : 'El enlace de la invitación no es válido o ha caducado.'}
            </Alert>
            <Typography sx={{ color: 'text.secondary' }}>
              Si ya pusiste tu contraseña, entra con ella. Si no, pide un enlace nuevo con tu correo: te llevará al mismo sitio.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Boton component={Link} to="/acceso">Entrar</Boton>
              <Boton appVariant="outline" component={Link} to="/reset-password">Pedir un enlace nuevo</Boton>
            </Box>
          </>
        ) : (
          <>
            <Box>
              <Typography variant="h3" component="h1" sx={{ fontSize: { xs: '26px', md: '32px' }, textWrap: 'balance' }}>
                {nombre ? `Te damos la bienvenida, ${nombre}` : <Skeleton width="80%" />}
              </Typography>
              <Typography sx={{ color: 'text.secondary', mt: 1.5 }}>
                {mayuscula(laCorporacion())} ha pasado el censo a la web y ya tienes tu cuenta en el área de hermanos.
                Antes de entrar, crea tu contraseña y comprueba que tus datos están bien: los tuyos y los de los familiares
                que figuran con tu correo. Es un par de minutos: solo tendrás que rellenar lo que falte.
              </Typography>
            </Box>

            <Box component="form" noValidate onSubmit={handleSubmit(empezar)} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {/* El usuario del gestor de contraseñas: así guarda la nueva con su correo. */}
              <TextField label="Tu correo (con él entrarás)" value={invitacion.data?.email ?? ''} autoComplete="username" slotProps={{ input: { readOnly: true }, inputLabel: { shrink: true } }} fullWidth />
              {/* Sin «Repítela»: el ojo del campo deja ver lo escrito, y una
                  segunda casilla era un paso más en una entrada que ya es larga. */}
              <CampoContrasena label="Crea tu contraseña" autoComplete="new-password" fullWidth error={!!errors.password} helperText={errors.password?.message ?? 'Pulsa el ojo para ver lo que escribes.'} {...register('password')} />
              {errors.root?.message && <Alert severity="error">{errors.root.message}</Alert>}
              <Boton type="submit" fullWidth disabled={isSubmitting || !invitacion.data}>Empezar</Boton>
            </Box>
          </>
        )}
      </TarjetaCristal>
    </>
  )
}
