/**
 * Pasa a WebP las fotos subidas antes de que la subida lo hiciera sola, las
 * reduce a 1920 px y les quita los metadatos (`prepararFoto`, lo mismo que
 * hace hoy la subida), y cambia su dirección en todo lo que las nombra.
 *
 *   npx tsx scripts/fotos-a-webp.ts            → solo cuenta lo que haría (no escribe nada)
 *   npx tsx scripts/fotos-a-webp.ts --aplicar  → lo hace
 *
 * Qué toca:
 *  - storage/public: los JPG y PNG con nombre de subida del CMS (32 hex) pasan
 *    a `<hex>.webp`; las WebP de más de 1920 px se reducen sin cambiar de nombre.
 *  - storage/private: la foto de la ficha del hermano (`Hermano.foto`). Los
 *    certificados de bautismo son documentos y no se tocan.
 *  - La base: cada tabla y campo que puede nombrar una subida, la misma lista
 *    que `contarReferencias` en utils/ficheros-publicos.ts (noticias, agenda,
 *    publicaciones, enseres, portada, páginas y sus versiones…).
 *
 * El orden protege de un corte a medias: primero se escriben las WebP, luego
 * se cambian las direcciones en una transacción y solo después se borran los
 * originales. Si se corta antes del final, la web sigue funcionando con los
 * originales y se puede volver a lanzar: lo ya convertido se aprovecha.
 *
 * Las direcciones se cambian con REPLACE en SQL y no con Prisma, para que las
 * fechas de «última modificación» no digan que alguien editó la noticia hoy.
 *
 * Se ejecuta desde la carpeta del backend (como el servidor): storage/ se
 * resuelve contra el directorio actual. Una foto cada vez y con un solo hilo:
 * en un VPS pequeño tarda, pero no deja sin CPU a la web mientras tanto.
 */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import db from '../src/config/db.js';
import { privateStorageDir, publicStorageDir } from '../src/middleware/upload.middleware.js';
import { conExtensionWebp, LADO_MAXIMO, prepararFoto } from '../src/controllers/subida.controller.js';

const aplicar = process.argv.includes('--aplicar');

/** Una subida del CMS: 32 hex y extensión de foto. Nada más se toca. */
const FOTO_SUBIDA = /^[a-f0-9]{32}\.(?:jpe?g|png|webp)$/i;

/**
 * Tabla y columnas donde puede aparecer el nombre de una subida pública. Si se
 * añade un campo con rutas a /storage/public, tiene que entrar aquí y en
 * `contarReferencias` (utils/ficheros-publicos.ts).
 */
const COLUMNAS: [tabla: string, columnas: string[]][] = [
  ['Noticia', ['imagenUrl', 'contenido']],
  ['Publicacion', ['imagenUrl', 'archivoUrl', 'descripcion']],
  ['ImagenPortada', ['url']],
  ['Enser', ['imagenUrl']],
  ['Pagina', ['contenido']],
  ['Evento', ['description', 'fotoCartel']],
  ['ContenidoPagina', ['datos']],
  ['VersionContenido', ['datos']],
  ['SeccionGuardada', ['bloques']],
];

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

interface Cambio { carpeta: string; antes: string; despues: string; bytesAntes: number; bytesDespues: number }

/** Prepara una foto; en modo de prueba no escribe nada. Devuelve null si no merece la pena o no se puede. */
async function convertir(carpeta: string, nombre: string): Promise<Cambio | null> {
  const ruta = path.join(carpeta, nombre);
  const original = await fs.readFile(ruta);
  const esWebp = /\.webp$/i.test(nombre);
  if (esWebp) {
    // Una WebP ya está en su formato: solo se rehace si pasa del lado máximo.
    const { width = 0, height = 0, pages = 1 } = await sharp(original).metadata();
    if (pages > 1 || Math.max(width, height) <= LADO_MAXIMO) return null;
  }
  const despues = esWebp ? nombre : conExtensionWebp(nombre).toLowerCase();
  let preparada: Buffer;
  try {
    preparada = await prepararFoto(original);
  } catch (error) {
    console.warn(`  ! ${nombre}: no se ha podido leer, se deja como está (${error instanceof Error ? error.message : error})`);
    return null;
  }
  if (esWebp && preparada.length >= original.length) return null;
  if (aplicar) {
    // Primero a un temporal y luego se renombra: una WebP a medio escribir
    // nunca queda con el nombre bueno.
    const temporal = path.join(carpeta, `${despues}.tmp`);
    await fs.writeFile(temporal, preparada);
    await fs.rename(temporal, path.join(carpeta, despues));
  }
  return { carpeta, antes: nombre, despues, bytesAntes: original.length, bytesDespues: preparada.length };
}

