import { Box, Typography } from '@mui/material'
import type { ApiProfile } from '../../../lib/api/perfil'
import { site } from '../../../config/site'
import { aniosCumplidos } from '../../altas/public/schema'
import { aDia } from './etiquetas'
// Los colores de la papeleta: la credencial es un documento de la misma familia.
import { BURDEOS, CREMA, FILETE, GRIS, NEGRO, ORO, SERIFA } from '../procesion/papeleta-estilo'

const diaLargo = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: 'numeric', month: 'long', year: 'numeric' })
const anio = (iso: string) => aDia(iso).slice(0, 4)

/**
 * La cabecera de «Mi perfil» (forma A «Credencial», 16-10-2026): negra y oro
 * como la papeleta, y como ella fija, sin seguir el tema claro u oscuro. Lo
 * que lleva Secretaría (estado, alta, jura y número) se lee de un vistazo; el
 * número, grande a la derecha, es lo que más se pregunta.
 */
export default function Credencial({ ficha }: { ficha: ApiProfile }) {
  const anios = ficha.activo ? aniosCumplidos(aDia(ficha.fechaAlta)) : 0
  const linea = ficha.activo
    ? [
        `Alta el ${diaLargo.format(new Date(ficha.fechaAlta))}`,
        ficha.fechaJura ? `Jura en ${anio(ficha.fechaJura)}` : null,
        anios >= 1 ? `${anios} ${anios === 1 ? 'año' : 'años'} de hermano` : null,
      ].filter((t): t is string => t !== null)
    : []

  return (
    <Box sx={{
      position: 'relative', overflow: 'hidden', bgcolor: NEGRO, color: CREMA, borderRadius: 1,
      boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
      px: { xs: 2.25, sm: 3.5 }, pt: { xs: 2, sm: 2.5 }, pb: { xs: 2.5, sm: 2.75 },
      // En el móvil, el nombre no cabe entre el escudo y el número: baja a su fila.
      // Desde la tableta, los tres en una.
      display: 'grid', alignItems: 'center', columnGap: { xs: 2, sm: 3.25 }, rowGap: 1.5,
      gridTemplateColumns: { xs: 'auto 1fr', sm: 'auto minmax(0, 1fr) auto' },
      gridTemplateAreas: { xs: '"escudo numero" "texto texto"', sm: '"escudo texto numero"' },
      // La franja burdeos del pie, como en la papeleta.
      '&::after': { content: '""', position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, bgcolor: BURDEOS },
    }}>
      <Box component="img" src={site.imagenes.escudoDestacado} alt="" sx={{ gridArea: 'escudo', height: { xs: 52, sm: 70 }, width: 'auto', display: 'block' }} />

      <Box sx={{ gridArea: 'texto', minWidth: 0 }}>
        {/* «Mi perfil» es el título de la pantalla, de antetítulo sobre el nombre. */}
        <Typography component="h1" sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.24em', textTransform: 'uppercase', color: ORO }}>Mi perfil</Typography>
        <Typography component="p" sx={{ fontFamily: SERIFA, fontSize: { xs: 23, sm: 28 }, lineHeight: 1.15, mt: 0.5, mb: 1 }}>{ficha.nombre} {ficha.apellidos}</Typography>
        <Box component="p" sx={{ m: 0, display: 'flex', flexWrap: 'wrap', columnGap: 1.25, rowGap: 0.25, fontSize: 13.5, color: GRIS }}>
          <Box component="span" sx={{ color: ficha.activo ? 'success.light' : 'warning.light', fontWeight: 600 }}>{ficha.activo ? 'Activo' : 'Pendiente de Secretaría'}</Box>
          {linea.map((texto) => (
            <Box key={texto} component="span" sx={{ whiteSpace: 'nowrap', '&::before': { content: '"·"', color: FILETE, mr: 1.25 } }}>{texto}</Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ gridArea: 'numero', justifySelf: 'end', textAlign: 'right', borderLeft: { sm: `1px solid ${FILETE}` }, pl: { sm: 3.25 } }}>
        <Typography sx={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: GRIS }}>Hermano n.º</Typography>
        {ficha.numeroHermano
          ? <Typography sx={{ fontFamily: SERIFA, fontSize: { xs: 40, sm: 52 }, lineHeight: 1, color: ORO, fontVariantNumeric: 'tabular-nums' }}>{ficha.numeroHermano}</Typography>
          : <Typography sx={{ fontFamily: SERIFA, fontSize: 18, mt: 0.5, color: GRIS }}>Pendiente</Typography>}
      </Box>
    </Box>
  )
}
