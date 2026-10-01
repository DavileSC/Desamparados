import { Typography } from '@mui/material'
import MarcoPaginaLegal from './MarcoPaginaLegal'
import DatosDeIdentificacion from './DatosDeIdentificacion'
import { emailDerechos } from '../../config/site'
import { deLaCorporacion, laCorporacion } from '../../domain/articulos'

export default function PoliticaDePrivacidadPage() {
  return (
    <MarcoPaginaLegal
      title="Política de Privacidad"
      descripcion={`Qué datos personales trata ${laCorporacion()} Nuestra Señora de los Desamparados, con qué finalidad y cómo ejercer los derechos de acceso, rectificación y supresión.`}
    >
      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 0 }}>
        1. Responsable del tratamiento
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        El responsable del tratamiento de los datos personales recogidos a través de este sitio web es:
      </Typography>

      <DatosDeIdentificacion />

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
        ejecución de la relación contractual o de membresía con {laCorporacion()}.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        4. Derechos
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        El interesado tiene derecho a acceder, rectificar, suprimir, oponerse, limitar el tratamiento y
        solicitar la portabilidad de sus datos dirigiéndose por escrito a la dirección {deLaCorporacion()}.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        5. Conservación y destinatarios
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        Los datos se conservarán mientras exista la relación con {laCorporacion()} y, posteriormente, durante los
        plazos legales aplicables. Podrán acceder a ellos proveedores necesarios para el funcionamiento del
        sitio, bajo las garantías exigidas por la normativa. No se venden datos personales.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        6. Cómo ejercer los derechos
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        El área privada permite solicitar la exportación de los datos y el cierre de la cuenta. También puede
        solicitarse acceso, rectificación, supresión, oposición, limitación o portabilidad escribiendo a{' '}
        {emailDerechos}, acreditando la identidad del solicitante. Si procede, puede reclamarse ante la
        Agencia Española de Protección de Datos (www.aepd.es).
      </Typography>
    </MarcoPaginaLegal>
  )
}
