// Los colores de la marca (shared/colores-de-marca.mjs): con la marca de
// partida, la paleta es la de hoy al hex (cerrojo: Desamparados no cambia ni un
// píxel); con cualquier otro color, cada papel cumple su suelo de contraste.
// Sin base de datos.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  PAPELES_DE_IMPRENTA, PAPELES_DE_MARCA, PARTIDA, alfa, aOklch, avisosDeMarca, componentes, contraste,
  cifraDeContraste, desdeOklch, paletaDeImprenta, paletaDeMarca, type Papel,
} from '../../shared/colores-de-marca.mjs';

const HEX = /^#[0-9a-f]{6}$/;

/**
 * Los colores con los que se prueba: azul, verde y morado de corporación, los
 * extremos, un gris sin tono, un amarillo y un cian chillones y un rosa que no
 * aguanta letra blanca.
 */
const BATERIA = ['#1f4e79', '#0b6e4f', '#5b2a86', '#000000', '#ffffff', '#808080', '#ffd400', '#00c8ff', '#e8a0a0'];

/** Cada papel de la tabla, con el valor que le ha tocado, contra cada uno de sus suelos. */
function incumplidos(tabla: Readonly<Record<string, Papel>>, paleta: Readonly<Record<string, string>>): string[] {
  const fallos: string[] = [];
  for (const [nombre, papel] of Object.entries(tabla)) {
    const color = paleta[nombre];
    if (!HEX.test(color ?? '')) { fallos.push(`${nombre}: «${color}» no es un hex`); continue; }
    for (const [fondo, minimo] of papel.suelos ?? []) {
      const sobre = paleta[fondo] ?? fondo;
      const c = contraste(color, sobre);
      if (c < minimo) fallos.push(`${nombre} ${color} sobre ${sobre}: ${c.toFixed(2)} < ${minimo}`);
    }
  }
  return fallos;
}

test('el contraste es el de WCAG: los extremos y las cifras de las notas (§11)', () => {
  assert.equal(contraste('#ffffff', '#000000'), 21);
  assert.equal(contraste('#6e1822', '#6e1822'), 1);
  assert.equal(cifraDeContraste(contraste('#c1ac00', '#262326')), '6,7');
  assert.equal(cifraDeContraste(contraste('#ffffff', '#a03d44')), '6,4');
  // Truncado: un 4,47 no se escribe «4,5».
  assert.equal(cifraDeContraste(4.47), '4,4');
});

test('OKLCH va y vuelve sin perder el color', () => {
  for (const hex of [...BATERIA, PARTIDA.colorPrincipal, PARTIDA.colorAcento, '#fc858a']) {
    assert.equal(desdeOklch(aOklch(hex)), hex);
  }
});

test('alfa y componentes escriben los rgba de antes', () => {
  assert.equal(alfa('#6e1822', 0.07), 'rgba(110, 24, 34, 0.07)');
  assert.equal(componentes('#dec72b'), '222, 199, 43');
});

test('con null, sin marca o con los colores de partida, cada papel es el hex de hoy', () => {
  const deHoy = (tabla: Readonly<Record<string, Papel>>) => Object.fromEntries(Object.entries(tabla).map(([n, p]) => [n, p.partida]));
  for (const marca of [null, undefined, {}, { colorPrincipal: null, colorAcento: null }, { ...PARTIDA }, { colorPrincipal: '#6E1822', colorAcento: '#DEC72B' }]) {
    assert.deepEqual({ ...paletaDeMarca(marca) }, deHoy(PAPELES_DE_MARCA));
    assert.deepEqual({ ...paletaDeImprenta(marca) }, deHoy(PAPELES_DE_IMPRENTA));
    assert.deepEqual(avisosDeMarca(marca), []);
  }
  // Los de hoy, escritos aquí otra vez: si alguien cambia la tabla, cambia el aspecto de Desamparados.
  assert.equal(paletaDeMarca(null).principal, '#6e1822');
  assert.equal(paletaDeMarca(null).principalMedio, '#a03d44');
  assert.equal(paletaDeMarca(null).acento, '#dec72b');
  assert.equal(paletaDeMarca(null).acentoMedio, '#c1ac00');
  assert.equal(paletaDeImprenta(null).burdeos, '#5c1622');
  assert.equal(paletaDeImprenta(null).oroTexto, '#8a6a30');
  assert.equal(paletaDeImprenta(null).acentoCorreo, '#6e1a20');
});

test('la paleta de partida ya cumple sus propios suelos', () => {
  assert.deepEqual(incumplidos(PAPELES_DE_MARCA, paletaDeMarca(null)), []);
  assert.deepEqual(incumplidos(PAPELES_DE_IMPRENTA, paletaDeImprenta(null)), []);
});

test('con cualquier color de la batería, todos los papeles cumplen su suelo y son hex', () => {
  for (const color of BATERIA) {
    for (const marca of [{ colorPrincipal: color, colorAcento: null }, { colorPrincipal: null, colorAcento: color }, { colorPrincipal: color, colorAcento: color }]) {
      const donde = JSON.stringify(marca);
      assert.deepEqual(incumplidos(PAPELES_DE_MARCA, paletaDeMarca(marca)), [], donde);
      assert.deepEqual(incumplidos(PAPELES_DE_IMPRENTA, paletaDeImprenta(marca)), [], donde);
    }
  }
});

