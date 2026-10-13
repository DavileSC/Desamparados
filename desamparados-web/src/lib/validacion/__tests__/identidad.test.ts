/// <reference types="node" />
// El resto de `src` es código de navegador (tsconfig.app.json solo carga
// tipos de "vite/client"): este test es el único que lee un fichero del
// disco, así que necesita los tipos de Node solo para él.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  normalizarDni, esDniValido,
  normalizarTelefono, esTelefonoValido, telefonoInternacional,
  esCodigoPostalValido, esTextoValido,
  normalizarIban, esIbanValido,
} from '../identidad'

// La misma tabla que lee backend-desamparados/test/identidad-paridad.test.ts.
// Si el formulario y el servidor se separan, uno de los dos falla: es toda la
// protección que tenemos, porque son dos paquetes sin código compartido.
//
// `import.meta.url` va a una constante antes de entrar en `new URL()`: escrito
// como literal, Vite lo reconoce como su patrón de "URL de asset" y lo reescribe
// a una URL http://.../@fs/... del servidor de desarrollo en vez de a un
// file://, y `fileURLToPath` revienta con «The URL must be of scheme file».
const baseDeEsteFichero = import.meta.url
const casos = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../../../shared/casos-identidad.json', baseDeEsteFichero)), 'utf8'),
) as {
  dni: { valor: string; valido: boolean; normalizado: string }[]
  telefono: { valor: string; valido: boolean; normalizado: string }[]
  iban: { valor: string; valido: boolean; normalizado: string }[]
  codigoPostal: { valor: string; valido: boolean }[]
  texto: { valor: string; valido: boolean }[]
}

describe('reglas de identidad', () => {
  it.each(casos.dni)('DNI $valor', ({ valor, valido, normalizado }) => {
    expect(normalizarDni(valor)).toBe(normalizado)
    expect(esDniValido(valor)).toBe(valido)
  })

  it.each(casos.iban)('IBAN $valor', ({ valor, valido, normalizado }) => {
    expect(normalizarIban(valor)).toBe(normalizado)
    expect(esIbanValido(valor)).toBe(valido)
  })

  it.each(casos.telefono)('teléfono $valor', ({ valor, valido, normalizado }) => {
    expect(normalizarTelefono(valor)).toBe(normalizado)
    expect(esTelefonoValido(valor)).toBe(valido)
  })

  it.each(casos.codigoPostal)('código postal $valor', ({ valor, valido }) => {
    expect(esCodigoPostalValido(valor)).toBe(valido)
  })

  it.each(casos.texto)('texto $valor', ({ valor, valido }) => {
    expect(esTextoValido(valor)).toBe(valido)
  })
})

describe('telefonoInternacional', () => {
  it('antepone el +34 a uno de España, que se guarda sin él', () => {
    expect(telefonoInternacional('952 00 00 00')).toBe('+34 952 00 00 00')
  })
  it('respeta el prefijo de uno extranjero, con + o con 00', () => {
    expect(telefonoInternacional('+351 212 345 678')).toBe('+351 212 345 678')
    expect(telefonoInternacional('00351 212 345 678')).toBe('+351 212 345 678')
  })
})
