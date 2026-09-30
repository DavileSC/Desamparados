import { useCallback, useEffect, useState } from 'react'
import { Alert, AlertTitle, Box, Button, Chip, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import DownloadIcon from '@mui/icons-material/Download'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import {
  cobrarRemesa, estadoRemesas, esAnioCompleto, generarRemesa, previaRemesa, traerFicheroRemesa,
  type EstadoRemesas, type FiltroRemesa, type PreviaRemesa, type ReceiptType, type Remesa,
} from '../../../lib/api/tesoreria'
import { guardarEnDisco } from '../../../lib/api/datos'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import VentanaFormulario from '../VentanaFormulario'
import { euros } from '../contabilidad/formato'
import ExtractoNorma43 from './ExtractoNorma43'

const TIPOS: Record<ReceiptType, string> = {
  CUOTA_HERMANO: 'Cuotas de hermano', PAPELETA_SITIO: 'Papeletas de sitio', DONATIVO: 'Donativos', OTRO: 'Otros',
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** «2026-10-05» → «5 oct 2026», sin pasar por Date: es un día, no un instante. */
const dia = (texto: string) => `${Number(texto.slice(8, 10))} ${MESES[Number(texto.slice(5, 7)) - 1]} ${texto.slice(0, 4)}`

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

interface Filtro { fechaCobro: string; year: string; tipo: ReceiptType | '' }

const aFiltro = (f: Filtro): FiltroRemesa => ({
  fechaCobro: f.fechaCobro,
  ...(esAnioCompleto(f.year) ? { year: Number(f.year) } : {}),
  ...(f.tipo ? { tipo: f.tipo } : {}),
})

/**
 * Remesas SEPA: se juntan los recibos pendientes de quienes domicilian, se
 * genera el fichero y Tesorería lo sube a la banca en línea. Cuando el banco
 * carga los adeudos, la remesa se da por cobrada. Las devoluciones y el cobro
 * pueden salir también del extracto del banco (Norma 43), sin marcarlos a mano.
 */
export default function Remesas() {
  const [estado, setEstado] = useState<EstadoRemesas | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [abierta, setAbierta] = useState(false)
  const [filtro, setFiltro] = useState<Filtro>({ fechaCobro: '', year: '', tipo: '' })
  const [previa, setPrevia] = useState<PreviaRemesa | null>(null)
  const [errorPrevia, setErrorPrevia] = useState<string | null>(null)
  const [calculando, setCalculando] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [errorGenerar, setErrorGenerar] = useState<string | null>(null)
  const [ocupada, setOcupada] = useState<number | null>(null)
  const [aCobrar, setACobrar] = useState<Remesa | null>(null)
  const [extracto, setExtracto] = useState(false)

  const cargar = useCallback(() => estadoRemesas().then(setEstado), [])
  useEffect(() => {
    let cancelado = false
    estadoRemesas()
      .then((e) => { if (!cancelado) setEstado(e) })
      .catch((err: unknown) => { if (!cancelado) setError(mensaje(err, 'No se han podido cargar las remesas.')) })
    return () => { cancelado = true }
  }, [])

  // La vista previa se pide sola al cambiar los filtros, cuando se deja de
  // teclear; una respuesta que llega tarde no pisa a la última.
  const { fechaCobro, year, tipo } = filtro
  useEffect(() => {
    if (!abierta || !fechaCobro || (year && !esAnioCompleto(year))) return
    let cancelado = false
    const temporizador = setTimeout(() => {
      setCalculando(true); setErrorPrevia(null)
      previaRemesa(aFiltro({ fechaCobro, year, tipo }))
        .then((p) => { if (!cancelado) setPrevia(p) })
        .catch((err: unknown) => { if (!cancelado) { setPrevia(null); setErrorPrevia(mensaje(err, 'No se ha podido preparar la remesa.')) } })
        .finally(() => { if (!cancelado) setCalculando(false) })
    }, 300)
    return () => { cancelado = true; clearTimeout(temporizador) }
  }, [abierta, fechaCobro, year, tipo])

  const abrir = () => {
    setFiltro({ fechaCobro: estado?.fechaCobroMinima ?? '', year: String(new Date().getFullYear()), tipo: 'CUOTA_HERMANO' })
    setPrevia(null); setErrorPrevia(null); setErrorGenerar(null); setAbierta(true)
  }

  const descargar = async (remesa: Pick<Remesa, 'id' | 'mensajeId'>) => {
    setOcupada(remesa.id); setError(null)
    try { guardarEnDisco(await traerFicheroRemesa(remesa.id), `${remesa.mensajeId.toLowerCase()}.xml`) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido descargar el fichero.')) }
    finally { setOcupada(null) }
  }

  const generar = async () => {
    setGenerando(true); setErrorGenerar(null); setAviso(null)
    let remesa: Awaited<ReturnType<typeof generarRemesa>>
    try { remesa = await generarRemesa(aFiltro(filtro)) }
    catch (err: unknown) { setErrorGenerar(mensaje(err, 'No se ha podido generar la remesa.')); return }
    finally { setGenerando(false) }
    setAbierta(false)
    setAviso(`Remesa generada: ${remesa.numRecibos} ${remesa.numRecibos === 1 ? 'recibo' : 'recibos'} por ${euros(remesa.total)}, al cobro el ${dia(remesa.fechaCobro)}. Sube el fichero a la banca en línea.`)
    await descargar(remesa)
    await cargar().catch(() => undefined)
  }

  const cobrar = async () => {
    if (!aCobrar) return
    const remesa = aCobrar
    setACobrar(null); setOcupada(remesa.id); setError(null); setAviso(null)
    try { setAviso((await cobrarRemesa(remesa.id)).message); await cargar() }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido dar la remesa por cobrada.')) }
    finally { setOcupada(null) }
  }

  if (!estado) return error ? <Alert severity="error">{error}</Alert> : <CircularProgress aria-label="Cargando remesas" />

  const fechaValida = Boolean(fechaCobro) && fechaCobro >= estado.fechaCobroMinima
  return <>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, alignItems: { sm: 'center' } }}>
      <Box sx={{ flexGrow: 1 }}>
        <Typography variant="h4">Remesas de adeudos</Typography>
        <Typography variant="body2" color="text.secondary">
          Junta los recibos pendientes de quienes domicilian y genera el fichero para subirlo a la banca en línea.
        </Typography>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ flexShrink: 0, '& .MuiButton-root': { whiteSpace: 'nowrap' } }}>
        <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => { setAviso(null); setExtracto(true) }}>Extracto del banco</Button>
        <Button variant="contained" startIcon={<AccountBalanceIcon />} onClick={abrir} disabled={!estado.configurada}>Nueva remesa</Button>
      </Stack>
    </Stack>

    {!estado.configurada && (
      <Alert severity="warning" sx={{ mb: 3 }}>
        <AlertTitle>Faltan los datos del Grupo como acreedor</AlertTitle>
        Para generar remesas, quien administra el servidor tiene que poner los datos que da el banco al contratar los adeudos:
        <Box component="ul" sx={{ m: 0, mt: 1, pl: 2.5 }}>{estado.problemas.map((p) => <li key={p}>{p}</li>)}</Box>
      </Alert>
    )}
    {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
    {aviso && <Alert severity="success" sx={{ mb: 3 }}>{aviso}</Alert>}

    {estado.remesas.length === 0
      ? <Alert severity="info">Todavía no hay remesas.</Alert>
      : (
        <Paper component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {estado.remesas.map((r, i) => (
            <Box
              component="li"
              key={r.id}
              sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, px: 2.5, py: 2, borderTop: i === 0 ? 'none' : '1px solid', borderColor: 'divider' }}
            >
              <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>Al cobro el {dia(r.fechaCobro)}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                  {r.mensajeId}{r.autorNombre ? ` · ${r.autorNombre}` : ''}
                </Typography>
              </Box>
              <Box sx={{ flex: '0 0 auto', textAlign: { sm: 'right' } }}>
                <Typography sx={{ fontWeight: 600 }}>{euros(r.total)}</Typography>
                <Typography variant="body2" color="text.secondary">{r.numRecibos} {r.numRecibos === 1 ? 'recibo' : 'recibos'}</Typography>
              </Box>
              <Chip
                size="small"
                label={r.estado === 'COBRADA' ? 'Cobrada' : 'En el banco'}
                color={r.estado === 'COBRADA' ? 'success' : 'info'}
                variant={r.estado === 'COBRADA' ? 'filled' : 'outlined'}
              />
              <Stack direction="row" spacing={1}>
                <Button size="small" startIcon={<DownloadIcon />} onClick={() => void descargar(r)} disabled={ocupada === r.id}>Fichero</Button>
                {r.estado === 'ENVIADA' && (
                  <Button size="small" variant="outlined" onClick={() => setACobrar(r)} disabled={ocupada === r.id}>Dar por cobrada</Button>
                )}
              </Stack>
            </Box>
          ))}
        </Paper>
      )}

    <VentanaFormulario
      abierto={abierta}
      titulo="Nueva remesa"
      textoGuardar="Generar y descargar"
      sucio={false}
      guardando={generando}
      puedeGuardar={fechaValida && !calculando && (previa?.numRecibos ?? 0) > 0}
      error={errorGenerar}
      onGuardar={generar}
      onCerrar={() => setAbierta(false)}
    >
      <Typography variant="body2" color="text.secondary">
        Entran los recibos pendientes de los hermanos que domicilian. Pasan a «Remesado» hasta que el banco los cobre o los devuelva.
      </Typography>
      <TextField
        label="Fecha de cobro"
        type="date"
        value={fechaCobro}
        onChange={(e) => setFiltro({ ...filtro, fechaCobro: e.target.value })}
        slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: estado.fechaCobroMinima } }}
        helperText={`El día en que el banco carga los adeudos. Como pronto, el ${dia(estado.fechaCobroMinima)}, y en día laborable.`}
        fullWidth
      />
      <TextField
        label="Año de los recibos"
        type="number"
        value={year}
        onChange={(e) => setFiltro({ ...filtro, year: e.target.value })}
        helperText={year ? undefined : 'Vacío: todos los años'}
        fullWidth
      />
      <TextField select label="Recibos" value={tipo} onChange={(e) => setFiltro({ ...filtro, tipo: e.target.value as ReceiptType | '' })} fullWidth>
        <MenuItem value="">Todos</MenuItem>
        {(Object.keys(TIPOS) as ReceiptType[]).map((t) => <MenuItem key={t} value={t}>{TIPOS[t]}</MenuItem>)}
      </TextField>

      {calculando && <CircularProgress size={24} aria-label="Calculando la remesa" />}
      {!calculando && errorPrevia && <Alert severity="warning">{errorPrevia}</Alert>}
      {!calculando && previa && !errorPrevia && <>
        <Alert severity={previa.numRecibos > 0 ? 'info' : 'warning'}>
          {previa.numRecibos > 0
            ? `${previa.numRecibos} ${previa.numRecibos === 1 ? 'recibo' : 'recibos'} por ${euros(previa.total)}.`
            : 'Con estos filtros no hay ningún recibo que mandar al banco.'}
        </Alert>
        {previa.excluidos.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {previa.excluidos.length === 1 ? 'Se queda fuera 1 recibo (sigue pendiente):' : `Se quedan fuera ${previa.excluidos.length} recibos (siguen pendientes):`}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5, maxHeight: 200, overflowY: 'auto' }}>
              {previa.excluidos.map((x) => (
                <Typography component="li" variant="body2" key={x.reciboId}>
                  {x.hermano.apellidos}, {x.hermano.nombre}{x.hermano.numeroHermano !== null ? ` (n.º ${x.hermano.numeroHermano})` : ''} · {euros(x.importe)} · {x.texto}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
      </>}
    </VentanaFormulario>

    <ExtractoNorma43
      abierto={extracto}
      onCerrar={() => setExtracto(false)}
      onAplicado={(texto) => { setExtracto(false); setAviso(texto); void cargar().catch(() => undefined) }}
    />

    <DialogoConfirmacion
      abierto={aCobrar !== null}
      titulo="Dar la remesa por cobrada"
      mensaje={aCobrar
        ? `${aCobrar.enElBanco === 1 ? 'El recibo que sigue' : `Los ${aCobrar.enElBanco} recibos que siguen`} en el banco ${aCobrar.enElBanco === 1 ? 'pasa' : 'pasan'} a pagados y se apunta su ingreso en Contabilidad. Si el banco devolvió alguno, márcalo antes como devuelto (a mano o subiendo el extracto del banco).`
        : ''}
      textoConfirmar="Dar por cobrada"
      onConfirmar={() => void cobrar()}
      onCancelar={() => setACobrar(null)}
    />
  </>
}
