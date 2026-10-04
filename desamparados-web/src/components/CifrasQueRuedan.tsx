import { Box, type SxProps, type Theme } from '@mui/material'
import { visuallyHidden } from '@mui/utils'
import { useReducedMotion } from 'framer-motion'

const CIFRAS = '0123456789'.split('')

/**
 * Un texto cuyas cifras ruedan, como un contador mecánico, cuando cambia:
 * «(7)» → «(4)», «4,50 €» → «16,50 €». Cada cifra es una tira del 0 al 9
 * detrás de una ventana de una línea; lo que no es cifra va tal cual. Las
 * cifras se cuentan desde la derecha, así al pasar de 9 a 10 la de las
 * unidades sigue siendo la misma y rueda, y la nueva aparece a su izquierda.
 *
 * El lector de pantalla oye el texto entero, no diez cifras por posición; y
 * quien pide menos movimiento ve el número cambiar sin rodar.
 */
export default function CifrasQueRuedan({ texto, sx }: { texto: string; sx?: SxProps<Theme> }) {
  const quieto = useReducedMotion() ?? false
  const letras = texto.split('')
  return (
    <Box component="span" sx={[{ display: 'inline-flex', fontVariantNumeric: 'tabular-nums' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Box component="span" sx={visuallyHidden}>{texto}</Box>
      <Box component="span" aria-hidden sx={{ display: 'inline-flex', alignItems: 'flex-start', lineHeight: 1 }}>
        {letras.map((letra, i) => {
          const desdeLaDerecha = letras.length - i
          if (!/\d/.test(letra)) return <Box key={`t${desdeLaDerecha}`} component="span" sx={{ whiteSpace: 'pre' }}>{letra}</Box>
          return (
            <Box key={`c${desdeLaDerecha}`} component="span" sx={{ display: 'inline-block', height: '1em', overflow: 'hidden' }}>
              <Box component="span" sx={{
                display: 'flex', flexDirection: 'column', transform: `translateY(${-Number(letra)}em)`,
                transition: quieto ? 'none' : 'transform .75s cubic-bezier(.2, .8, .2, 1)',
              }}>
                {CIFRAS.map((d) => <Box key={d} component="span" sx={{ display: 'block', height: '1em', lineHeight: 1 }}>{d}</Box>)}
              </Box>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
