import crypto from 'node:crypto';

/**
 * Cifrado en reposo del secreto TOTP (`User.twoFactorSecret`).
 *
 * En claro, una copia de la base de datos (un volcado, una copia de seguridad
 * olvidada) bastaba para generar los códigos de cualquier cargo: el segundo
 * factor dejaba de ser un segundo factor. Con AES-256-GCM el volcado no sirve
 * sin la clave, que vive en el entorno y no en la base.
 *
 * Formato guardado: `v1:<iv>:<etiqueta>:<cifrado>`, cada trozo en base64url.
 * El prefijo de versión distingue los secretos cifrados de los antiguos en
 * claro (Base32 puro, que nunca lleva «:») y deja sitio a un `v2` si algún día
 * cambia el algoritmo. Los antiguos siguen funcionando: se cifran al leerlos o
 * con `scripts/cifrar-secretos-2fa.ts`.
 *
 * Rotación: la clave nueva va en TOTP_ENC_KEY y la de antes en
 * TOTP_ENC_KEY_ANTERIOR. Se lee con cualquiera de las dos y se escribe siempre
 * con la nueva; `npm run 2fa:cifrar-secretos` pasa todo a la nueva y después
 * la anterior se quita. Sin este paso, cambiar la clave dejaba ilegibles todos
 * los secretos y ningún cargo con 2FA podía entrar (ver docs/despliegue.md).
 */

const PREFIJO_V1 = 'v1:';
const IV_BYTES = 12; // El tamaño recomendado para GCM
// GCM admite etiquetas truncadas (hasta 4 bytes) si no se fija la longitud: con
// una de 4 bytes, falsificar un cifrado deja de ser impensable. Se exige la entera.
const ETIQUETA_BYTES = 16;
const INFO_HKDF = 'desamparados/totp-secret/v1';
const HEX_64 = /^[0-9a-f]{64}$/i;

export interface ClaveTotp {
  /** Con la que se cifra, y la primera que se prueba al leer. */
  clave: Buffer;
  /** true si no hay TOTP_ENC_KEY y la clave sale de JWT_SECRET (solo fuera de producción). */
  derivada: boolean;
  /** Otras claves con las que se admite leer (rotación y paso de desarrollo a clave propia). */
  anteriores: Buffer[];
}

/** El secreto está cifrado con una clave que no es ninguna de las configuradas. */
export class SecretoTotpIlegibleError extends Error {
  constructor() {
    super(
      'No se ha podido descifrar un secreto del doble factor con TOTP_ENC_KEY ni con TOTP_ENC_KEY_ANTERIOR: ' +
      'la clave se ha cambiado sin conservar la anterior. Ver «Rotar TOTP_ENC_KEY» en docs/despliegue.md.'
    );
    this.name = 'SecretoTotpIlegibleError';
  }
}

type Entorno = Record<string, string | undefined>;

function derivarDeJwt(jwtSecret: string): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', jwtSecret, 'desamparados', INFO_HKDF, 32));
}

