import { useState } from 'react'
import { Alert, Box, Button, CircularProgress, FormControlLabel, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import CabeceraSeccion from './CabeceraSeccion'
import { CLAVE_ESTADO_DE_LA_WEB, estadoDeLaWeb, guardarEstadoDeLaWeb, TOPE_MENSAJE_PROXIMAMENTE, type EstadoDeLaWeb } from '../../lib/api/web'
import { ErrorDeApi } from '../../lib/api/cliente'
import { MENSAJE_DE_SIEMPRE } from '../proximamente/ProximamentePage'
import { site } from '../../config/site'

interface Formulario { abierta: boolean; mensaje: string; fecha: string }

const aFormulario = (e: EstadoDeLaWeb): Formulario => ({ abierta: e.abierta, mensaje: e.mensaje ?? '', fecha: e.fecha ?? '' })
const aEstado = (f: Formulario): EstadoDeLaWeb => ({ abierta: f.abierta, mensaje: f.mensaje.trim() || null, fecha: f.fecha || null })

/**
 * Sistema › Abrir la web: dejarla en «Próximamente» o abrirla al público. El
 * botón dice lo que va a pasar («Cerrar la web», «Abrir la web») porque es lo
 * único de esta pantalla que se nota fuera: el texto y el día solo se ven con
 * la web cerrada.
 */
export default function WebAbiertaPage() {
  const cliente = useQueryClient()
  // La misma consulta que la web pública: al guardar, el marco público y el
  // aviso de la Junta se enteran sin recargar.
  const { data, isPending, isError } = useQuery({ queryKey: CLAVE_ESTADO_DE_LA_WEB, queryFn: estadoDeLaWeb, staleTime: 0 })
  const [formulario, setFormulario] = useState<Formulario | null>(null)
  const [copiado, setCopiado] = useState<EstadoDeLaWeb | undefined>(undefined)

  const guardar = useMutation({
    mutationFn: (f: Formulario) => guardarEstadoDeLaWeb(aEstado(f)),
    onSuccess: (guardado) => cliente.setQueryData(CLAVE_ESTADO_DE_LA_WEB, guardado),
  })

  // Lo del servidor pasa al formulario al pintar, como en Datos de la corporación.
  if (data && data !== copiado) {
    setCopiado(data)
    setFormulario(aFormulario(data))
    return null
  }

  if (isPending || !formulario) return <CircularProgress aria-label="Cargando si la web está abierta" />
  if (isError || !data) return <Alert severity="error">No se ha podido saber si la web está abierta. Inténtalo de nuevo en unos minutos.</Alert>

  const original = aFormulario(data)
  const cambiaApertura = formulario.abierta !== original.abierta
  const sinGuardar = cambiaApertura || formulario.mensaje.trim() !== original.mensaje || formulario.fecha !== original.fecha
  const delServidor = guardar.error instanceof ErrorDeApi ? guardar.error.fields : {}
  const textoBoton = guardar.isPending ? 'Guardando…' : cambiaApertura ? (formulario.abierta ? 'Abrir la web' : 'Cerrar la web') : 'Guardar'

  const cambiar = (cambio: Partial<Formulario>) => {
    setFormulario((f) => (f ? { ...f, ...cambio } : f))
    guardar.reset()
  }

  return (
    <>
      <Helmet><title>{`Abrir la web | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <CabeceraSeccion titulo="Abrir la web" subtitulo="Con la web cerrada, quien entra ve «Próximamente». Vosotros, con la sesión del CMS abierta, la seguís viendo entera." />
      <Box component="form" noValidate onSubmit={(e) => { e.preventDefault(); guardar.mutate(formulario) }}>
        <Stack spacing={3} sx={{ maxWidth: 760 }}>
          <Paper variant="outlined" component="section" aria-label="Estado de la web" sx={{ p: { xs: 2, md: 3 }, display: 'grid', gap: 1 }}>
            <Typography variant="h3" component="h2" sx={{ fontSize: 22 }}>
              {data.abierta ? 'Ahora está abierta' : 'Ahora está cerrada'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {data.abierta
                ? 'Cualquiera ve la web entera y los buscadores la recorren.'
                : 'El público ve «Próximamente» y los buscadores no guardan nada. Siguen abiertos los textos legales, la baja del boletín, la vuelta de un pago y el área de hermanos.'}
            </Typography>
            {data.siempreAbiertaAqui && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Estás en {window.location.hostname}, que se ve siempre entera aunque la cierres. Este interruptor abre y cierra el dominio principal.
              </Alert>
            )}
            <FormControlLabel
              sx={{ mt: 1 }}
              control={<Switch checked={formulario.abierta} onChange={(e) => cambiar({ abierta: e.target.checked })} />}
              label="Web abierta al público"
            />
          </Paper>

          <Paper variant="outlined" component="section" aria-label="Próximamente" sx={{ p: { xs: 2, md: 3 }, display: 'grid', gap: 2 }}>
            <Stack spacing={0.75}>
              <Typography variant="h3" component="h2" sx={{ fontSize: 22 }}>«Próximamente»</Typography>
              <Typography variant="body2" color="text.secondary">Lo que dice mientras la web está cerrada.</Typography>
            </Stack>
            <TextField
              label="Texto"
              multiline
              minRows={3}
              value={formulario.mensaje}
              onChange={(e) => cambiar({ mensaje: e.target.value })}
              placeholder={MENSAJE_DE_SIEMPRE}
              error={Boolean(delServidor.mensaje)}
              helperText={delServidor.mensaje ?? `Vacío, sale el de siempre. ${formulario.mensaje.length}/${TOPE_MENSAJE_PROXIMAMENTE}`}
              slotProps={{ htmlInput: { maxLength: TOPE_MENSAJE_PROXIMAMENTE } }}
            />
            <TextField
              label="Día de la presentación"
              type="date"
              value={formulario.fecha}
              onChange={(e) => cambiar({ fecha: e.target.value })}
              error={Boolean(delServidor.fecha)}
              helperText={delServidor.fecha ?? 'Si aún no se sabe, déjalo vacío.'}
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ maxWidth: 260 }}
            />
          </Paper>

          {guardar.isError && <Alert severity="error">{guardar.error.message}</Alert>}
          {guardar.isSuccess && !sinGuardar && (
            <Alert severity="success">{data.abierta ? 'Guardado: la web está abierta al público.' : 'Guardado: el público ya ve «Próximamente».'}</Alert>
          )}
          <Stack direction="row" sx={{ justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" disabled={!sinGuardar || guardar.isPending}>{textoBoton}</Button>
          </Stack>
        </Stack>
      </Box>
    </>
  )
}
