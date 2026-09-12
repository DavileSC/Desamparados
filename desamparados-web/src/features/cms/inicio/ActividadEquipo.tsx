import { Box, Paper, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import type { PanelResponse } from '../../../lib/api/panel'
import { NOMBRE_CARGO } from '../../../app/cmsNavegacion'
import { cuandoFue, describirAccion } from './actividad'

/**
 * Qué se ha tocado últimamente, por cargo y sin nombres. Solo contenido y
 * agenda: el registro completo vive en Auditoría, que solo ven ADMIN y
 * HERMANO_MAYOR, y por eso el enlace solo aparece para ellos.
 */
export default function ActividadEquipo({
  registro, role, ahora = new Date(),
}: {
  registro: PanelResponse['actividad']['registro']
  role?: string
  ahora?: Date
}) {
  const veAuditoria = role === 'ADMIN' || role === 'HERMANO_MAYOR'

  return (
    <Paper component="section" aria-labelledby="actividad-equipo" sx={{ borderRadius: 1.75 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', px: 2.75, pt: 2.25, pb: 1.5 }}>
        <Typography id="actividad-equipo" variant="h5" component="h2">Actividad del equipo</Typography>
        {veAuditoria ? (
          <Typography component={Link} to="/cms/auditoria" variant="body2" sx={{ fontWeight: 600, textDecoration: 'none', color: 'primary.main' }}>
            Ver auditoría →
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary">Contenido y agenda</Typography>
        )}
      </Box>
      {registro.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2.75, pb: 3, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
          Todavía no se ha tocado nada.
        </Typography>
      )}
      {registro.map((fila, i) => (
        <Box
          key={`${fila.createdAt}-${i}`}
          sx={{ display: 'grid', gridTemplateColumns: '76px minmax(0, 1fr)', gap: 1.5, px: 2.75, py: 1.25, borderTop: 1, borderColor: 'divider' }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums', pt: 0.25 }}>
            {cuandoFue(fila.createdAt, ahora)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <Box component="strong" sx={{ color: 'text.primary' }}>
              {fila.cargo ? NOMBRE_CARGO[fila.cargo] ?? fila.cargo : 'Alguien'}
            </Box>{' '}
            {describirAccion(fila.accion, fila.entityType)}
          </Typography>
        </Box>
      ))}
      <Box sx={{ pb: 1 }} />
    </Paper>
  )
}
