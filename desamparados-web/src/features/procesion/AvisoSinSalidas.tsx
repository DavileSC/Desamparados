import { Alert, Box } from '@mui/material'
import { Link } from 'react-router-dom'
import { rolesPorRutaCms } from '../../app/cmsNavegacion'
import { useAuthStore } from '../altas/auth/store'

/**
 * Lo que enseña una pantalla de procesión del CMS cuando no tiene salida con
 * la que trabajar: o no se han podido cargar, o no hay ninguna activa. El
 * enlace para crearlas solo a quien puede entrar en Salidas: a los demás les
 * llevaría a una pantalla sin permiso.
 */
export default function AvisoSinSalidas({ error }: { error: boolean }) {
  const role = useAuthStore((s) => s.cms?.role ?? 'USER')
  if (error) return <Alert severity="error">No se han podido cargar las salidas.</Alert>
  return (
    <Alert severity="info">
      No hay salidas activas.{' '}
      {rolesPorRutaCms['procesion/salidas'].includes(role)
        ? <>Créalas en <Box component={Link} to="/cms/procesion/salidas" sx={{ color: 'inherit', fontWeight: 600 }}>Procesión → Salidas</Box>.</>
        : 'Pídelas a Secretaría.'}
    </Alert>
  )
}
