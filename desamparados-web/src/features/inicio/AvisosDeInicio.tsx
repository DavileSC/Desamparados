import { Box, Typography } from '@mui/material'

/**
 * Lo que dice un bloque de la portada cuando el servidor ha contestado y no
 * hay nada que enseñar («No hay noticias publicadas por el momento»). Mientras
 * carga y si falla, el bloque lleva su esqueleto (`EnCarga`).
 */
export default function AvisosDeInicio({ mensaje, claro = false }: { mensaje: string; /** Sobre fondo claro, como la tarjeta de papel de la agenda. */ claro?: boolean }) {
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
      <Typography sx={{ fontSize: 15, color: claro ? '#4a454a' : 'text.secondary' }}>{mensaje}</Typography>
    </Box>
  )
}
