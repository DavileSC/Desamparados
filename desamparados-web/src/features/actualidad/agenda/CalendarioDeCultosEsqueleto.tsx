import { Box } from '@mui/material'
import Hueso from '../../../components/esqueleto/Hueso'
import { CORMORANT } from './letraAlmanaque'
import { FONDOS, MARCA } from '../../../theme/marca'

/*
 * La hoja del calendario sin el calendario: sus colores y su semana, y el
 * esqueleto. Aparte de `CalendarioDeCultos` porque la página de la Agenda lo
 * enseña también mientras llega su documento (`BloquesEsqueleto`), y el
 * calendario entero solo se descarga con el bloque.
 */

export const PAPEL = FONDOS.almanaque
/**
 * El granate del Grupo en la hoja: el principal de la marca, con su suelo de
 * contraste sobre este papel y sobre el rosa, que son más oscuros que el
 * blanco donde lo tiene `MARCA.principal`.
 */
export const GRANATE = MARCA.principalAlmanaque
export const RAYA = '#d9cfc1'
export const GRIS = '#7a6c70'
export const SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
export const SEMANA_LARGA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
/** La fila con los nombres de los días, que va dentro de lo medido. */
export const CABECERA_SEMANA = 32

/**
 * La hoja mientras llegan los actos: el mismo papel, los días de la semana y
 * cinco semanas de casillas vacías, con el mes y los números en huesos. Las
 * semanas tienen el alto de siempre en el móvil y uno medio en escritorio (la
 * hoja de verdad lo ajusta a la pantalla).
 */
export default function CalendarioDeCultosEsqueleto() {
  return (
    <Box sx={{ bgcolor: PAPEL, borderRadius: '3px', p: { xs: '14px 12px 10px', md: '32px 44px 20px' } }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '0 24px', mb: { xs: 0.5, md: 2 } }}>
        <Box sx={{ height: { xs: 36, md: 65 }, display: 'flex', alignItems: 'center' }}>
          <Hueso papel sx={{ width: { xs: 150, md: 280 }, height: { xs: 26, md: 46 } }} />
        </Box>
        <Box sx={{ height: 44, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Hueso papel sx={{ width: { xs: 36, sm: 90 }, height: 12 }} />
          <Hueso papel sx={{ width: { xs: 36, sm: 100 }, height: 12 }} />
        </Box>
      </Box>
      <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', height: CABECERA_SEMANA, alignItems: 'center' }}>
        {SEMANA.map((d, i) => (
          <Box key={d} sx={{ px: { xs: '6px', md: '12px' }, color: i === 6 ? GRANATE : GRIS, fontFamily: { xs: 'inherit', md: CORMORANT }, fontStyle: { md: 'italic' }, fontSize: { xs: 11, md: 17 }, letterSpacing: { xs: '0.12em', md: 0 }, textTransform: { xs: 'uppercase', md: 'none' } }}>
            <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>{d}</Box>
            <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>{SEMANA_LARGA[i]}</Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderTop: `1px solid ${RAYA}`, borderLeft: `1px solid ${RAYA}`, '& > *': { borderRight: `1px solid ${RAYA}`, borderBottom: `1px solid ${RAYA}` } }}>
        {Array.from({ length: 35 }, (_, i) => (
          <Box key={i} sx={{ height: { xs: 48, md: 88 }, p: { xs: '4px 6px', md: '8px 12px' } }}>
            <Hueso papel sx={{ width: { xs: 14, md: 22 }, height: { xs: 14, md: 22 } }} />
          </Box>
        ))}
      </Box>
    </Box>
  )
}
