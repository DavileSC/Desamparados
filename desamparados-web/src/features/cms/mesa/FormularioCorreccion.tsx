import { useCallback, useState } from 'react'
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import {
  anularPapeleta, cancelarSolicitud, corregirFicha, corregirPapeleta, corregirSolicitud,
  type CinguloEnMesa, type FichaDeMesa, type OrigenTunica, type TipoRopa,
} from '../../../lib/api/mesa'
import type { Salida } from '../../../lib/api/salidas'
import CampoCingulo from './CampoCingulo'
import CampoPrenda from './CampoPrenda'
import DatosPersona from './DatosPersona'
import { leyenda, useDatosPersona } from './datosDeLaFicha'
import { AvisoSituacion, CampoPuesto, type Aviso } from './piezas'
import { NOMBRE_METODO, alturaEnMetros, euros } from './formato'
import { mensajeDeFallo } from './enVivo'

type Tocado = 'CAPIROTE' | 'FARAONA' | 'NINGUNO'

/** Dos campos por fila; el primero, algo más ancho. */
const dosColumnas = { display: 'grid', gap: 1.5, gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', alignItems: 'start' } as const

interface Props {
  ficha: FichaDeMesa
  salida: Salida
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
 * observaciones y, en las salidas de donativo, la voluntad si aún no la ha pagado. O
 * cancelarla: se echa atrás, o se apuntó por error (si pagó, se le devuelve).
 */
function CorreccionSolicitud({ ficha, salida, role, puestosUsados, onHecho, onRecargar }: Props) {
  const solicitud = ficha.solicitud!
  const { datos, setDatos, correccion, contactoCompleto } = useDatosPersona(ficha)
  const [puesto, setPuesto] = useState(solicitud.puesto)
  const [observaciones, setObservaciones] = useState(solicitud.observaciones ?? '')
  const [donativo, setDonativo] = useState(solicitud.donativo === null ? '' : String(solicitud.donativo).replace('.', ','))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelando, setCancelando] = useState(false)
  // La voluntad se cambia mientras no esté pagada: en las de donativo, sin recibo todavía.
  const donativoEditable = salida.cobro === 'DONATIVO' && solicitud.pendiente === (solicitud.donativo ?? 0)
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
    <Stack spacing={1.5} component="form" onSubmit={(e) => { e.preventDefault(); void guardar() }}>
      <AvisoSituacion ficha={ficha} role={role} onRecargar={onRecargar} />
      <Alert severity="info" icon={false} sx={{ py: 0 }}>
        Apuntado{solicitud.origen === 'WEB' ? ' desde su área' : ' en la mesa'}, sin recoger
        {ficha.requisitos.totalPendiente > 0 ? ` · debe ${euros(ficha.requisitos.totalPendiente)}` : ' · al día'}
      </Alert>

      <DatosPersona datos={datos} onCambiar={setDatos} plegados contactoCompleto={contactoCompleto} />

      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, display: 'grid', gap: 1.5 }}>
        <Typography component="legend" sx={leyenda}>Lo que pide</Typography>
        <CampoPuesto valor={puesto} onCambiar={setPuesto} puestos={salida.puestos} usados={puestosUsados} />
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
 * vuelve al ropero), con el cíngulo: si se le debía, se le da aquí cuando lo
 * haya. También anularla: si se cobró, el recibo queda devuelto con su apunte.
 */
