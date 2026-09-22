import { describe, it, expect } from 'vitest'
import { limpiarHtml } from '../limpiarHtml'

describe('limpiarHtml', () => {
  it('conserva el HTML legítimo que produce el CMS', () => {
    const contenido =
      '<h2>Triduo</h2><p>Los cultos <strong>comienzan</strong> a las <em>19:30</em>.</p>' +
      '<ul><li>Rosario</li><li>Eucaristía</li></ul>' +
      '<img src="/storage/public/imagen.webp" alt="Sagrada Titular">' +
      '<a href="https://ejemplo.org" title="Más información">más información</a>'
    const limpio = limpiarHtml(contenido)

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
    const limpio = limpiarHtml(entrada)

    expect(limpio).not.toMatch(/<script/i)
    expect(limpio).not.toMatch(/<iframe/i)
    expect(limpio).not.toMatch(/<form/i)
    expect(limpio).not.toMatch(/\son\w+\s*=/i)
    expect(limpio).not.toMatch(/javascript:/i)
    expect(limpio).not.toMatch(/data:text\/html/i)
  })

  it('no rompe con contenido vacío', () => {
    expect(limpiarHtml('')).toBe('')
  })

  // Las mismas reglas que el servidor (backend: utils/sanear-html.ts).
  it.each([
    ['externa', '<img src="https://tracker.example/pixel.gif" alt="x">'],
    ['relativa al protocolo', '<img src="//tracker.example/pixel.gif">'],
    ['data:', '<img src="data:image/png;base64,AAAA">'],
    ['fuera de las carpetas públicas', '<img src="/storage/private/x.jpg">'],
    ['con ../', '<img src="/storage/public/../x.jpg">'],
  ])('quita una imagen %s', (_caso, imagen) => {
    expect(limpiarHtml(`<p>texto</p>${imagen}`)).toBe('<p>texto</p>')
  })

  it.each([
    ['del dominio de la web', 'https://www.desamparados.es/storage/public/0123456789abcdef0123456789abcdef.jpg'],
    ['del servidor de desarrollo', 'http://localhost:3001/storage/public/0123456789abcdef0123456789abcdef.jpg'],
    ['relativa al protocolo', '//www.desamparados.es/storage/public/0123456789abcdef0123456789abcdef.jpg?v=2'],
  ])('lee como ruta propia la URL absoluta de una foto nuestra (%s), como el servidor al guardar', (_caso, src) => {
    expect(limpiarHtml(`<img src="${src}" alt="Titular">`)).toBe('<img src="/storage/public/0123456789abcdef0123456789abcdef.jpg" alt="Titular">')
  })

  it('una URL absoluta que sale de las carpetas públicas con ../ no pasa', () => {
    expect(limpiarHtml('<img src="https://www.desamparados.es/storage/public/../private/x.jpg">')).toBe('')
  })

  it('conserva las fotos del propio sitio', () => {
    expect(limpiarHtml('<img src="/storage/public/0123456789abcdef0123456789abcdef.jpg" alt="a">')).toContain('src="/storage/public/0123456789abcdef0123456789abcdef.jpg"')
    expect(limpiarHtml('<img src="/images/hero-1920.webp" alt="b">')).toContain('src="/images/hero-1920.webp"')
  })

  it('no deja enlaces relativos al protocolo', () => {
    expect(limpiarHtml('<a href="//otro.example/x">x</a>')).not.toMatch(/href/)
    expect(limpiarHtml('<a href="/noticias/x">x</a>')).toContain('href="/noticias/x"')
  })

  it('un enlace con target abre pestaña nueva siempre con rel="noopener noreferrer"', () => {
    const limpio = limpiarHtml('<a href="https://ejemplo.org" target="_top" rel="opener">x</a>')
    expect(limpio).toContain('target="_blank"')
    expect(limpio).toContain('rel="noopener noreferrer"')
    expect(limpio).not.toMatch(/rel="opener"/)
  })

  it('conserva las celdas combinadas de las tablas', () => {
    expect(limpiarHtml('<table><tr><td colspan="2" rowspan="3">x</td></tr></table>')).toMatch(/colspan="2" rowspan="3"/)
  })
})
