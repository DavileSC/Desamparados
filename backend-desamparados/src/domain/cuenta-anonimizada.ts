/**
 * Cómo se reconoce una cuenta anonimizada por el derecho de supresión (art. 17
 * RGPD, `DELETE /auth/mi-cuenta`).
 *
 * El esquema no tiene una columna que lo diga: `AuthService.deleteOwnAccount`
 * sobrescribe el correo con `anon-<id>@eliminado.local` y el DNI con
 * `ELIMINADO-<id>`. Si ese formato cambia allí, tiene que cambiar aquí; por eso
 * vive en un solo sitio y con test (test/censo-altas-bajas.test.ts).
 */
export const DOMINIO_CUENTA_ELIMINADA = '@eliminado.local';
export const PREFIJO_DNI_ELIMINADO = 'ELIMINADO-';

export function esCuentaAnonimizada(cuenta: { email: string; dni: string }): boolean {
  // Basta con una de las dos marcas: ningún correo real acaba en `.local` y
  // ningún DNI válido empieza por letras.
  return cuenta.email.endsWith(DOMINIO_CUENTA_ELIMINADA) || cuenta.dni.startsWith(PREFIJO_DNI_ELIMINADO);
}