function CorreccionPapeleta({ ficha, salida, role, puestosUsados, onHecho, onRecargar }: Props) {
  const papeleta = ficha.papeleta!
  const { datos, setDatos, correccion, contactoCompleto } = useDatosPersona(ficha)
  const conRopa = salida.conRopa
  const [puesto, setPuesto] = useState(papeleta.puesto)
  const [origen, setOrigen] = useState<OrigenTunica>(papeleta.origenTunica ?? 'ROPERO')
  const [tunica, setTunica] = useState(papeleta.numTunicaAsignada ?? '')
  const [tocado, setTocado] = useState<Tocado>(papeleta.numFaraonaAsignada ? 'FARAONA' : papeleta.numCapiroteAsignado ? 'CAPIROTE' : 'NINGUNO')
  const [capirote, setCapirote] = useState(papeleta.numCapiroteAsignado ?? '')
  const [faraona, setFaraona] = useState(papeleta.numFaraonaAsignada ?? '')
  // El devuelto ya no se toca aquí; el de antes de contar cíngulos (sin dato), tampoco si no se elige.
  const cinguloEditable = conRopa && papeleta.cingulo !== 'DEVUELTO'
  const cinguloAntes: CinguloEnMesa | null = papeleta.cingulo === 'DEVUELTO' ? null : papeleta.cingulo
  const cinguloInicial: CinguloEnMesa = cinguloAntes ?? (papeleta.origenTunica === 'ROPERO' ? 'PRESTADO' : papeleta.origenTunica === 'PROPIA' ? 'PROPIO' : 'NINGUNO')
  const [cingulo, setCingulo] = useState<CinguloEnMesa>(cinguloInicial)
  // Prestarlo no gasta uno del ropero si ya lo tiene con esta papeleta o trae otro sin devolver.
  const cinguloSinGastar = papeleta.cingulo === 'PRESTADO' || ficha.cingulosSinDevolver.some((c) => c.papeletaId !== papeleta.id)
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
          // Solo si se ha tocado: en las papeletas de antes (sin dato) no se inventa nada.
          ...(cinguloEditable && cingulo !== cinguloInicial && { cingulo }),
        }),
      })
      onHecho({ tono: 'success', texto: `Papeleta de ${datos.nombre.trim()} corregida.` })
    } catch (e) {
      setError(mensajeDeFallo(e, 'No se ha podido guardar.'))
    } finally {
      setEnviando(false)
    }
  }

  // Se le debía y ya hay: se le da sin tocar nada más.
  const darCingulo = async () => {
    setEnviando(true); setError(null)
    try {
      await corregirPapeleta(papeleta.id, { cingulo: 'PRESTADO' })
      onHecho({ tono: 'success', texto: `${datos.nombre.trim()} ya tiene su cíngulo.` })
    } catch (e) {
      setError(mensajeDeFallo(e, 'No se ha podido dar el cíngulo.'))
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
    <Stack spacing={1.5} component="form" onSubmit={(e) => { e.preventDefault(); void guardar() }}>
      <AvisoSituacion ficha={ficha} role={role} onRecargar={onRecargar} />
      <Alert severity="success" icon={false} sx={{ py: 0 }}>
        Recogida · {recibo.importe === 0 ? 'sin cobro' : `${euros(recibo.importe)} ${recibo.estado === 'PAGADO' ? `pagado${recibo.metodoPago ? ` en ${NOMBRE_METODO[recibo.metodoPago].toLowerCase()}` : ''}` : recibo.estado.toLowerCase()}`}
        {papeleta.puestoPedido && papeleta.puestoPedido !== papeleta.puesto ? ` · pidió ${papeleta.puestoPedido}` : ''}
      </Alert>

      {conRopa && papeleta.cingulo === 'DEBIDO' && (
        <Alert
          severity="warning"
          action={<Button color="inherit" size="small" onClick={() => void darCingulo()} disabled={enviando || ficha.cingulos.enElRopero <= 0}>Dárselo ahora</Button>}
        >
          Se le debe el cíngulo: no quedaban al recoger.{ficha.cingulos.enElRopero <= 0 ? ' Sigue sin haber en el ropero.' : ''}
        </Alert>
      )}

      <DatosPersona datos={datos} onCambiar={setDatos} plegados contactoCompleto={contactoCompleto} />

      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, display: 'grid', gap: 1.25 }}>
        <Typography component="legend" sx={leyenda}>{conRopa ? 'Puesto y ropa' : 'Puesto'}</Typography>
        <Box sx={dosColumnas}>
          <CampoPuesto valor={puesto} onCambiar={setPuesto} puestos={salida.puestos} usados={puestosUsados} />
          <TextField size="small" label="Talla (m)" placeholder="1,45" value={altura} onChange={(e) => setAltura(e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        </Box>

        {/* Cada prenda en una fila (de dónde sale y su número): así el panel cabe sin bajar. */}
        {conRopa && (
          <>
            <Box sx={dosColumnas}>
              <TextField select size="small" label="Túnica" value={origen} onChange={(e) => setOrigen(e.target.value as OrigenTunica)}>
                <MenuItem value="ROPERO">Del ropero</MenuItem>
                <MenuItem value="PROPIA">Propia</MenuItem>
                <MenuItem value="NINGUNA">No lleva</MenuItem>
              </TextField>
              {origen === 'ROPERO' && (
                <CampoPrenda tipo="TUNICA" etiqueta="N.º de túnica" asignada={papeleta.numTunicaAsignada} valor={tunica} onCambiar={setTunica} hermanoId={ficha.id} salida={ficha.salida} crear={crear.TUNICA} onCrear={(c) => setCrear({ ...crear, TUNICA: c })} onBloqueo={bloqueoTunica} />
              )}
            </Box>
            <Box sx={dosColumnas}>
              <TextField select size="small" label="Capirote o faraona" value={tocado} onChange={(e) => setTocado(e.target.value as Tocado)}>
                <MenuItem value="CAPIROTE">Capirote</MenuItem>
                <MenuItem value="FARAONA">Faraona</MenuItem>
                <MenuItem value="NINGUNO">Ninguno</MenuItem>
              </TextField>
              {tocado === 'CAPIROTE' && (
                <CampoPrenda tipo="CAPIROTE" etiqueta="N.º de capirote" asignada={papeleta.numCapiroteAsignado} valor={capirote} onCambiar={setCapirote} hermanoId={ficha.id} salida={ficha.salida} crear={crear.CAPIROTE} onCrear={(c) => setCrear({ ...crear, CAPIROTE: c })} onBloqueo={bloqueoCapirote} />
              )}
              {tocado === 'FARAONA' && (
                <CampoPrenda tipo="FARAONA" etiqueta="N.º de faraona" asignada={papeleta.numFaraonaAsignada} valor={faraona} onCambiar={setFaraona} hermanoId={ficha.id} salida={ficha.salida} crear={crear.FARAONA} onCrear={(c) => setCrear({ ...crear, FARAONA: c })} onBloqueo={bloqueoFaraona} />
              )}
            </Box>
          </>
        )}
        {/* El cíngulo y las observaciones comparten fila: una menos que bajar. */}
        <Box sx={conRopa ? dosColumnas : undefined}>
          {conRopa && (cinguloEditable
            ? <CampoCingulo compacto valor={cingulo} onCambiar={setCingulo} quedan={ficha.cingulos.enElRopero} sinGastar={cinguloSinGastar} />
            : <TextField size="small" label="Cíngulo" value="Devuelto" disabled />)}
          <TextField size="small" fullWidth label="Observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} multiline minRows={1} maxRows={4} />
        </Box>
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
