import { describe, it, expect } from 'vitest'
import { fechaCorta, haceCuanto, piezasDeNoticia, piezasDePublicacion, queLeFalta, tieneTexto } from '../completitud'

const completa = { titulo: 'Cultos de octubre', extracto: 'Triduo y función.', contenido: '<p>Texto</p>', imagenUrl: '/storage/public/cultos.jpg' }
const faltan = (noticia: Parameters<typeof piezasDeNoticia>[0]) => piezasDeNoticia(noticia).filter((p) => !p.lista).map((p) => p.clave)

describe('tieneTexto', () => {
  it('el editor vacío no cuenta como texto', () => {
    expect(tieneTexto('')).toBe(false)
    expect(tieneTexto('<p></p>')).toBe(false)
    expect(tieneTexto('<p>&nbsp; </p><p><br></p>')).toBe(false)
  })

  it('cuenta el texto, y también una foto sola dentro del cuerpo', () => {
    expect(tieneTexto('<p>Hola</p>')).toBe(true)
    expect(tieneTexto('<p><img src="/a.jpg" alt=""></p>')).toBe(true)
  })
})

describe('piezasDeNoticia', () => {
  it('una noticia completa no echa nada de menos', () => {
    expect(faltan(completa)).toEqual([])
  })

  it('los espacios no cuentan como título ni como extracto', () => {
    expect(faltan({ ...completa, titulo: '   ', extracto: ' ' })).toEqual(['titulo', 'extracto'])
  })

  it('sin extracto ni foto (nulos, como vienen del servidor)', () => {
    expect(faltan({ ...completa, extracto: null, imagenUrl: null })).toEqual(['extracto', 'foto'])
  })

  it('va siempre en el mismo orden: título, extracto, texto y foto', () => {
    expect(piezasDeNoticia(completa).map((p) => p.clave)).toEqual(['titulo', 'extracto', 'texto', 'foto'])
  })
})

describe('queLeFalta', () => {
  const frase = (noticia: Parameters<typeof piezasDeNoticia>[0]) => queLeFalta(piezasDeNoticia(noticia))

  it('dice lo que falta como se diría en voz alta', () => {
    expect(frase(completa)).toBe('Lista para publicar')
    expect(frase({ ...completa, imagenUrl: '' })).toBe('Le falta la foto')
    expect(frase({ ...completa, extracto: '', imagenUrl: '' })).toBe('Le faltan el extracto y la foto')
    expect(frase({ titulo: '', extracto: '', contenido: '<p></p>', imagenUrl: '' })).toBe('Le faltan el título, el extracto, el texto y la foto')
  })
})

describe('haceCuanto', () => {
  const ahora = new Date('2026-09-19T12:00:00')
  const antes = (ms: number) => new Date(ahora.getTime() - ms).toISOString()
  const MIN = 60_000, HORA = 60 * MIN, DIA = 24 * HORA

  it('de lo más reciente a lo más lejano', () => {
    expect(haceCuanto(antes(20_000), ahora)).toBe('hace un momento')
    expect(haceCuanto(antes(5 * MIN), ahora)).toBe('hace 5 minutos')
    expect(haceCuanto(antes(3 * HORA), ahora)).toBe('hace 3 horas')
    expect(haceCuanto(antes(DIA + HORA), ahora)).toBe('ayer')
    expect(haceCuanto(antes(2 * DIA), ahora)).toBe('anteayer')
    expect(haceCuanto(antes(4 * DIA), ahora)).toBe('hace 4 días')
    expect(haceCuanto(antes(14 * DIA), ahora)).toBe('hace 2 semanas')
  })

  it('pasado un mes, la fecha', () => {
    expect(haceCuanto('2026-07-02T10:00:00', ahora)).toBe('el 2 jul 2026')
  })
})

describe('fechaCorta', () => {
  it('siempre tres letras para el mes, como la tarjeta pública', () => {
    expect(fechaCorta('2026-09-14T10:00:00')).toBe('14 sep 2026')
    expect(fechaCorta('2026-02-01T10:00:00')).toBe('1 feb 2026')
  })
})

describe('piezasDePublicacion', () => {
  const lista = { titulo: 'Boletín n.º 12', descripcion: 'Crónica del curso.', archivoUrl: '/storage/public/0123456789abcdef0123456789abcdef.pdf', imagenUrl: '/storage/public/b.jpg' }
  const faltanPub = (p: Parameters<typeof piezasDePublicacion>[0]) => piezasDePublicacion(p).filter((x) => !x.lista).map((x) => x.clave)

  it('una publicación completa no echa nada de menos', () => {
    expect(queLeFalta(piezasDePublicacion(lista))).toBe('Lista para publicar')
  })

  it('el PDF de relleno del seed cuenta como sin PDF', () => {
    expect(faltanPub({ ...lista, archivoUrl: '/storage/public/documentos/pendiente.pdf' })).toEqual(['pdf'])
  })

  it('sin descripción ni portada lo dice como se diría', () => {
    expect(queLeFalta(piezasDePublicacion({ ...lista, descripcion: null, imagenUrl: null }))).toBe('Le faltan la descripción y la portada')
  })
})
