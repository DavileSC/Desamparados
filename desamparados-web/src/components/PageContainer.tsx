import { Container, type ContainerProps } from '@mui/material'
import { forwardRef } from 'react'

const PageContainer = forwardRef<HTMLDivElement, ContainerProps>(
  ({ children, sx, ...props }, ref) => (
    <Container
      ref={ref}
      maxWidth="lg"
      sx={{
        px: { xs: '20px', md: '64px' },
        ...sx,
      }}
      {...props}
    >
      {children}
    </Container>
  )
)

PageContainer.displayName = 'PageContainer'

export default PageContainer
