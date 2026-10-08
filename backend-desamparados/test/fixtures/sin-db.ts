// test/fixtures/sin-db.ts
//
// El motivo con que se omite una prueba cuando no hay MariaDB. Todos empiezan
// por «requiere MariaDB»: es lo que busca la guarda del CI
// (.github/workflows/verificacion.yml) para fallar si, con la base levantada,
// algo se ha omitido por no llegar a ella. Un motivo escrito a mano con otro
// texto («sin base de datos»…) se le escapaba y la suite quedaba en verde
// sin haber probado nada. Lo vigila `test/omisiones-sin-db.test.ts`.

/** El motivo de siempre. */
export const SIN_DB = 'requiere MariaDB levantada (DATABASE_HOST); arranca la base de datos para ejecutarlo';

/** Con el detalle de por qué no se pudo conectar (tiempo agotado, contraseña…). */
export const sinDb = (detalle: string) => `requiere MariaDB: ${detalle || 'no se pudo conectar'}`;
