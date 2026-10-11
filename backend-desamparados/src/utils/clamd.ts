import net from 'net';

/**
 * Cliente clamd mínimo (protocolo INSTREAM) sin dependencias externas.
 *
 * Comportamiento real, según el entorno:
 *  - Sin CLAMAV_HOST (y CLAMAV_REQUIRED distinto de true): NO se analiza nada y
 *    la subida se acepta. Se avisa una vez en el log, en la primera subida,
 *    para que no pase inadvertido en un servidor que debería tenerlo.
 *  - Sin CLAMAV_HOST y CLAMAV_REQUIRED=true: se rechazan todas las subidas como
 *    «antivirus no disponible» (configuración incompleta).
 *  - Con CLAMAV_HOST y clamd caído, lento o respondiendo algo inesperado: se
 *    rechaza la subida (fail-closed), pero como «antivirus no disponible», no
 *    como si el archivo tuviera un virus.
 *  - Con CLAMAV_HOST y clamd respondiendo «FOUND»: se rechaza por infectado.
 *
 * Protocolo INSTREAM:
 *   1. Conectar y enviar "zINSTREAM\0"
 *   2. Enviar el archivo en trozos: 4 bytes big-endian de longitud + datos
 *   3. Terminar con un trozo de longitud 0
 *   4. clamd responde "stream: OK\0" (limpio) o "stream: <SIGNATURE> FOUND\0" (infectado)
 *
 * Ojo en el despliegue: clamd corta los flujos que superan su `StreamMaxLength`
 * («INSTREAM size limit exceeded»). Tiene que ser mayor que el tope de subida
 * de PDF (upload.middleware.ts) o todos los boletines grandes se rechazarán.
 */

const CHUNK_SIZE = 64 * 1024; // límite recomendado por clamd
// Un PDF de 20 MB tarda en analizarse bastante más que una foto: con 20 s un
// clamd cargado daba por caída una subida legítima.
const TIMEOUT_MS = 60_000;

/**
 * - `limpio`: clamd lo ha analizado y no ha encontrado nada.
 * - `infectado`: clamd ha encontrado una firma.
 * - `sin-analizar`: no hay antivirus configurado; la subida sigue.
 * - `no-disponible`: debía analizarse y no se ha podido (clamd caído, lento,
 *   mal configurado o con una respuesta que no se entiende).
 */
type VeredictoAntivirus = 'limpio' | 'infectado' | 'sin-analizar' | 'no-disponible';

interface ScanResult {
  veredicto: VeredictoAntivirus;
  clean: boolean;
  scanned: boolean; // false = ClamAV no estaba configurado
  reason?: string;
}

const noDisponible = (reason: string): ScanResult => ({ veredicto: 'no-disponible', clean: false, scanned: true, reason });

/**
 * Interpreta la respuesta de clamd. Exportado para poder testearlo sin socket.
 *  - "stream: OK"            -> limpio
 *  - "OK"                    -> limpio (variantes antiguas)
 *  - "stream: Eicar FOUND"   -> infectado
 *  - cualquier otra cosa     -> no disponible (se rechaza igual: fail-closed)
 */
export function parseClamdResponse(raw: string): ScanResult {
  const resp = raw.replace(/\0/g, '').trim();
  if (/(^|:\s*)OK$/.test(resp)) {
    return { veredicto: 'limpio', clean: true, scanned: true };
  }
  if (/FOUND$/.test(resp)) {
    return { veredicto: 'infectado', clean: false, scanned: true, reason: resp };
  }
  return noDisponible(resp || 'Respuesta vacía del antivirus');
}

// Un aviso por proceso: en cada subida sería ruido y dejaría de leerse.
let avisadoSinAntivirus = false;

/** Solo para los tests: vuelve a dejar pendiente el aviso de «sin antivirus». */
export function reiniciarAvisoSinAntivirus() {
  avisadoSinAntivirus = false;
}

function avisarSinAntivirus() {
  if (avisadoSinAntivirus) return;
  avisadoSinAntivirus = true;
  console.warn('[Security] CLAMAV_HOST no está definido: los archivos subidos NO se analizan con antivirus. Define CLAMAV_HOST (y CLAMAV_REQUIRED=true) en producción.');
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
  const requiredValue = (process.env.CLAMAV_REQUIRED ?? 'false').trim().toLowerCase();
  if (requiredValue !== 'true' && requiredValue !== 'false') {
    return noDisponible('CLAMAV_REQUIRED debe ser true o false');
  }
  const required = requiredValue === 'true';

  // En producción se puede exigir que todos los archivos pasen por ClamAV.
  if (!host) {
    if (required) return noDisponible('ClamAV es obligatorio pero no está configurado');
    avisarSinAntivirus();
    return { veredicto: 'sin-analizar', clean: true, scanned: false };
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return noDisponible('Puerto de ClamAV no válido');
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
      finish(noDisponible('Timeout del antivirus (clamd)'));
    });

    socket.on('error', (err) => {
      finish(noDisponible(`Antivirus no disponible: ${err.message}`));
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
        finish(noDisponible(`Error enviando el archivo al antivirus: ${err?.message ?? err}`));
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
