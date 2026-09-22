import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Checkbox, CircularProgress, FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import EventBusyIcon from '@mui/icons-material/EventBusy'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import TarjetaCristal from '../../../components/TarjetaCristal'
import Boton from '../../../components/Boton'
import { anularCita, miProcesion, reservarDia, type DiaDeReparto, type FichaEnLaProcesion, type MiProcesion } from '../../../lib/api/procesion'
import { formatearImporte } from '../recibos/etiquetas'
import { estadoPapeleta } from './estadoPapeleta'
import { PARENTESCO } from '../perfil/etiquetas'

const ZONA = 'Europe/Madrid'
const formatoDia = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, weekday: 'long', day: 'numeric', month: 'long' })
const formatoHora = new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' })
const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/** «Martes 9 de marzo» y «de 18:00 a 21:00». */
const dia = (turno: { fecha: string }) => mayuscula(formatoDia.format(new Date(turno.fecha)))
const horas = (turno: { horaInicio: string; horaFin: string }) =>
  `de ${formatoHora.format(new Date(turno.horaInicio))} a ${formatoHora.format(new Date(turno.horaFin))}`

const quienEs = (f: FichaEnLaProcesion) => (f.esTitular ? 'Tú' : f.parentesco ? PARENTESCO[f.parentesco] : 'A tu cargo')
const sitio = (p: { puesto: string; tramo: string | null }) => [p.puesto, p.tramo].filter(Boolean).join(' · ')

/**
 * La papeleta de sitio desde el área de hermanos: se pide para uno mismo y
 * para quienes se tienen a cargo, eligiendo el día del reparto en que se pasa
 * a recogerla. Solo mientras Secretaría tiene abierto el plazo; cerrado, no
 * hay nada que pedir y se enseña la última que se tuvo.
 */
export default function ProcesionPage() {
  const [estado, setEstado] = useState<MiProcesion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const cargar = useCallback(() => miProcesion().then(setEstado), [])

  useEffect(() => {
    let cancelado = false
    miProcesion()
      .then((datos) => { if (!cancelado) setEstado(datos) })
      .catch((e: unknown) => { if (!cancelado) setError(e instanceof Error ? e.message : 'No se ha podido cargar la procesión.') })
    return () => { cancelado = true }
  }, [])

  const tras = async (mensaje: string) => {
    setAviso(mensaje)
    setError(null)
    await cargar().catch((e: unknown) => setError(e instanceof Error ? e.message : 'No se ha podido cargar la procesión.'))
  }

  return (
    <>
      <Helmet><title>Procesión | Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      <SeccionAnimada sx={{ py: { xs: 4, md: 6 } }}>
        <ContenedorDePagina>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, mb: 3 }}>
            <Box>
              <Typography variant="h2" component="h1">Papeleta de sitio</Typography>
              {estado && <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>Semana Santa de {estado.year}.</Typography>}
            </Box>
            <Box component={Link} to="/area-hermano/procesion/historico" sx={{ color: 'primary.light', fontWeight: 600, fontSize: 15 }}>Ver el histórico</Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
          {aviso && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setAviso(null)}>{aviso}</Alert>}
          {!estado && !error && <CircularProgress aria-label="Cargando la procesión" />}

          {estado && <Contenido estado={estado} onHecho={(m) => void tras(m)} onError={setError} />}
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}

function Contenido({ estado, onHecho, onError }: { estado: MiProcesion; onHecho: (mensaje: string) => void; onError: (mensaje: string) => void }) {
  const conPapeleta = estado.fichas.filter((f) => f.papeleta)
  const conCita = estado.fichas.filter((f) => !f.papeleta && f.cita)
  const porPedir = estado.fichas.filter((f) => !f.papeleta && !f.cita)

  return (
    <Box sx={{ display: 'grid', gap: 3, maxWidth: 980 }}>
      {conPapeleta.length > 0 && <Papeletas fichas={conPapeleta} />}
      {conCita.length > 0 && <Citas fichas={conCita} onHecho={onHecho} onError={onError} />}

      {porPedir.length > 0 && (estado.abierto
        ? <Solicitud estado={estado} fichas={porPedir} onHecho={onHecho} onError={onError} />
        : <PlazoCerrado fichas={porPedir} />)}
    </Box>
  )
}

