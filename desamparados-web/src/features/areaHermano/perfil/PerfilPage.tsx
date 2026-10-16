import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Alert, Box, CircularProgress, Typography } from '@mui/material'
import { Link, useBlocker, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import SeccionAnimada from '../../../components/SeccionAnimada'
import TarjetaCristal from '../../../components/TarjetaCristal'
import Boton from '../../../components/Boton'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import { useAvisoAlCerrarLaPestana } from '../../../hooks/useAvisoAlCerrarLaPestana'
import { Contacto, CuotaYPago, DatosPersonales, VidaDeHermano } from './apartados'
import { PreguntaDeAvisos } from './AvisosEnElMovil'
import { FormaDeApartados } from './Apartado'
import Credencial from './Credencial'
import { useFichasDeLaCuenta, usePonerFicha } from './fichasDeLaCuenta'
import { site } from '../../../config/site'
import { useModulos } from '../../../hooks/useModulos'
import type { Requisito } from '../../../domain/modulos'
import { MARCA, alfa } from '../../../theme/marca'
import { ORO } from '../procesion/papeleta-estilo'

type ClaveApartado = 'personales' | 'contacto' | 'hermano' | 'cuota'

/** El nombre corto es el del móvil: con los largos, cuatro pestañas no caben en una fila. */
const PESTANAS: { clave: ClaveApartado; titulo: string; corto: string; modulo?: Requisito }[] = [
  { clave: 'personales', titulo: 'Datos personales', corto: 'Datos' },
  { clave: 'contacto', titulo: 'Contacto y domicilio', corto: 'Contacto' },
  { clave: 'hermano', titulo: 'Vida de hermano', corto: 'Hermano', modulo: 'procesion' },
  // Con remesas también: el IBAN es lo que se carga en la domiciliación, y solo lo cambia el hermano.
  { clave: 'cuota', titulo: 'Cuota y pago', corto: 'Cuota', modulo: ['cuotas-en-linea', 'remesas'] },
]

/**
 * «Mi perfil»: la ficha propia y las de quienes tiene a su cargo, una a una, y
 * cada ficha por apartados en pestañas (forma C, 09-10-2026). Cada apartado se
 * edita por su cuenta. Lo que lleva Secretaría (número, alta, jura, padrinos)
 * se ve y no se toca, en la cabecera (la «Credencial», 16-10-2026) y en Vida
 * de hermano. Lo de la cuenta (contraseña, avisos, mis datos) tiene su propia
 * pantalla en el menú: no depende de la ficha elegida.
 *
 * La ficha y la pestaña van en la URL (?ficha=&apartado=), para volver a ellas
 * al recargar. La ficha se elige en el menú del área (16-10-2026), no aquí.
 */
export default function PerfilPage() {
  const { activo } = useModulos()
  const [params, setParams] = useSearchParams()
  const consulta = useFichasDeLaCuenta()
  const fichas = consulta.data ?? []
  const cargando = consulta.isPending
  const error = consulta.isError
    ? (consulta.error instanceof Error ? consulta.error.message : 'No se ha podido cargar tu perfil.')
    : consulta.isSuccess && fichas.length === 0 ? 'No se ha encontrado ningún perfil asociado a tu cuenta.' : null
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

  const guardada = usePonerFicha()
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
      <PreguntaDeAvisos />
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
              <Credencial ficha={ficha} />

              {/* Rejilla de columnas iguales, no una tira: así no sale barra de
                  desplazamiento. El nombre largo solo cabe a partir de lg (con el
                  menú lateral, en md le quedan unos 100 px a cada una). En el
                  móvil, tres si son tres y de dos en dos si son cuatro: con tres
                  por fila, la cuarta se quedaba sola. */}
              <Box role="tablist" aria-label="Apartados de la ficha" sx={{
                mt: 2, display: 'grid', gap: { xs: 0.75, sm: 0 },
                gridTemplateColumns: { xs: `repeat(${pestanas.length === 3 ? 3 : 2}, minmax(0, 1fr))`, sm: `repeat(${pestanas.length}, minmax(0, 1fr))` },
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
                        backgroundColor: { xs: elegida ? alfa(MARCA.principalMedio, 0.45) : 'rgba(26, 24, 27, 0.72)', sm: 'transparent' },
                        borderRadius: { xs: '6px', sm: 0 },
                        boxShadow: { sm: elegida ? `inset 0 -2px 0 ${ORO}` : 'none' },
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
              <Box key={`${ficha.id}-${abierta.clave}`} role="tabpanel" tabIndex={0} id={`${base}-panel`} aria-labelledby={`${base}-pestana-${abierta.clave}`} sx={{ mt: 2.25, minWidth: 0, '&:focus-visible': { outline: '2px solid', outlineColor: 'secondary.main', outlineOffset: 4 } }}>
                <FormaDeApartados value="perfil">
                  {abierta.clave === 'personales' && <DatosPersonales ficha={ficha} onGuardada={guardada} onSucio={setSucio} />}
                  {abierta.clave === 'contacto' && <Contacto ficha={ficha} onGuardada={guardada} onSucio={setSucio} />}
                  {abierta.clave === 'hermano' && <VidaDeHermano ficha={ficha} onGuardada={guardada} onSucio={setSucio} />}
                  {abierta.clave === 'cuota' && <CuotaYPago ficha={ficha} onGuardada={guardada} onSucio={setSucio} />}
                </FormaDeApartados>
              </Box>
            </>
          )}
        </ContenedorDePagina>
      </SeccionAnimada>
    </>
  )
}
