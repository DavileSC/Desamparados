import { useCallback, useState } from 'react'
import { Alert, Box, Button, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { entregarEnMesa, type CinguloEnMesa, type FichaDeMesa, type OrigenTunica, type TipoRopa } from '../../../lib/api/mesa'
import CampoCingulo, { cinguloInicial } from './CampoCingulo'
import CampoPrenda from './CampoPrenda'
import CancelarInscripcion from './CancelarInscripcion'
import { ropaSinDevolver } from './formato'
import { leyenda } from './datosDeLaFicha'
import { AvisoSituacion, CampoPuesto, type Aviso } from './piezas'
import { alturaEnMetros, puestoDelCatalogo } from './formato'
import { mensajeDeFallo, useClaveDeOperacion } from './enVivo'

type Tocado = 'CAPIROTE' | 'FARAONA' | 'NINGUNO'

interface Props {
  ficha: FichaDeMesa
  role: string
  puestosUsados: string[]
  onHecho: (aviso: Aviso) => void
  onRecargar: () => void
  /** Mandarla a Tesorería si aún debe algo. */
  onATesoreria: () => void
}

/** El tocado que se propone: el que trae prestado, el del año pasado o el del puesto. */
function tocadoInicial(ficha: FichaDeMesa, puesto: string): Tocado {
  if (ficha.propuesta.faraona) return 'FARAONA'
  if (ficha.propuesta.capirote) return 'CAPIROTE'
  return puestoDelCatalogo(puesto)?.tocado ?? 'NINGUNO'
}

/**
 * Zona de Túnicas: con todo pagado (o perdonado), se confirma el puesto, se
 * le da la ropa y entonces nace su papeleta. Llega todo propuesto —la túnica
 * del año pasado (o la que trae sin devolver), su capirote o su faraona, el
 * cíngulo, su talla—: se prueba, se cambia lo que haga falta y se pulsa. En
 * el Rosario se va de traje: solo el puesto.
 *
 * Sin pagar no sale la túnica: si debe algo, se le manda a Tesorería.
 */
export default function ZonaTunicas({ ficha, role, puestosUsados, onHecho, onRecargar, onATesoreria }: Props) {
  const solicitud = ficha.solicitud
  const rosario = ficha.salida === 'ROSARIO'
  const inicial = solicitud?.puesto ?? ficha.propuesta.puesto
  const [puesto, setPuesto] = useState(inicial)
  const [origen, setOrigen] = useState<OrigenTunica>(ficha.propuesta.tunica.origen)
  const [tunica, setTunica] = useState(ficha.propuesta.tunica.numero ?? '')
  const [tocado, setTocado] = useState<Tocado>(() => tocadoInicial(ficha, inicial))
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

  if (ficha.papeleta) return <Alert severity="info">Ya ha recogido{rosario ? '' : ' la ropa'}: {ficha.papeleta.puesto}. Para cambiar algo, búscalo en el listado.</Alert>
  if (!solicitud) return <Alert severity="info">Todavía no está apuntado: que pase por Inscripción.</Alert>

  const catalogo = puestoDelCatalogo(puesto, ficha.salida)
  const conAltura = catalogo?.alturaHombro || ficha.alturaHombro !== null || altura !== ''
  const hayBloqueo = !rosario && ((origen === 'ROPERO' && tunica.trim() && bloqueos.TUNICA)
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
    const c = puestoDelCatalogo(nuevo, ficha.salida)
    if (!c || rosario) return
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
        ...(!rosario && {
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
        texto: rosario
          ? `${ficha.nombre} ${ficha.primerApellido ?? ''}: ${r.puesto}, confirmado.`
          : `${ficha.nombre} ${ficha.primerApellido ?? ''}: ${r.puesto}${r.numTunicaAsignada ? `, túnica ${r.numTunicaAsignada}` : ''}${r.cingulo === 'DEBIDO' ? ', sin cíngulo (se le debe)' : ''}. Recogida.`,
      })
    } catch (e) {
      setError(mensajeDeFallo(e, 'No se ha podido dar la ropa.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Stack spacing={2.25} component="form" onSubmit={(e) => { e.preventDefault(); void entregar() }}>
      <AvisoSituacion ficha={ficha} role={role} onRecargar={onRecargar} />
      {!requisitos.puedeRecoger && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={onATesoreria}>A Tesorería</Button>}>
          <strong>{rosario ? 'Todavía no se le confirma el puesto.' : 'La túnica no sale todavía.'}</strong> {requisitos.motivos.join(' ')}
        </Alert>
      )}
      {puesto.trim() !== solicitud.puesto && (
        <Typography variant="body2" color="text.secondary">Pidió: {solicitud.puesto}.</Typography>
      )}
      {!rosario && (ficha.prendas.length > 0 || traeCingulo) && (
        <Alert severity="warning" icon={false}>
          Tiene sin devolver: {ropaSinDevolver(ficha.prendas, ficha.cingulosSinDevolver.length)}. Que lo traiga: se le cambia por lo de este año.
        </Alert>
      )}
      {!rosario && ficha.anterior && (
        <Typography variant="body2" color="text.secondary">
          En {ficha.anterior.year}: {ficha.anterior.puesto}
          {ficha.anterior.numTunicaAsignada && ` · túnica ${ficha.anterior.numTunicaAsignada}`}
          {ficha.anterior.origenTunica === 'PROPIA' && ' · túnica propia'}
          {ficha.anterior.numCapiroteAsignado && ` · capirote ${ficha.anterior.numCapiroteAsignado}`}
          {ficha.anterior.numFaraonaAsignada && ` · faraona ${ficha.anterior.numFaraonaAsignada}`}
        </Typography>
      )}

      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, display: 'grid', gap: 1.5 }}>
        <Typography component="legend" sx={leyenda}>{rosario ? 'Puesto' : 'Puesto y ropa'}</Typography>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: conAltura ? 'minmax(0, 2fr) minmax(0, 1fr)' : '1fr' }}>
          <CampoPuesto valor={puesto} onCambiar={elegirPuesto} salida={ficha.salida} usados={puestosUsados} />
          {conAltura && (
            <TextField size="small" label="Talla (hombro)" placeholder="1,45" value={altura} onChange={(e) => setAltura(e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} helperText="En metros" />
          )}
        </Box>

        {!rosario && (
          <>
            <Box>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.75 }}>Túnica</Typography>
              <ToggleButtonGroup exclusive size="small" fullWidth value={origen} onChange={(_e, v: OrigenTunica | null) => v && cambiarOrigen(v)} aria-label="Túnica">
                <ToggleButton value="ROPERO">Del ropero</ToggleButton>
                <ToggleButton value="PROPIA">Propia</ToggleButton>
                <ToggleButton value="NINGUNA">No lleva</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            {origen === 'ROPERO' && (
              <CampoPrenda
                tipo="TUNICA" etiqueta="N.º de túnica" valor={tunica} onCambiar={setTunica} hermanoId={ficha.id}
                crear={crear.TUNICA} onCrear={(c) => setCrear({ ...crear, TUNICA: c })} onBloqueo={bloqueoTunica} autoFocus
              />
            )}
            {origen === 'ROPERO' && ficha.propuesta.tunica.porTalla && tunica === ficha.propuesta.tunica.numero && (
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: '-8px !important' }}>
                Propuesta por su talla{ficha.alturaHombro ? ` (${alturaEnMetros(ficha.alturaHombro)} m al hombro)` : ''}: no tenía túnica en casa ni estaba libre la de antes. Que se la pruebe.
              </Typography>
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
            <CampoCingulo valor={cingulo} onCambiar={setCingulo} quedan={quedanCingulos} sinGastar={traeCingulo} />
          </>
        )}

        <TextField size="small" label="Observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} multiline minRows={1} maxRows={4} />
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Button type="submit" variant="contained" size="large" disabled={enviando || !requisitos.puedeRecoger || !puesto.trim() || Boolean(hayBloqueo)}>
        {enviando ? 'Guardando…' : rosario ? 'Confirmar el puesto' : 'Dar la ropa'}
      </Button>
      <CancelarInscripcion ficha={ficha} onHecho={onHecho} />
    </Stack>
  )
}
