/**
 * Los formularios de un puñado de campos: el texto con su editor, la llamada a
 * la acción, el listado automático y el bloque de contacto.
 */
import { Stack, TextField, Typography } from '@mui/material'
import topes from '../../../../../../shared/topes-contenido.json'
import EditorTexto from '../../EditorTexto'
import CampoTexto from '../../contenido/CampoTexto'
import CampoEnlace from '../../contenido/CampoEnlace'
import EditorDeLineas from './EditorDeLineas'
import type { Props } from './comunes'
import type { BloqueTexto, BloqueLlamada, BloqueListado, BloqueContacto, FuenteListado } from '../../../../lib/api/contenido'

export function FormularioTexto({ bloque, onCambio }: Props<BloqueTexto>) {
  return (
    <EditorTexto
      valor={bloque.html}
      onCambio={(html) => onCambio({ html })}
      etiqueta="Contenido del bloque"
    />
  )
}

export function FormularioLlamada({ bloque, onCambio }: Props<BloqueLlamada>) {
  return (
    <Stack spacing={2}>
      <CampoTexto
        etiqueta="Texto"
        valor={bloque.texto}
        onCambio={(texto) => onCambio({ texto })}
        ayuda="Párrafo dentro del recuadro, encima del botón. Se puede dejar vacío."
        maxLength={topes.parrafo}
        multilinea
      />
      <TextField label="Texto del botón" value={bloque.boton}
        onChange={(e) => onCambio({ boton: e.target.value })} size="small" fullWidth
        helperText="Lo que se lee dentro del botón, como «Hazte hermano». Sin esto el bloque no se puede guardar."
        slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
      <CampoEnlace etiqueta="Destino del botón" valor={bloque.enlace}
        onCambio={(enlace) => onCambio({ enlace })}
        ayuda="La página a la que lleva el botón." />
    </Stack>
  )
}

/** Una línea recién añadida, en blanco. */

const FUENTES: { valor: FuenteListado; nombre: string; ayuda: string }[] = [
  { valor: 'noticias-recientes', nombre: 'Últimas noticias (3)', ayuda: 'Las tres noticias más recientes, con un enlace a todas. Se escriben en «Noticias».' },
  { valor: 'agenda-proxima', nombre: 'Próximos actos (4)', ayuda: 'Los cuatro próximos actos, con un enlace a la agenda completa. Se escriben en «Agenda».' },
  { valor: 'noticias', nombre: 'Todas las noticias', ayuda: 'El archivo entero, por páginas, con la última noticia destacada. Se escriben en «Noticias».' },
  { valor: 'agenda', nombre: 'Agenda completa', ayuda: 'Todos los actos por venir, por páginas. Se escriben en «Agenda».' },
  { valor: 'publicaciones', nombre: 'Todas las publicaciones', ayuda: 'Boletines, dossieres y el resto, por páginas. Se suben en «Publicaciones».' },
  { valor: 'boletines', nombre: 'Boletines', ayuda: 'Solo los boletines, por páginas. Se suben en «Publicaciones».' },
  { valor: 'dossier', nombre: 'Dossier de prensa', ayuda: 'Solo las apariciones en los medios, por páginas. Se suben en «Publicaciones».' },
]

export function FormularioListado({ bloque, onCambio }: Props<BloqueListado>) {
  const fuente = FUENTES.find((f) => f.valor === bloque.fuente)
  return (
    <TextField
      select
      label="Qué se enseña"
      value={bloque.fuente}
      onChange={(e) => onCambio({ fuente: e.target.value as FuenteListado })}
      helperText={fuente?.ayuda ?? 'Elige de dónde salen los elementos.'}
      slotProps={{ select: { native: true } }}
      size="small"
      fullWidth
    >
      {FUENTES.map((f) => <option key={f.valor} value={f.valor}>{f.nombre}</option>)}
    </TextField>
  )
}

export function FormularioContacto({ bloque, onCambio }: Props<BloqueContacto>) {
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        El formulario (nombre, email, teléfono, asunto y mensaje) es fijo: lo que se envía llega por
        correo. Aquí se edita la tarjeta que va a su lado. Sin líneas, la tarjeta no sale y el
        formulario ocupa todo el ancho.
      </Typography>
      <CampoTexto
        etiqueta="Título de la tarjeta"
        valor={bloque.tituloDatos}
        onCambio={(tituloDatos) => onCambio({ tituloDatos })}
        ayuda="Encabezado de la tarjeta, como «Datos de contacto». Puede quedar vacío."
        maxLength={topes.titulo}
      />
      <Typography variant="subtitle2">Líneas de la tarjeta</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mt: '0 !important' }}>
        El icono de cada línea sale solo: un sobre si el valor es un correo, un teléfono si son cifras,
        un reloj si el concepto habla de horario y un marcador si habla de dirección.
      </Typography>
      <EditorDeLineas lineas={bloque.lineas} onCambio={(lineas) => onCambio({ lineas })} minimo={0} />
    </Stack>
  )
}

/** Una parada recién añadida, con una hora que parece una hora. */
