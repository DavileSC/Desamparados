import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

/**
 * jsdom no implementa IntersectionObserver, y `SeccionAnimada` (framer-motion,
 * `whileInView`) lo necesita: sin él, montar cualquier página pública revienta
 * con un ReferenceError antes de llegar a la primera aserción.
 *
 * Se asigna directamente al global, no con `vi.stubGlobal`: varios tests llaman
 * a `vi.unstubAllGlobals()` en su afterEach y se lo llevarían por delante.
 */
class IntersectionObserverStub {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: readonly number[] = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return [] }
}

globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver

/**
 * jsdom no calcula posiciones: no tiene `Range.getClientRects` ni
 * `document.elementFromPoint`. ProseMirror (el motor del editor de texto del
 * CMS) los usa para saber dónde está el cursor, y sin ellos escribir en el
 * editor revienta con «target.getClientRects is not a function» antes de que el
 * test llegue a comprobar nada.
 *
 * Devuelven una caja vacía a propósito: no hay maquetación real que medir, y lo
 * que los tests comprueban es el HTML que sale, no dónde cae el cursor.
 */
const cajaVacia = () => ({ top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} })

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = function () {
    return Object.assign([], { item: () => null }) as unknown as DOMRectList
  }
  Range.prototype.getBoundingClientRect = cajaVacia as unknown as () => DOMRect
}

if (!document.elementFromPoint) {
  document.elementFromPoint = () => document.body
}

/**
 * jsdom tampoco trae `ResizeObserver` ni `matchMedia`, y los usan la galería
 * (elige escritorio o móvil por el ancho, y el visor mira la orientación) y el
 * marco de las vistas previas del CMS: sin ellos, montarlos revienta con
 * «undefined is not a function» antes de pintar nada.
 *
 * Igual que con el IntersectionObserver de arriba, van directos al global y no
 * por `vi.stubGlobal`: varios tests llaman a `vi.unstubAllGlobals()`.
 */
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

globalThis.matchMedia ??= ((consulta: string) => ({
  matches: false,
  media: consulta,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia

/**
 * Las fichas del CMS guardan en sessionStorage lo que se queda sin guardar
 * (`useFichaCms`), y jsdom comparte ese almacenamiento entre las pruebas de un
 * mismo fichero: el borrador que deja una aparecía como «Quedaron cambios sin
 * guardar» al abrir la ficha en la siguiente y le tapaba la pantalla.
 */
afterEach(() => {
  try { sessionStorage.clear() } catch { /* sin almacenamiento, nada que limpiar */ }
})
