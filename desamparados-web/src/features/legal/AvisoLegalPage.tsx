import { Link, Typography } from '@mui/material'
import MarcoPaginaLegal from './MarcoPaginaLegal'
import DatosDeIdentificacion from './DatosDeIdentificacion'
import { site } from '../../config/site'
import { deLaCorporacion, laCorporacion, mayuscula, segunLaCorporacion } from '../../domain/articulos'

export default function AvisoLegalPage() {
  return (
    <MarcoPaginaLegal
      title="Aviso Legal"
      descripcion={`Datos identificativos ${deLaCorporacion()} de ${site.titular} de ${site.entidad.localidad} y condiciones de uso de esta web, conforme a la LSSI-CE.`}
    >
      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 0 }}>
        1. Datos identificativos
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        En cumplimiento del artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de
        la Información y del Comercio Electrónico, se informa de los datos identificativos del titular de
        este sitio web:
      </Typography>

      <DatosDeIdentificacion />

      {site.documentos.estatutos && (
        <Typography component="p" sx={{ mb: 2 }}>
          {mayuscula(laCorporacion())} {segunLaCorporacion('se rige', 'se rigen')} por las{' '}
          <Link href={site.documentos.estatutos} target="_blank" rel="noopener noreferrer" sx={{ color: 'secondary.main' }}>
            normas diocesanas de los Grupos Parroquiales
          </Link>
          .
        </Typography>
      )}

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        2. Objeto
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        El presente sitio web tiene por objeto facilitar información sobre {laCorporacion()}, sus actividades,
        cultos, publicaciones y servicios a los hermanos y devotos.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        3. Propiedad intelectual
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        Todos los contenidos de este sitio web, incluyendo textos, fotografías, gráficos, logotipos y
        cualquier otro elemento, son propiedad {deLaCorporacion()} o de terceros que han autorizado su
        uso. Queda prohibida su reproducción total o parcial sin autorización expresa.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        4. Responsabilidad
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        El titular no se hace responsable de los daños derivados del uso incorrecto de los contenidos del
        sitio web ni de fallos técnicos ajenos a su control.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        5. Contacto y cumplimiento
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        Para consultas sobre este sitio o sobre el tratamiento de datos puede utilizarse el canal de contacto
        oficial indicado por {laCorporacion()}. Este aviso debe ser revisado y completado por el responsable legal
        antes de su puesta en producción.
      </Typography>
    </MarcoPaginaLegal>
  )
}
