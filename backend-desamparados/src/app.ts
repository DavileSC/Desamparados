import express, { Application } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';

import { authRoutes } from './routes/auth.routes.js';
import { hermanoRoutes } from './routes/hermano.routes.js';
import { reciboRoutes } from './routes/recibo.routes.js';
import { paginaRoutes } from './routes/pagina.routes.js';
import { agendaRoutes } from './routes/agenda.routes.js';
import { newsRoutes } from './routes/news.routes.js'; 
import { uploadRoutes } from './routes/upload.routes.js';
import { inventarioRoutes } from './routes/inventario.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { procesionRoutes } from './routes/procesion.routes.js';
import { transaccionRoutes } from './routes/transaccion.routes.js';
import helmetConfig from './config/helmet'; // Configuración de seguridad
import { globalLimiter } from './config/limiter'; // Rate Limiting
import hppConfig from './config/hpp'; // Protección HPP
import { notFoundHandler, globalErrorHandler } from './middleware/error.middleware'; // Manejo de errores global

// Inicializamos la app
const app: Application = express();

// Configuración para Proxies (Nginx, Cloudflare, Railway, etc.)
// Necesario para que el Rate Limit (express-rate-limit) lea la IP real del usuario y no la del proxy.
// Un valor numérico indica el número de proxies en la cadena que se deben saltar.
// SEGURIDAD: en desarrollo (sin proxy delante) DEBE ser 0. Si pones 1 sin haber
// proxy real, cualquier atacante puede falsear su IP con la cabecera
// X-Forwarded-For y saltarse los limitadores (fuerza bruta de login incluida).
const numProxies = parseInt(
  process.env.NUM_PROXIES ?? (process.env.NODE_ENV === 'production' ? '1' : '0'),
  10
);
app.set('trust proxy', numProxies);

// ==========================================
// 1. MIDDLEWARES GLOBALES
// ==========================================

// Logs de desarrollo (solo en consola)
app.use(morgan('dev'));

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
    origin: allowedOrigin ? allowedOrigin : (process.env.NODE_ENV === 'production' ? false : '*'),
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting Global (Protección DDoS básica)
app.use(globalLimiter);

// Límite subido a 2mb para permitir el HTML de las páginas y noticias del CMS
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Protección contra HTTP Parameter Pollution (HPP)
app.use(hppConfig);

// ==========================================
// 2. ARCHIVOS ESTÁTICOS (Imágenes/Storage)
// ==========================================
const storagePath = path.join(process.cwd(), 'storage');
app.use('/storage', express.static(storagePath));


// ==========================================
// 3. RUTAS DE LA API (Prefijo /api)
// ==========================================

// Healthcheck para proxies y monitorización
app.get('/health', (_req, res) => {
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
app.use('/api/news', newsRoutes);        // Noticias
app.use('/api/upload', uploadRoutes); // Subida de archivos
app.use('/api/inventario', inventarioRoutes); // Inventario de enseres
app.use('/api/admin', adminRoutes); // GESTIÓN DE STAFF Y ROLES
app.use('/api/procesion', procesionRoutes); // Citas, papeletas y turnos
app.use('/api/transacciones', transaccionRoutes); // Contabilidad

// ==========================================
// 4. MANEJO DE ERRORES GLOBAL
// ==========================================

// Primero atrapamos si la ruta no existe (404)
app.use(notFoundHandler);

// Finalmente, la gran red de seguridad que atrapa cualquier error interno o de Prisma
app.use(globalErrorHandler);

export default app;
