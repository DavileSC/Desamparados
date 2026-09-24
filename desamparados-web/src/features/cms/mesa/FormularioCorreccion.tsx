import { useCallback, useState } from 'react'
import { Alert, Box, Button, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import {
  anularPapeleta, cancelarSolicitud, corregirFicha, corregirPapeleta, corregirSolicitud,
  type FichaDeMesa, type OrigenTunica, type TipoRopa,
} from '../../../lib/api/mesa'
import CampoPrenda from './CampoPrenda'
import DatosPersona from './DatosPersona'
import { leyenda, useDatosPersona } from './datosDeLaFicha'
import { AvisoSituacion, CampoPuesto, type Aviso } from './piezas'
import { NOMBRE_METODO, alturaEnMetros, euros } from './formato'
import { mensajeDeFallo } from './enVivo'

type Tocado = 'CAPIROTE' | 'FARAONA' | 'NINGUNO'

interface Props {
  ficha: FichaDeMesa
  role: string
  puestosUsados: string[]
  onHecho: (aviso: Aviso) => void
  onRecargar: () => void
}

/**
 * Corregir a alguien ya apuntado, desde el listado: si aún no ha recogido, su
 * solicitud (lo que pide, o cancelarla); si ya recogió, su papeleta.
 */
export default function FormularioCorreccion(props: Props) {
  return props.ficha.papeleta ? <CorreccionPapeleta {...props} /> : <CorreccionSolicitud {...props} />
}

/**
 * Una solicitud sin recoger: sus datos, el puesto que pide, las
 * observaciones y, en el Rosario, la voluntad si aún no la ha pagado. O
 * cancelarla: se echa atrás, o se apuntó por error (si pagó, se le devuelve).
 */
function CorreccionSolicitud({ ficha, role, puestosUsados, onHecho, onRecargar }: Props) {
  const solicitud = ficha.solicitud!
  const { datos, setDatos, correccion } = useDatosPersona(ficha)
  const [puesto, setPuesto] = useState(solicitud.puesto)
  const [observaciones, setObservaciones] = useState(solicitud.observaciones ?? '')
  const [donativo, setDonativo] = useState(solicitud.donativo === null ? '' : String(solicitud.donativo).replace('.', ','))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState(false)
  // La voluntad se cambia mientras no esté pagada: en el Rosario, sin recibo todavía.
  const donativoEditable = ficha.salida === 'ROSARIO' && solicitud.pendiente === (solicitud.donativo ?? 0)
  const importeDonativo = donativo.trim() ? Number(donativo.replace(',', '.')) : 0
  const donativoValido = !donativoEditable || (Number.isFinite(importeDonativo) && importeDonativo >= 0 && importeDonativo <= 1000)

  const guardar = async () => {
    setEnviando(true); setError(null)
    try {
      const cambios = correccion()
      if (Object.keys(cambios).length > 0) await corregirFicha(ficha.id, cambios)
      await corregirSolicitud(solicitud.id, {
        puesto: puesto.trim(),
        observaciones: observaciones.trim() || null,
        ...(donativoEditable && { donativo: Math.round(importeDonativo * 100) / 100 }),
      })
      onHecho({ tono: 'success', texto: `Solicitud de ${datos.nombre.trim()} corregida.` })
    } catch (e) {
      setError(mensajeDeFallo(e, 'No se ha podido guardar.'))
    } finally {
      setEnviando(false)
    }
  }

  const cancelar = async () => {
    setCancelando(false)
    setEnviando(true); setError(null)
    try {
      const r = await cancelarSolicitud(solicitud.id)
      onHecho({ tono: 'info', texto: r.message })
    } catch (e) {
      setError(mensajeDeFallo(e, 'No se ha podido cancelar.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Stack spacing={2.25} component="form" onSubmit={(e) => { e.preventDefault(); void guardar() }}>
      <AvisoSituacion ficha={ficha} role={role} onRecargar={onRecargar} />
      <Alert severity="info" icon={false}>
        Apuntado{solicitud.origen === 'WEB' ? ' desde su área' : ' en la mesa'}, sin recoger
        {ficha.requisitos.totalPendiente > 0 ? ` · debe ${euros(ficha.requisitos.totalPendiente)}` : ' · al día'}
      </Alert>

      <DatosPersona datos={datos} onCambiar={setDatos} />

      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, display: 'grid', gap: 1.5 }}>
        <Typography component="legend" sx={leyenda}>Lo que pide</Typography>
        <CampoPuesto valor={puesto} onCambiar={setPuesto} salida={ficha.salida} usados={puestosUsados} />
        {donativoEditable && (
          <TextField size="small" label="Donativo (la voluntad)" value={donativo} onChange={(e) => setDonativo(e.target.value)}
            error={!donativoValido} helperText={donativoValido ? 'En euros. Se cobra en Tesorería.' : 'Un importe entre 0 y 1000 €'} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        )}
        <TextField size="small" label="Observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} multiline minRows={1} maxRows={4} />
        <Typography variant="caption" color="text.secondary">El puesto se confirma y la ropa se da en Túnicas, al recoger.</Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Button color="error" onClick={() => setCancelando(true)} disabled={enviando}>Cancelar solicitud</Button>
        <Button type="submit" variant="contained" disabled={enviando || !puesto.trim() || !donativoValido}>Guardar cambios</Button>
      </Stack>

      <DialogoConfirmacion
        abierto={cancelando}
        titulo="¿Cancelar la solicitud?"
        mensaje={`${ficha.nombre} ${ficha.apellidos} deja de estar apuntado. Si pagó la voluntad, se le devuelve con su apunte en contabilidad.`}
        textoConfirmar="Cancelar solicitud"
        textoCancelar="Volver"
        peligro
        onConfirmar={() => void cancelar()}
        onCancelar={() => setCancelando(false)}
      />
    </Stack>
  )
}

/**
 * Una papeleta ya recogida: sus datos, su puesto y su ropa (la que se cambia
 * vuelve al ropero). También anularla: si se cobró, el recibo queda devuelto
 * con su apunte.
 */
function CorreccionPapeleta({ ficha, role, puestosUsados, onHecho, onRecargar }: Props) {
  const papeleta = ficha.papeleta!
  const { datos, setDatos, correccion } = useDatosPersona(ficha)
  const conRopa = ficha.salida === 'PASION'
  const [puesto, setPuesto] = useState(papeleta.puesto)
  const [origen, setOrigen] = useState<OrigenTunica>(papeleta.origenTunica ?? 'ROPERO')
  const [tunica, setTunica] = useState(papeleta.numTunicaAsignada ?? '')
  const [tocado, setTocado] = useState<Tocado>(papeleta.numFaraonaAsignada ? 'FARAONA' : papeleta.numCapiroteAsignado ? 'CAPIROTE' : 'NINGUNO')
  const [capirote, setCapirote] = useState(papeleta.numCapiroteAsignado ?? '')
  const [faraona, setFaraona] = useState(papeleta.numFaraonaAsignada ?? '')
  const [altura, setAltura] = useState(alturaEnMetros(ficha.alturaHombro))
  const [observaciones, setObservaciones] = useState(papeleta.observaciones ?? '')
  const [crear, setCrear] = useState<Record<TipoRopa, boolean>>({ TUNICA: false, CAPIROTE: false, FARAONA: false })
  const [bloqueos, setBloqueos] = useState<Record<TipoRopa, boolean>>({ TUNICA: false, CAPIROTE: false, FARAONA: false })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [anulando, setAnulando] = useState(false)

  const bloquear = (tipo: TipoRopa, b: boolean) => setBloqueos((actual) => (actual[tipo] === b ? actual : { ...actual, [tipo]: b }))
  const bloqueoTunica = useCallback((b: boolean) => bloquear('TUNICA', b), [])
  const bloqueoCapirote = useCallback((b: boolean) => bloquear('CAPIROTE', b), [])
  const bloqueoFaraona = useCallback((b: boolean) => bloquear('FARAONA', b), [])

  const hayBloqueo = conRopa && ((origen === 'ROPERO' && tunica.trim() && bloqueos.TUNICA)
    || (tocado === 'CAPIROTE' && capirote.trim() && bloqueos.CAPIROTE)
    || (tocado === 'FARAONA' && faraona.trim() && bloqueos.FARAONA))
  const recibo = papeleta.recibo

  const guardar = async () => {
    setEnviando(true); setError(null)
    try {
      const cambios = correccion()
      if (altura !== alturaEnMetros(ficha.alturaHombro)) cambios.alturaHombro = altura.trim() || null
      if (Object.keys(cambios).length > 0) await corregirFicha(ficha.id, cambios)
      await corregirPapeleta(papeleta.id, {
        puesto: puesto.trim(),
        observaciones: observaciones.trim() || null,
        ...(conRopa && {
          origenTunica: origen,
          ...(origen === 'ROPERO' && { numTunicaAsignada: tunica.trim() || null }),
          numCapiroteAsignado: tocado === 'CAPIROTE' ? capirote.trim() || null : null,
          numFaraonaAsignada: tocado === 'FARAONA' ? faraona.trim() || null : null,
          crearPrendas: (Object.keys(crear) as TipoRopa[]).filter((t) => crear[t]),
        }),
      })
      onHecho({ tono: 'success', texto: `Papeleta de ${datos.nombre.trim()} corregida.` })
    } catch (e) {
      setError(mensajeDeFallo(e, 'No se ha podido guardar.'))
    } finally {
      setEnviando(false)
    }
  }

  const anular = async () => {
    setAnulando(false)
    setEnviando(true); setError(null)
    try {
      const r = await anularPapeleta(papeleta.id)
      onHecho({ tono: 'info', texto: r.message })
    } catch (e) {
      setError(mensajeDeFallo(e, 'No se ha podido anular la papeleta.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Stack spacing={2.25} component="form" onSubmit={(e) => { e.preventDefault(); void guardar() }}>
      <AvisoSituacion ficha={ficha} role={role} onRecargar={onRecargar} />
      <Alert severity="success" icon={false}>
        Recogida · {recibo.importe === 0 ? 'sin cobro' : `${euros(recibo.importe)} ${recibo.estado === 'PAGADO' ? `pagado${recibo.metodoPago ? ` en ${NOMBRE_METODO[recibo.metodoPago].toLowerCase()}` : ''}` : recibo.estado.toLowerCase()}`}
        {papeleta.puestoPedido && papeleta.puestoPedido !== papeleta.puesto ? ` · pidió ${papeleta.puestoPedido}` : ''}
      </Alert>

      <DatosPersona datos={datos} onCambiar={setDatos} />

      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, display: 'grid', gap: 1.5 }}>
        <Typography component="legend" sx={leyenda}>{conRopa ? 'Puesto y ropa' : 'Puesto'}</Typography>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }}>
          <CampoPuesto valor={puesto} onCambiar={setPuesto} salida={ficha.salida} usados={puestosUsados} />
          <TextField size="small" label="Talla (hombro)" placeholder="1,45" value={altura} onChange={(e) => setAltura(e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} helperText="En metros" />
        </Box>

        {conRopa && (
          <>
            <ToggleButtonGroup exclusive size="small" fullWidth value={origen} onChange={(_e, v: OrigenTunica | null) => v && setOrigen(v)} aria-label="Túnica">
              <ToggleButton value="ROPERO">Del ropero</ToggleButton>
              <ToggleButton value="PROPIA">Propia</ToggleButton>
              <ToggleButton value="NINGUNA">No lleva</ToggleButton>
            </ToggleButtonGroup>
            {origen === 'ROPERO' && (
              <CampoPrenda tipo="TUNICA" etiqueta="N.º de túnica" valor={tunica} onCambiar={setTunica} hermanoId={ficha.id} crear={crear.TUNICA} onCrear={(c) => setCrear({ ...crear, TUNICA: c })} onBloqueo={bloqueoTunica} />
            )}
            <ToggleButtonGroup exclusive size="small" fullWidth value={tocado} onChange={(_e, v: Tocado | null) => v && setTocado(v)} aria-label="Capirote o faraona">
              <ToggleButton value="CAPIROTE">Capirote</ToggleButton>
              <ToggleButton value="FARAONA">Faraona</ToggleButton>
              <ToggleButton value="NINGUNO">Ninguno</ToggleButton>
            </ToggleButtonGroup>
            {tocado === 'CAPIROTE' && (
              <CampoPrenda tipo="CAPIROTE" etiqueta="N.º de capirote" valor={capirote} onCambiar={setCapirote} hermanoId={ficha.id} crear={crear.CAPIROTE} onCrear={(c) => setCrear({ ...crear, CAPIROTE: c })} onBloqueo={bloqueoCapirote} />
            )}
            {tocado === 'FARAONA' && (
              <CampoPrenda tipo="FARAONA" etiqueta="N.º de faraona" valor={faraona} onCambiar={setFaraona} hermanoId={ficha.id} crear={crear.FARAONA} onCrear={(c) => setCrear({ ...crear, FARAONA: c })} onBloqueo={bloqueoFaraona} />
            )}
          </>
        )}
        <TextField size="small" label="Observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} multiline minRows={1} maxRows={4} />
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Button color="error" onClick={() => setAnulando(true)} disabled={enviando}>Anular papeleta</Button>
        <Button type="submit" variant="contained" disabled={enviando || !puesto.trim() || Boolean(hayBloqueo)}>Guardar cambios</Button>
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
