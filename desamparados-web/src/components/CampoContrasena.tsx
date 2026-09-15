import { IconButton, InputAdornment, TextField, type TextFieldProps } from '@mui/material'
import { forwardRef, useState, type MouseEvent } from 'react'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'

/**
 * Campo de contraseña con el ojo para verla. Por lo demás es un TextField:
 * acepta sus props y reenvía la ref, así que sigue valiendo para
 * `{...register('password')}` de react-hook-form.
 *
 * El `type` lo manda el componente y no se puede pasar desde fuera: es lo
 * único que cambia al pulsar el ojo.
 */
type CampoContrasenaProps = Omit<TextFieldProps, 'type'>

const CampoContrasena = forwardRef<HTMLDivElement, CampoContrasenaProps>(
  ({ slotProps, ...props }, ref) => {
    const [visible, setVisible] = useState(false)
    const etiqueta = visible ? 'Ocultar contraseña' : 'Mostrar contraseña'

    return (
      <TextField
        {...props}
        ref={ref}
        type={visible ? 'text' : 'password'}
        slotProps={{
          ...slotProps,
          input: {
            ...slotProps?.input,
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  type="button"
                  edge="end"
                  aria-label={etiqueta}
                  title={etiqueta}
                  onClick={() => setVisible((estaba) => !estaba)}
                  // Sin esto el clic roba el foco al campo y hay que volver a
                  // él para seguir escribiendo.
                  onMouseDown={(evento: MouseEvent) => evento.preventDefault()}
                >
                  {visible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
    )
  },
)

CampoContrasena.displayName = 'CampoContrasena'

export default CampoContrasena
