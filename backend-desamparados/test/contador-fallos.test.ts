import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import db from '../src/config/db.js';
import { ContadorFallos, RegistroReciente } from '../src/utils/contador-fallos.js';
import { SIN_DB } from './fixtures/sin-db.js';

const MINUTO = 60_000;

// Cada contador de prueba lleva su propio nombre, que no choca con los de la
// web ni con otra ejecución, y se borra al acabar.
const PREFIJO = `prueba-${process.pid}-${Date.now()}-`.slice(0, 32);
let creados = 0;
let dbDisponible = false;

before(async () => {
  try { await db.$queryRaw`SELECT 1`; dbDisponible = true; } catch { dbDisponible = false; }
});

after(async () => {
  if (!dbDisponible) return;
  await db.falloDeAcceso.deleteMany({ where: { contador: { startsWith: PREFIJO } } });
  await db.redConfiada.deleteMany({ where: { clave: { startsWith: PREFIJO } } });
  await db.$disconnect();
});

/** Contador con reloj de mentira: los tests avanzan el tiempo a mano. */
function contador(opciones: Partial<ConstructorParameters<typeof ContadorFallos>[0]> = {}) {
  let ahora = Date.UTC(2026, 0, 1);
  creados += 1;
  const c = new ContadorFallos({
    nombre: `${PREFIJO}${creados}`,
    maxFallos: 3,
    bloqueoMs: 15 * MINUTO,
    ventanaMs: 60 * MINUTO,
    tope: 100,
    ahora: () => ahora,
    ...opciones
  });
  return { c, reloj: () => ahora, avanzar: (ms: number) => { ahora += ms; } };
}

const fallar = async (c: ContadorFallos, clave: string, veces: number) => {
  let bloqueo = 0;
  for (let i = 0; i < veces; i++) bloqueo = (await c.registrarFallo(clave)) || bloqueo;
  return bloqueo;
};

test('bloquea al llegar al máximo de fallos y solo a esa clave', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const { c } = contador();
  await fallar(c, 'a', 2);
  assert.equal(await c.restanteBloqueo('a'), 0, 'dos fallos de tres todavía no bloquean');
  await c.registrarFallo('a');
  assert.equal(await c.restanteBloqueo('a'), 15 * MINUTO);
  assert.equal(await c.restanteBloqueo('b'), 0, 'otra clave no se entera');
});

// Lo que se ganó al pasarlo a la base: antes un despliegue levantaba los bloqueos.
test('el bloqueo sigue en pie con otro contador del mismo nombre, como tras un reinicio', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const { c, reloj } = contador();
  await fallar(c, 'a', 3);
  const tras = new ContadorFallos({ nombre: `${PREFIJO}${creados}`, maxFallos: 3, bloqueoMs: 15 * MINUTO, ventanaMs: 60 * MINUTO, tope: 100, ahora: reloj });
  assert.equal(await tras.restanteBloqueo('a'), 15 * MINUTO);
});

test('dos contadores con distinto nombre no comparten claves', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const { c: uno } = contador();
  const { c: otro } = contador();
  await fallar(uno, '7', 3);
  assert.equal(await otro.restanteBloqueo('7'), 0);
});

test('fallos a la vez sobre la misma clave cuentan todos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const { c } = contador({ maxFallos: 6 });
  await Promise.all(Array.from({ length: 6 }, () => c.registrarFallo('a')));
  assert.equal(await c.restanteBloqueo('a'), 15 * MINUTO, 'seis fallos en paralelo bloquean como seis seguidos');
});

test('el bloqueo se levanta al pasar su plazo', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const { c, avanzar } = contador();
  await fallar(c, 'a', 3);
  avanzar(15 * MINUTO);
  assert.equal(await c.restanteBloqueo('a'), 0);
});

test('un fallo más viejo que la ventana ya no suma', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const { c, avanzar } = contador();
  await fallar(c, 'a', 2);
  avanzar(61 * MINUTO);
  await c.registrarFallo('a');
  assert.equal(await c.restanteBloqueo('a'), 0, 'los dos primeros caducaron: van uno, no tres');
});

test('limpiar borra la cuenta de fallos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const { c } = contador();
  await fallar(c, 'a', 2);
  await c.limpiar('a');
  await c.registrarFallo('a');
  assert.equal(await c.restanteBloqueo('a'), 0);
  assert.equal(await c.contar(), 1);
});

// El guion bajo es comodín en LIKE: con `startsWith` a secas, limpiar a
// «a_b@» se llevaba también los fallos de «axb@».
test('limpiarPrefijo solo borra las claves que empiezan exactamente así', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const { c } = contador();
  await fallar(c, 'a_b@ejemplo.test|1.2.3.4', 3);
  await fallar(c, 'a_b@ejemplo.test|5.6.7.8', 3);
  await fallar(c, 'axb@ejemplo.test|1.2.3.4', 3);
  await c.limpiarPrefijo('a_b@ejemplo.test|');
  assert.equal(await c.restanteBloqueo('a_b@ejemplo.test|1.2.3.4'), 0);
  assert.equal(await c.restanteBloqueo('a_b@ejemplo.test|5.6.7.8'), 0);
  assert.ok(await c.restanteBloqueo('axb@ejemplo.test|1.2.3.4') > 0, 'la otra cuenta sigue bloqueada');
});

