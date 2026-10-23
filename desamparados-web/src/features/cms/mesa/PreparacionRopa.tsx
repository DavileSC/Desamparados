import { useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined'
import { useQuery } from '@tanstack/react-query'
import { cingulosDeLaMesa, ropaPorPreparar } from '../../../lib/api/mesa'
import { turnosDeReparto } from '../../../lib/api/procesion'
import { useColoresContabilidad } from '../contabilidad/tema'
import { cabeceraTabla } from '../inventario/tabla'
import Pildora from '../listados/Pildora'
import { CLAVE_MESA } from './enVivo'
import { alturaEnMetros, fechaCorta } from './formato'
import { Dato, DatosDeFicha, Ficha, ListaDeFichas } from '../listados/Fichas'
import { useEnFichas } from '../listados/useEnFichas'
import { useAhora } from '../../../hooks/useAhora'

const formatoDia = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long' })
const tenue = { color: 'text.disabled' } as const

/**
 * La ropa que hay que tener preparada antes de cada día de reparto, sacada de
 * las solicitudes: quién viene, qué puesto pidió, su talla, y la túnica y el
 * capirote o la faraona que se le proponen (lo que tiene en casa o lo del año
 * pasado), y el cíngulo. Se imprime y se prepara en el ropero con tiempo,
 * para que el día del reparto solo haya que probar y entregar. Si los
 * cíngulos que harán falta son más que los que quedan, lo avisa: hay que
 * pedir o hacer más antes del reparto.
 */
export default function PreparacionRopa({ salida }: { salida: string }) {
  const { fondoCabecera } = useColoresContabilidad()
  const [turnoId, setTurnoId] = useState<number | ''>('')
  const turnos = useQuery({ queryKey: [...CLAVE_MESA, 'turnos', salida], queryFn: () => turnosDeReparto(salida) })
  const lista = useQuery({
    queryKey: [...CLAVE_MESA, 'preparacion', salida, turnoId],
    queryFn: () => ropaPorPreparar(salida, turnoId === '' ? undefined : turnoId),
  })
  const cingulos = useQuery({ queryKey: [...CLAVE_MESA, 'cingulos'], queryFn: cingulosDeLaMesa })

  const hoy = new Date(useAhora()); hoy.setHours(0, 0, 0, 0)
  const proximos = (turnos.data ?? []).filter((t) => new Date(t.horaFin) >= hoy).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
  const filas = lista.data ?? []
  const hacenFaltaCingulos = filas.filter((f) => f.propuesta.cingulo === 'PRESTADO').length
  const quedanCingulos = cingulos.data?.enElRopero ?? null
  const enFichas = useEnFichas()
  const propuestaDe = (f: (typeof filas)[number]) => {
    const t = f.propuesta.tunica
    return {
      tunica: t.origen === 'PROPIA' ? 'Propia' : t.origen === 'NINGUNA' ? 'No lleva' : t.numero ? `${t.numero}${f.tallaTunica ? ` (${f.tallaTunica})` : ''}${t.porTalla ? ' · por su talla' : ''}` : 'Buscar una',
      tocado: f.propuesta.capirote ?? (f.propuesta.faraona && `${f.propuesta.faraona} (faraona)`),
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center', displayPrint: 'none' }}>
        <TextField select size="small" label="Día de reparto" value={turnoId} onChange={(e) => setTurnoId(e.target.value === '' ? '' : Number(e.target.value))} sx={{ minWidth: 260 }}>
          <MenuItem value="">Todos los que faltan por recoger</MenuItem>
          {proximos.map((t) => <MenuItem key={t.id} value={t.id}>{formatoDia.format(new Date(t.fecha))} · {t.citas - t.vinieron} con cita</MenuItem>)}
        </TextField>
        <Button startIcon={<PrintOutlinedIcon />} onClick={() => window.print()} disabled={filas.length === 0}>Imprimir</Button>
        <Typography variant="body2" color="text.secondary">{filas.length} {filas.length === 1 ? 'persona' : 'personas'}</Typography>
      </Stack>

      {lista.data && quedanCingulos !== null && hacenFaltaCingulos > 0 && (
        <Alert severity={hacenFaltaCingulos > quedanCingulos ? 'warning' : 'info'} sx={{ displayPrint: 'none' }}>
          Cíngulos: harán falta {hacenFaltaCingulos}{turnoId === '' ? '' : ' ese día'} y en el ropero {quedanCingulos === 1 ? 'queda 1' : `quedan ${quedanCingulos}`}.
          {hacenFaltaCingulos > quedanCingulos && ` Faltan ${hacenFaltaCingulos - quedanCingulos}: hay que pedir o hacer más.`}
        </Alert>
      )}
      {lista.isError && <Alert severity="error">No se ha podido cargar la ropa por preparar.</Alert>}
      {lista.isLoading && <CircularProgress aria-label="Cargando la ropa por preparar" />}

      {lista.data && enFichas && (
        <ListaDeFichas etiqueta="Ropa por preparar" vacia={filas.length === 0 ? `No hay ropa por preparar${turnoId === '' ? '' : ' para ese día'}.` : undefined}>
          {filas.map((f) => {
            const { tunica, tocado } = propuestaDe(f)
            return (
              <Ficha
                key={f.solicitudId}
                titulo={<>
                  <Typography component="span" sx={{ display: 'block', fontWeight: 600 }}>{f.hermano.nombre} {f.hermano.apellidos}</Typography>
                  <Typography component="span" variant="body2" color="text.secondary">{f.puesto}{turnoId === '' ? ` · ${f.dia ? formatoDia.format(new Date(f.dia)) : 'sin cita'}` : ''}</Typography>
                </>}
                acciones={f.cuotasPendientes > 0 ? <Box sx={{ mt: 0.5, mr: 1 }}><Pildora texto={`Debe ${f.cuotasPendientes}`} tono="aviso" /></Box> : undefined}
              >
                <DatosDeFicha>
                  <Dato etiqueta="Nacimiento">{fechaCorta(f.hermano.fechaNacimiento)}</Dato>
                  <Dato etiqueta="Talla">{f.hermano.alturaHombro ? alturaEnMetros(f.hermano.alturaHombro) : '—'}</Dato>
                  <Dato etiqueta="Túnica">{tunica}</Dato>
                  <Dato etiqueta="Capirote / faraona">{tocado || '—'}</Dato>
                  <Dato etiqueta="Cíngulo">{f.propuesta.cingulo === 'PRESTADO' ? 'Del ropero' : f.propuesta.cingulo === 'PROPIO' ? 'Propio' : 'No lleva'}</Dato>
                </DatosDeFicha>
              </Ficha>
            )
          })}
        </ListaDeFichas>
      )}

      {lista.data && !enFichas && (
        <TableContainer component={Paper}>
          <Table size="small" aria-label="Ropa por preparar" sx={{ minWidth: 980, '& td': { whiteSpace: 'nowrap' } }}>
            <TableHead>
              <TableRow sx={cabeceraTabla(fondoCabecera)}>
                <TableCell>Nombre</TableCell>
                <TableCell>Nacimiento</TableCell>
                {turnoId === '' && <TableCell>Día</TableCell>}
                <TableCell>Puesto</TableCell>
                <TableCell align="right">Talla</TableCell>
                <TableCell>Túnica</TableCell>
                <TableCell>Capirote / faraona</TableCell>
                <TableCell>Cíngulo</TableCell>
                <TableCell>Cuotas</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filas.map((f) => {
                const t = f.propuesta.tunica
                const { tunica, tocado } = propuestaDe(f)
                return (
                  <TableRow key={f.solicitudId}>
                    <TableCell sx={{ fontWeight: 600 }}>{f.hermano.nombre} {f.hermano.apellidos}</TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{fechaCorta(f.hermano.fechaNacimiento)}</TableCell>
                    {turnoId === '' && <TableCell sx={!f.dia ? tenue : undefined}>{f.dia ? formatoDia.format(new Date(f.dia)) : 'Sin cita'}</TableCell>}
                    <TableCell>{f.puesto}</TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', ...(!f.hermano.alturaHombro && tenue) }}>{f.hermano.alturaHombro ? alturaEnMetros(f.hermano.alturaHombro) : '—'}</TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums', ...(t.origen === 'ROPERO' && !t.numero && { color: 'warning.main' }) }}>{tunica}</TableCell>
                    <TableCell sx={{ fontVariantNumeric: 'tabular-nums', ...(!tocado && tenue) }}>{tocado || '—'}</TableCell>
                    <TableCell sx={f.propuesta.cingulo !== 'PRESTADO' ? tenue : undefined}>{f.propuesta.cingulo === 'PRESTADO' ? 'Del ropero' : f.propuesta.cingulo === 'PROPIO' ? 'Propio' : 'No lleva'}</TableCell>
                    <TableCell>{f.cuotasPendientes > 0 ? <Pildora texto={`Debe ${f.cuotasPendientes}`} tono="aviso" /> : <Box component="span" sx={tenue}>Al día</Box>}</TableCell>
                  </TableRow>
                )
              })}
              {filas.length === 0 && (
                <TableRow><TableCell colSpan={9} sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>No hay ropa por preparar{turnoId === '' ? '' : ' para ese día'}.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  )
}
