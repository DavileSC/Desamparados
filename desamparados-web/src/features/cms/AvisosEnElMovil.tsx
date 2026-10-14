import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Chip, Paper, Skeleton, Stack, TextField, Typography } from '@mui/material'
import CampoContrasena from '../../components/CampoContrasena'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import { ErrorDeApi } from '../../lib/api/cliente'
import { apuntarEsteMovil, misMoviles, quitarMovil, type MovilApuntado } from '../../lib/api/aprobacion'
import {
  admiteAvisos, darDeBajaEsteNavegador, enPantallaDeInicio, esIphone, esPantallaTactil, guardarEsteMovil,
  leerEsteMovil, nombreSugerido, olvidarEsteMovil, suscribirEsteNavegador,
} from '../../lib/movilApuntado'

const CLAVE_MOVILES = ['moviles-apuntados']

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-')
const fechaYHora = (iso: string) => new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-')

/**
 * Los móviles que reciben el aviso para aprobar la entrada al CMS (maquetas
 * «Mi seguridad»). Desde el ordenador solo se ven y se quitan: un móvil se
 * apunta desde él mismo, que es quien recibe el aviso y guarda la clave.
 */
export default function AvisosEnElMovil() {
  const queryClient = useQueryClient()
  const { data, isPending, isError } = useQuery({ queryKey: CLAVE_MOVILES, queryFn: misMoviles })
  // El número de este navegador si está apuntado (undefined mientras se lee).
  const [esteDispositivo, setEsteDispositivo] = useState<number | null | undefined>(undefined)
  const [aQuitar, setAQuitar] = useState<MovilApuntado | null>(null)

  useEffect(() => {
    let vivo = true
    void leerEsteMovil().then((movil) => { if (vivo) setEsteDispositivo(movil?.dispositivo ?? null) })
    return () => { vivo = false }
  }, [])

  // Una clave guardada de un móvil que ya no está en la lista (lo quitaron
  // desde otro sitio, o un rescate del doble factor) no sirve: se olvida.
  const caducado = !!data && esteDispositivo != null && !data.moviles.some((m) => m.id === esteDispositivo)
  useEffect(() => {
    if (caducado) void olvidarEsteMovil()
  }, [caducado])

  const quitar = useMutation({
    mutationFn: async (movil: MovilApuntado) => {
      await quitarMovil(movil.id)
      if (movil.id === esteDispositivo) {
        await olvidarEsteMovil()
        await darDeBajaEsteNavegador()
        setEsteDispositivo(null)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CLAVE_MOVILES }),
  })

  // Sin las claves del servidor la función no existe aquí: ni se menciona.
  if (data && !data.disponible) return null

  const moviles = data?.moviles ?? []
  const apuntadoAqui = esteDispositivo != null && moviles.some((m) => m.id === esteDispositivo)

  return (
    <Paper sx={{ p: { xs: 2, md: 3 }, maxWidth: 640, mt: 3 }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="h5" component="h2">Avisos en el móvil</Typography>
          {moviles.length > 0 && <Chip size="small" label={moviles.length === 1 ? '1 móvil' : `${moviles.length} móviles`} />}
        </Box>
        <Typography variant="body2" color="text.secondary">
          Al entrar desde el ordenador te llega un aviso a estos móviles: lo abres y tocas el número que ves en pantalla.
          El código de la app sigue valiendo si el aviso no llega.
        </Typography>

        {isError && <Alert severity="error" role="alert">No se han podido cargar tus móviles.</Alert>}
        {quitar.isError && <Alert severity="error" role="alert">{quitar.error instanceof ErrorDeApi ? quitar.error.message : 'No se ha podido quitar el móvil.'}</Alert>}

        {isPending ? (
          <Box aria-busy="true" aria-label="Cargando tus móviles">
            <Skeleton variant="text" width="60%" sx={{ fontSize: 15 }} />
            <Skeleton variant="text" width="40%" sx={{ fontSize: 13 }} />
          </Box>
        ) : moviles.length > 0 && (
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none', borderTop: 1, borderColor: 'divider' }}>
            {moviles.map((movil) => (
              <Box component="li" key={movil.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.75, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
                <Box component="svg" viewBox="0 0 24 24" aria-hidden="true" sx={{ width: 22, height: 22, flexShrink: 0, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', color: 'text.secondary' }}>
                  <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
                  <path d="M11 18.5h2" />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 500, overflowWrap: 'anywhere' }}>{movil.nombre}</Typography>
                    {movil.id === esteDispositivo && <Chip size="small" variant="outlined" label="Este móvil" />}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
                    Apuntado el {fecha(movil.creadoEn)} · {movil.usadoEn ? `último uso ${fechaYHora(movil.usadoEn)}` : 'sin usar todavía'}
                  </Typography>
                </Box>
                <Button color="error" disabled={quitar.isPending} onClick={() => setAQuitar(movil)} aria-label={`Quitar ${movil.nombre}`}>
                  Quitar
                </Button>
              </Box>
            ))}
          </Box>
        )}

        {data && esteDispositivo !== undefined && !apuntadoAqui && (
          <ApuntarAqui
            clavePublica={data.clavePublica}
            alApuntar={(dispositivo) => {
              setEsteDispositivo(dispositivo)
              void queryClient.invalidateQueries({ queryKey: CLAVE_MOVILES })
            }}
          />
        )}
      </Stack>

      <DialogoConfirmacion
        abierto={aQuitar !== null}
        titulo={`¿Quitar ${aQuitar?.nombre ?? 'este móvil'}?`}
        mensaje={aQuitar?.id === esteDispositivo
          ? 'Este móvil dejará de recibir los avisos. Para volver a usarlos, tendrás que apuntarlo otra vez.'
          : 'Ese móvil dejará de recibir los avisos. Para volver a usarlos, habrá que apuntarlo otra vez desde él.'}
        textoConfirmar="Quitar"
        onConfirmar={() => {
          if (aQuitar) quitar.mutate(aQuitar)
          setAQuitar(null)
        }}
        onCancelar={() => setAQuitar(null)}
      />
    </Paper>
  )
}

/**
 * Apuntar este navegador, según desde dónde se mira. También lo usa la
 * activación del doble factor, que en el ordenador enseña un QR en vez de la
 * nota (`enOrdenador`).
 */
export function ApuntarAqui({ clavePublica, alApuntar, enOrdenador }: {
  clavePublica: string | null
  alApuntar: (dispositivo: number) => void
  enOrdenador?: React.ReactNode
}) {
  if (!esPantallaTactil()) {
    return enOrdenador ?? (
      <Nota>Para apuntar un móvil, entra en «Mi seguridad» desde ese móvil y pulsa «Avisarme en este móvil».</Nota>
    )
  }
  // En iPhone, Web Push solo funciona con la web abierta desde la pantalla de inicio (iOS 16.4+).
  if (esIphone() && !enPantallaDeInicio()) return <AnadirAPantallaDeInicio />
  if (!admiteAvisos() || !clavePublica) {
    return <Nota>Este navegador no puede recibir avisos. Prueba con Chrome en Android, o con Safari en el iPhone desde la pantalla de inicio.</Nota>
  }
  return <FormularioApuntar clavePublica={clavePublica} alApuntar={alApuntar} />
}

function FormularioApuntar({ clavePublica, alApuntar }: { clavePublica: string; alApuntar: (dispositivo: number) => void }) {
  const [nombre, setNombre] = useState(nombreSugerido)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const apuntar = async () => {
    setOcupado(true)
    setError(null)
    let suscripcion: PushSubscription | null = null
    try {
      suscripcion = await suscribirEsteNavegador(clavePublica)
      const { movil, clave } = await apuntarEsteMovil(password, nombre.trim(), suscripcion.toJSON())
      // Sin la clave guardada el móvil no podría aprobar nada: mejor no dejarlo apuntado.
      if (!(await guardarEsteMovil({ dispositivo: movil.id, clave, nombre: movil.nombre }))) {
        await quitarMovil(movil.id).catch(() => undefined)
        throw new Error('Este navegador no deja guardar la clave del móvil (¿navegación privada?). Prueba fuera de ella.')
      }
      setPassword('')
      alApuntar(movil.id)
    } catch (e) {
      await suscripcion?.unsubscribe().catch(() => undefined)
      setError(e instanceof Error ? e.message : 'No se ha podido apuntar este móvil.')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Box
      component="form"
      onSubmit={(e) => { e.preventDefault(); void apuntar() }}
      sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}
    >
      <Typography variant="h6" component="h3">Avisarme en este móvil</Typography>
      {error && <Alert severity="error" role="alert">{error}</Alert>}
      <TextField
        label="Nombre de este móvil"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        helperText="Para reconocerlo en la lista."
        slotProps={{ htmlInput: { maxLength: 60 } }}
        required
      />
      <CampoContrasena
        label="Tu contraseña"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <Button type="submit" variant="contained" disabled={ocupado || !nombre.trim() || !password} sx={{ minHeight: 48 }}>
        Avisarme en este móvil
      </Button>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
        El móvil te pedirá permiso para mostrar notificaciones: acéptalo. Te mandaremos un correo para confirmar que lo has apuntado tú.
      </Typography>
    </Box>
  )
}

function AnadirAPantallaDeInicio() {
  const pasos = [
    <>Toca <b>Compartir</b> en la barra de Safari.</>,
    <>Elige <b>Añadir a pantalla de inicio</b>.</>,
    <>Abre la web desde el icono nuevo, entra en el CMS y vuelve a «Mi seguridad».</>,
  ]
  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      <Typography variant="body2" sx={{ fontSize: 15 }}>
        En el iPhone los avisos solo llegan si la web está en la pantalla de inicio. Es un momento:
      </Typography>
      <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 1.75 }}>
        {pasos.map((paso, i) => (
          <Box component="li" key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', fontSize: 15, lineHeight: 1.45 }}>
            <Box
              aria-hidden="true"
              sx={{
                flexShrink: 0, width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 600, color: 'primary.main', bgcolor: (t) => `color-mix(in srgb, ${t.palette.primary.main} 10%, transparent)`,
              }}
            >
              {i + 1}
            </Box>
            <span>{paso}</span>
          </Box>
        ))}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
        Hace falta iOS 16.4 o posterior. En Android no hay que hacer nada de esto.
      </Typography>
    </Stack>
  )
}

function Nota({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ bgcolor: 'action.hover', borderRadius: 1.5, px: 1.75, py: 1.5 }}>
      {children}
    </Typography>
  )
}
