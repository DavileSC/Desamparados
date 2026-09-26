import { Button, type ButtonProps } from '@mui/material'
import { forwardRef } from 'react'
import { ESMALTE } from './esmalte'

interface BotonProps extends Omit<ButtonProps, 'variant'> {
  /**
   * El esmalte del botón (ver `esmalte.ts`): `primary` granate; `claro` crema,
   * para la segunda acción de una sección; `outline` oscuro y discreto, para
   * las acciones secundarias de un formulario. `secondary` queda como `claro`.
   */
  appVariant?: 'primary' | 'secondary' | 'outline' | 'claro'
  /** Destino cuando se usa como enlace de router: <Boton component={Link} to="/ruta"> */
  to?: string
}

const ESMALTE_DE = {
  primary: ESMALTE.principal,
  secondary: ESMALTE.claro,
  claro: ESMALTE.claro,
  outline: ESMALTE.oscuro,
} as const

const Boton = forwardRef<HTMLButtonElement, BotonProps>(
  ({ appVariant = 'primary', sx, ...props }, ref) => (
    <Button
      ref={ref}
      variant="contained"
      disableElevation
      sx={[ESMALTE_DE[appVariant], ...(Array.isArray(sx) ? sx : [sx])]}
      {...props}
    />
  )
)

Boton.displayName = 'Boton'

export default Boton
