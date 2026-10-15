import { useId, useState } from 'react'
import { Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Switch, Typography } from '@mui/material'
import TarjetaCristal from '../../../components/TarjetaCristal'
import { useModulos } from '../../../hooks/useModulos'
import { esPantallaTactil } from '../../../lib/avisosDelNavegador'
import { PREGUNTADO, escribir, leer, useAvisosDelArea } from './avisosDelArea'
import Boton from '../../../components/Boton'

/** Los fallos del permiso del navegador son Error a secas, con un mensaje ya escrito para leerlo. */
const mensaje = (e: unknown) => (e instanceof Error && e.message ? e.message : 'No se ha podido. Vuelve a probar en un momento.')

/**
 * Los avisos al móvil del área de hermanos (traspaso-2026-10-14 §5): la
 * apertura de papeletas y los avisos de la Junta llegan aquí en vez de por
 * correo. Un interruptor (forma A de las maquetas): el nombre del móvil se pone
 * solo, para que a nadie le cueste activarlo.
 */

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })

/** Los tres pasos del iPhone: sin la web en la pantalla de inicio, Safari no recibe avisos. */
function PasosDelIphone() {
  return (
    <>
      <Typography sx={{ fontSize: 15, color: 'text.secondary' }}>
        En el iPhone, los avisos solo llegan si abres la web desde la pantalla de inicio:
      </Typography>
      <Box component="ol" sx={{ m: 0, pl: 2.5, display: 'grid', gap: 0.75, fontSize: 15, color: 'text.secondary', lineHeight: 1.45 }}>
        <li>Pulsa el botón <strong>Compartir</strong> de Safari.</li>
        <li>Elige <strong>Añadir a pantalla de inicio</strong>.</li>
        <li>Abre la web desde ese icono, entra y vuelve aquí.</li>
      </Box>
    </>
  )
}

