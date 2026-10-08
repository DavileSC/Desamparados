import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControlLabel, MenuItem, Paper, Stack, Switch, TextField, Typography,
} from '@mui/material'
import { Link } from 'react-router-dom'
import { impagos, type HermanoConImpagos } from '../../../lib/api/tesoreria'
import { darDeBajaHermano } from '../../../lib/api/hermanos'
import { usePaginacion } from '../../../hooks/usePaginacion'
import Paginador from '../../../components/Paginador'
import type { MetaPaginacion } from '../../../lib/api/tipos'

interface Props {
  /** Secretaría, Hermano Mayor y administración dan la baja; Tesorería solo mira. */
  puedeDarDeBaja: boolean
}

const euros = (valor: number) => valor.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
/** El día de hoy en Madrid, AAAA-MM-DD ('en-CA' formatea justo así). */
const hoyEnMadrid = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date())

/**
 * Quién debe cuotas: hermanos activos con cuotas pendientes o devueltas, de
 * quien más debe a quien menos. Desde aquí Secretaría da la baja por impago
 * sin tener que buscar la ficha; la baja lleva su motivo y un correo que lo dice.
 */
export default function ListaImpagos({ puedeDarDeBaja }: Props) {
  const [incluirAnioActual, setIncluirAnioActual] = useState(false)
  const [minimo, setMinimo] = useState(1)
  const [filas, setFilas] = useState<HermanoConImpagos[]>([])
  const [meta, setMeta] = useState<MetaPaginacion | null>(null)
  const [anioActual, setAnioActual] = useState(new Date().getFullYear())
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const { pagina, porPagina, irAPagina, cambiarTamano } = usePaginacion('Impagos')

  const [porDarDeBaja, setPorDarDeBaja] = useState<HermanoConImpagos | null>(null)
  const [fechaBaja, setFechaBaja] = useState('')
  const [trabajando, setTrabajando] = useState(false)
  // Guarda síncrona: un doble clic en «Dar de baja» llegaría antes que el estado.
  const enMarcha = useRef(false)

  const cargar = useCallback((vigente: () => boolean = () => true) =>
    impagos({ incluirAnioActual, minimo }, { pagina, porPagina }).then((respuesta) => {
      if (!vigente()) return
      setFilas(respuesta.data)
      setMeta(respuesta.meta)
      setAnioActual(respuesta.anioActual)
    }), [incluirAnioActual, minimo, pagina, porPagina])

  // «Cargando» es que la consulta de ahora aún no ha contestado: deducido al
  // pintar, sin un efecto que lo encienda (y un pintado de más) en cada cambio.
  const consulta = JSON.stringify([incluirAnioActual, minimo, pagina, porPagina])
  const [contestada, setContestada] = useState<string | null>(null)
  const cargando = contestada !== consulta
  useEffect(() => {
    let cancelado = false
    cargar(() => !cancelado)
      .catch((e: unknown) => { if (!cancelado) setError(e instanceof Error ? e.message : 'No se ha podido cargar la lista de impagos.') })
      .finally(() => { if (!cancelado) setContestada(consulta) })
    return () => { cancelado = true }
  }, [cargar, consulta])

  const abrirBaja = (fila: HermanoConImpagos) => { setFechaBaja(hoyEnMadrid()); setPorDarDeBaja(fila) }

  const darDeBaja = async () => {
    if (!porDarDeBaja || enMarcha.current) return
    enMarcha.current = true
    setTrabajando(true)
    setError(null)
    setAviso(null)
    try {
      await darDeBajaHermano(porDarDeBaja.hermano.id, fechaBaja, 'IMPAGO')
      setAviso(`${porDarDeBaja.hermano.nombre} ${porDarDeBaja.hermano.apellidos} ha causado baja por impago.`)
      setPorDarDeBaja(null)
      await cargar()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido dar de baja al hermano.')
      setPorDarDeBaja(null)
    } finally {
      enMarcha.current = false
      setTrabajando(false)
    }
  }

  const fechaValida = !!fechaBaja && fechaBaja <= hoyEnMadrid()

  return (
    <Paper sx={{ p: { xs: 2, md: 3 } }}>
      <Typography sx={{ color: 'text.secondary', mb: 2, maxWidth: '72ch' }}>
        Hermanos activos con cuotas pendientes o devueltas por el banco. Los recibos que están en el banco
        cobrándose (remesados) no cuentan.
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2, alignItems: { sm: 'center' } }}>
        <FormControlLabel
          control={<Switch checked={incluirAnioActual} onChange={(e) => { setIncluirAnioActual(e.target.checked); irAPagina(1) }} />}
          label={`Contar también la cuota de ${anioActual}`}
        />
        <TextField
          select
          size="small"
          label="Cuotas sin pagar"
          value={minimo}
          onChange={(e) => { setMinimo(Number(e.target.value)); irAPagina(1) }}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value={1}>Al menos una</MenuItem>
          <MenuItem value={2}>Dos o más</MenuItem>
          <MenuItem value={3}>Tres o más</MenuItem>
        </TextField>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {aviso && <Alert severity="success" sx={{ mb: 2 }}>{aviso}</Alert>}

      {cargando ? <CircularProgress aria-label="Cargando los impagos" /> : filas.length === 0 ? (
        <Typography sx={{ py: 3 }}>Nadie debe cuotas con estos filtros.</Typography>
      ) : (
        <Box component="ul" aria-label="Hermanos con cuotas sin pagar" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {filas.map((fila) => (
            <Box
              component="li"
              key={fila.hermano.id}
              sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 1.75, borderTop: 1, borderColor: 'divider' }}
            >
              <Box sx={{ minWidth: 0, flex: '1 1 260px' }}>
                <Typography sx={{ fontWeight: 600 }}>
                  {puedeDarDeBaja
                    ? <Box component={Link} to={`/cms/hermanos?ficha=${fila.hermano.id}`} sx={{ color: 'inherit' }}>{fila.hermano.apellidos}, {fila.hermano.nombre}</Box>
                    : <>{fila.hermano.apellidos}, {fila.hermano.nombre}</>}
                  {fila.hermano.numeroHermano !== null && (
                    <Box component="span" sx={{ fontWeight: 400, color: 'text.secondary' }}> · n.º {fila.hermano.numeroHermano}</Box>
                  )}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {fila.cuotas.map((c) => `${c.year}${c.estado === 'DEVUELTO' ? ' (devuelta)' : ''}`).join(', ')}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{euros(fila.total)}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {fila.cuotas.length === 1 ? '1 cuota' : `${fila.cuotas.length} cuotas`}
                  </Typography>
                </Box>
                {puedeDarDeBaja && (
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    disabled={trabajando}
                    onClick={() => abrirBaja(fila)}
                    aria-label={`Dar de baja por impago a ${fila.hermano.nombre} ${fila.hermano.apellidos}`}
                  >
                    Dar de baja
                  </Button>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      )}
      {meta && <Paginador meta={meta} onPagina={irAPagina} onTamano={cambiarTamano} etiqueta="impagos" />}

      <Dialog open={porDarDeBaja !== null} onClose={() => { if (!trabajando) setPorDarDeBaja(null) }} aria-labelledby="dialogo-baja-impago">
        <DialogTitle id="dialogo-baja-impago">
          ¿Dar de baja por impago a {porDarDeBaja?.hermano.nombre} {porDarDeBaja?.hermano.apellidos}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Debe {porDarDeBaja ? euros(porDarDeBaja.total) : ''}. Sale del censo y pierde su número; si era el último perfil
            activo de su cuenta, la cuenta queda bloqueada. Se le enviará un correo diciendo que la baja es por no constar el
            pago de sus cuotas. Los recibos no se tocan: siguen pendientes por si se pone al corriente.
          </DialogContentText>
          <TextField
            label="Fecha de baja"
            type="date"
            value={fechaBaja}
            onChange={(e) => setFechaBaja(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hoyEnMadrid() } }}
            helperText="Por defecto, hoy. No puede ser posterior a hoy."
            error={!!fechaBaja && !fechaValida}
            fullWidth
            sx={{ mt: 3 }}
          />
        </DialogContent>
        <DialogActions>
          <Button disabled={trabajando} onClick={() => setPorDarDeBaja(null)}>Volver</Button>
          <Button variant="contained" color="error" disabled={trabajando || !fechaValida} onClick={() => void darDeBaja()}>
            {trabajando ? 'Dando de baja…' : 'Dar de baja por impago'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
