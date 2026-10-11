import { Container, type ContainerProps } from '@mui/material'
import { forwardRef } from 'react'

// Ancho máximo de la web pública. Con los 1200 px de `lg`, en pantallas de
// 1920 o 2560 px el contenido quedaba perdido en el centro.
const ANCHO_PAGINA = 1440

const ContenedorDePagina = forwardRef<HTMLDivElement, ContainerProps>(
  ({ children, sx, ...props }, ref) => (
    <Container
      ref={ref}
      maxWidth={false}
      sx={{
        maxWidth: ANCHO_PAGINA,
        px: { xs: '20px', md: '64px' },
        ...sx,
      }}
      {...props}
    >
      {children}
    </Container>
  )
)

ContenedorDePagina.displayName = 'ContenedorDePagina'

export default ContenedorDePagina
