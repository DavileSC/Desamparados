import type { ReactNode } from 'react'
import { Box, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import { useTemaCms } from '../../../app/temaCms'
import { haceCuanto } from './completitud'
import { rejillaFila } from './rejilla'

/**
 * Las piezas de los listados de redacción (Noticias, Publicaciones) que no son
 * la fila: los apartados, el resumen de la cabecera, la cabecera de columnas y
 * la raya de lo que sale en la portada.
 */

export type EstadoRedaccion = 'publicadas' | 'borradores' | 'incompletas'

/** Las cifras que el servidor manda con cada página del listado. */
export interface CifrasRedaccion {
  publicadas: number
  borradores: number
  incompletas: number
  ultimaPublicacion: string | null
}

/** «40 publicadas · 3 borradores · la última salió hace 7 días». */
export function ResumenRedaccion({ cifras }: { cifras: CifrasRedaccion }) {
  const partes = [
    `${cifras.publicadas} ${cifras.publicadas === 1 ? 'publicada' : 'publicadas'}`,
    `${cifras.borradores} ${cifras.borradores === 1 ? 'borrador' : 'borradores'}`,
  ]
  if (cifras.ultimaPublicacion) partes.push(`la última salió ${haceCuanto(cifras.ultimaPublicacion)}`)
  return <>{partes.join(' · ')}</>
}

/** Todas, publicadas, borradores e incompletas, cada una con su cifra. */
export function FiltroEstado({ valor, cifras, etiqueta, onCambiar }: { valor: string; cifras: CifrasRedaccion | null; etiqueta: string; onCambiar: (estado: string) => void }) {
  return (
    // Con los contadores no caben en un móvil: ahí se parten en botones sueltos, para que ninguno quede escondido.
    <ToggleButtonGroup
      exclusive
      size="small"
      aria-label={etiqueta}
      value={valor}
      onChange={(_, estado: string | null) => { if (estado !== null) onCambiar(estado) }}
      sx={(tema) => ({
        '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5, gap: 0.75, whiteSpace: 'nowrap' },
        [tema.breakpoints.down('sm')]: {
          flexWrap: 'wrap', gap: 0.75,
          '& .MuiToggleButtonGroup-grouped': { m: 0, border: 1, borderColor: 'divider', borderRadius: 1 },
        },
      })}
    >
      <ToggleButton value="">Todas<Cifra n={cifras ? cifras.publicadas + cifras.borradores : undefined} /></ToggleButton>
      <ToggleButton value="publicadas">Publicadas<Cifra n={cifras?.publicadas} /></ToggleButton>
      <ToggleButton value="borradores">Borradores<Cifra n={cifras?.borradores} /></ToggleButton>
      <ToggleButton value="incompletas">Incompletas<Cifra n={cifras?.incompletas} /></ToggleButton>
    </ToggleButtonGroup>
  )
}

function Cifra({ n }: { n?: number }) {
  if (n === undefined) return null
  return <Box component="span" sx={{ opacity: 0.6, fontVariantNumeric: 'tabular-nums' }}>{n}</Box>
}

/** Los nombres de las columnas, solo en escritorio: en el móvil la fila se explica sola. */
export function CabeceraColumnas({ nombre, fotoVertical = false }: { nombre: string; fotoVertical?: boolean }) {
  return (
    <Box aria-hidden="true" sx={{ ...rejillaFila(fotoVertical), display: { xs: 'none', md: 'grid' }, px: 2.5, py: 1.25, gridTemplateAreas: undefined, '& span': { fontSize: 11.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' } }}>
      <span /><span>{nombre}</span><span>Estado</span><span>Fecha</span><span />
    </Box>
  )
}

export function Grupo({ titulo, cifra, children }: { titulo: string; cifra?: number; children: ReactNode }) {
  return (
    <Box component="section">
      <Typography component="h2" sx={{ px: { xs: 2, md: 2.5 }, py: 0.75, fontSize: 11.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary', backgroundColor: 'action.hover', borderTop: 1, borderColor: 'divider' }}>
        {titulo}{cifra !== undefined && ` · ${cifra}`}
      </Typography>
      <Box component="ul" sx={{ m: 0, p: 0 }}>{children}</Box>
    </Box>
  )
}

/**
 * La raya bajo la última que sale en la portada. Cuántas salen no se cambia
 * desde el CMS: lo pone el diseño de la portada. `texto` sustituye la frase de noticias y publicaciones
 * («las 3 más recientes»), que en la agenda no vale.
 */
export function LineaPortada({ limite, texto }: { limite: number; texto?: string }) {
  const { superficies } = useTemaCms()
  return (
    <Box component="li" sx={{ listStyle: 'none', display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minHeight: 36, px: { xs: 2, md: 2.5 }, py: 0.5, borderTop: '1.5px dashed', borderColor: superficies.enlace, color: superficies.enlace, fontSize: 12.5, '& svg': { fontSize: 16 } }}>
      <HomeOutlinedIcon aria-hidden="true" />
      <span>{texto ?? `Hasta aquí sale en la portada: ${limite === 1 ? 'la más reciente' : `las ${limite} más recientes`}.`}</span>
    </Box>
  )
}