function claveHex(nombre: string, hex: string): Buffer {
  if (!HEX_64.test(hex)) {
    throw new Error(
      `${nombre} debe tener 64 caracteres hexadecimales (32 bytes). Genera una con: npm run gen:clave-totp`
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Decide las claves a partir del entorno. Pura (recibe el entorno) para poder
 * probar el caso de producción sin tocar `process.env`.
 *
 * Sin TOTP_ENC_KEY fuera de producción se deriva una de JWT_SECRET: así el
 * desarrollo y el CI no se rompen por una variable nueva. En producción eso
 * sería atar dos secretos que deben poder rotarse por separado, así que falla.
 */
export function resolverClaveTotp(entorno: Entorno = process.env): ClaveTotp {
  const produccion = entorno.NODE_ENV === 'production';
  const hex = entorno.TOTP_ENC_KEY?.trim();
  const hexAnterior = entorno.TOTP_ENC_KEY_ANTERIOR?.trim();
  const anteriores = hexAnterior ? [claveHex('TOTP_ENC_KEY_ANTERIOR', hexAnterior)] : [];

  if (hex) {
    // Fuera de producción se admite también la derivada: si alguien añade
    // TOTP_ENC_KEY a su .env después de haber activado el 2FA, sus secretos se
    // cifraron con ella y sin esto su cuenta no podría entrar al CMS.
    if (!produccion && entorno.JWT_SECRET) anteriores.push(derivarDeJwt(entorno.JWT_SECRET));
    return { clave: claveHex('TOTP_ENC_KEY', hex), derivada: false, anteriores };
  }

  if (produccion) {
    throw new Error('Falta TOTP_ENC_KEY: en producción el secreto del doble factor no puede guardarse sin su propia clave.');
  }
  if (!entorno.JWT_SECRET) {
    throw new Error('Sin TOTP_ENC_KEY ni JWT_SECRET no hay de dónde sacar la clave del doble factor.');
  }
  return { clave: derivarDeJwt(entorno.JWT_SECRET), derivada: true, anteriores };
}

// Perezosa: se resuelve en el primer uso y no al importar, para no depender del
// orden en que se cargan los módulos respecto a dotenv.
let claveActual: ClaveTotp | null = null;

function claves(): ClaveTotp {
  if (!claveActual) {
    claveActual = resolverClaveTotp();
    if (claveActual.derivada) {
      console.warn(
        '⚠️  [2FA] Sin TOTP_ENC_KEY: el secreto del doble factor se cifra con una clave derivada de JWT_SECRET. ' +
        'Vale para desarrollo; en producción define TOTP_ENC_KEY.'
      );
    }
  }
  return claveActual;
}

export const estaCifrado = (almacenado: string): boolean => almacenado.startsWith(PREFIJO_V1);

export function cifrarSecretoTotp(secretoBase32: string, claveCifrado: Buffer = claves().clave): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cifrador = crypto.createCipheriv('aes-256-gcm', claveCifrado, iv, { authTagLength: ETIQUETA_BYTES });
  const cifrado = Buffer.concat([cifrador.update(secretoBase32, 'utf8'), cifrador.final()]);
  const etiqueta = cifrador.getAuthTag();
  return `${PREFIJO_V1}${iv.toString('base64url')}:${etiqueta.toString('base64url')}:${cifrado.toString('base64url')}`;
}

function descifrarCon(almacenado: string, claveCifrado: Buffer): string | null {
  const [ivTexto, etiquetaTexto, cifrado] = almacenado.slice(PREFIJO_V1.length).split(':');
  if (!ivTexto || !etiquetaTexto || !cifrado) return null;
  const iv = Buffer.from(ivTexto, 'base64url');
  const etiqueta = Buffer.from(etiquetaTexto, 'base64url');
  if (iv.length !== IV_BYTES || etiqueta.length !== ETIQUETA_BYTES) return null;
  try {
    const descifrador = crypto.createDecipheriv('aes-256-gcm', claveCifrado, iv, { authTagLength: ETIQUETA_BYTES });
    descifrador.setAuthTag(etiqueta);
    return Buffer.concat([descifrador.update(Buffer.from(cifrado, 'base64url')), descifrador.final()]).toString('utf8');
  } catch {
    // GCM rechaza la etiqueta: clave equivocada o valor manipulado.
    return null;
  }
}

/**
 * Devuelve el secreto en claro y si conviene volver a guardarlo: los antiguos
 * en claro y los cifrados con una clave que ya no es la principal se
 * reescriben con la actual en cuanto se leen.
 *
 * `conClaves` es para los tests; en la aplicación salen del entorno.
 */
export function leerSecretoTotp(
  almacenado: string,
  conClaves: ClaveTotp = claves()
): { secreto: string; recifrar: boolean } {
  if (!estaCifrado(almacenado)) return { secreto: almacenado, recifrar: true };

  const conPrincipal = descifrarCon(almacenado, conClaves.clave);
  if (conPrincipal !== null) return { secreto: conPrincipal, recifrar: false };

  for (const anterior of conClaves.anteriores) {
    const secreto = descifrarCon(almacenado, anterior);
    if (secreto !== null) return { secreto, recifrar: true };
  }

  throw new SecretoTotpIlegibleError();
}
