import { useState } from 'react'
import { Box, Link as EnlaceMui, Typography, useMediaQuery, useTheme } from '@mui/material'
import { Link } from 'react-router-dom'
import Boton from '../../components/Boton'
import type { Producto, TallaDeProducto } from '../../lib/api/tienda'
import { GRANATE, PAPEL } from '../inicio/estilos'
import { ElegirTalla } from './ElegirTalla'
import { POCAS, agotado, claveDe, enlaceDeFicha, euros, conTallas, primeraConExistencias, quedanDe, quedanEnTotal, topeDe, type Cesta } from './cesta'


/**
 * La foto de un producto sobre papel: las de la tienda suelen venir con fondo
 * blanco (la camiseta, recortada), y sobre la web oscura quedaban como un
 * recuadro. Con el papel debajo y el blanco fundido («multiply»), la prenda
 * parece puesta sobre la mesa. Las fotos con fondo propio apenas cambian.
 */
export function FotoSobrePapel({ src, alt, proporcion = '1 / 1', ajuste = 'contain', relleno = 0 }: {
  src: string | null
  alt: string
  proporcion?: string
  ajuste?: 'cover' | 'contain'
  relleno?: number
}) {
  return (
    <Box sx={{ position: 'relative', aspectRatio: proporcion, bgcolor: PAPEL, borderRadius: '4px', overflow: 'hidden' }}>
      {src && (
        <Box component="img" src={src} alt={alt} loading="lazy"
          sx={{ width: '100%', height: '100%', objectFit: ajuste, p: relleno, boxSizing: 'border-box', mixBlendMode: 'multiply', display: 'block', transition: 'transform .5s ease' }} />
      )}
    </Box>
  )
}

/**
 * Un producto en la rejilla de la tienda. La foto y el nombre llevan a su
 * ficha. Se puede añadir sin entrar: con tallas, eligiéndola aquí mismo en el
 * ordenador; en el móvil, cinco botones de talla no caben en media tarjeta, y
 * «Elegir talla» lleva a la ficha.
 */
export default function TarjetaDeProducto({ producto: p, pagoDisponible, cesta, onAnadir }: {
  producto: Producto
  pagoDisponible: boolean
  cesta: Cesta
  onAnadir: (talla: TallaDeProducto | null) => void
}) {
  const theme = useTheme()
  const ancho = useMediaQuery(theme.breakpoints.up('sm'), { noSsr: true })
  const [talla, setTalla] = useState<TallaDeProducto | null>(() => primeraConExistencias(p))
  const sinNada = agotado(p)
  const total = quedanEnTotal(p)
  const pocas = total !== null && total > 0 && total <= POCAS
  const enCesta = cesta[claveDe(p.id, conTallas(p) ? talla?.id : null)] ?? 0
  const lleno = enCesta >= topeDe(quedanDe(p, talla))
  const fotos = (p.foto ? 1 : 0) + p.fotos.length

  return (
    <Box component="li" sx={{ display: 'flex', flexDirection: 'column', '&:hover img': { transform: 'scale(1.04)' } }}>
      <Box component={Link} to={enlaceDeFicha(p)} aria-label={`Ver ${p.nombre}`}
        sx={{ position: 'relative', display: 'block', borderRadius: '4px', '&:focus-visible': { outline: '2px solid #dec72b', outlineOffset: 3 } }}>
        {/* Entera, sin recortar: las prendas vienen recortadas sobre blanco y
            cortarles las mangas las estropea. */}
        <FotoSobrePapel src={p.foto} alt="" proporcion="1 / 1" ajuste="contain" relleno={1.5} />
        {(sinNada || pocas) && (
          <Box component="span" sx={{
            position: 'absolute', left: 10, top: 10, px: 1, py: 0.5, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            bgcolor: sinNada ? '#161214' : GRANATE, color: sinNada ? PAPEL : '#fff',
          }}>
            {sinNada ? 'Agotado' : `Quedan ${total}`}
          </Box>
        )}
        {fotos > 1 && (
          <Box component="span" aria-hidden="true" sx={{ position: 'absolute', right: 10, bottom: 10, px: 1, py: 0.25, borderRadius: 3, fontSize: 12, fontWeight: 600, bgcolor: 'rgba(22, 18, 20, 0.82)', color: PAPEL }}>
            {fotos} fotos
          </Box>
        )}
      </Box>
      <Typography component="h2" sx={{ mt: 1.75, fontSize: { xs: 16, sm: 18 }, fontWeight: 600, lineHeight: 1.3 }}>
        <EnlaceMui component={Link} to={enlaceDeFicha(p)} underline="hover" color="inherit">{p.nombre}</EnlaceMui>
      </Typography>
      {p.descripcion && ancho && (
        <Typography variant="body2" sx={{ mt: 0.5, color: 'text.secondary', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {p.descripcion}
        </Typography>
      )}
      {conTallas(p) && ancho && pagoDisponible && !sinNada && (
        <Box sx={{ mt: 1.5 }}><ElegirTalla producto={p} elegida={talla} onElegir={setTalla} /></Box>
      )}
      {/* En el móvil, el precio encima y el botón a lo ancho: en media tarjeta no caben juntos. */}
      <Box sx={{ mt: 'auto', pt: 1.5, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={{ fontSize: { xs: 16, sm: 19 }, fontVariantNumeric: 'tabular-nums' }}>{euros(p.precio)}</Typography>
        {sinNada ? <Typography variant="body2" color="text.secondary">Agotado</Typography>
          : pagoDisponible && (conTallas(p) && !ancho
            ? <Boton appVariant="claro" component={Link} to={enlaceDeFicha(p)} size="small" fullWidth={!ancho}>Elegir talla</Boton>
            : <Boton size="small" fullWidth={!ancho} onClick={() => onAnadir(conTallas(p) ? talla : null)} disabled={lleno || (conTallas(p) && !talla)}>
              {enCesta ? `En la cesta · ${enCesta}` : 'Añadir'}
            </Boton>)}
      </Box>
    </Box>
  )
}
