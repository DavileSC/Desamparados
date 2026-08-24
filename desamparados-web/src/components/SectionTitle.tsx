import { Box, Typography, Button } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

interface SectionTitleProps {
  title: string
  actionLabel?: string
  actionHref?: string
  centered?: boolean
}

export default function SectionTitle({
  title,
  actionLabel,
  actionHref = '#',
  centered = false,
}: SectionTitleProps) {
  return (
    <Box
      sx={{
        display: 'flex',
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
        <Button
          href={actionHref}
          endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
          sx={{
            color: 'secondary.main',
            typography: 'overline',
            fontSize: '12px',
            '&:hover': { color: 'secondary.light' },
          }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  )
}
