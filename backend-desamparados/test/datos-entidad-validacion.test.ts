// El fichero de cada instalación (instalacion/datos-entidad.json) se valida al
// arrancar la API, al compilar la web y al levantar su contenedor: un dato mal
// puesto no arranca y dice cuál, en vez de dejar frases rotas en producción.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { validarDatosEntidad } from '../../shared/datos-entidad.mjs';

const EJEMPLO = JSON.parse(readFileSync(new URL('../../shared/datos-entidad.ejemplo.json', import.meta.url), 'utf8'));
const copia = () => structuredClone(EJEMPLO);

test('el ejemplo pasa, y los opcionales que faltan salen a null', () => {
  const sinOpcionales = copia();
  delete sinOpcionales.marca;
  delete sinOpcionales.redes;
  delete sinOpcionales.privacidad;
  delete sinOpcionales.identidad.domicilio;
  const { datos, errores } = validarDatosEntidad(sinOpcionales);
  assert.deepEqual(errores, []);
  assert.equal(datos?.identidad.domicilio, null);
  assert.equal(datos?.redes.instagram, null);
  assert.deepEqual(datos?.marca, { colorPrincipal: null, colorAcento: null });
});

test('dice todos los fallos de una vez, con su ruta', () => {
  const mal = copia();
  mal.identidad.articulo = 'El';
  mal.identidad.dominio = 'https://corporacion.example/';
  mal.identidad.nombre = '  ';
  mal.secretaria.email = 'secretaria-sin-arroba';
  const { errores } = validarDatosEntidad(mal);
  assert.equal(errores.length, 4, errores.join('\n'));
  assert.ok(errores.some((e) => e.startsWith('identidad.articulo:') && e.includes('«El»')));
  assert.ok(errores.some((e) => e.startsWith('identidad.dominio:')));
  assert.ok(errores.some((e) => e.startsWith('identidad.nombre:')));
  assert.ok(errores.some((e) => e.startsWith('secretaria.email:')));
});

test('una clave desconocida es un error: casi siempre es una errata', () => {
  const mal = copia();
  mal.identidad.artículo = 'la';
  mal.secretarias = {};
  const { errores } = validarDatosEntidad(mal);
  assert.ok(errores.some((e) => e.startsWith('identidad.artículo:')));
  assert.ok(errores.some((e) => e.startsWith('secretarias:')));
});

test('las redes y los colores tienen su forma', () => {
  const mal = copia();
  mal.redes.instagram = 'instagram.com/corporacion';
  mal.marca.colorPrincipal = 'granate';
  const { errores } = validarDatosEntidad(mal);
  assert.ok(errores.some((e) => e.startsWith('redes.instagram:')));
  assert.ok(errores.some((e) => e.startsWith('marca.colorPrincipal:')));
});

test('escudoUrl y un módulo que ya no existe avisan sin impedir arrancar', () => {
  const viejo = copia();
  viejo.escudoUrl = null;
  viejo.modulos.activos = [...viejo.modulos.activos, 'modulo-retirado'];
  const { errores, avisos } = validarDatosEntidad(viejo);
  assert.deepEqual(errores, []);
  assert.ok(avisos.some((a) => a.startsWith('escudoUrl') && a.includes('instalacion/marca/escudo-sobre-oscuro.png') && a.includes('«La marca»')));
  assert.ok(avisos.some((a) => a.includes('modulo-retirado')));
});

test('los colores de la marca se guardan en minúsculas, y uno sin contraste avisa con la cifra sin impedir arrancar', () => {
  const datos = copia();
  datos.marca.colorPrincipal = '#E8A0A0';
  datos.marca.colorAcento = '#1F4E79';
  const { datos: leidos, errores, avisos } = validarDatosEntidad(datos);
  assert.deepEqual(errores, []);
  assert.deepEqual(leidos?.marca, { colorPrincipal: '#e8a0a0', colorAcento: '#1f4e79' });
  assert.ok(avisos.some((a) => a.startsWith('marca.colorPrincipal #e8a0a0: con letra blanca da 2,1:1 (AA pide 4,5:1); los botones usarán #')), avisos.join('\n'));
  assert.ok(avisos.some((a) => a.startsWith('marca.colorAcento #1f4e79:')), avisos.join('\n'));
});

test('con los colores de partida o null, la marca no avisa de nada', () => {
  for (const marca of [{ colorPrincipal: null, colorAcento: null }, { colorPrincipal: '#6e1822', colorAcento: '#dec72b' }]) {
    const datos = copia();
    datos.marca = { ...marca };
    const { errores, avisos } = validarDatosEntidad(datos);
    assert.deepEqual(errores, []);
    assert.deepEqual(avisos.filter((a) => a.startsWith('marca')), []);
  }
});
