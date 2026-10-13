import { useEffect, useMemo } from 'react'
import { site } from '../config/site'
import { useContacto } from '../hooks/useContacto'
import type { DatosDeContacto } from '../lib/api/corporacion'
import { telefonoInternacional } from '../lib/validacion/identidad'

/**
 * Quién es la corporación en el formato de los buscadores (schema.org), con lo
 * que se cambia en el CMS: el correo, el teléfono, la sede y los perfiles.
 * index.html ya lleva lo fijo (nombre, denominación, web) sin esperar a
 * JavaScript; esto lo completa en la portada, que Google también lee
 * ejecutándola. Escrito en index.html, al cambiar el teléfono en el CMS se
 * habría quedado el viejo hasta el siguiente despliegue.
 *
 * Un dato pendiente (`null`) no se escribe: un dato inventado lo publicaría
 * Google como bueno, y anunciarle un perfil que no existe es peor que no
 * anunciarlo. No lleva `taxID`: el Grupo Parroquial no quiere publicar su NIF.
 *
 * No va por Helmet: esta versión de `react-helmet-async` descarta los
 * `<script>` (ver `FichaDeNoticia`), así que se pone a mano y se retira al
 * salir de la portada.
 */
export default function DatosEstructurados() {
  const contacto = useContacto()
  const datos = useMemo(() => (contacto ? JSON.stringify(datosDe(contacto)) : null), [contacto])

  useEffect(() => {
    if (!datos) return
    const guion = document.createElement('script')
    guion.type = 'application/ld+json'
    guion.textContent = datos
    document.head.appendChild(guion)
    return () => { guion.remove() }
  }, [datos])

  return null
}

function datosDe({ secretaria, sede, redes }: DatosDeContacto) {
  const perfiles = Object.values(redes).filter((u): u is string => u !== null)
  return {
    '@context': 'https://schema.org',
    '@type': 'ReligiousOrganization',
    name: site.nombre,
    ...(site.entidad.denominacion && { legalName: site.entidad.denominacion }),
    url: `${site.url}/`,
    ...(secretaria.email && { email: secretaria.email }),
    ...(secretaria.telefono && { telephone: telefonoInternacional(secretaria.telefono) }),
    // La de compartir de la marca (o su icono grande), la misma que el
    // og:image y el JSON-LD de index.html.
    image: `${site.url}${site.imagenes.compartir}`,
    ...(perfiles.length > 0 && { sameAs: perfiles }),
    // Dónde está la sede: el dato que busca quien quiere venir.
    ...(sede.nombre && {
      location: {
        '@type': 'Place',
        name: sede.nombre,
        address: {
          '@type': 'PostalAddress',
          ...(sede.calle && { streetAddress: sede.calle }),
          ...(sede.codigoPostal && { postalCode: sede.codigoPostal }),
          ...(sede.localidad && { addressLocality: sede.localidad }),
          addressCountry: 'ES',
        },
      },
    }),
  }
}
