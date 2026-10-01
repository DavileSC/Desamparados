import { useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert, Box, Button, Chip, CircularProgress, List, ListItemButton, ListItemText, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CabeceraSeccion from '../CabeceraSeccion'
import EtiquetasPostales from './EtiquetasPostales'
import { site } from '../../../config/site'
import { listasDelCenso } from '../../../lib/api/hermanos'
import {
  CAMPOS_DE_CARTA, borrarCarta, cartas, crearCarta, destinatariosDeCarta, guardarCarta, pdfDeCartas,
  type Carta, type DatosDeCarta,
} from '../../../lib/api/cartas'

const CLAVE = ['cartas'] as const
const ACTIVOS = 'estado=activo'
const EN_BLANCO: DatosDeCarta = { nombre: '', asunto: '', cuerpo: '{{saludo}} {{tratamiento}} {{nombre}}:\n\n', consulta: ACTIVOS, firmaCargo: 'El Secretario', firmaNombre: null }
const mensaje = (e: unknown, porDefecto: string) => (e instanceof Error && e.message ? e.message : porDefecto)

/** Los campos mal escritos del texto: los que no se rellenarían (el servidor los deja tal cual). */
function camposDesconocidos(texto: string): string[] {
  const conocidos: readonly string[] = CAMPOS_DE_CARTA.map((c) => c.campo)
  const vistos = [...texto.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((m) => m[1])
  return [...new Set(vistos.filter((c) => !conocidos.includes(c.toLowerCase())))]
}

/**
 * Las cartas y circulares de Secretaría. Se escribe el texto con los campos
 * que se rellenan con cada hermano ({{nombre}}…), se eligen los
 * destinatarios con una búsqueda del censo (los activos, o una lista
 * guardada allí) y se imprimen todas en un PDF, una por hermano, con la
 * dirección donde cae la ventana del sobre. Se guardan para otro año. Para
 * los sobres sin ventana o los paquetes, las etiquetas postales.
 */
export default function CartasPage() {
  const queryClient = useQueryClient()
  const lista = useQuery({ queryKey: CLAVE, queryFn: cartas })
  const [abierta, setAbierta] = useState<Carta | 'nueva' | 'etiquetas' | null>(null)

  return (
    <>
      <Helmet><title>{`Cartas | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion titulo="Cartas" subtitulo="Cartas y circulares a los hermanos, en PDF, listas para imprimir y meter en un sobre de ventana.">
        <Button variant="outlined" onClick={() => setAbierta('etiquetas')}>Etiquetas postales</Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAbierta('nueva')}>Nueva carta</Button>
      </CabeceraSeccion>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(240px, 320px) minmax(0, 1fr)' }, gap: 2.5, alignItems: 'start' }}>
        <Box sx={{ display: { xs: abierta ? 'none' : 'block', md: 'block' } }}>
          {lista.isPending && <CircularProgress aria-label="Cargando las cartas" />}
          {lista.data?.length === 0 && <Alert severity="info">Todavía no hay ninguna carta guardada.</Alert>}
          {lista.data && lista.data.length > 0 && (
            <Paper>
              <List aria-label="Cartas guardadas" dense>
                {lista.data.map((c) => (
                  <ListItemButton key={c.id} selected={typeof abierta === 'object' && abierta?.id === c.id} onClick={() => setAbierta(c)}>
                    <ListItemText primary={c.nombre} secondary={c.asunto || 'Sin asunto'} />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          )}
        </Box>
        <Box sx={{ display: { xs: abierta ? 'block' : 'none', md: 'block' }, minWidth: 0 }}>
          {abierta === 'etiquetas'
            ? <EtiquetasPostales onVolver={() => setAbierta(null)} />
            : abierta
            ? <Editor key={abierta === 'nueva' ? 'nueva' : abierta.id} carta={abierta === 'nueva' ? null : abierta}
                onGuardada={(c) => { setAbierta(c); void queryClient.invalidateQueries({ queryKey: CLAVE }) }}
                onBorrada={() => { setAbierta(null); void queryClient.invalidateQueries({ queryKey: CLAVE }) }}
                onVolver={() => setAbierta(null)} />
            : <Paper sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}><Typography>Elige una carta guardada o empieza una nueva.</Typography></Paper>}
        </Box>
      </Box>
    </>
  )
}

function Editor({ carta, onGuardada, onBorrada, onVolver }: { carta: Carta | null; onGuardada: (c: Carta) => void; onBorrada: () => void; onVolver: () => void }) {
  const [datos, setDatos] = useState<DatosDeCarta>(carta ? { nombre: carta.nombre, asunto: carta.asunto, cuerpo: carta.cuerpo, consulta: carta.consulta, firmaCargo: carta.firmaCargo, firmaNombre: carta.firmaNombre } : EN_BLANCO)
  const [aviso, setAviso] = useState<{ tono: 'success' | 'error'; texto: string } | null>(null)
  const cuerpoRef = useRef<HTMLTextAreaElement>(null)
  const listas = useQuery({ queryKey: ['censo', 'listas'], queryFn: listasDelCenso })
  const recuento = useQuery({ queryKey: [...CLAVE, 'destinatarios', datos.consulta], queryFn: () => destinatariosDeCarta(datos.consulta) })
  const cambiar = (cambios: Partial<DatosDeCarta>) => setDatos((d) => ({ ...d, ...cambios }))

  const guardar = useMutation({
    mutationFn: () => (carta ? guardarCarta(carta.id, datos) : crearCarta(datos)),
    onSuccess: (c) => { setAviso({ tono: 'success', texto: 'Carta guardada.' }); onGuardada(c) },
    onError: (e) => setAviso({ tono: 'error', texto: mensaje(e, 'No se ha podido guardar.') }),
  })
  const borrar = useMutation({ mutationFn: () => borrarCarta(carta!.id), onSuccess: onBorrada })
  const pdf = useMutation({
    mutationFn: async (prueba: boolean) => {
      // La pestaña se abre ya, en el clic: el navegador bloquea las que nacen después de esperar.
      const ventana = window.open('', '_blank')
      try {
        const archivo = await pdfDeCartas(datos, datos.consulta, prueba)
        if (ventana) ventana.location.href = URL.createObjectURL(archivo.blob)
      } catch (e) {
        ventana?.close()
        throw e
      }
    },
    onError: (e) => setAviso({ tono: 'error', texto: mensaje(e, 'No se han podido generar las cartas.') }),
  })

  /** Mete el campo donde está el cursor del texto (o al final). */
  const insertar = (campo: string) => {
    const area = cuerpoRef.current
    const marca = `{{${campo}}}`
    const inicio = area?.selectionStart ?? datos.cuerpo.length
    const fin = area?.selectionEnd ?? datos.cuerpo.length
    cambiar({ cuerpo: datos.cuerpo.slice(0, inicio) + marca + datos.cuerpo.slice(fin) })
    requestAnimationFrame(() => { area?.focus(); area?.setSelectionRange(inicio + marca.length, inicio + marca.length) })
  }

  const opciones = [
    { consulta: ACTIVOS, nombre: 'Todos los hermanos activos' },
    ...(Array.isArray(listas.data) ? listas.data.map((l) => ({ consulta: l.consulta, nombre: `Lista: ${l.nombre}` })) : []),
  ]
  const elegida = opciones.find((o) => o.consulta === datos.consulta)
  const malEscritos = camposDesconocidos(`${datos.asunto} ${datos.cuerpo}`)
  const valida = datos.nombre.trim() !== '' && datos.cuerpo.trim() !== '' && datos.firmaCargo.trim() !== ''
  const n = recuento.data?.total ?? 0

  return (
    <Paper component="section" aria-label={carta ? `Carta ${carta.nombre}` : 'Carta nueva'} sx={{ p: { xs: 2.5, md: 3 } }}>
      <Stack spacing={2.25}>
        <Button size="small" onClick={onVolver} sx={{ display: { md: 'none' }, alignSelf: 'flex-start' }}>Volver a las cartas</Button>
        {aviso && <Alert severity={aviso.tono} onClose={() => setAviso(null)}>{aviso.texto}</Alert>}
        <TextField label="Nombre de la carta" value={datos.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} helperText="Para encontrarla aquí: «Convocatoria del cabildo de cuentas». No sale en la carta." slotProps={{ htmlInput: { maxLength: 120 } }} />

        <TextField select label="A quién va" value={elegida ? datos.consulta : '__otra'} onChange={(e) => e.target.value !== '__otra' && cambiar({ consulta: e.target.value })}
          helperText={recuento.data
            ? `Saldrán ${n} carta${n === 1 ? '' : 's'}${recuento.data.sinDireccion ? `, ${recuento.data.sinDireccion} sin dirección (no caben en el sobre)` : ''}${recuento.data.demasiados ? '. Hay más: afina la búsqueda' : ''}. Nunca a un hermano difunto.`
            : 'Las listas se guardan en Hermanos, con «Guardar esta lista».'}>
          {opciones.map((o) => <MenuItem key={o.consulta} value={o.consulta}>{o.nombre}</MenuItem>)}
          {!elegida && <MenuItem value="__otra">La búsqueda guardada con esta carta</MenuItem>}
        </TextField>

        <TextField label="Asunto" value={datos.asunto} onChange={(e) => cambiar({ asunto: e.target.value })} helperText="En negrita, encima del texto. Puede quedar vacío." slotProps={{ htmlInput: { maxLength: 200 } }} />

        <Box>
          <TextField label="Texto" value={datos.cuerpo} onChange={(e) => cambiar({ cuerpo: e.target.value })} multiline minRows={12} fullWidth inputRef={cuerpoRef}
            helperText="Separa los párrafos con una línea en blanco." slotProps={{ htmlInput: { maxLength: 20000 } }} />
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 1, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">Poner donde está el cursor:</Typography>
            {CAMPOS_DE_CARTA.map((c) => <Chip key={c.campo} size="small" label={`{{${c.campo}}}`} title={c.ayuda} onClick={() => insertar(c.campo)} />)}
          </Stack>
          {malEscritos.length > 0 && <Alert severity="warning" sx={{ mt: 1 }}>No se rellenará: {malEscritos.map((c) => `{{${c}}}`).join(', ')}. Revisa cómo está escrito.</Alert>}
        </Box>

        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          <TextField label="Firma: cargo" value={datos.firmaCargo} onChange={(e) => cambiar({ firmaCargo: e.target.value })} slotProps={{ htmlInput: { maxLength: 80 } }} />
          <TextField label="Firma: nombre (opcional)" value={datos.firmaNombre ?? ''} onChange={(e) => cambiar({ firmaNombre: e.target.value || null })} slotProps={{ htmlInput: { maxLength: 120 } }} />
        </Box>

        <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button variant="contained" disabled={!valida || guardar.isPending} onClick={() => guardar.mutate()}>{guardar.isPending ? 'Guardando…' : 'Guardar'}</Button>
          <Button variant="outlined" disabled={!valida || n === 0 || pdf.isPending} onClick={() => pdf.mutate(true)}>Vista previa</Button>
          <Button variant="outlined" disabled={!valida || n === 0 || pdf.isPending} onClick={() => pdf.mutate(false)}>
            {pdf.isPending ? 'Preparando…' : `Imprimir las ${n} carta${n === 1 ? '' : 's'}`}
          </Button>
          {carta && <Button color="error" disabled={borrar.isPending} onClick={() => borrar.mutate()} sx={{ ml: { sm: 'auto' } }}>Borrar la carta</Button>}
        </Stack>
      </Stack>
    </Paper>
  )
}
