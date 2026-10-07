import { useState } from 'react'
import { Box, CardActionArea, IconButton, Menu, MenuItem, Paper, Typography } from '@mui/material'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import { Link } from 'react-router-dom'
import type { Enser } from '../../../lib/api/inventario'
import { useColoresContabilidad } from '../contabilidad/tema'
import { useEnFichas } from '../listados/useEnFichas'
import { CONSERVACION } from './colores'

interface Props {
  enseres: Enser[]
  /** La consulta del listado, para que la edición devuelva a la misma página y filtros. */
  volver: string
  onBorrar: (enser: Enser) => void
}

const TRAMOS = [
  { clave: 'cantidadOptimo', texto: 'óptimo', color: CONSERVACION.optimo },
  { clave: 'cantidadBueno', texto: 'bueno', color: CONSERVACION.bueno },
  { clave: 'cantidadReparar', texto: 'a reparar', color: CONSERVACION.reparar },
] as const

const totalDe = (e: Enser) => e.cantidadOptimo + e.cantidadBueno + e.cantidadReparar

/**
 * Los enseres como fichas: cada pieza con su foto (la principal de su ficha
 * de patrimonio), el total y la conservación en una barra partida en óptimo,
 * bueno y a reparar. Toda la ficha lleva a editar; eliminar va en el menú de
 * «⋯», lejos del dedo: una pieza con tasación no se borra de un toque.
 * En el móvil, la foto a la izquierda y los datos a su lado.
 */
export default function TablaEnseres({ enseres, volver, onBorrar }: Props) {
  const enFichas = useEnFichas()
  const { carril } = useColoresContabilidad()

  if (enseres.length === 0) {
    return <Paper sx={{ py: 5, px: 2, textAlign: 'center', color: 'text.secondary' }}>No hay enseres con esta búsqueda o estos filtros.</Paper>
  }

  return (
    <Box component="section" aria-label="Enseres">
      <Box
        component="ul"
        sx={{
          listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2,
          gridTemplateColumns: enFichas ? '1fr' : 'repeat(auto-fill, minmax(230px, 1fr))',
        }}
      >
        {enseres.map((e) => <FichaEnser key={e.id} enser={e} volver={volver} horizontal={enFichas} carril={carril} onBorrar={onBorrar} />)}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap', mt: 2, fontSize: 13, color: 'text.secondary' }}>
        {TRAMOS.map((t) => (
          <Box key={t.clave} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
            <Box component="span" aria-hidden="true" sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: t.color }} />
            {t.texto.charAt(0).toUpperCase() + t.texto.slice(1)}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

function FichaEnser({ enser: e, volver, horizontal, carril, onBorrar }: { enser: Enser; volver: string; horizontal: boolean; carril: string; onBorrar: (e: Enser) => void }) {
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const total = totalDe(e)
  const partes = TRAMOS.filter((t) => e[t.clave] > 0)

  const foto = (
    <Box
      sx={{
        flexShrink: 0, overflow: 'hidden', backgroundColor: 'action.hover', color: 'text.disabled',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...(horizontal ? { width: 76, alignSelf: 'stretch', minHeight: 76, borderRadius: 1.5 } : { height: 140 }),
      }}
    >
      {e.imagenUrl
        ? <Box component="img" src={e.imagenUrl} alt="" loading="lazy" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <ImageOutlinedIcon aria-hidden="true" sx={{ fontSize: 30 }} />}
    </Box>
  )

  return (
    <Paper component="li" sx={{ position: 'relative', overflow: 'hidden', display: 'flex' }}>
      <CardActionArea
        component={Link}
        to={`/cms/inventario/${e.id}/editar`}
        state={{ volver }}
        aria-label={`Editar ${e.nombre}`}
        sx={{ display: 'flex', flexDirection: horizontal ? 'row' : 'column', alignItems: 'stretch', gap: horizontal ? 1.5 : 0, p: horizontal ? 1.5 : 0, height: '100%' }}
      >
        {foto}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.75, p: horizontal ? 0 : 2 }}>
          {/* A la derecha, el hueco del «⋯», que va encima: solo en esta línea, no en toda la columna. */}
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, pr: horizontal ? 4.5 : 3.5 }}>
            <Typography component="h2" sx={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 600, lineHeight: 1.3 }}>{e.nombre}</Typography>
            <Typography component="span" aria-label={`${total} piezas`} sx={{ fontSize: horizontal ? 20 : 24, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{total}</Typography>
          </Box>
          <Typography sx={{ fontSize: 12.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
            {[e.referencia, e.categoria].filter(Boolean).join(' · ') || 'Sin referencia ni categoría'}
          </Typography>
          <Typography sx={{ fontSize: 13.5, color: e.ubicacion ? 'text.primary' : 'text.disabled' }}>{e.ubicacion || 'Sin ubicación'}</Typography>
          <Box sx={{ mt: 'auto', pt: 0.75 }}>
            <Box aria-hidden="true" sx={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: carril }}>
              {total > 0 && partes.map((t) => <Box key={t.clave} sx={{ width: `${(e[t.clave] / total) * 100}%`, backgroundColor: t.color }} />)}
            </Box>
            <Typography sx={{ mt: 0.5, fontSize: 12.5, color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
              {partes.length > 0 ? partes.map((t) => `${e[t.clave]} ${t.texto}`).join(' · ') : 'Sin unidades'}
            </Typography>
          </Box>
        </Box>
      </CardActionArea>
      {/* Fuera del enlace: un botón dentro de otro control no se puede pulsar bien ni leer. */}
      <IconButton
        aria-label={`Más acciones de ${e.nombre}`}
        onClick={(ev) => setMenu(ev.currentTarget)}
        size="small"
        sx={{
          position: 'absolute', top: 6, right: 6,
          ...(horizontal ? {} : { backgroundColor: 'background.paper', '&:hover': { backgroundColor: 'background.paper' } }),
        }}
      >
        <MoreHorizIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={menu} open={menu !== null} onClose={() => setMenu(null)}>
        <MenuItem component={Link} to={`/cms/inventario/${e.id}/editar`} state={{ volver }}>Editar</MenuItem>
        <MenuItem onClick={() => { setMenu(null); onBorrar(e) }} sx={{ color: 'error.main' }}>Eliminar</MenuItem>
      </Menu>
    </Paper>
  )
}
