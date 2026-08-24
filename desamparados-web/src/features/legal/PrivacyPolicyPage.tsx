import { Typography } from '@mui/material'
import LegalPageLayout from './LegalPageLayout'

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Política de Privacidad">
      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 0 }}>
        1. Responsable del tratamiento
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        El responsable del tratamiento de los datos personales recogidos a través de este sitio web es el
        Grupo Parroquial de Nuestra Señora de los Desamparados.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        2. Finalidad del tratamiento
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        Los datos personales se tratan con la finalidad de gestionar la relación con los hermanos,
        atender consultas, enviar información institucional y gestionar la participación en actos y
        procesiones.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        3. Legitimación
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        La base jurídica para el tratamiento de los datos es el consentimiento del interesado y la
        ejecución de la relación contractual o de membresía con la Hermandad.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        4. Derechos
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        El interesado tiene derecho a acceder, rectificar, suprimir, oponerse, limitar el tratamiento y
        solicitar la portabilidad de sus datos dirigiéndose por escrito a la dirección de la Hermandad.
      </Typography>
    </LegalPageLayout>
  )
}
