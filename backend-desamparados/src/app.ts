import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { publicStorageDir } from './middleware/upload.middleware.js';
import { registroPeticiones } from './config/registro.js';

import { authRoutes } from './routes/auth.routes.js';
import { hermanoRoutes } from './routes/hermano.routes.js';
import { reciboRoutes } from './routes/recibo.routes.js';
import { paginaRoutes } from './routes/pagina.routes.js';
import { agendaRoutes } from './routes/agenda.routes.js';
import { noticiaRoutes } from './routes/noticia.routes.js'; 
import { subidaRoutes } from './routes/subida.routes.js';
import { inventarioRoutes } from './routes/inventario.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { procesionRoutes } from './routes/procesion.routes.js';
import { transaccionRoutes } from './routes/transaccion.routes.js';
import { publicacionRoutes } from './routes/publicacion.routes.js';
import { contactoRoutes } from './routes/contacto.routes.js';
import { panelRoutes } from './routes/panel.routes.js';
import { portadaRoutes } from './routes/portada.routes.js';
import { contenidoRoutes } from './routes/contenido.routes.js';
import { seccionesRoutes } from './routes/secciones.routes.js';
import helmetConfig from './config/helmet'; // Configuración de seguridad
import { globalLimiter } from './config/limiter'; // Rate Limiting
import { notFoundHandler, globalErrorHandler } from './middleware/error.middleware'; // Manejo de errores global

// Inicializamos la app
const app: Application = express();

// Configuración para Proxies (Nginx, Cloudflare, Railway, etc.)
// Necesario para que el Rate Limit (express-rate-limit) lea la IP real del usuario y no la del proxy.
// Un valor numérico indica el número de proxies en la cadena que se deben saltar.
// SEGURIDAD: en desarrollo (sin proxy delante) DEBE ser 0. Si pones 1 sin haber
// proxy real, cualquier atacante puede falsear su IP con la cabecera
// X-Forwarded-For y saltarse los limitadores (fuerza bruta de login incluida).
//
// Con 1, Express toma como IP la ÚLTIMA entrada de X-Forwarded-For, que es la
// que añade nginx con `$proxy_add_x_forwarded_for`. Eso solo es fiable si:
//  - todo `location` de nginx que llegue a Node pone esa cabecera (nginx NO la
//    añade por su cuenta: sin `proxy_set_header`, reenvía intacta la que mande
//    el cliente, y Express se creería la IP inventada), y
//  - nadie llega al puerto de Node sin pasar por nginx: por eso en producción
//    escucha solo en 127.0.0.1 (ver HOST en src/index.ts).
const numProxies = parseInt(
  process.env.NUM_PROXIES ?? (process.env.NODE_ENV === 'production' ? '1' : '0'),
  10
);
app.set('trust proxy', numProxies);

// ==========================================
// 1. MIDDLEWARES GLOBALES
// ==========================================

// Registro de accesos: `dev` en local; en producción con fecha e IP y sin la
// consulta de la URL (ver config/registro.ts).
app.use(registroPeticiones());

// Seguridad (Helmet)
app.use(helmetConfig);

// CORS (Permitir peticiones del Frontend)
// SEGURIDAD: en producción es OBLIGATORIO definir FRONTEND_URL en el .env.
// Sin él, el CORS queda cerrado (false) para no abrir la API a cualquier origen.
const allowedOrigin = process.env.FRONTEND_URL;
if (process.env.NODE_ENV === 'production' && !allowedOrigin) {
  console.warn('⚠️  [Security] Producción sin FRONTEND_URL: CORS desactivado. Define la variable para permitir el frontend.');
}
app.use(cors({
    // '*' es incompatible con credentials, asi que en desarrollo reflejamos el origen.
    origin: allowedOrigin ? allowedOrigin : (process.env.NODE_ENV === 'production' ? false : true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    // Ya no se usa Authorization: la sesion viaja en cookie.
    allowedHeaders: ['Content-Type']
}));

// Las cookies de sesion y del paso intermedio del 2FA. Express no las parsea solo.
app.use(cookieParser());

// ==========================================
// 2. ARCHIVOS ESTÁTICOS (Imágenes/Storage)
// ==========================================
// Archivos públicos ANTES del limitador: son estáticos y baratos, y una sola
// portada pide media docena; contarlos agotaba el cupo de quien solo estaba
// mirando la web. Un archivo que no existe sigue de largo y sí cuenta.
// En producción, lo recomendado es que nginx los sirva directamente con
// `alias` y no lleguen aquí (ver docs/despliegue.md).
//
// Opciones: sin índice de carpetas, sin redirección de `carpeta` a
// `carpeta/` (que confirmaría qué subcarpetas existen) y ningún fichero oculto.
// CORP `cross-origin` solo aquí: el resto de la API queda en `same-origin`
// (config/helmet.ts), pero una foto guardada con URL absoluta tiene que
// poder verse desde la web, que en desarrollo corre en otro puerto.
app.use('/storage/public', express.static(publicStorageDir, {
  index: false,
  redirect: false,
  dotfiles: 'deny',
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  },
}));

