import { useState } from 'react'

/**
 * Si la foto `src` ha fallado. Las fijas de `config/fotosDeLaInstalacion.ts`
 * solo existen en la instalación que las tiene (en las demás, 404), y una foto
 * del contenido puede haberse borrado: quien la pinta la quita al fallar y deja
 * el fondo, en vez del icono roto con el texto alternativo encima.
 *
 * Se recuerda qué `src` falló y no un sí o un no: si cambia la foto (el CMS
 * elige otra), la nueva se intenta. `alFallar` va al `onError` del `<img>`, o
 * de tercer argumento a `propsDeFoto`, que solo lo llama cuando falla la
 * original y no una copia reducida.
 */
export function useFotoQueFalla(src: string | null | undefined) {
  const [fallida, setFallida] = useState<string | null>(null)
  return {
    /** Hay foto que pintar: tiene dirección y no ha fallado. */
    visible: Boolean(src) && fallida !== src,
    alFallar: () => setFallida(src ?? null),
  }
}
