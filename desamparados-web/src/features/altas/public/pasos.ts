/**
 * Por dónde va el alta: los pasos, los campos de cada uno y la traducción de
 * los nombres que devuelve el servidor a los del formulario.
 *
 * Son datos puros, sin React, para que la pantalla se quede solo con lo que se
 * ve y esto se pueda leer (y probar) por separado.
 */
import { conFichaPropia, conMenores, type Camino, type MembershipFormData } from './schema'

export type Campo = keyof MembershipFormData


/**
 * El formulario cabe en pantalla porque va por pasos: cada uno tiene los
 * campos justos para no tener que bajar, también en un móvil.
 *
 * El primero pregunta quién se apunta, y de esa respuesta depende el resto:
 * quien solo apunta a un menor no da su fecha de nacimiento (no va a tener
 * ficha) y quien trae menores tiene un paso más para ellos. Su DNI sí se pide
 * siempre, porque es el de la cuenta, no el de la ficha.
 */
export type Paso = { titulo: string; campos: Campo[] }

export function pasosDe(camino: Camino | null): Paso[] {
  if (!camino) return [{ titulo: '¿Quién se apunta?', campos: ['camino'] }]
  return [
    { titulo: '¿Quién se apunta?', campos: ['camino'] },
    {
      titulo: 'Tus datos',
      campos: conFichaPropia(camino)
        ? ['nombre', 'apellidos', 'dni', 'fechaNacimiento']
        : ['nombre', 'apellidos', 'dni'],
    },
    ...(conMenores(camino) ? [{ titulo: 'A quién apuntas', campos: ['menores'] as Campo[] }] : []),
    { titulo: 'Contacto y domicilio', campos: ['email', 'telefono', 'direccion', 'ciudad', 'codigoPostal'] },
    { titulo: 'Acceso al área de hermanos', campos: ['password', 'aceptarPolitica'] },
  ]
}

/** Del `usuario.dni` que manda el servidor al `dni` que conoce el formulario. */
export const CAMPOS_API: Record<string, Campo> = {
  'usuario.dni': 'dni',
  'usuario.email': 'email',
  'usuario.telefono': 'telefono',
  'usuario.nombre': 'nombre',
  'usuario.apellidos': 'apellidos',
  'usuario.direccion': 'direccion',
  'usuario.poblacion': 'ciudad',
  'usuario.codigoPostal': 'codigoPostal',
  'usuario.password': 'password',
  'hermano.fechaNacimiento': 'fechaNacimiento',
}

export const VALORES_INICIALES: MembershipFormData = {
  camino: 'HERMANO', nombre: '', apellidos: '', email: '', password: '', dni: '', telefono: '',
  direccion: '', ciudad: '', codigoPostal: '', fechaNacimiento: '', menores: [], aceptarPolitica: false,
  comentarioAdicional: '',
}

