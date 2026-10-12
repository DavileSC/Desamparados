import { QueryClient } from '@tanstack/react-query'
import { CLAVES_DE_INSTALACION, CLAVES_MODULO } from '../domain/modulos'
import { CLAVE_MODULOS } from '../lib/api/modulos'
import { CLAVE_CORPORACION } from '../lib/api/corporacion'
import { DATOS } from './instalacion'

const MODULOS_DEL_EJEMPLO: readonly string[] = [
  ...CLAVES_MODULO,
  ...DATOS.modulos.activos.filter((c) => (CLAVES_DE_INSTALACION as readonly string[]).includes(c)),
]

/** Todos los módulos y además las páginas propias, para las pruebas que pasan por ellas. */
export const TODOS_CON_PAGINAS_PROPIAS: readonly string[] = [...CLAVES_MODULO, 'paginas-propias']

/**
 * Un `QueryClient` de pruebas con los módulos ya en caché, para
 * `AllTheProviders` y para cualquier prueba que necesite su propio
 * `QueryClientProvider` sin pasar por `renderWithProviders` (como
 * `AccesoPage.test.tsx`, que monta su propio `RouterProvider`).
 *
 * Un cliente nuevo por llamada: si se compartiera, la caché de una prueba
 * contaminaría a la siguiente. Sin reintentos, o los fallos tardan segundos.
 *
 * `setQueryData` crea la consulta con el `gcTime: 0` de arriba: si nadie se
 * suscribe en ese mismo tick (un componente que lee `useModulos()` tras un
 * await, como un fetch simulado o un lazy), React Query la recolecta y
 * `getQueryData` vuelve a dar `undefined`. El `gcTime: Infinity` de
 * `useModulos` no evita esto: solo se aplica cuando ya hay un observador.
 * Fijar aquí los valores por defecto de esta clave hace que la propia
 * consulta nazca con ellos, sobreviva sin observadores y no haya ninguna
 * pantalla que acabe pidiendo /modulos al `fetch` simulado del test.
 *
 * Los módulos encendidos, ya en caché: ninguna pantalla tiene que pedirlos
 * (los tests simulan `fetch` para lo suyo y no sabrían responder a
 * /modulos). Sin `modulos`, todo encendido, que es como está esta instalación;
 * los de instalación, los que encienda el ejemplo, que es ninguno: las páginas
 * propias de una corporación no existen en las demás. La prueba que las visite
 * pasa `TODOS_CON_PAGINAS_PROPIAS`.
 */
export function crearQueryClientDePruebas(modulos?: readonly string[]): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  queryClient.setQueryDefaults(CLAVE_MODULOS, { gcTime: Infinity, staleTime: Infinity })
  queryClient.setQueryData(CLAVE_MODULOS, [...(modulos ?? MODULOS_DEL_EJEMPLO)])
  sembrarContacto(queryClient)
  return queryClient
}

/**
 * Secretaría, sede y redes, como las sembraría la API la primera vez: las del
 * fichero de la instalación (en las pruebas, el ejemplo; `DATOS` de
 * test/instalacion.ts). Así ninguna pantalla los pide al `fetch` simulado, que
 * respondería otra cosa (y el pie o los accesos leerían `redes` de ahí). Para
 * las pruebas que montan su propio `QueryClient`, como hace `App.tsx` al
 * arrancar. El `gcTime` por lo mismo que los módulos (arriba).
 */
export function sembrarContacto(queryClient: QueryClient) {
  queryClient.setQueryDefaults(CLAVE_CORPORACION, { gcTime: Infinity, staleTime: Infinity })
  queryClient.setQueryData(CLAVE_CORPORACION, { secretaria: DATOS.secretaria, sede: DATOS.sede, redes: DATOS.redes, privacidad: DATOS.privacidad })
}
