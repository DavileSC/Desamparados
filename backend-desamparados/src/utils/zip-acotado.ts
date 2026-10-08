import { inflateRawSync } from 'node:zlib';

/**
 * Cuánto ocupa un zip (un .xlsx lo es) una vez descomprimido, sin pasar de un
 * tope. Un Excel de 2 MB puede esconder gigas de ceros que ExcelJS descomprime
 * enteros en memoria antes de mirar nada: una «bomba zip» tumbaba el proceso
 * con solo subir el fichero al importar el censo.
 *
 * No se fía de los tamaños que declara el propio zip, que se pueden falsear:
 * descomprime cada entrada con `maxOutputLength`, así que el trabajo nunca
 * pasa del tope aunque el fichero mienta. Solo lee el directorio central y las
 * entradas guardadas tal cual o con deflate, que es lo que escribe Excel.
 */
export type VeredictoZip = 'ok' | 'grande' | 'roto';

const FIRMA_FIN = 0x06054b50;
const FIRMA_CENTRAL = 0x02014b50;
const FIRMA_LOCAL = 0x04034b50;
/** Un .xlsx normal trae unas decenas de entradas. */
const MAX_ENTRADAS = 5000;

export function revisarZip(buffer: Buffer, topeBytes: number): VeredictoZip {
  try {
    const fin = buscarFinDelDirectorio(buffer);
    if (fin < 0) return 'roto';
    const entradas = buffer.readUInt16LE(fin + 10);
    const inicio = buffer.readUInt32LE(fin + 16);
    // ZIP64 (marcas a 0xFFFF…): un Excel de un censo no lo necesita nunca.
    if (entradas === 0xffff || inicio === 0xffffffff) return 'grande';
    if (entradas > MAX_ENTRADAS) return 'grande';

    let total = 0;
    let p = inicio;
    for (let i = 0; i < entradas; i++) {
      if (buffer.readUInt32LE(p) !== FIRMA_CENTRAL) return 'roto';
      const metodo = buffer.readUInt16LE(p + 10);
      const comprimido = buffer.readUInt32LE(p + 20);
      const declarado = buffer.readUInt32LE(p + 24);
      const largoNombre = buffer.readUInt16LE(p + 28);
      const largoExtra = buffer.readUInt16LE(p + 30);
      const largoComentario = buffer.readUInt16LE(p + 32);
      const local = buffer.readUInt32LE(p + 42);
      p += 46 + largoNombre + largoExtra + largoComentario;

      // Lo declarado ya pasa del tope: no hace falta descomprimir para saberlo.
      if (declarado === 0xffffffff || total + declarado > topeBytes) return 'grande';

      if (buffer.readUInt32LE(local) !== FIRMA_LOCAL) return 'roto';
      const datos = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      if (datos + comprimido > buffer.length) return 'roto';
      const trozo = buffer.subarray(datos, datos + comprimido);

      if (metodo === 0) {
        total += trozo.length;
      } else if (metodo === 8) {
        const quedan = topeBytes - total;
        try {
          total += inflateRawSync(trozo, { maxOutputLength: Math.max(1, quedan) }).length;
        } catch (error) {
          // Pasarse del tope lo dice zlib con este código; lo demás es un zip roto.
          if ((error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') return 'grande';
          return 'roto';
        }
      } else {
        return 'roto';
      }
      if (total > topeBytes) return 'grande';
    }
    return 'ok';
  } catch {
    // Un desplazamiento fuera del buffer: el directorio central no cuadra.
    return 'roto';
  }
}

/** El registro de fin del directorio central, buscando hacia atrás (puede llevar un comentario). */
function buscarFinDelDirectorio(buffer: Buffer): number {
  const desde = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= desde; i--) {
    if (buffer.readUInt32LE(i) === FIRMA_FIN) return i;
  }
  return -1;
}
