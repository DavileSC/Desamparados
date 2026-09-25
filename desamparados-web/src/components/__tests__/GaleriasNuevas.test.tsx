import { describe, it, expect } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../test/test-utils'
import GaleriaMedios from '../GaleriaMedios'
import type { MedioGaleria } from '../../lib/api/contenido'

const foto = (n: number, pie = ''): MedioGaleria => ({
  tipo: 'foto', url: `/storage/public/foto-${n}.webp`, portada: '', alt: `Foto número ${n}`, pie,
})
const MEDIOS = [foto(1, 'El rostro'), foto(2, 'Las manos'), foto(3)]

describe('galería en tiras', () => {
  it('la primera está abierta; en el móvil, un toque abre otra y el segundo la amplía', async () => {
    renderWithProviders(<GaleriaMedios medios={MEDIOS} formato="tiras" />)
    expect(screen.getByRole('button', { name: 'Ampliar la foto: Foto número 1' })).toBeInTheDocument()

    // Un toque, sin ratón que pase por encima antes.
    fireEvent.click(screen.getByRole('button', { name: 'Abrir: Las manos' }))
    expect(screen.getByRole('button', { name: 'Ampliar la foto: Foto número 2' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ampliar la foto: Foto número 2' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('con ratón, pasar por encima abre la tira y pulsarla la amplía', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={MEDIOS} formato="tiras" />)
    await user.hover(screen.getByRole('button', { name: 'Abrir: Las manos' }))
    expect(screen.getByRole('button', { name: 'Ampliar la foto: Foto número 2' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ampliar la foto: Foto número 2' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('una tira sin pie se nombra por su descripción', () => {
    renderWithProviders(<GaleriaMedios medios={MEDIOS} formato="tiras" />)
    expect(screen.getByRole('button', { name: 'Abrir: Foto número 3' })).toBeInTheDocument()
  })
})

describe('galería en estampas', () => {
  it('pasa a la siguiente y vuelve a la anterior con los botones, y lo cuenta', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={MEDIOS} formato="estampas" />)
    expect(screen.getByText(/^1 \/ 3 · El rostro/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Estampa siguiente' }))
    expect(await screen.findByText(/^2 \/ 3 · Las manos/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Estampa anterior' }))
    expect(screen.getByText(/^1 \/ 3 · El rostro/)).toBeInTheDocument()
  })

  it('la anterior de la primera es la última: el montón da la vuelta', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={MEDIOS} formato="estampas" />)
    await user.click(screen.getByRole('button', { name: 'Estampa anterior' }))
    expect(screen.getByText(/^3 \/ 3/)).toBeInTheDocument()
  })

  it('«Ampliar» abre la de arriba en el visor', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={MEDIOS} formato="estampas" />)
    await user.click(screen.getByRole('button', { name: 'Ampliar' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('arrastrar la de arriba lo bastante la manda al fondo; un toque sin arrastrar la amplía', async () => {
    const { container } = renderWithProviders(<GaleriaMedios medios={MEDIOS} formato="estampas" />)
    // La de arriba es la única estampa que no está oculta a los lectores de pantalla.
    const arriba = () => container.querySelector('[aria-hidden="false"]') as HTMLElement
    fireEvent.pointerDown(arriba(), { clientX: 100, pointerId: 1 })
    fireEvent.pointerMove(arriba(), { clientX: 260, pointerId: 1 })
    fireEvent.pointerUp(arriba(), { clientX: 260, pointerId: 1 })
    expect(await screen.findByText(/^2 \/ 3/)).toBeInTheDocument()

    fireEvent.pointerDown(arriba(), { clientX: 100, pointerId: 1 })
    fireEvent.pointerUp(arriba(), { clientX: 100, pointerId: 1 })
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('con una sola foto no hay a dónde pasar', () => {
    renderWithProviders(<GaleriaMedios medios={[foto(1)]} formato="estampas" />)
    expect(screen.getByRole('button', { name: 'Estampa siguiente' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Estampa anterior' })).toBeDisabled()
  })
})

describe('galería en carteles', () => {
  it('cada cartel lleva su pie y al pulsarlo se amplía', async () => {
    const user = userEvent.setup()
    renderWithProviders(<GaleriaMedios medios={MEDIOS} formato="carteles" />)
    expect(screen.getAllByRole('button', { name: /^Ampliar la foto: / })).toHaveLength(3)
    expect(screen.getByText('Las manos')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ampliar la foto: Foto número 2' }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })
})
