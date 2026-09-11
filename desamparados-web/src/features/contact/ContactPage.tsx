import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Box,
  Typography,
  TextField,
  Grid,
  Alert,
} from '@mui/material'
import EmailIcon from '@mui/icons-material/Email'
import PhoneIcon from '@mui/icons-material/Phone'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import { Helmet } from 'react-helmet-async'
import PageContainer from '../../components/PageContainer'
import PageHeader from '../../components/PageHeader'
import AnimatedSection from '../../components/AnimatedSection'
import GlassCard from '../../components/GlassCard'
import AppButton from '../../components/AppButton'
import { contactSchema, type ContactFormData } from './schema'
import { sendContactMessage } from '../../lib/api/contact'

const contactDetails = [
  {
    icon: <EmailIcon sx={{ color: 'secondary.main' }} />,
    label: 'Email',
    value: 'info@desamparados.es',
  },
  {
    icon: <PhoneIcon sx={{ color: 'secondary.main' }} />,
    label: 'Teléfono',
    value: '+34 951 234 567',
  },
  {
    icon: <LocationOnIcon sx={{ color: 'secondary.main' }} />,
    label: 'Dirección',
    value: 'Calle Ejemplo, 12, Málaga',
  },
  {
    icon: <AccessTimeIcon sx={{ color: 'secondary.main' }} />,
    label: 'Horario de atención',
    value: 'Lunes a Viernes, 9:00 - 14:00',
  },
]

// Trampa para robots: fuera de la vista, del tabulador y de los lectores de
// pantalla. Una persona no la ve ni la rellena; un programa que rellena todo
// lo que encuentra, sí, y el servidor descarta ese envío sin decírselo.
const trampaOculta = {
  position: 'absolute',
  left: '-10000px',
  top: 'auto',
  width: 1,
  height: 1,
  overflow: 'hidden',
} as const

/**
 * Cuánto se ha tardado en rellenar el formulario, desde que se abrió (o se vació
 * tras enviar). El servidor descarta en silencio lo que se rellena en menos de
 * 3 segundos, que no es de una persona.
 */
function useTiempoRelleno() {
  const abiertoEn = useRef(0)
  useEffect(() => { abiertoEn.current = Date.now() }, [])
  const medir = useCallback(() => Date.now() - abiertoEn.current, [])
  const reiniciar = useCallback(() => { abiertoEn.current = Date.now() }, [])
  return { medir, reiniciar }
}

export default function ContactPage() {
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const tiempoRelleno = useTiempoRelleno()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nombre: '',
      email: '',
      telefono: '',
      asunto: '',
      mensaje: '',
      comentarioAdicional: '',
    },
  })

  const onSubmit = async (data: ContactFormData) => {
    setSuccess(false)
    setServerError(null)
    try {
      await sendContactMessage(data, tiempoRelleno.medir())
      setSuccess(true)
      reset()
      tiempoRelleno.reiniciar()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'No se ha podido enviar el mensaje. Inténtalo de nuevo más tarde.')
    }
  }

  return (
    <>
      <Helmet>
        <title>Contacto | Desamparados</title>
      </Helmet>

      <PageHeader title="Contacto" subtitle="Estamos a tu disposición." />

      <AnimatedSection sx={{ py: { xs: 6, md: 10 } }}>
        <PageContainer>
          <Grid container spacing={6}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Box
                component="form"
                onSubmit={handleSubmit(onSubmit)}
                sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}
              >
                {success && (
                  <Alert severity="success">
                    Mensaje enviado correctamente. Gracias por contactar con nosotros.
                  </Alert>
                )}
                {serverError && <Alert severity="error">{serverError}</Alert>}

                <TextField
                  label="Nombre"
                  fullWidth
                  error={!!errors.nombre}
                  helperText={errors.nombre?.message}
                  {...register('nombre')}
                />

                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      label="Email"
                      type="email"
                      fullWidth
                      error={!!errors.email}
                      helperText={errors.email?.message}
                      {...register('email')}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      label="Teléfono (opcional)"
                      type="tel"
                      fullWidth
                      error={!!errors.telefono}
                      helperText={errors.telefono?.message}
                      {...register('telefono')}
                    />
                  </Grid>
                </Grid>

                <TextField
                  label="Asunto"
                  fullWidth
                  error={!!errors.asunto}
                  helperText={errors.asunto?.message}
                  {...register('asunto')}
                />

                <TextField
                  label="Mensaje"
                  multiline
                  rows={5}
                  fullWidth
                  error={!!errors.mensaje}
                  helperText={errors.mensaje?.message}
                  {...register('mensaje')}
                />

                {/* Ni el nombre ni la etiqueta son de los que autocompletan el navegador o
                    los gestores de contraseñas (web, url, nombre…), y los data-* les piden
                    expresamente que lo ignoren: si lo rellenaran por una persona, su
                    mensaje se descartaría como si fuera de un robot. */}
                <Box aria-hidden="true" sx={trampaOculta}>
                  <label htmlFor="contacto-comentario-adicional">Deja este campo vacío</label>
                  <input
                    id="contacto-comentario-adicional"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore="true"
                    data-bwignore="true"
                    data-form-type="other"
                    {...register('comentarioAdicional')}
                  />
                </Box>

                <AppButton type="submit" disabled={isSubmitting}>
                  Enviar mensaje
                </AppButton>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <GlassCard sx={{ p: 4, height: '100%' }}>
                <Typography variant="h4" component="h2" sx={{ mb: 4 }}>
                  Datos de contacto
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {contactDetails.map((item) => (
                    <Box key={item.label} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      {item.icon}
                      <Box>
                        <Typography variant="overline" sx={{ display: 'block', lineHeight: 1.2 }}>
                          {item.label}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {item.value}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </GlassCard>
            </Grid>
          </Grid>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
