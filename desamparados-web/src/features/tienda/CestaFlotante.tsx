import { useEffect, useRef } from 'react'
import { Box, ButtonBase } from '@mui/material'
import { visuallyHidden } from '@mui/utils'
import { useReducedMotion } from 'framer-motion'
import CifrasQueRuedan from '../../components/CifrasQueRuedan'
import { GOLD, GRANATE } from '../inicio/estilos'
import { euros } from './cesta'

const CREMA = '#f4efe5'
const TINTA = '#161214'

/**
 * La cesta que flota abajo a la derecha en cuanto lleva algo: un círculo con
 * la cesta, el total debajo y cuántos artículos en un globo granate. Ocupa
 * mucho menos que la barra de antes, que en el móvil tapaba una fila entera.
 * Al pulsarlo se abre la cesta. Cuando se añade algo, el círculo da un
 * latido y las cifras ruedan hasta las nuevas.
 */
export default function CestaFlotante({ unidades, total, onAbrir }: { unidades: number; total: number; onAbrir: () => void }) {
  const quieto = useReducedMotion() ?? false
  const ref = useRef<HTMLButtonElement>(null)
  const antes = useRef(unidades)

  // Solo late al añadir, no al quitar desde la cesta ni al volver a la página.
  useEffect(() => {
    if (unidades > antes.current && !quieto) {
      ref.current?.animate?.([{ scale: 1 }, { scale: 1.1, offset: 0.4 }, { scale: 1 }], { duration: 500, easing: 'cubic-bezier(.3, .7, .3, 1)' })
    }
    antes.current = unidades
  }, [unidades, quieto])

  const articulos = unidades === 1 ? '1 artículo' : `${unidades} artículos`
  return <>
    <ButtonBase ref={ref} onClick={onAbrir} aria-label={`Ver la cesta: ${articulos}, ${euros(total)}`} sx={{
      position: 'fixed', zIndex: 10, right: { xs: 16, md: 28 }, bottom: { xs: 16, md: 28 },
      width: { xs: 74, md: 84 }, height: { xs: 74, md: 84 }, borderRadius: '50%', flexDirection: 'column', gap: 0.5,
      bgcolor: CREMA, color: TINTA, fontFamily: 'inherit', boxShadow: '0 14px 36px rgba(0, 0, 0, 0.5)',
      transition: 'background-color .2s ease', '&:hover': { bgcolor: '#fff' },
      '&.Mui-focusVisible': { outline: `2px solid ${GOLD}`, outlineOffset: 3 },
    }}>
      <Box component="svg" viewBox="0 0 24 24" aria-hidden sx={{ width: { xs: 24, md: 26 }, height: { xs: 24, md: 26 }, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <path d="M5 8h14l-1.2 11.1a1 1 0 0 1-1 .9H7.2a1 1 0 0 1-1-.9z" />
        <path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </Box>
      <CifrasQueRuedan texto={euros(total)} sx={{ fontSize: { xs: 12, md: 13 }, fontWeight: 700 }} />
      <Box component="span" sx={{
        position: 'absolute', top: -2, right: -2, minWidth: 28, height: 28, px: 0.75, borderRadius: '14px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: GRANATE, color: '#fff', fontSize: 13, fontWeight: 700, boxShadow: `0 0 0 2px ${CREMA}`,
      }}>
        <CifrasQueRuedan texto={String(unidades)} />
      </Box>
    </ButtonBase>
    {/* Lo que cambia se dice también a quien no ve el círculo latir. */}
    <Box aria-live="polite" sx={visuallyHidden}>{articulos} en la cesta</Box>
  </>
}
