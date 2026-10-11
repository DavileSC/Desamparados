import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import {
  Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormHelperText, Stack, TextField, ToggleButton, Tooltip, Typography,
} from '@mui/material'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined'
import TitleIcon from '@mui/icons-material/Title'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import { subirImagenPublica } from '../../lib/api/subida'

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

const inputOculto = {
  position: 'absolute', width: '1px', height: '1px', overflow: 'hidden',
  clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
} as const

interface Props {
  /** HTML actual del cuerpo. */
  valor: string
  onCambio: (html: string) => void
  etiqueta?: string
  ayuda?: string
}

/**
 * Editor del cuerpo de las noticias.
 *
 * Antes era un `TextField` rotulado «Contenido HTML»: para poner un título o una
 * lista había que escribir las etiquetas a mano, y quien no sepa HTML no podía
 * publicar nada.
 *
 * Lo que produce encaja a propósito con lo que el servidor deja pasar
 * (`backend/src/utils/sanear-html.ts` y `lib/limpiarHtml.ts`): sin `class`, sin
 * estilos en línea y con imágenes que solo pueden ser rutas propias. De ahí que
 * la imagen se suba desde aquí en vez de pedir una URL: una externa la borraría
 * el saneado al guardar, y el editor enseñaría una foto que nadie más vería.
 *
 * Los títulos empiezan en H2 porque el H1 de la página es el título de la
 * noticia; dos H1 en la misma página desordenan el esquema para los lectores de
 * pantalla y para los buscadores.
 */
