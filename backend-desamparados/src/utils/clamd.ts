import net from 'net';

/**
 * Cliente clamd mínimo (protocolo INSTREAM) sin dependencias externas.
 * Se activa ÚNICAMENTE si el entorno define CLAMAV_HOST (ej: un contenedor
 * clamav/clamav en la misma red de docker). Si no está definido, los uploads
 * se aceptan sin escanear (comportamiento actual).
 *
 * Protocolo INSTREAM:
 *   1. Conectar y enviar "zINSTREAM\0"
 *   2. Enviar el archivo en trozos: 4 bytes big-endian de longitud + datos
 *   3. Terminar con un trozo de longitud 0
 *   4. clamd responde "OK\0" (limpio) o "<SIGNATURE> FOUND\0" (infectado)
 */

const CHUNK_SIZE = 64 * 1024; // límite recomendado por clamd
const TIMEOUT_MS = 20_000; // PDFs de 5MB pueden tardar en analizarse

export interface ScanResult {
  clean: boolean;
  scanned: boolean; // false = ClamAV no estaba configurado o no se pudo usar
  reason?: string;
}

export async function scanBufferClamav(buffer: Buffer): Promise<ScanResult> {
  const host = process.env.CLAMAV_HOST;
  const port = parseInt(process.env.CLAMAV_PORT || '3310', 10);

  // Sin ClamAV configurado: no escaneamos (fail-open deliberado).
  if (!host) return { clean: true, scanned: false };

  return new Promise<ScanResult>((resolve) => {
    let response = '';
    const socket = net.createConnection({ host, port });

    const finish = (result: ScanResult) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(TIMEOUT_MS, () => {
      finish({ clean: false, scanned: true, reason: 'Timeout del antivirus (clamd)' });
    });

    socket.on('error', (err) => {
      finish({ clean: false, scanned: true, reason: `Antivirus no disponible: ${err.message}` });
    });

    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
        const chunk = buffer.subarray(i, i + CHUNK_SIZE);
        const header = Buffer.alloc(4);
        header.writeUInt32BE(chunk.length, 0);
        if (!socket.write(Buffer.concat([header, chunk]))) {
          // Backpressure: esperamos el evento drain antes de seguir
          return;
        }
      }
      socket.write(Buffer.alloc(4)); // trozo de longitud 0 = fin del stream
    });

    socket.on('data', (data) => {
      response += data.toString();
      socket.end();
    });

    socket.on('close', () => {
      const resp = response.trim();
      if (resp.startsWith('OK')) {
        resolve({ clean: true, scanned: true });
      } else if (resp.includes('FOUND')) {
        resolve({ clean: false, scanned: true, reason: resp });
      } else {
        resolve({ clean: false, scanned: true, reason: resp || 'Respuesta vacía del antivirus' });
      }
    });
  });
}
