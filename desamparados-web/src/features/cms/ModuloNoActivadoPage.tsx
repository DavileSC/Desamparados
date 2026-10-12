import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuthStore } from '../altas/auth/store'
import { nombreDeModulo, type Requisito } from '../../domain/modulos'
import { site } from '../../config/site'

/**
 * Lo que ve quien llega a una pantalla del CMS de un módulo apagado (por un
 * enlace guardado, por la URL). Administración puede encenderlo desde aquí;
 * al resto solo se le dice que no está, sin enlace a una pantalla que no
 * podría abrir.
 */
export default function ModuloNoActivadoPage({ modulo }: { modulo: Requisito }) {
  const role = useAuthStore((state) => state.cms?.role)
  const claves = (Array.isArray(modulo) ? modulo : [modulo]).filter((m) => m !== 'nucleo')
  const nombres = claves.map((c) => nombreDeModulo(c))
  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', py: 8, textAlign: 'center' }}>
      <Helmet><title>{`Módulo no activado | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <Typography component="h1" variant="h5" sx={{ mb: 1.5 }}>Este módulo no está activado</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {nombres.length === 1 ? `«${nombres[0]}» no está activado en esta instalación.` : `Ninguno de estos módulos está activado en esta instalación: ${nombres.join(', ')}.`}
      </Typography>
      {role === 'ADMIN' && (
        <Typography>
          Se enciende desde <Link to="/cms/modulos">Sistema → Módulos</Link>.
        </Typography>
      )}
    </Box>
  )
}
