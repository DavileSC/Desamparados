import { useState } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Stack, Tooltip } from '@mui/material'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import LinkIcon from '@mui/icons-material/Link'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import UndoIcon from '@mui/icons-material/Undo'
import RedoIcon from '@mui/icons-material/Redo'
import { useEditorState, type Editor } from '@tiptap/react'
import CampoEnlace from './CampoEnlace'
import { enlaceValido } from './enlaces'

/**
 * La barra de formato del texto del correo, encima de la hoja y siempre a la
 * vista mientras se baja: negrita, cursiva, enlace y lista. Nada de tamaños
 * ni colores: el correo tiene los suyos.
 */
export default function BarraDeFormato({ editor }: { editor: Editor }) {
  const estado = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      negrita: e.isActive('bold'),
      cursiva: e.isActive('italic'),
      enlace: e.isActive('link'),
      lista: e.isActive('bulletList'),
      // En un botón, una foto o un bloque de la web no hay texto al que dar formato.
      enTexto: e.isActive('paragraph') || e.isActive('oracion'),
      deshacer: e.can().undo(),
      rehacer: e.can().redo(),
    }),
  })
  const [enlace, setEnlace] = useState<string | null>(null)

  const abrirEnlace = () => setEnlace(String(editor.getAttributes('link').href ?? ''))
  const ponerEnlace = () => {
    if (enlace === null || !enlaceValido(enlace)) return
    editor.chain().focus().extendMarkRange('link').setLink({ href: enlace.trim() }).run()
    setEnlace(null)
  }

  const boton = (etiqueta: string, icono: React.ReactNode, accion: () => void, { activo = false, desactivado = false } = {}) => (
    <Tooltip title={etiqueta}>
      <span>
        <IconButton
          aria-label={etiqueta}
          aria-pressed={activo}
          disabled={desactivado}
          // Sin robar el foco al texto: el formato va a lo que está seleccionado.
          onMouseDown={(e) => e.preventDefault()}
          onClick={accion}
          sx={{ borderRadius: 1.5, width: 40, height: 40, ...(activo ? { bgcolor: 'action.selected' } : {}) }}
        >
          {icono}
        </IconButton>
      </span>
    </Tooltip>
  )

  return (
    <>
      <Box
        role="toolbar"
        aria-label="Formato del texto"
        sx={{ position: 'sticky', top: 8, zIndex: 3, display: 'flex', alignItems: 'center', gap: 0.25, px: 0.75, py: 0.5, borderRadius: 2, bgcolor: 'background.paper', border: 1, borderColor: 'divider', boxShadow: 1, width: 'fit-content', mx: 'auto', flexWrap: 'wrap' }}
      >
        {boton('Negrita', <FormatBoldIcon />, () => editor.chain().focus().toggleBold().run(), { activo: estado.negrita, desactivado: !estado.enTexto })}
        {boton('Cursiva', <FormatItalicIcon />, () => editor.chain().focus().toggleItalic().run(), { activo: estado.cursiva, desactivado: !estado.enTexto })}
        {boton('Enlace', <LinkIcon />, abrirEnlace, { activo: estado.enlace, desactivado: !estado.enTexto })}
        {estado.enlace && boton('Quitar el enlace', <LinkOffIcon />, () => editor.chain().focus().extendMarkRange('link').unsetLink().run())}
        {boton('Lista', <FormatListBulletedIcon />, () => editor.chain().focus().toggleBulletList().run(), { activo: estado.lista, desactivado: !estado.enTexto })}
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        {boton('Deshacer', <UndoIcon />, () => editor.chain().focus().undo().run(), { desactivado: !estado.deshacer })}
        {boton('Rehacer', <RedoIcon />, () => editor.chain().focus().redo().run(), { desactivado: !estado.rehacer })}
      </Box>

      <Dialog open={enlace !== null} onClose={() => setEnlace(null)} fullWidth maxWidth="sm">
        <DialogTitle>Enlace</DialogTitle>
        <DialogContent>
          <Stack sx={{ pt: 1 }}>
            {enlace !== null && <CampoEnlace valor={enlace} onCambio={setEnlace} autoFocus />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEnlace(null)}>Cancelar</Button>
          <Button variant="contained" disabled={enlace === null || !enlaceValido(enlace)} onClick={ponerEnlace}>Poner el enlace</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
