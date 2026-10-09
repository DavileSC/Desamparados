import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, Skeleton, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { visuallyHidden } from '@mui/utils'
import CheckIcon from '@mui/icons-material/Check'
import Boton from '../../../components/Boton'
import TarjetaCristal from '../../../components/TarjetaCristal'
import EscudoDelGrupo from '../../../components/EscudoDelGrupo'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import { misFichas, type ApiProfile } from '../../../lib/api/perfil'
import { confirmarFicha, devolverFichaAjena } from '../../../lib/api/primerAcceso'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { useAuthStore } from '../../altas/auth/store'
import { cerrarSesion } from '../../altas/auth/session'
import { useModulos } from '../../../hooks/useModulos'
import { CuotaYPago, type Revision } from '../perfil/apartados'
import { deLaCorporacion } from '../../../domain/articulos'
import { designTokens } from '../../../theme'
import { site } from '../../../config/site'
import PasoTusDatos from './PasoTusDatos'
import PasoFamilia from './PasoFamilia'
import { enUnaFrase, faltanDeLaCuota } from './obligatorios'

type ClavePaso = 'datos' | 'cuota' | 'familia' | 'confirmar'

const TITULO: Record<ClavePaso, string> = { datos: 'Tus datos', cuota: 'Cuota y pago', familia: 'Tu familia', confirmar: 'Confirmar' }

const nombreCompleto = (f: ApiProfile) => `${f.nombre} ${f.apellidos}`.trim()

interface Avance { actual: number; alcanzado: number }

/** Dónde se quedó, por cuenta: «Salir» promete que la próxima vez sigue aquí. */
const claveGuardada = (cuenta: number | undefined) => `primer-acceso:${cuenta ?? 'sin-cuenta'}`

function leerAvance(cuenta: number | undefined): Avance | null {
  try {
    const crudo = window.localStorage.getItem(claveGuardada(cuenta))
    const avance = crudo ? (JSON.parse(crudo) as Partial<Avance>) : null
    return avance && typeof avance.actual === 'number' && typeof avance.alcanzado === 'number' ? { actual: avance.actual, alcanzado: avance.alcanzado } : null
  } catch {
    return null
  }
}

function guardarAvance(cuenta: number | undefined, avance: Avance | null) {
  try {
    if (avance) window.localStorage.setItem(claveGuardada(cuenta), JSON.stringify(avance))
    else window.localStorage.removeItem(claveGuardada(cuenta))
  } catch {
    // Sin almacenamiento (ventana privada) vuelve a empezar, y no pierde nada:
    // lo que guardó ya está en su ficha.
  }
}

/**
 * La revisión del primer acceso de quien vino con el censo importado, en
 * cuatro pasos como mucho: sus datos en una sola ficha, la cuota, toda su
 * familia en una pantalla y la confirmación. Lo obligatorio que falta (lo
 * mismo que pide el alta, en `obligatorios.ts`) se rellena antes de seguir;
 * lo opcional queda a su elección. Hasta confirmar no se ve nada más del área.
 */
