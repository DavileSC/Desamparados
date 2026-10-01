import { useState } from 'react'
import {
  Alert, Box, Button, Chip, CircularProgress, FormControlLabel, Paper, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  enviarCertificados, euros182, guardarConfiguracionModelo182, justificantePorDefecto, resumenModelo182, traerCertificados, traerFicheroModelo182,
  type ConfiguracionModelo182,
} from '../../../lib/api/modelo182'
import { guardarEnDisco } from '../../../lib/api/datos'
import VentanaFormulario from '../VentanaFormulario'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
/** El último año cerrado: el 182 se presenta en enero del año siguiente. */
const anioPorDefecto = () => new Date().getFullYear() - 1

interface Props {
  /** Administración y Tesorería cambian los datos del Grupo; el Hermano Mayor los ve. */
  puedeCambiar: boolean
}

/**
 * El Modelo 182: quién se declara del ejercicio y por cuánto, el fichero para
 * la Sede de Hacienda y los certificados de donativos para los donantes. Los
 * datos del Grupo (su NIF, quién firma) se guardan aquí y no se publican.
 */
export default function Modelo182({ puedeCambiar }: Props) {
  const cliente = useQueryClient()
  const [ejercicio, setEjercicio] = useState(anioPorDefecto)
  const [texto, setTexto] = useState(String(anioPorDefecto()))
  const [justificante, setJustificante] = useState(justificantePorDefecto(anioPorDefecto()))
  const [editando, setEditando] = useState<ConfiguracionModelo182 | null>(null)
  const [errorDatos, setErrorDatos] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [confirmarEnvio, setConfirmarEnvio] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)

  const { data: r, error: errorCarga, isFetching } = useQuery({ queryKey: ['modelo182', ejercicio], queryFn: () => resumenModelo182(ejercicio) })

  const cambiarAnio = (valor: string) => {
    setTexto(valor)
    // Al cambiar de ejercicio, el justificante propuesto es el de ese año.
    if (/^\d{4}$/.test(valor)) { setEjercicio(Number(valor)); setJustificante(justificantePorDefecto(Number(valor))) }
  }

  const descargar = async (clave: string, traer: () => Promise<{ blob: Blob; nombre: string | null }>, porDefecto: string) => {
    setOcupado(clave)
    setError(null)
    try { guardarEnDisco(await traer(), porDefecto) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido descargar.')) }
    finally { setOcupado(null) }
  }

  const guardarDatos = async () => {
    if (!editando) return
    setGuardando(true)
    setErrorDatos(null)
    try {
      await guardarConfiguracionModelo182({ ...editando, nif: editando.nif?.trim() || null })
      setEditando(null)
      await cliente.invalidateQueries({ queryKey: ['modelo182'] })
    } catch (err: unknown) { setErrorDatos(mensaje(err, 'No se han podido guardar los datos.')) }
    finally { setGuardando(false) }
  }

  const enviar = async () => {
    if (!r) return
    setOcupado('enviar')
    setError(null)
    try {
      const resultado = await enviarCertificados(r.ejercicio)
      setAviso(resultado.message)
      setConfirmarEnvio(false)
      await cliente.invalidateQueries({ queryKey: ['modelo182'] })
    } catch (err: unknown) { setError(mensaje(err, 'No se han podido mandar los certificados.')); setConfirmarEnvio(false) }
    finally { setOcupado(null) }
  }

  const conCorreo = r?.declarados.filter((d) => d.email).length ?? 0
  const justificanteValido = /^182\d{10}$/.test(justificante)

  return (
    <Stack spacing={3}>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 760 }}>
        La declaración de donativos del año para Hacienda (se presenta en enero) y los certificados para que cada donante desgrave.
        Entran los donativos pagados{r?.configuracion.cuotas ? ' y las cuotas de hermano' : ''}, y los donativos y apadrinamientos en línea de quien pidió certificado.
        Lo pagado por una salida (papeleta o donativo del Rosario) no entra: tiene contraprestación.
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'center' } }}>
        <TextField label="Ejercicio" size="small" value={texto} onChange={(e) => cambiarAnio(e.target.value)} sx={{ width: 120 }} slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 4 } }} />
        {r && <Button variant="outlined" onClick={() => { setErrorDatos(null); setEditando({ ...r.configuracion, nif: r.configuracion.nif ?? '' }) }}>{puedeCambiar ? 'Datos del Grupo' : 'Ver datos del Grupo'}</Button>}
        {isFetching && <CircularProgress size={20} aria-label="Cargando" />}
      </Stack>

      {errorCarga && !r && <Alert severity="error">{mensaje(errorCarga, 'No se ha podido preparar el Modelo 182.')}</Alert>}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {aviso && <Alert severity="success" onClose={() => setAviso(null)}>{aviso}</Alert>}

      {r && <>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
          {[
            ['Donantes declarados', String(r.declarados.length)],
            ['Total declarado', euros182(r.total)],
            ['Sin poder declarar', String(r.excluidos.length)],
            ['Donativos anónimos', r.anonimos.cuantos ? `${r.anonimos.cuantos} · ${euros182(r.anonimos.centimos)}` : '0'],
          ].map(([etiqueta, valor]) => (
            <Paper key={etiqueta} sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">{etiqueta}</Typography>
              <Typography sx={{ fontSize: 22, fontWeight: 700 }}>{valor}</Typography>
            </Paper>
          ))}
        </Box>

        <Paper sx={{ p: 2.5 }}>
          <Typography component="h2" sx={{ fontWeight: 600, mb: 1 }}>Presentar en Hacienda</Typography>
          {r.faltaParaElFichero.length > 0
            ? <Alert severity="warning">Para sacar el fichero falta {r.faltaParaElFichero.join(', ')}. Ponlo en «Datos del Grupo».</Alert>
            : <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' } }}>
              <TextField label="Número de justificante" size="small" value={justificante} onChange={(e) => setJustificante(e.target.value.replace(/\D/g, '').slice(0, 13))}
                error={!justificanteValido} helperText="13 cifras que empiezan por 182. Si presentas otra vez el mismo año, usa otro número." sx={{ maxWidth: 320 }} />
              <Button variant="contained" disabled={!justificanteValido || r.declarados.length === 0 || ocupado !== null}
                onClick={() => void descargar('fichero', () => traerFicheroModelo182(r.ejercicio, justificante), `modelo182-${r.ejercicio}.txt`)}>
                {ocupado === 'fichero' ? 'Preparando…' : 'Descargar el fichero'}
              </Button>
            </Stack>}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            En la Sede electrónica de la Agencia Tributaria: Modelo 182 → «Presentación mediante fichero». Hace falta el certificado digital del Grupo o de quien lo represente.
          </Typography>
        </Paper>

        {r.excluidos.length > 0 && (
          <Alert severity="warning">
            <strong>No se pueden declarar ({r.excluidos.length}):</strong> sin un NIF no hay deducción. Corrige la ficha y vuelve a mirar.
            <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
              {r.excluidos.slice(0, 30).map((e, i) => <li key={`${e.nombre}-${i}`}>{e.nombre} · {euros182(e.centimos)} · {e.motivo}</li>)}
            </Box>
          </Alert>
        )}

        <Paper sx={{ p: 2.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 1.5 }}>
            <Typography component="h2" sx={{ fontWeight: 600 }}>Donantes del {r.ejercicio}</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="outlined" disabled={r.declarados.length === 0 || !r.configuracion.nif || ocupado !== null}
                onClick={() => void descargar('todos', () => traerCertificados(r.ejercicio), `certificados-donativos-${r.ejercicio}.pdf`)}>
                {ocupado === 'todos' ? 'Preparando…' : 'Todos los certificados (PDF)'}
              </Button>
              {puedeCambiar && (
                <Button variant="contained" disabled={conCorreo === 0 || !r.configuracion.nif || ocupado !== null} onClick={() => setConfirmarEnvio(true)}>
                  Mandarlos por correo ({conCorreo})
                </Button>
              )}
            </Stack>
          </Stack>
          {r.enviados && (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Ya se mandaron el {new Date(r.enviados.el).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} ({r.enviados.cuantos}). Mandarlos otra vez llega a todos de nuevo.
            </Alert>
          )}
          {!r.configuracion.nif && r.declarados.length > 0 && <Alert severity="info" sx={{ mb: 1.5 }}>Los certificados llevan el NIF del Grupo: ponlo en «Datos del Grupo» para sacarlos.</Alert>}
          {r.declarados.length === 0
            ? <Typography color="text.secondary">No hay donativos con NIF en {r.ejercicio}.</Typography>
            : <TableContainer>
              <Table size="small" aria-label={`Donantes del ${r.ejercicio}`}>
                <TableHead>
                  <TableRow>
                    <TableCell>Donante</TableCell>
                    <TableCell>NIF</TableCell>
                    <TableCell align="right">Importe</TableCell>
                    <TableCell align="right">Deducción</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {r.declarados.map((d) => (
                    <TableRow key={d.nif}>
                      <TableCell>
                        {d.nombre}
                        {d.nifRepresentante && <Typography variant="body2" color="text.secondary">Menor de 14: representante {d.nifRepresentante}</Typography>}
                        {d.provinciaSupuesta && <Typography variant="body2" color="warning.main">Sin código postal: se declara en la provincia del Grupo</Typography>}
                      </TableCell>
                      <TableCell>{d.nif}</TableCell>
                      <TableCell align="right">{euros182(d.centimos)}</TableCell>
                      <TableCell align="right">
                        {d.porcentaje} %{d.recurrente && <Chip size="small" label="Recurrente" sx={{ ml: 1 }} />}
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" disabled={!r.configuracion.nif || ocupado !== null}
                          onClick={() => void descargar(d.nif, () => traerCertificados(r.ejercicio, d.nif), `certificado-${d.nif}-${r.ejercicio}.pdf`)}>
                          {ocupado === d.nif ? '…' : 'Certificado'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>}
        </Paper>
      </>}

      <DialogoConfirmacion
        abierto={confirmarEnvio}
        titulo="Mandar los certificados por correo"
        mensaje={`Se manda a cada donante de ${r?.ejercicio ?? ''} con correo (${conCorreo}) su certificado en PDF. Los que no tienen correo se descargan y se entregan a mano.`}
        textoConfirmar={ocupado === 'enviar' ? 'Mandando…' : 'Mandar'}
        onConfirmar={() => void enviar()}
        onCancelar={() => setConfirmarEnvio(false)}
      />

      <VentanaFormulario
        abierto={editando !== null}
        titulo="Datos del Grupo para el Modelo 182"
        textoGuardar="Guardar"
        sucio={editando !== null && JSON.stringify({ ...editando, nif: editando.nif || null }) !== JSON.stringify(r?.configuracion)}
        guardando={guardando}
        puedeGuardar={puedeCambiar}
        error={errorDatos}
        onGuardar={guardarDatos}
        onCerrar={() => setEditando(null)}
      >
        {editando && <>
          <Typography variant="body2" color="text.secondary">Se guardan aquí, en la base de datos del Grupo: no salen en la web.</Typography>
          <TextField label="NIF del Grupo" value={editando.nif ?? ''} onChange={(e) => setEditando({ ...editando, nif: e.target.value.toUpperCase() })} disabled={!puedeCambiar} fullWidth slotProps={{ htmlInput: { maxLength: 12 } }} />
          <TextField label="Teléfono de contacto con Hacienda" value={editando.telefono} onChange={(e) => setEditando({ ...editando, telefono: e.target.value })} disabled={!puedeCambiar} fullWidth helperText="Nueve cifras" />
          <TextField label="Persona de contacto (apellidos y nombre)" value={editando.contacto} onChange={(e) => setEditando({ ...editando, contacto: e.target.value })} disabled={!puedeCambiar} fullWidth />
          <TextField label="Quién firma los certificados" value={editando.firmanteNombre} onChange={(e) => setEditando({ ...editando, firmanteNombre: e.target.value })} disabled={!puedeCambiar} fullWidth />
          <TextField label="Su cargo" value={editando.firmanteCargo} onChange={(e) => setEditando({ ...editando, firmanteCargo: e.target.value })} disabled={!puedeCambiar} fullWidth helperText="Secretario, Tesorero…" />
          <FormControlLabel control={<Switch checked={editando.cuotas} onChange={(e) => setEditando({ ...editando, cuotas: e.target.checked })} disabled={!puedeCambiar} />}
            label="Declarar las cuotas de hermano como donativo (art. 17 de la Ley 49/2002)" />
        </>}
      </VentanaFormulario>
    </Stack>
  )
}
