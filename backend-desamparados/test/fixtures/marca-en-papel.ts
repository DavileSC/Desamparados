// test/fixtures/marca-en-papel.ts
//
// Lo que sale en papel y en el correo con la marca del proceso: qué imagen
// usa cada sitio, los colores de imprenta, los adjuntos de un correo a un
// hermano y a Secretaría, y una papeleta y un Informe anual en PDF.
//
// Se ejecuta en un proceso aparte (test/marca-imprenta.test.ts lo lanza con
// otra `MARCA_DE_PRUEBA` y otro `DATOS_ENTIDAD`): la marca y los colores se leen una vez,
// al importar src/domain/marca.ts, igual que en el servidor, y dentro del
// mismo proceso de la prueba ya estarían fijados.
//
//   node --import tsx test/fixtures/marca-en-papel.ts [carpeta]
//
// A mano, fuera de las pruebas, la carpeta de la marca se da con `MARCA`.
//
// Imprime un JSON en la última línea. Con `carpeta`, deja allí los dos PDF y
// los dos correos en HTML (con las imágenes dentro) para verlos a ojo.

import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const carpeta = process.argv[2];

const { IMAGENES_MARCA, IMPRENTA } = await import('../../src/domain/marca.js');
const pdf = await import('../../src/services/informes/pdf.js');
const { COLORES, conImagenesEnLinea, imagenesDe, maquetar } = await import('../../src/services/correos/plantilla.js');
const { papeletaEnPdf } = await import('../../src/services/procesion/papeleta-pdf.js');
const { informeAnual } = await import('../../src/services/informes/informes.js');
const { areasDe } = await import('../../src/domain/datos-areas.js');
const { periodoDe } = await import('../../src/domain/periodo-datos.js');
const { HOY, crudos } = await import('./crudos-informes.js');

const papeleta = await papeletaEnPdf({
  id: 12, year: 2027, referencia: '2027-0012',
  salida: { nombre: 'Sábado de Pasión', cobro: 'CUOTA', conRopa: true, indicaciones: null, articulo: 'el' },
  nombre: 'Ana Ruiz Moreno', sexo: 'MUJER', numeroHermano: 418, puesto: 'Nazareno de cirio', tramo: 'Tramo 3',
  tunica: 'T-27', capirote: null, faraona: null, importe: '20,00 €', observaciones: null,
  fechaSalida: 'sábado, 20 de marzo', horaSalida: '17:30', accesoPuerta: 'puerta lateral',
  expedida: HOY, codigo: 'PRUEBA-DE-LA-MARCA',
});
const periodo = periodoDe(2025, HOY);
const textos = { presentacion: null, firmaPresentacion: null, lugarFecha: null, epilogo: null, firmaEpilogo: null, notaPatrimonio: null, fechaCabildo: null };
const informe = await informeAnual(periodo, areasDe(crudos(), periodo, HOY), crudos(), textos, { borrador: true, hoy: HOY });

const correo = (para: 'hermano' | 'interno') => maquetar({ titulo: 'Prueba', antetitulo: 'Secretaría', resumen: 'Prueba', contenido: '<p>Hola.</p>', para });
const alHermano = correo('hermano');
const interno = correo('interno');
const adjuntos = (html: string) => imagenesDe(html).map(({ filename, cid, contentType, path }) => ({ filename, cid, contentType, path }));

/** Las medidas de cada imagen incrustada en un PDF (pdfkit las escribe en claro en el diccionario de la imagen). */
const imagenesDelPdf = (b: Buffer) =>
  [...b.toString('latin1').matchAll(/\/Subtype \/Image[\s\S]*?\/Width (\d+)\s*\/Height (\d+)/g)].map((m) => `${m[1]}x${m[2]}`);

if (carpeta) {
  mkdirSync(carpeta, { recursive: true });
  writeFileSync(join(carpeta, 'papeleta.pdf'), papeleta);
  writeFileSync(join(carpeta, 'informe-anual.pdf'), informe);
  writeFileSync(join(carpeta, 'correo-hermano.html'), conImagenesEnLinea(alHermano));
  writeFileSync(join(carpeta, 'correo-interno.html'), conImagenesEnLinea(interno));
}

console.log(JSON.stringify({
  imagenes: IMAGENES_MARCA,
  imprenta: IMPRENTA,
  pdf: {
    BURDEOS: pdf.BURDEOS, BURDEOS_VIVO: pdf.BURDEOS_VIVO, ORO: pdf.ORO, ORO_CLARO: pdf.ORO_CLARO,
    ORO_PALIDO: pdf.ORO_PALIDO, ORO_MEDIO: pdf.ORO_MEDIO, ORO_TEXTO: pdf.ORO_TEXTO,
  },
  correoBurdeos: COLORES.burdeos,
  correo: {
    hermano: { html: alHermano, adjuntos: adjuntos(alHermano) },
    interno: { html: interno, adjuntos: adjuntos(interno) },
  },
  papeleta: { cabecera: papeleta.subarray(0, 5).toString(), imagenes: imagenesDelPdf(papeleta) },
  informe: { cabecera: informe.subarray(0, 5).toString(), imagenes: imagenesDelPdf(informe) },
}));
// Prisma (lo importa papeleta-pdf.ts) deja el proceso vivo aunque no consulte nada.
process.exit(0);