export default function RevisarFichaPage() {
  const { activo } = useModulos()
  const navigate = useNavigate()
  const hermano = useAuthStore((s) => s.hermano)
  const entrarSesion = useAuthStore((s) => s.entrarSesion)
  const conCuotas = activo('cuotas-en-linea')

  const [fichas, setFichas] = useState<ApiProfile[] | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [actual, setActual] = useState(0)
  // Hasta dónde ha llegado: el índice deja volver a cualquier paso ya visto.
  const [alcanzado, setAlcanzado] = useState(0)
  const [cambiandoCuota, setCambiandoCuota] = useState(false)
  // Cada guardado vuelve a montar la cuota: si sigue faltando algo, se abre otra vez.
  const [vueltaCuota, setVueltaCuota] = useState(0)
  const [cambiados, setCambiados] = useState<Set<string>>(new Set())
  const [porDevolver, setPorDevolver] = useState<ApiProfile | null>(null)
  const [errorPaso, setErrorPaso] = useState<string | null>(null)
  const [declaro, setDeclaro] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [hecho, setHecho] = useState(false)

  const cuenta = hermano?.id
  useEffect(() => {
    let cancelado = false
    misFichas()
      .then((r) => {
        if (cancelado) return
        setFichas(r.data.filter((f) => f.activo))
        const avance = leerAvance(cuenta)
        if (avance) { setActual(avance.actual); setAlcanzado(avance.alcanzado) }
      })
      .catch((e: unknown) => { if (!cancelado) setErrorCarga(e instanceof Error ? e.message : 'No se ha podido cargar tu ficha.') })
    return () => { cancelado = true }
  }, [cuenta])

  useEffect(() => {
    if (fichas && !hecho) guardarAvance(cuenta, { actual, alcanzado })
  }, [fichas, hecho, actual, alcanzado, cuenta])

  const titular = fichas?.find((f) => f.esTitular) ?? null
  const familia = (fichas ?? []).filter((f) => !f.esTitular).sort((a, b) => a.fechaNacimiento.localeCompare(b.fechaNacimiento))
  const pasos: ClavePaso[] = [
    ...(titular ? (['datos', ...(conCuotas ? ['cuota'] : [])] as ClavePaso[]) : []),
    ...(familia.length > 0 ? (['familia'] as ClavePaso[]) : []),
    'confirmar',
  ]
  // Lo guardado puede apuntar más allá si desde entonces se fue alguien de la familia.
  const indice = Math.min(actual, pasos.length - 1)
  const paso = pasos[indice]
  const etiquetaDe = (p: ClavePaso) => (p === 'familia' ? `${TITULO.familia} · ${familia.length}` : TITULO[p])

  const ir = (i: number) => { setActual(i); setCambiandoCuota(false); setErrorPaso(null); window.scrollTo({ top: 0 }) }
  const siguiente = () => { const i = indice + 1; setAlcanzado((a) => Math.max(a, i)); ir(i) }
  const guardada = (nueva: ApiProfile) => {
    setFichas((actuales) => actuales?.map((f) => (f.id === nueva.id ? nueva : f)) ?? actuales)
    setCambiados((c) => new Set(c).add(nueva.esTitular ? paso : `ficha-${nueva.id}`))
  }

  const devolver = async (ficha: ApiProfile) => {
    setPorDevolver(null)
    try {
      await devolverFichaAjena(ficha.id)
      // Si era la única, el paso de la familia desaparece y el índice apunta ya al siguiente.
      setFichas((actuales) => actuales?.filter((f) => f.id !== ficha.id) ?? actuales)
    } catch (e) {
      setErrorPaso(e instanceof ErrorDeApi ? e.message : 'No se ha podido avisar a Secretaría.')
    }
  }

  const confirmar = async () => {
    setConfirmando(true); setErrorPaso(null)
    try {
      await confirmarFicha()
      guardarAvance(cuenta, null)
      setHecho(true)
    } catch (e) {
      setErrorPaso(e instanceof ErrorDeApi ? e.message : 'No se ha podido confirmar. Inténtalo otra vez.')
    } finally {
      setConfirmando(false)
    }
  }

  // Solo al salir de la pantalla de gracias: con la marca quitada antes, la
  // guarda de la ruta sacaría de aquí sin dejar leerla.
  const irAlArea = () => {
    if (hermano) entrarSesion('hermanos', { ...hermano, primerAccesoPendiente: false })
    navigate('/area-hermano', { replace: true })
  }

  const antetitulo = `Paso ${indice + 1} de ${pasos.length}`
  let contenido: ReactNode
  if (errorCarga) {
    contenido = <Alert severity="error">{errorCarga}</Alert>
  } else if (!fichas) {
    contenido = <Box sx={{ display: 'grid', gap: 2 }}><Skeleton width="40%" height={40} /><Skeleton variant="rounded" height={260} /></Box>
  } else if (hecho) {
    contenido = (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2.5, maxWidth: '60ch' }}>
        <Box aria-hidden="true" sx={{ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', backgroundColor: 'rgba(102,187,106,0.16)', color: 'success.light', '& svg': { fontSize: 34 } }}><CheckIcon /></Box>
        <Typography variant="h3" component="h1" sx={{ fontSize: { xs: 26, md: 32 }, textWrap: 'balance' }}>
          {titular ? `Gracias, ${titular.nombre}. Tu ficha está al día.` : 'Gracias. Las fichas están al día.'}
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>Si algo cambia más adelante, lo puedes corregir cuando quieras en «Mi perfil».</Typography>
        <Boton onClick={irAlArea}>Ir a mi área</Boton>
      </Box>
    )
  } else if (paso === 'datos' && titular) {
    contenido = (
      <>
        <Encabezado antetitulo={antetitulo} titulo={TITULO.datos} texto="Así figuras en el censo. Si está bien, sigue; si algo no, lo cambias aquí mismo." />
        <PasoTusDatos ficha={titular} onGuardada={guardada} onSi={siguiente} cambiado={cambiados.has('datos')} />
      </>
    )
  } else if (paso === 'cuota' && titular) {
    const faltan = faltanDeLaCuota(titular)
    const editando = cambiandoCuota || faltan.length > 0
    const revision: Revision = { sinLapiz: true, tituloOculto: true, editando, alTerminar: () => { setCambiandoCuota(false); setVueltaCuota((v) => v + 1) } }
    contenido = (
      <>
        <Encabezado antetitulo={antetitulo} titulo={TITULO.cuota} texto={editando ? 'Cambia lo que no esté bien y guarda.' : 'Cómo pagas tu cuota y, si la tienes domiciliada, en qué cuenta.'} />
        {faltan.length > 0 && <Alert severity="warning">Para domiciliar la cuota nos falta: {enUnaFrase(faltan)}.</Alert>}
        <CuotaYPago key={`cuota-${vueltaCuota}-${editando}`} ficha={titular} onGuardada={guardada} revision={revision} />
        {!editando && <Pregunta onSi={siguiente} onCambiar={() => setCambiandoCuota(true)} cambiado={cambiados.has('cuota')} />}
      </>
    )
  } else if (paso === 'familia') {
    const uno = familia.length === 1
    contenido = (
      <>
        <Encabezado
          antetitulo={antetitulo}
          titulo={TITULO.familia}
          texto={`${uno ? 'Está en tu cuenta porque en el censo figuraba' : 'Están en tu cuenta porque en el censo figuraban'} con tu correo. Dinos qué ${uno ? 'es' : 'es cada uno'} para ti y echa un vistazo a sus datos.`}
        />
        <PasoFamilia familia={familia} titular={titular} conCuotas={conCuotas} onGuardada={guardada} onDevolver={setPorDevolver} onSeguir={siguiente} />
      </>
    )
  } else {
    const revisados = [
      ...pasos.filter((p) => p === 'datos' || p === 'cuota').map((p) => ({ clave: p as string, etiqueta: TITULO[p] })),
      ...familia.map((f) => ({ clave: `ficha-${f.id}`, etiqueta: `${f.nombre}${f.numeroHermano ? ` · n.º ${f.numeroHermano}` : ''}` })),
    ]
    contenido = (
      <>
        <Encabezado antetitulo={antetitulo} titulo="Repaso final" texto="Esto es lo que has revisado. Si todo está bien, confirma y entrarás en tu área." />
        <TarjetaCristal component="ul" aria-label="Lo que has revisado" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {revisados.map(({ clave, etiqueta }, i) => {
            const cambiado = cambiados.has(clave)
            return (
              <Box component="li" key={clave} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, px: { xs: 2, md: 3 }, py: 1.75, borderTop: i ? 1 : 0, borderColor: 'divider' }}>
                <Box component="span">{etiqueta}</Box>
                <Box component="span" sx={{ fontSize: 14, fontWeight: 600, color: cambiado ? 'warning.light' : 'success.light' }}>{cambiado ? 'Cambiado' : 'Sin cambios'}</Box>
              </Box>
            )
          })}
        </TarjetaCristal>
        <FormControlLabel
          control={<Checkbox checked={declaro} onChange={(e) => setDeclaro(e.target.checked)} />}
          label={`Declaro que los datos son correctos y que la Secretaría ${deLaCorporacion()} puede usarlos para llevar el censo.`}
        />
        <Boton onClick={() => void confirmar()} disabled={!declaro || confirmando} sx={{ alignSelf: { sm: 'flex-start' }, py: 1.75, px: 4 }}>
          {confirmando ? <CircularProgress size={20} color="inherit" aria-label="Confirmando" /> : 'Confirmar mi ficha'}
        </Boton>
      </>
    )
  }

  const mostrarIndice = fichas !== null && !hecho && !errorCarga

  return (
    <>
      <Helmet><title>{`Revisa tu ficha | ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <DialogoConfirmacion
        abierto={porDevolver !== null}
        titulo="¿No es de tu familia?"
        mensaje={porDevolver ? `La ficha de ${nombreCompleto(porDevolver)} saldrá de tu cuenta y la Secretaría averiguará de quién es. No se borra nada.` : ''}
        textoConfirmar="Sí, avisar a Secretaría"
        onConfirmar={() => { if (porDevolver) void devolver(porDevolver) }}
        onCancelar={() => setPorDevolver(null)}
      />
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'background.default' }}>
        <Box component="header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, px: { xs: 2, md: 4 }, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            <EscudoDelGrupo alto={34} />
            <Typography sx={{ fontFamily: designTokens.fonts.heading, fontSize: { xs: 17, md: 20 }, lineHeight: 1.1 }}>{site.nombreCorto.toUpperCase()}</Typography>
          </Box>
          {/* Puede dejarlo a medias: lo guardado se queda y la próxima vez sigue aquí. */}
          <Button onClick={() => { void cerrarSesion('hermanos') }} sx={{ color: 'text.secondary', textTransform: 'none', letterSpacing: 0, fontSize: 15, flexShrink: 0 }}>Salir</Button>
        </Box>

        {mostrarIndice && (
          <Box aria-hidden="true" sx={{ display: { xs: 'flex', md: 'none' }, gap: 0.75, px: 2, pt: 2 }}>
            {pasos.map((p, i) => (
              <Box key={p} sx={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i === indice ? 'secondary.main' : i < alcanzado ? 'success.main' : 'rgba(204,196,201,0.16)' }} />
            ))}
          </Box>
        )}

        <Box sx={{ flex: 1, width: '100%', maxWidth: 1180, mx: 'auto', display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: mostrarIndice ? '280px minmax(0, 1fr)' : 'minmax(0, 1fr)' }, gap: { md: 5 }, px: { xs: 2, md: 4 }, py: { xs: 3, md: 5 } }}>
          {mostrarIndice && (
            <Box component="nav" aria-label="Pasos de la revisión" sx={{ display: { xs: 'none', md: 'block' } }}>
              <Typography sx={{ fontSize: 14, color: 'text.secondary', fontWeight: 600, mb: 1.5 }}>
                {titular ? `Revisa tu ficha, ${titular.nombre}` : 'Revisa las fichas de tu cuenta'}
              </Typography>
              <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 0.5 }}>
                <ItemIndice numero={0} etiqueta="Tu contraseña" hecho actual={false} />
                {pasos.map((p, i) => (
                  <ItemIndice
                    key={p}
                    numero={i + 1}
                    etiqueta={etiquetaDe(p)}
                    hecho={i < alcanzado && i !== indice}
                    actual={i === indice}
                    onClick={i <= alcanzado && i !== indice ? () => ir(i) : undefined}
                  />
                ))}
              </Box>
              {titular?.numeroHermano && (
                <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 3 }}>Hermano n.º {titular.numeroHermano}</Typography>
              )}
            </Box>
          )}
          <Box component="main" sx={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, maxWidth: 760 }}>
            {errorPaso && <Alert severity="error">{errorPaso}</Alert>}
            {contenido}
            {mostrarIndice && indice > 0 && !cambiandoCuota && (
              <Button onClick={() => ir(indice - 1)} sx={{ alignSelf: 'flex-start', color: 'text.secondary', textTransform: 'none', letterSpacing: 0, fontSize: 15, px: 0.5 }}>
                ← Atrás
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    </>
  )
}

function Encabezado({ antetitulo, titulo, texto }: { antetitulo: string; titulo: string; texto: string }) {
  return (
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'text.secondary' }}>{antetitulo}</Typography>
      <Typography variant="h3" component="h1" sx={{ fontSize: { xs: 26, md: 32 }, mt: 0.5, textWrap: 'balance' }}>{titulo}</Typography>
      <Typography sx={{ color: 'text.secondary', mt: 1, maxWidth: '62ch' }}>{texto}</Typography>
    </Box>
  )
}

/** Las dos respuestas de cada paso, grandes: es lo único que hay que hacer en él. */
function Pregunta({ onSi, onCambiar, cambiado }: { onSi: () => void; onCambiar: () => void; cambiado: boolean }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {cambiado && <Typography role="status" sx={{ fontSize: 14, color: 'success.light' }}>Guardado. Comprueba que ahora está bien.</Typography>}
      <Typography component="p" sx={{ fontSize: 18, fontWeight: 600 }}>¿Está todo bien?</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <Boton onClick={onSi} sx={{ py: 1.75, fontSize: 16 }}>Sí, es correcto</Boton>
        <Boton appVariant="outline" onClick={onCambiar} sx={{ py: 1.75, fontSize: 16 }}>Hay algo que cambiar</Boton>
      </Box>
    </Box>
  )
}

function ItemIndice({ numero, etiqueta, hecho, actual, onClick }: { numero: number; etiqueta: string; hecho: boolean; actual: boolean; onClick?: () => void }) {
  return (
    <Box component="li">
      <Box
        component={onClick ? 'button' : 'div'}
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        aria-current={actual ? 'step' : undefined}
        sx={{
          appearance: 'none', border: 0, font: 'inherit', textAlign: 'left', width: '100%',
          display: 'flex', alignItems: 'center', gap: 1.5, px: 1.25, py: 1.1, borderRadius: '8px',
          cursor: onClick ? 'pointer' : 'default',
          color: actual ? 'text.primary' : 'text.secondary', fontWeight: actual ? 600 : 500, fontSize: 15,
          backgroundColor: actual ? 'rgba(160,61,68,0.22)' : 'transparent',
          '&:hover': onClick ? { backgroundColor: 'rgba(255,255,255,0.05)' } : undefined,
          '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 2 },
        }}
      >
        <Box aria-hidden="true" sx={{
          flexShrink: 0, width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
          border: '2px solid', '& svg': { fontSize: 16 },
          borderColor: hecho ? 'success.main' : actual ? 'secondary.main' : 'rgba(204,196,201,0.25)',
          backgroundColor: hecho ? 'success.main' : 'transparent',
          // El blanco sobre el verde claro del tema oscuro no llega a 3:1.
          color: hecho ? 'success.contrastText' : actual ? 'secondary.main' : 'text.secondary',
        }}>
          {hecho ? <CheckIcon /> : numero}
        </Box>
        <Box component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {etiqueta}
          {hecho && <Box component="span" sx={visuallyHidden}> (hecho)</Box>}
        </Box>
      </Box>
    </Box>
  )
}