/** La papeleta ya dada en la Mesa de Reparto: el sitio y si está pagada. */
function Papeletas({ fichas }: { fichas: FichaEnLaProcesion[] }) {
  return (
    <TarjetaCristal component="section" aria-label="Papeletas de este año" sx={{ p: { xs: 2.5, md: 3.5 } }}>
      <Typography component="h2" sx={{ fontSize: 19, fontWeight: 600, mb: 2 }}>{fichas.length > 1 ? 'Vuestras papeletas' : 'Tu papeleta'}</Typography>
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1.5 }}>
        {fichas.map((f) => {
          const p = f.papeleta!
          const pago = p.recibo ? estadoPapeleta(p.recibo.estado) : null
          return (
            <Box component="li" key={f.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, pt: 1.5, borderTop: 1, borderColor: 'divider' }}>
              <span>
                <Typography component="span" sx={{ display: 'block', fontWeight: 600 }}>{f.nombre} {f.apellidos}</Typography>
                <Typography component="span" sx={{ display: 'block', fontSize: 14, color: 'text.secondary' }}>
                  {sitio(p)}{p.numero !== null ? ` · n.º ${p.numero}` : ''}
                </Typography>
              </span>
              {pago && <Typography component="span" sx={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', color: pago.color }}>{pago.texto}</Typography>}
            </Box>
          )
        })}
      </Box>
    </TarjetaCristal>
  )
}

/** Las citas reservadas, agrupadas por día: la familia suele ir junta. */
function Citas({ fichas, onHecho, onError }: { fichas: FichaEnLaProcesion[]; onHecho: (m: string) => void; onError: (m: string) => void }) {
  const [anulando, setAnulando] = useState<number | null>(null)
  const porTurno = new Map<number, FichaEnLaProcesion[]>()
  for (const f of fichas) porTurno.set(f.cita!.turno.id, [...(porTurno.get(f.cita!.turno.id) ?? []), f])

  const anular = async (f: FichaEnLaProcesion) => {
    setAnulando(f.cita!.id)
    try {
      await anularCita(f.cita!.id)
      onHecho(`Cita anulada: ${f.nombre} ya no tiene día de reparto.`)
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'No se ha podido anular la cita.')
    } finally {
      setAnulando(null)
    }
  }

  return (
    <>
      {[...porTurno.values()].map((grupo) => {
        const turno = grupo[0].cita!.turno
        return (
          <TarjetaCristal key={turno.id} component="section" aria-label={`Cita del ${dia(turno)}`} sx={{ p: { xs: 2.5, md: 3.5 }, display: 'grid', gap: 2.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <EventAvailableIcon sx={{ color: 'success.light' }} aria-hidden="true" />
              <Typography component="h2" sx={{ fontSize: 19, fontWeight: 600 }}>{grupo.length > 1 ? 'Tenéis cita para recoger las papeletas' : 'Tienes cita para recoger la papeleta'}</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center', p: 2, borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.04)' }}>
              <Box sx={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 68, height: 72, borderRadius: '8px', backgroundColor: 'rgba(160,61,68,0.25)' }}>
                <Typography component="span" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'primary.light' }}>
                  {new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, month: 'short' }).format(new Date(turno.fecha)).replace('.', '')}
                </Typography>
                <Typography component="span" sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
                  {new Intl.DateTimeFormat('es-ES', { timeZone: ZONA, day: 'numeric' }).format(new Date(turno.fecha))}
                </Typography>
              </Box>
              <span>
                <Typography component="span" sx={{ display: 'block', fontSize: 18, fontWeight: 600 }}>{dia(turno)}, {horas(turno)}</Typography>
                <Typography component="span" sx={{ display: 'block', mt: 0.5, fontSize: 14, color: 'text.secondary' }}>Llevad el DNI: las papeletas se pagan allí.</Typography>
              </span>
            </Box>
            <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 1 }}>
              {grupo.map((f) => (
                <Box component="li" key={f.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                  <Typography>{f.nombre} {f.apellidos}</Typography>
                  <Boton appVariant="outline" onClick={() => void anular(f)} disabled={anulando !== null} aria-label={`Anular la cita de ${f.nombre}`} sx={{ py: 0.75, px: 2, fontSize: 13 }}>
                    {anulando === f.cita!.id ? 'Anulando…' : 'Anular'}
                  </Boton>
                </Box>
              ))}
            </Box>
            <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>
              ¿Otro día? Anula la cita y pide la papeleta de nuevo eligiendo el que os venga bien. El sitio en el cortejo lo da la Mesa de Reparto el día de la cita.
            </Typography>
          </TarjetaCristal>
        )
      })}
    </>
  )
}

