import { useState } from 'react'
import { Box, Button, ButtonBase, Collapse, Stack, Tooltip, Typography } from '@mui/material'
import NotesIcon from '@mui/icons-material/Notes'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import CropSquareIcon from '@mui/icons-material/CropSquare'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import SmartButtonOutlinedIcon from '@mui/icons-material/SmartButtonOutlined'
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined'
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type { BloqueDeUso, CampoDeUso, Pieza } from '../../../../lib/api/emails'
import type { TipoDePieza } from './acciones'

const PIEZAS: { tipo: TipoDePieza; nombre: string; ayuda: string; icono: React.ReactNode }[] = [
  { tipo: 'texto', nombre: 'Texto', ayuda: 'Un párrafo', icono: <NotesIcon /> },
  { tipo: 'lista', nombre: 'Lista', ayuda: 'Puntos, uno debajo de otro', icono: <FormatListBulletedIcon /> },
  { tipo: 'recuadro', nombre: 'Recuadro', ayuda: 'Lo que no hay que pasar por alto, con su título', icono: <CropSquareIcon /> },
  { tipo: 'oracion', nombre: 'Oración', ayuda: 'Una oración o una cita, centrada y en cursiva', icono: <FormatQuoteIcon /> },
  { tipo: 'boton', nombre: 'Botón', ayuda: 'Para llevar a una página', icono: <SmartButtonOutlinedIcon /> },
  { tipo: 'foto', nombre: 'Foto', ayuda: 'A lo ancho de la carta', icono: <AddPhotoAlternateOutlinedIcon /> },
  { tipo: 'separador', nombre: 'Separador', ayuda: 'Una raya fina entre dos partes', icono: <HorizontalRuleIcon /> },
]

/**
 * Los campos de la corporación que no son una forma de su nombre: llevan su
 * etiqueta. Las formas («el Grupo Parroquial», «del Grupo Parroquial»…) se
 * enseñan tal cual, sin etiqueta: se pulsa la que encaja en la frase.
 */
const CON_ETIQUETA = new Set(['grupo', 'titular'])

// Los botones del panel no se llevan el foco: el dato o la pieza van donde estaba el cursor.
const sinRobarFoco = (e: React.MouseEvent) => e.preventDefault()

