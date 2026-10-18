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

describe('las opciones que no harían nada', () => {
  const listado = (fuente: string, presentacion?: Record<string, string>) => ({ tipo: 'listado', titulo: 'Noticias', fuente, presentacion }) as unknown as Bloque

  it('el archivo de noticias no ofrece cuántos ni en lista, pero sí columnas', () => {
    pintar(listado('noticias'))
    expect(screen.queryByText('Cuántos')).not.toBeInTheDocument()
    expect(screen.queryByText('Disposición')).not.toBeInTheDocument()
    expect(screen.getByText('Columnas')).toBeInTheDocument()
    // Pinta su propio título y no lo centra, y su ancho es el de la página.
    expect(screen.queryByText('Título')).not.toBeInTheDocument()
    expect(screen.queryByText('Ancho')).not.toBeInTheDocument()
  })

  it('las últimas noticias en lista no ofrecen columnas', () => {
    pintar(listado('noticias-recientes', { disposicion: 'lista' }))
    expect(screen.getByText('Cuántos')).toBeInTheDocument()
    expect(screen.queryByText('Columnas')).not.toBeInTheDocument()
  })

  it('una foto de lado a lado no ofrece marco, y los tamaños van de menor a mayor', () => {
    pintar({ tipo: 'foto', titulo: '', url: '', alt: '', pie: '', presentacion: { tamano: 'completa' } } as unknown as Bloque)
    expect(screen.queryByText('Marco')).not.toBeInTheDocument()
    const tamanos = screen.getByRole('group', { name: 'Tamaño' })
    expect([...tamanos.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Pequeña', 'Mediana', 'Grande', 'De lado a lado'])
  })

  it('avisa de que la cronología no se lee sobre papel', () => {
    pintar({ tipo: 'cronologia', titulo: '', hitos: [], presentacion: { fondo: 'papel' } } as unknown as Bloque)
    expect(screen.getByText(/pensado para fondo oscuro/i)).toBeInTheDocument()
  })
})
