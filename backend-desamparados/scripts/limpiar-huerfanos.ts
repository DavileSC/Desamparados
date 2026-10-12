/**
 * Lista (y con --borrar, borra) los ficheros de storage/public que no menciona
 * ningún registro: fotos y PDF subidos desde el CMS que se quitaron o se
 * sustituyeron antes de que el backend los borrase solo, o que se subieron y
 * nunca llegaron a guardarse (se eligió una foto y se cerró el formulario).
 * Y lo mismo en storage/private con los documentos del alta (foto y
 * certificado de bautismo) que ya no menciona ninguna ficha.
 *
 *   npx tsx scripts/limpiar-huerfanos.ts            → solo lista
 *   npx tsx scripts/limpiar-huerfanos.ts --borrar   → lista y borra
 *   npx tsx scripts/limpiar-huerfanos.ts --horas=48 → deja en paz lo de las últimas 48 h (24 por defecto)
 *
 * Qué se toca y qué no:
 *  - Solo los ficheros de la RAÍZ de storage/public con el nombre que pone la
 *    subida del CMS (32 hex + extensión). Las subcarpetas son de los activos del
 *    seed (`portada/*.webp`, `documentos/pendiente.pdf`) y no se miran; además,
 *    esos activos se excluyen por su ruta aunque algún día cambien de sitio.
 *  - Nada de lo subido en las últimas horas: puede ser la foto de un formulario
 *    que alguien está rellenando ahora mismo y todavía no ha guardado.
 *  - En storage/private, lo mismo con los documentos del alta: solo cuentan
 *    como en uso los que nombra una ficha (`foto`, `certificadoBautismo`). Antes
 *    no se miraba, y la foto en webp de una solicitud rechazada o de una cuenta
 *    suprimida se quedaba allí para siempre (un dato personal, no solo disco).
 *  - Los restos de una subida que no terminó: lo que quedó en storage/subiendo
 *    y los `.<nombre>.tmp` del renombrado en storage/public, si el proceso
 *    murió a mitad (reinicio, sharp sin memoria) antes de borrarlos.
 *
 * Se ejecuta desde la carpeta del backend (como el servidor): storage/ se
 * resuelve contra el directorio actual.
 */
import 'dotenv/config';
import db from '../src/config/db.js';
import { carpetaDeSubidas, privateStorageDir, publicStorageDir } from '../src/middleware/upload.middleware.js';
import { borrarDocumentosPrivados, buscarDocumentosHuerfanos, documentosPrivadosReferenciados } from '../src/utils/documentos-privados.js';
import fs from 'node:fs/promises';
import { borrarSubida, buscarHuerfanos, buscarRestosDeSubidas, nombreDeSubida, subidasReferenciadas } from '../src/utils/ficheros-publicos.js';
import { ARCHIVO_PUBLICACION_PENDIENTE, imagenesPortada, urlImagenPortada } from '../prisma/seed-contenido.js';

const argumentos = process.argv.slice(2);
const borrar = argumentos.includes('--borrar');
const argHoras = argumentos.find((a) => a.startsWith('--horas='));
const minHoras = argHoras ? Number(argHoras.slice('--horas='.length)) : 24;

if (!Number.isFinite(minHoras) || minHoras < 0) {
  console.error('--horas tiene que ser un número de horas (0 o más).');
  process.exit(1);
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

try {
  const referenciados = await subidasReferenciadas();

  // Los activos del seed también cuentan como «en uso»: hoy viven en subcarpetas
  // y el filtro ya los deja fuera, pero así no dependen de eso.
  for (const ruta of [ARCHIVO_PUBLICACION_PENDIENTE, ...imagenesPortada().map((i) => urlImagenPortada(i.archivo))]) {
    const nombre = nombreDeSubida(ruta);
    if (nombre) referenciados.add(nombre);
  }

  const { huerfanos, ignorados } = await buscarHuerfanos({ referenciados, minHoras });

  console.log(`Carpeta: ${publicStorageDir}`);
  console.log(`Ficheros subidos que siguen en uso: ${referenciados.size}`);
  if (ignorados.length) {
    console.log(`\nNo tienen el nombre de una subida del CMS y no se tocan (${ignorados.length}):`);
    for (const nombre of ignorados) console.log(`  · ${nombre}`);
  }

  if (huerfanos.length === 0) {
    console.log(`\nNo hay ficheros huérfanos de más de ${minHoras} h.`);
  } else {
    const total = huerfanos.reduce((suma, f) => suma + f.bytes, 0);
    console.log(`\nHuérfanos de más de ${minHoras} h (${huerfanos.length}, ${kb(total)}):`);
    for (const f of huerfanos) console.log(`  · ${f.nombre}  ${kb(f.bytes)}  ${f.modificado.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`);

    if (borrar) {
      let borrados = 0;
      for (const f of huerfanos) {
        if (await borrarSubida(f.nombre)) borrados += 1;
      }
      console.log(`\nBorrados: ${borrados}.`);
    } else {
      console.log('\nNo se ha borrado nada. Para borrarlos: npx tsx scripts/limpiar-huerfanos.ts --borrar');
    }
  }

  // Los documentos del alta. Sin nombres en el listado: el nombre es un hash,
  // pero el directorio es de datos personales y no hace falta enseñarlo.
  const privados = await buscarDocumentosHuerfanos({ referenciados: await documentosPrivadosReferenciados(), minHoras });
  console.log(`\nCarpeta: ${privateStorageDir}`);
  if (privados.ignorados.length) console.log(`No tienen el nombre de una subida y no se tocan: ${privados.ignorados.length}.`);
  if (privados.huerfanos.length === 0) {
    console.log(`No hay documentos del alta huérfanos de más de ${minHoras} h.`);
  } else {
    const total = privados.huerfanos.reduce((suma, f) => suma + f.bytes, 0);
    console.log(`Documentos del alta que no menciona ninguna ficha, de más de ${minHoras} h: ${privados.huerfanos.length} (${kb(total)}).`);
    if (borrar) {
      console.log(`Borrados: ${await borrarDocumentosPrivados(privados.huerfanos.map((f) => f.nombre))}.`);
    } else {
      console.log('No se ha borrado nada. Para borrarlos: npx tsx scripts/limpiar-huerfanos.ts --borrar');
    }
  }

  const restos = await buscarRestosDeSubidas({ subiendo: carpetaDeSubidas, minHoras });
  console.log(`
Carpeta: ${carpetaDeSubidas}`);
  if (restos.length === 0) {
    console.log(`No hay restos de subidas sin terminar de más de ${minHoras} h.`);
  } else {
    const total = restos.reduce((suma, f) => suma + f.bytes, 0);
    console.log(`Restos de subidas sin terminar, de más de ${minHoras} h: ${restos.length} (${kb(total)}).`);
    if (borrar) {
      for (const resto of restos) await fs.rm(resto.ruta, { force: true });
      console.log(`Borrados: ${restos.length}.`);
    } else {
      console.log('No se ha borrado nada. Para borrarlos: npx tsx scripts/limpiar-huerfanos.ts --borrar');
    }
  }
} catch (error) {
  console.error('No se ha podido completar la limpieza:', error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