/** Una sección del panel que se abre y se cierra con su título. */
function Seccion({ titulo, abierta: deInicio = true, children }: { titulo: string; abierta?: boolean; children: React.ReactNode }) {
  const [abierta, setAbierta] = useState(deInicio)
  return (
    <Box>
      <ButtonBase
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
        sx={{ width: '100%', minHeight: 36, justifyContent: 'space-between', borderRadius: 1, fontSize: 12, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
      >
        {titulo}
        <ExpandMoreIcon fontSize="small" sx={{ transition: 'transform .2s', transform: abierta ? 'rotate(180deg)' : 'none' }} aria-hidden />
      </ButtonBase>
      <Collapse in={abierta}><Box sx={{ pt: 1 }}>{children}</Box></Collapse>
    </Box>
  )
}

const estiloDeDato = {
  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', minHeight: 40, px: 1.25, py: 0.75,
  borderRadius: 1.5, border: 1, borderColor: 'divider', textAlign: 'left', '&:hover': { bgcolor: 'action.hover', borderColor: 'text.secondary' },
} as const

interface Props {
  bloques: BloqueDeUso[]
  campos: CampoDeUso[]
  comunes: CampoDeUso[]
  contenido: Pieza[]
  onAnadir: (tipo: TipoDePieza) => void
  onPonerBloque: (clave: string) => void
  onDato: (clave: string) => void
}

/** A la izquierda de la hoja: lo que se puede añadir, los bloques de la web y los datos que se rellenan solos. */
export default function PanelPiezas({ bloques, campos, comunes, contenido, onAnadir, onPonerBloque, onDato }: Props) {
  const puestos = new Set(contenido.flatMap((x) => (x.tipo === 'fijo' ? [x.clave] : [])))

  /** Un dato: su etiqueta en pequeño y, debajo, el ejemplo entero, que es lo que se va a leer en la carta. */
  const dato = (c: CampoDeUso) => (
    <Tooltip key={c.clave} title={c.ayuda} placement="right" describeChild>
      <ButtonBase onMouseDown={sinRobarFoco} onClick={() => onDato(c.clave)} sx={estiloDeDato}>
        <Box component="span" sx={{ fontSize: 12, color: 'text.secondary', lineHeight: 1.3 }}>{c.etiqueta}</Box>
        <Box component="span" sx={{ fontSize: 14, fontWeight: 500, lineHeight: 1.35 }}>{c.ejemplo || c.etiqueta}</Box>
      </ButtonBase>
    </Tooltip>
  )
  /** Una forma del nombre: solo la frase. */
  const forma = (c: CampoDeUso) => (
    <Tooltip key={c.clave} title={c.ayuda} placement="right" describeChild>
      <ButtonBase onMouseDown={sinRobarFoco} onClick={() => onDato(c.clave)} sx={{ ...estiloDeDato, fontSize: 14, fontWeight: 500, lineHeight: 1.35 }}>
        {c.ejemplo || c.etiqueta}
      </ButtonBase>
    </Tooltip>
  )

  return (
    <Stack spacing={2} component="aside" aria-label="Piezas y datos del correo">
      <Seccion titulo="Añadir">
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {PIEZAS.map((p) => (
            <Tooltip key={p.tipo} title={p.ayuda} describeChild>
              <ButtonBase
                onMouseDown={sinRobarFoco}
                onClick={() => onAnadir(p.tipo)}
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minHeight: 36, px: 1.25, borderRadius: 1.5, border: 1, borderColor: 'divider', bgcolor: 'action.hover', fontSize: 13.5, '&:hover': { borderColor: 'text.secondary' }, '& svg': { fontSize: 18, color: 'text.secondary' } }}
              >
                {p.icono}
                {p.nombre}
              </ButtonBase>
            </Tooltip>
          ))}
        </Box>
      </Seccion>

      {bloques.length > 0 && (
        <Seccion titulo="Lo pone la web">
          <Stack spacing={1}>
            {bloques.map((b) => {
              const puesto = puestos.has(b.clave)
              return (
                <Box key={b.clave} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, borderRadius: 2, border: '1px dashed', borderColor: !puesto && b.obligatorio ? 'error.main' : 'divider' }}>
                  <LockOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} aria-hidden />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.35 }}>{b.ayuda}</Typography>
                    <Typography sx={{ fontSize: 12.5, color: !puesto && b.obligatorio ? 'error.main' : 'text.secondary' }}>
                      {puesto ? (b.obligatorio ? 'En el correo · no se quita' : 'En el correo') : b.obligatorio ? 'Falta y no puede faltar' : 'No está en el correo'}
                    </Typography>
                  </Box>
                  {!puesto && <Button size="small" onMouseDown={sinRobarFoco} onClick={() => onPonerBloque(b.clave)}>Ponerlo</Button>}
                </Box>
              )
            })}
          </Stack>
        </Seccion>
      )}

      {campos.length > 0 && (
        <Seccion titulo="Datos de cada correo">
          <Stack spacing={0.75}>{campos.map(dato)}</Stack>
        </Seccion>
      )}

      {/* Sin «del Grupo»: la misma web la usan otras corporaciones. Cerrada de
          partida: se usa menos que los datos y es la más larga. */}
      <Seccion titulo="Nuestro nombre" abierta={false}>
        <Stack spacing={0.75}>
          {comunes.filter((c) => CON_ETIQUETA.has(c.clave)).map(dato)}
          {comunes.filter((c) => !CON_ETIQUETA.has(c.clave)).map(forma)}
        </Stack>
      </Seccion>
    </Stack>
  )
}
