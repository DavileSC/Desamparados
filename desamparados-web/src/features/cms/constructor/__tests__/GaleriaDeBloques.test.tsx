import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test/test-utils'
import GaleriaDeBloques from '../GaleriaDeBloques'
import { FOTO_DE_EJEMPLO, ejemploDe, fotosDeLaPagina } from '../ejemplos'
import { CARPETAS_DE_BLOQUES, FICHA_DE_BLOQUE } from '../etiquetas'
import TIPOS from '../../../../../../shared/tipos-de-bloque.json'

function abrir(hueco = { antes: 'Horario', despues: 'Mapa' }) {
  const onElegir = vi.fn()
  renderWithProviders(
    <GaleriaDeBloques abierta hueco={hueco} fotos={[]} onElegir={onElegir} onElegirSeccion={() => {}} onCerrar={() => {}} />,
  )
  return { onElegir, galeria: screen.getByRole('dialog', { name: 'Añadir un bloque' }) }
}

describe('la galería de «Añadir bloque»', () => {
  it('dice entre qué bloques irá el nuevo', () => {
    const { galeria } = abrir()
    expect(within(galeria).getByText('Irá entre «Horario» y «Mapa».')).toBeInTheDocument()
  })

  it('abre en la primera carpeta, con su primer bloque a la vista y su vista previa', () => {
    const { galeria } = abrir()
    expect(within(galeria).getByRole('button', { name: /^Texto: /, pressed: true })).toBeInTheDocument()
    // La vista previa es el bloque de verdad, con su texto de ejemplo.
    expect(within(galeria).getByText('Título de la sección', { selector: 'h2' })).toBeInTheDocument()
    expect(within(galeria).getByRole('button', { name: 'Añadir «Texto»' })).toBeInTheDocument()
  })

  it('elegir un bloque no lo añade; el botón, el doble clic o Intro, sí', async () => {
    const user = userEvent.setup()
    const { galeria, onElegir } = abrir()
    await user.click(within(galeria).getByRole('button', { name: /^Cita: / }))
    expect(onElegir).not.toHaveBeenCalled()
    await user.click(within(galeria).getByRole('button', { name: 'Añadir «Cita»' }))
    expect(onElegir).toHaveBeenLastCalledWith('cita')
    await user.dblClick(within(galeria).getByRole('button', { name: /^Preguntas plegables: / }))
    expect(onElegir).toHaveBeenLastCalledWith('preguntas')
    within(galeria).getByRole('button', { name: /^Texto: / }).focus()
    await user.keyboard('{Enter}')
    expect(onElegir).toHaveBeenLastCalledWith('texto')
  })

  it('busca en todas las carpetas, sin que importen las tildes', async () => {
    const user = userEvent.setup()
    const { galeria } = abrir()
    await user.type(within(galeria).getByRole('textbox', { name: 'Buscar un bloque' }), 'galeria')
    expect(within(galeria).getByRole('button', { name: /^Galería: / })).toBeInTheDocument()
    expect(within(galeria).queryByRole('button', { name: /^Texto: / })).not.toBeInTheDocument()
    await user.clear(within(galeria).getByRole('textbox', { name: 'Buscar un bloque' }))
    await user.type(within(galeria).getByRole('textbox', { name: 'Buscar un bloque' }), 'zzz')
    expect(within(galeria).getByText('Ningún bloque coincide con «zzz».')).toBeInTheDocument()
  })

  it('cada carpeta enseña los suyos, y dice de qué formas se muestran', async () => {
    const user = userEvent.setup()
    const { galeria } = abrir()
    await user.click(within(galeria).getByRole('button', { name: /^Fotos y vídeo/ }))
    // Seis y no siete: el dibujo es de las páginas propias, apagadas en las pruebas.
    expect(within(galeria).getByText('Fotos y vídeo · 6 bloques')).toBeInTheDocument()
    expect(within(galeria).queryByRole('button', { name: /^Dibujo con texto: / })).not.toBeInTheDocument()
    await user.click(within(galeria).getByRole('button', { name: /^Galería: / }))
    expect(within(galeria).getByText('Disposición:')).toBeInTheDocument()
    expect(within(galeria).getByText('Mosaico')).toBeInTheDocument()
  })
})

describe('las carpetas y los ejemplos', () => {
  it('cada tipo del catálogo está en una carpeta, una sola vez, y tiene su ejemplo', () => {
    const enCarpetas = CARPETAS_DE_BLOQUES.flatMap((c) => c.tipos)
    expect([...enCarpetas].sort()).toEqual([...TIPOS.tipos].sort())
    for (const tipo of TIPOS.tipos) {
      expect(FICHA_DE_BLOQUE[tipo], tipo).toBeDefined()
      expect(ejemploDe(tipo, []).length, tipo).toBeGreaterThan(0)
    }
  })

  it('las fotos de ejemplo salen de la página, y sin ninguna, un hueco', () => {
    const pagina = { cabecera: { foto: '/storage/public/a.webp' }, bloques: [{ tipo: 'foto', url: '/storage/public/b.jpg', alt: 'x' }, { tipo: 'video', url: '/storage/public/c.mp4' }] }
    expect(fotosDeLaPagina(pagina)).toEqual(['/storage/public/a.webp', '/storage/public/b.jpg'])
    const foto = ejemploDe('foto', [])[0] as { url: string }
    expect(foto.url).toBe(FOTO_DE_EJEMPLO)
  })
})
