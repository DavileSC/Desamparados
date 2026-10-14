import { useEffect, useState, type ReactNode } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { Alert, Box, Button, GlobalStyles, Skeleton, ThemeProvider, Typography, useTheme } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { ESTILOS_GLOBALES_CMS, crearTemaCms } from '../../../theme/cms'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { aprobarEntrada, esMovilNoApuntado, rechazarEntrada, verAprobacion, type CredencialesDelMovil, type VistaDeLaAprobacion } from '../../../lib/api/aprobacion'
import { esIphone, enPantallaDeInicio, leerEsteMovil, olvidarEsteMovil } from '../../../lib/movilApuntado'
import { site } from '../../../config/site'

// Como el acceso al CMS: tema claro fijo, calculado una vez (ver AccesoCmsPage).
const TEMA = crearTemaCms('claro')

type Final = Exclude<VistaDeLaAprobacion['estado'], 'PENDIENTE'>

type Pantalla =
  | { tipo: 'cargando' }
  | { tipo: 'sin-movil'; motivo?: string }
  | { tipo: 'pendiente'; movil: CredencialesDelMovil; opciones: number[]; desde: string; expiraEn: string }
  /** `propia`: lo acaba de hacer quien mira; si no, ya estaba así al abrir el aviso. */
  | { tipo: 'final'; estado: Final; propia: boolean; desde?: string }
  | { tipo: 'error'; mensaje: string }

