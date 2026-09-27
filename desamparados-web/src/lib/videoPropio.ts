/**
 * Los vídeos subidos desde el CMS: un MP4 en la raíz de /storage/public, igual
 * que `VIDEO_PROPIO` del backend (utils/rutas-propias.ts). Lo que no es esto es
 * un vídeo de YouTube o Vimeo, que se ve en su marco.
 */
const VIDEO_PROPIO = /^\/storage\/public\/[a-f0-9]{32}\.mp4$/i

export const esVideoPropio = (url: string) => VIDEO_PROPIO.test(url)

interface ConexionDelNavegador { saveData?: boolean; effectiveType?: string }

/**
 * Si el visitante ha pedido gastar pocos datos (el «ahorro de datos» del
 * móvil) o va con una conexión lenta. Entonces no se le descarga ningún vídeo
 * que no haya pedido: el hero se queda en sus fotos.
 *
 * `navigator.connection` solo existe en Chrome y derivados; en Safari y
 * Firefox esto dice siempre que no, y ahí manda `prefers-reduced-motion`.
 */
export function ahorraDatos(): boolean {
  const conexion = (navigator as Navigator & { connection?: ConexionDelNavegador }).connection
  if (!conexion) return false
  return conexion.saveData === true || ['slow-2g', '2g', '3g'].includes(conexion.effectiveType ?? '')
}
