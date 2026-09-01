import { Box, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import GlassCard from './GlassCard'
import type { NewsItem } from '../types'

interface NewsCardProps {
  news: NewsItem
  featured?: boolean
  /**
   * Consulta del listado del que sale la tarjeta (`?pagina=3&porPagina=50`).
   * Viaja en el `state` de la navegación para que el enlace «Volver a todas las
   * noticias» de la ficha devuelva a la misma página, y no a la primera. Solo
   * lo pasa el archivo de noticias: desde la portada no hay página a la que
   * volver, y entonces la ficha se queda con la ruta pelada.
   */
  volver?: string
}

export default function NewsCard({ news, featured = false, volver }: NewsCardProps) {
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
        state={volver ? { volver } : undefined}
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
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
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
        {/* Badge de categoría: dorado con texto oscuro (>9:1). Antes era #100e11 sobre
            background.paper (~1,2:1), prácticamente invisible. */}
        <Box
          sx={{
            display: 'inline-block',
            px: 1.5,
            py: 0.5,
            mb: 2,
            backgroundColor: 'secondary.main',
            color: '#201c00',
            typography: 'overline',
            fontSize: '11px',
            fontWeight: 600,
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
          component="time"
          dateTime={news.date}
          sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}
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
