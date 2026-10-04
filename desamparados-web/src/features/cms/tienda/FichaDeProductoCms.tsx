import { Box, Button, FormControlLabel, IconButton, MenuItem, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import CampoImagen from '../CampoImagen'
import { MAX_FOTOS_PRODUCTO, MAX_TALLAS, type CategoriaDelCms, type FotoDeProducto } from '../../../lib/api/tienda'
import { ENTERO, PRECIO, TALLAS_HABITUALES, problemaDe, type Formulario, type TallaEnFormulario } from './formularioProducto'

/**
 * La ficha de un producto en la mesa de la tienda: todo a la vista, sin
 * ventana. Las tallas, cada una con lo que queda: con tallas, el producto ya
 * no lleva su propio «Quedan».
 */
export default function FichaDeProductoCms({ form: f, categorias, nuevo, guardando, onCambiar, onGuardar, onDescartar, onBorrar, sucio }: {
  form: Formulario
  categorias: CategoriaDelCms[]
  nuevo: boolean
  sucio: boolean
  guardando: boolean
  onCambiar: (f: Formulario) => void
  onGuardar: () => void
  onDescartar: () => void
  onBorrar: () => void
}) {
  const poner = (c: Partial<Formulario>) => onCambiar({ ...f, ...c })
  const ponerTalla = (i: number, c: Partial<TallaEnFormulario>) => poner({ tallas: f.tallas.map((t, k) => (k === i ? { ...t, ...c } : t)) })
  const problema = problemaDe(f)
  const totalTallas = f.tallas.reduce((s, t) => s + (ENTERO.test(t.existencias.trim()) ? Number(t.existencias) : 0), 0)
  const algunaSinLimite = f.tallas.some((t) => t.nombre.trim() && t.existencias.trim() === '')

  return (
    <Paper component="section" aria-label={nuevo ? 'Nuevo producto' : `Ficha de ${f.nombre}`} sx={{ p: { xs: 2, sm: 2.5 }, display: 'grid', gap: 2.25 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
        <Typography component="h2" sx={{ fontSize: 19, fontWeight: 600, flexGrow: 1, minWidth: 0 }} noWrap>{nuevo ? 'Nuevo producto' : (f.nombre || 'Sin nombre')}</Typography>
        <FormControlLabel control={<Switch checked={f.activo} onChange={(e) => poner({ activo: e.target.checked })} />} label="A la venta" labelPlacement="start" />
      </Stack>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) 130px 90px' } }}>
        <TextField label="Nombre" value={f.nombre} onChange={(e) => poner({ nombre: e.target.value })} slotProps={{ htmlInput: { maxLength: 120 } }} fullWidth />
        <TextField label="Precio (€)" value={f.precio} onChange={(e) => poner({ precio: e.target.value })} slotProps={{ htmlInput: { inputMode: 'decimal' } }} error={Boolean(f.precio) && !PRECIO.test(f.precio.trim())} fullWidth />
        <TextField label="Orden" type="number" value={f.orden} onChange={(e) => poner({ orden: e.target.value })} helperText="Menor, antes" fullWidth />
      </Box>
      <TextField label="Descripción" value={f.descripcion} onChange={(e) => poner({ descripcion: e.target.value })} multiline minRows={2} slotProps={{ htmlInput: { maxLength: 2000 } }} fullWidth />

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) minmax(0, 1fr)' }, alignItems: 'start' }}>
        <TextField select label="Categoría" value={f.categoriaId} onChange={(e) => poner({ categoriaId: e.target.value })}
          helperText={categorias.length === 0 ? 'Créalas en la pestaña «Categorías».' : 'Por ella se filtra en la tienda.'} fullWidth>
          <MenuItem value="">Sin categoría (solo en «Todo»)</MenuItem>
          {categorias.map((c) => <MenuItem key={c.id} value={String(c.id)}>{c.nombre}</MenuItem>)}
        </TextField>
        <Box>
          <FormControlLabel control={<Switch checked={f.destacado} onChange={(e) => poner({ destacado: e.target.checked })} />} label="Producto destacado" />
          <Typography variant="body2" color="text.secondary">
            Sale en grande al entrar en la tienda, con la foto entera y las tallas para elegir ahí mismo; si hay varios, el primero por orden.
          </Typography>
        </Box>
      </Box>

      <Box>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Typography sx={{ fontWeight: 600 }}>Tallas</Typography>
          <FormControlLabel
            control={<Switch checked={f.conTallas} onChange={(e) => poner({ conTallas: e.target.checked })} />}
            label="Tiene tallas"
          />
        </Stack>
        {!f.conTallas ? (
          <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', mt: 1 }}>
            <TextField label="Quedan" value={f.existencias} onChange={(e) => poner({ existencias: e.target.value })} helperText="Vacío: sin límite, se hace por encargo" slotProps={{ htmlInput: { inputMode: 'numeric' } }} sx={{ width: 240 }} />
          </Stack>
        ) : <>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
            Cada talla con lo que queda de ella (vacío: sin límite). Una talla a 0 sale tachada en la tienda.
            {f.tallas.length > 0 && (algunaSinLimite ? ' Alguna va sin límite.' : ` En total quedan ${totalTallas}.`)}
          </Typography>
          {f.tallas.length === 0 && (
            <Button variant="outlined" onClick={() => poner({ tallas: TALLAS_HABITUALES.map((nombre) => ({ nombre, existencias: '0' })) })} sx={{ mb: 1.5 }}>
              Poner {TALLAS_HABITUALES.join(', ')}
            </Button>
          )}
          <Box sx={{ display: 'grid', gap: 1.25, gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {f.tallas.map((t, i) => (
              <Box key={t.id ?? `nueva-${i}`} sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start', p: 1, border: '1px solid', borderColor: t.existencias.trim() === '0' ? 'error.light' : 'divider', borderRadius: 1 }}>
                <TextField label="Talla" size="small" value={t.nombre} onChange={(e) => ponerTalla(i, { nombre: e.target.value })} slotProps={{ htmlInput: { maxLength: 20 } }} sx={{ width: 64 }} />
                <TextField label="Quedan" size="small" value={t.existencias} onChange={(e) => ponerTalla(i, { existencias: e.target.value })} slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': `Quedan de la talla ${t.nombre || i + 1}` } }} sx={{ flex: 1, minWidth: 0 }} />
                <IconButton size="small" aria-label={`Quitar la talla ${t.nombre || i + 1}`} onClick={() => poner({ tallas: f.tallas.filter((_, k) => k !== i) })} sx={{ mt: 0.25 }}><DeleteOutlineIcon fontSize="small" /></IconButton>
              </Box>
            ))}
          </Box>
          {f.tallas.length < MAX_TALLAS && (
            <Button startIcon={<AddIcon />} onClick={() => poner({ tallas: [...f.tallas, { nombre: '', existencias: '' }] })} sx={{ mt: 1 }}>Añadir talla</Button>
          )}
        </>}
      </Box>

      <Box sx={{ display: 'grid', gap: 2 }}>
        <Typography sx={{ fontWeight: 600 }}>Fotos</Typography>
        <CampoImagen valor={f.foto} onCambio={(ruta) => poner({ foto: ruta })} etiqueta="Foto principal" ayuda="La que se ve en la tienda. En la ficha del producto salen todas." />
        {f.fotos.map((foto, i) => {
          const cambiarFoto = (c: Partial<FotoDeProducto>) => poner({ fotos: f.fotos.map((x, k) => (k === i ? { ...x, ...c } : x)) })
          return (
            <Stack key={i} direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' } }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <CampoImagen valor={foto.url} onCambio={(ruta) => cambiarFoto({ url: ruta })} etiqueta={`Foto ${i + 2}`} ayuda="El reverso, un detalle, el tamaño en la mano…" sinQuitar />
              </Box>
              <TextField label={`Pie de la foto ${i + 2}`} value={foto.pie} onChange={(e) => cambiarFoto({ pie: e.target.value })} helperText="Opcional" slotProps={{ htmlInput: { maxLength: 160 } }} sx={{ flex: 1 }} />
              <IconButton aria-label={`Quitar la foto ${i + 2}`} onClick={() => poner({ fotos: f.fotos.filter((_, k) => k !== i) })}><DeleteOutlineIcon /></IconButton>
            </Stack>
          )
        })}
        {f.foto && f.fotos.length < MAX_FOTOS_PRODUCTO && (
          <Button startIcon={<AddIcon />} onClick={() => poner({ fotos: [...f.fotos, { url: '', pie: '' }] })} sx={{ justifySelf: 'start' }}>
            Añadir otra foto
          </Button>
        )}
      </Box>

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid', borderColor: 'divider', pt: 2, flexWrap: 'wrap', rowGap: 1 }}>
        {!nuevo && <Button color="error" onClick={onBorrar} sx={{ mr: 'auto' }}>Borrar</Button>}
        {sucio && problema && <Typography variant="body2" color="error" sx={{ mr: 1 }}>{problema}</Typography>}
        <Button variant="outlined" onClick={onDescartar} disabled={guardando || (!sucio && !nuevo)}>{nuevo ? 'Cancelar' : 'Descartar'}</Button>
        <Button variant="contained" onClick={onGuardar} disabled={guardando || Boolean(problema) || (!sucio && !nuevo)}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
      </Stack>
    </Paper>
  )
}
