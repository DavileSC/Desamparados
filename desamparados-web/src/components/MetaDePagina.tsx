import { Helmet } from 'react-helmet-async'
import { site } from '../config/site'
import { useSinCanonico } from '../lib/canonico'

/**
 * El título y la descripción de una página, en un solo sitio.
 *
 * Existe porque iban por separado y se notaba: 38 pantallas ponían `<title>` y
 * solo 4 ponían descripción, así que en casi toda la web pública Google y los
 * buscadores enseñaban la frase de `index.html` —la misma para todas— en vez de
 * lo que la página cuenta.
 *
 * Emite además `og:title` y `og:description`, que es lo que se lee al pegar un
 * enlace en WhatsApp o en redes. El resto de Open Graph (el nombre del sitio,
 * el tipo, la imagen) es el mismo para todas y viaja en `index.html`; la URL
 * canónica la pone `RootLayout`.
 *
 * La descripción va siempre, aunque la página no traiga la suya: las de
 * `index.html` se quitan al arrancar (lib/metaEstaticas.ts) para no salir
 * repetidas, así que heredar ya no es posible.
 *
 * El `<title>` lleva siempre el sufijo del sitio salvo en la portada, que ya se
 * llama por él.
 */
export default function MetaDePagina({ titulo, descripcion, conSufijo = true, sinIndexar = false }: {
  titulo: string
  /** Una o dos frases sobre lo que hay en la página. Sin ella, la general del sitio. */
  descripcion?: string
  conSufijo?: boolean
  /** Para las páginas de un solo visitante (un pedido, un recibo) o que no existen: no pintan nada en un buscador, y van sin canonical. */
  sinIndexar?: boolean
}) {
  useSinCanonico(sinIndexar)
  const completo = conSufijo ? `${titulo} | ${site.nombreCorto}` : titulo
  // Una cadena vacía (el subtítulo en blanco de una página del CMS) también cae
  // a la general: una descripción vacía le dice al buscador que no la hay.
  const frase = descripcion?.trim() || site.descripcion
  return (
    <Helmet>
      <title>{completo}</title>
      <meta property="og:title" content={completo} />
      <meta name="description" content={frase} />
      <meta property="og:description" content={frase} />
      {sinIndexar ? <meta name="robots" content="noindex" /> : <></>}
    </Helmet>
  )
}
