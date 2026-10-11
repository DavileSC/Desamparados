import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test/test-utils'
import DatosDeIdentificacion from '../DatosDeIdentificacion'
import { site, faltanDatosIdentificativos, DATO_PENDIENTE } from '../../../config/site'
import DATOS from '@instalacion/datos-entidad.json'

describe('DatosDeIdentificacion', () => {
  it('muestra el correo de contacto real', () => {
    renderWithProviders(<DatosDeIdentificacion />)
    expect(screen.getByText(DATOS.secretaria.email!)).toBeInTheDocument()
  })

  it('marca como pendientes los datos que el Grupo Parroquial no ha confirmado', () => {
    renderWithProviders(<DatosDeIdentificacion />)
    const pendientes = screen.queryAllByText(new RegExp(DATO_PENDIENTE, 'i'))
    if (faltanDatosIdentificativos) {
      expect(pendientes.length).toBeGreaterThan(0)
      expect(screen.getByText(/deben incorporarse antes de la publicación/i)).toBeInTheDocument()
    } else {
      expect(pendientes).toHaveLength(0)
    }
  })

  it('no publica el NIF: el Grupo no quiere', () => {
    renderWithProviders(<DatosDeIdentificacion />)
    expect(screen.queryByText(/NIF/)).not.toBeInTheDocument()
    // Ni una cifra con forma de NIF de entidad (letra, siete cifras y control).
    expect(document.body).not.toHaveTextContent(/\b[A-Z]\d{7}[A-Z0-9]\b/)
  })

  it('no publica datos identificativos inventados', () => {
    // Vigila que nadie rellene site.ts con marcadores de posición: mientras el
    // dato real no exista debe valer null, no un NIF o un teléfono de relleno.
    const marcadores: Array<[RegExp, string]> = [
      [/0{4,}/, 'una tira de ceros'],
      [/(\d)\1{4,}/, 'un dígito repetido'],
      [/123456|987654/, 'una secuencia consecutiva'],
      [/x{3,}/i, 'una x de relleno'],
      [/lorem|ipsum|ejemplo|placeholder|pendiente|tbd|todo/i, 'una palabra de relleno'],
    ]
    const valores: Array<[string, string]> = (
      [
        ['denominación', site.entidad.denominacion],
        ['domicilio', site.entidad.domicilio],
        ['teléfono', DATOS.secretaria.telefono],
      ] as Array<[string, string | null]>
    ).filter((par): par is [string, string] => typeof par[1] === 'string')

    for (const [campo, valor] of valores) {
      // Normaliza separadores para que "952 00 00 00" y "952000000" se juzguen igual.
      const compacto = valor.replace(/[\s.\-/]/g, '')
      for (const [marcador, motivo] of marcadores) {
        expect(
          compacto,
          `El ${campo} "${valor}" contiene ${motivo}: parece un dato de relleno, dejalo en null hasta tener el real`
        ).not.toMatch(marcador)
      }
    }
  })
})
