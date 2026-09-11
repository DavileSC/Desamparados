// test/fixtures/almacen-temporal.ts
//
// Aísla `storage/` en una carpeta temporal. Tiene que ser el PRIMER import del
// fichero de test, antes que `../src/app.js` o cualquier cosa que cargue
// `upload.middleware.ts`: la carpeta de subidas se calcula con `process.cwd()`
// al importar ese módulo, y los imports de ES se evalúan en orden.
//
// Sin esto, un test que sube, sustituye o borra fotos lo haría en el
// `storage/public` del repositorio, y desde que el backend borra los ficheros
// que ya no usa nadie (utils/ficheros-publicos.ts), podría llevarse por delante
// las fotos de verdad de la base de desarrollo.

import 'dotenv/config'; // Antes de cambiar de carpeta: el .env está en la del backend.
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const carpetaOriginal = process.cwd();
export const carpetaTemporal = mkdtempSync(path.join(os.tmpdir(), 'desamparados-almacen-'));
export const almacenPublico = path.join(carpetaTemporal, 'storage', 'public');

process.chdir(carpetaTemporal);

process.on('exit', () => {
  // En Windows no se puede borrar la carpeta en la que se está.
  process.chdir(carpetaOriginal);
  rmSync(carpetaTemporal, { recursive: true, force: true });
});
