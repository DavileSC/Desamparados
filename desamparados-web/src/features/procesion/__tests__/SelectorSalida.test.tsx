import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SelectorSalida from '../SelectorSalida'
import type { Salida } from '../../../lib/api/salidas'

const salida = (slug: string, nombre: string) => ({ slug, nombre, id: slug.length } as Salida)

describe('SelectorSalida', () => {
  it('con una sola salida no pinta nada', () => {
    const { container } = render(<SelectorSalida salidas={[salida('sabado-de-pasion', 'Sábado de Pasión')]} valor="sabado-de-pasion" onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('con varias, una opción por salida y avisa del slug elegido', async () => {
    const onChange = vi.fn()
    render(<SelectorSalida salidas={[salida('sabado-de-pasion', 'Sábado de Pasión'), salida('rosario-vespertino', 'Rosario vespertino')]} valor="sabado-de-pasion" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Rosario vespertino' }))
    expect(onChange).toHaveBeenCalledWith('rosario-vespertino')
  })
})
