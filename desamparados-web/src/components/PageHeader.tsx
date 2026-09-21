import { Box, Typography } from '@mui/material'

interface PageHeaderProps {
  title: string
  subtitle?: string
  image?: string
  /** Qué se ve en la foto. Sin ella, se repite el título: toda foto necesita
   *  descripción, y una redundancia con el título es mejor que dejarla sin ella. */
  imageAlt?: string
  /** La página ya trae la foto de fondo detrás de todo (`FondoDePagina`): aquí
   *  no se pinta nada propio, ni foto ni color, para dejarla pasar. */
  sobreFondo?: boolean
}

export default function PageHeader({ title, subtitle, image, imageAlt, sobreFondo }: PageHeaderProps) {
  const conFotoPropia = Boolean(image) && !sobreFondo
  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        // Arriba, lo de siempre: en escritorio la barra de navegación es fija y va
        // encima. Abajo, poco: el contenido que sigue ya trae su aire (espaciado.ts).
        pt: { xs: 10, md: 14 },
        pb: { xs: 5, md: 7 },
        backgroundColor: image || sobreFondo ? 'transparent' : 'background.paper',
        overflow: 'hidden',
      }}
    >
      {conFotoPropia && (
        <>
          <Box
            component="img"
            src={image}
            // Respaldo en el título, no en cadena vacía: las páginas cuya foto
            // no viene del CMS (p. ej. Sagrada Titular, con una foto fija en el
            // código) no pasan `imageAlt`, y no por eso la foto se queda sin
            // describir. Las que sí traen cabecera del CMS siempre rellenan
            // `fotoAlt` en cuanto hay foto, así que aquí manda su descripción.
            alt={imageAlt ?? title}
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
