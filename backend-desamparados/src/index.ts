import 'dotenv/config'; // Carga las variables de entorno del archivo .env
import type { Server } from 'node:http';
import { comprobarEntorno, hostDeEscucha, puertoDeEscucha } from './config/entorno';
import { describirErrorParaLog } from './utils/log-privacidad';
import { resolverClaveTotp } from './utils/cifrado-totp';

/**
 * Punto de entrada del servidor.
 *
 * El entorno se valida ANTES de cargar la aplicación: `app` y sus módulos leen
 * `process.env` al importarse (db.ts, jwt.handle.ts, helmet...), y un fallo
 * ahí daría un error suelto en vez de la lista de todo lo que falta. Por eso
 * `app` se importa de forma dinámica, después de la comprobación. Los tests
 * importan `app` directamente y no pasan por aquí.
 */
try {
  comprobarEntorno();
  // La clave del doble factor se resuelve de forma perezosa, en el primer uso
  // del 2FA. En producción se fuerza aquí para que una TOTP_ENC_KEY ausente o
  // mal formada impida arrancar, en vez de romper el login de un cargo horas
  // después. (El formato ya lo mira comprobarEntorno; esto usa la regla real.)
  if (process.env.NODE_ENV === 'production') resolverClaveTotp();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const { default: app } = await import('./app');
const { default: db } = await import('./config/db');

const PORT = puertoDeEscucha();
const HOST = hostDeEscucha(); // 127.0.0.1 en producción; todas las interfaces en desarrollo

// En Express 5 este callback también se llama si el servidor no llega a abrir,
// con el error como argumento; ese caso lo atiende el manejador de 'error'.
const alEscuchar = (error?: Error) => {
  if (error) return;
  console.log(
    `🚀 API del Grupo Parroquial escuchando en http://${HOST ?? 'localhost'}:${PORT} ` +
    `(NODE_ENV=${process.env.NODE_ENV}, ${HOST ? `solo en ${HOST}` : 'todas las interfaces'})`
  );
};
const server: Server = HOST ? app.listen(PORT, HOST, alEscuchar) : app.listen(PORT, alEscuchar);

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`El puerto ${PORT} ya está en uso: ¿queda otro backend arrancado? (ver docs/notas-del-proyecto.md, sección 5)`);
  } else {
    console.error('No se pudo abrir el servidor:', error);
  }
  process.exit(1);
});

// ==========================================
// CIERRE ORDENADO
// ==========================================
// systemd (y Ctrl+C en local) piden parar con SIGTERM/SIGINT. Sin esto, Node
// muere en seco: las peticiones a medias se cortan y el pool de MariaDB no se
// cierra. Se deja de aceptar conexiones, se espera a las que están en curso y
// se desconecta Prisma. Si algo se queda colgado, a los 10 s se sale igual
// (TimeoutStopSec de la unidad systemd debe ser mayor).
const ESPERA_MAXIMA_CIERRE_MS = 10_000;
let cerrando = false;

async function cerrar(motivo: string, codigo = 0): Promise<void> {
  if (cerrando) return;
  cerrando = true;
  console.log(`[Servidor] ${motivo}: cerrando de forma ordenada...`);

  const temporizador = setTimeout(() => {
    console.error(`[Servidor] El cierre tardó más de ${ESPERA_MAXIMA_CIERRE_MS / 1000} s: se fuerza la salida.`);
    process.exit(codigo || 1);
  }, ESPERA_MAXIMA_CIERRE_MS);
  temporizador.unref();

  try {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      // Las conexiones keep-alive sin petición en curso no cuentan como
      // trabajo pendiente: se cierran ya para que `close` no espere por ellas.
      server.closeIdleConnections();
    });
    await db.$disconnect();
    console.log('[Servidor] Cerrado.');
  } catch (error) {
    console.error('[Servidor] Error durante el cierre:', error);
    codigo = codigo || 1;
  } finally {
    process.exit(codigo);
  }
}

process.on('SIGTERM', () => void cerrar('SIGTERM'));
process.on('SIGINT', () => void cerrar('SIGINT'));

// Una promesa rechazada sin `catch` (típicamente un envío de correo lanzado
// sin esperar) no debe tumbar la API para todos: se registra con su pila y el
// servidor sigue. Una excepción no capturada, en cambio, deja el proceso en un
// estado desconocido: se registra y se cierra; systemd lo vuelve a levantar.
// Pasan por describirErrorParaLog por lo mismo que los 500: un error de Prisma
// lleva en el mensaje los argumentos de la consulta.
process.on('unhandledRejection', (motivo) => {
  console.error(`[Servidor] Promesa rechazada sin capturar: ${describirErrorParaLog(motivo)}`);
});

process.on('uncaughtException', (error) => {
  console.error(`[Servidor] Excepción no capturada: ${describirErrorParaLog(error)}`);
  void cerrar('excepción no capturada', 1);
});
