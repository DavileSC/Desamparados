// Un enlace escrito en el CMS (tarjetas, botón de una llamada) tiene que llevar
// a una página que exista. Antes bastaba con empezar por «/», y una tarjeta con
// «/hola» se guardaba y llevaba a «página no encontrada».

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ArkErrors } from 'arktype';
import defectos from '../../shared/contenido-por-defecto.json' with { type: 'json' };
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RUTAS_DESTINO, esDestinoValido, moduloDeDestino } from '../src/domain/destinos.js';
import { esquemaDeBloque } from '../src/schemas/bloques.schema.js';

const tarjetas = (enlace: string) => ({ tipo: 'tarjetas', titulo: '', tarjetas: [{ titulo: 'Una', descripcion: '', enlace }] });
const llamada = (enlace: string) => ({ tipo: 'llamada', titulo: '', texto: '', boton: 'Ir', enlace });
const valida = (bloque: { tipo: string }) => !(esquemaDeBloque(bloque.tipo as never)(bloque) instanceof ArkErrors);

describe('destinos de los enlaces', () => {
  test('todas las páginas del catálogo y las demás rutas declaradas valen', () => {
    assert.ok(RUTAS_DESTINO.size >= 25);
    for (const ruta of RUTAS_DESTINO) assert.ok(esDestinoValido(ruta), ruta);
  });

  test('una ruta que no existe no vale, aunque parezca del sitio', () => {
    assert.equal(esDestinoValido('/hola'), false);
    assert.equal(esDestinoValido('/historia/'), false);
    assert.equal(esDestinoValido('/noticias'), true);
  });

  test('una noticia vale por su slug, con el formato que genera el servidor', () => {
    assert.ok(esDestinoValido('/noticias/apertura-del-curso-2026'));
    assert.equal(esDestinoValido('/noticias/Apertura'), false);
    assert.equal(esDestinoValido('/noticias/a/b'), false);
    assert.equal(esDestinoValido('/noticias/-a'), false);
  });

  test('una dirección antigua que redirige se acepta, pero no es un destino que ofrecer', () => {
    // /parroquia-pasionistas pasó a /parroquia (12-10-2026): las páginas que
    // la llevan guardada tienen que poder volver a guardarse.
    assert.ok(esDestinoValido('/parroquia-pasionistas'));
    assert.ok(esDestinoValido('/parroquia-pasionistas#como-llegar'));
    assert.ok(!RUTAS_DESTINO.has('/parroquia-pasionistas'));
    assert.ok(RUTAS_DESTINO.has('/parroquia'));
  });

  test('nada de fuera del sitio', () => {
    for (const enlace of ['https://otro.test', '//otro.test', 'javascript:alert(1)', 'corporacion']) {
      assert.equal(esDestinoValido(enlace), false, enlace);
    }
  });

  test('la tarjeta y la llamada lo aplican; la tarjeta sigue pudiendo ir sin enlace', () => {
    assert.ok(valida(tarjetas('/historia')));
    assert.ok(valida(tarjetas('')));
    assert.ok(!valida(tarjetas('/hola')));
    assert.ok(valida(llamada('/hazte-hermano')));
    assert.ok(!valida(llamada('/hermanos/hazteme')));
    assert.ok(!valida(llamada('')));
  });

  test('los enlaces del contenido de partida llevan todos a páginas que existen', () => {
    const enlaces: string[] = [];
    const recorrer = (valor: unknown, dentroDeBloques: boolean) => {
      if (Array.isArray(valor)) valor.forEach((v) => recorrer(v, dentroDeBloques));
      else if (valor && typeof valor === 'object') {
        for (const [clave, v] of Object.entries(valor)) {
          if (dentroDeBloques && clave === 'enlace' && typeof v === 'string' && v !== '') enlaces.push(v);
          recorrer(v, dentroDeBloques || clave === 'bloques');
        }
      }
    };
    recorrer(defectos, false);
    assert.ok(enlaces.length >= 7);
    for (const enlace of enlaces) assert.ok(esDestinoValido(enlace), enlace);
  });

  // WP2: agenda, noticias, publicaciones y hazte hermano no decían su módulo
  // en el catálogo, y con él apagado el CMS los seguía ofreciendo y la API
  // servía su contenido. Cada destino dice el mismo que exige su ruta en la
  // web (routes/index.tsx, leído como texto como en modulos-cobertura).
  test('cada destino fijo es del mismo módulo que su ruta en la web', () => {
    const rutas = new Map<string, string>();
    const fichero = fileURLToPath(new URL('../../desamparados-web/src/routes/index.tsx', import.meta.url));
    for (const linea of readFileSync(fichero, 'utf8').split(/\r?\n/)) {
      const ruta = /\bpath:\s*'([^']*)'/.exec(linea);
      const modulo = /\bpagina\(\w+,\s*'([a-z0-9-]+)'\)/.exec(linea);
      // La primera: las públicas van antes que las del CMS (que repiten «noticias»).
      const clave = ruta?.[1].replace(/^\//, '');
      if (clave !== undefined && modulo && !rutas.has(clave)) rutas.set(clave, modulo[1]);
    }
    const fallos: string[] = [];
    let comprobados = 0;
    for (const ruta of RUTAS_DESTINO) {
      const enLaWeb = rutas.get(ruta.replace(/^\//, ''));
      if (enLaWeb === undefined) continue; // la portada y /acceso no van en una sola línea
      comprobados++;
      const declarado = moduloDeDestino(ruta) ?? 'nucleo';
      if (declarado !== enLaWeb) fallos.push(`${ruta}: el catálogo dice «${declarado}» y la web exige «${enLaWeb}»`);
    }
    assert.deepEqual(fallos, [], fallos.join('\n'));
    assert.ok(comprobados >= 20, `solo se comprobaron ${comprobados}`);
    assert.equal(moduloDeDestino('/agenda'), 'agenda');
    assert.equal(moduloDeDestino('/hazte-hermano'), 'alta-web');
  });
});
