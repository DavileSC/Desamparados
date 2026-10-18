import { describe, it, expect } from 'vitest'
import { bloqueNuevo, problemaDeBloque } from '../formularios'
import { anchoMaximo } from '../../../../components/bloques/presentacion'
import type { Bloque } from '../../../../lib/api/contenido'

describe('lo que se avisa antes de guardar un bloque', () => {
  it('un botón recién añadido nace sin destino, y se dice', () => {
    const botones = { ...bloqueNuevo('botones'), botones: [{ texto: 'Hazte hermano', enlace: '', estilo: 'principal' }] } as Bloque
    expect(problemaDeBloque(botones)).toBe('tiene el botón 1 sin destino')
  })

  it('una parada recién añadida nace sin hora', () => {
    const itinerario = bloqueNuevo('itinerario') as Extract<Bloque, { tipo: 'itinerario' }>
    expect(itinerario.paradas[0].hora).toBe('')
  })

  it('dos destinos del donativo iguales, aunque cambien las mayúsculas', () => {
    const donativo = { ...bloqueNuevo('donativo'), destinos: ['Caridad', 'caridad '] } as Bloque
    expect(problemaDeBloque(donativo)).toBe('tiene dos destinos iguales')
  })

  it('una fila de la relación que lleva a una página que no existe', () => {
    const relacion = { ...bloqueNuevo('relacion'), filas: [{ cargo: 'Secretaría', nombre: '', texto: 'Las actas', enlace: '/no-existe' }] } as Bloque
    expect(problemaDeBloque(relacion)).toBe('lleva la fila 1 a una página que no existe (/no-existe)')
  })
})

describe('el ancho estrecho', () => {
  const con = (ancho: string) => ({ tipo: 'foto', presentacion: { ancho } }) as unknown as Bloque

  it('nunca ensancha lo que ya es más estrecho', () => {
    expect(anchoMaximo(con('estrecho'), '480px')).toBe('min(480px, 720px)')
    expect(anchoMaximo(con('estrecho'), 600)).toBe(600)
    expect(anchoMaximo(con('estrecho'), 'none')).toBe('720px')
    expect(anchoMaximo(con('normal'), '480px')).toBe('480px')
  })
})
