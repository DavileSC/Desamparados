import { useState, type ReactNode } from 'react'
import { Box, ButtonBase, Drawer, Popover, Typography, useMediaQuery, useTheme } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import Boton from '../../components/Boton'
import type { CategoriaDeTienda, Producto } from '../../lib/api/tienda'
import { GOLD, GRANATE } from '../inicio/estilos'
import { ORDENES, SIN_FILTROS, TRAMOS, cuantosFiltros, enTramo, type Filtros, type IdTramo, type Orden } from './filtros'

const CREMA = '#f4efe5'
const TINTA = '#161214'
const CAPA = '#1a181b'
const foco = { '&.Mui-focusVisible': { outline: `2px solid ${GOLD}`, outlineOffset: 2 } }

type QueCapa = 'categoria' | 'precio' | 'talla' | 'orden'

const ceja = { fontSize: 11, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#cdae72', fontWeight: 600 } as const

/** Una fila del panel: casilla (varias a la vez) o redondel (una sola), con su recuento a la derecha. */
function Opcion({ marcada, unica, onClick, children, n }: { marcada: boolean; unica?: boolean; onClick: () => void; children: ReactNode; n?: number }) {
  return (
    <ButtonBase role={unica ? 'radio' : 'checkbox'} aria-checked={marcada} onClick={onClick} sx={{
      width: '100%', minHeight: 44, justifyContent: 'flex-start', gap: 1.5, fontFamily: 'inherit', fontSize: 15, textAlign: 'left',
      color: marcada ? '#fff' : '#cbc5c8', '&:hover': { color: '#fff' }, ...foco,
    }}>
      <Box component="span" aria-hidden sx={{
        width: 20, height: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: unica ? '10px' : 0, border: '1.5px solid', borderColor: marcada ? CREMA : 'rgba(204, 196, 201, 0.5)',
        bgcolor: marcada && !unica ? CREMA : 'transparent', color: TINTA,
      }}>
        {marcada && (unica ? <Box component="span" sx={{ width: 10, height: 10, borderRadius: '5px', bgcolor: CREMA }} /> : <CheckIcon sx={{ fontSize: 15 }} />)}
      </Box>
      <Box component="span" sx={{ flexGrow: 1 }}>{children}</Box>
      {n !== undefined && <Box component="span" sx={{ fontSize: 12.5, color: '#77707a', fontVariantNumeric: 'tabular-nums' }}>{n}</Box>}
    </ButtonBase>
  )
}

/**
 * La barra de filtros de la tienda: desplegables de Categoría, Precio y
 * Talla, el interruptor de lo agotado y «Ordenar por» a la derecha. En el
 * ordenador cada desplegable abre su panel debajo; en el móvil la fila se
 * desliza y cada uno abre una hoja desde abajo solo con lo suyo, que se
 * cierra con «Ver N productos». Los cambios se aplican al momento.
 */
export default function BarraDeFiltros({ categorias, productos, tallas, filtros, onFiltros, orden, onOrden, resultado }: {
  categorias: CategoriaDeTienda[]
  /** Todo el catálogo: para los recuentos de cada opción. */
  productos: Producto[]
  /** Las tallas que hay en la tienda; sin ninguna, no hay desplegable de talla. */
  tallas: string[]
  filtros: Filtros
  onFiltros: (f: Filtros) => void
  orden: Orden
  onOrden: (o: Orden) => void
  /** Cuántos productos salen ahora, para el botón de la hoja del móvil. */
  resultado: number
}) {
  const theme = useTheme()
  const ancho = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true })
  const [capa, setCapa] = useState<{ que: QueCapa; ancla: HTMLElement } | null>(null)
  const cerrar = () => setCapa(null)
  const abrir = (que: QueCapa) => (e: React.MouseEvent<HTMLElement>) => setCapa(capa?.que === que ? null : { que, ancla: e.currentTarget })
  const poner = (c: Partial<Filtros>) => onFiltros({ ...filtros, ...c })

  const categoria = categorias.find((c) => c.id === filtros.categoria)
  const ordenActual = ORDENES.find((o) => o.id === orden)!
  const contar = (n: number) => (n ? ` (${n})` : '')
  const alternar = <T,>(lista: T[], x: T) => (lista.includes(x) ? lista.filter((y) => y !== x) : [...lista, x])

  const desplegable = (que: QueCapa, texto: ReactNode, activo: boolean, etiqueta: string) => {
    const abierto = capa?.que === que
    return (
      <ButtonBase onClick={abrir(que)} aria-expanded={abierto} aria-haspopup="dialog" aria-label={etiqueta} sx={{
        flex: '0 0 auto', minHeight: 44, px: 2, gap: 1, fontFamily: 'inherit', fontSize: { xs: 14, md: 15 }, whiteSpace: 'nowrap',
        color: activo || abierto ? '#fff' : '#e4e2df', border: '1px solid', borderRadius: { xs: '22px', md: 0 },
        borderColor: abierto ? CAPA : activo ? 'rgba(244, 239, 229, 0.5)' : { xs: CAPA, md: 'transparent' },
        bgcolor: { xs: CAPA, md: abierto ? CAPA : 'transparent' },
        '&:hover': { color: '#fff', borderColor: { md: abierto ? CAPA : 'rgba(204, 196, 201, 0.25)' } }, ...foco,
      }}>
        {texto}
        <ExpandMoreIcon aria-hidden sx={{ fontSize: 18, transition: 'transform .25s ease', transform: abierto ? 'rotate(180deg)' : 'none' }} />
      </ButtonBase>
    )
  }

  const contenido: Record<QueCapa, { titulo: string; cuerpo: ReactNode }> = {
    categoria: {
      titulo: 'Categoría',
      cuerpo: <Box role="radiogroup" aria-label="Categoría">
        <Opcion unica marcada={filtros.categoria === null} onClick={() => { poner({ categoria: null }); cerrar() }} n={productos.length}>Todo</Opcion>
        {categorias.map((c) => (
          <Opcion key={c.id} unica marcada={filtros.categoria === c.id} onClick={() => { poner({ categoria: c.id }); cerrar() }}
            n={productos.filter((p) => p.categoriaId === c.id).length}>{c.nombre}</Opcion>
        ))}
      </Box>,
    },
    precio: {
      titulo: 'Precio',
      cuerpo: <Box role="group" aria-label="Precio">
        {TRAMOS.map((t) => (
          <Opcion key={t.id} marcada={filtros.tramos.includes(t.id)} onClick={() => poner({ tramos: alternar<IdTramo>(filtros.tramos, t.id) })}
            n={productos.filter((p) => enTramo(p.precio, t.id)).length}>{t.nombre}</Opcion>
        ))}
      </Box>,
    },
    talla: {
      titulo: 'Talla',
      cuerpo: <Box role="group" aria-label="Talla" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, pt: 0.5 }}>
        {tallas.map((t) => {
          const sel = filtros.tallas.includes(t)
          return (
            <ButtonBase key={t} aria-pressed={sel} onClick={() => poner({ tallas: alternar(filtros.tallas, t) })} sx={{
              minWidth: 50, height: 44, px: 1.25, fontFamily: 'inherit', fontWeight: 600, fontSize: 14,
              border: '1px solid', borderColor: sel ? CREMA : 'rgba(204, 196, 201, 0.3)', bgcolor: sel ? CREMA : 'transparent', color: sel ? TINTA : '#fff',
              '&:hover': { borderColor: CREMA }, ...foco,
            }}>{t}</ButtonBase>
          )
        })}
      </Box>,
    },
    orden: {
      titulo: 'Ordenar por',
      cuerpo: <Box role="radiogroup" aria-label="Ordenar por">
        {ORDENES.map((o) => (
          <Opcion key={o.id} unica marcada={o.id === orden} onClick={() => { onOrden(o.id); cerrar() }}>{o.nombre}</Opcion>
        ))}
      </Box>,
    },
  }

  const interruptor = (
    <ButtonBase role="switch" aria-checked={filtros.sinAgotados} onClick={() => poner({ sinAgotados: !filtros.sinAgotados })} sx={{
      flex: '0 0 auto', minHeight: 44, px: 2, gap: 1.25, fontFamily: 'inherit', fontSize: { xs: 14, md: 15 }, whiteSpace: 'nowrap', color: '#e4e2df',
      borderRadius: { xs: '22px', md: 0 }, bgcolor: { xs: CAPA, md: 'transparent' }, '&:hover': { color: '#fff' }, ...foco,
    }}>
      <Box component="span" aria-hidden sx={{
        position: 'relative', width: 36, height: 20, borderRadius: '10px', flexShrink: 0, transition: 'background-color .2s ease',
        bgcolor: filtros.sinAgotados ? GRANATE : 'rgba(204, 196, 201, 0.3)',
        '&::after': { content: '""', position: 'absolute', top: 2, left: filtros.sinAgotados ? 18 : 2, width: 16, height: 16, borderRadius: '8px', bgcolor: CREMA, transition: 'left .2s ease' },
      }} />
      Ocultar lo agotado
    </ButtonBase>
  )

  const abierta = capa ? contenido[capa.que] : null
  return (
    <>
      <Box role="toolbar" aria-label="Filtrar y ordenar" sx={{
        display: 'flex', alignItems: 'center', gap: { xs: 0.75, md: 1 }, py: { xs: 1.25, md: 1.5 },
        mx: { xs: '-20px', md: 0 }, px: { xs: '20px', md: 0 },
        borderTop: { md: '1px solid rgba(204, 196, 201, 0.14)' }, borderBottom: { md: '1px solid rgba(204, 196, 201, 0.14)' },
        // En el móvil la fila no cabe: se desliza en vez de romper la página.
        overflowX: { xs: 'auto', md: 'visible' }, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
      }}>
        {/* En el móvil, el orden va el primero: es lo que más se toca con el pulgar. */}
        {!ancho && desplegable('orden', 'Ordenar', false, `Ordenar por: ${ordenActual.nombre}`)}
        {categorias.length > 0 && desplegable('categoria', categoria?.nombre ?? 'Categoría', Boolean(categoria), categoria ? `Categoría: ${categoria.nombre}` : 'Categoría')}
        {desplegable('precio', `Precio${contar(filtros.tramos.length)}`, filtros.tramos.length > 0, `Precio${contar(filtros.tramos.length)}`)}
        {tallas.length > 0 && desplegable('talla', `Talla${contar(filtros.tallas.length)}`, filtros.tallas.length > 0, `Talla${contar(filtros.tallas.length)}`)}
        {interruptor}
        {ancho && <>
          <Box sx={{ flexGrow: 1 }} />
          {desplegable('orden', <>Ordenar por <Box component="span" sx={{ color: '#cdae72' }}>{ordenActual.nombre}</Box></>, false, `Ordenar por: ${ordenActual.nombre}`)}
        </>}
      </Box>

      {ancho ? (
        <Popover open={Boolean(capa)} anchorEl={capa?.ancla} onClose={cerrar} disableScrollLock
          anchorOrigin={{ vertical: 'bottom', horizontal: capa?.que === 'orden' ? 'right' : 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: capa?.que === 'orden' ? 'right' : 'left' }}
          slotProps={{ paper: { sx: { mt: 1, px: 2.5, pt: 1.5, pb: 2, width: 300, borderRadius: 0, bgcolor: CAPA, backgroundImage: 'none', boxShadow: '0 24px 50px rgba(0, 0, 0, 0.55)' } } }}>
          {abierta?.cuerpo}
        </Popover>
      ) : (
        <Drawer anchor="bottom" open={Boolean(capa)} onClose={cerrar}
          slotProps={{ paper: { sx: { bgcolor: CAPA, backgroundImage: 'none', borderRadius: '18px 18px 0 0', px: 2, pt: 1.25, pb: 2.5, maxHeight: '85vh' } } }}>
          <Box aria-hidden sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'rgba(244, 239, 229, 0.3)', mx: 'auto', mb: 1.5 }} />
          {abierta && <Typography component="h2" sx={{ ...ceja, mb: 0.5 }}>{abierta.titulo}</Typography>}
          {abierta?.cuerpo}
          <Boton fullWidth onClick={cerrar} sx={{ mt: 2 }}>{resultado === 1 ? 'Ver 1 producto' : `Ver ${resultado} productos`}</Boton>
        </Drawer>
      )}
    </>
  )
}

