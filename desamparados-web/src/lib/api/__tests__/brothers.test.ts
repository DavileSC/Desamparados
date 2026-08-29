import { describe, it, expect, vi, afterEach } from 'vitest'
import { searchBrothers } from '../brothers'

function espiarFetch() {
  const espia = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
  vi.stubGlobal('fetch', espia)
  return espia
}

afterEach(() => { vi.unstubAllGlobals() })

describe('searchBrothers', () => {
  it('manda la consulta al buscador del servidor', async () => {
    // El Hermano Mayor tenía su propia rama: pedía el censo entero y no mandaba
    // la consulta, así que escribir en el buscador no filtraba nada. Desde que
    // gestiona el censo como secretaría, el buscador es el mismo para todos y
    // la función ya no necesita saber el rol.
    const espia = espiarFetch()
    await searchBrothers('Rocío')
    const [url] = espia.mock.calls[0]
    expect(String(url)).toContain('/hermanos/admin/search')
    expect(String(url)).toContain(`q=${encodeURIComponent('Rocío')}`)
  })

  it('sin consulta pide el listado sin filtro', async () => {
    const espia = espiarFetch()
    await searchBrothers('')
    const [url] = espia.mock.calls[0]
    expect(String(url)).toContain('/hermanos/admin/search')
    expect(String(url)).not.toContain('q=')
  })
})
