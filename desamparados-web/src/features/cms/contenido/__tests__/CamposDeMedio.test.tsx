import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import CamposDeMedio from '../CamposDeMedio'
import { VIDEO_NUEVO } from '../medios'
import type { MedioGaleria } from '../../../../lib/api/contenido'

const VIDEO = '/storage/public/0123456789abcdef0123456789abcdef.mp4'

function Probar({ inicial, alCambiar = () => {} }: { inicial: MedioGaleria; alCambiar?: (m: MedioGaleria) => void }) {
  const [medio, setMedio] = useState(inicial)
  return <CamposDeMedio medio={medio} onCambio={(c) => { const nuevo = { ...medio, ...c }; setMedio(nuevo); alCambiar(nuevo) }} />
}

describe('el origen de un vídeo', () => {
  it('uno nuevo empieza como enlace de YouTube o Vimeo', () => {
    renderWithProviders(<Probar inicial={VIDEO_NUEVO} />)
    expect(screen.getByRole('button', { name: 'YouTube o Vimeo' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Dirección del vídeo')).toBeInTheDocument()
  })

  it('al elegir «subir un clip» sale el botón de subida con sus reglas', async () => {
    renderWithProviders(<Probar inicial={VIDEO_NUEVO} />)
    await userEvent.click(screen.getByRole('button', { name: 'Subir un clip corto' }))
    expect(screen.getByText(/subir vídeo/i)).toBeInTheDocument()
    expect(screen.getByText(/de hasta 15 MB, 2 minutos y 1080p/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Dirección del vídeo')).not.toBeInTheDocument()
  })

  it('uno ya subido se abre como clip, y cambiar de origen quita la dirección', async () => {
    const alCambiar = vi.fn()
    renderWithProviders(<Probar inicial={{ ...VIDEO_NUEVO, url: VIDEO }} alCambiar={alCambiar} />)
    expect(screen.getByRole('button', { name: 'Subir un clip corto' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'YouTube o Vimeo' }))
    expect(alCambiar).toHaveBeenLastCalledWith(expect.objectContaining({ url: '' }))
    expect(screen.getByLabelText('Dirección del vídeo')).toBeInTheDocument()
  })

  it('una foto no enseña la elección de origen', () => {
    renderWithProviders(<Probar inicial={{ ...VIDEO_NUEVO, tipo: 'foto' }} />)
    expect(screen.queryByRole('button', { name: 'YouTube o Vimeo' })).not.toBeInTheDocument()
  })
})
