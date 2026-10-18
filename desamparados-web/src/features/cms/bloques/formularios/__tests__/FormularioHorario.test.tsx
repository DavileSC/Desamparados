import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { renderWithProviders } from '../../../../../test/test-utils'
import { FormularioHorario } from '../horario'
import type { BloqueHorario } from '../../../../../lib/api/contenido'

const HORARIO: BloqueHorario = {
  tipo: 'horario',
  titulo: '',
  misas: [
    { etiqueta: 'Lunes a sábado', dias: [1, 2, 3, 4, 5, 6], horas: ['19:00'], horasVerano: [] },
    { etiqueta: 'Domingos', dias: [0], horas: ['10:00', '12:00'], horasVerano: [] },
  ],
  despacho: [],
  verano: { desde: '', hasta: '' },
  lineas: [],
}

/** El formulario con su bloque en estado, como en el constructor, y un botón que vuelve al de partida, como deshacer. */
function Envoltorio() {
  const [bloque, setBloque] = useState(HORARIO)
  return (
    <>
      <button type="button" onClick={() => setBloque(HORARIO)}>Deshacer</button>
      <FormularioHorario bloque={bloque} onCambio={(cambios) => setBloque((b) => ({ ...b, ...cambios }))} />
    </>
  )
}

const horas = () => screen.getAllByRole('textbox', { name: /^Horas$/ }).map((campo) => (campo as HTMLInputElement).value)

describe('las horas de las franjas de misas', () => {
  it('se mueven con su franja al subirla', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Envoltorio />)
    expect(horas()).toEqual(['19:00', '10:00, 12:00'])
    await user.click(screen.getByRole('button', { name: 'Subir: franja 2' }))
    // Antes, el campo se quedaba en su sitio y enseñaba las horas de la vecina.
    expect(horas()).toEqual(['10:00, 12:00', '19:00'])
  })

  it('vuelven a las guardadas al deshacer', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Envoltorio />)
    const primero = screen.getAllByRole('textbox', { name: /^Horas$/ })[0]
    await user.clear(primero)
    await user.type(primero, '20:00')
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    expect(await screen.findByDisplayValue('19:00')).toBeInTheDocument()
  })
})
