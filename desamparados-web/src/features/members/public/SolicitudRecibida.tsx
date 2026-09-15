import { useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import AppButton from '../../../components/AppButton'
import { site } from '../../../config/site'
import { SERIF } from '../../home/estilos'
import { FILETE_PAPEL } from './temaPapel'

interface SolicitudRecibidaProps {
  nombre: string
  email: string
}

/**
 * Lo que sustituye al formulario cuando la solicitud ha entrado. Cuenta lo
 * mismo que el correo de acuse de recibo: qué ha pasado y qué toca ahora.
 * Se lleva el foco al título para que quien usa teclado o lector de pantalla
 * sepa que la página ha cambiado y no se quede sobre un botón que ya no está.
 */
export default function SolicitudRecibida({ nombre, email }: SolicitudRecibidaProps) {
  const titulo = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    titulo.current?.focus({ preventScroll: true })
    // jsdom no implementa scrollIntoView; en el navegador siempre existe.
    titulo.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
  }, [])

  return (
    <Box role="status" aria-live="polite">
      <Typography
        ref={titulo}
        component="h2"
        tabIndex={-1}
        sx={{ fontFamily: SERIF, fontSize: { xs: 28, md: 36 }, lineHeight: 1.15, letterSpacing: '-0.01em', outline: 'none', mb: 2 }}
      >
        Gracias, {nombre}. Tu solicitud está en Secretaría.
      </Typography>
      <Typography sx={{ fontSize: 17, lineHeight: 1.65, maxWidth: '58ch', mb: 4 }}>
        Te hemos enviado el acuse de recibo a <strong>{email}</strong>. Si no lo ves en unos minutos,
        mira en la carpeta de correo no deseado.
      </Typography>

      <Box sx={{ borderTop: `1px solid ${FILETE_PAPEL}`, pt: 3.5, mb: 4.5 }}>
        <Typography component="h3" sx={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1.25, mb: 1.5 }}>
          Qué toca ahora
        </Typography>
        <Typography sx={{ fontSize: 16, lineHeight: 1.7, maxWidth: '58ch', color: 'text.secondary' }}>
          Pásate por Secretaría, en la casa parroquial, con tu DNI y el certificado de bautismo
          ({site.contacto.horario.replace(/\.$/, '').toLowerCase()}). Allí formalizan el alta y
          activan tu acceso al área de hermanos con el email y la contraseña que acabas de elegir.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <AppButton component={Link} to="/" sx={{ borderRadius: '3px' }}>
          Volver a la portada
        </AppButton>
        <AppButton
          component={Link}
          to="/contacto"
          appVariant="outline"
          sx={{ borderRadius: '3px', color: 'text.primary', borderColor: '#cfc6b9', '&:hover': { color: 'primary.main', borderColor: 'primary.main', backgroundColor: 'transparent' } }}
        >
          Escribir a Secretaría
        </AppButton>
      </Box>
    </Box>
  )
}
