import { describe, it, expect } from 'vitest'
import { loginSchema, resetPasswordSchema } from '../../features/altas/auth/schema'
import { membershipSchema } from '../../features/altas/public/schema'
import { LONGITUD_MINIMA } from '../politicaDeContrasena'

/** Extrae el mensaje del campo password de un parseo fallido */
function motivo(resultado: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  return resultado.error?.issues.find((i) => i.path[0] === 'password')?.message
}

describe('política de contraseñas en los formularios', () => {
  it('el mínimo que exige el formulario es el del backend, no otro', () => {
    expect(LONGITUD_MINIMA).toBe(12)
  })

  describe('contraseña nueva (registro y restablecimiento)', () => {
    const debiles: [string, string][] = [
      ['12345678', 'corta y una secuencia'],
      ['aaaaaaaaaaaa', 'un solo carácter repetido'],
      ['password1234', 'palabra de diccionario'],
      ['Desamparados22', 'palabra del propio proyecto'],
      ['P4ssw0rd1234', 'la misma palabra disfrazada'],
    ]

    it.each(debiles)('rechaza %s (%s)', (valor) => {
      const r = resetPasswordSchema.safeParse({ password: valor, confirmation: valor })
      expect(r.success).toBe(false)
      // El motivo tiene que ser concreto, no un "no válida" a secas
      expect(motivo(r)).toMatch(/^La contraseña /)
    })

    it('acepta una contraseña razonable', () => {
      const buena = 'Nazareno-Local-2026'
      expect(resetPasswordSchema.safeParse({ password: buena, confirmation: buena }).success).toBe(true)
    })

    it('el alta de hermano aplica las mismas reglas que el restablecimiento', () => {
      const base = {
        camino: 'HERMANO' as const, menores: [],
        nombre: 'Ana', apellidos: 'Ruiz', email: 'prueba@ejemplo.com',
        dni: '00000000T', telefono: '600000000', direccion: 'Calle 1',
        ciudad: 'Málaga', codigoPostal: '29001', fechaNacimiento: '1990-01-01',
        aceptarPolitica: true,
      }
      expect(membershipSchema.safeParse({ ...base, password: '12345678' }).success).toBe(false)
      expect(membershipSchema.safeParse({ ...base, password: 'Nazareno-Local-2026' }).success).toBe(true)
    })
  })

  describe('contraseña existente (acceso)', () => {
    it('NO aplica la política: una contraseña anterior al endurecimiento sigue valiendo', () => {
      // Si el acceso exigiera 12 caracteres, quien se registró antes se quedaría
      // fuera de su propia cuenta sin poder hacer nada.
      const r = loginSchema.safeParse({ email: 'a@b.com', password: 'corta12' })
      expect(r.success).toBe(true)
    })

    it('pero exige que no esté vacía', () => {
      expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
    })
  })
})
