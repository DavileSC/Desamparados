import { useCallback, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import {
  activarPersona, anularPapeleta, apuntarEnMesa, corregirFicha, corregirPapeleta,
  type Apunte, type CorreccionDeFicha, type FichaDeMesa, type OrigenTunica, type TipoRopa,
} from '../../../lib/api/mesa'
import CampoPrenda from './CampoPrenda'
import { METODOS, NOMBRE_METODO, PUESTOS, alturaEnMetros, diaDe, euros, mensajeDe, puestoDelCatalogo } from './formato'

type Tocado = 'CAPIROTE' | 'FARAONA' | 'NINGUNO'

interface Props {
  ficha: FichaDeMesa
  role: string
  /** Puestos que ya se han dado este año, además de los del catálogo. */
  puestosUsados: string[]
  onHecho: (aviso: string) => void
  onRecargar: () => void
}

const ETIQUETA_SITUACION = { baja: 'está de baja', pendiente: 'tiene el alta pendiente de aprobar' } as const

/** El tocado que se propone: el de la papeleta, el del puesto o el que traía. */
function tocadoInicial(ficha: FichaDeMesa): Tocado {
  const p = ficha.papeleta
  if (p) return p.numFaraonaAsignada ? 'FARAONA' : p.numCapiroteAsignado ? 'CAPIROTE' : 'NINGUNO'
  if (ficha.propuesta.faraona) return 'FARAONA'
  if (ficha.propuesta.capirote) return 'CAPIROTE'
  return puestoDelCatalogo(ficha.propuesta.puesto)?.tocado ?? 'NINGUNO'
}

/**
 * La persona elegida en la mesa: sus datos (se corrigen con ella delante),
 * su puesto, su altura de hombro si va al trono, su túnica —del ropero,
 * propia o ninguna— y su capirote o faraona, con lo que se cobra.
 *
 * Si ya tiene papeleta este año, lo mismo sirve para corregirla o anularla.
 */
export default function FormularioApuntar({ ficha, role, puestosUsados, onHecho, onRecargar }: Props) {
  const papeleta = ficha.papeleta
  const [datos, setDatos] = useState({
    nombre: ficha.nombre,
    primerApellido: ficha.primerApellido ?? ficha.apellidos,
    segundoApellido: ficha.segundoApellido ?? '',
    fechaNacimiento: diaDe(ficha.fechaNacimiento),
    telefono: ficha.telefono ?? '',
    email: ficha.email ?? '',
  })
  const [puesto, setPuesto] = useState(papeleta?.puesto ?? ficha.propuesta.puesto)
  const [origen, setOrigen] = useState<OrigenTunica>(papeleta ? papeleta.origenTunica ?? 'ROPERO' : ficha.propuesta.tunica.origen)
  const [tunica, setTunica] = useState(papeleta ? papeleta.numTunicaAsignada ?? '' : ficha.propuesta.tunica.numero ?? '')
  const [tocado, setTocado] = useState<Tocado>(() => tocadoInicial(ficha))
  const [capirote, setCapirote] = useState(papeleta ? papeleta.numCapiroteAsignado ?? '' : ficha.propuesta.capirote ?? '')
  const [faraona, setFaraona] = useState(papeleta ? papeleta.numFaraonaAsignada ?? '' : ficha.propuesta.faraona ?? '')
  const [altura, setAltura] = useState(alturaEnMetros(ficha.alturaHombro))
  const [observaciones, setObservaciones] = useState(papeleta?.observaciones ?? '')
  const [metodo, setMetodo] = useState<Apunte['metodoPago']>('EFECTIVO')
  const [crear, setCrear] = useState<Record<TipoRopa, boolean>>({ TUNICA: false, CAPIROTE: false, FARAONA: false })
  const [bloqueos, setBloqueos] = useState<Record<TipoRopa, boolean>>({ TUNICA: false, CAPIROTE: false, FARAONA: false })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [anulando, setAnulando] = useState(false)

  // Estables: cada campo de prenda avisa con ellas desde un efecto.
  const bloquear = (tipo: TipoRopa, b: boolean) => setBloqueos((actual) => (actual[tipo] === b ? actual : { ...actual, [tipo]: b }))
  const bloqueoTunica = useCallback((b: boolean) => bloquear('TUNICA', b), [])
  const bloqueoCapirote = useCallback((b: boolean) => bloquear('CAPIROTE', b), [])
  const bloqueoFaraona = useCallback((b: boolean) => bloquear('FARAONA', b), [])

  const catalogo = puestoDelCatalogo(puesto)
  const conAltura = catalogo?.alturaHombro || ficha.alturaHombro !== null || altura !== ''
  const activa = ficha.situacion === 'activo'
  const puedeActivar = role === 'ADMIN' || role === 'SECRETARIA'
  const total = ficha.precios.papeleta + (origen === 'ROPERO' ? ficha.precios.alquiler : 0)
  const hayBloqueo = (origen === 'ROPERO' && tunica.trim() && bloqueos.TUNICA)
    || (tocado === 'CAPIROTE' && capirote.trim() && bloqueos.CAPIROTE)
    || (tocado === 'FARAONA' && faraona.trim() && bloqueos.FARAONA)
  // Corrigiendo, la túnica solo se cambia dentro del ropero: pasar a propia cambia lo cobrado.
  const origenFijo = papeleta !== null

  const elegirPuesto = (nuevo: string) => {
    setPuesto(nuevo)
    if (origenFijo) return
    const c = puestoDelCatalogo(nuevo)
    if (!c) return
    setTocado(c.tocado ?? 'NINGUNO')
    if (!c.tunica) setOrigen('NINGUNA')
    else if (origen === 'NINGUNA') setOrigen(ficha.tieneTunicaPropia ? 'PROPIA' : 'ROPERO')
  }

  /** Solo lo que la mesa ha cambiado de la ficha. */
  const correccion = (): CorreccionDeFicha => {
    const c: CorreccionDeFicha = {}
    if (datos.nombre.trim() !== ficha.nombre) c.nombre = datos.nombre.trim()
    if (datos.primerApellido.trim() !== (ficha.primerApellido ?? ficha.apellidos)) c.primerApellido = datos.primerApellido.trim()
    if (datos.segundoApellido.trim() !== (ficha.segundoApellido ?? '')) c.segundoApellido = datos.segundoApellido.trim() || null
    if (datos.fechaNacimiento !== diaDe(ficha.fechaNacimiento)) c.fechaNacimiento = datos.fechaNacimiento
    if (datos.telefono.trim() !== (ficha.telefono ?? '')) c.telefono = datos.telefono.trim() || null
    if (datos.email.trim() !== (ficha.email ?? '')) c.email = datos.email.trim() || null
    // Corrigiendo, la altura va a la ficha por aquí; apuntando, con la papeleta.
    if (papeleta && altura !== alturaEnMetros(ficha.alturaHombro)) c.alturaHombro = altura.trim() || null
    return c
  }

  const crearPrendas = (): TipoRopa[] => (Object.keys(crear) as TipoRopa[]).filter((t) => crear[t])

  const guardar = async () => {
    setEnviando(true); setError(null)
    try {
      const cambios = correccion()
      if (Object.keys(cambios).length > 0) await corregirFicha(ficha.id, cambios)

      if (papeleta) {
        await corregirPapeleta(papeleta.id, {
          puesto: puesto.trim(),
          observaciones: observaciones.trim() || null,
          ...(origen === 'ROPERO' && { numTunicaAsignada: tunica.trim() || null }),
          numCapiroteAsignado: tocado === 'CAPIROTE' ? capirote.trim() || null : null,
          numFaraonaAsignada: tocado === 'FARAONA' ? faraona.trim() || null : null,
          crearPrendas: crearPrendas(),
        })
        onHecho(`Papeleta de ${datos.nombre.trim()} corregida.`)
      } else {
        const r = await apuntarEnMesa({
          hermanoId: ficha.id,
          ...(ficha.cita && { citaId: ficha.cita.id }),
          metodoPago: metodo,
          puesto: puesto.trim(),
          ...(observaciones.trim() && { observaciones: observaciones.trim() }),
          origenTunica: origen,
          ...(origen === 'ROPERO' && tunica.trim() && { numTunicaAsignada: tunica.trim() }),
          ...(tocado === 'CAPIROTE' && capirote.trim() && { numCapiroteAsignado: capirote.trim() }),
          ...(tocado === 'FARAONA' && faraona.trim() && { numFaraonaAsignada: faraona.trim() }),
          ...(altura.trim() && { alturaHombro: altura.trim() }),
          crearPrendas: crearPrendas(),
        })
        const importe = Number(r.data.recibo.importe)
        onHecho(`${datos.nombre.trim()} ${datos.primerApellido.trim()}, apuntado como ${puesto.trim()}: ${importe === 0 ? 'sin cobro' : `${euros(importe)} en ${NOMBRE_METODO[metodo].toLowerCase()}`}.`)
      }
    } catch (e: unknown) {
      setError(mensajeDe(e, 'No se ha podido guardar.'))
    } finally {
      setEnviando(false)
    }
  }

  const anular = async () => {
    setAnulando(false)
    if (!papeleta) return
    setEnviando(true); setError(null)
    try {
      const r = await anularPapeleta(papeleta.id)
      onHecho(r.message)
    } catch (e: unknown) {
      setError(mensajeDe(e, 'No se ha podido anular la papeleta.'))
    } finally {
      setEnviando(false)
    }
  }

  const activar = async () => {
    setEnviando(true); setError(null)
    try {
      await activarPersona(ficha.id)
      onRecargar()
    } catch (e: unknown) {
      setError(mensajeDe(e, 'No se ha podido poner en activo.'))
    } finally {
      setEnviando(false)
    }
  }

  const campo = (clave: keyof typeof datos, etiqueta: string, extra: object = {}) => (
    <TextField size="small" fullWidth label={etiqueta} value={datos[clave]} onChange={(e) => setDatos({ ...datos, [clave]: e.target.value })} {...extra} />
  )
  const opciones = [...new Set([...PUESTOS.map((p) => p.nombre), ...puestosUsados])]

  return (
    <Stack spacing={2.25} component="form" onSubmit={(e) => { e.preventDefault(); void guardar() }}>
      {!activa && (
        <Alert
          severity="warning"
          action={puedeActivar && <Button color="inherit" size="small" onClick={() => void activar()} disabled={enviando}>{ficha.situacion === 'baja' ? 'Reactivar' : 'Aprobar alta'}</Button>}
        >
          {ficha.nombre} {ETIQUETA_SITUACION[ficha.situacion as 'baja' | 'pendiente']}.
          {puedeActivar ? ' Ponla en activo para apuntarla.' : ' Para apuntarla, Secretaría tiene que ponerla en activo.'}
        </Alert>
      )}
      {papeleta && (
        <Alert severity="info">
          Ya tiene papeleta de {papeleta.year}: {papeleta.puesto}, {papeleta.recibo.importe === 0 ? 'sin cobro' : `${euros(papeleta.recibo.importe)}${papeleta.recibo.metodoPago ? ` en ${NOMBRE_METODO[papeleta.recibo.metodoPago].toLowerCase()}` : ''}`}. Aquí se corrige.
        </Alert>
      )}
      {!papeleta && ficha.cita && <Alert severity="success" icon={false}>Pidió día de reparto: viene con cita.</Alert>}
      {!papeleta && ficha.anterior && (
        <Typography variant="body2" color="text.secondary">
          En {ficha.anterior.year}: {ficha.anterior.puesto}
          {ficha.anterior.numTunicaAsignada && ` · túnica ${ficha.anterior.numTunicaAsignada}`}
          {ficha.anterior.origenTunica === 'PROPIA' && ' · túnica propia'}
          {ficha.anterior.numCapiroteAsignado && ` · capirote ${ficha.anterior.numCapiroteAsignado}`}
          {ficha.anterior.numFaraonaAsignada && ` · faraona ${ficha.anterior.numFaraonaAsignada}`}
        </Typography>
      )}

      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, display: 'grid', gap: 1.5, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <Typography component="legend" sx={{ gridColumn: '1 / -1', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', mb: 1 }}>Datos</Typography>
        <Box sx={{ gridColumn: '1 / -1' }}>{campo('nombre', 'Nombre', { required: true })}</Box>
        {campo('primerApellido', 'Primer apellido', { required: true })}
        {campo('segundoApellido', 'Segundo apellido')}
        {campo('fechaNacimiento', 'Nacimiento', { type: 'date', required: true, slotProps: { inputLabel: { shrink: true } } })}
        {campo('telefono', 'Teléfono', { slotProps: { htmlInput: { inputMode: 'tel' } } })}
        <Box sx={{ gridColumn: '1 / -1' }}>{campo('email', 'Correo', { type: 'email' })}</Box>
      </Box>

      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, display: 'grid', gap: 1.5 }}>
        <Typography component="legend" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', mb: 1 }}>Procesión</Typography>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: conAltura ? 'minmax(0, 2fr) minmax(0, 1fr)' : '1fr' }}>
          <Autocomplete
            freeSolo
            autoSelect
            options={opciones}
            value={puesto}
            onChange={(_e, nuevo) => elegirPuesto(nuevo ?? '')}
            onInputChange={(_e, texto, motivo) => { if (motivo === 'input') elegirPuesto(texto) }}
            renderInput={(params) => <TextField {...params} size="small" label="Puesto" required />}
          />
          {conAltura && (
            <TextField size="small" label="Talla (hombro)" placeholder="1,45" value={altura} onChange={(e) => setAltura(e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} helperText="En metros" />
          )}
        </Box>

        <Box>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.75 }}>Túnica</Typography>
          <ToggleButtonGroup exclusive size="small" fullWidth value={origen} onChange={(_e, v: OrigenTunica | null) => v && setOrigen(v)} disabled={origenFijo} aria-label="Túnica">
            <ToggleButton value="ROPERO">Del ropero</ToggleButton>
            <ToggleButton value="PROPIA">Propia</ToggleButton>
            <ToggleButton value="NINGUNA">No lleva</ToggleButton>
          </ToggleButtonGroup>
          {origenFijo && <Typography variant="caption" color="text.secondary">Pasar de túnica propia a la del ropero cambia lo cobrado: para eso, anula y vuelve a apuntar.</Typography>}
        </Box>
        {origen === 'ROPERO' && (
          <CampoPrenda
            tipo="TUNICA" etiqueta="N.º de túnica" valor={tunica} onCambiar={setTunica} hermanoId={ficha.id}
            crear={crear.TUNICA} onCrear={(c) => setCrear({ ...crear, TUNICA: c })} onBloqueo={bloqueoTunica}
          />
        )}

        <Box>
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.75 }}>Capirote o faraona</Typography>
          <ToggleButtonGroup exclusive size="small" fullWidth value={tocado} onChange={(_e, v: Tocado | null) => v && setTocado(v)} aria-label="Capirote o faraona">
            <ToggleButton value="CAPIROTE">Capirote</ToggleButton>
            <ToggleButton value="FARAONA">Faraona</ToggleButton>
            <ToggleButton value="NINGUNO">Ninguno</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {tocado === 'CAPIROTE' && (
          <CampoPrenda
            tipo="CAPIROTE" etiqueta="N.º de capirote" valor={capirote} onCambiar={setCapirote} hermanoId={ficha.id}
            crear={crear.CAPIROTE} onCrear={(c) => setCrear({ ...crear, CAPIROTE: c })} onBloqueo={bloqueoCapirote}
          />
        )}
        {tocado === 'FARAONA' && (
          <CampoPrenda
            tipo="FARAONA" etiqueta="N.º de faraona" valor={faraona} onCambiar={setFaraona} hermanoId={ficha.id}
            crear={crear.FARAONA} onCrear={(c) => setCrear({ ...crear, FARAONA: c })} onBloqueo={bloqueoFaraona}
          />
        )}

        <TextField size="small" label="Observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} multiline minRows={1} maxRows={4} />
      </Box>

      {!papeleta && (
        <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, display: 'grid', gap: 1 }}>
          <Typography component="legend" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary', mb: 1 }}>Cobro</Typography>
          <Typography variant="body2" color="text.secondary">
            Papeleta {euros(ficha.precios.papeleta)}{origen === 'ROPERO' ? ` + alquiler de túnica ${euros(ficha.precios.alquiler)}` : ''}
          </Typography>
          <ToggleButtonGroup exclusive size="small" fullWidth value={metodo} onChange={(_e, v: Apunte['metodoPago'] | null) => v && setMetodo(v)} aria-label="Forma de pago">
            {METODOS.map((m) => <ToggleButton key={m.valor} value={m.valor}>{m.etiqueta}</ToggleButton>)}
          </ToggleButtonGroup>
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        {papeleta
          ? <Button color="error" onClick={() => setAnulando(true)} disabled={enviando}>Anular papeleta</Button>
          : <span />}
        <Button type="submit" variant="contained" size="large" disabled={enviando || !activa || !puesto.trim() || Boolean(hayBloqueo)}>
          {papeleta ? 'Guardar cambios' : total === 0 ? 'Apuntar' : `Apuntar y cobrar ${euros(total)}`}
        </Button>
      </Stack>

      <DialogoConfirmacion
        abierto={anulando}
        titulo="¿Anular la papeleta?"
        mensaje={`Se anula la papeleta de ${ficha.nombre} ${ficha.apellidos}. Si se cobró, el recibo queda devuelto con su apunte en contabilidad, y la ropa del ropero vuelve a estar libre.`}
        textoConfirmar="Anular"
        peligro
        onConfirmar={() => void anular()}
        onCancelar={() => setAnulando(false)}
      />
    </Stack>
  )
}
