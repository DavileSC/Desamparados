import { Box, Link as EnlaceMui } from '@mui/material'
import MarcoPaginaLegal from './MarcoPaginaLegal'
import { Apartado, EnlaceFuera, P, Tabla } from './piezas'
import { useModulos } from '../../hooks/useModulos'
import { useConsentimientoDeCookies } from '../../hooks/useConsentimientoDeCookies'

const PROPIA = 'Esta web'

/**
 * Qué guarda la web en el navegador, para qué y cuánto dura, en una tabla como
 * pide la guía de la AEPD. Si algo cambia (una cookie nueva, otra duración),
 * se cambia aquí: los nombres son los de `utils/cookies.ts` de la API y las
 * claves de almacenamiento de la web. Lo de un módulo apagado no sale.
 */
export default function PoliticaDeCookiesPage() {
  const { activo } = useModulos()
  const { decision, volverAPreguntar } = useConsentimientoDeCookies()

  const filas = [
    ['desamparados-cookies-consent', 'Almacenamiento local', 'Recordar si se aceptaron o se rechazaron los contenidos de terceros.', 'Hasta que se cambie la decisión o se borren los datos del navegador.', PROPIA],
    ...(activo('tienda-web') ? [['tienda-cesta', 'Almacenamiento local', 'Guardar la cesta de la tienda entre visitas, hasta pagarla.', 'Hasta que se pague, se vacíe o se borren los datos del navegador.', PROPIA]] : []),
    ['desamparados:porPagina', 'Almacenamiento de sesión', 'Recordar cuántos elementos se ven por página en los listados.', 'Hasta cerrar la pestaña.', PROPIA],
    ...(activo('area-hermanos') ? [['desamparados_hermano', 'Cookie técnica', 'Mantener abierta la sesión del área de hermanos.', '4 horas (72 horas si se marca «Recordarme»).', PROPIA]] : []),
    ['desamparados_cms', 'Cookie técnica', 'Mantener abierta la sesión del personal en el gestor de la web.', 'Hasta cerrar el navegador (72 horas si se marca «Recordarme»).', PROPIA],
    ['desamparados_2fa', 'Cookie técnica', 'Completar la verificación en dos pasos al entrar en el gestor.', '5 minutos.', PROPIA],
    ['cms-tema, cms-menu-grupo, cms.inicio.pestana', 'Almacenamiento local', 'Solo del personal: el tema claro u oscuro y el menú del gestor.', 'Hasta que se borren los datos del navegador.', PROPIA],
  ]

  return (
    <MarcoPaginaLegal
      title="Política de Cookies"
      descripcion="Qué cookies y almacenamiento local usa esta web, para qué sirven y cómo cambiar la decisión sobre ellas en cualquier momento."
    >
      <Apartado titulo="1. Qué son" primero>
        <P>
          Las cookies son pequeños archivos que una web guarda en el navegador para recordar algo entre una página y otra,
          como que se ha iniciado sesión. El almacenamiento local y el de sesión hacen lo mismo de otra forma, y por eso se
          explican aquí también.
        </P>
      </Apartado>

      <Apartado titulo="2. Las que usa esta web">
        <P>
          Esta web no usa cookies de publicidad ni de analítica, ni rastrea a quien la visita. Todo lo que guarda es técnico:
          sin ello no funcionarían la sesión, la cesta o la propia decisión sobre las cookies. Por eso no necesita
          consentimiento (art. 22.2 de la LSSI).
        </P>
        <Tabla columnas={['Nombre', 'Tipo', 'Para qué', 'Duración', 'De quién']} filas={filas} />
      </Apartado>

      <Apartado titulo="3. Contenidos de terceros">
        <P>
          Algunos contenidos vienen de otros servicios, que pueden poner sus propias cookies y recibir la dirección IP de quien
          visita la web. Por eso no se cargan sin permiso:
        </P>
        <Tabla
          columnas={['Servicio', 'Para qué', 'Cuándo se carga', 'Más información']}
          filas={[
            ['Google Maps', 'Mostrar el mapa de la iglesia en el pie y en algunas páginas.', 'Si se aceptan las cookies, en toda la web. Si se rechazan, solo en el mapa en que se pulse «Mostrar mapa», y solo esa vez.', <EnlaceFuera key="g" a="https://policies.google.com/technologies/cookies?hl=es">Política de Google</EnlaceFuera>],
            ['YouTube', 'Reproducir los vídeos publicados allí.', 'Solo al pulsar el botón de reproducir, y en su modo sin cookies de seguimiento (youtube-nocookie.com).', <EnlaceFuera key="y" a="https://policies.google.com/technologies/cookies?hl=es">Política de Google</EnlaceFuera>],
            ['Vimeo', 'Reproducir los vídeos publicados allí.', 'Solo al pulsar el botón de reproducir.', <EnlaceFuera key="v" a="https://vimeo.com/cookie_policy">Política de Vimeo</EnlaceFuera>],
          ]}
        />
        {activo('pago-en-linea') && (
          <P>
            Al pagar en línea se pasa a la página de la entidad bancaria (Redsys), que tiene sus propias condiciones. Esta web no
            pone allí ninguna cookie.
          </P>
        )}
      </Apartado>

      <Apartado titulo="4. Cómo cambiar la decisión">
        <P>
          Al entrar por primera vez, la web pregunta si se aceptan los contenidos de terceros; «Aceptar» y «Rechazar» valen
          lo mismo y la web funciona igual con cualquiera de los dos. La decisión se puede cambiar cuando se quiera desde
          «Gestionar cookies», al pie de cada página, o desde aquí:
        </P>
        <Box sx={{ mb: 2 }}>
          {decision === null ? 'Ahora mismo no hay ninguna decisión guardada.' : `Ahora mismo están ${decision === 'accepted' ? 'aceptadas' : 'rechazadas'}. `}
          {decision !== null && (
            <EnlaceMui component="button" type="button" onClick={volverAPreguntar} sx={{ font: 'inherit', color: 'secondary.main', verticalAlign: 'baseline' }}>
              Volver a decidir
            </EnlaceMui>
          )}
        </Box>
        <P>
          También pueden borrarse o bloquearse desde la configuración del navegador; si se bloquean las técnicas, no se podrá
          iniciar sesión ni guardar la cesta.
        </P>
      </Apartado>
    </MarcoPaginaLegal>
  )
}
