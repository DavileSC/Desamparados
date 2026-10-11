import { useQuery } from '@tanstack/react-query'
import { CLAVE_CORPORACION, datosDeContacto, type DatosDeContacto } from '../lib/api/corporacion'

/**
 * Secretaría, la sede, las redes y el correo de los derechos, pedidos una vez
 * y compartidos por toda la web. Mientras llegan es `null`: quien los pinta
 * deja su hueco vacío antes que inventar un dato. Se piden al arrancar
 * (`App.tsx`), así que casi siempre están ya cuando se abre el pie o un texto
 * legal. Las pruebas los siembran en el QueryClient (`test/queryClient.ts`).
 */
export function useContacto(): DatosDeContacto | null {
  const { data } = useQuery({ queryKey: CLAVE_CORPORACION, queryFn: datosDeContacto, staleTime: 10 * 60_000 })
  return data ?? null
}

/** Lo que se busca en Google Maps para llegar: la sede con su calle y su localidad. */
const busquedaDe = ({ sede }: DatosDeContacto) => [sede.nombre, sede.calle, sede.localidad].filter(Boolean).join(', ')

/** Abre Google Maps en otra pestaña con la sede buscada. */
export const comoLlegar = (c: DatosDeContacto) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(busquedaDe(c))}`

/** El mapa del pie: la misma búsqueda, incrustada (sin clave de la API de Google). */
export const mapaDeLaSede = (c: DatosDeContacto) => `https://www.google.com/maps?q=${encodeURIComponent(busquedaDe(c))}&output=embed`

/** Canal para ejercer los derechos del RGPD: el suyo, o el de Secretaría. */
export const emailDerechos = (c: DatosDeContacto) => c.privacidad.emailDerechos ?? c.secretaria.email ?? ''
