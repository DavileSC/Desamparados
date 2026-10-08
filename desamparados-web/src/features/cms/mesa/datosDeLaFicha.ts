import { useState } from 'react'
import type { CorreccionDeFicha, FichaDeMesa } from '../../../lib/api/mesa'
import { diaDe } from './formato'

export type Datos = ReturnType<typeof datosDe>

const datosDe = (ficha: FichaDeMesa) => ({
  nombre: ficha.nombre,
  primerApellido: ficha.primerApellido ?? ficha.apellidos,
  segundoApellido: ficha.segundoApellido ?? '',
  fechaNacimiento: diaDe(ficha.fechaNacimiento),
  telefono: ficha.telefono ?? '',
  email: ficha.email ?? '',
})

/** Los datos de la ficha, para confirmarlos con la persona delante y corregir lo que haga falta. */
export function useDatosPersona(ficha: FichaDeMesa) {
  const [datos, setDatos] = useState(() => datosDe(ficha))

  /** Solo lo que la mesa ha cambiado de la ficha. */
  const correccion = (): CorreccionDeFicha => {
    const c: CorreccionDeFicha = {}
    const antes = datosDe(ficha)
    if (datos.nombre.trim() !== antes.nombre) c.nombre = datos.nombre.trim()
    if (datos.primerApellido.trim() !== antes.primerApellido) c.primerApellido = datos.primerApellido.trim()
    if (datos.segundoApellido.trim() !== antes.segundoApellido) c.segundoApellido = datos.segundoApellido.trim() || null
    if (datos.fechaNacimiento !== antes.fechaNacimiento) c.fechaNacimiento = datos.fechaNacimiento
    // Sin el contacto entero llega enmascarado: no se corrige desde aquí, y
    // mandarlo (aunque fuera tal cual) lo rechaza el servidor con un 403.
    if (ficha.contactoCompleto) {
      if (datos.telefono.trim() !== antes.telefono) c.telefono = datos.telefono.trim() || null
      if (datos.email.trim() !== antes.email) c.email = datos.email.trim() || null
    }
    return c
  }

  return { datos, setDatos, correccion, contactoCompleto: ficha.contactoCompleto }
}

export const leyenda = { fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', mb: 1 } as const
