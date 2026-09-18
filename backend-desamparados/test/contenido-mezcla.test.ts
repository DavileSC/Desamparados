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
  // Con el recorrido ya convertido a bloques, la lista que manda es `bloques`.
  const soloTexto = [{ tipo: 'texto', titulo: '', html: '<p>Solo esto</p>' }];
  const mezclado = mezclarConDefectos('recorrido', { bloques: soloTexto }) as any;

  assert.equal(mezclado.bloques.length, 1, 'si se mezclaran, quedarían también los de por defecto');
  assert.deepEqual(mezclado.bloques[0], soloTexto[0]);
});

test('borrar todos los bloques los deja borrados', () => {
  // Si la lista vacía se tratara como «no hay nada guardado», el CMS parecería
  // no guardar: se quitan todos los bloques, se guarda, y vuelven los de antes.
  const mezclado = mezclarConDefectos('recorrido', { bloques: [] }) as any;

  assert.deepEqual(mezclado.bloques, []);
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

test('los bloques guardados de la historia sustituyen enteros a los de por defecto', () => {
  // Como las paradas: si se mezclaran por posición, quitar hitos dejaría de
  // vuelta los cinco de por defecto.
  const hito = { periodo: '1954', etiqueta: 'Fundación', titulo: 'Se funda el grupo', relato: 'Texto.', foto: { url: '', alt: '', pie: '' }, tono: 'ninguno' };
  const bloques = [{ tipo: 'cronologia', titulo: '', hitos: [hito] }];
  const mezclado = mezclarConDefectos('historia', { bloques }) as any;

  assert.deepEqual(mezclado.bloques, bloques);
  assert.equal(mezclado.cabecera.titulo, 'Historia', 'lo no tocado conserva el texto de siempre');
  assert.equal(mezclado.cabecera.ceja, 'Corporación · Historia', 'y la ceja, que solo tiene Historia, también');
});

test('una ceja guardada en una página que no la lleva se descarta', () => {
  const mezclado = mezclarConDefectos('cultos', { cabecera: { ceja: 'Colada' } }) as any;
  assert.ok(!('ceja' in mezclado.cabecera));
});
