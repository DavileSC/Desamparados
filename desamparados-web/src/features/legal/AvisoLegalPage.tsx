import { Link, Typography } from '@mui/material'
import MarcoPaginaLegal from './MarcoPaginaLegal'
import DatosDeIdentificacion from './DatosDeIdentificacion'
import { Enlace } from './piezas'
import { useModulos } from '../../hooks/useModulos'
import { site } from '../../config/site'
import { useContacto } from '../../hooks/useContacto'
import { deLaCorporacion, laCorporacion, mayuscula, segunLaCorporacion } from '../../domain/articulos'

export default function AvisoLegalPage() {
  // Mientras llegan, vacíos: los pide App.tsx al arrancar y casi siempre ya están.
  const secretaria = useContacto()?.secretaria
  const tienda = useModulos().activo('tienda-web')
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

      {site.normas && (
        <Typography component="p" sx={{ mb: 2 }}>
          {mayuscula(laCorporacion())} {segunLaCorporacion('se rige', 'se rigen')} por{' '}
          <Link href={site.normas.url} target="_blank" rel="noopener noreferrer" sx={{ color: 'secondary.main' }}>
            {site.normas.titulo}
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
        3. Condiciones de uso
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        Quien usa esta web se compromete a hacerlo conforme a la ley y a este aviso: a no usarla para fines ilícitos o que
        perjudiquen a {laCorporacion()} o a terceros, a no intentar entrar en cuentas o zonas que no sean suyas, a no
        introducir virus ni nada que dañe la web o a sus usuarios, y a no enviar por sus formularios contenidos ofensivos,
        discriminatorios o falsos. Quien tenga cuenta debe guardar su contraseña y avisar si cree que otro la conoce.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        4. Propiedad intelectual
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        Todos los contenidos de este sitio web, incluyendo textos, fotografías, gráficos, logotipos y
        cualquier otro elemento, son propiedad {deLaCorporacion()} o de terceros que han autorizado su
        uso. Se pueden ver, imprimir y guardar para uso personal; queda prohibida su reproducción, distribución o
        comunicación pública, total o parcial, sin autorización expresa.
      </Typography>
      {/* Voluntario: la ley solo pide avisar de las imágenes generadas, que ya llevan su pie. Es por transparencia. */}
      <Typography component="p" sx={{ mb: 2 }}>
        En el desarrollo de esta web y en la redacción de algunos textos se han usado herramientas de inteligencia
        artificial, siempre con revisión humana. Las imágenes generadas con ellas lo indican debajo.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        5. Responsabilidad
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        El titular no se hace responsable de los daños derivados del uso incorrecto de los contenidos del
        sitio web ni de fallos técnicos ajenos a su control.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        6. Enlaces a otras webs
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        Esta web enlaza a otras (redes sociales, mapas, vídeos, la pasarela de pago del banco…) y muestra algunos de sus
        contenidos. {mayuscula(laCorporacion())} no {segunLaCorporacion('controla', 'controlan')} esas webs ni{' '}
        {segunLaCorporacion('responde', 'responden')} de lo que publican, y enlazarlas no supone ninguna relación con ellas.
        Si se tiene noticia de que alguna enlazada tiene contenidos ilícitos, se retirará el enlace.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        7. Protección de datos, cookies y compras
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        Cómo se tratan los datos personales se explica en la <Enlace a="/politica-privacidad">Política de privacidad</Enlace>,
        y lo que la web guarda en el navegador, en la <Enlace a="/politica-cookies">Política de cookies</Enlace>.
        {tienda && <> Las compras en la tienda se rigen por las <Enlace a="/condiciones-de-compra">Condiciones de compra</Enlace>.</>}
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        8. Contacto
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        Para cualquier consulta sobre esta web puede escribirse a {secretaria?.email}
        {secretaria?.telefono ? ` o llamarse al ${secretaria.telefono}` : ''}.
      </Typography>

      <Typography variant="h5" component="h2" sx={{ color: 'text.primary', mb: 2, mt: 4 }}>
        9. Legislación aplicable
      </Typography>
      <Typography component="p" sx={{ mb: 2 }}>
        Este aviso y el uso de la web se rigen por la legislación española.
      </Typography>
    </MarcoPaginaLegal>
  )
}
