import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Alert, Box, Chip, CircularProgress, MenuItem, TextField, Typography } from '@mui/material'
import { Link, useBlocker, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import TarjetaCristal from '../../../components/TarjetaCristal'
import Boton from '../../../components/Boton'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import { useAvisoAlCerrarLaPestana } from '../../../hooks/useAvisoAlCerrarLaPestana'
import { misFichas, type ApiProfile } from '../../../lib/api/perfil'
import { aniosCumplidos } from '../../altas/public/schema'
import { Contacto, CuotaYPago, DatosPersonales, VidaDeHermano } from './apartados'
import ApartadoContrasena from './ApartadoContrasena'
import { PARENTESCO, aDia, diaLegible } from './etiquetas'
import { site } from '../../../config/site'
import { useModulos } from '../../../hooks/useModulos'
import type { Requisito } from '../../../domain/modulos'

/** La del titular primero; luego las de quienes tiene a su cargo, de mayor a menor. */
const ordenar = (fichas: ApiProfile[]) =>
  [...fichas].sort((a, b) => Number(b.esTitular) - Number(a.esTitular) || a.fechaNacimiento.localeCompare(b.fechaNacimiento))

/** «Tú · n.º 42», «Sobrino o sobrina · 12 años», «Hija o hijo · pendiente». */
function subtitulo(ficha: ApiProfile) {
  const quien = ficha.esTitular ? 'Tú' : ficha.parentesco ? PARENTESCO[ficha.parentesco] : 'A tu cargo'
  if (!ficha.activo) return `${quien} · pendiente`
  if (ficha.esTitular) return ficha.numeroHermano ? `${quien} · n.º\u00a0${ficha.numeroHermano}` : quien
  return `${quien} · ${aniosCumplidos(aDia(ficha.fechaNacimiento))} años`
}

const iniciales = (f: ApiProfile) => `${f.nombre.trim()[0] ?? ''}${(f.primerApellido ?? f.apellidos).trim()[0] ?? ''}`.toUpperCase()

type ClaveApartado = 'personales' | 'contacto' | 'hermano' | 'cuota' | 'contrasena'

/** El nombre corto es el del móvil: con los largos, cinco pestañas no caben ni en dos filas. */
const PESTANAS: { clave: ClaveApartado; titulo: string; corto: string; modulo?: Requisito }[] = [
  { clave: 'personales', titulo: 'Datos personales', corto: 'Datos' },
  { clave: 'contacto', titulo: 'Contacto y domicilio', corto: 'Contacto' },
  { clave: 'hermano', titulo: 'Vida de hermano', corto: 'Hermano', modulo: 'procesion' },
  // Con remesas también: el IBAN es lo que se carga en la domiciliación, y solo lo cambia el hermano.
  { clave: 'cuota', titulo: 'Cuota y pago', corto: 'Cuota', modulo: ['cuotas-en-linea', 'remesas'] },
  { clave: 'contrasena', titulo: 'Contraseña', corto: 'Contraseña' },
]

/**
 * «Mi perfil»: la ficha propia y las de quienes tiene a su cargo, una a una, y
 * cada ficha por apartados en pestañas (forma C, 09-10-2026). Cada apartado se
 * edita por su cuenta. Lo que lleva Secretaría (número, alta, jura, padrinos)
 * se ve y no se toca.
 *
 * La ficha y la pestaña van en la URL (?ficha=&apartado=), para volver a ellas al recargar.
 */
export default function PerfilPage() {
  const { activo } = useModulos()
  const [params, setParams] = useSearchParams()
  const [fichas, setFichas] = useState<ApiProfile[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const base = useId()
  const botones = useRef<(HTMLButtonElement | null)[]>([])
  // Una edición a medias en el apartado abierto. Cambiar de pestaña, de ficha
  // o de pantalla lo desmonta y se perdía lo escrito sin avisar: ahora se
  // pregunta antes, como en Hazte hermano y en las fichas del CMS. Las
  // pestañas y la ficha van en la URL, así que basta con mirar la navegación.
  const [sucio, setSucio] = useState(false)
  const bloqueo = useBlocker(({ currentLocation, nextLocation }) =>
    sucio && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search))
  useAvisoAlCerrarLaPestana(sucio)

  useEffect(() => {
    let cancelado = false
    // Sin argumentos, misFichas pide la familia entera en una sola página:
    // esta pantalla elige una ficha, y un selector paginado escondería alguna.
    misFichas()
      .then((respuesta) => {
        if (cancelado) return
        setFichas(ordenar(respuesta.data))
        if (respuesta.data.length === 0) setError('No se ha encontrado ningún perfil asociado a tu cuenta.')
      })
      .catch((err: unknown) => { if (!cancelado) setError(err instanceof Error ? err.message : 'No se ha podido cargar tu perfil.') })
      .finally(() => { if (!cancelado) setCargando(false) })
    return () => { cancelado = true }
  }, [])

  const pedida = Number(params.get('ficha'))
  const ficha = fichas.find((f) => f.id === pedida) ?? fichas[0] ?? null
  const sinFichaPropia = fichas.length > 0 && !fichas.some((f) => f.esTitular)
  const pestanas = PESTANAS.filter((p) => !p.modulo || activo(p.modulo))
  const abierta = pestanas.find((p) => p.clave === params.get('apartado')) ?? pestanas[0]!

  // Un `?ficha=` que no es de esta cuenta (un enlace viejo, otra familia) cae
  // en la propia: se quita de la dirección para que no diga una cosa y se vea otra.
  const fichaAjena = fichas.length > 0 && params.has('ficha') && !fichas.some((f) => f.id === pedida)
  useEffect(() => {
    if (!fichaAjena) return
    setParams((anteriores) => {
      const siguientes = new URLSearchParams(anteriores)
      siguientes.delete('ficha')
      return siguientes
    }, { replace: true })
  }, [fichaAjena, setParams])

  const guardada = (nueva: ApiProfile) => setFichas((actuales) => actuales.map((f) => (f.id === nueva.id ? nueva : f)))
  const cambiar = (clave: string, valor: string) => setParams((anteriores) => {
    const siguientes = new URLSearchParams(anteriores)
    siguientes.set(clave, valor)
    return siguientes
  }, { replace: true })

  // Flechas, Inicio y Fin mueven entre pestañas, como pide el patrón de pestañas de WAI-ARIA.
  const teclas = (evento: KeyboardEvent, indice: number) => {
    const destino = { ArrowRight: indice + 1, ArrowLeft: indice - 1, Home: 0, End: pestanas.length - 1 }[evento.key]
    if (destino === undefined) return
    evento.preventDefault()
    const siguiente = (destino + pestanas.length) % pestanas.length
    cambiar('apartado', pestanas[siguiente]!.clave)
    botones.current[siguiente]?.focus()
  }

  return (
    <>
      <Helmet><title>{`Mi perfil | ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      <DialogoConfirmacion
        abierto={bloqueo.state === 'blocked'}
        titulo="Hay cambios sin guardar"
        mensaje="Si sales ahora se van a perder los cambios que has hecho en este apartado."
        textoConfirmar="Salir sin guardar"
        textoCancelar="Seguir editando"
        peligro
        onConfirmar={() => bloqueo.proceed?.()}
        onCancelar={() => bloqueo.reset?.()}
      />
      {/* En PC, sin margen propio: el del marco del área basta, y así la ficha
          cabe en la pantalla sin desplazarse (1280×552 con el escalado al 150 %). */}
      <SeccionAnimada sx={{ py: { xs: 1, md: 0 } }}>
        <ContenedorDePagina sx={{ px: { xs: 0, md: 0 } }}>
          {cargando && <CircularProgress aria-label="Cargando perfil" />}
          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          {/* Su cuenta existe para gestionar a quienes tiene a su cargo: sus fichas
              están aquí, y desde «Mi familia» puede hacerse hermano también. */}
          {sinFichaPropia && (
            <TarjetaCristal sx={{ p: 2.5, mb: 2.5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Typography sx={{ color: 'text.secondary', maxWidth: '62ch' }}>
                Tú no tienes ficha de hermano: esta cuenta la abriste para quienes tienes a tu cargo. Si quieres, puedes hacerte hermano sin abrir otra cuenta.
              </Typography>
              <Boton appVariant="outline" component={Link} to="/area-hermano/familia">Hacerme hermano</Boton>
            </TarjetaCristal>
          )}

          {!ficha && !cargando && <Typography variant="h3" component="h1" sx={{ mb: 3 }}>Mi perfil</Typography>}

          {ficha && (
            <>
              {/* «Mi perfil» va de antetítulo sobre el nombre: como título aparte se comía
                  80 px de alto, y la ficha dejaba de caber sin desplazarse. */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 2, rowGap: 1.5 }}>
                <Box aria-hidden="true" sx={{
                  width: { xs: 46, md: 56 }, height: { xs: 46, md: 56 }, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center',
                  backgroundColor: '#6e1822', color: '#fff', fontWeight: 600, fontSize: { xs: 16, md: 19 },
                }}>{iniciales(ficha)}</Box>
                <Box sx={{ minWidth: 0, flex: '1 1 240px' }}>
                  <Typography component="h1" sx={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255, 179, 180, 0.85)' }}>Mi perfil</Typography>
                  <Typography component="p" sx={{ fontSize: { xs: 21, md: 24 }, fontWeight: 600, lineHeight: 1.2 }}>{ficha.nombre} {ficha.apellidos}</Typography>
                  {/* Sin partir: en el móvil, «Activo» se quedaba solo en una línea y el
                      número en otra. El texto se parte dentro, por el «·». */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 0.5 }}>
                    {ficha.activo
                      ? <Chip size="small" label="Activo" color="success" variant="outlined" sx={{ flexShrink: 0 }} />
                      : <Chip size="small" label="Pendiente de Secretaría" color="warning" sx={{ flexShrink: 0 }} />}
                    {ficha.activo && (
                      <Typography sx={{ fontSize: 14, color: 'text.secondary', minWidth: 0 }}>
                        <Box component="span" sx={{ whiteSpace: 'nowrap' }}>{ficha.numeroHermano ? `Hermano n.º\u00a0${ficha.numeroHermano}` : 'Número pendiente de asignar'}</Box>
                        {' · '}<Box component="span" sx={{ whiteSpace: 'nowrap' }}>desde el {diaLegible(ficha.fechaAlta)}</Box>
                      </Typography>
                    )}
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 1.5, sm: 2.5 }, width: { xs: '100%', sm: 'auto' } }}>
                  {fichas.length > 1 && (
                    <TextField
                      select
                      size="small"
                      label="Ficha que estás viendo"
                      value={ficha.id}
                      onChange={(e) => cambiar('ficha', String(e.target.value))}
                      sx={{ width: { xs: '100%', sm: 280 } }}
                    >
                      {fichas.map((f) => <MenuItem key={f.id} value={f.id}>{f.nombre} · {subtitulo(f)}</MenuItem>)}
                    </TextField>
                  )}
                  <Box component={Link} to="/area-hermano/familia" sx={{ color: 'primary.light', fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap' }}>Apuntar a un menor</Box>
                </Box>
              </Box>

              {/* Rejilla de columnas iguales, no una tira: así no sale barra de
                  desplazamiento. El nombre largo solo cabe a partir de lg (con el
                  menú lateral, en md le quedan unos 100 px a cada una); en el
                  móvil, tres por fila. */}
              <Box role="tablist" aria-label="Apartados de la ficha" sx={{
                mt: { xs: 2.5, md: 2 }, display: 'grid', gap: { xs: 0.75, sm: 0 },
                gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', sm: `repeat(${pestanas.length}, minmax(0, 1fr))` },
                borderBottom: { sm: '1px solid rgba(204, 196, 201, 0.16)' },
              }}>
                {pestanas.map((p, i) => {
                  const elegida = p.clave === abierta.clave
                  return (
                    <Box
                      key={p.clave}
                      ref={(el: HTMLButtonElement | null) => { botones.current[i] = el }}
                      component="button"
                      type="button"
                      role="tab"
                      id={`${base}-pestana-${p.clave}`}
                      aria-selected={elegida}
                      aria-controls={`${base}-panel`}
                      aria-label={p.titulo}
                      tabIndex={elegida ? 0 : -1}
                      onClick={() => cambiar('apartado', p.clave)}
                      onKeyDown={(e: KeyboardEvent) => teclas(e, i)}
                      sx={{
                        appearance: 'none', cursor: 'pointer', font: 'inherit', fontSize: { xs: 14, lg: 15 }, fontWeight: 600,
                        minWidth: 0, minHeight: 44, px: 1, border: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        color: elegida ? '#fff' : 'text.secondary',
                        backgroundColor: { xs: elegida ? 'rgba(160, 61, 68, 0.45)' : 'rgba(26, 24, 27, 0.72)', sm: 'transparent' },
                        borderRadius: { xs: '6px', sm: 0 },
                        boxShadow: { sm: elegida ? 'inset 0 -2px 0 #ffb3b4' : 'none' },
                        transition: 'color .2s ease, background-color .2s ease',
                        '&:hover': { color: '#fff' },
                        '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: -2 },
                      }}
                    >
                      <Box component="span" sx={{ display: { xs: 'none', lg: 'inline' } }}>{p.titulo}</Box>
                      <Box component="span" sx={{ display: { xs: 'inline', lg: 'none' } }}>{p.corto}</Box>
                    </Box>
                  )
                })}
              </Box>

              {/* `key`: al cambiar de ficha o de pestaña, el apartado empieza de cero
                  (antes, si había algo a medias, se ha preguntado). `tabIndex`: el
                  panel se alcanza con el tabulador, como pide el patrón de pestañas. */}
              <Box key={`${ficha.id}-${abierta.clave}`} role="tabpanel" tabIndex={0} id={`${base}-panel`} aria-labelledby={`${base}-pestana-${abierta.clave}`} sx={{ mt: 2, minWidth: 0, '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 4 } }}>
                {abierta.clave === 'personales' && <DatosPersonales ficha={ficha} onGuardada={guardada} onSucio={setSucio} />}
                {abierta.clave === 'contacto' && <Contacto ficha={ficha} onGuardada={guardada} onSucio={setSucio} />}
                {abierta.clave === 'hermano' && <VidaDeHermano ficha={ficha} onGuardada={guardada} onSucio={setSucio} />}
                {abierta.clave === 'cuota' && <CuotaYPago ficha={ficha} onGuardada={guardada} onSucio={setSucio} />}
                {/* De la cuenta, no de la ficha: es la misma sea cual sea la persona elegida. */}
                {abierta.clave === 'contrasena' && <ApartadoContrasena />}
              </Box>
            </>
          )}

          {/* Sin ficha que enseñar, la contraseña de la cuenta sigue a mano. */}
          {!cargando && !ficha && <Box sx={{ maxWidth: 640 }}><ApartadoContrasena /></Box>}
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}
