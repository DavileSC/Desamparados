import { Box, Link as EnlaceMui, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import Boton from '../../components/Boton'
import type { Producto } from '../../lib/api/tienda'
import { GOLD, PAPEL } from '../inicio/estilos'
import { SelloDeExistencias } from './TarjetaDeProducto'
import { agotado, claveDe, conTallas, enlaceDeFicha, euros, quedanDe, topeDe, type Cesta } from './cesta'

/**
 * La pieza destacada de la tienda: el doble de grande que las demás, con la
 * foto a sangre y su nombre encima. Desde la tableta ocupa dos columnas y dos
 * filas de la rejilla; en el móvil, el ancho entero. La foto se recorta para
 * llenar el recuadro: para destacar va mejor una de ambiente que una prenda
 * recortada sobre blanco (el CMS lo dice al marcarla).
 */
export default function PiezaDestacada({ producto: p, pagoDisponible, cesta, onAnadir }: {
  producto: Producto
  pagoDisponible: boolean
  cesta: Cesta
  onAnadir: () => void
}) {
  const sinNada = agotado(p)
  const enCesta = conTallas(p) ? 0 : cesta[claveDe(p.id)] ?? 0
  const lleno = enCesta >= topeDe(quedanDe(p))

  return (
    <Box component="li" sx={{
      gridColumn: 'span 2', gridRow: { sm: 'span 2' }, position: 'relative', minHeight: { xs: 300, sm: 380 },
      bgcolor: PAPEL, borderRadius: '4px', overflow: 'hidden', '&:hover img': { transform: 'scale(1.04)' },
    }}>
      {p.foto && (
        <Box component="img" src={p.foto} alt="" sx={{
          position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', mixBlendMode: 'multiply',
          transition: 'transform .8s cubic-bezier(.2, .7, .2, 1)', '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }} />
      )}
      <SelloDeExistencias producto={p} />
      {/* El velo de abajo es lo que deja leer el nombre sobre cualquier foto. */}
      <Box sx={{
        position: 'absolute', left: 0, right: 0, bottom: 0, px: { xs: 2, md: 4 }, pb: { xs: 2, md: 3.75 }, pt: { xs: 9, md: 15 },
        background: 'linear-gradient(to top, rgba(12, 11, 13, 0.9), rgba(12, 11, 13, 0))', color: '#fff',
      }}>
        <Typography component="p" sx={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: GOLD, fontWeight: 600 }}>Pieza destacada</Typography>
        <Typography component="h2" sx={{ mt: 1, fontSize: { xs: 24, md: 38 }, fontWeight: 300, lineHeight: 1.08, letterSpacing: '-0.01em' }}>
          <EnlaceMui component={Link} to={enlaceDeFicha(p)} underline="hover" color="inherit">{p.nombre}</EnlaceMui>
        </Typography>
        {p.descripcion && (
          <Typography sx={{
            mt: 1, maxWidth: 440, fontSize: 15, lineHeight: 1.55, color: '#e4e2df',
            display: { xs: 'none', sm: '-webkit-box' }, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{p.descripcion}</Typography>
        )}
        <Box sx={{ mt: { xs: 1.5, md: 2.5 }, display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
          {pagoDisponible && !sinNada
            ? (conTallas(p)
              ? <Boton component={Link} to={enlaceDeFicha(p)}>Elegir talla · {euros(p.precio)}</Boton>
              : <Boton onClick={onAnadir} disabled={lleno}>{enCesta ? `En la cesta · ${enCesta}` : `Añadir · ${euros(p.precio)}`}</Boton>)
            : <Typography sx={{ fontSize: 20, fontWeight: 300, color: '#e3d8bf' }}>{sinNada ? 'Agotado' : euros(p.precio)}</Typography>}
          <EnlaceMui component={Link} to={enlaceDeFicha(p)} underline="hover" sx={{ color: PAPEL, fontWeight: 600, fontSize: 14, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
            Ver la pieza
          </EnlaceMui>
        </Box>
      </Box>
    </Box>
  )
}
