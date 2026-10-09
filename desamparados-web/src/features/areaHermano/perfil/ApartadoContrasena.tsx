import { useId, useState } from 'react'
import { Box, Button, Typography } from '@mui/material'
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined'
import TarjetaCristal from '../../../components/TarjetaCristal'
import CambiarContrasena from '../../altas/auth/CambiarContrasena'

/**
 * La contraseña de la cuenta, con la misma forma que los apartados de la
 * ficha. Va aparte de ellos porque es de la cuenta y no de una ficha: no
 * cambia al elegir otra persona de la familia.
 */
export default function ApartadoContrasena() {
  const idTitulo = useId()
  const [abierto, setAbierto] = useState(false)
  const [hecho, setHecho] = useState<string | null>(null)

  return (
    <TarjetaCristal component="section" aria-labelledby={idTitulo} sx={{ p: { xs: 2.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
        <Box>
          <Typography id={idTitulo} component="h2" sx={{ fontSize: 20, fontWeight: 600 }}>Contraseña</Typography>
          {abierto && <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.25 }}>Cambiándola</Typography>}
        </Box>
        {!abierto && (
          <Button size="small" startIcon={<KeyOutlinedIcon />} onClick={() => { setHecho(null); setAbierto(true) }} sx={{ color: 'primary.light', fontWeight: 600, minHeight: 40, flexShrink: 0 }}>
            Cambiar
          </Button>
        )}
      </Box>
      {abierto ? (
        <CambiarContrasena variante="area" onCancelar={() => setAbierto(false)} onHecho={(mensaje) => { setHecho(mensaje); setAbierto(false) }} />
      ) : (
        <>
          <Typography sx={{ fontSize: 15, color: 'text.secondary', maxWidth: '62ch' }}>
            La de entrar en el área de hermanos. Al cambiarla se cierran las sesiones abiertas en otros dispositivos.
          </Typography>
          {hecho && <Typography role="status" sx={{ fontSize: 13.5, color: 'success.light' }}>{hecho}</Typography>}
        </>
      )}
    </TarjetaCristal>
  )
}