test('un color que cumple se usa tal cual, y una familia no toca a la otra', () => {
  const paleta = paletaDeMarca({ colorPrincipal: '#1f4e79', colorAcento: null });
  assert.equal(paleta.principal, '#1f4e79');
  assert.equal(paleta.acento, PARTIDA.colorAcento);
  assert.equal(paleta.acentoApagado, '#c4af79');
  // El hover sigue siendo más oscuro que el botón, y el realce más claro.
  assert.ok(aOklch(paleta.principalHover).l < aOklch(paleta.principal).l);
  assert.ok(aOklch(paleta.principalRealce).l > aOklch(paleta.principal).l);
  // Y cada papel conserva el tono del color dado (un azul da azules).
  const tono = aOklch('#1f4e79').h;
  for (const papel of ['principalMedio', 'principalClaro', 'principalPalido'] as const) {
    assert.ok(Math.abs(aOklch(paleta[papel]).h - tono) < 6, `${papel} ${paleta[papel]}`);
  }
});

test('un principal que no aguanta letra blanca se oscurece, con aviso y la cifra', () => {
  const paleta = paletaDeMarca({ colorPrincipal: '#e8a0a0', colorAcento: null });
  assert.notEqual(paleta.principal, '#e8a0a0');
  assert.ok(contraste(paleta.principal, '#ffffff') >= 4.5);
  // Con el oro de partida, además, casi no se distingue: ese es el segundo aviso.
  const avisos = avisosDeMarca({ colorPrincipal: '#e8a0a0', colorAcento: null });
  assert.equal(avisos.length, 2, avisos.join('\n'));
  assert.ok(avisos[1].includes('casi no se distinguen'), avisos[1]);
  assert.ok(avisos[0].startsWith('marca.colorPrincipal #e8a0a0: con letra blanca da 2,1:1 (AA pide 4,5:1)'), avisos[0]);
  assert.ok(avisos[0].includes(`usarán ${paleta.principal}`));
});

test('el aviso del principal nombra el fondo que de verdad falla', () => {
  // #6f6f6f aguanta la letra blanca (5,0:1) pero no el lienzo del CMS claro.
  assert.ok(contraste('#6f6f6f', '#ffffff') >= 4.5);
  const [aviso] = avisosDeMarca({ colorPrincipal: '#6f6f6f', colorAcento: null });
  assert.ok(aviso.startsWith('marca.colorPrincipal #6f6f6f: sobre el lienzo del CMS claro (#f4f2ee) da 4,4:1 (AA pide 4,5:1)'), aviso);
  assert.doesNotMatch(aviso, /letra blanca/);
});

test('un principal casi gris da una paleta gris, sin tinte', () => {
  const gris = (hex: string) => hex.slice(1, 3) === hex.slice(3, 5) && hex.slice(3, 5) === hex.slice(5, 7);
  for (const color of ['#6f6f6f', '#808080', '#706e6e']) {
    const paleta = paletaDeMarca({ colorPrincipal: color, colorAcento: null });
    // `principal` no entra: si cumple se usa tal cual, gris o no (#706e6e lo hace).
    for (const papel of ['principalHover', 'principalMedio', 'principalClaro', 'principalPalido', 'principalGrafica'] as const) {
      assert.ok(gris(paleta[papel]), `${color} → ${papel} ${paleta[papel]}`);
    }
  }
  // Y el principal corregido de un gris que no cumple, también gris: antes, #6f6e6e.
  assert.equal(paletaDeMarca({ colorPrincipal: '#6f6f6f', colorAcento: null }).principal, '#6e6e6e');
  // Un gris cálido elegido a propósito conserva su tono.
  assert.ok(!gris(paletaDeMarca({ colorPrincipal: '#7a756e', colorAcento: null }).principalMedio));
});

test('un acento que no se lee sobre el fondo oscuro se aclara, con aviso', () => {
  const avisos = avisosDeMarca({ colorPrincipal: null, colorAcento: '#1f4e79' });
  assert.equal(avisos.length, 1, avisos.join('\n'));
  assert.ok(avisos[0].startsWith('marca.colorAcento #1f4e79:'), avisos[0]);
  assert.ok(avisos[0].includes(paletaDeMarca({ colorAcento: '#1f4e79' }).acento));
});

test('dos colores casi iguales avisan', () => {
  const avisos = avisosDeMarca({ colorPrincipal: '#1f4e79', colorAcento: '#204f7a' });
  assert.ok(avisos.some((a) => a.startsWith('marca: colorPrincipal #1f4e79 y colorAcento #204f7a casi no se distinguen')), avisos.join('\n'));
  assert.ok(!avisosDeMarca({ colorPrincipal: '#1f4e79', colorAcento: '#c0c0c0' }).some((a) => a.includes('casi no se distinguen')));
});

test('se puede importar en el navegador: no usa nada de Node', () => {
  const fuente = readFileSync(new URL('../../shared/colores-de-marca.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(fuente, /from\s+['"]node:|require\(|process\./);
});
