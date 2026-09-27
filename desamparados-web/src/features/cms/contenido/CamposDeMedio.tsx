import { useState } from 'react'
import { Stack, TextField, ToggleButton, ToggleButtonGroup } from '@mui/material'
import topes from '../../../../../shared/topes-contenido.json'
import CampoImagen from '../CampoImagen'
import CampoVideo from '../CampoVideo'
import { esVideoPropio } from '../../../lib/videoPropio'
import CampoTexto from './CampoTexto'
import type { MedioGaleria } from '../../../lib/api/contenido'

/**
 * Los campos de un medio de galería: la foto (o la dirección del vídeo y su
 * portada), la descripción y el pie.
 *
 * Lo comparten la galería de la Sagrada Titular y el bloque `galeria` del
 * constructor de páginas. Con una copia en cada sitio, los textos de ayuda y
 * los topes se separaban sin que nada avisara, y son justo los que explican por
 * qué el vídeo no se sube y por qué su portada es obligatoria.
 *
 * Un vídeo puede ser de dos sitios:
 *  - YouTube o Vimeo: se pega su dirección. Es lo que va mejor para los largos
 *    (la procesión entera, una homilía): ellos lo sirven y el VPS no gasta nada.
 *  - Subido desde el CMS: solo clips cortos (2 minutos y 15 MB como mucho, ver
 *    `shared/topes-video.json`), ya preparados en MP4. Cada visita que le da al
 *    play lo descarga de nuestro servidor, y por eso los topes.
 */
export default function CamposDeMedio({ medio, onCambio, etiquetaDireccion = 'Dirección del vídeo' }: {
  medio: MedioGaleria
  onCambio: (cambios: Partial<MedioGaleria>) => void
  /** Para distinguir dos vídeos en la misma pantalla, que si no comparten etiqueta. */
  etiquetaDireccion?: string
}) {
  // Sin dirección todavía, el origen lo elige quien edita; con ella, lo dice la dirección.
  const [propioElegido, setPropioElegido] = useState(false)
  const propio = medio.url === '' ? propioElegido : esVideoPropio(medio.url)
  const cambiarOrigen = (nuevo: boolean | null) => {
    if (nuevo === null || nuevo === propio) return
    setPropioElegido(nuevo)
    // La dirección de un origen no vale en el otro.
    onCambio({ url: '' })
  }

  return (
    <Stack spacing={2}>
      {medio.tipo === 'video' && (
        <ToggleButtonGroup exclusive size="small" value={propio} onChange={(_, valor: boolean | null) => cambiarOrigen(valor)}
          aria-label="De dónde es el vídeo">
          <ToggleButton value={false}>YouTube o Vimeo</ToggleButton>
          <ToggleButton value={true}>Subir un clip corto</ToggleButton>
        </ToggleButtonGroup>
      )}
      {medio.tipo === 'video' && propio ? (
        <>
          <CampoVideo
            valor={medio.url}
            uso="galeria"
            etiqueta={etiquetaDireccion.replace('Dirección del vídeo', 'Vídeo')}
            conPortada
            onCambio={(url, portada) => onCambio(portada ? { url, portada } : { url })}
            ayuda="Si pasa del minuto, expórtalo a 720p: con 15 MB se verá mejor que en 1080p. Al subirlo se saca sola una foto suya de portada; la puedes cambiar abajo. Para vídeos más largos, YouTube o Vimeo."
          />
          <CampoImagen
            valor={medio.portada}
            onCambio={(portada) => onCambio({ portada })}
            etiqueta="Foto de portada del vídeo"
            ayuda="JPG, PNG o WebP apaisado, de hasta 5 MB. Es lo que se ve antes de darle al play: así nadie se descarga el vídeo solo por abrir la página."
            apaisada
          />
        </>
      ) : medio.tipo === 'video' ? (
        <>
          <TextField
            label={etiquetaDireccion}
            value={medio.url}
            onChange={(e) => onCambio({ url: e.target.value })}
            fullWidth
            placeholder="https://www.youtube.com/watch?v=…"
            helperText="Pega la dirección de YouTube o Vimeo. Se guarda en su forma sin cookies, y el vídeo no se carga hasta que alguien pulsa el play."
          />
          <CampoImagen
            valor={medio.portada}
            onCambio={(portada) => onCambio({ portada })}
            etiqueta="Foto de portada del vídeo"
            ayuda="JPG, PNG o WebP apaisado, de hasta 5 MB. Es lo que se ve antes de darle al play, en vez de pedirle la miniatura a YouTube."
            apaisada
          />
        </>
      ) : (
        <CampoImagen
          valor={medio.url}
          onCambio={(url) => onCambio({ url })}
          etiqueta="Foto"
          ayuda="JPG, PNG o WebP apaisado, de hasta 5 MB."
          apaisada
        />
      )}

      <CampoTexto
        etiqueta="Descripción"
        valor={medio.alt}
        onCambio={(alt) => onCambio({ alt })}
        ayuda="Lo que se ve, en una frase. Es lo que oye quien usa un lector de pantalla."
        maxLength={topes.descripcion}
      />
      <CampoTexto
        etiqueta="Pie (opcional)"
        valor={medio.pie}
        onCambio={(pie) => onCambio({ pie })}
        ayuda="Frase corta bajo la foto o el vídeo. Se puede dejar vacía."
        maxLength={topes.etiqueta}
      />
    </Stack>
  )
}
