import { useId, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import type { Category, TipoApunte } from '../../../lib/api/accounting'
import { errorNombreCategoria } from './apunte'

interface Props {
  abierto: boolean
  categorias: Category[]
  onCerrar: () => void
  /** Abre la ventana de alta, encima de esta. */
  onNueva: () => void
  onRenombrar: (id: number, nombre: string) => Promise<void>
  onCambiarEstado: (id: number, activa: boolean) => Promise<void>
}

const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error ? e.message : porDefecto)

/**
 * Renombrar, desactivar y reactivar categorías. Nada se borra: una categoría
 * desactivada deja de ofrecerse al apuntar, pero sus apuntes siguen en el libro
 * con su nombre y se puede reactivar cuando se quiera.
 */
export default function GestionCategorias({ abierto, categorias, onCerrar, onNueva, onRenombrar, onCambiarEstado }: Props) {
  const idTitulo = useId()
  const [editando, setEditando] = useState<{ id: number; nombre: string } | null>(null)
  const [ocupada, setOcupada] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const hacer = async (id: number, accion: () => Promise<void>, porDefecto: string) => {
    setOcupada(id); setError(null)
    try { await accion(); return true }
    catch (e: unknown) { setError(mensaje(e, porDefecto)); return false }
    finally { setOcupada(null) }
  }

  const guardarNombre = async () => {
    if (!editando) return
    const ok = await hacer(editando.id, () => onRenombrar(editando.id, editando.nombre.trim()), 'No se ha podido renombrar la categoría.')
    if (ok) setEditando(null)
  }

  const fila = (c: Category) => {
    const enEdicion = editando?.id === c.id
    const fallo = enEdicion ? errorNombreCategoria(editando.nombre) : null
    const desactivada = c.activa === false
    return (
      <Box component="li" key={c.id} sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider', listStyle: 'none' }}>
        {enEdicion ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
            <TextField
              size="small"
              label={`Nuevo nombre de «${c.nombre}»`}
              value={editando.nombre}
              onChange={(e) => setEditando({ id: c.id, nombre: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter' && !fallo) void guardarNombre() }}
              error={Boolean(fallo)}
              helperText={fallo ?? undefined}
              autoFocus
              sx={{ flex: 1 }}
            />
            <Button onClick={() => void guardarNombre()} disabled={Boolean(fallo) || ocupada === c.id} variant="contained" size="small" sx={{ mt: 0.5 }}>Guardar</Button>
            <Button onClick={() => setEditando(null)} disabled={ocupada === c.id} size="small" sx={{ mt: 0.5 }}>Cancelar</Button>
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ color: desactivada ? 'text.secondary' : 'text.primary' }}>{c.nombre}</Typography>
              {(desactivada || c.deRecibos) && (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
                  {[desactivada && 'Desactivada: no se ofrece al apuntar', c.deRecibos && 'La usan los recibos: no se renombra'].filter(Boolean).join(' · ')}
                </Typography>
              )}
            </Box>
            {!c.deRecibos && (
              <Button size="small" onClick={() => { setError(null); setEditando({ id: c.id, nombre: c.nombre }) }} disabled={ocupada !== null} aria-label={`Renombrar «${c.nombre}»`}>
                Renombrar
              </Button>
            )}
            <Button
              size="small"
              onClick={() => void hacer(c.id, () => onCambiarEstado(c.id, desactivada), 'No se ha podido cambiar la categoría.')}
              disabled={ocupada !== null}
              aria-label={`${desactivada ? 'Reactivar' : 'Desactivar'} «${c.nombre}»`}
            >
              {desactivada ? 'Reactivar' : 'Desactivar'}
            </Button>
          </Stack>
        )}
      </Box>
    )
  }

  const grupo = (tipo: TipoApunte, titulo: string) => {
    const lista = categorias.filter((c) => c.tipo === tipo)
    return (
      <Box component="section" aria-label={titulo}>
        <Typography variant="overline" component="h3" color="text.secondary">{titulo}</Typography>
        {lista.length === 0
          ? <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>Todavía no hay ninguna.</Typography>
          : <Box component="ul" sx={{ m: 0, p: 0 }}>{lista.map(fila)}</Box>}
      </Box>
    )
  }

  const cerrar = () => { if (ocupada !== null) return; setEditando(null); setError(null); onCerrar() }

  return (
    <Dialog open={abierto} onClose={cerrar} fullWidth maxWidth="sm" scroll="paper" aria-labelledby={idTitulo}>
      <DialogTitle id={idTitulo} sx={{ fontFamily: '"Libre Caslon Text", serif', fontWeight: 400, fontSize: 24, pb: 1 }}>Categorías</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Desactivar una categoría la quita del desplegable al apuntar; sus apuntes siguen en el libro con su nombre.
          </Typography>
          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
          {grupo('INGRESO', 'Ingresos')}
          {grupo('GASTO', 'Gastos')}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Button startIcon={<AddIcon />} onClick={onNueva}>Nueva categoría</Button>
        <Button onClick={cerrar} disabled={ocupada !== null}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
