// prisma/seed-cuentas.ts
//
// Qué cuentas crea la siembra según el entorno. Separado de seed.ts porque
// aquel ejecuta la siembra al importarse; esto es puro y lo cubre
// test/seed-cuentas.test.ts sin base de datos.
//
// Por qué existe: la siembra creaba `admin@cofradia.com` y
// `hermano@cofradia.com` en cualquier entorno, también en producción.
// cofradia.com es un dominio real con correo activo: los avisos de la cuenta de
// administrador (recuperación de contraseña incluida) le llegarían a un
// desconocido. Y un NODE_ENV mal escrito («prod») contaba como desarrollo y
// sembraba las contraseñas que están en el repositorio.

import { ArkErrors } from 'arktype';
import { email } from '../src/config/common';
import { motivoContrasenaDebil } from '../src/domain/password-debil';
import { laCorporacion } from '../src/domain/articulos';

type Entorno = Record<string, string | undefined>;

export const ENTORNOS_SIEMBRA = ['development', 'test', 'production'] as const;
export type EntornoSiembra = (typeof ENTORNOS_SIEMBRA)[number];

/** Cuentas de desarrollo: las usan los traspasos y las pruebas manuales. */
export const ADMIN_EMAIL_DESARROLLO = 'admin@cofradia.com';
export const HERMANO_EMAIL_DESARROLLO = 'hermano@cofradia.com';

export interface PlanCuentas {
  entorno: EntornoSiembra;
  adminEmail: string;
  /** La cuenta de hermano raso de prueba solo tiene sentido fuera de producción. */
  crearHermanoDePrueba: boolean;
}

export function planDeCuentas(entorno: Entorno = process.env): PlanCuentas {
  const nodeEnv = entorno.NODE_ENV?.trim();
  if (!nodeEnv || !(ENTORNOS_SIEMBRA as readonly string[]).includes(nodeEnv)) {
    throw new Error(
      `Siembra cancelada: NODE_ENV=${nodeEnv ? `"${nodeEnv}"` : '(sin definir)'} no es ${ENTORNOS_SIEMBRA.join(', ')}. ` +
      'Con cualquier otro valor se sembrarían las contraseñas de desarrollo, que están en el repositorio.'
    );
  }
  const env = nodeEnv as EntornoSiembra;
  const adminEmail = entorno.SEED_ADMIN_EMAIL?.trim();

  if (env !== 'production') {
    return { entorno: env, adminEmail: adminEmail || ADMIN_EMAIL_DESARROLLO, crearHermanoDePrueba: true };
  }

  if (!adminEmail) {
    throw new Error(
      'Siembra cancelada: en producción hay que indicar el correo del administrador con SEED_ADMIN_EMAIL ' +
      '(una dirección real del Grupo Parroquial, que recibirá la recuperación de contraseña).'
    );
  }
  if (email(adminEmail) instanceof ArkErrors) {
    throw new Error(`Siembra cancelada: SEED_ADMIN_EMAIL="${adminEmail}" no es un correo válido.`);
  }
  if (/@cofradia\.com$/i.test(adminEmail)) {
    throw new Error(
      'Siembra cancelada: cofradia.com es un dominio ajeno con correo activo. ' +
      'SEED_ADMIN_EMAIL debe ser una dirección del Grupo Parroquial.'
    );
  }

  const password = entorno.SEED_ADMIN_PASSWORD;
  if (password) {
    const motivo = motivoContrasenaDebil(password, laCorporacion());
    if (motivo) throw new Error(`Siembra cancelada: SEED_ADMIN_PASSWORD no vale, la contraseña ${motivo}.`);
  }

  return { entorno: env, adminEmail, crearHermanoDePrueba: false };
}
