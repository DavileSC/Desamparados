import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '../sanitizeHtml'

describe('sanitizeHtml', () => {
  it('conserva el HTML legítimo que produce el CMS', () => {
    const contenido =
      '<h2>Triduo</h2><p>Los cultos <strong>comienzan</strong> a las <em>19:30</em>.</p>' +
      '<ul><li>Rosario</li><li>Eucaristía</li></ul>' +
      '<img src="/storage/public/imagen.webp" alt="Sagrada Titular">' +
      '<a href="https://ejemplo.org" title="Más información">más información</a>'
    const limpio = sanitizeHtml(contenido)

    expect(limpio).toContain('<h2>Triduo</h2>')
    expect(limpio).toContain('<strong>comienzan</strong>')
    expect(limpio).toContain('<li>Eucaristía</li>')
    expect(limpio).toContain('alt="Sagrada Titular"')
    expect(limpio).toContain('href="https://ejemplo.org"')
  })

  it.each([
    ['script directo', '<script>robarSesion()</script><p>texto</p>'],
    ['onerror en imagen', '<img src="x" onerror="robarSesion()">'],
    ['onload en cuerpo', '<p onload="robarSesion()">texto</p>'],
    ['href javascript:', '<a href="javascript:robarSesion()">pincha aquí</a>'],
    ['iframe', '<iframe src="https://malicioso.example"></iframe>'],
    ['svg con script', '<svg><script>robarSesion()</script></svg>'],
    ['formulario que roba credenciales', '<form action="https://malicioso.example"><input name="p"></form>'],
    ['esquema data ejecutable', '<a href="data:text/html;base64,PHNjcmlwdD4=">enlace</a>'],
  ])('neutraliza %s', (_caso, entrada) => {
    const limpio = sanitizeHtml(entrada)

    expect(limpio).not.toMatch(/<script/i)
    expect(limpio).not.toMatch(/<iframe/i)
    expect(limpio).not.toMatch(/<form/i)
    expect(limpio).not.toMatch(/\son\w+\s*=/i)
    expect(limpio).not.toMatch(/javascript:/i)
    expect(limpio).not.toMatch(/data:text\/html/i)
  })

  it('no rompe con contenido vacío', () => {
    expect(sanitizeHtml('')).toBe('')
  })
})
