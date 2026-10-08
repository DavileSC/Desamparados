import rateLimit from 'express-rate-limit';

// 1. Limitador Global (Para toda la API)
// Evita ataques de denegación de servicio (DDoS) básicos.
export const globalLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutos
	// 1000 por IP cada 15 minutos (~1 por segundo sostenido). Con 100, una visita
	// a la portada (~6 peticiones) y un rato en el CMS bastaban para dejar al
	// editor sin guardar y sin sesión. La fuerza bruta la frena authLimiter.
	// LIMITE_GLOBAL_POR_IP lo sube para las pruebas de carga del servidor de
	// pruebas, que salen todas de una misma IP (docs/servidor.md). Se lee en cada
	// petición: cambiarla en el .env y reiniciar la API basta.
	limit: () => Number(process.env.LIMITE_GLOBAL_POR_IP) || 1000,
	standardHeaders: 'draft-7', // Usa el estándar moderno de cabeceras IETF
	legacyHeaders: false, // Deshabilita las cabeceras `X-RateLimit-*`
	message: {
		status: 429,
		message: "Demasiadas peticiones desde esta IP, por favor intenta de nuevo en 15 minutos."
	}
});

// 2. Limitador Estricto (Para Login/Registro/2FA/Reset)
// Evita fuerza bruta para adivinar contraseñas o códigos TOTP.
// Nota: el lockout por CUENTA del 2FA (5 fallos → bloqueo creciente de 15 min a 24 h) cubre
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

// 3. Limitador de la entrada (contraseña, código del 2FA y enlace de recuperación)
// Igual que el estricto, pero solo cuenta lo que sale mal. Contando también los
// aciertos, veinte personas que entraban bien desde una misma IP —el wifi de la
// casa de hermandad o los móviles que comparten IP en su operadora (CGNAT)—
// dejaban a la siguiente quince minutos fuera con la contraseña buena. La
// fuerza bruta solo produce fallos, así que contra ella frena igual.
export const limitadorEntrada = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 20,
	skipSuccessfulRequests: true,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	message: {
		status: 429,
		message: "Demasiados intentos de inicio de sesión. Por seguridad, espera 15 minutos."
	}
});

// El formulario público puede provocar spam de correo, por lo que tiene un
// límite propio más estricto que el resto de lecturas de la API.
/**
 * Empezar un donativo apunta un pago pendiente y habla con el banco: sin
 * sesión, se acota como el formulario de contacto, algo más holgado porque
 * quien se equivoca de tarjeta vuelve a intentarlo.
 */
export const limitadorDonativo = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	message: {
		status: 429,
		message: 'Demasiados intentos de donativo desde esta IP. Espera unos minutos e inténtalo de nuevo.'
	}
});

export const limitadorContacto = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 5,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	message: {
		status: 429,
		message: 'Demasiados mensajes desde esta IP. Espera unos minutos e inténtalo de nuevo.'
	}
});

// Las compras de la tienda, sin cuenta: cada una apunta un pedido y puede
// mandar un correo. Holgado para quien reintenta un pago, corto para un robot.
export const limitadorCompras = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	message: {
		status: 429,
		message: 'Demasiados pedidos desde esta IP. Espera unos minutos e inténtalo de nuevo.'
	}
});
