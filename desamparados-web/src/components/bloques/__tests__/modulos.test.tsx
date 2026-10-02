import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import BloquesDePagina from '../BloquesDePagina'
import { fuentesVisibles, moduloDeBloque, moduloDeTipo } from '../modulos'
import type { Bloque } from '../../../lib/api/contenido'

// El encargo escribía «contenido»: el campo del bloque de texto es «html» (lib/api/contenido.ts); con
// «contenido» ni compila (TS2352, le falta `html`) ni se pintaría nada que buscar con getByText.
const texto: Bloque = { tipo: 'texto', titulo: 'Un texto', html: '<p>Hola</p>' } as Bloque
const donativo: Bloque = { tipo: 'donativo', titulo: 'Donativo', importes: [5, 10], destinos: [] } as unknown as Bloque

describe('los bloques y los módulos', () => {
  it('moduloDeTipo y moduloDeBloque leen el catálogo; el listado va por fuente', () => {
    expect(moduloDeTipo('texto')).toBe('nucleo')
    expect(moduloDeTipo('donativo')).toBe('donativos')
    expect(moduloDeTipo('listado')).toEqual(['noticias', 'noticias', 'agenda', 'agenda', 'publicaciones', 'publicaciones', 'publicaciones'])
    expect(moduloDeBloque({ tipo: 'listado', fuente: 'agenda-proxima' } as Bloque)).toBe('agenda')
    expect(fuentesVisibles(new Set(['agenda']))).toEqual(['agenda-proxima', 'agenda'])
  })

  it('un bloque de un módulo apagado no se pinta; el del núcleo sí', () => {
    renderWithProviders(<BloquesDePagina bloques={[texto, donativo]} />, { modulos: ['noticias'] })
    expect(screen.getByText('Hola')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Donativo' })).not.toBeInTheDocument()
  })
})
