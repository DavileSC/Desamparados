import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Typography, useTheme } from '@mui/material'
import type { AuthUser } from './store'
import { codigoError, errorMessage } from './errores'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { entrarDesdeEsteMovil, esMovilNoApuntado, esperarAprobacion } from '../../../lib/api/aprobacion'
import { leerEsteMovil, olvidarEsteMovil } from '../../../lib/movilApuntado'

/** Cómo sigue el acceso al salir de la espera. */
interface Salidas {
  alAprobar: (user: AuthUser) => void
  /** Al código de la app, con lo que pasó si no lo eligió quien entra. */
  alUsarCodigo: (aviso?: string) => void
  /** A la contraseña: el testigo del primer paso ya no vale. */
  alVolver: (aviso?: string) => void
}

/** Cada cuánto pregunta el ordenador. Una respuesta PENDIENTE no gasta el limitador. */
const CADA_MS = 2000
/** Margen tras la hora de caducar por si el reloj de este ordenador va adelantado. */
const MARGEN_MS = 5000

function minutosYSegundos(ms: number) {
  const segundos = Math.ceil(ms / 1000)
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`
}

const PASOS = [
  'Abre el aviso que te ha llegado al móvil.',
  'Toca el número que ves aquí.',
  'Esta pantalla entra sola en el CMS.',
]

/**
 * La espera en el ordenador (maqueta 1B): el número dentro de un aro que se
 * vacía y los tres pasos al lado, que bajan debajo cuando no caben. Pregunta
 * cada 2 s; la sesión llega en la misma respuesta que dice «aprobada».
 *
 * Lo que no sea seguir esperando acaba en el código de la app, que siempre
 * vale: ni el aviso ni la red pueden dejar a nadie fuera del CMS.
 */
export function EsperaDeLaAprobacion({ numero, expiraEn, ...salidas }: { numero: number; expiraEn: string } & Salidas) {
  const [fin] = useState(() => new Date(expiraEn).getTime())
  const [total] = useState(() => Math.max(1, fin - Date.now()))
  const [ahora, setAhora] = useState(() => Date.now())
  const restante = Math.max(0, fin - ahora)

  // Las salidas cambian en cada render del formulario; la pregunta no debe
  // volver a empezar por eso.
  const salidasRef = useRef(salidas)
  useEffect(() => { salidasRef.current = salidas })

  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(reloj)
  }, [])

  useEffect(() => {
    let viva = true
    let temporizador: ReturnType<typeof setTimeout>
    const preguntar = async () => {
      try {
        const respuesta = await esperarAprobacion()
        if (!viva) return
        const { alAprobar, alUsarCodigo, alVolver } = salidasRef.current
        switch (respuesta.estado) {
          case 'APROBADA':
            return alAprobar(respuesta.user)
          case 'RECHAZADA':
            return alVolver('La entrada se ha rechazado desde el móvil.')
          case 'FALLADA':
            return alUsarCodigo('En el móvil se eligió otro número y la aprobación se ha anulado. Escribe el código de tu app de autenticación.')
          case 'CADUCADA':
            return alUsarCodigo('El aviso ha caducado sin aprobarse. Escribe el código de tu app de autenticación.')
        }
      } catch (e) {
        if (!viva) return
        if (codigoError(e) === 'PENDING_2FA_REQUIRED') {
          return salidasRef.current.alVolver(errorMessage(e, 'La verificación ha caducado. Vuelve a introducir tu email y contraseña.'))
        }
        // Módulo apagado mientras tanto (404), bloqueo por intentos (429) u
        // otra negativa del servidor: el código de la app. Sin respuesta (la
        // red un momento), se sigue preguntando.
        if (e instanceof ErrorDeApi && e.status >= 400 && e.status < 500) {
          return salidasRef.current.alUsarCodigo()
        }
      }
      if (Date.now() > fin + MARGEN_MS) {
        return salidasRef.current.alUsarCodigo('El aviso ha caducado sin aprobarse. Escribe el código de tu app de autenticación.')
      }
      temporizador = setTimeout(() => { void preguntar() }, CADA_MS)
    }
    temporizador = setTimeout(() => { void preguntar() }, CADA_MS)
    return () => {
      viva = false
      clearTimeout(temporizador)
    }
  }, [fin])

  const tema = useTheme()
  const radio = 100
  const vuelta = 2 * Math.PI * radio

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: { xs: 3, sm: 5 } }}>
      <Box sx={{ position: 'relative', width: { xs: 180, sm: 220 }, aspectRatio: '1', flexShrink: 0 }}>
        <svg viewBox="0 0 220 220" aria-hidden="true" style={{ width: '100%', height: '100%', display: 'block' }}>
          <circle cx="110" cy="110" r={radio} fill="none" strokeWidth="6" stroke={tema.palette.divider} />
          <circle
            cx="110"
            cy="110"
            r={radio}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            stroke={tema.palette.primary.main}
            strokeDasharray={vuelta}
            strokeDashoffset={vuelta * (1 - restante / total)}
            transform="rotate(-90 110 110)"
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <Typography
            component="p"
            aria-label={`Número: ${numero}`}
            sx={{ m: 0, fontSize: { xs: 76, sm: 92 }, fontWeight: 600, lineHeight: 1, letterSpacing: '4px', color: 'primary.main' }}
          >
            {numero}
          </Typography>
          <Typography variant="body2" color="text.secondary">quedan {minutosYSegundos(restante)}</Typography>
        </Box>
      </Box>

      <Box sx={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1.75 }}>
          {PASOS.map((paso, i) => (
            <Box component="li" key={paso} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <Box
                aria-hidden="true"
                sx={{
                  flexShrink: 0, width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 600, color: 'primary.main', bgcolor: (t) => `color-mix(in srgb, ${t.palette.primary.main} 10%, transparent)`,
                }}
              >
                {i + 1}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 15, lineHeight: 1.45 }}>{paso}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1 }}>
          <Button variant="outlined" onClick={() => salidas.alUsarCodigo()}>Usar el código de la app</Button>
          <Button onClick={() => salidas.alVolver()} sx={{ color: 'text.secondary' }}>Volver</Button>
        </Box>
      </Box>
    </Box>
  )
}

/**
 * Se entra desde el mismo móvil que está apuntado (maqueta «mismo móvil»): su
 * clave hace de segundo factor, sin aviso ni número, que solo protegen de una
 * entrada hecha desde otro sitio.
 */
export function EntrarDesdeEsteMovil({ nombre, alAprobar, alUsarCodigo, alVolver }: { nombre: string } & Salidas) {
  const tema = useTheme()
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const aprobar = async () => {
    setOcupado(true)
    setError(null)
    try {
      const movil = await leerEsteMovil()
      if (!movil) return alUsarCodigo('Este navegador ya no guarda la clave del móvil. Escribe el código de tu app de autenticación.')
      const { user } = await entrarDesdeEsteMovil({ dispositivo: movil.dispositivo, clave: movil.clave })
      alAprobar(user)
    } catch (e) {
      if (esMovilNoApuntado(e)) {
        await olvidarEsteMovil()
        return alUsarCodigo(errorMessage(e, 'Este móvil ya no está apuntado.'))
      }
      if (codigoError(e) === 'PENDING_2FA_REQUIRED') {
        return alVolver(errorMessage(e, 'La verificación ha caducado. Vuelve a introducir tu email y contraseña.'))
      }
      setError(errorMessage(e, 'No se ha podido entrar desde este móvil.'))
      setOcupado(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center' }}>
      <Box
        aria-hidden="true"
        sx={{ width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: (t) => `color-mix(in srgb, ${t.palette.primary.main} 10%, transparent)` }}
      >
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke={tema.palette.primary.main} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
          <path d="M9.5 12l2 2 3.5-3.5" />
        </svg>
      </Box>
      <Typography color="text.secondary" sx={{ fontSize: 16, lineHeight: 1.5 }}>
        Contraseña correcta. Este móvil está apuntado
        {nombre ? <> como <Box component="b" sx={{ color: 'text.primary', fontWeight: 500 }}>{nombre}</Box></> : null}: no hace falta el código.
      </Typography>
      {error && <Alert severity="error" role="alert" sx={{ alignSelf: 'stretch', textAlign: 'left' }}>{error}</Alert>}
      <Button variant="contained" fullWidth disabled={ocupado} onClick={() => { void aprobar() }} sx={{ minHeight: 52, fontSize: 17 }}>
        Aprobar entrada en este móvil
      </Button>
      <Button variant="outlined" fullWidth onClick={() => alUsarCodigo()}>Usar el código de la app</Button>
      <Button onClick={() => alVolver()} sx={{ color: 'text.secondary' }}>Volver</Button>
    </Box>
  )
}
