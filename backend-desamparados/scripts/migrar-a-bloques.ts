/**
 * Convierte a la forma de bloques las filas de `ContenidoPagina` que se
 * guardaron con la forma antigua: el Recorrido, la Sagrada Titular y la
 * Historia.
 *
 * Por qué hace falta y no basta con la siembra: `mezclarConDefectos` solo
 * conserva del documento guardado las claves que existen en los valores por
 * defecto. Al cambiar la forma, un documento antiguo se quedaría sin ninguna:
 * la web volvería a los textos de partida y **lo que el Grupo Parroquial
 * hubiera editado desaparecería en silencio**, que es peor que un error.
 *
 * Es idempotente, como la siembra: una fila que ya tiene `bloques` se deja
 * como está. Correrlo dos veces no pisa nada.
 *
 *   npx tsx scripts/migrar-a-bloques.ts            # dice qué haría
 *   npx tsx scripts/migrar-a-bloques.ts --aplicar  # lo hace
 */
import db from '../src/config/db.js';

const APLICAR = process.argv.includes('--aplicar');

interface Cabecera { ceja?: string; titulo: string; subtitulo: string; foto: string; fotoAlt: string }
interface Documento { cabecera: Cabecera; bloques: unknown[] }

const parrafo = (texto: string) => ({ tipo: 'texto', titulo: '', html: `<p>${texto}</p>` });

/** El recorrido de antes: introducción, plano y paradas. */
function recorridoABloques(viejo: Record<string, never>): Documento {
  const d = viejo as unknown as {
    titulo: string; subtitulo: string; introduccion: string; tituloItinerario: string;
    plano: { url: string; alt: string };
    paradas: { hora: string; lugar: string }[];
  };
  const bloques: unknown[] = [];
  if (d.introduccion?.trim()) bloques.push(parrafo(d.introduccion));
  // El plano era una imagen suelta con su descripción: pasa a un bloque de foto.
  if (d.plano?.url) {
    bloques.push({ tipo: 'foto', titulo: '', url: d.plano.url, alt: d.plano.alt, pie: '' });
  }
  if (d.paradas?.length) {
    bloques.push({ tipo: 'itinerario', titulo: d.tituloItinerario ?? '', paradas: d.paradas });
  }
  return {
    cabecera: { titulo: d.titulo, subtitulo: d.subtitulo, foto: '', fotoAlt: '' },
    bloques,
  };
}

/** La Titular de antes: ceja, título, presentación y galería. */
function titularABloques(viejo: Record<string, never>): Documento {
  const d = viejo as unknown as {
    ceja: string; titulo: string; subtitulo: string;
    galeria: { tipo: string; url: string; portada: string; alt: string; pie: string }[];
  };
  const bloques: unknown[] = [];
  if (d.subtitulo?.trim()) bloques.push(parrafo(d.subtitulo));
  // Una galería vacía no es un bloque válido: sin medios, no se crea.
  if (d.galeria?.length) bloques.push({ tipo: 'galeria', titulo: '', medios: d.galeria });
  return {
    // La ceja («Sagrada Titular») era el rótulo pequeño de encima del título, y
    // en una página de bloques ese papel lo hace el título de la cabecera; el
    // título largo pasa a subtítulo, que es donde se lee igual que antes.
    cabecera: { titulo: d.ceja || d.titulo, subtitulo: d.titulo, foto: '', fotoAlt: '' },
    bloques,
  };
}

/**
 * La Historia de antes: cabecera con ceja, foto de fondo, hitos y cierre.
 *
 * Los hitos pasan tal cual a un bloque de cronología (misma forma, campo a
 * campo) y el cierre a un bloque de llamada, que es lo que era: un rótulo, una
 * frase y un enlace. Su destino lo fijaba el código; ahora va escrito en el
 * bloque, con el mismo valor.
 */
function historiaABloques(viejo: Record<string, never>): Documento {
  const d = viejo as unknown as {
    ceja: string; titulo: string; subtitulo: string;
    fondo?: { url: string };
    hitos?: unknown[];
    cierre?: { ceja: string; titulo: string; enlace: string };
  };
  const bloques: unknown[] = [];
  // Una cronología vacía no es un bloque válido: sin hitos, no se crea.
  if (d.hitos?.length) bloques.push({ tipo: 'cronologia', titulo: 'Cronología', hitos: d.hitos });
  if (d.cierre?.enlace?.trim()) {
    bloques.push({
      tipo: 'llamada',
      titulo: d.cierre.titulo,
      texto: d.cierre.ceja,
      boton: d.cierre.enlace,
      enlace: '/corporacion/historia/organos-de-gobierno',
    });
  }
  const fondo = d.fondo?.url ?? '';
  return {
    cabecera: {
      ceja: d.ceja,
      titulo: d.titulo,
      // El subtítulo admitía 600 caracteres y la cabecera de bloques 200: se
      // recorta antes que dejar un documento que no se puede volver a guardar.
      subtitulo: d.subtitulo.slice(0, 200),
      foto: fondo,
      // El fondo es decorativo y la web no lee esta descripción, pero la
      // cabecera la exige en cuanto hay foto.
      fotoAlt: fondo ? 'Nuestra Señora de los Desamparados, muy velada al fondo de la página' : '',
    },
    bloques,
  };
}

const CONVERSORES: Record<string, (viejo: Record<string, never>) => Documento> = {
  recorrido: recorridoABloques,
  titular: titularABloques,
  historia: historiaABloques,
};

async function main() {
  let convertidas = 0;
  for (const [slug, convertir] of Object.entries(CONVERSORES)) {
    const fila = await db.contenidoPagina.findUnique({ where: { slug } });
    if (!fila) {
      console.log(`· ${slug}: no hay fila; la siembra la creará ya en la forma nueva.`);
      continue;
    }

    const datos = fila.datos as Record<string, never>;
    if (Array.isArray((datos as { bloques?: unknown }).bloques)) {
      console.log(`· ${slug}: ya está en bloques; se deja como está.`);
      continue;
    }

    const nuevo = convertir(datos);
    console.log(`· ${slug}: ${nuevo.bloques.length} bloque(s) desde la forma antigua.`);
    if (APLICAR) {
      await db.contenidoPagina.update({ where: { slug }, data: { datos: nuevo as object } });
      convertidas += 1;
    }
  }

  console.log(APLICAR
    ? `\nListo: ${convertidas} página(s) convertida(s).`
    : '\nNo se ha tocado nada. Vuelve a lanzarlo con --aplicar para hacerlo.');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db.$disconnect());
