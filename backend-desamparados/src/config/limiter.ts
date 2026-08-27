import rateLimit from 'express-rate-limit';

// 1. Limitador Global (Para toda la API)
// Evita ataques de denegación de servicio (DDoS) básicos.
export const globalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutos
	limit: 100, // Límite de 100 peticiones por IP cada 15 minutos
	standardHeaders: 'draft-7', // Usa el estándar moderno de cabeceras IETF
	legacyHeaders: false, // Deshabilita las cabeceras `X-RateLimit-*`
	message: {
		status: 429,
		message: "Demasiadas peticiones desde esta IP, por favor intenta de nuevo en 15 minutos."
	}
});

// 2. Limitador Estricto (Para Login/Registro/2FA/Reset)
// Evita fuerza bruta para adivinar contraseñas o códigos TOTP.
// Nota: el lockout por CUENTA del 2FA (5 fallos → 15 min de bloqueo) cubre
// ataques distribuidos; este limiter cubre por IP.
export const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 20, // 20 intentos de login/registro/2fa/reset por IP cada 15 minutos
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	message: {
		status: 429,
		message: "Demasiados intentos de inicio de sesión. Por seguridad, espera 15 minutos."
	}
});

// El formulario público puede provocar spam de correo, por lo que tiene un
// límite propio más estricto que el resto de lecturas de la API.
export const contactLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 5,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	message: {
		status: 429,
		message: 'Demasiados mensajes desde esta IP. Espera unos minutos e inténtalo de nuevo.'
	}
});
