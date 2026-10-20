import { useCallback, useState, type ReactNode } from 'react'
import { visuallyHidden } from '@mui/utils'
import { Alert, Box, Button, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { entregarEnMesa, type CinguloEnMesa, type FichaDeMesa, type OrigenTunica, type TipoRopa } from '../../../lib/api/mesa'
import type { Salida } from '../../../lib/api/salidas'
import CampoCingulo, { cinguloInicial } from './CampoCingulo'
import CampoPrenda from './CampoPrenda'
import CancelarInscripcion from './CancelarInscripcion'
import { ropaSinDevolver } from './formato'
import { AvisoSituacion, CampoPuesto, type Aviso } from './piezas'
import { alturaEnMetros, puestoDelCatalogo } from './formato'
import { mensajeDeFallo, useClaveDeOperacion } from './enVivo'

type Tocado = 'CAPIROTE' | 'FARAONA' | 'NINGUNO'

interface Props {
  ficha: FichaDeMesa
  salida: Salida
  role: string
  onHecho: (aviso: Aviso) => void
  onRecargar: () => void
  /** Mandarla a Tesorería si aún debe algo. */
  onATesoreria: () => void
}

/**
 * El tocado que se propone: el que trae prestado, el del año pasado o el del
 * puesto. Un puesto sin tocado (los de trono) no lleva ninguno.
 */
function tocadoInicial(ficha: FichaDeMesa, puesto: string, salida: Salida): Tocado {
  const catalogo = puestoDelCatalogo(puesto, salida.puestos)
  if (catalogo && !catalogo.tocado) return 'NINGUNO'
  if (ficha.propuesta.faraona) return 'FARAONA'
  if (ficha.propuesta.capirote) return 'CAPIROTE'
  return puestoDelCatalogo(puesto, salida.puestos)?.tocado ?? 'NINGUNO'
}

/**
 * Zona de Túnicas: con todo pagado (o perdonado), se confirma el puesto, se
 * le da la ropa y entonces nace su papeleta. Llega todo propuesto —la túnica
 * del año pasado (o la que trae sin devolver), su capirote o su faraona, el
 * cíngulo, su talla—: se prueba, se cambia lo que haga falta y se pulsa. En
 * una salida sin ropa (de traje) solo se confirma el puesto.
 *
 * Sin pagar no sale la túnica: si debe algo, se le manda a Tesorería.
 */
export default function ZonaTunicas({ ficha, salida, role, onHecho, onRecargar, onATesoreria }: Props) {
  const solicitud = ficha.solicitud
  const sinRopa = !salida.conRopa
  const inicial = solicitud?.puesto ?? ficha.propuesta.puesto
  const [puesto, setPuesto] = useState(inicial)
  const [origen, setOrigen] = useState<OrigenTunica>(ficha.propuesta.tunica.origen)
  const [tunica, setTunica] = useState(ficha.propuesta.tunica.numero ?? '')
  const [tocado, setTocado] = useState<Tocado>(() => tocadoInicial(ficha, inicial, salida))
  const [capirote, setCapirote] = useState(ficha.propuesta.capirote ?? '')
  const [faraona, setFaraona] = useState(ficha.propuesta.faraona ?? '')
  // Si trae un cíngulo sin devolver, se le cambia por este: no gasta uno del ropero.
  const traeCingulo = ficha.cingulosSinDevolver.length > 0
  const quedanCingulos = ficha.cingulos.enElRopero
  const [cingulo, setCingulo] = useState<CinguloEnMesa>(() => cinguloInicial(ficha.propuesta.cingulo, quedanCingulos, traeCingulo))
  const [altura, setAltura] = useState(alturaEnMetros(ficha.alturaHombro))
  const [observaciones, setObservaciones] = useState(solicitud?.observaciones ?? '')
  const [crear, setCrear] = useState<Record<TipoRopa, boolean>>({ TUNICA: false, CAPIROTE: false, FARAONA: false })
  const [bloqueos, setBloqueos] = useState<Record<TipoRopa, boolean>>({ TUNICA: false, CAPIROTE: false, FARAONA: false })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { clave, renovar } = useClaveDeOperacion()

  // Estables: cada campo de prenda avisa con ellas desde un efecto.
  const bloquear = (tipo: TipoRopa, b: boolean) => setBloqueos((actual) => (actual[tipo] === b ? actual : { ...actual, [tipo]: b }))
  const bloqueoTunica = useCallback((b: boolean) => bloquear('TUNICA', b), [])
  const bloqueoCapirote = useCallback((b: boolean) => bloquear('CAPIROTE', b), [])
  const bloqueoFaraona = useCallback((b: boolean) => bloquear('FARAONA', b), [])

  if (ficha.papeleta) return <Alert severity="info">Ya ha recogido{sinRopa ? '' : ' la ropa'}: {ficha.papeleta.puesto}. Para cambiar algo, búscalo en el listado.</Alert>
  if (!solicitud) return <Alert severity="info">Todavía no está apuntado: que pase por Inscripción.</Alert>

  const catalogo = puestoDelCatalogo(puesto, salida.puestos)
  // La talla al hombro, solo en los puestos que la llevan (los de trono); el
  // capirote o la faraona, solo en los que llevan tocado.
  const conAltura = Boolean(catalogo?.alturaHombro)
  const conTocado = !catalogo || catalogo.tocado !== null
  const hayBloqueo = !sinRopa && ((origen === 'ROPERO' && tunica.trim() && bloqueos.TUNICA)
    || (tocado === 'CAPIROTE' && capirote.trim() && bloqueos.CAPIROTE)
    || (tocado === 'FARAONA' && faraona.trim() && bloqueos.FARAONA))
  const { requisitos } = ficha

  // El cíngulo va con la túnica: del ropero se presta (o se le debe), propia lleva el suyo, sin túnica ninguno.
  const cambiarOrigen = (nuevo: OrigenTunica) => {
    setOrigen(nuevo)
    setCingulo(cinguloInicial(nuevo === 'ROPERO' ? 'PRESTADO' : nuevo === 'PROPIA' ? 'PROPIO' : 'NINGUNO', quedanCingulos, traeCingulo))
  }

  const elegirPuesto = (nuevo: string) => {
    setPuesto(nuevo)
    const c = puestoDelCatalogo(nuevo, salida.puestos)
    if (!c || sinRopa) return
    setTocado(c.tocado ?? 'NINGUNO')
    if (!c.tunica) cambiarOrigen('NINGUNA')
    else if (origen === 'NINGUNA') cambiarOrigen(ficha.tieneTunicaPropia ? 'PROPIA' : 'ROPERO')
  }

  const entregar = async () => {
    setEnviando(true); setError(null)
    try {
      const crearPrendas = (Object.keys(crear) as TipoRopa[]).filter((t) => crear[t])
      const r = await entregarEnMesa({
        solicitudId: solicitud.id,
        clave,
        puesto: puesto.trim(),
        observaciones: observaciones.trim(),
        ...(altura.trim() && { alturaHombro: altura.trim() }),
        ...(!sinRopa && {
          origenTunica: origen,
          ...(origen === 'ROPERO' && tunica.trim() && { numTunicaAsignada: tunica.trim() }),
          ...(tocado === 'CAPIROTE' && capirote.trim() && { numCapiroteAsignado: capirote.trim() }),
          ...(tocado === 'FARAONA' && faraona.trim() && { numFaraonaAsignada: faraona.trim() }),
          crearPrendas,
          cingulo,
        }),
      })
      renovar()
      onHecho({
        tono: 'success',
        papeletaId: r.papeletaId,
        texto: sinRopa
          ? `${ficha.nombre} ${ficha.primerApellido ?? ''}: ${r.puesto}, confirmado.`
          : `${ficha.nombre} ${ficha.primerApellido ?? ''}: ${r.puesto}${r.numTunicaAsignada ? `, túnica ${r.numTunicaAsignada}` : ''}${r.cingulo === 'DEBIDO' ? ', sin cíngulo (se le debe)' : ''}. Recogida.`,
      })
    } catch (e) {
      setError(mensajeDeFallo(e, 'No se ha podido dar la ropa.'))
    } finally {
      setEnviando(false)
    }
  }

  // Los campos van por filas emparejadas, cada una con lo suyo a los dos lados
  // (túnica con tocado, sus números, cíngulo con observaciones): por columnas
  // sueltas quedaban huecos y nada casaba con lo de al lado (20-10-2026).
  const etiqueta = (texto: string) => <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.5 }}>{texto}</Typography>
  const campoPuesto = <CampoPuesto valor={puesto} onCambiar={elegirPuesto} puestos={salida.puestos} />
  const campoAltura = conAltura
    ? <TextField size="small" fullWidth label="Talla (hombro)" placeholder="1,45" value={altura} onChange={(e) => setAltura(e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} helperText="En metros" />
    : null
  // Con su etiqueta encima, como las de al lado: así la fila queda alineada.
  const campoObservaciones = (
    <>
      {etiqueta('Observaciones')}
      <TextField size="small" fullWidth placeholder="Lo que haya que saber" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} multiline minRows={1} maxRows={3} slotProps={{ htmlInput: { 'aria-label': 'Observaciones' } }} />
    </>
  )
  const tunicaOrigen = (
    <>
      {etiqueta('Túnica')}
      <ToggleButtonGroup exclusive size="small" fullWidth value={origen} onChange={(_e, v: OrigenTunica | null) => v && cambiarOrigen(v)} aria-label="Túnica">
        <ToggleButton value="ROPERO">Del ropero</ToggleButton>
        <ToggleButton value="PROPIA">Propia</ToggleButton>
        <ToggleButton value="NINGUNA">No lleva</ToggleButton>
      </ToggleButtonGroup>
    </>
  )
  const tunicaNumero = origen === 'ROPERO' ? (
    <>
      <CampoPrenda
        tipo="TUNICA" etiqueta="N.º de túnica" valor={tunica} onCambiar={setTunica} hermanoId={ficha.id} salida={ficha.salida}
        crear={crear.TUNICA} onCrear={(c) => setCrear({ ...crear, TUNICA: c })} onBloqueo={bloqueoTunica} autoFocus
      />
      {ficha.propuesta.tunica.porTalla && tunica === ficha.propuesta.tunica.numero && (
        <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 0.5 }}>
          Propuesta por su talla{ficha.alturaHombro ? ` (${alturaEnMetros(ficha.alturaHombro)} m al hombro)` : ''}: no tenía túnica en casa ni estaba libre la de antes. Que se la pruebe.
        </Typography>
      )}
    </>
  ) : null
  const tocadoElegido = (
    <>
      {etiqueta('Capirote o faraona')}
      <ToggleButtonGroup exclusive size="small" fullWidth value={tocado} onChange={(_e, v: Tocado | null) => v && setTocado(v)} aria-label="Capirote o faraona">
        <ToggleButton value="CAPIROTE">Capirote</ToggleButton>
        <ToggleButton value="FARAONA">Faraona</ToggleButton>
        <ToggleButton value="NINGUNO">Ninguno</ToggleButton>
      </ToggleButtonGroup>
    </>
  )
  const tocadoNumero = tocado === 'CAPIROTE'
    ? (
      <CampoPrenda
        tipo="CAPIROTE" etiqueta="N.º de capirote" valor={capirote} onCambiar={setCapirote} hermanoId={ficha.id} salida={ficha.salida}
        crear={crear.CAPIROTE} onCrear={(c) => setCrear({ ...crear, CAPIROTE: c })} onBloqueo={bloqueoCapirote}
      />
    )
    : tocado === 'FARAONA'
      ? (
        <CampoPrenda
          tipo="FARAONA" etiqueta="N.º de faraona" valor={faraona} onCambiar={setFaraona} hermanoId={ficha.id} salida={ficha.salida}
          crear={crear.FARAONA} onCrear={(c) => setCrear({ ...crear, FARAONA: c })} onBloqueo={bloqueoFaraona}
        />
      )
      : null
  const campoCingulo = <CampoCingulo valor={cingulo} onCambiar={setCingulo} quedan={quedanCingulos} sinGastar={traeCingulo} />

  // [izquierda, derecha]; con la derecha a null, la de la izquierda ocupa la fila entera.
  type Fila = [ReactNode, ReactNode | null]
  const filas: Fila[] = [[campoPuesto, campoAltura]]
  if (sinRopa) filas.push([campoObservaciones, null])
  else if (conTocado) {
    filas.push([tunicaOrigen, tocadoElegido])
    if (tunicaNumero || tocadoNumero) filas.push([tunicaNumero, tocadoNumero ?? <span />])
    filas.push([campoCingulo, campoObservaciones])
  } else {
    // Sin tocado (los de trono): el cíngulo sube al lado de la túnica.
    filas.push([tunicaOrigen, campoCingulo])
    filas.push([tunicaNumero ?? <span />, campoObservaciones])
  }

  // Los botones de túnica, tocado y cíngulo, en una línea: partidos en dos, la ficha crecía media pantalla.
  // En una pantalla con más alto que la del portátil (552 px), la ficha crece
  // para llenarlo: espacios, campos y botones más holgados (20-10-2026). Por
  // debajo de 560 px de alto se queda como está, que ahí ya cabe justa.
  const crece = (min: number, max: number, ritmo: number) => `clamp(${min}px, calc(${min}px + (100vh - 560px) * ${ritmo}), ${max}px)`
  const botonesEnUnaLinea = {
    '& .MuiToggleButton-root': { py: crece(4.8, 12, 0.025), px: 0.5, fontSize: crece(13, 15, 0.007), lineHeight: 1.2, whiteSpace: 'nowrap', textTransform: 'none' },
    '& .MuiInputBase-input': { py: crece(8.5, 14, 0.02) },
  }

  return (
    <Stack useFlexGap component="form" onSubmit={(e) => { e.preventDefault(); void entregar() }} sx={{ flexGrow: 1, gap: crece(7, 20, 0.04), containerType: 'inline-size', ...botonesEnUnaLinea }}>
      <AvisoSituacion ficha={ficha} role={role} onRecargar={onRecargar} />
      {!requisitos.puedeRecoger && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={onATesoreria}>A Tesorería</Button>}>
          <strong>{sinRopa ? 'Todavía no se le confirma el puesto.' : 'La túnica no sale todavía.'}</strong> {requisitos.motivos.join(' ')}
        </Alert>
      )}
      {!sinRopa && (ficha.prendas.length > 0 || traeCingulo) && (
        <Alert severity="warning" icon={false} sx={{ py: 0 }}>
          Tiene sin devolver: {ropaSinDevolver(ficha.prendas, ficha.cingulosSinDevolver.length)}. Que lo traiga: se le cambia por lo de este año.
        </Alert>
      )}
      {(puesto.trim() !== solicitud.puesto || (!sinRopa && ficha.anterior)) && (
        <Typography variant="body2" color="text.secondary">
          {puesto.trim() !== solicitud.puesto && `Pidió: ${solicitud.puesto}. `}
          {!sinRopa && ficha.anterior && <>
            En {ficha.anterior.year}: {ficha.anterior.puesto}
            {ficha.anterior.numTunicaAsignada && ` · túnica ${ficha.anterior.numTunicaAsignada}`}
            {ficha.anterior.origenTunica === 'PROPIA' && ' · túnica propia'}
            {ficha.anterior.numCapiroteAsignado && ` · capirote ${ficha.anterior.numCapiroteAsignado}`}
            {ficha.anterior.numFaraonaAsignada && ` · faraona ${ficha.anterior.numFaraonaAsignada}`}
          </>}
        </Typography>
      )}

      {/* Lo que sobre de alto se reparte entre las filas, no en un hueco. */}
      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Para el lector de pantalla: a la vista, los campos ya dicen lo que son. */}
        <Typography component="legend" sx={visuallyHidden}>{sinRopa ? 'Puesto' : 'Puesto y ropa'}</Typography>
        <Box sx={{ flexGrow: 1, display: 'grid', alignContent: 'space-between', rowGap: crece(7, 24, 0.05), columnGap: 2.5, alignItems: 'start', '@container (min-width: 560px)': { gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' } }}>
          {filas.flatMap(([izquierda, derecha], i) => (derecha === null
            ? [<Box key={i} sx={{ gridColumn: '1 / -1' }}>{izquierda}</Box>]
            : [<Box key={`${i}-i`}>{izquierda}</Box>, <Box key={`${i}-d`}>{derecha}</Box>]))}
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Button type="submit" variant="contained" size="large" disabled={enviando || !requisitos.puedeRecoger || !puesto.trim() || Boolean(hayBloqueo)} sx={{ flexGrow: 1, minHeight: crece(42, 64, 0.06) }}>
          {enviando ? 'Guardando…' : sinRopa ? 'Confirmar el puesto' : 'Dar la ropa'}
        </Button>
        <CancelarInscripcion ficha={ficha} onHecho={onHecho} />
      </Stack>
    </Stack>
  )
}
