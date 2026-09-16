import '@testing-library/jest-dom/vitest'

/**
 * jsdom no implementa IntersectionObserver, y `AnimatedSection` (framer-motion,
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
 * jsdom tampoco trae `ResizeObserver` ni `matchMedia`, y Embla (el carrusel de
 * la galería de la Sagrada Titular) los consulta al montarse: sin ellos, montar
 * la galería revienta con «undefined is not a function» antes de pintar nada.
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