export default function AvisosEnElMovil() {
  const idTitulo = useId()
  const { activo } = useModulos()
  const a = useAvisosDelArea()
  if (!a.disponible) return null

  const tactil = esPantallaTactil()
  const ocupado = a.activar.isPending || a.quitar.isPending
  const error = a.activar.error ?? a.quitar.error

  return (
    <TarjetaCristal component="section" aria-labelledby={idTitulo} sx={{ p: { xs: 2.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      <Typography id={idTitulo} component="h2" sx={{ fontSize: 20, fontWeight: 600 }}>Avisos en el móvil</Typography>
      <Typography sx={{ fontSize: 15, color: 'text.secondary', maxWidth: '62ch' }}>
        Te avisamos aquí, al momento, en lugar de por correo.
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {activo('procesion') && <Chip size="small" label="Apertura de papeletas" />}
        {activo('comunicados') && <Chip size="small" label="Avisos de la Junta" />}
      </Box>

      {a.posible === 'pantalla-de-inicio' && !a.esteMovil ? (
        <PasosDelIphone />
      ) : a.posible === 'solo-movil' && !a.esteMovil ? (
        <Typography sx={{ fontSize: 15, color: 'text.secondary' }}>
          Los avisos se activan desde el móvil o la tableta: entra en «Mi perfil» desde allí.
        </Typography>
      ) : a.posible === 'no' && !a.esteMovil ? (
        <Typography sx={{ fontSize: 15, color: 'text.secondary' }}>
          Este navegador no puede recibir avisos. Prueba desde el móvil, con Chrome o Safari.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography component="label" htmlFor={`${idTitulo}-interruptor`} sx={{ fontSize: 16, fontWeight: 600, display: 'block' }}>
              {tactil ? 'Avisos en este móvil' : 'Avisos en este ordenador'}
            </Typography>
            {ocupado ? (
              // La primera vez el móvil pide permiso, instala el service worker
              // y se da de alta en el servicio de avisos (Google, Apple): son
              // unos segundos sin nada que ver, y sin esto parece colgado.
              <Typography role="status" sx={{ fontSize: 13.5, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={14} color="inherit" aria-hidden />
                {a.activar.isPending ? 'Activando… puede tardar unos segundos' : 'Quitando…'}
              </Typography>
            ) : (
              <Typography sx={{ fontSize: 13.5, color: a.esteMovil ? 'success.light' : 'text.secondary' }}>
                {a.esteMovil ? 'Activados' : 'Desactivados'}
              </Typography>
            )}
          </Box>
          <Switch
            id={`${idTitulo}-interruptor`}
            checked={Boolean(a.esteMovil)}
            disabled={ocupado || !a.cargado}
            onChange={(e) => {
              if (e.target.checked) a.activar.mutate()
              else if (a.esteMovil) a.quitar.mutate(a.esteMovil.id)
            }}
          />
        </Box>
      )}

      {error && <Typography role="alert" sx={{ fontSize: 14, color: 'error.light' }}>{mensaje(error)}</Typography>}

      {a.otros.length > 0 && (
        <Box component="ul" aria-label="Otros móviles con avisos" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {a.otros.map((m) => (
            <Box component="li" key={m.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, py: 1.25, borderTop: 1, borderColor: 'divider' }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 15.5, fontWeight: 600 }}>{a.esteMovil ? 'Otro móvil' : m.nombre}</Typography>
                <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>{a.esteMovil ? `${m.nombre} · ` : ''}desde el {fecha(m.creadoEn)}</Typography>
              </Box>
              <Button size="small" disabled={ocupado} onClick={() => a.quitar.mutate(m.id)} aria-label={`Quitar los avisos de ${m.nombre}`} sx={{ color: 'primary.light', fontWeight: 600, minHeight: 40, flexShrink: 0 }}>
                Quitar
              </Button>
            </Box>
          ))}
        </Box>
      )}

      <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>
        El boletín y las convocatorias siguen llegando por correo.
      </Typography>
    </TarjetaCristal>
  )
}

/**
 * La primera vez que se entra en «Mi perfil» desde un móvil, se pregunta si
 * activar los avisos (lo pidió el usuario el 14-10-2026): casi nadie iría a
 * buscar el interruptor. Una sola vez por navegador, conteste lo que conteste.
 */
export function PreguntaDeAvisos() {
  const a = useAvisosDelArea()
  const [cerrada, setCerrada] = useState(() => leer(PREGUNTADO) !== null)

  const toca = a.disponible && a.cargado && !a.esteMovil && !cerrada && esPantallaTactil() && a.posible !== 'no'
  if (!toca) return null

  const cerrar = () => {
    escribir(PREGUNTADO, 'si')
    setCerrada(true)
  }

  return (
    <Dialog open onClose={cerrar} aria-labelledby="pregunta-avisos" fullWidth maxWidth="xs">
      <DialogTitle id="pregunta-avisos">¿Te avisamos en este móvil?</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1.5 }}>
        <Typography sx={{ fontSize: 15, color: 'text.secondary' }}>
          Cuando se abra la solicitud de papeletas o la Junta mande un aviso, te llegará aquí al momento, en lugar de por correo.
        </Typography>
        {a.posible === 'pantalla-de-inicio' && <PasosDelIphone />}
        {a.activar.error && <Typography role="alert" sx={{ fontSize: 14, color: 'error.light' }}>{mensaje(a.activar.error)}</Typography>}
        {a.activar.isPending && (
          <Typography role="status" sx={{ fontSize: 14, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={14} color="inherit" aria-hidden />
            Activando… puede tardar unos segundos
          </Typography>
        )}
        <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>
          Puedes cambiarlo cuando quieras en «Cuenta».
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Boton appVariant="outline" onClick={cerrar}>{a.posible === 'si' ? 'Ahora no' : 'Entendido'}</Boton>
        {a.posible === 'si' && (
          <Boton disabled={a.activar.isPending} onClick={() => a.activar.mutate(undefined, { onSuccess: cerrar })}>
            {a.activar.isPending ? 'Activando…' : 'Activar'}
          </Boton>
        )}
      </DialogActions>
    </Dialog>
  )
}
