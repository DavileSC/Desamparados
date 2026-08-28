import helmet from 'helmet';

const helmetConfig = helmet({
  // 1. Cross-Origin Resource Policy (CORP)
  // Permite que otros dominios (tu frontend) carguen recursos (imágenes) de tu backend.
  // Es fundamental porque sirves archivos estáticos en /storage.
  crossOriginResourcePolicy: { policy: "cross-origin" },

  // 2. Content Security Policy (CSP)
  // Previene ataques XSS restringiendo desde dónde se pueden cargar scripts, imágenes, etc.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      // Las tipografías se sirven desde el propio dominio (@fontsource), así
      // que ya no hace falta abrir la puerta a cualquier host https.
      fontSrc: ["'self'", "data:"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"], // Evita que otros sitios te incrusten (Clickjacking moderno)
      imgSrc: ["'self'", "data:", "blob:"], // Permitir imágenes locales y base64
      objectSrc: ["'none'"], // Bloquear plugins como Flash
      scriptSrc: ["'self'"], // Solo scripts del propio dominio
      scriptSrcAttr: ["'none'"], // Bloquear event handlers inline
      styleSrc: ["'self'", "https:", "'unsafe-inline'"], // unsafe-inline a veces es necesario para estilos
      upgradeInsecureRequests: [], // Fuerza HTTPS en recursos http://
    }
  },

  // 3. Strict-Transport-Security (HSTS)
  // Fuerza HTTPS en producción durante 2 años.
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 63072000, // 2 años en segundos
    includeSubDomains: true,
    preload: true
  } : false,

  // 4. X-Frame-Options
  // Evita Clickjacking en navegadores antiguos. 'deny' es lo más seguro.
  frameguard: { action: 'deny' },

  // 5. Referrer-Policy
  // Controla qué información se envía en la cabecera Referer para privacidad.
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

export default helmetConfig;