// Rate Limiting Global (Protección DDoS básica)
app.use(globalLimiter);

// Cuerpos JSON. El tope general es 100 KB: ningún formulario de la web se
// acerca, y un cuerpo grande sin sesión (el formulario de contacto, el login)
// solo sirve para hacer trabajar al servidor. Las tres rutas que reciben el
// HTML del CMS (noticias, páginas y publicaciones) admiten 2 MB; su parser se
// monta ANTES del general, y el general ya no vuelve a leer un cuerpo leído.
// Sin `express.urlencoded`: la web solo envía JSON y las subidas van en
// multipart, que lee multer en su propia ruta.
const CUERPO_CMS = '2mb';
const CUERPO_GENERAL = '100kb';
app.use(['/api/news', '/api/pages', '/api/publications'], express.json({ limit: CUERPO_CMS }));
app.use(express.json({ limit: CUERPO_GENERAL }));

// Sin `hpp`: con Express 5, `req.query` es un getter que vuelve a analizar la
// URL en cada lectura, así que lo que hpp dejaba en `req.query` se perdía y
// el paquete no hacía nada. La defensa real es que cada ruta declare su
// `query` en el esquema de arktype: `validate` descarta lo no declarado y un
// parámetro repetido (que llega como array) no pasa un tipo `string`.

// ==========================================
// 3. RUTAS DE LA API (Prefijo /api)
// ==========================================

// Healthcheck para proxies y monitorización. `/api/health` es el que se
// comprueba desde fuera: nginx solo manda a Node lo que va bajo `/api/`, y
// `/health` por el dominio devolvería la web. `/health` se conserva para
// comprobarlo en la propia máquina (curl http://127.0.0.1:3001/health).
app.get(['/health', '/api/health'], (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// El limitador estricto (anti fuerza bruta) NO se monta aquí: solo debe cubrir
// las rutas públicas de login/registro/reset (ver auth.routes.ts). Si cubriera
// todo /api/auth, las operaciones autenticadas del staff (generar QR, activar
// 2FA, rescate...) agotarían la cuota de 10/15 min sin ser objetivos de fuerza bruta.
app.use('/api/auth', authRoutes);       // Login y Registro
app.use('/api/hermanos', hermanoRoutes); // Gestión de Cofrades
app.use('/api/recibos', reciboRoutes);   // Pagos y Tesorería
app.use('/api/pages', paginaRoutes);     // Contenido estático
app.use('/api/events', agendaRoutes);    // Agenda
app.use('/api/news', noticiaRoutes);        // Noticias
app.use('/api/publications', publicacionRoutes); // Publicaciones
app.use('/api/contact', contactoRoutes); // Formulario de contacto
app.use('/api/upload', subidaRoutes); // Subida de archivos
app.use('/api/inventario', inventarioRoutes); // Inventario de enseres
app.use('/api/admin', adminRoutes); // GESTIÓN DE STAFF Y ROLES
app.use('/api/procesion', procesionRoutes); // Citas, papeletas y turnos
app.use('/api/transacciones', transaccionRoutes); // Contabilidad
app.use('/api/panel', panelRoutes);      // Panel del CMS
app.use('/api/portada', portadaRoutes);  // Fotos de la cabecera del inicio
app.use('/api/secciones', seccionesRoutes); // Secciones guardadas del constructor de páginas
app.use('/api/contenido', contenidoRoutes); // Textos editables de la portada, el recorrido y la historia

// ==========================================
// 4. MANEJO DE ERRORES GLOBAL
// ==========================================

// Primero atrapamos si la ruta no existe (404)
app.use(notFoundHandler);

// Finalmente, la gran red de seguridad que atrapa cualquier error interno o de Prisma
app.use(globalErrorHandler);

export default app;
