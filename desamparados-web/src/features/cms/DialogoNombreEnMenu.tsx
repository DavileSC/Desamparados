import { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CLAVE_NOMBRES_EN_MENU, TOPE_NOMBRE_EN_MENU, guardarNombresEnMenu, type NombresEnMenu } from '../../lib/api/menu'

/** Qué entrada del menú se está cambiando: su ruta, su nombre de siempre y el que tiene ahora. */
export interface EntradaARenombrar {
  ruta: string
  deSiempre: string
  /** Para el título del diálogo: el nombre de la página en el CMS. */
  pagina: string
}

/**
 * «Nombre en el menú» de una página: un campo con el de siempre como
 * marcador. Vacío vuelve el de siempre. Se guardan todos de una vez (es lo que
 * pide la API), partiendo de los que ya hay, y la barra de la web los recoge
 * sin recargar: el resultado se pone en la misma caché que lee el menú.
 *
 * Un diálogo y no un campo en la fila: la fila entera es el enlace al editor
 * de la página, y un campo dentro de un enlace no se puede pulsar ni tabular.
 * Cancelar descarta lo escrito, sin aviso de cambios sin guardar: es una sola
 * línea, a la vista hasta el último momento.
 */
export default function DialogoNombreEnMenu({ entrada, nombres, alCerrar }: {
  entrada: EntradaARenombrar
  nombres: NombresEnMenu
  alCerrar: () => void
}) {
  const queryClient = useQueryClient()
  const [valor, setValor] = useState(nombres[entrada.ruta] ?? '')
  const recortado = valor.trim()
  const conEtiquetas = /[<>]/.test(recortado)
  const guardar = useMutation({
    mutationFn: () => {
      const { [entrada.ruta]: _anterior, ...resto } = nombres
      return guardarNombresEnMenu(recortado ? { ...resto, [entrada.ruta]: recortado } : resto)
    },
    onSuccess: (guardados) => {
      queryClient.setQueryData(CLAVE_NOMBRES_EN_MENU, guardados)
      alCerrar()
    },
  })

  return (
    <Dialog open onClose={guardar.isPending ? undefined : alCerrar} fullWidth maxWidth="xs">
      <Typography component="div" sx={{ px: 3, pt: 2.5, color: 'text.secondary', fontSize: '0.8rem' }}>{entrada.pagina}</Typography>
      <DialogTitle sx={{ pt: 0.5 }}>Nombre en el menú</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Nombre en el menú"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !conEtiquetas && !guardar.isPending) guardar.mutate() }}
          placeholder={entrada.deSiempre}
          slotProps={{ htmlInput: { maxLength: TOPE_NOMBRE_EN_MENU }, inputLabel: { shrink: true } }}
          error={conEtiquetas}
          helperText={conEtiquetas ? 'Sin los signos < ni >.' : `Vacío, el de siempre: «${entrada.deSiempre}».`}
          sx={{ mt: 1 }}
        />
        {guardar.isError && <Alert severity="error" sx={{ mt: 2 }}>{guardar.error.message}</Alert>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={alCerrar} disabled={guardar.isPending}>Cancelar</Button>
        <Button variant="contained" onClick={() => guardar.mutate()} disabled={conEtiquetas || guardar.isPending}>Guardar</Button>
      </DialogActions>
    </Dialog>
  )
}
