import { describe, it, expect } from 'vitest'
import { describirAccion, cuandoFue } from '../actividad'

describe('describirAccion', () => {
  it('describe lo que se hizo, sin nombrar el contenido', () => {
    expect(describirAccion('NOTICIA_CREAR', 'noticia')).toBe('creó una noticia')
    expect(describirAccion('EVENTO_ACTUALIZAR', 'evento')).toBe('cambió un acto de la agenda')
    expect(describirAccion('PORTADA_ACTUALIZAR', 'portada')).toBe('cambió la portada')
  })

  it('una acción desconocida no deja la frase coja', () => {
    expect(describirAccion('ACCION_RARA', null)).toBe('hizo un cambio')
  })
})

describe('cuandoFue', () => {
  const ahora = new Date(2026, 8, 11, 12, 0)

  it('lo de hoy lleva la hora', () => {
    expect(cuandoFue(new Date(2026, 8, 11, 10, 5).toISOString(), ahora)).toBe('Hoy 10:05')
  })

  it('lo de ayer lo dice', () => {
    expect(cuandoFue(new Date(2026, 8, 10, 19, 12).toISOString(), ahora)).toBe('Ayer 19:12')
  })

  it('más atrás, el día y el mes', () => {
    expect(cuandoFue(new Date(2026, 8, 9, 11, 5).toISOString(), ahora)).toBe('9 sep')
  })
})
