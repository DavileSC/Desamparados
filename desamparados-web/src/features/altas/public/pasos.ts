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
  const propia = conFichaPropia(camino)
  return [
    { titulo: '¿Quién se apunta?', campos: ['camino'] },
    {
      titulo: 'Tus datos',
      campos: propia
        ? ['nombre', 'primerApellido', 'segundoApellido', 'dni', 'fechaNacimiento', 'sexo', 'estadoCivil']
        : ['nombre', 'primerApellido', 'segundoApellido', 'dni'],
    },
    ...(propia ? [{ titulo: 'Bautismo', campos: ['fechaBautismo', 'lugarBautismo', 'parroquiaBautismo', 'certificadoBautismo'] as Campo[] }] : []),
    ...(conMenores(camino) ? [{ titulo: 'A quién apuntas', campos: ['menores'] as Campo[] }] : []),
    {
      titulo: 'Contacto y domicilio',
      campos: ['email', 'telefono', 'direccion', 'codigoPostal', 'ciudad', 'provincia', 'comunidadAutonoma', 'pais'],
    },
    { titulo: 'La cuota', campos: ['formaPago', 'iban', 'titularidad', 'titularCuenta'] },
    {
      titulo: 'Acceso al área de hermanos',
      campos: propia ? ['foto', 'password', 'boletin', 'aceptarPolitica'] : ['password', 'boletin', 'aceptarPolitica'],
    },
  ]
}

/** Del `usuario.dni` que manda el servidor al `dni` que conoce el formulario. */
export const CAMPOS_API: Record<string, Campo> = {
  'usuario.dni': 'dni',
  'usuario.email': 'email',
  'usuario.telefono': 'telefono',
  'usuario.nombre': 'nombre',
  'usuario.apellidos': 'primerApellido',
  'usuario.primerApellido': 'primerApellido',
  'usuario.segundoApellido': 'segundoApellido',
  'usuario.direccion': 'direccion',
  'usuario.poblacion': 'ciudad',
  'usuario.codigoPostal': 'codigoPostal',
  'usuario.provincia': 'provincia',
  'usuario.comunidadAutonoma': 'comunidadAutonoma',
  'usuario.pais': 'pais',
  'usuario.password': 'password',
  'hermano.fechaNacimiento': 'fechaNacimiento',
  'titular.fechaNacimiento': 'fechaNacimiento',
  'titular.sexo': 'sexo',
  'titular.estadoCivil': 'estadoCivil',
  'titular.fechaBautismo': 'fechaBautismo',
  'titular.lugarBautismo': 'lugarBautismo',
  'titular.parroquiaBautismo': 'parroquiaBautismo',
  'pago.forma': 'formaPago',
  'pago.iban': 'iban',
  'pago.titularidad': 'titularidad',
  'pago.titularCuenta': 'titularCuenta',
  // Los documentos los rechaza el servidor por su nombre de campo.
  foto: 'foto',
  certificadoBautismo: 'certificadoBautismo',
}

export const VALORES_INICIALES: MembershipFormData = {
  camino: 'HERMANO', nombre: '', primerApellido: '', segundoApellido: '', email: '', password: '', dni: '', telefono: '',
  direccion: '', ciudad: '', codigoPostal: '', fechaNacimiento: '', menores: [], aceptarPolitica: false,
  sexo: '', estadoCivil: '', fechaBautismo: '', lugarBautismo: '', parroquiaBautismo: '',
  provincia: '', comunidadAutonoma: '', pais: 'España',
  formaPago: '', iban: '', titularidad: 'PROPIA', titularCuenta: '',
  foto: null, certificadoBautismo: null, boletin: false,
  comentarioAdicional: '',
}

