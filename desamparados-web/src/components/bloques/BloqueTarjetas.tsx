import { Box, Grid, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import GlassCard from '../GlassCard'
import type { BloqueTarjetas as Datos, TarjetaEnlace } from '../../lib/api/contenido'
import { esDestinoValido } from '../../lib/destinos'

/** Mismo marcado que tenía `CorporationPage` a mano, para que convertir esa
 *  página a bloques no le cambie el aspecto. */
export default function BloqueTarjetas({ bloque }: { bloque: Datos }) {
  return (
    <Grid container spacing={3}>
      {bloque.tarjetas.map((tarjeta, indice) => (
        // La clave es posicional porque una tarjeta no tiene identificador
        // propio y el enlace dejó de servir: ahora es opcional, así que dos
        // tarjetas informativas compartirían la cadena vacía.
        <Grid key={indice} size={{ xs: 12, md: 6, lg: 4 }}>
          <Tarjeta tarjeta={tarjeta} />
        </Grid>
      ))}
    </Grid>
  )
}

/**
 * Sin enlace, la tarjeta es informativa: ni `<a>`, ni cursor de mano, ni
 * realce al pasar por encima. Un recuadro que se ilumina y no lleva a ninguna
 * parte es una promesa que no se cumple, y además aparecería en la lista de
 * enlaces de quien navega con lector de pantalla.
 */
function Tarjeta({ tarjeta }: { tarjeta: TarjetaEnlace }) {
  const contenido = (
    <>
      <Typography variant="h6" component="h3" sx={{ mb: 1, color: 'text.primary' }}>{tarjeta.titulo}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>{tarjeta.descripcion}</Typography>
    </>
  )

  // Un enlace guardado antes de que el CMS solo dejara elegir páginas que
  // existen puede llevar a ninguna parte: mejor una tarjeta informativa que
  // una que promete y acaba en «página no encontrada».
  if (!tarjeta.enlace || !esDestinoValido(tarjeta.enlace)) {
    return <GlassCard sx={{ p: 4, height: '100%' }}>{contenido}</GlassCard>
  }

  return (
    <Box component={Link} to={tarjeta.enlace} sx={{ display: 'block', height: '100%', textDecoration: 'none', color: 'inherit' }}>
      <GlassCard sx={{ p: 4, height: '100%', '&:hover': { borderColor: 'rgba(193, 172, 0, 0.3)', transform: 'translateY(-4px)' } }}>
        {contenido}
      </GlassCard>
    </Box>
  )
}
