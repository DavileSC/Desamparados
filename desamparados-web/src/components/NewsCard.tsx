import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import GlassCard from './GlassCard'
import type { NewsItem } from '../types'

interface NewsCardProps {
  news: NewsItem
  featured?: boolean
}

export default function NewsCard({ news, featured = false }: NewsCardProps) {
  return (
    <GlassCard
      goldBorder
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        minHeight: featured ? { xs: '360px', md: '420px' } : 'auto',
        p: 0,
        overflow: 'hidden',
        '&:hover': { background: 'rgba(255, 255, 255, 0.05)' },
      }}
    >
      <Box
        component={Link}
        to={`/actualidad/noticias/${news.slug}`}
        sx={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          flex: 1,
          minHeight: featured ? { xs: '360px', md: '420px' } : 'auto',
          p: featured ? 4 : 3,
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
      {news.image && (
        <>
          <Box
            component="img"
            src={news.image}
            alt={news.title}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.6,
              mixBlendMode: 'overlay',
              transition: 'transform 0.7s ease',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(38,35,38,0.92) 0%, transparent 65%)',
            }}
          />
        </>
      )}

      <Box sx={{ position: 'relative', zIndex: 2 }}>
        <Box
          sx={{
            display: 'inline-block',
            px: 1.5,
            py: 0.5,
            mb: 2,
            backgroundColor: 'background.paper',
            color: '#100e11',
            typography: 'overline',
            fontSize: '11px',
            borderRadius: '4px',
          }}
        >
          {news.category}
        </Box>
        <Typography
          variant={featured ? 'h3' : 'h5'}
          component="h3"
          sx={{
            color: 'text.primary',
            mb: 1,
            fontSize: featured ? { xs: '24px', md: '32px' } : '20px',
            transition: 'color 0.3s ease',
            '&:hover': { color: 'secondary.main' },
          }}
        >
          {news.title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            display: '-webkit-box',
            WebkitLineClamp: featured ? 2 : 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {news.excerpt}
        </Typography>
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 1.5, color: 'text.secondary', opacity: 0.7 }}
        >
          {new Date(news.date).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </Typography>
      </Box>
      </Box>
    </GlassCard>
  )
}
