import net from 'net';

/**
 * Cliente clamd mínimo (protocolo INSTREAM) sin dependencias externas.
 * Se activa si el entorno define CLAMAV_HOST (un servicio ClamAV accesible
 * por red). Si no está definido, los uploads
 * se aceptan sin escanear (comportamiento actual).
 *
 * Protocolo INSTREAM:
 *   1. Conectar y enviar "zINSTREAM\0"
 *   2. Enviar el archivo en trozos: 4 bytes big-endian de longitud + datos
 *   3. Terminar con un trozo de longitud 0
 *   4. clamd responde "stream: OK\0" (limpio) o "stream: <SIGNATURE> FOUND\0" (infectado)
 */

const CHUNK_SIZE = 64 * 1024; // límite recomendado por clamd
const TIMEOUT_MS = 20_000; // PDFs de 5MB pueden tardar en analizarse

export interface ScanResult {
  clean: boolean;
  scanned: boolean; // false = ClamAV no estaba configurado o no se pudo usar
  reason?: string;
}

/**
 * Interpreta la respuesta de clamd. Exportado para poder testearlo sin socket.
 *  - "stream: OK"            -> limpio
 *  - "OK"                    -> limpio (variantes antiguas)
 *  - "stream: Eicar FOUND"   -> infectado
 *  - cualquier otra cosa     -> se rechaza (fail-closed)
 */
export function parseClamdResponse(raw: string): ScanResult {
  const resp = raw.replace(/\0/g, '').trim();
  if (/(^|:\s*)OK$/.test(resp)) {
    return { clean: true, scanned: true };
  }
  if (/FOUND$/.test(resp)) {
    return { clean: false, scanned: true, reason: resp };
  }
  return { clean: false, scanned: true, reason: resp || 'Respuesta vacía del antivirus' };
}

/** Escribe en el socket respetando el backpressure (espera 'drain' cuando toca). */
function writeAsync(socket: net.Socket, data: Buffer | string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.destroyed) return reject(new Error('Socket cerrado'));
    const ok = socket.write(data, (err) => (err ? reject(err) : undefined));
    if (ok) return resolve();
    socket.once('drain', resolve);
  });
}

export async function scanBufferClamav(buffer: Buffer): Promise<ScanResult> {
  const host = process.env.CLAMAV_HOST;
  const port = parseInt(process.env.CLAMAV_PORT || '3310', 10);
  const required = process.env.CLAMAV_REQUIRED === 'true';

  // En producción se puede exigir que todos los archivos pasen por ClamAV.
  if (!host) {
    return required
      ? { clean: false, scanned: true, reason: 'ClamAV es obligatorio pero no está configurado' }
      : { clean: true, scanned: false };
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { clean: false, scanned: true, reason: 'Puerto de ClamAV no válido' };
  }

  return new Promise<ScanResult>((resolve) => {
    let response = '';
    let settled = false;
    const socket = net.createConnection({ host, port });

    const finish = (result: ScanResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(TIMEOUT_MS, () => {
      finish({ clean: false, scanned: true, reason: 'Timeout del antivirus (clamd)' });
    });

    socket.on('error', (err) => {
      finish({ clean: false, scanned: true, reason: `Antivirus no disponible: ${err.message}` });
    });

    socket.on('connect', async () => {
      try {
        await writeAsync(socket, 'zINSTREAM\0');
        for (let i = 0; i < buffer.length; i += CHUNK_SIZE) {
          const chunk = buffer.subarray(i, i + CHUNK_SIZE);
          const header = Buffer.alloc(4);
          header.writeUInt32BE(chunk.length, 0);
          await writeAsync(socket, Buffer.concat([header, chunk]));
        }
        await writeAsync(socket, Buffer.alloc(4)); // trozo de longitud 0 = fin del stream
      } catch (err: any) {
        finish({ clean: false, scanned: true, reason: `Error enviando el archivo al antivirus: ${err?.message ?? err}` });
      }
    });

    socket.on('data', (data) => {
      response += data.toString();
      // clamd termina cada respuesta con \0 (modo 'z'); en cuanto llega, ya tenemos el veredicto
      if (response.includes('\0')) {
        finish(parseClamdResponse(response));
      }
    });

    socket.on('close', () => {
      finish(parseClamdResponse(response));
    });
  });
}
