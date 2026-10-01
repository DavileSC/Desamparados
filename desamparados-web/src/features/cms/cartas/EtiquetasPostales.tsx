import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Button, FormControlLabel, MenuItem, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import { listasDelCenso } from '../../../lib/api/hermanos'
import { FORMATOS_DE_ETIQUETAS, destinatariosDeCarta, pdfDeEtiquetas, type PedidoDeEtiquetas } from '../../../lib/api/cartas'

/** A quien no le llega nada por correo electrónico: para eso son las etiquetas. */
const SIN_CORREO = 'estado=activo&correo=sin'
const plural = (n: number, una: string, varias: string) => `${n} ${n === 1 ? una : varias}`

/**
 * Las etiquetas postales: las direcciones de una búsqueda del censo en una
 * hoja A4 de etiquetas adhesivas. De partida, los activos sin correo
 * electrónico, que son a los que hay que escribir por carta. Una por casa, si
 * se quiere, y empezando donde se quedó una hoja ya empezada.
 */
export default function EtiquetasPostales({ onVolver }: { onVolver: () => void }) {
  const [pedido, setPedido] = useState<PedidoDeEtiquetas>({ consulta: SIN_CORREO, formato: FORMATOS_DE_ETIQUETAS[0].clave, saltar: 0, porDomicilio: true })
  const [error, setError] = useState<string | null>(null)
  const cambiar = (cambios: Partial<PedidoDeEtiquetas>) => setPedido((p) => ({ ...p, ...cambios }))
  const listas = useQuery({ queryKey: ['censo', 'listas'], queryFn: listasDelCenso })
  const recuento = useQuery({ queryKey: ['cartas', 'destinatarios', pedido.consulta], queryFn: () => destinatariosDeCarta(pedido.consulta) })
  const formato = FORMATOS_DE_ETIQUETAS.find((f) => f.clave === pedido.formato) ?? FORMATOS_DE_ETIQUETAS[0]

  const imprimir = useMutation({
    mutationFn: async () => {
      // La pestaña se abre ya, en el clic: el navegador bloquea las que nacen después de esperar.
      const ventana = window.open('', '_blank')
      try {
        const archivo = await pdfDeEtiquetas(pedido)
        if (ventana) ventana.location.href = URL.createObjectURL(archivo.blob)
      } catch (e) {
        ventana?.close()
        throw e
      }
    },
    onMutate: () => setError(null),
    onError: (e) => setError(e instanceof Error && e.message ? e.message : 'No se han podido generar las etiquetas.'),
  })

  const opciones = [
    { consulta: SIN_CORREO, nombre: 'Los hermanos activos sin correo electrónico' },
    { consulta: 'estado=activo', nombre: 'Todos los hermanos activos' },
    ...(Array.isArray(listas.data) ? listas.data.map((l) => ({ consulta: l.consulta, nombre: `Lista: ${l.nombre}` })) : []),
  ]
  const r = recuento.data
  const etiquetas = r ? (pedido.porDomicilio ? r.domicilios : r.total - r.sinDireccion) : 0
  const hojas = Math.ceil((etiquetas + pedido.saltar) / formato.porHoja)

  return (
    <Paper component="section" aria-label="Etiquetas postales" sx={{ p: { xs: 2.5, md: 3 } }}>
      <Stack spacing={2.25}>
        <Button size="small" onClick={onVolver} sx={{ display: { md: 'none' }, alignSelf: 'flex-start' }}>Volver a las cartas</Button>
        <Typography variant="h6" component="h2">Etiquetas postales</Typography>
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

        <TextField select label="A quién van" value={pedido.consulta} onChange={(e) => cambiar({ consulta: e.target.value })}
          helperText={r
            ? `${plural(r.total, 'hermano', 'hermanos')}${r.sinDireccion ? `; ${plural(r.sinDireccion, 'no tiene', 'no tienen')} dirección y se quedan fuera` : ''}${r.demasiados ? '. Hay más: afina la búsqueda' : ''}. Nunca a un hermano difunto.`
            : 'Las listas se guardan en Hermanos, con «Guardar esta lista».'}>
          {opciones.map((o) => <MenuItem key={o.consulta} value={o.consulta}>{o.nombre}</MenuItem>)}
        </TextField>

        <FormControlLabel control={<Switch checked={pedido.porDomicilio} onChange={(e) => cambiar({ porDomicilio: e.target.checked })} />}
          label={r ? `Una por domicilio (${plural(r.domicilios, 'casa', 'casas')}): si viven varios juntos, a la familia` : 'Una por domicilio: si viven varios juntos, a la familia'} />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField select label="Hoja de etiquetas" value={formato.clave} sx={{ flex: 2 }}
            onChange={(e) => cambiar({ formato: e.target.value, saltar: 0 })}
            helperText="Viene en el paquete: cuántas por hoja y su medida.">
            {FORMATOS_DE_ETIQUETAS.map((f) => <MenuItem key={f.clave} value={f.clave}>{f.nombre}</MenuItem>)}
          </TextField>
          <TextField type="number" label="Ya gastadas de la hoja" value={pedido.saltar} sx={{ flex: 1 }}
            onChange={(e) => cambiar({ saltar: Math.max(0, Math.min(formato.porHoja - 1, Math.trunc(Number(e.target.value)) || 0)) })}
            helperText="Por filas, desde arriba a la izquierda."
            slotProps={{ htmlInput: { min: 0, max: formato.porHoja - 1 } }} />
        </Stack>

        <Alert severity="info">Imprime al 100 % (sin «Ajustar a la página»): si no, las direcciones se salen de las etiquetas.</Alert>

        <Button variant="contained" disabled={etiquetas === 0 || imprimir.isPending} onClick={() => imprimir.mutate()} sx={{ alignSelf: 'flex-start' }}>
          {imprimir.isPending ? 'Preparando…' : `Imprimir ${plural(etiquetas, 'etiqueta', 'etiquetas')}${etiquetas ? ` (${plural(hojas, 'hoja', 'hojas')})` : ''}`}
        </Button>
      </Stack>
    </Paper>
  )
}
