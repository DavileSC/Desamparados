import MarcoPaginaLegal from './MarcoPaginaLegal'
import DatosDeIdentificacion from './DatosDeIdentificacion'
import { Apartado, Enlace, EnlaceFuera, Lista, P, Subapartado } from './piezas'
import { site } from '../../config/site'
import { emailDerechos, useContacto } from '../../hooks/useContacto'
import { aLaCorporacion, deLaCorporacion, laCorporacion, mayuscula, segunLaCorporacion } from '../../domain/articulos'
import { useModulos } from '../../hooks/useModulos'

/**
 * La política de privacidad: qué datos se tratan, para qué, con qué base, a
 * quién se dan, cuánto se guardan y cómo ejercer los derechos. Los apartados
 * de lo que se puede apagar (tienda, donativos, alta por la web, boletín…)
 * solo salen con su módulo encendido: una instalación sin tienda no habla de
 * pedidos. Es una propuesta: la revisa el asesor del Grupo.
 */
export default function PoliticaDePrivacidadPage() {
  const contacto = useContacto()
  const derechos = contacto ? emailDerechos(contacto) : ''
  const { activo } = useModulos()
  const tienda = activo('tienda-web')
  const donativos = activo('donativos') || activo('apadrinamientos')
  const pagos = tienda || donativos || activo('cuotas-en-linea')

  return (
    <MarcoPaginaLegal
      title="Política de Privacidad"
      descripcion={`Qué datos personales ${segunLaCorporacion('trata', 'tratan')} ${laCorporacion()} de ${site.titular}, con qué finalidad y cómo ejercer los derechos de acceso, rectificación y supresión.`}
    >
      <Apartado titulo="1. Responsable del tratamiento" primero>
        <P>El responsable de los datos personales que se recogen en esta web es:</P>
        <DatosDeIdentificacion />
        <P>Para cualquier cuestión sobre protección de datos puede escribirse a {derechos}.</P>
      </Apartado>

      <Apartado titulo="2. Qué datos se tratan, para qué y con qué base">
        <P>
          En cada formulario se marcan los datos obligatorios: sin ellos no puede atenderse lo que se pide (el alta, el
          pedido, la respuesta). Los demás son voluntarios.
        </P>
        <Subapartado titulo="Hermanos">
          <P>
            De quienes pertenecen {aLaCorporacion()} se tratan los datos de identificación y contacto (nombre, DNI, fecha de
            nacimiento, domicilio, teléfono y correo), los de la cuota (cuenta bancaria para domiciliarla), los del bautismo
            (fecha, parroquia y certificado), la foto, la antigüedad y la participación en cultos y en la salida procesional.
            Sirven para llevar el censo, cobrar las cuotas, organizar los cultos y el cortejo y mantener informados a los
            hermanos.
          </P>
          <P>
            La base es la relación de pertenencia {aLaCorporacion()} (art. 6.1.b del RGPD). Como estos datos muestran la
            pertenencia a una entidad religiosa, se tratan además al amparo del art. 9.2.d del RGPD: solo se refieren a sus
            miembros, actuales o antiguos, y no se comunican fuera {deLaCorporacion()} sin su consentimiento, salvo obligación
            legal.
          </P>
        </Subapartado>

        <Subapartado titulo="Menores">
          <P>
            Los menores se inscriben a través de su padre, madre o tutor, que da los datos y presta el consentimiento por
            ellos cuando tienen menos de 14 años (art. 7 de la LOPDGDD). Quien los inscribe figura en la ficha con su
            parentesco.
          </P>
        </Subapartado>

        <Subapartado titulo="Fotos de cultos y salidas">
          <P>
            {mayuscula(laCorporacion())} {segunLaCorporacion('publica', 'publican')} en esta web y en sus redes sociales fotos y
            vídeos de sus cultos, de la salida procesional y de otros actos. De un hermano solo se publican aquellas en que se le
            reconozca si lo ha autorizado (art. 6.1.a del RGPD); por un menor lo autoriza quien lo inscribe. La autorización
            se da o se retira cuando se quiera{activo('area-hermanos') ? ', desde el área de hermanos' : ''} o escribiendo a{' '}
            {derechos}, y entonces se retiran las fotos ya publicadas que dependan {deLaCorporacion()}.
          </P>
          <P>
            Las imágenes de conjunto de un acto público, en que nadie es el protagonista, se publican sin esa autorización, como
            permite el art. 8.2.a de la Ley Orgánica 1/1982. Quien aparezca en una y no quiera puede pedir que se retire.
          </P>
        </Subapartado>

        {activo('alta-web') && (
          <Subapartado titulo="Solicitudes de alta por la web">
            <P>
              Los datos y documentos que se envían desde «Hazte hermano» se usan para estudiar la solicitud y, si se admite,
              pasan al censo. Si no se admite, se borran.
            </P>
          </Subapartado>
        )}

        {activo('comunicados') && (
          <Subapartado titulo="Boletín y avisos">
            <P>
              El correo de los hermanos se usa para enviarles el boletín y los avisos {deLaCorporacion()}, como parte de la
              relación de pertenencia. Puede pedirse dejar de recibirlos en cualquier momento escribiendo a {derechos}.
            </P>
          </Subapartado>
        )}

        {tienda && (
          <Subapartado titulo="Compras en la tienda">
            <P>
              De quien compra se piden el nombre, el correo y un teléfono, para gestionar el pedido, confirmar el pago y
              avisar de la recogida. La base es el propio contrato de compra (art. 6.1.b del RGPD) y, para llevar las cuentas,
              la obligación legal contable y fiscal (art. 6.1.c). Las condiciones están en{' '}
              <Enlace a="/condiciones-de-compra">Condiciones de compra</Enlace>.
            </P>
          </Subapartado>
        )}

        {donativos && (
          <Subapartado titulo="Donativos y apadrinamientos">
            <P>
              En un donativo, el nombre y el correo son opcionales; en un apadrinamiento se piden nombre, correo y teléfono, y
              el nombre solo se muestra en la web si quien apadrina lo elige. Si se pide el certificado para desgravar, se
              recogen además los datos fiscales (NIF, nombre, apellidos y código postal), que se comunican a la Agencia Tributaria en la declaración
              anual de donativos (modelo 182), como obliga la ley (art. 6.1.c del RGPD).
            </P>
          </Subapartado>
        )}

        <Subapartado titulo="Formulario de contacto">
          <P>
            El nombre, el correo, el teléfono si se da y el mensaje se usan solo para contestar. La base es el consentimiento
            de quien escribe (art. 6.1.a del RGPD).
          </P>
        </Subapartado>

        {activo('area-hermanos') && (
          <Subapartado titulo="Área de hermanos">
            <P>
              Para entrar se usan el correo y una contraseña, que se guarda cifrada.
            </P>
          </Subapartado>
        )}
      </Apartado>

      {pagos && (
        <Apartado titulo="3. Pagos en línea">
          <P>
            Los pagos con tarjeta o Bizum se hacen en la pasarela segura de la entidad bancaria (Redsys). Esta web no ve ni
            guarda los datos de la tarjeta: solo recibe del banco si el pago se ha hecho o no.
          </P>
        </Apartado>
      )}

      <Apartado titulo={`${pagos ? 4 : 3}. A quién se comunican`}>
        <P>Los datos no se venden ni se ceden a nadie para publicidad. Solo acceden a ellos:</P>
        <Lista>
          <li>Las personas {deLaCorporacion()} que los necesitan para su cargo (Secretaría, Tesorería…), cada una solo a lo suyo.</li>
          <li>Los proveedores que hacen funcionar la web, como encargados del tratamiento y con contrato: el alojamiento del servidor y el servicio de envío de correo.</li>
          {pagos && <li>La entidad bancaria, para cobrar los pagos en línea.</li>}
          {donativos && <li>La Agencia Tributaria, con los donativos que deben declararse.</li>}
          <li>Las administraciones o los juzgados, cuando lo exija la ley.</li>
        </Lista>
        <P>
          Si se acepta, el mapa de Google Maps del pie recibe la dirección IP de quien visita la web, como se explica en la{' '}
          <Enlace a="/politica-cookies">Política de cookies</Enlace>. Google puede tratarla en Estados Unidos, bajo el Marco de
          Privacidad de Datos UE-EE. UU.
        </P>
      </Apartado>

      <Apartado titulo={`${pagos ? 5 : 4}. Cuánto tiempo se guardan`}>
        <Lista>
          <li>Los de los hermanos, mientras pertenezcan {aLaCorporacion()}. Tras la baja quedan en el registro histórico del censo; puede pedirse su supresión, salvo lo que la ley obliga a guardar, como los recibos.</li>
          {(tienda || donativos) && <li>Los de pedidos y donativos, el tiempo que obligan las normas contables y fiscales.</li>}
          <li>Los mensajes del formulario de contacto, el tiempo necesario para atenderlos.</li>
          <li>El registro de lo que hace el personal con los datos, dos años.</li>
        </Lista>
      </Apartado>

      <Apartado titulo={`${pagos ? 6 : 5}. Derechos y cómo ejercerlos`}>
        <P>
          Cualquier persona puede pedir el acceso a sus datos, su rectificación o supresión, oponerse a su tratamiento, pedir
          que se limite o que se le entreguen para llevarlos a otro sitio (portabilidad), y retirar el consentimiento que haya
          dado.
        </P>
        <P>
          {activo('area-hermanos') ? 'Desde el área de hermanos se pueden descargar los propios datos y cerrar la cuenta. ' : ''}
          También puede escribirse a {derechos}, acreditando la identidad. {mayuscula(laCorporacion())}{' '}
          {segunLaCorporacion('contesta', 'contestan')} en el plazo de un mes. Si no se está conforme con la respuesta, puede
          reclamarse ante la <EnlaceFuera a="https://www.aepd.es">Agencia Española de Protección de Datos</EnlaceFuera>.
        </P>
      </Apartado>

      <Apartado titulo={`${pagos ? 7 : 6}. Seguridad`}>
        <P>
          La web va siempre cifrada (HTTPS), las contraseñas se guardan cifradas, el personal puede proteger su acceso con
          verificación en dos pasos y cada cargo solo ve lo que necesita.
        </P>
      </Apartado>
    </MarcoPaginaLegal>
  )
}
