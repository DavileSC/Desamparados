import MarcoPaginaLegal from './MarcoPaginaLegal'
import DatosDeIdentificacion from './DatosDeIdentificacion'
import { Apartado, Enlace, Lista, P } from './piezas'
import { site } from '../../config/site'
import { deLaCorporacion, laCorporacion, mayuscula, segunLaCorporacion } from '../../domain/articulos'

/**
 * Las condiciones de la tienda en línea: lo que la ley de consumidores pide
 * contar antes de comprar a distancia (quién vende, precio, pago, entrega,
 * desistimiento, garantía y reclamaciones). Se enlaza desde el pie y desde el
 * paso de pago de la cesta. Es una propuesta: la revisa el asesor del Grupo.
 */
export default function CondicionesDeCompraPage() {
  const horario = site.contacto.horario ? `, en su horario (${site.contacto.horario})` : ', en su horario de atención'
  return (
    <MarcoPaginaLegal
      title="Condiciones de compra"
      descripcion={`Cómo se compra en la tienda ${deLaCorporacion()} ${site.titular}: precios, pago, recogida en Secretaría, devoluciones y garantía.`}
    >
      <Apartado titulo="1. Quién vende" primero>
        <P>Los productos de la tienda de esta web los vende:</P>
        <DatosDeIdentificacion />
      </Apartado>

      <Apartado titulo="2. Productos y precios">
        <P>
          Cada producto se describe en su ficha, con sus fotos, su precio y, si las tiene, sus tallas y lo que queda de cada una.
          Los precios están en euros y son el importe final que se paga, con los impuestos que correspondan incluidos. No hay
          gastos de envío porque no se hacen envíos: todo se recoge en Secretaría.
        </P>
      </Apartado>

      <Apartado titulo="3. Cómo se compra">
        <Lista>
          <li>Se añaden los productos a la cesta y, al seguir con el pago, se indican el nombre, el correo y un teléfono. No hace falta crear una cuenta.</li>
          <li>El pago se hace con tarjeta o con Bizum en la pasarela segura de la entidad bancaria (Redsys). Esta web no ve ni guarda los datos de la tarjeta.</li>
          <li>La compra queda hecha cuando el banco confirma el pago. Entonces se envía un correo con el número de pedido y lo comprado.</li>
          <li>Si, mientras se pagaba, un producto se agotó, {laCorporacion()} {segunLaCorporacion('devuelve', 'devuelven')} el importe por el mismo medio de pago.</li>
        </Lista>
      </Apartado>

      <Apartado titulo="4. Recogida">
        <P>
          El pedido se recoge en Secretaría ({site.sede.direccion}, {site.sede.localidad}){horario}, indicando el número de
          pedido o el nombre con que se hizo.
        </P>
      </Apartado>

      <Apartado titulo="5. Derecho de desistimiento">
        <P>
          Quien compra como consumidor puede desistir de la compra, sin dar explicaciones, en los 14 días naturales siguientes
          a la recogida. Basta con comunicarlo por correo a {site.contacto.email} o en Secretaría, y devolver el producto en
          Secretaría, sin usar y en el estado en que se entregó.
        </P>
        <P>
          {mayuscula(laCorporacion())} {segunLaCorporacion('devuelve', 'devuelven')} el importe pagado en los 14 días siguientes
          a la comunicación, por el mismo medio de pago, y {segunLaCorporacion('puede', 'pueden')} esperar a tener el producto
          para hacerlo. Devolver no tiene ningún coste.
        </P>
        <P>
          No se puede desistir de los productos hechos a medida o personalizados a petición de quien compra, como marca la ley.
        </P>
      </Apartado>

      <Apartado titulo="6. Garantía">
        <P>
          Los productos tienen la garantía legal de conformidad de tres años desde la entrega. Si alguno llega defectuoso o no
          es lo que se compró, se repara, se cambia o se devuelve su importe, sin coste para quien compra.
        </P>
      </Apartado>

      <Apartado titulo="7. Dudas y reclamaciones">
        <P>
          Para cualquier duda o reclamación sobre un pedido puede escribirse a {site.contacto.email}
          {site.contacto.telefono ? ` o llamar al ${site.contacto.telefono}` : ''}. Si no se llega a un acuerdo, quien compra
          puede acudir a los servicios de consumo de su comunidad autónoma.
        </P>
      </Apartado>

      <Apartado titulo="8. Datos personales">
        <P>
          Los datos del pedido se usan para gestionarlo, avisar de su recogida y llevar las cuentas. Cómo se tratan y cómo
          ejercer los derechos sobre ellos se explica en la <Enlace a="/politica-privacidad">Política de privacidad</Enlace>.
        </P>
      </Apartado>

      <Apartado titulo="9. Ley aplicable">
        <P>
          Estas condiciones se rigen por la legislación española. Quien compra como consumidor conserva siempre los derechos
          que le reconoce la normativa de consumo y puede reclamar ante los tribunales de su domicilio.
        </P>
      </Apartado>
    </MarcoPaginaLegal>
  )
}
