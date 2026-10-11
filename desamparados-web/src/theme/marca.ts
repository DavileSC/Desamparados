/**
 * Los colores de la marca de esta instalación: el ÚNICO sitio de la web que
 * los conoce. Todo lo que pinta con el color principal (el burdeos, en la
 * marca de partida) o con el de acento (el oro) lo toma de aquí, por papeles:
 * `MARCA.principal` para un relleno con letra blanca, `MARCA.acento` para
 * escribir sobre el fondo oscuro, etc. Qué papel va en cada sitio, y con qué
 * suelo de contraste, lo dice shared/colores-de-marca.d.mts.
 *
 * Se calcula una vez al importarse, con los dos colores de
 * `window.__INSTALACION__` (config/instalacion.ts), que /instalacion.js deja
 * antes de que arranque el bundle: por eso vale como constante de módulo, sin
 * contexto de React. Con la marca a null, o con los colores de partida, cada
 * papel es exactamente el hex de siempre: la web de Desamparados no cambia ni
 * un píxel. Con otros, cada papel conserva el tono del color dado y ajusta la
 * luminosidad hasta cumplir su contraste.
 *
 * Lo que no es de marca (neutros, tintas, cremas, el rojo de error y de gasto,
 * los colores de `dataviz` y los de significado) se queda escrito donde está.
 * La guardiana `src/__tests__/sin-colores-de-marca.test.ts` impide volver a
 * escribir a mano, fuera de aquí, uno de los colores de partida.
 */
import { alfa, componentes, paletaDeImprenta, paletaDeMarca } from '../../../shared/colores-de-marca.mjs'
import { instalacion } from '../config/instalacion'

/** Los papeles de la web (pública, CMS y área de hermanos). */
export const MARCA = paletaDeMarca(instalacion.marca)

/**
 * Los de los PDF y los correos. En la web solo los usa la papeleta en
 * pantalla, que imita a la impresa (features/areaHermano/procesion/papeleta-estilo.ts).
 */
export const IMPRENTA = paletaDeImprenta(instalacion.marca)

/**
 * `alfa(MARCA.acento, 0.4)` → `rgba(r, g, b, 0.4)`, en lugar de los `rgba()`
 * escritos a mano; `componentes(MARCA.principal)` → «r, g, b», para quien
 * compone el `rgba()` él mismo.
 */
export { alfa, componentes }

/**
 * Las variables CSS de la marca, para lo que se pinta desde una hoja .css
 * (features/inicio/home.css), que no puede importar nada: las cuelga en
 * `:root` el `MuiCssBaseline` del tema público.
 */
export const VARIABLES_MARCA = {
  '--marca-principal': MARCA.principal,
  '--marca-acento': MARCA.acento,
} as const