function PlazoCerrado({ fichas }: { fichas: FichaEnLaProcesion[] }) {
  return (
    <>
      <TarjetaCristal component="section" sx={{ p: { xs: 2.5, md: 3.5 }, display: 'flex', gap: 2.5, alignItems: 'flex-start' }}>
        <Box sx={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 52, height: 52, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)' }}>
          <EventBusyIcon sx={{ color: 'secondary.main' }} aria-hidden="true" />
        </Box>
        <Box>
          <Typography component="h2" sx={{ fontSize: 21, fontWeight: 600 }}>La solicitud de papeletas aún no está abierta</Typography>
          <Typography sx={{ mt: 1, color: 'text.secondary', lineHeight: 1.6, maxWidth: '64ch' }}>
            Secretaría la abre unas semanas antes del reparto. Cuando se abra podrás pedir aquí la papeleta{fichas.length > 1 ? ' para ti y para quienes tienes a tu cargo' : ''}, y elegir el día en que pasarás a recogerla. Te avisaremos por correo.
          </Typography>
        </Box>
      </TarjetaCristal>
      <Box component="section" aria-label="La última papeleta">
        <Typography component="h2" sx={{ fontSize: 17, fontWeight: 600, mb: 0.5 }}>La última vez</Typography>
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {fichas.map((f) => (
            <Box component="li" key={f.id} sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', py: 1.5, borderTop: 1, borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 600 }}>{f.nombre} {f.apellidos}</Typography>
              <Typography sx={{ color: 'text.secondary' }}>{f.ultima ? `${f.ultima.year} · ${sitio(f.ultima)}` : 'Todavía no ha salido'}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </>
  )
}

/** Plazo abierto: quién sale y qué día pasa a recogerla. */
function Solicitud({ estado, fichas, onHecho, onError }: { estado: MiProcesion; fichas: FichaEnLaProcesion[]; onHecho: (m: string) => void; onError: (m: string) => void }) {
  const pueden = fichas.filter((f) => f.activo)
  const [marcadas, setElegidas] = useState<number[]>(() => pueden.map((f) => f.id))
  // Tras pedir, las que ya tienen cita salen de esta lista: no cuentan aunque sigan marcadas.
  const elegidas = marcadas.filter((id) => pueden.some((f) => f.id === id))
  const [turnoId, setTurnoId] = useState<number | null>(null)
  const [enviando, setEnviando] = useState(false)

  const libres = (d: DiaDeReparto) => d.capacidad - d.genteApuntada
  const diaElegido = estado.dias.find((d) => d.id === turnoId) ?? null
  const cuantas = elegidas.length
  const nombres = pueden.filter((f) => elegidas.includes(f.id)).map((f) => f.nombre)
  const { papeleta, alquilerTunica } = estado.precios

  const alternar = (id: number) => setElegidas((actuales) => (actuales.includes(id) ? actuales.filter((x) => x !== id) : [...actuales, id]))

  const pedir = async () => {
    if (!turnoId || cuantas === 0) return
    setEnviando(true)
    const fallos: string[] = []
    // Una a una: si una ficha ya tenía papeleta o el día se llena a mitad, las demás siguen.
    for (const id of elegidas) {
      try {
        await reservarDia(id, turnoId)
      } catch (e: unknown) {
        const nombre = pueden.find((f) => f.id === id)?.nombre ?? ''
        fallos.push(`${nombre}: ${e instanceof Error ? e.message : 'no se ha podido reservar'}`)
      }
    }
    setEnviando(false)
    if (fallos.length > 0) onError(fallos.join(' '))
    if (fallos.length < cuantas) onHecho(cuantas - fallos.length > 1 ? 'Papeletas pedidas. Os esperamos el día del reparto.' : 'Papeleta pedida. Te esperamos el día del reparto.')
  }

  const leyenda = { fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'secondary.main', px: 0.75 } as const

  return (
    <>
      <Alert severity="success" icon={<EventAvailableIcon />}>
        <strong>La solicitud de papeletas está abierta.</strong> Elige quién sale y el día en que pasaréis a recogerla.
      </Alert>

      {estado.dias.length === 0 ? (
        <Alert severity="info">Todavía no hay días de reparto publicados. Vuelve en unos días.</Alert>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3, alignItems: 'start' }}>
          <TarjetaCristal component="fieldset" sx={{ m: 0, p: { xs: 2.5, md: 3 }, display: 'grid', gap: 1.25, minWidth: 0 }}>
            <Typography component="legend" sx={leyenda}>1 · Quién sale</Typography>
            {fichas.map((f) => (
              <FormControlLabel
                key={f.id}
                disabled={!f.activo}
                control={<Checkbox checked={elegidas.includes(f.id)} onChange={() => alternar(f.id)} />}
                sx={{ m: 0, px: 1, py: 0.75, borderRadius: '8px', border: 1, borderColor: 'divider', alignItems: 'center' }}
                label={
                  <span>
                    <Typography component="span" sx={{ display: 'block', fontWeight: 600 }}>{f.nombre} {f.apellidos}</Typography>
                    <Typography component="span" sx={{ display: 'block', fontSize: 13, color: 'text.secondary' }}>
                      {f.activo
                        ? `${quienEs(f)} · ${f.ultima ? `el año pasado: ${sitio(f.ultima)}` : 'primera vez'}`
                        : 'Podrá salir cuando Secretaría apruebe su alta'}
                    </Typography>
                  </span>
                }
              />
            ))}
          </TarjetaCristal>

          <TarjetaCristal component="fieldset" sx={{ m: 0, p: { xs: 2.5, md: 3 }, minWidth: 0 }}>
            <Typography component="legend" sx={leyenda}>2 · Día del reparto</Typography>
            <RadioGroup value={turnoId ?? ''} onChange={(e) => setTurnoId(Number(e.target.value))} sx={{ gap: 1.25 }}>
              {estado.dias.map((d) => {
                const quedan = libres(d)
                const lleno = quedan < Math.max(cuantas, 1)
                return (
                  <FormControlLabel
                    key={d.id}
                    value={d.id}
                    disabled={lleno}
                    control={<Radio />}
                    sx={{ m: 0, px: 1, py: 0.75, borderRadius: '8px', border: 1, borderColor: d.id === turnoId ? 'primary.light' : 'divider' }}
                    label={
                      <span>
                        <Typography component="span" sx={{ display: 'block', fontWeight: 600 }}>{dia(d)}</Typography>
                        <Typography component="span" sx={{ display: 'block', fontSize: 13, color: 'text.secondary' }}>
                          {mayuscula(horas(d))} · {lleno ? 'completo' : quedan <= 10 ? `quedan ${quedan} huecos` : `${d.genteApuntada} apuntados`}
                        </Typography>
                      </span>
                    }
                  />
                )
              })}
            </RadioGroup>
          </TarjetaCristal>
        </Box>
      )}

      {estado.dias.length > 0 && (
        <TarjetaCristal sx={{ p: { xs: 2.5, md: 3 }, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Typography sx={{ color: 'text.secondary', maxWidth: '62ch' }}>
            {cuantas === 0 ? 'Elige quién sale.' : !diaElegido ? `${nombres.join(' y ')}: elige el día del reparto.` : `${nombres.join(' y ')} · ${dia(diaElegido)}, ${horas(diaElegido)}.`}
            {papeleta !== null && ` La papeleta se paga en el reparto: ${formatearImporte(papeleta)}${alquilerTunica ? `, más ${formatearImporte(alquilerTunica)} de alquiler de túnica a quien no tenga la suya.` : '.'}`}
          </Typography>
          <Boton onClick={() => void pedir()} disabled={enviando || cuantas === 0 || !diaElegido}>
            {enviando ? 'Pidiendo…' : cuantas > 1 ? `Pedir ${cuantas} papeletas` : 'Pedir la papeleta'}
          </Boton>
        </TarjetaCristal>
      )}
    </>
  )
}
