import { Box, Typography } from '@mui/material'
import { EditorContent, type Editor } from '@tiptap/react'
import type { CampoDeUso, UsoDeCorreo } from '../../../../lib/api/emails'
import { imagenDelMembrete } from '../../../../lib/api/emails'
import { site } from '../../../../config/site'
import { instalacion } from '../../../../config/instalacion'
import LineaConCampos from './LineaConCampos'
import { HOJA } from './hoja'

export interface Cabecera { asunto: string; resumen: string; titulo: string; despedida: string }

interface Props {
  uso: UsoDeCorreo
  conCabecera: boolean
  cabecera: Cabecera
  onCabecera: (c: Partial<Cabecera>) => void
  cuerpo: Editor
  campos: Map<string, CampoDeUso>
  onActivarLinea: (editor: Editor) => void
  movil: boolean
}

const fecha = () => `${instalacion.identidad.localidad}, ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`

/**
 * La carta tal como llega, y encima el sobre (asunto y lo que se lee al lado
 * en la bandeja). Todo lo que se escribe, se escribe aquí: el título, el
 * texto y la despedida. El membrete, el antetítulo, la fecha y la firma los
 * pone el correo.
 */
export default function HojaDelCorreo({ uso, conCabecera, cabecera, onCabecera, cuerpo, campos, onActivarLinea, movil }: Props) {
  const ancho = movil ? 375 : 600
  const margen = movil ? '22px' : '44px'
  const linea = (etiqueta: string, clave: keyof Cabecera, placeholder: string, sx: object) => (
    <LineaConCampos etiqueta={etiqueta} valor={cabecera[clave]} onCambio={(v) => onCabecera({ [clave]: v })} campos={campos} onActivar={onActivarLinea} placeholder={placeholder} sx={sx} />
  )

  return (
    <Box sx={{ bgcolor: HOJA.fondo, borderRadius: 2, px: { xs: 1, sm: 3 }, py: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, overflowX: 'auto' }}>
      {/* El sobre: lo primero que se ve en la bandeja. */}
      <Box sx={{ width: '100%', maxWidth: ancho, boxSizing: 'border-box', bgcolor: HOJA.papel, border: `1px solid ${HOJA.linea}`, borderRadius: 1.5, px: 2, py: 1.25, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '150px minmax(0, 1fr)' }, columnGap: 1.5, rowGap: 0.75, alignItems: 'baseline', color: HOJA.texto, fontFamily: 'system-ui, sans-serif' }}>
        <Typography component="span" sx={{ fontSize: 13, color: HOJA.suave }}>Asunto</Typography>
        {linea('Asunto', 'asunto', 'El asunto del correo', { fontSize: 15, fontWeight: 600 })}
        <Typography component="span" sx={{ fontSize: 13, color: HOJA.suave }}>Lo que se lee al lado</Typography>
        {linea('Lo que se lee al lado del asunto', 'resumen', 'Si lo dejas vacío, el principio del texto', { fontSize: 14, color: HOJA.suave })}
      </Box>

      <Box sx={{ width: '100%', maxWidth: ancho, boxSizing: 'border-box', bgcolor: HOJA.papel, boxShadow: '0 1px 3px rgba(20,17,17,.08)', fontFamily: HOJA.serif, color: HOJA.texto, transition: 'max-width .25s ease' }}>
        <Box sx={{ px: margen, pt: '24px', pb: '22px', display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box component="img" src={imagenDelMembrete('escudo')} alt="" aria-hidden sx={{ height: 56, width: 'auto', display: 'block' }} />
          <Box>
            <Box sx={{ fontSize: 13, fontStyle: 'italic', color: HOJA.suave }}>{site.tipo}</Box>
            <Box sx={{ fontSize: movil ? 17 : 19, lineHeight: 1.25, color: HOJA.negro }}>{site.titular}</Box>
          </Box>
        </Box>
        {conCabecera && !uso.libre && <Box component="img" src={imagenDelMembrete('cabecera')} alt="" aria-hidden sx={{ display: 'block', width: '100%', height: 'auto' }} />}
        <Box sx={{ height: 4, bgcolor: HOJA.acento }} />

        <Box sx={{ px: margen, pt: '30px', pb: '40px', fontSize: 16, lineHeight: 1.65 }}>
          <Box sx={{ fontSize: 15, fontVariant: 'small-caps', letterSpacing: '0.6px', color: HOJA.acento }}>{uso.antetitulo}</Box>
          <Box sx={{ mt: '2px', mb: '22px', fontSize: 14, fontStyle: 'italic', color: HOJA.suave }}>{fecha()}</Box>
          {!uso.libre && linea('Título', 'titulo', 'El título de la carta', { mb: '22px', fontSize: movil ? 23 : 26, lineHeight: 1.25, color: HOJA.negro })}

          <Box
            sx={{
              '& .ProseMirror': { outline: 'none', minHeight: 120 },
              '& .ProseMirror > p, & .ProseMirror [data-recuadro] p': { m: 0, mb: '16px' },
              '& .ProseMirror ul': { m: 0, mb: '16px', pl: '22px' },
              '& .ProseMirror li': { mb: '6px' },
              '& .ProseMirror li p': { m: 0 },
              '& .ProseMirror a': { color: HOJA.texto, textDecoration: 'underline' },
              '& .ProseMirror p[data-oracion]': { mx: '28px', mt: '6px', mb: '22px', textAlign: 'center', fontSize: 17, fontStyle: 'italic' },
              '& .ProseMirror p[data-oracion]:empty::before': { content: '"Escribe la oración"', color: HOJA.suave },
              '& .ProseMirror > p.is-empty:only-child::before, & .ProseMirror > p.is-editor-empty::before': { content: '"Escribe aquí la carta"', color: HOJA.suave, fontStyle: 'italic', float: 'left', height: 0, pointerEvents: 'none' },
              '& .ProseMirror-selectednode': { outline: 'none' },
              '& .ProseMirror-gapcursor:after': { borderTopColor: HOJA.negro },
            }}
          >
            <EditorContent editor={cuerpo} />
          </Box>

          <Box sx={{ mt: '30px' }}>
            {!uso.libre && linea('Despedida', 'despedida', 'Una despedida (si quieres): «Que Nuestra Señora le guarde.»', { mb: '22px', fontStyle: 'italic', color: HOJA.suave })}
            <Box sx={{ fontSize: 16 }}><Box component="span" sx={{ color: HOJA.acento }}>✠</Box>&nbsp; {uso.firma}</Box>
            <Box sx={{ mt: '2px', fontSize: 14, fontStyle: 'italic', color: HOJA.suave }}>{site.nombre}</Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
