import { useRef, useState } from 'react'
import { Box, ButtonBase, Link as EnlaceMui, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { Link } from 'react-router-dom'
import type { Producto } from '../../lib/api/tienda'
import { GOLD, GRANATE, PAPEL } from '../inicio/estilos'
import { propsDeFoto } from '../../lib/fotoSubida'
import Chispa from './Chispa'
import { POCAS, agotado, claveDe, enlaceDeFicha, euros, conTallas, quedanDe, quedanEnTotal, topeDe, type Cesta } from './cesta'


/**
 * La foto de un producto sobre papel: las de la tienda suelen venir con fondo
 * blanco (la camiseta, recortada), y sobre la web oscura quedaban como un
 * recuadro. Con el papel debajo y el blanco fundido («multiply»), la prenda
 * parece puesta sobre la mesa. Las fotos con fondo propio apenas cambian.
 */
export function FotoSobrePapel({ src, alt, sizes, proporcion = '1 / 1', ajuste = 'contain', relleno = 0 }: {
  src: string | null
  /** Lo que ocupa en pantalla: con él, el navegador baja la copia de 640 o 1280 y no la de 1920. */
  sizes: string
  alt: string
  proporcion?: string
  ajuste?: 'cover' | 'contain'
  relleno?: number
}) {
  return (
    <Box sx={{ position: 'relative', aspectRatio: proporcion, bgcolor: PAPEL, borderRadius: '4px', overflow: 'hidden' }}>
      {src && (
        <Box component="img" {...propsDeFoto(src, sizes)} alt={alt} loading="lazy"
          sx={{ width: '100%', height: '100%', objectFit: ajuste, p: relleno, boxSizing: 'border-box', mixBlendMode: 'multiply', display: 'block', transition: 'transform .5s ease' }} />
      )}
    </Box>
  )
}

/** El sello de la esquina: agotado, o cuántas quedan si son pocas. Nada si hay de sobra. */
export function SelloDeExistencias({ producto: p }: { producto: Producto }) {
  const total = quedanEnTotal(p)
  const sinNada = agotado(p)
  if (!sinNada && !(total !== null && total > 0 && total <= POCAS)) return null
  return (
    <Box component="span" sx={{
      position: 'absolute', left: 10, top: 10, px: 1.25, py: 0.5, borderRadius: '12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
      bgcolor: sinNada ? '#161214' : GRANATE, color: sinNada ? PAPEL : '#fff',
    }}>
      {sinNada ? 'Agotado' : `Quedan ${total}`}
    </Box>
  )
}

/** El botón redondo de la esquina de la foto: suma uno a la cesta sin entrar en la ficha. */
const redondo = (enCesta: boolean) => ({
  position: 'absolute', right: 10, bottom: 10, width: 44, height: 44, borderRadius: '22px',
  bgcolor: enCesta ? GRANATE : '#161214', color: enCesta ? '#fff' : PAPEL, fontFamily: 'inherit', fontWeight: 700, fontSize: 15,
  transition: 'background-color .2s ease, color .2s ease, transform .2s ease',
  '&:hover': { bgcolor: '#fff', color: GRANATE, transform: 'scale(1.06)' },
  '&.Mui-focusVisible': { outline: `2px solid ${GOLD}`, outlineOffset: 2 },
  '&.Mui-disabled': { opacity: 0.45 },
  '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
}) as const

/**
 * Un producto en la rejilla de la tienda: la foto y el nombre llevan a su
 * ficha, y el «+» de la esquina lo añade sin entrar (marca cuántos llevas).
 * Con tallas, el «+» lleva a la ficha para elegirla: cinco botones de talla
 * no caben en la tarjeta. Al añadir, el botón se hunde un instante y suelta
 * una chispa de oro: se ve que ha entrado aunque la cesta quede lejos.
 */
export default function TarjetaDeProducto({ producto: p, pagoDisponible, cesta, onAnadir }: {
  producto: Producto
  pagoDisponible: boolean
  cesta: Cesta
  onAnadir: () => void
}) {
  const sinNada = agotado(p)
  const enCesta = conTallas(p) ? 0 : cesta[claveDe(p.id)] ?? 0
  const lleno = enCesta >= topeDe(quedanDe(p))
  const fotos = (p.foto ? 1 : 0) + p.fotos.length
  // Cada pulsación monta una chispa nueva (por su `key`), así vuelve a saltar.
  const [chispas, setChispas] = useState(0)
  const refMas = useRef<HTMLButtonElement>(null)
  const anadir = () => {
    onAnadir()
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    setChispas((n) => n + 1)
    refMas.current?.animate?.([{ scale: 1 }, { scale: 0.86, offset: 0.35 }, { scale: 1 }], { duration: 350, easing: 'ease-out' })
  }

  return (
    <Box component="li" sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, '&:hover img': { transform: 'scale(1.04)' } }}>
      <Box sx={{ position: 'relative' }}>
        <Box component={Link} to={enlaceDeFicha(p)} aria-label={`Ver ${p.nombre}${fotos > 1 ? `, ${fotos} fotos` : ''}`}
          sx={{ display: 'block', borderRadius: '4px', '&:focus-visible': { outline: `2px solid ${GOLD}`, outlineOffset: 3 } }}>
          {/* Entera, sin recortar: las prendas vienen recortadas sobre blanco y
              cortarles las mangas las estropea. */}
          <FotoSobrePapel src={p.foto} alt="" sizes="(min-width: 1200px) 25vw, (min-width: 600px) 33vw, 50vw" proporcion="1 / 1" ajuste="contain" relleno={1.5} />
        </Box>
        <SelloDeExistencias producto={p} />
        {pagoDisponible && !sinNada && (conTallas(p)
          ? <ButtonBase component={Link} to={enlaceDeFicha(p)} aria-label={`Elegir la talla de ${p.nombre}`} sx={redondo(false)}><AddIcon fontSize="small" aria-hidden /></ButtonBase>
          : <ButtonBase ref={refMas} onClick={anadir} disabled={lleno}
            aria-label={enCesta ? `Añadir otra unidad de ${p.nombre} (llevas ${enCesta})` : `Añadir ${p.nombre} a la cesta`} sx={redondo(enCesta > 0)}>
            {enCesta ? enCesta : <AddIcon fontSize="small" aria-hidden />}
            {chispas > 0 && <Chispa key={chispas} />}
          </ButtonBase>)}
      </Box>
      <Box sx={{ mt: 1.25, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1.25 }}>
        <Typography component="h2" sx={{ fontSize: { xs: 14.5, sm: 16 }, fontWeight: 500, lineHeight: 1.3, minWidth: 0 }}>
          <EnlaceMui component={Link} to={enlaceDeFicha(p)} underline="hover" color="inherit">{p.nombre}</EnlaceMui>
        </Typography>
        <Typography sx={{ fontSize: { xs: 14.5, sm: 16 }, fontWeight: 300, color: '#e3d8bf', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{euros(p.precio)}</Typography>
      </Box>
    </Box>
  )
}
