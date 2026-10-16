import { createContext, useContext, useEffect, useId, useRef, type FormEvent, type ReactNode, type RefObject } from 'react'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import { visuallyHidden } from '@mui/utils'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import TarjetaCristal from '../../../components/TarjetaCristal'
import Boton from '../../../components/Boton'
import { MARCA, alfa } from '../../../theme/marca'
import { SERIFA } from '../procesion/papeleta-estilo'

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
  /** El título lo pone ya la pantalla de alrededor: solo para lectores de pantalla. */
  tituloOculto?: boolean
  /** El formulario, para que quien valida pueda llevar el foco al campo que falla. */
  refFormulario?: RefObject<HTMLFormElement | null>
}

/**
 * Cómo se pinta un apartado. «tarjeta», la de siempre (el primer acceso).
 * «perfil», la de «Mi perfil» bajo la credencial (forma B, 16-10-2026): la
 * misma tarjeta, sin líneas dentro, con el título en serifa como el nombre de
 * la credencial, lo de Secretaría debajo y «Editar» con su palabra a su
 * altura. Los datos, en una rejilla con aire en lugar de filetes.
 */
export type FormaDeApartado = 'tarjeta' | 'perfil'
const Forma = createContext<FormaDeApartado>('tarjeta')
export const FormaDeApartados = Forma.Provider

/** Lo primero que se puede escribir o elegir; el `input` oculto de un desplegable de MUI no cuenta. */
const PRIMER_CAMPO = 'input:not([type="hidden"]):not([disabled]):not([aria-hidden="true"]):not([tabindex="-1"]), textarea:not([disabled]), [role="combobox"]'

/**
 * Un apartado de la ficha: se lee y, si se puede, se edita él solo, sin tocar
 * los demás. Cada uno guarda sus propios campos.
 */
