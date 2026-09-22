import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import TarjetaCristal from './TarjetaCristal'
import type { Publicacion } from '../types'

interface TarjetaPublicacionProps {
  publicacion: Publicacion
}

export default function TarjetaPublicacion({ publicacion }: TarjetaPublicacionProps) {
  // Una portada cuyo fichero ya no está se quita, como si no la tuviera: mejor
  // que el icono de imagen rota ocupando la cabeza de la tarjeta.
  const [portadaRota, setPortadaRota] = useState<string | null>(null)
  const rotuloCategoria =
    publicacion.categoria === 'boletin'
      ? 'Boletín'
      : publicacion.categoria === 'dossier'
        ? 'Dossier de prensa'
        : publicacion.categoria === 'anuario'
          ? 'Anuario'
          : 'Historia'

  return (
    <TarjetaCristal
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
        href={publicacion.archivoUrl || '#'}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        {publicacion.imagen && portadaRota !== publicacion.imagen && (
          <Box
            component="img"
            src={publicacion.imagen}
            onError={() => setPortadaRota(publicacion.imagen ?? null)}
            alt={publicacion.titulo}
            loading="lazy"
            decoding="async"
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
            {rotuloCategoria}
          </Typography>
          <Typography variant="h5" component="h3" sx={{ color: 'text.primary', mb: 1, fontSize: '20px' }}>
            {publicacion.titulo}
          </Typography>
          {publicacion.descripcion && (
            <Typography variant="body2" sx={{ color: 'text.secondary', flex: 1 }}>
              {publicacion.descripcion}
            </Typography>
          )}
          <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary', opacity: 0.7 }}>
            {new Date(publicacion.fecha).toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'long',
            })}
          </Typography>
        </Box>
      </Box>
    </TarjetaCristal>
  )
}
