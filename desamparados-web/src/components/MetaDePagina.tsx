import { Helmet } from 'react-helmet-async'

/**
 * El título y la descripción de una página, en un solo sitio.
 *
 * Existe porque iban por separado y se notaba: 38 pantallas ponían `<title>` y
 * solo 4 ponían descripción, así que en casi toda la web pública Google y los
 * buscadores enseñaban la frase de `index.html` —la misma para todas— en vez de
 * lo que la página cuenta.
 *
 * Emite además `og:title` y `og:description`, que es lo que se lee al pegar un
 * enlace en WhatsApp o en redes. El resto de Open Graph (la URL canónica, la
 * imagen, el nombre del sitio) lo pone `RootLayout` una vez para todas.
 *
 * El `<title>` lleva siempre el sufijo del sitio salvo en la portada, que ya se
 * llama por él.
 */
export default function MetaDePagina({ titulo, descripcion, conSufijo = true }: {
  titulo: string
  /** Una o dos frases sobre lo que hay en la página. Sin ella se hereda la de `index.html`. */
  descripcion?: string
  conSufijo?: boolean
}) {
  const completo = conSufijo ? `${titulo} | Desamparados` : titulo
  return (
    <Helmet>
      <title>{completo}</title>
      <meta property="og:title" content={completo} />
      {descripcion ? <meta name="description" content={descripcion} /> : <></>}
      {descripcion ? <meta property="og:description" content={descripcion} /> : <></>}
    </Helmet>
  )
}
