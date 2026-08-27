import 'dotenv/config'; // Carga las variables de entorno del archivo .env
import app from './app'; // Importamos la aplicación configurada

const PORT = process.env.PORT || 3001; // Puerto por defecto 3001 si no hay .env

/**
 * Iniciamos el servidor
 */
app.listen(PORT, () => {
  // Mensaje visual para saber que todo ha cargado bien
  console.log(`
  ╭──────────────────────────────────────────────────╮
  │                                                  │
  │   🚀 Servidor Cofradía listo y escuchando        │
  │                                                  │
  │   🌐 URL:      http://localhost:${PORT}             │
  │   📂 Storage:  /storage/public + private API     │
  │   🔑 Auth:     /api/auth                         │
  │   👥 Hermanos: /api/hermanos                     │
  │                                                  │
  ╰──────────────────────────────────────────────────╯
  `);
});
