import { useState, type ReactNode } from 'react'
import { Box, Button, Divider, IconButton, ListItemIcon, Menu, MenuItem, Typography } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import PublishOutlinedIcon from '@mui/icons-material/PublishOutlined'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import UnpublishedOutlinedIcon from '@mui/icons-material/UnpublishedOutlined'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { Link } from 'react-router-dom'
import { useTemaCms } from '../../../app/useTemaCms'
import { fechaCorta, haceCuanto, queLeFalta, type Pieza } from './completitud'
import { rejillaFila } from './rejilla'

interface Props {
  titulo: string
  visible: boolean
  /** Fecha con la que sale en la web; de un borrador se enseña cuándo se editó. */
  fecha: string
  editadaEl?: string
  imagenUrl: string | null
  /** La portada de una publicación, 3:4, en vez de la foto apaisada de una noticia. */
  fotoVertical?: boolean
  /** Encima del título, en pequeño: el tipo de publicación. */
  antetitulo?: string
  /** Sale ahora en la portada de la web. */
  enPortada: boolean
  /** Destacada a mano: va la primera de la portada mientras lo esté. */
  fijada: boolean
  /** Lo que se mira para decir qué le falta. */
  piezas: Pieza[]
  /** De lo publicado solo se avisa de lo que se nota en la web: estas piezas, con su aviso («Sin foto»). */
  avisos: Partial<Record<Pieza['clave'], string>>
  /** Lo que se lee bajo el título de una publicada completa: el extracto o la descripción. */
  resumen?: string | null
  editar: string
  /** La consulta del listado, para que la ficha devuelva a la misma página y filtros. */
  volver: string
  /** Dónde verla en la web, si está publicada. */
  enLaWeb?: { href: string; texto: string }
  onCambiarVisible: () => void
  /** Destacarla en la portada, o soltarla si ya lo está. */
  onFijar: () => void
  onBorrar: () => void
}

/**
 * Una fila de un listado de redacción: foto, título, qué le falta, estado,
 * fecha y acciones. La comparten Noticias y Publicaciones, que se trabajan
 * igual: se escribe un borrador, se completa y se publica.
 */
export default function FilaRedaccion(props: Props) {
  const { titulo, visible, fecha, editadaEl, imagenUrl, fotoVertical = false, antetitulo, enPortada, fijada, piezas, avisos, resumen, editar, volver, enLaWeb, onCambiarVisible, onFijar, onBorrar } = props
  const { superficies } = useTemaCms()
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const borrador = !visible
  const faltan = borrador ? [] : piezas.filter((p) => !p.lista && avisos[p.clave])
  const editada = borrador && editadaEl ? haceCuanto(editadaEl) : null
  const cuando = editada ? `editada ${editada}` : fechaCorta(fecha)
  const cerrar = () => setMenu(null)

  return (
    <Box component="li" sx={{ ...rejillaFila(fotoVertical), px: { xs: 2, md: 2.5 }, py: 1.5, borderTop: 1, borderColor: 'divider', listStyle: 'none' }}>
      <Miniatura url={imagenUrl} vertical={fotoVertical} />

      <Box sx={{ gridArea: 'texto', minWidth: 0 }}>
        {antetitulo && (
          <Typography component="p" sx={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary', lineHeight: 1.4 }}>{antetitulo}</Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
          <Typography component="h3" sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{titulo}</Typography>
          {/* Fijada manda sobre «En portada»: explica por qué una vieja sigue arriba. */}
          {(fijada || enPortada) && (
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 12, fontWeight: 600, color: superficies.enlace, whiteSpace: 'nowrap', '& svg': { fontSize: 15, alignSelf: 'center' } }}>
              {fijada ? <PushPinOutlinedIcon aria-hidden="true" /> : <HomeOutlinedIcon aria-hidden="true" />}
              {fijada ? 'Destacada' : 'En portada'}
            </Box>
          )}
        </Box>
        {borrador ? (
          <Progreso piezas={piezas} />
        ) : faltan.length > 0 ? (
          <Box sx={{ display: 'flex', gap: 1.5, mt: 0.25, flexWrap: 'wrap' }}>
            {faltan.map((p) => <Aviso key={p.clave} texto={avisos[p.clave]!} />)}
          </Box>
        ) : resumen ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {resumen}
          </Typography>
        ) : null}
        {/* En el móvil no hay columnas de estado y fecha: van aquí. */}
        <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
          <EtiquetaEstado visible={visible} />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>{cuando}</Typography>
        </Box>
      </Box>

      <Box sx={{ gridArea: 'estado', display: { xs: 'none', md: 'block' } }}><EtiquetaEstado visible={visible} /></Box>
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
          to={editar}
          state={{ volver }}
          aria-label={`${borrador ? 'Seguir escribiendo' : 'Editar'} ${titulo}`}
          sx={{ whiteSpace: 'nowrap', ...(borrador ? { backgroundColor: superficies.accionFondo, color: superficies.accionTexto, px: 1.5 } : { borderColor: 'divider' }) }}
        >
          {borrador ? 'Seguir escribiendo' : 'Editar'}
        </Button>
        <IconButton size="small" aria-label={`Más acciones para ${titulo}`} aria-haspopup="menu" onClick={(e) => setMenu(e.currentTarget)}>
          <MoreHorizIcon fontSize="small" />
        </IconButton>
        <Menu anchorEl={menu} open={menu !== null} onClose={cerrar} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
          {!borrador && enLaWeb && (
            <MenuItem component="a" href={enLaWeb.href} target="_blank" rel="noopener" onClick={cerrar}>
              <ListItemIcon><OpenInNewIcon fontSize="small" /></ListItemIcon>{enLaWeb.texto}
            </MenuItem>
          )}
          {!borrador && (
            <MenuItem onClick={() => { cerrar(); onFijar() }}>
              <ListItemIcon><PushPinOutlinedIcon fontSize="small" /></ListItemIcon>
              {fijada ? 'Dejar de destacarla' : 'Destacar en la portada'}
            </MenuItem>
          )}
          <MenuItem onClick={() => { cerrar(); onCambiarVisible() }}>
            <ListItemIcon>{borrador ? <PublishOutlinedIcon fontSize="small" /> : <UnpublishedOutlinedIcon fontSize="small" />}</ListItemIcon>
            {borrador ? 'Publicar' : 'Pasar a borrador'}
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => { cerrar(); onBorrar() }} sx={{ color: 'error.main' }}>
            <ListItemIcon sx={{ color: 'inherit' }}><DeleteOutlineIcon fontSize="small" /></ListItemIcon>Eliminar
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  )
}

function Miniatura({ url, vertical }: { url: string | null; vertical: boolean }) {
  // Si el fichero ya no está en el servidor, el hueco vacío y no el icono de imagen rota.
  const [rota, setRota] = useState<string | null>(null)
  const caja = { gridArea: 'foto', width: '100%', aspectRatio: vertical ? '3 / 4' : { xs: '1 / 1', md: '3 / 2' }, borderRadius: vertical ? 1 : 1.5, overflow: 'hidden' } as const
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

function Aviso({ texto }: { texto: ReactNode }) {
  const { superficies } = useTemaCms()
  return (
    <Typography variant="caption" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: superficies.avisoTexto, fontWeight: 500, '& svg': { fontSize: 14 } }}>
      <WarningAmberIcon aria-hidden="true" />{texto}
    </Typography>
  )
}
