/**
 * El ancla de cada hito de la cronología. La usan dos sitios que tienen que
 * coincidir: el bloque, que la pone en cada hito, y el índice de la cabecera de
 * Historia, que enlaza a ella. Aparte del componente para no romper el *fast
 * refresh* de Vite (aviso `react/only-export-components`).
 */
export const idDeHito = (indice: number) => `hito-${indice + 1}`
