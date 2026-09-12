import { describe, it, expect, vi, afterEach } from 'vitest'
import { getPanel } from '../panel'

function espiarFetch() {
  const espia = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
  vi.stubGlobal('fetch', espia)
  return espia
}

afterEach(() => { vi.unstubAllGlobals() })

describe('getPanel', () => {
  it('sin año, pide el panel a secas', async () => {
    const espia = espiarFetch()
    await getPanel()
    expect(espia.mock.calls[0][0]).toBe('/api/panel')
  })

  it('con año, lo manda en la query', async () => {
    const espia = espiarFetch()
    await getPanel(2025)
    expect(espia.mock.calls[0][0]).toBe('/api/panel?anio=2025')
  })
})
