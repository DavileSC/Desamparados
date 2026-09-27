import { useEffect, useState } from 'react'
import { Alert } from '@mui/material'

/** El ancho de la cabecera en una pantalla grande: por debajo, la foto se estira para llenarla. */
const ANCHO_MINIMO_CABECERA = 1920

type Medida = { ancho: number; alto: number }

/**
 * Avisa si una foto de la cabecera se va a ver mal en una pantalla grande.
 *
 * La cabecera es apaisada y a todo lo ancho: una foto vertical se estira hasta
 * cubrir el ancho y se recorta a una franja, y una estrecha se estira y se
 * emborrona. No se prohíbe —en el móvil una vertical va bien—, pero quien la
 * sube tiene que saberlo antes de publicarla. Mira la foto ya subida (el
 * servidor la deja en 1920 px como mucho), así que también avisa de las que
 * ya estaban puestas.
 */
export default function AvisoFotoDeCabecera({ url }: { url: string }) {
  const [medida, setMedida] = useState<Medida | null>(null)

  useEffect(() => {
    setMedida(null)
    if (!url) return
    let vivo = true
    const imagen = new Image()
    imagen.onload = () => { if (vivo) setMedida({ ancho: imagen.naturalWidth, alto: imagen.naturalHeight }) }
    imagen.src = url
    return () => { vivo = false }
  }, [url])

  if (!medida || !medida.ancho) return null
  const { ancho, alto } = medida

  if (alto > ancho) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Esta foto es vertical ({ancho} × {alto} píxeles). En la cabecera se recorta a una franja estrecha y en
        pantallas grandes se ve estirada y borrosa. Mejor una foto horizontal de al menos {ANCHO_MINIMO_CABECERA} píxeles
        de ancho.
      </Alert>
    )
  }
  if (ancho < ANCHO_MINIMO_CABECERA) {
    return (
      <Alert severity="warning" sx={{ mt: 2 }}>
        Esta foto mide {ancho} píxeles de ancho. En pantallas grandes se verá estirada y algo borrosa. Mejor una de al
        menos {ANCHO_MINIMO_CABECERA}.
      </Alert>
    )
  }
  return null
}
