import { Box, Typography } from '@mui/material'
import { enlaceEsmalte } from './esmalte'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

interface TituloDeSeccionProps {
  title: string
  actionLabel?: string
  actionHref?: string
  centered?: boolean
}

export default function TituloDeSeccion({
  title,
  actionLabel,
  actionHref = '#',
  centered = false,
}: TituloDeSeccionProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 2,
        justifyContent: centered ? 'center' : 'space-between',
        alignItems: 'flex-end',
        mb: 4,
        pb: 1,
        borderBottom: '1px solid rgba(204, 196, 201, 0.2)',
      }}
    >
      <Typography
        variant="h2"
        component="h2"
        sx={{ fontSize: { xs: '32px', md: '48px' }, textAlign: centered ? 'center' : 'left' }}
      >
        {title}
      </Typography>
      {actionLabel && (
        <Box component="a" href={actionHref} sx={{ ...enlaceEsmalte, flexShrink: 0 }}>
          {actionLabel} <ArrowForwardIcon aria-hidden />
        </Box>
      )}
    </Box>
  )
}
