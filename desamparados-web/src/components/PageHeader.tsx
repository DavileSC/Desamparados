import { Box, Typography } from '@mui/material'

interface PageHeaderProps {
  title: string
  subtitle?: string
  image?: string
  /** Qué se ve en la foto. Sin ella se repetiría el título. */
  imageAlt?: string
}

export default function PageHeader({ title, subtitle, image, imageAlt }: PageHeaderProps) {
  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        py: { xs: 10, md: 14 },
        mb: { xs: 4, md: 6 },
        backgroundColor: image ? 'transparent' : 'background.paper',
        overflow: 'hidden',
      }}
    >
      {image && (
        <>
          <Box
            component="img"
            src={image}
            // Foto de fondo decorativa: repetir aquí el título estorbaría a
            // quien use un lector de pantalla. Vacío si el CMS no trae descripción.
            alt={imageAlt ?? ''}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0.4,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(to top, rgba(38, 35, 38, 0.95) 0%, rgba(38, 35, 38, 0.6) 100%)',
            }}
          />
        </>
      )}
      <Box sx={{ position: 'relative', zIndex: 2, textAlign: 'center', px: { xs: '20px', md: '64px' } }}>
        <Typography variant="h2" component="h1" sx={{ fontSize: { xs: '36px', md: '56px' }, mb: subtitle ? 2 : 0 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: '700px', mx: 'auto' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