export default function Apartado({ titulo, vista, formulario, editando, onEditar, onCancelar, onGuardar, guardando = false, error, hecho, candado, tituloOculto = false, refFormulario }: Props) {
  const idTitulo = useId()
  const enviar = (evento: FormEvent) => { evento.preventDefault(); onGuardar?.() }
  const propio = useRef<HTMLFormElement>(null)
  const formularioRef = refFormulario ?? propio
  const botonEditar = useRef<HTMLButtonElement>(null)

  // Al abrir la edición, el foco al primer campo; al cerrarla (guarde o
  // cancele), de vuelta al lápiz. Sin esto se quedaba en un botón que ya no
  // existe y el lector de pantalla volvía al principio de la página. Solo en
  // el cambio: un apartado que nace abierto (la revisión) no roba el foco.
  const antes = useRef(editando)
  useEffect(() => {
    if (antes.current === editando) return
    antes.current = editando
    if (editando) formularioRef.current?.querySelector<HTMLElement>(PRIMER_CAMPO)?.focus()
    else botonEditar.current?.focus()
  }, [editando, formularioRef])

  const perfil = useContext(Forma) === 'perfil'
  const lapiz = !editando && formulario && onEditar && (perfil ? (
    // En «Mi perfil», con su palabra también en el móvil: el lápiz solo no se entendía (16-10-2026).
    <Button ref={botonEditar} variant="outlined" startIcon={<EditOutlinedIcon />} onClick={onEditar} aria-label={`Editar ${titulo.toLowerCase()}`} sx={{
      color: 'text.primary', borderColor: 'rgba(204, 196, 201, 0.32)', textTransform: 'none', letterSpacing: 0, fontSize: 14.5, fontWeight: 600,
      minHeight: 40, px: 2, flexShrink: 0, '& .MuiButton-startIcon': { color: 'primary.light' },
      '&:hover': { borderColor: 'rgba(204, 196, 201, 0.6)', backgroundColor: 'rgba(255,255,255,0.04)' },
    }}>
      Editar
    </Button>
  ) : (
    // En el móvil, solo el lápiz: con la palabra, títulos como «Datos
    // personales» se partían en dos líneas.
    <Button ref={botonEditar} size="small" startIcon={<EditOutlinedIcon />} onClick={onEditar} aria-label={`Editar ${titulo.toLowerCase()}`} sx={{
      color: 'primary.light', fontWeight: 600, minHeight: 40, flexShrink: 0,
      minWidth: { xs: 40, sm: 64 }, '& .MuiButton-startIcon': { mx: { xs: 0, sm: undefined } },
    }}>
      <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Editar</Box>
    </Button>
  ))
  const conCandado = candado && (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 13, color: 'text.secondary', '& svg': { fontSize: 16 } }}>
      <LockOutlinedIcon aria-hidden="true" />{candado}
    </Box>
  )

  return (
    <TarjetaCristal component="section" aria-labelledby={idTitulo} sx={{
      display: 'flex', flexDirection: 'column', gap: 2,
      // En «Mi perfil», la rejilla elige columnas por el ancho de la tarjeta (`@container`).
      ...(perfil ? { p: { xs: 2.25, sm: 3 }, pt: { xs: 2, sm: 2.5 }, containerType: 'inline-size' } : { p: { xs: 2.5, md: 3 } }),
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography id={idTitulo} component="h2" sx={tituloOculto ? visuallyHidden : perfil
            ? { fontFamily: SERIFA, fontWeight: 400, fontSize: { xs: 20, sm: 22 }, lineHeight: 1.2 }
            : { fontSize: 20, fontWeight: 600 }}>{titulo}</Typography>
          {editando && <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.25 }}>Editando</Typography>}
          {/* En «Mi perfil», lo de Secretaría va bajo el título: abajo, solo, parecía un pie suelto. */}
          {perfil && !editando && conCandado && <Box sx={{ mt: 0.5 }}>{conCandado}</Box>}
        </Box>
        {lapiz}
      </Box>

      {editando && formulario ? (
        <Box component="form" ref={formularioRef} noValidate onSubmit={enviar} sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          {formulario}
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
            {/* Con el mismo estilo de letra que «Guardar»: en mayúsculas parecía de otra pantalla. */}
            <Button onClick={onCancelar} disabled={guardando} sx={{ color: 'text.secondary', textTransform: 'none', letterSpacing: '0.01em', fontSize: 15, fontWeight: 600 }}>Cancelar</Button>
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

      {!perfil && conCandado && (
        <Box sx={{ pt: 1.75, borderTop: 1, borderColor: 'divider' }}>{conCandado}</Box>
      )}
    </TarjetaCristal>
  )
}

/**
 * Un dato leído: la etiqueta en pequeño y el valor, o una raya si falta. La
 * etiqueta va en rosa del Grupo: en gris se confundía con el valor (09-10-2026).
 * Si ocupa más, toma dos columnas cuando la rejilla tiene sitio para dos.
 */
export function Dato({ etiqueta, valor, completo = false }: { etiqueta: string; valor: ReactNode; completo?: boolean }) {
  const vacio = valor === null || valor === undefined || valor === ''
  return (
    <Box sx={{ minWidth: 0, ...(completo ? { gridColumn: '1 / -1', '@container (min-width: 400px)': { gridColumn: 'span 2' } } : {}) }}>
      <Typography component="dt" sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: (t) => (t.palette.mode === 'light' ? MARCA.principalOscuro : alfa(MARCA.principalPalido, 0.85)) }}>{etiqueta}</Typography>
      <Typography component="dd" sx={{ m: 0, mt: 0.5, fontSize: 15, fontWeight: vacio ? 400 : 500, overflowWrap: 'anywhere', color: vacio ? 'text.disabled' : 'text.primary' }}>{vacio ? '—' : valor}</Typography>
    </Box>
  )
}

/**
 * La rejilla de datos o de campos de un apartado. Caben tantas columnas como
 * permite su ancho (no el de la pantalla): con el menú lateral del área, el
 * ancho de la pantalla no dice cuánto sitio le queda a la tarjeta. `dense`
 * rellena el hueco que deja un dato de dos columnas al saltar de fila.
 */
export function Rejilla({ children, lista = false }: { children: ReactNode; lista?: boolean }) {
  // En «Mi perfil», columnas contadas por el ancho de la tarjeta: dos en el
  // móvil, cuatro en el portátil y nunca cinco (la última fila quedaba coja).
  const perfil = useContext(Forma) === 'perfil' && lista
  return (
    <Box component={lista ? 'dl' : 'div'} sx={{
      m: 0, display: 'grid', containerType: 'inline-size', gridAutoFlow: 'row dense',
      ...(perfil ? {
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '18px 16px',
        '@container (min-width: 600px)': { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px 32px' },
        '@container (min-width: 820px)': { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
      } : {
        gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${lista ? 180 : 230}px), 1fr))`,
        gap: lista ? '16px 22px' : '16px 18px',
      }),
    }}>
      {children}
    </Box>
  )
}
