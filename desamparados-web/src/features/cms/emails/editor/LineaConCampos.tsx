import { useEffect, useRef } from 'react'
import { Box, type SxProps, type Theme } from '@mui/material'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import type { CampoDeUso } from '../../../../lib/api/emails'
import { extensionesDeLinea } from './extensiones'
import { textoAlEditor, textoDelEditor } from './piezas'
import { HOJA } from './hoja'

interface Props {
  etiqueta: string
  valor: string
  onCambio: (texto: string) => void
  campos: Map<string, CampoDeUso>
  /** Al entrar en la línea: el panel de datos mete los campos en la última que tuvo el cursor. */
  onActivar: (editor: Editor) => void
  placeholder?: string
  sx?: SxProps<Theme>
}

/**
 * Una línea que se escribe como el texto del correo, con los datos como
 * pastillas: el asunto, el título, la despedida. Por dentro es `{{clave}}`,
 * como lo guarda el servidor.
 */
export default function LineaConCampos({ etiqueta, valor, onCambio, campos, onActivar, placeholder, sx }: Props) {
  // El último texto que salió de aquí, para distinguirlo del que llega de fuera (volver a una versión).
  const emitido = useRef(valor)
  const editor = useEditor({
    extensions: extensionesDeLinea(campos),
    content: textoAlEditor(valor),
    editorProps: { attributes: { 'aria-label': etiqueta, role: 'textbox', 'aria-multiline': 'false', spellcheck: 'true' } },
    onUpdate: ({ editor: e }) => {
      emitido.current = textoDelEditor(e.getJSON())
      onCambio(emitido.current)
    },
    onFocus: ({ editor: e }) => onActivar(e),
  })

  useEffect(() => {
    if (!editor || valor === emitido.current) return
    emitido.current = valor
    editor.commands.setContent(textoAlEditor(valor), { emitUpdate: false })
  }, [editor, valor])

  return (
    <Box
      sx={[
        {
          position: 'relative',
          '& .ProseMirror': { outline: 'none', minHeight: '1.3em', borderRadius: '3px', px: '4px', mx: '-4px' },
          '& .ProseMirror:hover': { bgcolor: 'rgba(0,0,0,0.03)' },
          '& .ProseMirror-focused': { bgcolor: 'rgba(0,0,0,0.04)', boxShadow: 'inset 0 -1px 0 #b9aca4' },
          '& .ProseMirror p': { m: 0 },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {placeholder && !valor && (
        <Box component="span" aria-hidden sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', color: HOJA.suave, fontStyle: 'italic' }}>{placeholder}</Box>
      )}
      <EditorContent editor={editor} />
    </Box>
  )
}
