// La mezcla con los valores por defecto. Tres reglas que no son evidentes y
// que, mal hechas, fallan en silencio: los objetos se mezclan campo a campo,
// las listas se sustituyen enteras, y las teselas se casan por su clave.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mezclarConDefectos, porDefecto } from '../src/domain/contenido.js';

test('un campo que no está guardado sale del valor por defecto', () => {
  const mezclado = mezclarConDefectos('portada', { hero: { titulo: 'Otro título' } }) as any;

  assert.equal(mezclado.hero.titulo, 'Otro título');
  assert.equal(mezclado.hero.ceja, 'Grupo Parroquial · Málaga', 'lo no tocado conserva el texto de siempre');
  assert.equal(mezclado.publicaciones.boton, 'Archivo de publicaciones', 'un bloque entero que falta, también');
});

test('una lista guardada sustituye a la de por defecto, no se mezcla con ella', () => {
  const mezclado = mezclarConDefectos('recorrido', { paradas: [{ hora: '18:00', lugar: 'Plaza nueva' }] }) as any;

  assert.equal(mezclado.paradas.length, 1, 'si se mezclaran, quedarían las nueve de por defecto');
  assert.deepEqual(mezclado.paradas[0], { hora: '18:00', lugar: 'Plaza nueva' });
});

test('borrar todas las paradas las deja borradas', () => {
  // Si la lista vacía se tratara como «no hay nada guardado», el CMS parecería
  // no guardar: se borran las nueve, se guarda, y vuelven las nueve.
  const mezclado = mezclarConDefectos('recorrido', { paradas: [] }) as any;

  assert.deepEqual(mezclado.paradas, []);
});

test('las teselas se casan por clave y no por posición', () => {
  // Solo se guarda la de contacto, que por defecto es la SEXTA. Por posición,
  // su texto acabaría en «Nuestra sede» y todas las demás correrían.
  const mezclado = mezclarConDefectos('portada', {
    accesos: { teselas: [{ clave: 'contacto', titulo: 'Escríbenos', descripcion: 'Te contestamos' }] },
  }) as any;

  const porClave = Object.fromEntries(mezclado.accesos.teselas.map((t: any) => [t.clave, t]));
  assert.equal(porClave.contacto.titulo, 'Escríbenos');
  assert.equal(porClave.sede.titulo, 'Nuestra sede', 'la que no se guardó conserva su texto');
  assert.equal(mezclado.accesos.teselas.length, 6, 'siguen siendo las seis, en su orden');
  assert.equal(mezclado.accesos.teselas[0].clave, 'sede', 'y en el orden del código, no en el del documento');
});

test('una tesela con una clave que el código no conoce se descarta', () => {
  const mezclado = mezclarConDefectos('portada', {
    accesos: { teselas: [{ clave: 'inventada', titulo: 'No existe', descripcion: 'x' }] },
  }) as any;

  assert.ok(!mezclado.accesos.teselas.some((t: any) => t.clave === 'inventada'));
  assert.equal(mezclado.accesos.teselas.length, 6);
});

test('lo guardado no puede alterar el objeto de por defecto', () => {
  // `porDefecto` devuelve el mismo objeto en cada llamada si no se copia, y una
  // mezcla que escriba encima lo dejaría contaminado para la siguiente petición.
  mezclarConDefectos('portada', { hero: { titulo: 'Contaminado' } });

  assert.equal((porDefecto('portada') as any).hero.titulo, 'Desamparados Málaga');
});

test('un documento que no es un objeto se ignora entero', () => {
  // Una fila corrupta o un null no pueden tumbar la portada.
  for (const basura of [null, 'texto', 42, []]) {
    const mezclado = mezclarConDefectos('portada', basura) as any;
    assert.equal(mezclado.hero.titulo, 'Desamparados Málaga');
  }
});

test('los hitos guardados sustituyen enteros a los de por defecto', () => {
  // Como las paradas: quitar hitos tiene que dejarlos quitados, no traer de
  // vuelta los cinco de por defecto.
  const hito = { periodo: '1954', etiqueta: 'Fundación', titulo: 'Se funda el grupo', relato: 'Texto.', foto: { url: '', alt: '', pie: '' }, tono: 'ninguno' };
  const mezclado = mezclarConDefectos('historia', { hitos: [hito] }) as any;

  assert.equal(mezclado.hitos.length, 1);
  assert.deepEqual(mezclado.hitos[0], hito);
  assert.equal(mezclado.titulo, 'Historia', 'lo no tocado conserva el texto de siempre');
});
