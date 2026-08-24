import { Box, Typography } from '@mui/material'
import GlassCard from './GlassCard'
import type { PublicationItem } from '../types'

interface PublicationCardProps {
  publication: PublicationItem
}

export default function PublicationCard({ publication }: PublicationCardProps) {
  const categoryLabel =
    publication.category === 'boletin'
      ? 'Boletín'
      : publication.category === 'dossier'
        ? 'Dossier de prensa'
        : publication.category === 'anuario'
          ? 'Anuario'
          : 'Historia'

  return (
    <GlassCard
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        '&:hover': { background: 'rgba(255, 255, 255, 0.05)' },
      }}
    >
      <Box
        component="a"
        href={publication.fileUrl || '#'}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        {publication.image && (
          <Box
            component="img"
            src={publication.image}
            alt={publication.title}
            sx={{
              width: '100%',
              height: 180,
              objectFit: 'cover',
              opacity: 0.85,
              transition: 'transform 0.5s ease, opacity 0.3s ease',
              '&:hover': { transform: 'scale(1.03)', opacity: 1 },
            }}
          />
        )}
        <Box sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="overline" sx={{ color: 'secondary.main', fontSize: '11px', mb: 1 }}>
            {categoryLabel}
          </Typography>
          <Typography variant="h5" component="h3" sx={{ color: 'text.primary', mb: 1, fontSize: '20px' }}>
            {publication.title}
          </Typography>
          {publication.description && (
            <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }}>
              {publication.description}
            </Typography>
          )}
          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary', opacity: 0.7 }}>
            {new Date(publication.date).toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'long',
            })}
          </Typography>
        </Box>
      </Box>
    </GlassCard>
  )
}
