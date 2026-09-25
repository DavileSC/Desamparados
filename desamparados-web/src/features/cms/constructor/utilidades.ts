import topes from '../../../../../shared/topes-contenido.json'

/**
 * Un ancla escrita a mano, dejada como slug mientras se escribe: minúsculas,
 * sin tildes, guiones en vez de espacios. Así no se puede escribir una que el
 * servidor vaya a rechazar.
 */
export const aAncla = (texto: string) => texto
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '')
  .slice(0, topes.ancla)
