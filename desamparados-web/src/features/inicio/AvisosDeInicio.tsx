import { Box, Button, Skeleton, Typography } from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'

interface AvisosDeInicioProps {
  loading: boolean
  error: boolean
  empty: boolean
  label: string
  emptyMessage: string
  retry: () => void
  /** Sobre fondo claro, como la tarjeta de papel de la agenda. */
  claro?: boolean
}

export default function AvisosDeInicio({ loading, error, empty, label, emptyMessage, retry, claro = false }: AvisosDeInicioProps) {
  if (loading) return (
    <Box role="status" aria-label={`Cargando ${label}`} sx={{ display: 'grid', gap: 1.5, py: 2, ...(claro && { '& .MuiSkeleton-root': { bgcolor: 'rgba(27,28,26,.08)' } }) }}>
      <Skeleton variant="rounded" height={90} />
      <Skeleton width="85%" />
      <Skeleton width="60%" />
    </Box>
  )
  if (!error && !empty) return null
  return (
    <Box
      role="status"
      sx={{
        p: { xs: 2.5, md: 3 },
        border: claro ? '1px solid rgba(27,28,26,.12)' : '1px solid rgba(204,196,201,.15)',
        borderRadius: 2,
        background: claro ? 'rgba(27,28,26,.03)' : 'rgba(255,255,255,.025)',
      }}
    >
      <Typography sx={{ fontSize: 15, color: claro ? '#4a454a' : 'text.secondary' }}>
        {error ? `No se ha podido cargar ${label}. Inténtalo de nuevo en unos instantes.` : emptyMessage}
      </Typography>
      {error && <Button onClick={retry} startIcon={<RefreshIcon />} sx={{ mt: 1.5, px: 0, minHeight: 44, color: claro ? '#6e1822' : 'secondary.main', fontSize: 12 }}>Volver a intentar</Button>}
    </Box>
  )
}
