// Fecha, hora y acceso que se imprimen en la papeleta, leídos de la fila de la
// salida y sin base de datos. Lo delicado: reimprimir una papeleta de un año
// ya pasado tiene que decir el día de ese año, no el de la salida que se prepara.

import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import type { Evento } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { leerDatosEvento } from '../src/services/recibos/comunes.js';
import type { SalidaConActo } from '../src/services/procesion/salidas.service.js';

const pasion: SalidaConActo = {
  id: 1, slug: 'sabado-de-pasion', nombre: 'Sábado de Pasión', orden: 1, activa: true, conRopa: true,
  cobro: 'CUOTA', importeCuota: new Prisma.Decimal(0), fecha: 'PASCUA', diasDesdePascua: -8,
  horaSalida: '19:30h', lugar: 'Casa parroquial', eventoId: null, acto: null,
  plazoAbierto: false, plazoCambiadoEl: null, puestos: [], cortejo: null, indicaciones: null,
};

afterEach(() => mock.timers.reset());

test('la papeleta de 2026 consultada en 2027 lleva el día de 2026', () => {
  // Mayo de 2027: la Pasión de 2027 ya pasó y se prepara la de 2028.
  mock.timers.enable({ apis: ['Date'], now: new Date('2027-05-01T10:00:00Z') });
  // Pascua de 2026, el 5 de abril: el Sábado de Pasión, el 28 de marzo.
  assert.equal(leerDatosEvento(pasion, 2026).fechaSalida, 'sábado, 28 de marzo');
  // Sin año, el de la salida que se prepara (2028: Pascua el 16 de abril).
  assert.equal(leerDatosEvento(pasion).fechaSalida, 'sábado, 8 de abril');
  assert.equal(leerDatosEvento(pasion, 2026).horaSalida, '19:30h');
  assert.equal(leerDatosEvento(pasion, 2026).accesoPuerta, 'Casa parroquial');
});

test('con fecha a mano manda el acto enlazado, si es del año que se pide', () => {
  const acto = { id: 7, startDate: new Date('2026-10-17T16:30:00Z'), location: 'Parroquia' } as Evento;
  const rosario: SalidaConActo = { ...pasion, slug: 'rosario-vespertino', nombre: 'Rosario vespertino', fecha: 'MANUAL', diasDesdePascua: null, eventoId: 7, acto };
  assert.deepEqual(leerDatosEvento(rosario, 2026), { fechaSalida: 'sábado, 17 de octubre', horaSalida: '18:30h', accesoPuerta: 'Parroquia' });
  assert.deepEqual(leerDatosEvento({ ...rosario, acto: null, eventoId: null }), { fechaSalida: 'Por anunciar', horaSalida: 'Por anunciar', accesoPuerta: 'Consultar en secretaría' });
});

test('una papeleta de otro año que el del acto enlazado dice «Por anunciar»', () => {
  // La salida ya está enlazada al acto de 2099; la papeleta es de 2098: el
  // día de 2099 no es el suyo, y el de 2098 ya no está en la fila.
  const acto = { id: 8, startDate: new Date('2099-10-17T16:30:00Z'), location: 'Parroquia' } as Evento;
  const rosario: SalidaConActo = { ...pasion, slug: 'rosario-vespertino', nombre: 'Rosario vespertino', fecha: 'MANUAL', diasDesdePascua: null, eventoId: 8, acto };
  assert.deepEqual(leerDatosEvento(rosario, 2098), { fechaSalida: 'Por anunciar', horaSalida: 'Por anunciar', accesoPuerta: 'Consultar en secretaría' });
  assert.equal(leerDatosEvento(rosario, 2099).fechaSalida, 'sábado, 17 de octubre');
  assert.equal(leerDatosEvento(rosario).fechaSalida, 'sábado, 17 de octubre');
});

test('la hora de las salidas por la Pascua se imprime como la de las salidas a mano', () => {
  // El campo de hora del CMS guarda «19:30»; el acto de la Agenda sale «19:30h».
  assert.equal(leerDatosEvento({ ...pasion, horaSalida: '19:30' }, 2026).horaSalida, '19:30h');
  assert.equal(leerDatosEvento({ ...pasion, horaSalida: '19:30h' }, 2026).horaSalida, '19:30h');
  // Un texto libre que no es una hora se queda como está.
  assert.equal(leerDatosEvento({ ...pasion, horaSalida: 'Tras la misa' }, 2026).horaSalida, 'Tras la misa');
});
