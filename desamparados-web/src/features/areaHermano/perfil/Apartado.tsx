import { useId, type FormEvent, type ReactNode } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import TarjetaCristal from '../../../components/TarjetaCristal'
import Boton from '../../../components/Boton'

interface Props {
  titulo: string
  /** Lo que se ve sin editar. */
  vista: ReactNode
  /** El formulario del apartado. Sin él, el apartado es de solo lectura. */
  formulario?: ReactNode
  editando: boolean
  onEditar?: () => void
  onCancelar?: () => void
  onGuardar?: () => void
  guardando?: boolean
  error?: string | null
  /** «Guardado.»: se enseña tras guardar, hasta volver a editar. */
  hecho?: boolean
  /** Lo que el hermano ve pero no toca: «Número, alta y jura los lleva Secretaría». */
  candado?: ReactNode
}

/**
 * Un apartado de la ficha: se lee y, si se puede, se edita él solo, sin tocar
 * los demás. Cada uno guarda sus propios campos.
 */
export default function Apartado({ titulo, vista, formulario, editando, onEditar, onCancelar, onGuardar, guardando = false, error, hecho, candado }: Props) {
  const idTitulo = useId()
  const enviar = (evento: FormEvent) => { evento.preventDefault(); onGuardar?.() }

  return (
    <TarjetaCristal component="section" aria-labelledby={idTitulo} sx={{ p: { xs: 2.5, md: 3.25 }, display: 'flex', flexDirection: 'column', gap: 2.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
        <Box>
          <Typography id={idTitulo} component="h2" sx={{ fontSize: 18, fontWeight: 600 }}>{titulo}</Typography>
          {editando && <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.25 }}>Editando</Typography>}
        </Box>
        {!editando && formulario && onEditar && (
          // En el móvil, solo el lápiz: con la palabra, títulos como «Datos
          // personales» se partían en dos líneas.
          <Button size="small" startIcon={<EditOutlinedIcon />} onClick={onEditar} aria-label={`Editar ${titulo.toLowerCase()}`} sx={{
            color: 'text.secondary', minHeight: 40, flexShrink: 0,
            minWidth: { xs: 40, sm: 64 }, '& .MuiButton-startIcon': { mx: { xs: 0, sm: undefined } },
          }}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Editar</Box>
          </Button>
        )}
      </Box>

      {editando && formulario ? (
        <Box component="form" noValidate onSubmit={enviar} sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          {formulario}
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            <Button onClick={onCancelar} disabled={guardando} sx={{ color: 'text.secondary' }}>Cancelar</Button>
            <Boton type="submit" disabled={guardando} sx={{ py: 1.25, px: 3 }}>
              {guardando ? <CircularProgress size={20} color="inherit" aria-label="Guardando" /> : 'Guardar'}
            </Boton>
          </Stack>
        </Box>
      ) : (
        <>
          {vista}
          {hecho && <Typography role="status" sx={{ fontSize: 13.5, color: 'success.light' }}>Guardado.</Typography>}
        </>
      )}

      {candado && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pt: 1.75, borderTop: 1, borderColor: 'divider', fontSize: 13, color: 'text.secondary', '& svg': { fontSize: 16 } }}>
          <LockOutlinedIcon aria-hidden="true" />{candado}
        </Box>
      )}
    </TarjetaCristal>
  )
}

/** Un dato leído: la etiqueta en pequeño y el valor, o una raya si falta. */
export function Dato({ etiqueta, valor, completo = false }: { etiqueta: string; valor: ReactNode; completo?: boolean }) {
  const vacio = valor === null || valor === undefined || valor === ''
  return (
    <Box sx={{ minWidth: 0, gridColumn: completo ? '1 / -1' : undefined }}>
      <Typography component="dt" sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.secondary' }}>{etiqueta}</Typography>
      <Typography component="dd" sx={{ m: 0, mt: 0.5, fontSize: 15, overflowWrap: 'anywhere', color: vacio ? 'text.disabled' : 'text.primary' }}>{vacio ? '—' : valor}</Typography>
    </Box>
  )
}

/** La rejilla de datos o de campos de un apartado: dos columnas, una en el móvil. */
export function Rejilla({ children, lista = false }: { children: ReactNode; lista?: boolean }) {
  return (
    <Box component={lista ? 'dl' : 'div'} sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }, gap: lista ? '18px 24px' : '16px 18px' }}>
      {children}
    </Box>
  )
}
