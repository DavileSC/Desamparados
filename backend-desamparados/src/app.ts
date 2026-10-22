import express, { Application } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { publicStorageDir } from './middleware/upload.middleware.js';
import { registroPeticiones } from './config/registro.js';
import db from './config/db.js';

import { authRoutes } from './routes/auth.routes.js';
import { hermanoRoutes } from './routes/hermano.routes.js';
import { reciboRoutes } from './routes/recibo.routes.js';
import { comunicadosRoutes } from './routes/comunicados.routes.js';
import { boletinRoutes } from './routes/boletin.routes.js';
import { cabildosRoutes } from './routes/cabildos.routes.js';
import { tiendaRoutes } from './routes/tienda.routes.js';
import { plantillasCorreoRoutes } from './routes/plantillas-correo.routes.js';
import { loteriaRoutes } from './routes/loteria.routes.js';
import { apadrinamientosRoutes } from './routes/apadrinamientos.routes.js';
import { cortejoDirectoRoutes } from './routes/cortejo-directo.routes.js';
import { pagoRoutes } from './routes/pago.routes.js';
import { cartaRoutes } from './routes/carta.routes.js';
import { agendaRoutes } from './routes/agenda.routes.js';
import { noticiaRoutes } from './routes/noticia.routes.js'; 
import { subidaRoutes } from './routes/subida.routes.js';
import { inventarioRoutes } from './routes/inventario.routes.js';
import { adminRoutes } from './routes/admin.routes.js';
import { procesionRoutes } from './routes/procesion.routes.js';
import { salidasRoutes, salidasCmsRoutes } from './routes/salidas.routes.js';
import { transaccionRoutes } from './routes/transaccion.routes.js';
import { publicacionRoutes } from './routes/publicacion.routes.js';
import { contactoRoutes } from './routes/contacto.routes.js';
import { panelRoutes } from './routes/panel.routes.js';
import { datosRoutes } from './routes/datos.routes.js';
import { portadaRoutes } from './routes/portada.routes.js';
import { contenidoRoutes } from './routes/contenido.routes.js';
import { seccionesRoutes } from './routes/secciones.routes.js';
import { modulosRoutes, modulosCmsRoutes } from './routes/modulos.routes.js';
import estadisticasDeVisitasRoutes from './routes/estadisticas-de-visitas.routes.js';
import { corporacionRoutes, corporacionCmsRoutes } from './routes/corporacion.routes.js';
import { menuRoutes, menuCmsRoutes } from './routes/menu.routes.js';
import { webAbiertaRoutes, webAbiertaCmsRoutes } from './routes/web-abierta.routes.js';
import { conModulo, nucleo } from './middleware/modulos.js';
import { roperoRoutes } from './routes/ropero.routes.js';
import { correoRoutes } from './routes/correo.routes.js';
import { SitemapController } from './controllers/sitemap.controller.js';
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
    // PATCH también: la mesa de la procesión y las categorías contables lo
    // usan, y fuera de él la comprobación previa del navegador lo rechazaba.
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
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
// solo sirve para hacer trabajar al servidor. Las rutas que reciben el HTML
// del CMS (noticias, publicaciones, comunicados y actas) admiten 2 MB; su parser se
// monta ANTES del general, y el general ya no vuelve a leer un cuerpo leído.
// Sin `express.urlencoded` general: la web solo envía JSON y las subidas van
// en multipart, que lee multer en su propia ruta. La única excepción es el
// aviso del banco, que trae su lector en `pago.routes.ts`.
const CUERPO_CMS = '2mb';
const CUERPO_GENERAL = '100kb';
app.use(['/api/news', '/api/publications', '/api/comunicados', '/api/cabildos'], express.json({ limit: CUERPO_CMS }));
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
//
// `/api/health` mira además la base: es el que vigila el monitor de fuera
// (docs/servidor.md, «Avisos si algo falla»), y una API viva con MariaDB caída
// contestaba «ok» mientras la web daba errores. `/health` se queda en «el
// proceso responde»: lo usa el HEALTHCHECK de Docker, y una caída de la base
// no se arregla marcando la API como enferma.
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});
app.get('/api/health', async (_req, res) => {
  const espera = new Promise<false>((resolve) => setTimeout(() => resolve(false), 3000).unref());
  const conBase = await Promise.race([db.$queryRaw`SELECT 1`.then(() => true).catch(() => false), espera]);
  if (!conBase) {
    res.status(503).json({ status: 'sin-base', uptime: process.uptime() });
    return;
  }
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// El limitador estricto (anti fuerza bruta) NO se monta aquí: solo debe cubrir
// las rutas públicas de login/registro/reset (ver auth.routes.ts). Si cubriera
// todo /api/auth, las operaciones autenticadas del staff (generar QR, activar
// 2FA, rescate...) agotarían la cuota de 10/15 min sin ser objetivos de fuerza bruta.
// Cada router dice de qué módulo es: `conModulo('…')` responde 404 con el
// módulo apagado; `nucleo` es lo que no se apaga. Sin una de las dos marcas,
// test/modulos-cobertura.test.ts falla: un router nuevo tiene que decidirlo.
app.use('/api/auth', nucleo, authRoutes);       // Login y Registro (el registro lleva dentro la guarda de alta-web)
app.use('/api/hermanos', nucleo, hermanoRoutes); // Gestión de Cofrades (los difuntos llevan dentro su guarda)
app.use('/api/cartas', conModulo('cartas'), cartaRoutes);     // Cartas y circulares de Secretaría
app.use('/api/recibos', nucleo, reciboRoutes);   // Pagos y Tesorería (remesas, Modelo 182 y cuotas en línea, dentro con su guarda)
app.use('/api/pagos', nucleo, pagoRoutes);       // Avisos del banco (Redsys), sin sesión; nunca se apaga (dentro: métodos y donativo)
app.use('/api/events', conModulo('agenda'), agendaRoutes);    // Agenda
app.use('/api/news', conModulo('noticias'), noticiaRoutes);        // Noticias
app.use('/api/publications', conModulo('publicaciones'), publicacionRoutes); // Publicaciones
app.use('/api/contact', nucleo, contactoRoutes); // Formulario de contacto
app.use('/api/upload', nucleo, subidaRoutes); // Subida de archivos
app.use('/api/inventario', conModulo('inventario'), inventarioRoutes); // Inventario de enseres
app.use('/api/ropero', conModulo('procesion'), roperoRoutes); // Túnicas, prendas y cíngulos: parte de Procesión, no del Inventario
app.use('/api/admin', nucleo, adminRoutes); // GESTIÓN DE STAFF Y ROLES
app.use('/api/procesion', conModulo('procesion'), procesionRoutes); // Citas, papeletas y turnos (la Puerta lleva dentro su guarda)
app.use('/api/salidas', conModulo('procesion'), salidasRoutes);  // Las salidas activas, para la web y el área de hermanos
app.use('/api/cms/salidas', conModulo('procesion'), salidasCmsRoutes); // Alta, edición y fecha de las salidas, desde el CMS
app.use('/api/transacciones', conModulo('contabilidad'), transaccionRoutes); // Contabilidad: las pantallas; los apuntes se escriben siempre
app.use('/api/panel', nucleo, panelRoutes);      // Panel del CMS
app.use('/api/datos', nucleo, datosRoutes);      // Datos e informes de la junta (el Informe anual lleva dentro su guarda)
app.use('/api/comunicados', conModulo('comunicados'), comunicadosRoutes); // Boletín y avisos por correo
app.use('/api/boletin', nucleo, boletinRoutes); // La baja desde el enlace del correo: vale aunque se apague el boletín
app.use('/api/correo', nucleo, correoRoutes);   // Avisos del servicio de envío (rebotes, spam), sin sesión
app.use('/api/cabildos', conModulo('cabildos'), cabildosRoutes); // Cabildos y libro de actas
app.use('/api/tienda', conModulo('tienda'), tiendaRoutes); // Tienda: la caja y los productos (la compra desde la web, dentro con tienda-web)
app.use('/api/plantillas-correo', nucleo, plantillasCorreoRoutes); // Emails: las plantillas de los correos
app.use('/api/loteria', conModulo('loteria'), loteriaRoutes); // Lotería: sorteos, talonarios y su contabilidad
app.use('/api/apadrinamientos', conModulo('apadrinamientos'), apadrinamientosRoutes); // Apadrinar piezas sobre una foto, sin sesión
app.use('/api/cortejo-directo', conModulo('cortejo-directo'), cortejoDirectoRoutes); // Dónde va el cortejo en la calle
app.use('/api/portada', nucleo, portadaRoutes);  // Fotos de la cabecera del inicio
app.use('/api/secciones', nucleo, seccionesRoutes); // Secciones guardadas del constructor de páginas
app.use('/api/contenido', nucleo, contenidoRoutes); // Textos editables de la portada, el recorrido y la historia
app.use('/api/modulos', nucleo, modulosRoutes);         // Qué módulos están encendidos, para la web
app.use('/api/cms/modulos', nucleo, modulosCmsRoutes);  // Encenderlos y apagarlos, desde Sistema → Módulos
app.use('/api/corporacion', nucleo, corporacionRoutes);         // Secretaría, sede y redes, para la web
app.use('/api/cms/corporacion', nucleo, corporacionCmsRoutes);  // Cambiarlos, desde Sistema → Datos de la corporación
app.use('/api/estadisticas-de-visitas', conModulo('estadisticas-de-visitas'), estadisticasDeVisitasRoutes); // El informe de GoAccess, en el CMS
app.use('/api/menu', nucleo, menuRoutes);         // Nombres de las páginas en el menú público, para la web
app.use('/api/cms/menu', nucleo, menuCmsRoutes);  // Cambiarlos, desde el índice de Páginas del CMS
app.use('/api/web', nucleo, webAbiertaRoutes);         // Si la web está abierta o en «Próximamente»
app.use('/api/cms/web', nucleo, webAbiertaCmsRoutes);  // Abrirla o cerrarla, desde Sistema → Abrir la web

// El sitemap, en la raíz y no bajo /api: es donde lo buscan los buscadores
// (lo anuncia robots.txt). nginx manda aquí /sitemap.xml (docker/nginx/ubicaciones.conf).
app.get('/sitemap.xml', nucleo, SitemapController.xml);

// ==========================================
// 4. MANEJO DE ERRORES GLOBAL
// ==========================================

// Primero atrapamos si la ruta no existe (404)
app.use(notFoundHandler);

// Finalmente, la gran red de seguridad que atrapa cualquier error interno o de Prisma
app.use(globalErrorHandler);

export default app;