function minutosYSegundos(ms: number) {
  const segundos = Math.ceil(ms / 1000)
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`
}

/**
 * Lo que se abre al tocar el aviso en el móvil (maqueta 2B): tres números, uno
 * el del ordenador, y «No he sido yo». Va sin sesión del CMS (puede haber
 * caducado en el móvil): lo que prueba que es este móvil es la clave que guardó
 * al apuntarse.
 */
export default function AprobarEntradaPage() {
  const { id = '' } = useParams()
  const [pantalla, setPantalla] = useState<Pantalla>({ tipo: 'cargando' })

  useEffect(() => {
    let viva = true
    void (async () => {
      const movil = await leerEsteMovil()
      if (!viva) return
      if (!movil) return setPantalla({ tipo: 'sin-movil' })
      // Solo lo que pide la API: el nombre se queda en el móvil.
      const credenciales = { dispositivo: movil.dispositivo, clave: movil.clave }
      try {
        const vista = await verAprobacion(id, credenciales)
        if (!viva) return
        setPantalla(vista.estado === 'PENDIENTE'
          ? { tipo: 'pendiente', movil: credenciales, ...vista }
          : { tipo: 'final', estado: vista.estado, propia: false })
      } catch (e) {
        if (!viva) return
        setPantalla(await pantallaDeError(e))
      }
    })()
    return () => { viva = false }
  }, [id])

  return (
    <ThemeProvider theme={TEMA}>
      <GlobalStyles styles={ESTILOS_GLOBALES_CMS} />
      <Helmet>
        <title>{`Aprobar la entrada | CMS ${site.nombreCorto}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Box
        component="main"
        sx={{
          minHeight: '100dvh', boxSizing: 'border-box', bgcolor: 'background.paper', color: 'text.primary',
          px: 3, pt: { xs: 9, sm: 12 }, pb: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 420, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {pantalla.tipo === 'cargando' && <Cargando />}
          {pantalla.tipo === 'sin-movil' && <SinMovil motivo={pantalla.motivo} />}
          {pantalla.tipo === 'pendiente' && <Elegir id={id} {...pantalla} alAcabar={setPantalla} />}
          {pantalla.tipo === 'final' && <Resultado {...pantalla} />}
          {pantalla.tipo === 'error' && (
            <Aviso tono="info" titulo="No se ha podido abrir">{pantalla.mensaje}</Aviso>
          )}
        </Box>
      </Box>
    </ThemeProvider>
  )
}

/** Qué enseñar cuando el servidor no da la aprobación. */
async function pantallaDeError(e: unknown): Promise<Pantalla> {
  if (esMovilNoApuntado(e)) {
    // Lo quitaron desde «Mi seguridad» o lo borró un rescate del doble factor.
    await olvidarEsteMovil()
    return { tipo: 'sin-movil', motivo: e instanceof ErrorDeApi ? e.message : undefined }
  }
  if (e instanceof ErrorDeApi && e.status === 404) {
    // Ni existe ni es de esta cuenta, o el módulo está apagado: lo mismo para quien mira.
    return { tipo: 'final', estado: 'CADUCADA', propia: false }
  }
  return { tipo: 'error', mensaje: e instanceof ErrorDeApi ? e.message : 'Comprueba la conexión del móvil y vuelve a abrir el aviso.' }
}

function Elegir({
  id, movil, opciones, desde, expiraEn, alAcabar,
}: Extract<Pantalla, { tipo: 'pendiente' }> & { id: string; alAcabar: (p: Pantalla) => void }) {
  const tema = useTheme()
  const [fin] = useState(() => new Date(expiraEn).getTime())
  const [ahora, setAhora] = useState(() => Date.now())
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const restante = Math.max(0, fin - ahora)

  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(reloj)
  }, [])

  useEffect(() => {
    if (restante === 0 && !ocupado) alAcabar({ tipo: 'final', estado: 'CADUCADA', propia: false, desde })
  }, [restante, ocupado, alAcabar, desde])

  const responder = async (llamada: () => Promise<{ estado: VistaDeLaAprobacion['estado'] }>) => {
    setOcupado(true)
    setError(null)
    try {
      const { estado } = await llamada()
      alAcabar(estado === 'PENDIENTE'
        ? { tipo: 'error', mensaje: 'La entrada sigue esperando. Vuelve a abrir el aviso.' }
        : { tipo: 'final', estado, propia: true, desde })
    } catch (e) {
      const siguiente = await pantallaDeError(e)
      if (siguiente.tipo === 'error') {
        setError(siguiente.mensaje)
        setOcupado(false)
      } else {
        alAcabar(siguiente)
      }
    }
  }

  return (
    <>
      <Icono fondo={`color-mix(in srgb, ${tema.palette.primary.main} 10%, transparent)`}>
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke={tema.palette.primary.main} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="12" rx="1.5" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      </Icono>
      <Typography component="h1" sx={{ mt: 2.5, mb: 1, fontSize: 26, fontWeight: 600, lineHeight: 1.2 }}>
        Alguien entra en el CMS con tu cuenta
      </Typography>
      <Typography color="text.secondary" sx={{ fontSize: 15 }}>{desde}</Typography>

      <Typography id="pregunta-numero" sx={{ mt: 6, mb: 2.5, fontSize: 17, fontWeight: 500 }}>
        ¿Qué número ves en el ordenador?
      </Typography>
      <Box role="group" aria-labelledby="pregunta-numero" sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        {opciones.map((numero) => (
          <Box
            component="button"
            type="button"
            key={numero}
            disabled={ocupado}
            onClick={() => { void responder(() => aprobarEntrada(id, movil, numero)) }}
            sx={{
              width: 96, height: 96, borderRadius: '50%', fontFamily: 'inherit', fontSize: 36, fontWeight: 600, cursor: 'pointer',
              bgcolor: 'background.default', color: 'text.primary', border: '1.5px solid', borderColor: 'divider',
              '&:hover': { borderColor: 'primary.main' },
              '&:focus-visible': { outline: `3px solid ${tema.palette.primary.main}`, outlineOffset: 2 },
              '&:disabled': { opacity: 0.6, cursor: 'default' },
            }}
          >
            {numero}
          </Box>
        ))}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>
        Si fallas, la entrada se anula · quedan {minutosYSegundos(restante)}
      </Typography>
      {error && <Alert severity="error" role="alert" sx={{ mt: 3, textAlign: 'left' }}>{error}</Alert>}

      <Box sx={{ flex: 1, minHeight: 32 }} />
      <Button
        disabled={ocupado}
        onClick={() => { void responder(() => rechazarEntrada(id, movil)) }}
        sx={{ minHeight: 48, fontSize: 16, color: 'error.main', textDecoration: 'underline', textUnderlineOffset: '3px' }}
      >
        No he sido yo
      </Button>
    </>
  )
}

