import { Typography } from '@mui/material'
import LegalPageLayout from './LegalPageLayout'

export default function CookiesPolicyPage() {
  return (
    <LegalPageLayout title="Política de Cookies">
      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 0 }}>
        1. ¿Qué son las cookies?
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        Las cookies son pequeños archivos de texto que se almacenan en el dispositivo del usuario cuando
        visita un sitio web. Su finalidad es recordar preferencias y mejorar la experiencia de navegación.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        2. Cookies utilizadas
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        Este sitio web utiliza únicamente cookies técnicas y necesarias para su funcionamiento, como la
        gestión de la sesión de usuario en el área privada de hermanos. No se utilizan cookies de
        publicidad ni de analítica de terceros.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        3. Gestión de cookies
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        El usuario puede configurar su navegador para rechazar las cookies, aunque esto podría afectar al
        correcto funcionamiento de algunas funcionalidades, como el acceso al área privada.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        4. Consentimiento
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        Al continuar navegando por este sitio web, el usuario acepta el uso de las cookies indicadas. En
        cualquier momento podrá modificar su consentimiento desde el banner de cookies.
      </Typography>
    </LegalPageLayout>
  )
}
