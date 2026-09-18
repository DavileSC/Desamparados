import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Box, Grid, TextField, Typography } from '@mui/material'
import EmailIcon from '@mui/icons-material/Email'
import PhoneIcon from '@mui/icons-material/Phone'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import GlassCard from '../GlassCard'
import AppButton from '../AppButton'
import { contactSchema, type ContactFormData } from '../../features/contact/schema'
import { sendContactMessage } from '../../lib/api/contact'
import type { BloqueContacto as Datos, LineaDatos } from '../../lib/api/contenido'

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
 * El icono de cada línea de la tarjeta, deducido de lo que dice.
 *
 * Las líneas se escriben en el CMS y no llevan icono propio: elegirlo sería un
 * campo más que rellenar, para algo que se adivina solo. Un correo tiene
 * arroba, un teléfono son cifras, y la dirección y el horario se reconocen por
 * cómo se llaman. Lo que no encaja lleva un icono neutro.
 */
function iconoDe({ etiqueta, valor }: LineaDatos) {
  const color = { color: 'secondary.main' }
  if (valor.includes('@')) return <EmailIcon sx={color} />
  if (/^[+\d][\d\s().-]{6,}$/.test(valor.trim())) return <PhoneIcon sx={color} />
  if (/horario|hora/i.test(etiqueta)) return <AccessTimeIcon sx={color} />
  if (/direcci|sede|lugar|dónde|donde/i.test(etiqueta)) return <LocationOnIcon sx={color} />
  return <InfoOutlinedIcon sx={color} />
}

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

/**
 * El formulario de contacto y, a su lado, la tarjeta con las formas de llegar
 * al Grupo Parroquial.
 *
 * Era la página de Contacto entera, escrita a mano. El formulario sigue siendo
 * de código —lo que llega se envía por correo y sus comprobaciones y su trampa
 * para robots no son algo que convenga poder tocar desde el CMS—; lo editable
 * es la tarjeta: su título y sus líneas. Sin líneas, la tarjeta no se pinta y
 * el formulario ocupa todo el ancho.
 */
export default function BloqueContacto({ bloque }: { bloque: Datos }) {
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const tiempoRelleno = useTiempoRelleno()
  const conTarjeta = bloque.lineas.length > 0

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
    <Grid container spacing={6}>
      <Grid size={{ xs: 12, md: conTarjeta ? 7 : 12 }}>
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

      {conTarjeta && (
        <Grid size={{ xs: 12, md: 5 }}>
          <GlassCard sx={{ p: 4, height: '100%' }}>
            {bloque.tituloDatos && (
              <Typography variant="h4" component="h2" sx={{ mb: 4 }}>
                {bloque.tituloDatos}
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {bloque.lineas.map((linea, indice) => (
                <Box key={`${linea.etiqueta}-${indice}`} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  {iconoDe(linea)}
                  <Box>
                    <Typography variant="overline" sx={{ display: 'block', lineHeight: 1.2 }}>
                      {linea.etiqueta}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {linea.valor}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </GlassCard>
        </Grid>
      )}
    </Grid>
  )
}
