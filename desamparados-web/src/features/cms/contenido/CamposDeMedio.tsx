import { Stack, TextField } from '@mui/material'
import topes from '../../../../../shared/topes-contenido.json'
import CampoImagen from '../CampoImagen'
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
 * Los vídeos no se suben: se pega su dirección. Un vídeo en el servidor ocupa
 * cientos de megas, hay que servirlo con ancho de banda propio y pasarlo por el
 * antivirus; y el Grupo Parroquial ya los publica en sus canales.
 */
export default function CamposDeMedio({ medio, onCambio, etiquetaDireccion = 'Dirección del vídeo' }: {
  medio: MedioGaleria
  onCambio: (cambios: Partial<MedioGaleria>) => void
  /** Para distinguir dos vídeos en la misma pantalla, que si no comparten etiqueta. */
  etiquetaDireccion?: string
}) {
  return (
    <Stack spacing={2}>
      {medio.tipo === 'video' ? (
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
