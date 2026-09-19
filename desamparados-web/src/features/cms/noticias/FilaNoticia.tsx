import { useState } from 'react'
import { Box, Button, Divider, IconButton, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PublishOutlinedIcon from '@mui/icons-material/PublishOutlined'
import UnpublishedOutlinedIcon from '@mui/icons-material/UnpublishedOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Link } from 'react-router-dom'
import { useTemaCms } from '../../../app/temaCms'
import type { ApiNews } from '../../../lib/api/news'
import { fechaCorta, haceCuanto, piezasDeNoticia, queLeFalta, type Pieza } from './completitud'
import { REJILLA_FILA } from './rejilla'

interface Props {
  noticia: ApiNews
  /** Sale ahora en la portada de la web. */
  enPortada: boolean
  /** La consulta del listado, para que la ficha devuelva a la misma página y filtros. */
  volver: string
  onCambiarVisible: (noticia: ApiNews) => void
  onBorrar: (noticia: ApiNews) => void
}

/** Una noticia del listado del CMS: foto, título, qué le falta, estado, fecha y acciones. */
export default function FilaNoticia({ noticia, enPortada, volver, onCambiarVisible, onBorrar }: Props) {
  const { superficies } = useTemaCms()
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const piezas = piezasDeNoticia(noticia)
  const borrador = !noticia.visible
  // De lo publicado solo se avisa de lo que se ve en la web: el título y el
  // texto ya los exige el servidor.
  const avisos = borrador ? [] : piezas.filter((p) => !p.lista && (p.clave === 'foto' || p.clave === 'extracto'))
  const editada = borrador && noticia.updatedAt ? haceCuanto(noticia.updatedAt) : null
  const cuando = editada ? `editada ${editada}` : fechaCorta(noticia.fecha)
  const cerrar = () => setMenu(null)

  return (
    <Box component="li" sx={{ ...REJILLA_FILA, px: { xs: 2, md: 2.5 }, py: 1.5, borderTop: 1, borderColor: 'divider', listStyle: 'none' }}>
      <Miniatura url={noticia.imagenUrl} />

      <Box sx={{ gridArea: 'texto', minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
          <Typography component="h3" sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{noticia.titulo}</Typography>
          {enPortada && (
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 12, fontWeight: 600, color: superficies.enlace, whiteSpace: 'nowrap', '& svg': { fontSize: 15, alignSelf: 'center' } }}>
              <HomeOutlinedIcon aria-hidden="true" />En portada
            </Box>
          )}
        </Box>
        {borrador ? (
          <Progreso piezas={piezas} />
        ) : avisos.length > 0 ? (
          <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25 }}>
            {avisos.map((p) => <Aviso key={p.clave} texto={`Sin ${p.clave === 'foto' ? 'foto' : 'extracto'}`} />)}
          </Box>
        ) : noticia.extracto ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {noticia.extracto}
          </Typography>
        ) : null}
        {/* En el móvil no hay columnas de estado y fecha: van aquí. */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
          <EtiquetaEstado visible={noticia.visible} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{cuando}</Typography>
        </Box>
      </Box>

      <Box sx={{ gridArea: 'estado', display: { xs: 'none', md: 'block' } }}><EtiquetaEstado visible={noticia.visible} /></Box>
      <Typography variant="body2" sx={{ gridArea: 'fecha', display: { xs: 'none', md: 'block' }, color: borrador ? 'text.secondary' : 'text.primary', fontVariantNumeric: 'tabular-nums' }}>
        {/* «editada hace un momento» no cabe en la columna: «Editada» va encima, en pequeño. */}
        {editada ? (
          <>
            <Box component="span" sx={{ display: 'block', fontSize: 12, lineHeight: 1.3 }}>Editada</Box>
            {editada}
          </>
        ) : cuando}
      </Typography>

      <Box sx={{ gridArea: 'acciones', display: 'flex', gap: 0.5, justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center' }}>
        <Button
          size="small"
          variant={borrador ? 'text' : 'outlined'}
          color="inherit"
          startIcon={borrador ? undefined : <EditOutlinedIcon />}
          component={Link}
          to={`/cms/noticias/${noticia.id}/editar`}
          state={{ volver }}
          aria-label={`${borrador ? 'Seguir escribiendo' : 'Editar'} ${noticia.titulo}`}
          sx={{ whiteSpace: 'nowrap', ...(borrador ? { backgroundColor: superficies.accionFondo, color: superficies.accionTexto, px: 1.5 } : { borderColor: 'divider' }) }}
        >
          {borrador ? 'Seguir escribiendo' : 'Editar'}
        </Button>
        <IconButton size="small" aria-label={`Más acciones para ${noticia.titulo}`} aria-haspopup="menu" onClick={(e) => setMenu(e.currentTarget)}>
          <MoreHorizIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={menu} open={menu !== null} onClose={cerrar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          {!borrador && (
            <MenuItem component="a" href={`/actualidad/noticias/${noticia.slug}`} target="_blank" rel="noopener" onClick={cerrar}>
              <ListItemIcon><OpenInNewIcon fontSize="small" /></ListItemIcon>Ver en la web
            </MenuItem>
          )}
          <MenuItem onClick={() => { cerrar(); onCambiarVisible(noticia) }}>
            <ListItemIcon>{borrador ? <PublishOutlinedIcon fontSize="small" /> : <UnpublishedOutlinedIcon fontSize="small" />}</ListItemIcon>
            {borrador ? 'Publicar' : 'Pasar a borrador'}
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { cerrar(); onBorrar(noticia) }} sx={{ color: 'error.main' }}>
            <ListItemIcon sx={{ color: 'inherit' }}><DeleteOutlineIcon fontSize="small" /></ListItemIcon>Eliminar
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  )
}

function Miniatura({ url }: { url: string | null }) {
  // Si el fichero ya no está en el servidor, el hueco vacío y no el icono de imagen rota.
  const [rota, setRota] = useState<string | null>(null)
  const caja = { gridArea: 'foto', width: '100%', aspectRatio: { xs: '1 / 1', md: '3 / 2' }, borderRadius: 1.5, overflow: 'hidden' } as const
  if (url && rota !== url) return <Box component="img" src={url} alt="" loading="lazy" onError={() => setRota(url)} sx={{ ...caja, display: 'block', objectFit: 'cover' }} />
  return (
    <Box aria-hidden="true" sx={{ ...caja, display: 'grid', placeItems: 'center', color: 'text.disabled', border: '1px dashed', borderColor: 'divider', backgroundColor: 'action.hover' }}>
      <ImageOutlinedIcon fontSize="small" />
    </Box>
  )
}

/** Publicada o borrador, como las etiquetas de «Para hoy»: punto de color sobre fondo suave. */
export function EtiquetaEstado({ visible }: { visible: boolean }) {
  const { superficies, graficas } = useTemaCms()
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 24, px: 1.25, borderRadius: 12,
        fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
        backgroundColor: visible ? superficies.pillNeutro : superficies.pillPendiente,
      }}
    >
      <Box component="span" aria-hidden="true" sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: visible ? graficas.estados.ok : graficas.estados.aviso }} />
      {visible ? 'Publicada' : 'Borrador'}
    </Box>
  )
}

/** Las cuatro piezas de un borrador como una barra en cuatro tramos, y la frase que la explica. */
export function Progreso({ piezas }: { piezas: Pieza[] }) {
  const { superficies, graficas } = useTemaCms()
  const completo = piezas.every((p) => p.lista)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 0.5, flexWrap: 'wrap' }}>
      <Box aria-hidden="true" sx={{ display: 'flex', gap: 0.5, width: 88, flexShrink: 0 }}>
        {piezas.map((p) => (
          <Box key={p.clave} sx={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: p.lista ? graficas.estados.ok : 'action.selected' }} />
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: completo ? 'text.secondary' : superficies.avisoTexto, fontWeight: completo ? 400 : 500 }}>
        {queLeFalta(piezas)}
      </Typography>
    </Box>
  )
}

function Aviso({ texto }: { texto: string }) {
  const { superficies } = useTemaCms()
  return (
    <Typography variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: superficies.avisoTexto, fontWeight: 500, '& svg': { fontSize: 14 } }}>
      <WarningAmberIcon aria-hidden="true" />{texto}
    </Typography>
  )
}
