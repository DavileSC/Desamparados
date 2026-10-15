import { useId } from 'react'
import { Box, Slider, Stack, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { TINTA } from '../../inicio/estilos'
import { CORMORANT } from '../../actualidad/agenda/letraAlmanaque'
import { ENCUADRE_MOVIL_POR_DEFECTO } from '../../../lib/api/portada'

const SECCIONES = ['Inicio', 'Corporación', 'Sagrada titular', 'Actualidad', 'Publicaciones']

/**
 * Lo opaco que es el fondo del menú del móvil y la tableta. El menú se abre
 * sobre la página, y por debajo de 100 deja ver su foto; los textos que van
 * sobre ella se apagan mientras tanto (CajonMovil). Al lado, el menú en
 * pequeño sobre la primera foto de la cabecera, que es lo que hay detrás al
 * abrirlo en la portada.
 */
export default function FondoDelMenuMovil({ valor, onCambio, foto }: { valor: number; onCambio: (opacidad: number) => void; foto?: string }) {
  const id = useId()

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
      <Box
        aria-hidden="true"
        sx={{ position: 'relative', flex: 'none', width: 180, height: 320, alignSelf: { xs: 'center', sm: 'auto' }, overflow: 'hidden', backgroundColor: TINTA, borderRadius: 1 }}
      >
        {foto && (
          <Box component="img" src={foto} alt="" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${ENCUADRE_MOVIL_POR_DEFECTO}% center` }} />
        )}
        <Box sx={{ position: 'absolute', inset: 0, top: 30, p: '16px 14px', backgroundColor: alpha(TINTA, valor / 100) }}>
          {SECCIONES.map((seccion, i) => (
            <Typography key={seccion} sx={{ fontFamily: CORMORANT, fontSize: 17, fontWeight: 500, lineHeight: 1.35, color: i === 0 ? 'secondary.main' : '#fff' }}>
              {seccion}
            </Typography>
          ))}
        </Box>
        <Box sx={{ position: 'absolute', insetInline: 0, top: 0, height: 30, backgroundColor: TINTA, borderBottom: '1px solid rgba(204, 196, 201, 0.2)' }} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography id={id} variant="subtitle2" component="p">Opacidad del fondo: {valor} %</Typography>
        <Box sx={{ px: 1.5, maxWidth: 420 }}>
          <Slider
            aria-labelledby={id}
            value={valor}
            onChange={(_, v) => onCambio(v as number)}
            min={40}
            max={100}
            step={1}
            marks={[{ value: 40, label: 'Más foto' }, { value: 100, label: 'Opaco' }]}
            getAriaValueText={(v) => `${v} %`}
          />
        </Box>
        <Typography variant="caption" component="p" color="text.secondary">
          Se aplica en toda la web, en el menú del móvil y la tableta. Por debajo de 100 deja ver la foto que hay detrás
          (en la portada, la de la cabecera), sin sus textos. Cuanto más bajo, más se ve la foto y menos se leen las letras del menú.
        </Typography>
      </Box>
    </Stack>
  )
}