/** Lo que está filtrando ahora, cada cosa con su × para quitarla, y «Quitar todo». */
export function FiltrosActivos({ categorias, filtros, onFiltros }: {
  categorias: CategoriaDeTienda[]
  filtros: Filtros
  onFiltros: (f: Filtros) => void
}) {
  const categoria = categorias.find((c) => c.id === filtros.categoria)
  const activos = [
    ...(categoria ? [{ texto: categoria.nombre, quitar: () => onFiltros({ ...filtros, categoria: null }) }] : []),
    ...TRAMOS.filter((t) => filtros.tramos.includes(t.id)).map((t) => ({ texto: t.nombre, quitar: () => onFiltros({ ...filtros, tramos: filtros.tramos.filter((x) => x !== t.id) }) })),
    ...filtros.tallas.map((t) => ({ texto: `Talla ${t}`, quitar: () => onFiltros({ ...filtros, tallas: filtros.tallas.filter((x) => x !== t) }) })),
    ...(filtros.sinAgotados ? [{ texto: 'Sin agotados', quitar: () => onFiltros({ ...filtros, sinAgotados: false }) }] : []),
  ]
  if (activos.length === 0) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: { xs: 0.5, md: 2 } }}>
      {activos.map((a) => (
        <ButtonBase key={a.texto} onClick={a.quitar} aria-label={`Quitar ${a.texto}`} sx={{
          height: 36, pl: 1.75, pr: 1.25, gap: 1, borderRadius: '18px', bgcolor: CAPA, color: '#e4e2df', fontFamily: 'inherit', fontSize: 13.5,
          '&:hover': { bgcolor: '#262327', color: '#fff' }, ...foco,
        }}>
          {a.texto}<CloseIcon aria-hidden sx={{ fontSize: 15 }} />
        </ButtonBase>
      ))}
      {(activos.length > 1 || cuantosFiltros(filtros) > 0) && (
        <ButtonBase onClick={() => onFiltros(SIN_FILTROS)}
          sx={{ minHeight: 36, px: 1, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, color: '#cdae72', '&:hover': { color: '#fff' }, ...foco }}>
          Quitar todo
        </ButtonBase>
      )}
    </Box>
  )
}
