import { Button, type ButtonProps } from '@mui/material'
import { forwardRef } from 'react'

interface AppButtonProps extends Omit<ButtonProps, 'variant'> {
  appVariant?: 'primary' | 'secondary' | 'outline'
}

const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(
  ({ appVariant = 'primary', sx, ...props }, ref) => {
    const variantStyles = {
      primary: {
        backgroundColor: '#6e1822',
        color: '#ffffff',
        '&:hover': {
          backgroundColor: '#5a131c',
          opacity: 0.9,
        },
      },
      secondary: {
        backgroundColor: 'secondary.main',
        color: 'secondary.contrastText',
        '&:hover': {
          backgroundColor: 'secondary.dark',
        },
      },
      outline: {
        backgroundColor: 'transparent',
        color: 'text.primary',
        border: '1px solid rgba(204, 196, 201, 0.3)',
        '&:hover': {
          borderColor: 'primary.main',
          color: 'primary.main',
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
        },
      },
    }

    return (
      <Button
        ref={ref}
        variant="contained"
        disableElevation
        sx={{
          borderRadius: '8px',
          padding: '14px 32px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 600,
          transition: 'all 0.3s ease',
          ...variantStyles[appVariant],
          ...sx,
        }}
        {...props}
      />
    )
  }
)

AppButton.displayName = 'AppButton'

export default AppButton
