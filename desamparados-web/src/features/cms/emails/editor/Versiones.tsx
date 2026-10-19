import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, ListItemText, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { versionesDePlantilla, type PlantillaDeCorreo } from '../../../../lib/api/emails'

interface Props {
  id: number
  abierto: boolean
  onCerrar: () => void
  /** La versión elegida pasa al editor: se guarda como cualquier otro cambio. */
  onElegir: (datos: PlantillaDeCorreo) => void
}

const cuando = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

/** Las veces que se guardó la plantilla, para volver a una. */
export default function Versiones({ id, abierto, onCerrar, onElegir }: Props) {
  const { data, error, isPending } = useQuery({ queryKey: ['emails', 'plantilla', id, 'versiones'], queryFn: () => versionesDePlantilla(id), enabled: abierto })
  return (
    <Dialog open={abierto} onClose={onCerrar} fullWidth maxWidth="sm">
      <DialogTitle>Versiones guardadas</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Elige una para cargarla en el editor. No cambia nada hasta que guardes.
        </Typography>
        {error && <Alert severity="error">No se han podido cargar las versiones.</Alert>}
        {isPending && <Typography variant="body2">Cargando…</Typography>}
        {data?.length === 0 && <Typography variant="body2">Aún no hay versiones guardadas.</Typography>}
        <List>
          {data?.map((v, i) => (
            <ListItemButton key={v.id} onClick={() => onElegir(v.datos)} sx={{ borderRadius: 1 }}>
              <ListItemText
                primary={`${cuando.format(new Date(v.createdAt))}${i === 0 ? ' · la guardada ahora' : ''}`}
                secondary={`${v.datos.asunto || 'Sin asunto'}${v.autorNombre ? ` · ${v.autorNombre}` : ''}`}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
      <DialogActions><Button onClick={onCerrar}>Cerrar</Button></DialogActions>
    </Dialog>
  )
}
