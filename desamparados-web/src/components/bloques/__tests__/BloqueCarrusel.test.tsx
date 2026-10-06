import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloqueCarrusel from '../BloqueCarrusel'
import type { BloqueCarrusel as Datos, PiezaDeCarrusel } from '../../../lib/api/contenido'

const pieza = (titulo: string, extra: Partial<PiezaDeCarrusel> = {}): PiezaDeCarrusel => ({
  familia: 'Insignias', titulo, texto: `Historia de ${titulo}.`,
  foto: { url: `/images/enseres/${titulo}.webp`, alt: `Foto de ${titulo}`, pie: '' },
  datos: [{ etiqueta: 'Año', valor: '1997' }],
  ...extra,
})
const bloque = (piezas: PiezaDeCarrusel[]): Datos => ({ tipo: 'carrusel', titulo: '', piezas })

describe('BloqueCarrusel', () => {
  it('enseña una pieza con su familia, su historia y su cartela', () => {
    renderWithProviders(<BloqueCarrusel bloque={bloque([pieza('Cruz'), pieza('Estandarte')])} />)
    expect(screen.getByRole('heading', { name: 'Cruz' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Estandarte' })).not.toBeInTheDocument()
    expect(screen.getByText('Insignias')).toBeInTheDocument()
    expect(screen.getByText('Historia de Cruz.')).toBeInTheDocument()
    expect(screen.getByText('Año')).toBeInTheDocument()
    expect(screen.getByText('1997')).toBeInTheDocument()
    expect(screen.getByText('01')).toBeInTheDocument()
  })

  it('las flechas pasan a la siguiente y dan la vuelta', async () => {
    renderWithProviders(<BloqueCarrusel bloque={bloque([pieza('Cruz'), pieza('Estandarte')])} />)
    fireEvent.click(screen.getByRole('button', { name: 'Pieza siguiente' }))
    expect(await screen.findByRole('heading', { name: 'Estandarte' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pieza siguiente' }))
    expect(await screen.findByRole('heading', { name: 'Cruz' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pieza anterior' }))
    expect(await screen.findByRole('heading', { name: 'Estandarte' })).toBeInTheDocument()
  })

  it('también se pasa con las flechas del teclado', async () => {
    renderWithProviders(<BloqueCarrusel bloque={bloque([pieza('Cruz'), pieza('Estandarte')])} />)
    fireEvent.keyDown(screen.getByRole('region'), { key: 'ArrowRight' })
    expect(await screen.findByRole('heading', { name: 'Estandarte' })).toBeInTheDocument()
  })

  it('con una sola pieza no hay flechas, y sin cartela no queda hueco', () => {
    renderWithProviders(<BloqueCarrusel bloque={bloque([pieza('Cruz', { familia: '', datos: [] })])} />)
    expect(screen.queryByRole('button', { name: 'Pieza siguiente' })).not.toBeInTheDocument()
    expect(screen.queryByText('Insignias')).not.toBeInTheDocument()
    expect(screen.queryByText('Año')).not.toBeInTheDocument()
  })

  describe('en el móvil', () => {
    // jsdom no casa ninguna media query (escritorio): se finge un móvil de 390 px.
    const matchMediaOriginal = window.matchMedia
    beforeEach(() => {
      window.matchMedia = ((consulta: string) => {
        const max = /max-width:\s*([\d.]+)px/.exec(consulta)
        const min = /min-width:\s*([\d.]+)px/.exec(consulta)
        const matches = (!max || 390 <= Number(max[1])) && (!min || 390 >= Number(min[1]))
        return { matches, media: consulta, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }
      }) as unknown as typeof window.matchMedia
    })
    afterEach(() => { window.matchMedia = matchMediaOriginal })

    it('la ficha va sobre la foto y la cartela sube en una hoja', async () => {
      renderWithProviders(<BloqueCarrusel bloque={bloque([pieza('Cruz'), pieza('Estandarte')])} />)
      expect(screen.getByRole('heading', { name: 'Cruz' })).toBeInTheDocument()
      expect(screen.queryByText('1997')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Ver cartela' }))
      const hoja = await screen.findByRole('dialog', { name: 'Cruz' })
      expect(within(hoja).getByText('1997')).toBeInTheDocument()
      fireEvent.click(within(hoja).getByRole('button', { name: 'Cerrar la cartela' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('las flechas siguen pasando de pieza', async () => {
      renderWithProviders(<BloqueCarrusel bloque={bloque([pieza('Cruz'), pieza('Estandarte')])} />)
      fireEvent.click(screen.getByRole('button', { name: 'Pieza siguiente' }))
      expect(await screen.findByRole('heading', { name: 'Estandarte' })).toBeInTheDocument()
    })
  })

  it('solo la foto que se ve se anuncia a los lectores de pantalla', () => {
    renderWithProviders(<BloqueCarrusel bloque={bloque([pieza('Cruz'), pieza('Estandarte')])} />)
    expect(screen.getByRole('img', { name: 'Foto de Cruz' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Foto de Estandarte' })).not.toBeInTheDocument()
  })
})
