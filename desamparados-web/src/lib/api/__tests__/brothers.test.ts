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
    await searchBrothers({ q: 'Rocío' }, { pagina: 1, porPagina: 20 })
    const [url] = espia.mock.calls[0]
    expect(String(url)).toContain('/hermanos/admin/search')
    expect(String(url)).toContain(`q=${encodeURIComponent('Rocío')}`)
  })

  it('sin consulta pide el listado sin filtro', async () => {
    const espia = espiarFetch()
    await searchBrothers({}, { pagina: 1, porPagina: 20 })
    const [url] = espia.mock.calls[0]
    expect(String(url)).toContain('/hermanos/admin/search')
    expect(String(url)).not.toContain('q=')
  })

  it('manda la página y el tamaño pedidos', async () => {
    const espia = espiarFetch()
    await searchBrothers({}, { pagina: 3, porPagina: 30 })
    const [url] = espia.mock.calls[0]
    expect(String(url)).toContain('page=3')
    expect(String(url)).toContain('limit=30')
  })

  it('manda la situación, el número y el orden, y no los vacíos', async () => {
    const espia = espiarFetch()
    await searchBrothers({ q: '', estado: 'baja', numero: '', orden: 'numero' }, { pagina: 1, porPagina: 20 })
    const params = new URL(String(espia.mock.calls[0][0]), 'http://x').searchParams
    expect(params.get('estado')).toBe('baja')
    expect(params.get('orden')).toBe('numero')
    expect(params.has('numero')).toBe(false)
    expect(params.has('q')).toBe(false)
  })
})