try {
  console.log(aplicar ? 'Pasando las fotos a WebP…\n' : 'MODO DE PRUEBA: no se escribe nada. Añade --aplicar para hacerlo.\n');

  // 1. Las públicas: todas las subidas de la raíz de storage/public.
  const publicas = (await fs.readdir(publicStorageDir, { withFileTypes: true }))
    .filter((e) => e.isFile() && FOTO_SUBIDA.test(e.name)).map((e) => e.name);

  // 2. Las privadas: solo las fotos de las fichas, que son las que se ven en el CMS.
  const fichas = await db.hermano.findMany({ where: { foto: { not: null } }, select: { id: true, foto: true } });
  const privadas = fichas.map((f) => f.foto!).filter((nombre) => FOTO_SUBIDA.test(nombre));

  const cambios: Cambio[] = [];
  let hechas = 0;
  const total = publicas.length + privadas.length;
  for (const [carpeta, nombres] of [[publicStorageDir, publicas], [privateStorageDir, privadas]] as const) {
    for (const nombre of nombres) {
      hechas++;
      try {
        await fs.access(path.join(carpeta, nombre));
      } catch {
        console.warn(`  ! ${nombre}: la base la nombra pero no está en el disco, se salta`);
        continue;
      }
      const cambio = await convertir(carpeta, nombre);
      if (cambio) {
        cambios.push(cambio);
        console.log(`  [${hechas}/${total}] ${cambio.antes} → ${cambio.despues}: ${(cambio.bytesAntes / 1024).toFixed(0)} KB → ${(cambio.bytesDespues / 1024).toFixed(0)} KB`);
      }
    }
  }

  const renombradas = cambios.filter((c) => c.antes !== c.despues);
  const publicasRenombradas = renombradas.filter((c) => c.carpeta === publicStorageDir);
  const privadasRenombradas = renombradas.filter((c) => c.carpeta === privateStorageDir);

  // Una variable de entorno que apunte a una foto que va a cambiar de nombre
  // (NORMATIVA_URL suele ser un PDF) no se puede reescribir desde aquí: se avisa.
  for (const c of publicasRenombradas) {
    if (process.env.NORMATIVA_URL?.includes(c.antes)) console.warn(`  ! NORMATIVA_URL nombra ${c.antes}: cámbiala a mano a ${c.despues}`);
  }

  // 3. Las direcciones, todas a la vez: o cambian todas o ninguna.
  let filas = 0;
  if (aplicar && renombradas.length) {
    await db.$transaction(async (tx) => {
      for (const c of publicasRenombradas) {
        for (const [tabla, columnas] of COLUMNAS) {
          for (const columna of columnas) {
            // Tabla y columna salen de la lista fija de arriba, nunca de fuera.
            filas += await tx.$executeRawUnsafe(
              `UPDATE \`${tabla}\` SET \`${columna}\` = REPLACE(\`${columna}\`, ?, ?) WHERE \`${columna}\` LIKE ?`,
              c.antes, c.despues, `%${c.antes}%`,
            );
          }
        }
      }
      for (const c of privadasRenombradas) {
        filas += await tx.$executeRawUnsafe('UPDATE `Hermano` SET `foto` = ? WHERE `foto` = ?', c.despues, c.antes);
      }
    }, { timeout: 120_000 });

    // 4. Ya nadie nombra los originales: fuera.
    for (const c of renombradas) await fs.unlink(path.join(c.carpeta, c.antes)).catch(() => {});
  }

  const antes = cambios.reduce((s, c) => s + c.bytesAntes, 0);
  const despues = cambios.reduce((s, c) => s + c.bytesDespues, 0);
  console.log(`\n${cambios.length} de ${total} fotos ${aplicar ? 'convertidas' : 'se convertirían'} (${publicasRenombradas.length} públicas y ${privadasRenombradas.length} de fichas cambian de nombre).`);
  if (cambios.length) console.log(`Ocupaban ${mb(antes)}; ${aplicar ? 'ocupan' : 'ocuparían'} ${mb(despues)} (${Math.round(100 - despues / antes * 100)} % menos).`);
  if (aplicar) console.log(`Direcciones cambiadas en la base: ${filas} campos.`);
} finally {
  await db.$disconnect();
}
