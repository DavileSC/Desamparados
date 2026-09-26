import { Button, type ButtonProps } from '@mui/material'
import { forwardRef } from 'react'
import { BOTON } from './estiloDeBoton'

interface BotonProps extends Omit<ButtonProps, 'variant'> {
  /**
   * El estilo del botón (ver `estiloDeBoton.ts`): `primary` granate; `claro`
   * con un velo crema, para la segunda acción de una sección; `outline` discreto, para
   * las acciones secundarias de un formulario. `secondary` queda como `claro`.
   */
  appVariant?: 'primary' | 'secondary' | 'outline' | 'claro'
  /** Destino cuando se usa como enlace de router: <Boton component={Link} to="/ruta"> */
  to?: string
}

const ESTILO_DE = {
  primary: BOTON.principal,
  secondary: BOTON.claro,
  claro: BOTON.claro,
  outline: BOTON.oscuro,
} as const

const Boton = forwardRef<HTMLButtonElement, BotonProps>(
  ({ appVariant = 'primary', sx, ...props }, ref) => (
    <Button
      ref={ref}
      variant="contained"
      disableElevation
      sx={[ESTILO_DE[appVariant], ...(Array.isArray(sx) ? sx : [sx])]}
      {...props}
    />
  )
)

Boton.displayName = 'Boton'

export default Boton
