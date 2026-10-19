import { Box, Tooltip } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { OpcionesDeBloques, OpcionesDeCampos } from './extensiones'
import { HOJA } from './hoja'

/**
 * Cómo se ve cada pieza dentro del editor: como saldrá en el correo, con los
 * mismos colores y letras de la carta. Los nodos están en extensiones.ts.
 */

export function VistaCampo({ node, extension, selected }: NodeViewProps) {
  const clave = String(node.attrs.clave)
  const campo = (extension.options as OpcionesDeCampos).campos.get(clave)
  // Un campo que este correo no tiene se ve en rojo: la revisión no deja guardarlo.
  const desconocido = !campo
  return (
    <NodeViewWrapper as="span" style={{ display: 'inline' }}>
      <Tooltip title={campo ? `${campo.etiqueta}: ${campo.ayuda}` : 'Este correo no tiene este dato: quítalo.'} describeChild>
        <Box
          component="span"
          data-campo={clave}
          sx={{
            fontFamily: 'inherit', fontSize: '0.92em', px: 0.6, py: '1px', borderRadius: '4px', whiteSpace: 'nowrap',
            bgcolor: desconocido ? '#fde8e8' : '#f3ece6',
            border: '1px solid', borderColor: desconocido ? '#c62828' : selected ? '#2a78d6' : '#d9c9bc',
            color: desconocido ? '#8e1c1c' : '#4a2a22', cursor: 'default',
          }}
        >
          {campo?.ejemplo || campo?.etiqueta || clave}
        </Box>
      </Tooltip>
    </NodeViewWrapper>
  )
}

export function VistaRecuadro({ node, updateAttributes }: NodeViewProps) {
  return (
    <NodeViewWrapper data-pieza="recuadro">
      <Box sx={{ my: '8px', mb: '24px', px: '22px', py: '18px', bgcolor: HOJA.panel, borderTop: `1px solid ${HOJA.linea}`, borderBottom: `1px solid ${HOJA.linea}` }}>
        <Box
          component="input"
          aria-label="Título del recuadro"
          placeholder="Título del recuadro (si quieres)"
          value={String(node.attrs.titulo ?? '')}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateAttributes({ titulo: e.target.value })}
          maxLength={200}
          sx={{
            display: 'block', width: '100%', border: 0, p: 0, mb: '6px', bgcolor: 'transparent', outline: 'none',
            fontFamily: HOJA.serif, fontSize: 16, fontWeight: 700, fontVariant: 'small-caps', letterSpacing: '0.5px', color: HOJA.acento,
            '&::placeholder': { color: HOJA.suave, fontWeight: 400, fontStyle: 'italic', fontVariant: 'normal', opacity: 1 },
          }}
        />
        <NodeViewContent style={{ fontSize: 15, lineHeight: 1.6 }} />
      </Box>
    </NodeViewWrapper>
  )
}

/** El marco de un átomo: azul cuando está elegido, como en el panel de la derecha. */
function Elegible({ selected, etiqueta, children }: { selected: boolean; etiqueta: string; children: React.ReactNode }) {
  return (
    <Box sx={{ position: 'relative', mx: '-10px', p: '10px', borderRadius: '4px', outline: selected ? '2px solid #2a78d6' : '1px dashed transparent', '&:hover': { outlineColor: selected ? '#2a78d6' : '#c9bfb8' }, cursor: 'pointer' }}>
      {selected && (
        <Box component="span" sx={{ position: 'absolute', top: -11, left: 8, px: 1, borderRadius: '4px', bgcolor: '#2a78d6', color: '#fff', fontFamily: 'system-ui, sans-serif', fontSize: 11, fontWeight: 600, lineHeight: '18px' }}>
          {etiqueta}
        </Box>
      )}
      {children}
    </Box>
  )
}

export function VistaBoton({ node, selected }: NodeViewProps) {
  const texto = String(node.attrs.texto || '')
  return (
    <NodeViewWrapper data-pieza="boton" contentEditable={false}>
      <Elegible selected={selected} etiqueta="Botón">
        <Box component="span" sx={{ display: 'inline-block', my: '18px', px: '28px', py: '14px', borderRadius: '2px', bgcolor: HOJA.negro, color: '#fff', fontFamily: HOJA.sans, fontSize: 14, fontWeight: 700, letterSpacing: '0.3px' }}>
          {texto || 'Escribe el texto del botón'}&nbsp;&nbsp;→
        </Box>
      </Elegible>
    </NodeViewWrapper>
  )
}

export function VistaFoto({ node, selected }: NodeViewProps) {
  const src = String(node.attrs.src || '')
  const pie = String(node.attrs.pie || '')
  return (
    <NodeViewWrapper data-pieza="foto" contentEditable={false}>
      <Elegible selected={selected} etiqueta="Foto">
        {src ? (
          <Box component="img" src={src} alt={String(node.attrs.alt || '')} sx={{ display: 'block', width: '100%', height: 'auto' }} />
        ) : (
          <Box sx={{ height: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, bgcolor: HOJA.panel, border: `1px dashed ${HOJA.linea}`, color: HOJA.suave, fontFamily: HOJA.sans, fontSize: 14 }}>
            <AddPhotoAlternateOutlinedIcon aria-hidden />
            Elige la foto en el panel de la derecha
          </Box>
        )}
        {pie && <Box sx={{ pt: 1, fontFamily: HOJA.serif, fontSize: 13, fontStyle: 'italic', lineHeight: 1.5, color: HOJA.suave }}>{pie}</Box>}
      </Elegible>
    </NodeViewWrapper>
  )
}

export function VistaSeparador({ selected }: NodeViewProps) {
  return (
    <NodeViewWrapper data-pieza="separador" contentEditable={false}>
      <Elegible selected={selected} etiqueta="Separador">
        <Box sx={{ borderTop: `1px solid ${HOJA.linea}`, my: '8px' }} />
      </Elegible>
    </NodeViewWrapper>
  )
}

export function VistaFijo({ node, extension, selected }: NodeViewProps) {
  const clave = String(node.attrs.clave)
  const bloque = (extension.options as OpcionesDeBloques).bloques.get(clave)
  return (
    <NodeViewWrapper data-pieza="fijo" contentEditable={false}>
      <Elegible selected={selected} etiqueta="Lo pone la web">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, border: `1px dashed ${bloque ? '#b9aca4' : '#c62828'}`, bgcolor: '#fbf9f6', fontFamily: HOJA.sans }}>
          <LockOutlinedIcon fontSize="small" sx={{ color: HOJA.acento }} aria-hidden />
          <Box>
            <Box sx={{ fontSize: 14, fontWeight: 600, color: HOJA.texto }}>{bloque?.ayuda ?? `«${clave}»: este correo no tiene este bloque`}</Box>
            <Box sx={{ fontSize: 12.5, color: HOJA.suave }}>{bloque?.obligatorio ? 'Lo pone la web con los datos de cada correo · se mueve, no se quita' : 'Lo pone la web con los datos de cada correo'}</Box>
          </Box>
        </Box>
      </Elegible>
    </NodeViewWrapper>
  )
}
