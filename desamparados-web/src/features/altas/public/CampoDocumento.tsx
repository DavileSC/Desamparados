import { useId, useRef } from 'react'
import { Box, FormHelperText, Typography } from '@mui/material'
import Boton from '../../../components/Boton'

interface Props {
  etiqueta: string
  /** Qué se admite, para la ayuda y el selector del sistema: «JPG o PNG, hasta 5 MB». */
  ayuda: string
  aceptar: readonly string[]
  valor: File | null
  onCambiar: (fichero: File | null) => void
  error?: string
}

/**
 * Adjuntar un documento del alta. El `<input type="file">` del navegador no se
 * puede vestir ni dice nada útil («Ningún archivo seleccionado»): va escondido
 * y lo abre un botón, con el nombre del elegido al lado y la opción de quitarlo.
 */
export default function CampoDocumento({ etiqueta, ayuda, aceptar, valor, onCambiar, error }: Props) {
  const id = useId()
  const entrada = useRef<HTMLInputElement>(null)

  return (
    <Box>
      <Typography component="label" htmlFor={id} sx={{ display: 'block', fontSize: 15, mb: 1 }}>{etiqueta}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <input
          ref={entrada}
          id={id}
          type="file"
          accept={aceptar.join(',')}
          aria-describedby={`${id}-ayuda`}
          aria-invalid={!!error || undefined}
          onChange={(e) => {
            onCambiar(e.target.files?.[0] ?? null)
            // Vaciar el input deja volver a elegir el mismo fichero tras quitarlo.
            e.target.value = ''
          }}
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', opacity: 0 }}
        />
        <Boton type="button" appVariant="outline" onClick={() => entrada.current?.click()} sx={{ borderRadius: '3px', height: 40, px: 2 }}>
          {valor ? 'Cambiar' : 'Elegir archivo'}
        </Boton>
        {valor && (
          <>
            <Typography sx={{ fontSize: 14, overflowWrap: 'anywhere', minWidth: 0 }}>{valor.name}</Typography>
            <Box
              component="button"
              type="button"
              onClick={() => onCambiar(null)}
              aria-label={`Quitar ${valor.name}`}
              sx={{ appearance: 'none', border: 0, background: 'none', p: 0, font: 'inherit', fontSize: 14, color: 'secondary.main', textDecoration: 'underline', cursor: 'pointer' }}
            >
              Quitar
            </Box>
          </>
        )}
      </Box>
      <FormHelperText id={`${id}-ayuda`} error={!!error} sx={{ mx: 0 }}>{error ?? ayuda}</FormHelperText>
    </Box>
  )
}