export default function EditorTexto({
  valor,
  onCambio,
  etiqueta = 'Contenido',
  ayuda = 'Escribe con normalidad. Usa los botones para dar formato: no hace falta saber HTML.',
}: Props) {
  const idAyuda = useId()
  const [dialogoEnlace, setDialogoEnlace] = useState(false)
  const [urlEnlace, setUrlEnlace] = useState('')
  const [errorImagen, setErrorImagen] = useState<string | null>(null)
  const inputImagen = useRef<HTMLInputElement>(null)
  // El último HTML que salió de este editor, para distinguirlo del que llega de fuera.
  const ultimoEmitido = useRef(valor)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // El H1 lo pone la página con el título de la noticia.
        heading: { levels: [2, 3, 4] },
        link: { openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
      }),
      // Sin `class`: el saneado del servidor no la deja pasar y la imagen
      // llegaría sin ella de todas formas.
      Image.configure({ HTMLAttributes: {} }),
    ],
    content: valor,
    editorProps: {
      attributes: {
        // ProseMirror pinta un div contentEditable: sin esto no tiene nombre
        // accesible y no se puede localizar como campo de texto.
        role: 'textbox',
        'aria-label': etiqueta,
        'aria-multiline': 'true',
        'aria-describedby': idAyuda,
        style: 'outline: none; min-height: 14rem;',
      },
    },
    onUpdate: ({ editor: actual }) => {
      // Vacío es vacío: ProseMirror siempre conserva un párrafo, y ese
      // «<p></p>» tiene longitud suficiente para colarse por contenido en las
      // validaciones del servidor. Se guardaría una noticia con el cuerpo en
      // blanco sin que nada protestara.
      const html = actual.isEmpty ? '' : actual.getHTML()
      ultimoEmitido.current = html
      onCambio(html)
    },
  })

  /**
   * Contenido que llega de FUERA (la noticia recién cargada), frente al que
   * acabamos de emitir nosotros.
   *
   * Sin esta distinción se perdían letras al escribir: cada tecla emite el HTML
   * al formulario, el formulario vuelve a pintar, y este efecto comparaba el
   * `valor` del render anterior con el HTML de ahora. Como diferían, reescribía
   * el documento y se tragaba las teclas pulsadas entre medias («Texto» se
   * guardaba como «Txo»): los renders en cola traen valores ya viejos, así que
   * comparar contra el último emitido no basta. Mientras el editor tiene el
   * foco, quien manda es el teclado. Lo fija el test de NoticiasAdminPage que crea
   * una noticia.
   */
  useEffect(() => {
    if (!editor) return
    // Mientras se escribe mandan las teclas, no el formulario.
    if (editor.isFocused) return
    if (valor === ultimoEmitido.current || valor === editor.getHTML()) return
    ultimoEmitido.current = valor
    editor.commands.setContent(valor, { emitUpdate: false })
  }, [editor, valor])

  if (!editor) return null

  const abrirEnlace = () => {
    setUrlEnlace(editor.getAttributes('link').href ?? '')
    setDialogoEnlace(true)
  }

  const aplicarEnlace = () => {
    const url = urlEnlace.trim()
    setDialogoEnlace(false)
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const subirImagen = async (evento: ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return
    setErrorImagen(null)
    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      setErrorImagen('La foto tiene que ser JPG, PNG o WebP.')
      return
    }
    if (archivo.size > MAX_BYTES) {
      setErrorImagen('La foto no puede pasar de 5 MB.')
      return
    }
    try {
      const ruta = await subirImagenPublica(archivo)
      editor.chain().focus().setImage({ src: ruta, alt: archivo.name.replace(/\.[^.]+$/, '') }).run()
    } catch (e: unknown) {
      setErrorImagen(e instanceof Error ? e.message : 'No se ha podido subir la foto.')
    }
  }

  return (
    <Box>
      <Typography component="p" variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>{etiqueta}</Typography>

      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{ p: 0.75, flexWrap: 'wrap', rowGap: 0.75, borderBottom: 1, borderColor: 'divider', backgroundColor: 'action.hover' }}
        >
          <BotonFormato titulo="Negrita" activo={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><FormatBoldIcon fontSize="small" /></BotonFormato>
          <BotonFormato titulo="Cursiva" activo={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><FormatItalicIcon fontSize="small" /></BotonFormato>
          <BotonFormato titulo="Subrayado" activo={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><FormatUnderlinedIcon fontSize="small" /></BotonFormato>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <BotonFormato titulo="Título de sección" activo={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><TitleIcon fontSize="small" /></BotonFormato>
          <BotonFormato titulo="Título menor" activo={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><TitleIcon sx={{ fontSize: 16 }} /></BotonFormato>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <BotonFormato titulo="Lista" activo={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><FormatListBulletedIcon fontSize="small" /></BotonFormato>
          <BotonFormato titulo="Lista numerada" activo={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><FormatListNumberedIcon fontSize="small" /></BotonFormato>
          <BotonFormato titulo="Cita" activo={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><FormatQuoteIcon fontSize="small" /></BotonFormato>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <BotonFormato titulo="Enlace" activo={editor.isActive('link')} onClick={abrirEnlace}><LinkIcon fontSize="small" /></BotonFormato>
          {editor.isActive('link') && (
            <BotonFormato titulo="Quitar el enlace" activo={false} onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}><LinkOffIcon fontSize="small" /></BotonFormato>
          )}
          <BotonFormato titulo="Insertar foto" activo={false} onClick={() => inputImagen.current?.click()}><AddPhotoAlternateOutlinedIcon fontSize="small" /></BotonFormato>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <BotonFormato titulo="Deshacer" activo={false} desactivado={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><UndoIcon fontSize="small" /></BotonFormato>
          <BotonFormato titulo="Rehacer" activo={false} desactivado={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><RedoIcon fontSize="small" /></BotonFormato>
        </Stack>

        <Box sx={{
          p: 2,
          '& p:first-of-type': { mt: 0 },
          '& img': { maxWidth: '100%', height: 'auto' },
          '& blockquote': { borderLeft: 3, borderColor: 'divider', pl: 2, ml: 0, fontStyle: 'italic' },
        }}>
          <EditorContent editor={editor} />
        </Box>
      </Box>

      <FormHelperText id={idAyuda}>{ayuda}</FormHelperText>
      {errorImagen && <FormHelperText error>{errorImagen}</FormHelperText>}

      <Box component="input" ref={inputImagen} type="file" accept={TIPOS_IMAGEN.join(',')} onChange={(e: ChangeEvent<HTMLInputElement>) => void subirImagen(e)} sx={inputOculto} aria-hidden="true" tabIndex={-1} />

      <Dialog open={dialogoEnlace} onClose={() => setDialogoEnlace(false)} fullWidth maxWidth="sm">
        <DialogTitle>Enlace</DialogTitle>
        <DialogContent>
          <TextField
            label="Dirección"
            value={urlEnlace}
            onChange={(e) => setUrlEnlace(e.target.value)}
            placeholder="https://…"
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
            helperText="Déjalo en blanco para quitar el enlace. Se abrirá en una pestaña nueva."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogoEnlace(false)}>Cancelar</Button>
          <Button variant="contained" onClick={aplicarEnlace}>Aplicar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function BotonFormato({ titulo, activo, desactivado = false, onClick, children }: {
  titulo: string
  activo: boolean
  desactivado?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip title={titulo}>
      <span>
        <ToggleButton
          value={titulo}
          selected={activo}
          disabled={desactivado}
          onClick={onClick}
          size="small"
          aria-label={titulo}
          sx={{ border: 0, px: 1, py: 0.5 }}
        >
          {children}
        </ToggleButton>
      </span>
    </Tooltip>
  )
}
