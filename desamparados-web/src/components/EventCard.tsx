import { Box, Typography } from '@mui/material'
import type { EventItem } from '../types'

interface EventCardProps {
  event: EventItem
}

export default function EventCard({ event }: EventCardProps) {
  return (
    <Box
      sx={{
        pl: 3,
        py: 1,
        borderLeft: '2px solid',
        borderColor: event.highlighted ? 'secondary.main' : 'rgba(204, 196, 201, 0.3)',
      }}
    >
      <Typography
        variant="overline"
        sx={{ display: 'block', color: 'secondary.main', mb: 0.5, fontSize: '12px' }}
      >
        {event.date} {event.time && `| ${event.time}`}
      </Typography>
      <Typography variant="h5" component="h4" sx={{ color: 'text.primary', mb: 0.5, fontSize: '20px' }}>
        {event.title}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '14px' }}>
        {event.description}
      </Typography>
      {event.location && (
        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary', opacity: 0.7 }}>
          {event.location}
        </Typography>
      )}
    </Box>
  )
}
