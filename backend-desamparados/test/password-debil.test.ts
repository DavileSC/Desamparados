import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { motivoContrasenaDebil, esContrasenaAceptable, LONGITUD_MINIMA } from '../src/domain/password-debil.js';
import { password } from '../src/config/common.js';

describe('rechazo de contraseñas débiles', () => {
  test('acepta contraseñas largas y sin patrón evidente', () => {
    for (const valida of [
      'trono de plata 1897',
      'MiFraseLargaYPersonal',
      'ceraYazahar-Marzo',
      'k7Rm2xPq9wLt',
    ]) {
      assert.equal(esContrasenaAceptable(valida), true, `debería aceptar "${valida}"`);
    }
  });

  test('rechaza por debajo de la longitud mínima', () => {
    assert.match(motivoContrasenaDebil('Abc12345', 'el Grupo Parroquial') ?? '', /al menos 12/);
    assert.equal(esContrasenaAceptable('a'.repeat(LONGITUD_MINIMA - 1)), false);
  });

  test('rechaza el relleno con un solo carácter', () => {
    assert.match(motivoContrasenaDebil('aaaaaaaaaaaaaa', 'el Grupo Parroquial') ?? '', /mismo carácter repetido/);
  });

  test('rechaza secuencias seguidas', () => {
    assert.match(motivoContrasenaDebil('123456789012', 'el Grupo Parroquial') ?? '', /secuencia/);
    assert.match(motivoContrasenaDebil('abcdefghijkl', 'el Grupo Parroquial') ?? '', /secuencia/);
    assert.match(motivoContrasenaDebil('987654321098', 'el Grupo Parroquial') ?? '', /secuencia/);
  });

  test('rechaza las palabras que un atacante prueba primero', () => {
    for (const debil of ['passwordpassword', 'contrasena123', 'administrador1', 'qwertyqwerty']) {
      assert.equal(esContrasenaAceptable(debil), false, `debería rechazar "${debil}"`);
    }
  });

  test('rechaza las palabras propias del proyecto', () => {
    // Las primeras que probaría alguien que conozca el Grupo Parroquial.
    for (const debil of ['desamparados1', 'Desamparados2026', 'semanasanta26', 'MalagaMalaga']) {
      assert.equal(esContrasenaAceptable(debil), false, `debería rechazar "${debil}"`);
    }
  });

  test('rechaza las palabras cofrades obvias, también con una secuencia detrás', () => {
    // «nazareno12345» se aceptaba: la palabra no estaba en la lista y, aunque
    // lo estuviera, los cinco caracteres que sobran bastaban. Una secuencia
    // pegada a la palabra no es una frase: sigue siendo la palabra.
    for (const debil of ['nazareno12345', 'Nazareno2026', 'cofrade123456', 'hermano-12345', 'procesion1234', 'Procesión2026', 'costalero2026', 'penitente2026', 'desamparados-abcde']) {
      assert.equal(esContrasenaAceptable(debil), false, `debería rechazar "${debil}"`);
    }
  });

  test('una palabra cofrade dentro de algo más largo sigue valiendo', () => {
    // Es la de desarrollo de la siembra: tiene que seguir cumpliendo.
    assert.equal(esContrasenaAceptable('Nazareno-Local-2026'), true);
    assert.equal(esContrasenaAceptable('el nazareno de la calle Carretería'), true);
  });

  test('los disfraces habituales no burlan la lista', () => {
    // P4ssw0rd es password con las sustituciones de toda la vida.
    assert.equal(esContrasenaAceptable('P4ssw0rdP4ss'), false);
    assert.equal(esContrasenaAceptable('D3s4mp4r4d0s'), false);
    assert.equal(esContrasenaAceptable('Contraseña123'), false);
  });

  test('una palabra prohibida con suficiente texto alrededor sí vale', () => {
    // El objetivo es descartar la palabra *como* contraseña, no prohibir que
    // aparezca dentro de una frase larga de verdad.
    assert.equal(esContrasenaAceptable('malaga huele a azahar en marzo'), true);
  });

  test('el motivo explica qué corregir, no dice solo "no válida"', () => {
    const motivo = motivoContrasenaDebil('corta', 'el Grupo Parroquial');
    assert.ok(motivo && motivo.length > 10);
    assert.ok(!/no válida/i.test(motivo));
  });

  test('el validador de arktype aplica estas reglas', () => {
    // Comprueba el cableado real: el esquema de registro usa este tipo.
    assert.equal(password('12345678') instanceof type.errors, true);
    assert.equal(password('trono de plata 1897'), 'trono de plata 1897');
  });
});

// Importado abajo para no romper el orden de lectura de las pruebas.
import { type } from 'arktype';
