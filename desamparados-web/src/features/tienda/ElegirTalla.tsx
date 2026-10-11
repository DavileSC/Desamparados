import { Box, ButtonBase, IconButton, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import type { Producto, TallaDeProducto } from '../../lib/api/tienda'
import { PAPEL } from '../inicio/estilos'
import { MARCA } from '../../theme/marca'

/**
 * Las tallas de un producto, como botones que se marcan. Las agotadas salen
 * tachadas y no se pueden elegir: así se ve de un vistazo qué hay.
 */
export function ElegirTalla({ producto, elegida, onElegir, grande = false }: {
  producto: Producto
  elegida: TallaDeProducto | null
  onElegir: (t: TallaDeProducto) => void
  /** En la ficha, más holgados; en la tarjeta, más juntos. */
  grande?: boolean
}) {
  return (
    <Box role="group" aria-label={`Talla de ${producto.nombre}`} sx={{ display: 'flex', flexWrap: 'wrap', gap: grande ? 1 : 0.75 }}>
      {producto.tallas.map((t) => {
        const sel = elegida?.id === t.id
        const sinNada = t.existencias === 0
        return (
          <ButtonBase
            key={t.id}
            onClick={() => onElegir(t)}
            disabled={sinNada}
            aria-pressed={sel}
            aria-label={sinNada ? `Talla ${t.nombre}, agotada` : `Talla ${t.nombre}`}
            sx={{
              minWidth: grande ? 56 : 40, height: grande ? 48 : 40, px: grande ? 1.25 : 1, borderRadius: '6px',
              fontFamily: 'inherit', fontWeight: 600, fontSize: grande ? 15 : 14,
              border: '1px solid', borderColor: sel ? PAPEL : 'rgba(204, 196, 201, 0.35)',
              bgcolor: sel ? PAPEL : 'transparent', color: sel ? '#161214' : 'text.primary',
              '&.Mui-disabled': { opacity: 0.4, textDecoration: 'line-through', color: 'text.primary' },
              '&.Mui-focusVisible': { outline: `2px solid ${MARCA.acento}`, outlineOffset: 2 },
            }}
          >
            {t.nombre}
          </ButtonBase>
        )
      })}
    </Box>
  )
}

/** El «− n +» de una línea: no baja de `minimo` ni pasa del tope. */
export function Contador({ cantidad, tope, minimo = 0, nombre, onCambiar }: {
  cantidad: number
  tope: number
  minimo?: number
  /** Qué se cuenta, para las etiquetas de los botones. */
  nombre: string
  onCambiar: (n: number) => void
}) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
      <IconButton aria-label={`Quitar una unidad de ${nombre}`} disabled={cantidad <= minimo} onClick={() => onCambiar(cantidad - 1)}><RemoveIcon /></IconButton>
      <Typography aria-live="polite" sx={{ minWidth: 26, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{cantidad}</Typography>
      <IconButton aria-label={`Añadir una unidad de ${nombre}`} disabled={cantidad >= tope} onClick={() => onCambiar(cantidad + 1)}><AddIcon /></IconButton>
    </Box>
  )
}
