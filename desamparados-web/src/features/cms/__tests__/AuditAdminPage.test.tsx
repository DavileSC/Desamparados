import { describe, it, expect, vi, afterEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import AuditAdminPage from '../AuditAdminPage'

afterEach(() => { vi.unstubAllGlobals() })

describe('AuditAdminPage', () => {
  it('pide la página que dice la URL', async () => {
    const fetchSimulado = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ data: [], meta: { total: 400, page: 2, limit: 20, totalPages: 20 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchSimulado)
    renderWithProviders(<AuditAdminPage />, { ruta: '/cms/auditoria?pagina=2' })

    await waitFor(() => expect(String(fetchSimulado.mock.calls.at(-1)?.[0])).toContain('page=2'))
  })
})