test('una clave más larga que la columna cuenta igual', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const { c } = contador();
  const larga = `${'x'.repeat(400)}@ejemplo.test`;
  await fallar(c, larga, 3);
  assert.equal(await c.restanteBloqueo(larga), 15 * MINUTO);
});

// El fallo de antes: cada email inventado dejaba una entrada para siempre.
test('las entradas caducadas se barren', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const { c, avanzar } = contador();
  for (let i = 0; i < 20; i++) await c.registrarFallo(`email-${i}`);
  avanzar(61 * MINUTO);
  await c.barrer();
  assert.equal(await c.contar(), 0);
});

// Si el tope se llevara por delante un bloqueo vivo, inundar la tabla de
// emails inventados serviría para desbloquear la cuenta atacada.
test('al barrer, el tope recorta lo más antiguo y conserva los bloqueos vivos', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const { c, avanzar } = contador({ tope: 10 });
  await fallar(c, 'cargo@ejemplo.test', 3);
  for (let i = 0; i < 30; i++) {
    avanzar(1);
    await c.registrarFallo(`inventado-${i}`);
  }
  await c.barrer();
  assert.equal(await c.contar(), 10);
  assert.ok(await c.restanteBloqueo('cargo@ejemplo.test') > 0, 'el bloqueo del cargo no puede desaparecer por la ráfaga');
  assert.equal(await c.restanteBloqueo('inventado-29'), 0);
  const quedan = await db.falloDeAcceso.findMany({ where: { contador: `${PREFIJO}${creados}` }, select: { clave: true } });
  assert.ok(quedan.some((f) => f.clave === 'inventado-29'), 'se conserva lo más reciente');
});

// Las redes desde las que cada cuenta ha entrado bien: el bloqueo global por
// email no se aplica a ellas.
test('el registro de redes confiadas caduca con su vigencia y se barre', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  let ahora = Date.UTC(2026, 0, 1);
  const r = new RegistroReciente({ vigenciaMs: 30 * MINUTO, ahora: () => ahora });
  await r.apuntar(`${PREFIJO}cuenta|red`);
  await r.apuntar(`${PREFIJO}cuenta|red`);
  assert.equal(await r.tiene(`${PREFIJO}cuenta|red`), true);
  assert.equal(await r.tiene(`${PREFIJO}cuenta|otra`), false);
  ahora += 31 * MINUTO;
  assert.equal(await r.tiene(`${PREFIJO}cuenta|red`), false);
  await r.barrer();
  assert.equal(await db.redConfiada.count({ where: { clave: `${PREFIJO}cuenta|red` } }), 0);
});

// El 2FA tenía un bloqueo fijo: quien conocía la contraseña de un cargo
// probaba cinco códigos cada quince minutos sin fin.
test('bloqueo creciente: cada tanda dura más, hasta la última, que se repite', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const { c, avanzar } = contador({ escaladaMs: [15 * MINUTO, 60 * MINUTO, 240 * MINUTO], olvidoTandasMs: 24 * 60 * MINUTO });
  assert.equal(await fallar(c, 'a', 3), 15 * MINUTO, 'la primera, 15 minutos');
  assert.equal(await c.restanteBloqueo('a'), 15 * MINUTO);
  avanzar(15 * MINUTO);
  assert.equal(await fallar(c, 'a', 3), 60 * MINUTO, 'la segunda, una hora');
  avanzar(60 * MINUTO);
  assert.equal(await fallar(c, 'a', 3), 240 * MINUTO);
  avanzar(240 * MINUTO);
  assert.equal(await fallar(c, 'a', 3), 240 * MINUTO, 'de la última en adelante se repite');
});

test('registrarFallo dice cuándo empieza un bloqueo, una vez por tanda', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const { c } = contador({ escaladaMs: [15 * MINUTO, 60 * MINUTO] });
  assert.equal(await c.registrarFallo('a'), 0);
  assert.equal(await c.registrarFallo('a'), 0);
  assert.equal(await c.registrarFallo('a'), 15 * MINUTO);
});

test('las tandas no se olvidan al pasar la ventana, sino tras un día sin fallar o con un acierto', async (t) => {
  if (!dbDisponible) return t.skip(SIN_DB);
  const { c, avanzar } = contador({ escaladaMs: [15 * MINUTO, 60 * MINUTO], olvidoTandasMs: 24 * 60 * MINUTO });
  await fallar(c, 'a', 3);
  // Esperar más que la ventana (una hora) tras el bloqueo no devuelve a 15 min.
  avanzar(15 * MINUTO + 2 * 60 * MINUTO);
  await fallar(c, 'a', 3);
  assert.equal(await c.restanteBloqueo('a'), 60 * MINUTO);

  // Un día entero sin fallar después del bloqueo: vuelve a la primera tanda.
  avanzar(60 * MINUTO + 24 * 60 * MINUTO + 1);
  await fallar(c, 'a', 3);
  assert.equal(await c.restanteBloqueo('a'), 15 * MINUTO);

  // Un acierto lo deja a cero.
  avanzar(15 * MINUTO);
  await fallar(c, 'a', 3);
  assert.equal(await c.restanteBloqueo('a'), 60 * MINUTO);
  await c.limpiar('a');
  await fallar(c, 'a', 3);
  assert.equal(await c.restanteBloqueo('a'), 15 * MINUTO);
});
