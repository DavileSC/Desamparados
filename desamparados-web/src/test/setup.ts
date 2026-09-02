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
