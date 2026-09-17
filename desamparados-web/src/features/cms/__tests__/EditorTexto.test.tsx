import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../test/test-utils'
import EditorTexto from '../EditorTexto'
import { ETIQUETAS_PERMITIDAS } from '../../../lib/sanitizeHtml'

describe('EditorTexto', () => {
  it('pinta el contenido que recibe, ya maquetado y no como etiquetas sueltas', async () => {
    renderWithProviders(<EditorTexto valor="<h2>Besapiés</h2><p>El <strong>sábado</strong>.</p>" onCambio={() => {}} />)

    const cuerpo = await screen.findByRole('textbox', { name: /contenido/i })
    await waitFor(() => {
      expect(cuerpo.querySelector('h2')?.textContent).toBe('Besapiés')
      expect(cuerpo.querySelector('strong')?.textContent).toBe('sábado')
    })
    // Lo que se ve es el texto, no el marcado.
    expect(cuerpo.textContent).not.toContain('<strong>')
  })

  it('ofrece los botones de formato en vez de pedir etiquetas a mano', async () => {
    renderWithProviders(<EditorTexto valor="<p>Hola</p>" onCambio={() => {}} />)

    for (const boton of ['Negrita', 'Cursiva', 'Subrayado', 'Título de sección', 'Lista', 'Lista numerada', 'Cita', 'Enlace', 'Insertar foto']) {
      expect(await screen.findByRole('button', { name: boton })).toBeInTheDocument()
    }
  })

  it('escribir avisa con el HTML resultante', async () => {
    const user = userEvent.setup()
    const onCambio = vi.fn()
    renderWithProviders(<EditorTexto valor="<p></p>" onCambio={onCambio} />)

    const cuerpo = await screen.findByRole('textbox', { name: /contenido/i })
    await user.click(cuerpo)
    await user.keyboard('Cultos')

    await waitFor(() => {
      expect(onCambio).toHaveBeenCalled()
      expect(onCambio.mock.calls.at(-1)![0]).toContain('Cultos')
    })
  })

  it('solo produce etiquetas que el saneado del servidor deja pasar', async () => {
    const user = userEvent.setup()
    const onCambio = vi.fn()
    renderWithProviders(<EditorTexto valor="<p>Texto</p>" onCambio={onCambio} />)

    const cuerpo = await screen.findByRole('textbox', { name: /contenido/i })
    await user.click(cuerpo)
    await user.keyboard('{Control>}a{/Control}')
    await user.click(screen.getByRole('button', { name: /negrita/i }))

    await waitFor(() => expect(onCambio).toHaveBeenCalled())
    const html = onCambio.mock.calls.at(-1)![0] as string
    const etiquetas = [...html.matchAll(/<([a-z][a-z0-9]*)/gi)].map((m) => m[1].toLowerCase())
    expect(etiquetas.length).toBeGreaterThan(0)
    for (const etiqueta of etiquetas) {
      expect(ETIQUETAS_PERMITIDAS, `el editor ha producido <${etiqueta}>, que el servidor borraría`).toContain(etiqueta)
    }
  })
})

describe('vacío es vacío', () => {
  // Un editor sin nada escrito devuelve «<p></p>», que tiene longitud y pasaría
  // por contenido: se guardaría una noticia con el cuerpo en blanco sin que
  // ninguna validación protestara.
  it('borrar todo lo escrito avisa con una cadena vacía, no con un párrafo hueco', async () => {
    const user = userEvent.setup()
    const onCambio = vi.fn()
    renderWithProviders(<EditorTexto valor="<p>Texto</p>" onCambio={onCambio} />)

    const cuerpo = await screen.findByRole('textbox', { name: /contenido/i })
    await user.click(cuerpo)
    await user.keyboard('{Control>}a{/Control}{Backspace}')

    await waitFor(() => expect(onCambio).toHaveBeenCalled())
    expect(onCambio.mock.calls.at(-1)![0]).toBe('')
  })
})
