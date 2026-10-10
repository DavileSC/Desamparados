import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material'
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import { borrarListaDelCenso, guardarListaDelCenso, listasDelCenso } from '../../../lib/api/hermanos'

const CLAVE = ['censo', 'listas'] as const

/**
 * Las búsquedas guardadas del censo: se elige una y se aplican sus filtros;
 * se guarda la de ahora con un nombre (el mismo nombre la sustituye) y se
 * borra la que está puesta. Las comparte toda la junta.
 *
 * `consulta` son los filtros de ahora, como van en la URL; `onAplicar` los
 * cambia todos a la vez.
 */
export default function ListasGuardadas({ consulta, onAplicar }: { consulta: string; onAplicar: (consulta: string) => void }) {
  const queryClient = useQueryClient()
  const { data } = useQuery({ queryKey: CLAVE, queryFn: listasDelCenso })
  // Una respuesta rara (un servidor de antes de las listas) no debe tumbar el censo.
  const listas = Array.isArray(data) ? data : []
  const [guardando, setGuardando] = useState(false)
  const [nombre, setNombre] = useState('')
  // La comparte toda la junta: un clic de más la borraba para todos sin preguntar.
  const [aBorrar, setABorrar] = useState<{ id: number; nombre: string } | null>(null)
  const puesta = listas.find((l) => l.consulta === consulta && consulta !== '')

  const guardar = useMutation({
    mutationFn: () => guardarListaDelCenso(nombre.trim(), consulta),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: CLAVE }); setGuardando(false) },
  })
  const borrar = useMutation({
    mutationFn: (id: number) => borrarListaDelCenso(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: CLAVE }),
  })

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
      {listas.length > 0 && (
        <TextField
          select size="small" label="Listas guardadas" value={puesta ? String(puesta.id) : ''} sx={{ minWidth: 220 }}
          onChange={(e) => { const l = listas.find((x) => String(x.id) === e.target.value); if (l) onAplicar(l.consulta) }}
        >
          {listas.map((l) => <MenuItem key={l.id} value={String(l.id)}>{l.nombre}</MenuItem>)}
        </TextField>
      )}
      <Button size="small" startIcon={<BookmarkBorderIcon />} disabled={consulta === ''} onClick={() => { setNombre(puesta?.nombre ?? ''); setGuardando(true) }}>
        Guardar esta lista
      </Button>
      {puesta && (
        <Button size="small" color="error" disabled={borrar.isPending} onClick={() => setABorrar(puesta)}>
          Borrar «{puesta.nombre}»
        </Button>
      )}

      {borrar.isError && <Typography color="error" variant="body2" role="alert">{borrar.error instanceof Error ? borrar.error.message : 'No se ha podido borrar la lista.'}</Typography>}
      <DialogoConfirmacion
        abierto={aBorrar !== null}
        titulo={`¿Borrar la lista «${aBorrar?.nombre ?? ''}»?`}
        mensaje="La usa toda la junta, también en Cartas. Los hermanos no cambian: solo se pierde la búsqueda guardada."
        textoConfirmar="Borrar la lista"
        peligro
        onConfirmar={() => { if (aBorrar) borrar.mutate(aBorrar.id); setABorrar(null) }}
        onCancelar={() => setABorrar(null)}
      />
      <Dialog open={guardando} onClose={() => setGuardando(false)} fullWidth maxWidth="xs">
        <DialogTitle>Guardar esta lista</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField
              label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus fullWidth
              slotProps={{ htmlInput: { maxLength: 80 } }}
              helperText="Como «Menores sin medalla» o «Sin correo, para las cartas». Con un nombre que ya existe, se sustituye."
            />
            {guardar.isError && <Typography color="error" variant="body2">{guardar.error instanceof Error ? guardar.error.message : 'No se ha podido guardar.'}</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGuardando(false)}>Cancelar</Button>
          <Button variant="contained" disabled={nombre.trim() === '' || guardar.isPending} onClick={() => guardar.mutate()}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}
