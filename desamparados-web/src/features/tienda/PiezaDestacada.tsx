import { useState } from 'react'
import { Box, ButtonBase, Link as EnlaceMui, Typography } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import { Link } from 'react-router-dom'
import Boton from '../../components/Boton'
import type { Producto, TallaDeProducto } from '../../lib/api/tienda'
import { GOLD, PAPEL } from '../inicio/estilos'
import { ElegirTalla } from './ElegirTalla'
import { SelloDeExistencias } from './TarjetaDeProducto'
import { agotado, avisoDeTallas, claveDe, conTallas, enlaceDeFicha, euros, quedanDe, topeDe, type Cesta } from './cesta'

const fundido = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`

/**
 * El producto destacado de la tienda, en forma de mostrador: la foto entera
 * sobre papel con sus miniaturas, y al lado el nombre y las tallas, para
 * elegir la talla y añadirlo a la cesta sin abrir la ficha. Desde la tableta
 * ocupa dos columnas y dos filas de la rejilla; en el móvil, el ancho entero,
 * con la foto arriba.
 *
 * Antes la foto iba a sangre, recortada para llenar el recuadro: con una foto
 * de producto sobre blanco (la camiseta) no se veía qué se vendía. Entera vale
 * para cualquier foto.
 *
 * La talla empieza sin elegir, y no con la primera que queda como en la
 * ficha: aquí el botón se lee de pasada, y «Añadir talla S» sin haberla
 * elegido llevaría a comprar una talla que nadie ha pedido.
 */
export default function PiezaDestacada({ producto: p, pagoDisponible, cesta, onAnadir }: {
  producto: Producto
  pagoDisponible: boolean
  cesta: Cesta
  onAnadir: (talla: TallaDeProducto | null) => void
}) {
  const [foto, setFoto] = useState(0)
  const [talla, setTalla] = useState<TallaDeProducto | null>(null)

  const medios = [
    ...(p.foto ? [{ url: p.foto, alt: p.nombre, pie: '' }] : []),
    ...p.fotos.map((f, i) => ({ url: f.url, alt: f.pie || `${p.nombre}, foto ${i + 2}`, pie: f.pie })),
  ]
  const actual = medios[Math.min(foto, medios.length - 1)]

  const sinNada = agotado(p)
  const tallas = conTallas(p)
  const enCesta = cesta[claveDe(p.id, tallas ? talla?.id : null)] ?? 0
  const lleno = enCesta >= topeDe(quedanDe(p, talla))
  const aviso = tallas ? avisoDeTallas(p, talla) : ''

  const textoDelBoton = tallas && !talla
    ? 'Elige una talla'
    : enCesta
      ? `En la cesta · ${enCesta}`
      : `Añadir${talla ? ` talla ${talla.nombre}` : ''} · ${euros(p.precio)}`

  return (
    <Box component="li" sx={{
      gridColumn: 'span 2', gridRow: { sm: 'span 2' }, minHeight: { sm: 380 },
      display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '44% minmax(0, 1fr)' },
      bgcolor: '#0c0b0d', borderRadius: '4px', overflow: 'hidden',
    }}>
      <Box sx={{ position: 'relative', display: 'grid', gridTemplateRows: 'minmax(0, 1fr) auto', bgcolor: PAPEL, height: { xs: 300, sm: 'auto' } }}>
        <Box component={Link} to={enlaceDeFicha(p)} tabIndex={-1} aria-hidden sx={{ position: 'relative', minHeight: 0, display: 'block', p: { xs: 2, sm: 2.25 }, pb: 0.75 }}>
          {actual && (
            // Con cada foto se monta de nuevo (su `key`), y el fundido vuelve a empezar.
            <Box key={actual.url} component="img" src={actual.url} alt="" sx={{
              width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'multiply', display: 'block',
              animation: `${fundido} .4s ease both`, '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
            }} />
          )}
        </Box>
        {medios.length > 1 && (
          <Box sx={{ display: 'flex', gap: 1, px: { xs: 2, sm: 2.25 }, pb: 1.75, overflowX: 'auto' }}>
            {medios.map((m, i) => (
              <ButtonBase key={m.url} onClick={() => setFoto(i)} aria-pressed={i === foto} aria-label={`Ver la foto ${i + 1}${m.pie ? `: ${m.pie}` : ''}`}
                sx={{
                  flex: 'none', width: 46, height: 46, p: '3px', borderRadius: '3px', bgcolor: '#ece6da',
                  border: '1px solid', borderColor: i === foto ? '#1b1c1a' : 'transparent',
                  '&.Mui-focusVisible': { outline: `2px solid ${GOLD}`, outlineOffset: 2 },
                }}>
                <Box component="img" src={m.url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'multiply', display: 'block' }} />
              </ButtonBase>
            ))}
          </Box>
        )}
        <SelloDeExistencias producto={p} />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1.1, px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 3 }, minWidth: 0, color: '#fff' }}>
        <Typography component="p" sx={{ fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: GOLD, fontWeight: 600 }}>Destacado</Typography>
        <Typography component="h2" sx={{ fontSize: { xs: 26, md: 32 }, fontWeight: 300, lineHeight: 1.08, letterSpacing: '-0.01em' }}>
          <EnlaceMui component={Link} to={enlaceDeFicha(p)} underline="hover" color="inherit">{p.nombre}</EnlaceMui>
        </Typography>
        {p.descripcion && (
          <Typography sx={{
            maxWidth: 440, fontSize: 14, lineHeight: 1.55, color: '#e4e2df',
            display: { xs: 'none', sm: '-webkit-box' }, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>{p.descripcion}</Typography>
        )}

        {pagoDisponible && !sinNada && tallas && (
          <Box sx={{ mt: 0.5 }}>
            <Typography component="p" sx={{ mb: 0.75, fontSize: 11, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'text.secondary' }}>Talla</Typography>
            <ElegirTalla producto={p} elegida={talla} onElegir={setTalla} />
            {aviso && <Typography aria-live="polite" sx={{ mt: 0.75, fontSize: 13, color: 'text.secondary' }}>{aviso}</Typography>}
          </Box>
        )}

        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          {pagoDisponible && !sinNada
            ? <Boton onClick={() => onAnadir(tallas ? talla : null)} disabled={(tallas && !talla) || lleno}>{textoDelBoton}</Boton>
            : <Typography sx={{ fontSize: 20, fontWeight: 300, color: '#e3d8bf' }}>{sinNada ? 'Agotado' : euros(p.precio)}</Typography>}
          <EnlaceMui component={Link} to={enlaceDeFicha(p)} underline="hover" sx={{ color: PAPEL, fontWeight: 600, fontSize: 14, minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
            Ver el producto
          </EnlaceMui>
        </Box>
      </Box>
    </Box>
  )
}
