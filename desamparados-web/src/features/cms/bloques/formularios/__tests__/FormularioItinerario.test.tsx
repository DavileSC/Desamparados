import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { renderWithProviders } from '../../../../../test/test-utils'
import { FormularioItinerario } from '../listas'
import type { BloqueItinerario } from '../../../../../lib/api/contenido'

// El mapa lleva MapLibre, que jsdom no pinta: aquí solo importa a qué recorrido escribe.
vi.mock('../EditorDeRecorrido', () => ({
  default: ({ referencia }: { referencia?: unknown[] }) => <p>Mapa{referencia?.length ? ' con el otro recorrido debajo' : ''}</p>,
}))
vi.mock('../CallesDelRecorrido', () => ({ default: () => null }))

const LINEA: [number, number][] = [[-4.44, 36.72], [-4.441, 36.721]]
const HABITUAL: BloqueItinerario = {
  tipo: 'itinerario',
  titulo: '',
  paradas: [{ hora: '19:30', lugar: 'Salida del templo' }],
  recorrido: { esquinas: LINEA, linea: LINEA, pegado: true },
}

/** El formulario con su bloque en estado, como en el constructor; `ultimo` lleva lo último guardado. */
function montar(inicial: BloqueItinerario) {
  const ultimo = { bloque: inicial }
  function Envoltorio() {
    const [bloque, setBloque] = useState(inicial)
    return <FormularioItinerario bloque={bloque} onCambio={(c) => setBloque((b) => (ultimo.bloque = { ...b, ...c }))} />
  }
  renderWithProviders(<Envoltorio />)
  return ultimo
}

describe('FormularioItinerario, habitual y alternativo', () => {
  it('el alternativo parte del habitual y se edita aparte', async () => {
    const user = userEvent.setup()
    const ultimo = montar(HABITUAL)
    expect(screen.getByRole('tab', { name: /Habitual/ })).toHaveTextContent('En uso')
    await user.click(screen.getByRole('tab', { name: /Alternativo/ }))
    await user.click(screen.getByRole('button', { name: 'Partir del habitual' }))
    expect(ultimo.bloque.alternativo).toEqual({ paradas: HABITUAL.paradas, recorrido: HABITUAL.recorrido })

    // Lo que se cambia en esta pestaña va al alternativo; el habitual se queda como estaba.
    const lugar = screen.getByRole('textbox', { name: 'Lugar' })
    await user.clear(lugar)
    await user.type(lugar, 'Atajo por la plaza')
    expect(ultimo.bloque.alternativo?.paradas[0].lugar).toBe('Atajo por la plaza')
    expect(ultimo.bloque.paradas[0].lugar).toBe('Salida del templo')
    expect(await screen.findByText('Mapa con el otro recorrido debajo')).toBeInTheDocument()
  })

  it('«Usar este» pone en uso el alternativo, y quitarlo vuelve al habitual', async () => {
    const user = userEvent.setup()
    const ultimo = montar({ ...HABITUAL, alternativo: { paradas: [{ hora: '', lugar: 'Atajo' }] } })
    await user.click(screen.getByRole('tab', { name: /Alternativo/ }))
    expect(screen.getByText('La web y el directo enseñan el habitual.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Usar este' }))
    expect(ultimo.bloque.enUso).toBe('alternativo')
    expect(screen.getByRole('tab', { name: /Alternativo/ })).toHaveTextContent('En uso')

    await user.click(screen.getByRole('button', { name: 'Quitar el alternativo' }))
    await user.click(screen.getByRole('button', { name: 'Quitar' }))
    expect(ultimo.bloque.alternativo).toBeUndefined()
    expect(ultimo.bloque.enUso).toBeUndefined()
    // El diálogo se cierra con su transición: hasta entonces, lo de detrás está oculto.
    expect(await screen.findByRole('tab', { name: /Habitual/ })).toHaveAttribute('aria-selected', 'true')
  })
})
