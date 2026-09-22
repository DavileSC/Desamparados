import { Typography } from '@mui/material'
import MarcoPaginaLegal from './MarcoPaginaLegal'

export default function PoliticaDeCookiesPage() {
  return (
    <MarcoPaginaLegal
      title="Política de Cookies"
      descripcion="Qué cookies y almacenamiento local usa esta web, para qué sirven y cómo cambiar la decisión sobre ellas en cualquier momento."
    >
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
         Este sitio utiliza cookies técnicas y almacenamiento local necesario para gestionar la sesión y las
         preferencias de consentimiento. El mapa de Google Maps no se carga hasta que el usuario lo solicita;
         al cargarlo, Google puede tratar la dirección IP y otros datos técnicos.
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
        Las cookies no esenciales y los contenidos de terceros se activan únicamente cuando el usuario los
        acepta expresamente. La decisión puede modificarse en cualquier momento desde «Gestionar cookies».
      </Typography>
    </MarcoPaginaLegal>
  )
}
