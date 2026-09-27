import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test/test-utils'
import PanelDePresentacion from '../PanelDePresentacion'
import type { Bloque } from '../../../../lib/api/contenido'

const FOTO = { tipo: 'foto' as const, url: '/storage/public/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp', portada: '', alt: 'Una foto', pie: '' }
const VIDEO = { ...FOTO, tipo: 'video' as const, url: '/storage/public/0123456789abcdef0123456789abcdef.mp4', portada: FOTO.url, alt: 'Un vídeo' }

const galeria = (medios: (typeof FOTO | typeof VIDEO)[]) => ({ tipo: 'galeria', titulo: '', medios }) as unknown as Bloque
const pintar = (bloque: Bloque) => renderWithProviders(<PanelDePresentacion bloque={bloque} ruta="/historia" onCambio={() => {}} />)

describe('la presentación de una galería', () => {
  it('con fotos, aunque lleve vídeos, se elige disposición, columnas y fondo, como siempre', () => {
    pintar(galeria([FOTO, VIDEO]))
    expect(screen.getByText('Disposición')).toBeInTheDocument()
    expect(screen.getByText('Columnas')).toBeInTheDocument()
    expect(screen.getByText('Fondo')).toBeInTheDocument()
    expect(screen.queryByText(/solo vídeos se ve siempre en pase/i)).not.toBeInTheDocument()
  })

  it('con solo vídeos no salen esas opciones, y se explica por qué', () => {
    pintar(galeria([VIDEO]))
    expect(screen.getByText(/una galería de solo vídeos se ve siempre en pase/i)).toBeInTheDocument()
    expect(screen.queryByText('Disposición')).not.toBeInTheDocument()
    expect(screen.queryByText('Columnas')).not.toBeInTheDocument()
    expect(screen.queryByText('Fondo')).not.toBeInTheDocument()
    // Lo demás de la franja sigue.
    expect(screen.getByText('Ancho')).toBeInTheDocument()
  })
})