/** Cómo acabó, con lo que toca hacer después. */
function Resultado({ estado, propia, desde }: Extract<Pantalla, { tipo: 'final' }>) {
  const pie = desde ? <Typography variant="body2" color="text.secondary">{desde}</Typography> : null
  switch (estado) {
    case 'APROBADA':
    case 'USADA':
      return (
        <Aviso tono="ok" titulo={propia ? 'Entrada aprobada' : 'Esta entrada ya está aprobada'} pie={pie}>
          {propia ? 'El ordenador ya está entrando en el CMS. Puedes cerrar esta pantalla.' : 'No hay nada más que hacer. Puedes cerrar esta pantalla.'}
        </Aviso>
      )
    case 'RECHAZADA':
      return (
        <Aviso
          tono="bloqueo"
          titulo="Entrada bloqueada"
          pie={pie}
          accion={(
            <Button component={RouterLink} to="/reset-password?area=cms" variant="contained" sx={{ mt: 3.5, minHeight: 48, px: 3, fontSize: 16 }}>
              Cambiar la contraseña
            </Button>
          )}
        >
          {propia
            ? 'Nadie ha entrado. Hemos avisado a Administración. Si quien lo intentó sabe tu contraseña, cámbiala ahora.'
            : 'Esta entrada ya se rechazó y nadie ha entrado. Si no fuiste tú, cambia la contraseña.'}
        </Aviso>
      )
    case 'FALLADA':
      return (
        <Aviso tono="bloqueo" titulo="Número equivocado" pie={pie}>
          La entrada se ha anulado y nadie ha entrado. Si eras tú, vuelve a intentarlo desde el ordenador o escribe allí el código de la app.
        </Aviso>
      )
    case 'CADUCADA':
      return (
        <Aviso tono="info" titulo="Esta entrada ya no está esperando" pie={pie}>
          Ha caducado o ya se resolvió. Si estás entrando desde el ordenador, vuelve a intentarlo o escribe allí el código de la app.
        </Aviso>
      )
  }
}

function SinMovil({ motivo }: { motivo?: string }) {
  // En iPhone, Safari y la web de la pantalla de inicio no comparten lo que
  // guardan: la clave solo está donde se apuntó, que es el icono.
  const desdeSafari = esIphone() && !enPantallaDeInicio()
  return (
    <Aviso
      tono="info"
      titulo="Este móvil no está apuntado"
      accion={!desdeSafari && (
        <Button component={RouterLink} to="/cms/mi-seguridad" variant="outlined" sx={{ mt: 3.5, minHeight: 48 }}>
          Ir a «Mi seguridad»
        </Button>
      )}
    >
      {desdeSafari
        ? 'En el iPhone, abre la web desde el icono de la pantalla de inicio: es ahí donde se apuntó el móvil.'
        : motivo ?? 'Para aprobar entradas desde aquí, apunta este móvil en «Mi seguridad». Mientras tanto, en el ordenador vale el código de la app.'}
    </Aviso>
  )
}

function Cargando() {
  return (
    <Box aria-busy="true" aria-label="Cargando" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      <Skeleton variant="circular" width={56} height={56} />
      <Skeleton variant="text" width="85%" sx={{ mt: 2.5, fontSize: 26 }} />
      <Skeleton variant="text" width="45%" sx={{ fontSize: 15 }} />
      <Box sx={{ display: 'flex', gap: 2, mt: 9 }}>
        {[0, 1, 2].map((i) => <Skeleton key={i} variant="circular" width={96} height={96} />)}
      </Box>
    </Box>
  )
}

function Icono({ fondo, tamano = 56, children }: { fondo: string; tamano?: number; children: ReactNode }) {
  return (
    <Box aria-hidden="true" sx={{ width: tamano, height: tamano, borderRadius: '50%', bgcolor: fondo, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </Box>
  )
}

/** Un resultado a pantalla entera (maquetas «Entrada aprobada» y «Entrada bloqueada»). */
function Aviso({ tono, titulo, children, accion, pie }: { tono: 'ok' | 'bloqueo' | 'info'; titulo: string; children: ReactNode; accion?: ReactNode; pie?: ReactNode }) {
  const tema = useTheme()
  const color = tono === 'ok' ? tema.palette.success.main : tono === 'bloqueo' ? tema.palette.error.main : tema.palette.primary.main
  return (
    <>
      <Box sx={{ height: { xs: 64, sm: 96 } }} />
      <Icono tamano={88} fondo={`color-mix(in srgb, ${color} 12%, transparent)`}>
        <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {tono === 'ok' && <path d="M5 12.5l4.5 4.5L19 7.5" />}
          {tono === 'bloqueo' && <><rect x="5" y="11" width="14" height="10" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>}
          {tono === 'info' && <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>}
        </svg>
      </Icono>
      <Typography component="h1" sx={{ mt: 3.5, mb: 1.25, fontSize: 26, fontWeight: 600, lineHeight: 1.2 }}>{titulo}</Typography>
      <Typography color="text.secondary" sx={{ fontSize: 16, lineHeight: 1.5, maxWidth: 320 }}>{children}</Typography>
      {accion}
      <Box sx={{ flex: 1, minHeight: 32 }} />
      {pie}
    </>
  )
}
