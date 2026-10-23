/** «12,5» o «12.5»: en España se escribe con coma. Null si no es un número. */
export const aNumero = (texto: string): number | null => {
  const limpio = texto.trim().replace(',', '.')
  return /^\d+(?:\.\d{1,2})?$/.test(limpio) ? Number(limpio) : null
}
