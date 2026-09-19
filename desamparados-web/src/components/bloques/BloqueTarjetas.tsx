import { Box, Grid, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import GlassCard from '../GlassCard'
import type { BloqueTarjetas as Datos, TarjetaEnlace } from '../../lib/api/contenido'
import { esDestinoValido } from '../../lib/destinos'

/**
 * Cuántas columnas ocupa cada tarjeta según cuántas haya. Siempre a tres
 * columnas, dos tarjetas dejaban un tercio vacío a la derecha (Nuestros
 * fines) y una sola, dos tercios. Ahora una va sola y ancha, dos y cuatro se
 * reparten a pares y lo demás va de tres en tres.
 */
function columnas(cuantas: number) {
  if (cuantas === 1) return { xs: 12 }
  if (cuantas === 2 || cuantas === 4) return { xs: 12, md: 6 }
  return { xs: 12, md: 6, lg: 4 }
}

/** El marcado de las tarjetas que tenía `CorporationPage` a mano. Con pocas,
 *  la rejilla se estrecha a lo que mide una foto (1000 px): a todo el ancho,
 *  dos tarjetas quedaban mucho más anchas que el texto de encima. */
export default function BloqueTarjetas({ bloque }: { bloque: Datos }) {
  const cuantas = bloque.tarjetas.length
  return (
    // La última fila, si no se llena, va centrada y no pegada a la izquierda.
    <Grid container spacing={3} sx={{ justifyContent: 'center', maxWidth: cuantas <= 2 ? '1000px' : undefined, mx: 'auto' }}>
      {bloque.tarjetas.map((tarjeta, indice) => (
        // La clave es posicional porque una tarjeta no tiene identificador
        // propio y el enlace dejó de servir: ahora es opcional, así que dos
        // tarjetas informativas compartirían la cadena vacía.
        <Grid key={indice} size={columnas(cuantas)}>
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
