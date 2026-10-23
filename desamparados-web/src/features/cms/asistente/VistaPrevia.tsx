import { Box, Stack, Typography } from '@mui/material'
import { FONDOS, paletaDeMarca } from '../../../../../shared/colores-de-marca.mjs'
import type { VistaDeLaMarca } from '../corporacion/vistaDeLaMarca'

const ETIQUETA = { fontSize: 12, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'text.secondary' } as const

/**
 * «Así queda»: la barra y la portada de la web, el membrete de un correo y el
 * icono del móvil, pintados con lo que se está escribiendo. No es la web de
 * verdad (esa se ve al terminar, con «Ver la web»): es lo bastante para que se
 * note qué cambia cada paso. En el móvil, solo la barra y la portada.
 */
export default function VistaPrevia({ vista, compacta = false }: { vista: VistaDeLaMarca; compacta?: boolean }) {
  const p = paletaDeMarca({ colorPrincipal: vista.colorPrincipal, colorAcento: vista.colorAcento })
  return (
    <Stack spacing={1.75} aria-label="Así queda la web">
      {!compacta && <Typography sx={ETIQUETA}>Así queda</Typography>}
      <Box sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: FONDOS.profundo, boxShadow: 1 }}>
        <Stack direction="row" spacing={1.5} sx={{ height: compacta ? 46 : 52, alignItems: 'center', px: 2, borderBottom: `1px solid ${FONDOS.publico}` }}>
          {vista.escudo && <Box component="img" src={vista.escudo} alt="" sx={{ height: compacta ? 30 : 36 }} />}
          <Typography sx={{ color: FONDOS.blanco, fontWeight: 600, fontSize: 15 }} noWrap>{vista.nombreCorto}</Typography>
        </Stack>
        <Stack spacing={1.25} sx={{ justifyContent: 'flex-end', minHeight: compacta ? 0 : 150, p: compacta ? 1.75 : 2.5, bgcolor: FONDOS.publico }}>
          {!compacta && vista.localidad && (
            <Typography sx={{ fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase', color: p.acento }}>{vista.localidad}</Typography>
          )}
          <Typography sx={{ color: FONDOS.blanco, fontWeight: 600, fontSize: compacta ? 17 : 22, lineHeight: 1.25 }}>{vista.nombre}</Typography>
          <Box sx={{ alignSelf: 'flex-start', bgcolor: p.principal, color: FONDOS.blanco, fontSize: 13, fontWeight: 600, px: 1.75, py: 0.75, borderRadius: 1 }}>
            Hazte hermano
          </Box>
        </Stack>
      </Box>
      {!compacta && (
        <Stack direction="row" spacing={1.75}>
          <Stack direction="row" spacing={1.5} sx={{ flex: 1, minWidth: 0, alignItems: 'center', bgcolor: FONDOS.blanco, borderRadius: 2, p: 1.75, boxShadow: 1 }}>
            {vista.escudoSobreClaro
              ? <Box component="img" src={vista.escudoSobreClaro} alt="" sx={{ height: 52, flex: 'none' }} />
              : <Box sx={{ width: 44, height: 52, flex: 'none', border: 1, borderStyle: 'dashed', borderColor: 'grey.400', borderRadius: 1 }} />}
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 12, color: 'grey.700' }}>Correo a los hermanos</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'grey.900' }} noWrap>{vista.nombre}</Typography>
              <Box sx={{ mt: 0.5, height: 3, width: 48, bgcolor: p.principal, borderRadius: 1 }} />
            </Box>
          </Stack>
          <Stack direction="row" spacing={1.25} sx={{ width: 160, flex: 'none', alignItems: 'center', bgcolor: FONDOS.blanco, borderRadius: 2, p: 1.75, boxShadow: 1 }}>
            {vista.icono && <Box component="img" src={vista.icono} alt="" sx={{ width: 32, height: 32, borderRadius: 1.5, flex: 'none' }} />}
            <Typography sx={{ fontSize: 12, color: 'grey.700' }}>Icono del móvil</Typography>
          </Stack>
        </Stack>
      )}
    </Stack>
  )
}
