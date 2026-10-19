import { useRef, useState } from 'react'
import { Alert, Box, Button, IconButton, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import { useEditorState, type Editor } from '@tiptap/react'
import type { BloqueDeUso } from '../../../../lib/api/emails'
import { subirImagenPublica } from '../../../../lib/api/subida'
import CampoEnlace from './CampoEnlace'
import { bloqueActual, cambiarAtributos, convertirTexto, moverBloque, quitarBloque } from './acciones'

const NOMBRES: Record<string, string> = {
  paragraph: 'Texto', bulletList: 'Lista', oracion: 'Oración', recuadro: 'Recuadro',
  boton: 'Botón', foto: 'Foto', separador: 'Separador', fijo: 'Lo pone la web',
}

const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

const inputOculto = { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

interface Props {
  editor: Editor
  bloques: Map<string, BloqueDeUso>
}

/**
 * A la derecha de la hoja: la pieza donde está el cursor, para moverla,
 * quitarla o ajustar lo que no se escribe en la hoja (a dónde lleva un botón,
 * qué foto, su descripción).
 */
export default function PanelDeLaPieza({ editor, bloques }: Props) {
  const actual = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const b = bloqueActual(e)
      return b ? { tipo: b.nodo.type.name, indice: b.indice, total: e.state.doc.childCount, attrs: { ...b.nodo.attrs } as Record<string, string> } : null
    },
  })
  const [subiendo, setSubiendo] = useState(false)
  const [errorFoto, setErrorFoto] = useState<string | null>(null)
  const inputFoto = useRef<HTMLInputElement>(null)

  if (!actual) {
    return <Typography variant="body2" color="text.secondary">Pulsa una pieza de la carta para moverla, quitarla o ajustarla.</Typography>
  }

  // Siempre sobre la pieza de este momento: entre dos pulsaciones el documento puede haber cambiado.
  const conBloque = (accion: (b: NonNullable<ReturnType<typeof bloqueActual>>) => void) => () => {
    const b = bloqueActual(editor)
    if (b) accion(b)
  }
  const cambiar = (atributos: Record<string, unknown>) => conBloque((b) => cambiarAtributos(editor, b, atributos))()
  const fijo = actual.tipo === 'fijo' ? bloques.get(actual.attrs.clave) : undefined
  const noSeQuita = actual.tipo === 'fijo' && Boolean(fijo?.obligatorio)
  const deTexto = ['paragraph', 'bulletList', 'oracion'].includes(actual.tipo)

  const elegirFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setErrorFoto(null)
    if (!TIPOS_IMAGEN.includes(archivo.type)) { setErrorFoto('La foto tiene que ser JPG, PNG o WebP.'); return }
    if (archivo.size > MAX_BYTES) { setErrorFoto('La foto pesa más de 5 MB.'); return }
    setSubiendo(true)
    try {
      cambiar({ src: await subirImagenPublica(archivo) })
    } catch (err: unknown) {
      setErrorFoto(err instanceof Error ? err.message : 'No se ha podido subir la foto.')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <Stack spacing={2.25}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Typography component="h3" sx={{ fontSize: 16, fontWeight: 600 }}>{NOMBRES[actual.tipo] ?? 'Pieza'}</Typography>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Subir"><span><IconButton aria-label="Subir la pieza" disabled={actual.indice === 0} onClick={conBloque((b) => moverBloque(editor, b, -1))} size="small"><KeyboardArrowUpIcon /></IconButton></span></Tooltip>
          <Tooltip title="Bajar"><span><IconButton aria-label="Bajar la pieza" disabled={actual.indice >= actual.total - 1} onClick={conBloque((b) => moverBloque(editor, b, 1))} size="small"><KeyboardArrowDownIcon /></IconButton></span></Tooltip>
          {!noSeQuita && <Tooltip title="Quitar"><IconButton aria-label="Quitar la pieza" onClick={conBloque((b) => quitarBloque(editor, b))} size="small" color="error"><DeleteOutlineIcon /></IconButton></Tooltip>}
        </Stack>
      </Stack>

      {deTexto && (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">Se escribe en la propia carta. Cámbialo a:</Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={actual.tipo === 'bulletList' ? 'lista' : actual.tipo === 'oracion' ? 'oracion' : 'texto'}
            onChange={(_, v: 'texto' | 'lista' | 'oracion' | null) => { if (v) convertirTexto(editor, v) }}
            aria-label="Tipo de texto"
          >
            <ToggleButton value="texto">Texto</ToggleButton>
            <ToggleButton value="lista">Lista</ToggleButton>
            <ToggleButton value="oracion">Oración</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      )}

      {actual.tipo === 'recuadro' && <Typography variant="body2" color="text.secondary">El título y el texto se escriben en el propio recuadro. Sin título, va solo el texto.</Typography>}

      {actual.tipo === 'boton' && (
        <>
          <TextField label="Lo que pone" size="small" value={actual.attrs.texto ?? ''} onChange={(e) => cambiar({ texto: e.target.value })} slotProps={{ htmlInput: { maxLength: 120 } }} fullWidth />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>A dónde lleva</Typography>
            <CampoEnlace valor={actual.attrs.enlace ?? ''} onCambio={(enlace) => cambiar({ enlace })} />
          </Box>
          <Typography variant="body2" color="text.secondary">Debajo del botón sale también la dirección escrita, por si el correo de quien lo recibe no pinta botones.</Typography>
        </>
      )}

      {actual.tipo === 'foto' && (
        <>
          <Box>
            <input ref={inputFoto} type="file" accept={TIPOS_IMAGEN.join(',')} style={inputOculto} onChange={(e) => void elegirFoto(e)} aria-label="Elegir la foto" tabIndex={-1} />
            <Button variant="outlined" disabled={subiendo} onClick={() => inputFoto.current?.click()}>
              {subiendo ? 'Subiendo…' : actual.attrs.src ? 'Cambiar la foto' : 'Elegir la foto'}
            </Button>
            {errorFoto && <Alert severity="error" sx={{ mt: 1 }}>{errorFoto}</Alert>}
          </Box>
          <TextField
            label="Qué se ve en la foto"
            size="small"
            value={actual.attrs.alt ?? ''}
            onChange={(e) => cambiar({ alt: e.target.value })}
            helperText="Lo lee quien no carga las imágenes o usa un lector de pantalla."
            slotProps={{ htmlInput: { maxLength: 300 } }}
            fullWidth
          />
          <TextField label="Pie de foto (si quieres)" size="small" value={actual.attrs.pie ?? ''} onChange={(e) => cambiar({ pie: e.target.value })} slotProps={{ htmlInput: { maxLength: 300 } }} fullWidth />
        </>
      )}

      {actual.tipo === 'separador' && <Typography variant="body2" color="text.secondary">Una raya fina para separar dos partes de la carta.</Typography>}

      {actual.tipo === 'fijo' && (
        <Typography variant="body2" color="text.secondary">
          {fijo ? `${fijo.ayuda}. Lo pone la web con los datos de cada correo.` : 'Este correo no tiene este bloque: quítalo.'}
          {noSeQuita && ' No se puede quitar: sin él, el correo no serviría. Sí puedes moverlo.'}
        </Typography>
      )}
    </Stack>
  )
}
