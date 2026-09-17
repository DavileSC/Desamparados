import { Stack, TextField } from '@mui/material'
import topes from '../../../../../shared/topes-contenido.json'
import EditorTexto from '../EditorTexto'
import CampoImagen from '../CampoImagen'
import CampoTexto from '../contenido/CampoTexto'
import type { BloqueTexto, BloqueFoto, BloqueTarjetas } from '../../../lib/api/contenido'

/**
 * El formulario de cada tipo de bloque: los tres juntos en este fichero,
 * separados del registro de `formularios.tsx` (`NOMBRE_BLOQUE`, `FORMULARIOS`,
 * `BLOQUE_NUEVO`). Un fichero que declara componentes Y exporta datos sueltos
 * rompe el *fast refresh* de Vite (aviso `react/only-export-components`), así
 * que la separación es esa y no otra: `components/bloques/registro.tsx` evita
 * el mismo aviso con un componente por fichero, pero aquí los tres formularios
 * son pequeños y solo los usa `formularios.tsx`, así que basta con un fichero
 * para los tres en vez de tres ficheros de uno.
 */

export type Props<T> = { bloque: T; onCambio: (cambios: Partial<T>) => void }

export function FormularioTexto({ bloque, onCambio }: Props<BloqueTexto>) {
  return (
    <EditorTexto
      valor={bloque.html}
      onCambio={(html) => onCambio({ html })}
      etiqueta="Contenido del bloque"
    />
  )
}

export function FormularioFoto({ bloque, onCambio }: Props<BloqueFoto>) {
  return (
    <Stack spacing={2}>
      <CampoImagen
        valor={bloque.url}
        onCambio={(url) => onCambio({ url })}
        etiqueta="Foto"
        ayuda="JPG, PNG o WebP apaisado, de hasta 5 MB."
        apaisada
      />
      <CampoTexto
        etiqueta="Descripción"
        valor={bloque.alt}
        onCambio={(alt) => onCambio({ alt })}
        ayuda="Lo que se ve, en una frase. Es lo que oye quien usa un lector de pantalla."
        maxLength={topes.descripcion}
      />
      <CampoTexto
        etiqueta="Pie (opcional)"
        valor={bloque.pie}
        onCambio={(pie) => onCambio({ pie })}
        ayuda="Frase corta bajo la foto. Se puede dejar vacía."
        maxLength={topes.etiqueta}
      />
    </Stack>
  )
}

export function FormularioTarjetas({ bloque, onCambio }: Props<BloqueTarjetas>) {
  const cambiar = (indice: number, campo: 'titulo' | 'descripcion' | 'enlace', valor: string) =>
    onCambio({ tarjetas: bloque.tarjetas.map((t, i) => (i === indice ? { ...t, [campo]: valor } : t)) })

  return (
    <Stack spacing={2}>
      {bloque.tarjetas.map((tarjeta, indice) => (
        <Stack key={indice} spacing={1.5} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <TextField label={`Título de la tarjeta ${indice + 1}`} value={tarjeta.titulo}
            onChange={(e) => cambiar(indice, 'titulo', e.target.value)} size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.titulo } }} />
          <TextField label="Descripción" value={tarjeta.descripcion}
            onChange={(e) => cambiar(indice, 'descripcion', e.target.value)} size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.descripcion } }} />
          <TextField label="Enlace" value={tarjeta.enlace}
            onChange={(e) => cambiar(indice, 'enlace', e.target.value)} size="small" fullWidth
            helperText="Una ruta de este sitio, como /corporacion/historia" />
        </Stack>
      ))}
    </Stack>
  )
}
