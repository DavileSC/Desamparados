/**
 * Las dos primeras cifras de un código postal español son su provincia. Con
 * eso el alta rellena sola la provincia y la comunidad autónoma: quien escribe
 * «29013» no tiene que teclear «Málaga» y «Andalucía». Se pueden cambiar a mano.
 */
const PROVINCIAS: Record<string, [provincia: string, comunidad: string]> = {
  '01': ['Álava', 'País Vasco'],
  '02': ['Albacete', 'Castilla-La Mancha'],
  '03': ['Alicante', 'Comunidad Valenciana'],
  '04': ['Almería', 'Andalucía'],
  '05': ['Ávila', 'Castilla y León'],
  '06': ['Badajoz', 'Extremadura'],
  '07': ['Illes Balears', 'Illes Balears'],
  '08': ['Barcelona', 'Cataluña'],
  '09': ['Burgos', 'Castilla y León'],
  '10': ['Cáceres', 'Extremadura'],
  '11': ['Cádiz', 'Andalucía'],
  '12': ['Castellón', 'Comunidad Valenciana'],
  '13': ['Ciudad Real', 'Castilla-La Mancha'],
  '14': ['Córdoba', 'Andalucía'],
  '15': ['A Coruña', 'Galicia'],
  '16': ['Cuenca', 'Castilla-La Mancha'],
  '17': ['Girona', 'Cataluña'],
  '18': ['Granada', 'Andalucía'],
  '19': ['Guadalajara', 'Castilla-La Mancha'],
  '20': ['Gipuzkoa', 'País Vasco'],
  '21': ['Huelva', 'Andalucía'],
  '22': ['Huesca', 'Aragón'],
  '23': ['Jaén', 'Andalucía'],
  '24': ['León', 'Castilla y León'],
  '25': ['Lleida', 'Cataluña'],
  '26': ['La Rioja', 'La Rioja'],
  '27': ['Lugo', 'Galicia'],
  '28': ['Madrid', 'Comunidad de Madrid'],
  '29': ['Málaga', 'Andalucía'],
  '30': ['Murcia', 'Región de Murcia'],
  '31': ['Navarra', 'Comunidad Foral de Navarra'],
  '32': ['Ourense', 'Galicia'],
  '33': ['Asturias', 'Principado de Asturias'],
  '34': ['Palencia', 'Castilla y León'],
  '35': ['Las Palmas', 'Canarias'],
  '36': ['Pontevedra', 'Galicia'],
  '37': ['Salamanca', 'Castilla y León'],
  '38': ['Santa Cruz de Tenerife', 'Canarias'],
  '39': ['Cantabria', 'Cantabria'],
  '40': ['Segovia', 'Castilla y León'],
  '41': ['Sevilla', 'Andalucía'],
  '42': ['Soria', 'Castilla y León'],
  '43': ['Tarragona', 'Cataluña'],
  '44': ['Teruel', 'Aragón'],
  '45': ['Toledo', 'Castilla-La Mancha'],
  '46': ['Valencia', 'Comunidad Valenciana'],
  '47': ['Valladolid', 'Castilla y León'],
  '48': ['Bizkaia', 'País Vasco'],
  '49': ['Zamora', 'Castilla y León'],
  '50': ['Zaragoza', 'Aragón'],
  '51': ['Ceuta', 'Ceuta'],
  '52': ['Melilla', 'Melilla'],
}

/** Provincia y comunidad de un código postal, o null si no es uno español válido. */
export function provinciaDeCodigoPostal(codigoPostal: string): { provincia: string; comunidad: string } | null {
  const cp = codigoPostal.trim()
  if (!/^\d{5}$/.test(cp)) return null
  const encontrada = PROVINCIAS[cp.slice(0, 2)]
  return encontrada ? { provincia: encontrada[0], comunidad: encontrada[1] } : null
}

/** ¿Lo escribió la tabla (y se puede pisar) o la persona (y se respeta)? */
const DE_LA_TABLA = new Set(Object.values(PROVINCIAS).flat())
export const esDeLaTabla = (valor: string) => valor.trim() === '' || DE_LA_TABLA.has(valor.trim())
