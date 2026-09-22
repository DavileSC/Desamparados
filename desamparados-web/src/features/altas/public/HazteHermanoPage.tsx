import { useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { useForm, useWatch, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert, Box, Checkbox, FormControl, FormControlLabel, FormHelperText, Grid, TextField, Typography,
} from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import MetaDePagina from '../../../components/MetaDePagina'
import { Link } from 'react-router-dom'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import { Revela } from '../../../components/SeccionAnimada'
import Boton from '../../../components/Boton'
import CampoContrasena from '../../../components/CampoContrasena'
import { LONGITUD_MINIMA } from '../../../lib/politicaDeContrasena'
import { register as apiRegister, pedirReactivacion } from '../../../lib/api/auth'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { GOLD, SERIF, ceja } from '../../inicio/estilos'
import {
  conFichaPropia, conMenores, membershipSchema, menorVacio,
  type Camino, type MembershipFormData,
} from './schema'
import { temaTarjeta, FILETE_TARJETA, TARJETA } from './temaTarjeta'
import ProcesoAlta from './ProcesoAlta'
import SolicitudRecibida from './SolicitudRecibida'
import EleccionCamino from './EleccionCamino'
import PasoMenores from './PasoMenores'
import FondoDeSolicitud from './FondoDeSolicitud'

import { CAMPOS_API, VALORES_INICIALES, pasosDe, type Campo } from './pasos'

// Mismo umbral que el navbar (`DESKTOP_NAV_MIN`): por debajo la barra va en
// flujo y mide 56 px en móvil y 64 en tableta; desde ahí es fija de 72 px y se
// pone encima de la página, así que la sección la deja pasar con su relleno.
const ESCRITORIO = '@media (min-width:1024px)'


/** Botones del pie de la tarjeta: misma altura los dos y sin partir el texto en móvil. */
const BOTON_PIE = { borderRadius: '3px', height: 48, py: 0, whiteSpace: 'nowrap' } as const

export default function HazteHermanoPage() {
  const [paso, setPaso] = useState(0)
  const [camino, setCamino] = useState<Camino | null>(null)
  const [enviada, setEnviada] = useState<{ nombre: string; email: string; fichas: number; soloMenores: boolean } | null>(null)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  // Cuando el alta topa con un DNI que ya está en el censo, lo que toca no es
  // repetir el formulario: es pedir que reactiven la ficha de antes.
  const [ofrecerVuelta, setOfrecerVuelta] = useState(false)
  const [vueltaPedida, setVueltaPedida] = useState<string | null>(null)

  const {
    register, handleSubmit, setError, setFocus, trigger, reset, getValues, setValue, watch, control,
    formState: { errors, isSubmitting },
  } = useForm<MembershipFormData>({
    resolver: zodResolver(membershipSchema),
    defaultValues: VALORES_INICIALES,
    // Cada campo avisa al salir de él, no al final con diez errores de golpe.
    mode: 'onTouched',
  })

  const PASOS = pasosDe(camino)
  const esUltimo = paso === PASOS.length - 1
  /**
   * `useWatch` y no `watch('menores')`: el valor se lee para pintar, y `watch`
   * devuelve funciones que el compilador de React no puede memorizar, así que
   * renunciaba a memorizar la pantalla entera. `watch` se sigue usando, pero
   * solo se pasa hacia abajo (a `PasoMenores`), que es lo que sí necesita.
   */
  const menores = useWatch({ control, name: 'menores' })

  const pasoDe = (campo: Campo) => PASOS.findIndex((p) => p.campos.includes(campo))
  /** El primer campo en orden de pasos, para llevar allí a la persona cuando algo falla. */
  const primeroEnOrden = (campos: Campo[]) => [...campos].sort((a, b) => pasoDe(a) - pasoDe(b))[0]

  /** Cambia al paso del campo y le pasa el foco: el paso se pinta ya, para que el campo se pueda enfocar. */
  const irA = (campo: Campo) => {
    const destino = pasoDe(campo)
    flushSync(() => setPaso(destino === -1 ? 0 : destino))
    // `camino` y `menores` no son casillas que puedan recibir el foco.
    if (campo !== 'camino' && campo !== 'menores') setFocus(campo)
  }

  const irAlPaso = (indice: number) => {
    flushSync(() => setPaso(indice))
    const primero = PASOS[indice].campos[0]
    if (primero !== 'camino' && primero !== 'menores') setFocus(primero)
  }

  const avanzar = async () => {
    const valido = await trigger(PASOS[paso].campos, { shouldFocus: true })
    if (valido) irAlPaso(paso + 1)
  }

  const retroceder = () => irAlPaso(paso - 1)

  /** Elegir camino es, además, el «Continuar» de ese paso: no hay nada más que rellenar ahí. */
  const elegirCamino = (elegido: Camino) => {
    setCamino(elegido)
    setValue('camino', elegido)
    // El primer menor aparece ya puesto: nadie elige «apunto a un menor» para
    // luego tener que pulsar «añadir».
    if (conMenores(elegido) && getValues('menores').length === 0) {
      setValue('menores', [{ ...menorVacio }])
    }
    flushSync(() => setPaso(1))
    setFocus('nombre')
  }

  const pedirVuelta = async () => {
    setErrorEnvio(null)
    try {
      const { message } = await pedirReactivacion(getValues('dni'), getValues('email'))
      setVueltaPedida(message)
      setOfrecerVuelta(false)
    } catch (error) {
      setErrorEnvio(error instanceof ErrorDeApi ? error.message : 'No se ha podido enviar la petición. Inténtalo más tarde.')
    }
  }

  const onSubmit = async (data: MembershipFormData) => {
    setErrorEnvio(null)
    setOfrecerVuelta(false)
    try {
      const respuesta = await apiRegister({
        ...data,
        poblacion: data.ciudad,
        // Sin ficha propia no se manda fecha de nacimiento: el servidor la usa
        // justo para saber si hay que crearla.
        fechaNacimiento: conFichaPropia(data.camino) ? data.fechaNacimiento : undefined,
        menores: conMenores(data.camino) ? data.menores : undefined,
      })
      setEnviada({ nombre: data.nombre.trim(), email: data.email.trim(), fichas: respuesta.fichas, soloMenores: !conFichaPropia(data.camino) })
      reset()
      setCamino(null)
      setPaso(0)
    } catch (error) {
      // Un DNI que ya está en el censo es de alguien que estuvo aquí: se le
      // ofrece pedir la vuelta en vez de dejarlo en un callejón sin salida.
      if (error instanceof ErrorDeApi && /ya hay una ficha en el censo/i.test(error.message)) {
        setOfrecerVuelta(true)
        setErrorEnvio(error.message)
        return
      }
      if (error instanceof ErrorDeApi && Object.keys(error.fields).length > 0) {
        // El servidor dice qué campo falla; enseñarlo bajo su casilla, en su
        // paso, en vez de un «Error de validación» suelto que no dice qué corregir.
        const rechazados: Campo[] = []
        for (const [campoApi, mensaje] of Object.entries(error.fields)) {
          const campo = CAMPOS_API[campoApi]
          if (!campo) continue
          setError(campo, { type: 'server', message: mensaje })
          rechazados.push(campo)
        }
        if (rechazados.length > 0) { irA(primeroEnOrden(rechazados)); return }
      }
      setErrorEnvio(error instanceof ErrorDeApi ? error.message : 'No se ha podido enviar la solicitud. Inténtalo de nuevo en unos minutos.')
    }
  }

  // Un campo de un paso anterior puede fallar al validar todo el conjunto
  // (por ejemplo, tras un error del servidor corregido a medias): se vuelve a él.
  const onInvalido = (fallos: FieldErrors<MembershipFormData>) => {
    const campos = Object.keys(fallos) as Campo[]
    if (campos.length > 0) irA(primeroEnOrden(campos))
  }

  // Intro en un campo = «Continuar» en los pasos intermedios, no enviar.
  const alEnviar = (evento: FormEvent<HTMLFormElement>) => {
    if (esUltimo) return handleSubmit(onSubmit, onInvalido)(evento)
    evento.preventDefault()
    void avanzar()
  }

  const campo = (nombre: Campo, ayuda?: string) => ({
    fullWidth: true,
    error: !!errors[nombre],
    helperText: errors[nombre]?.message ?? ayuda,
    ...register(nombre),
  })

  const hoy = new Date().toISOString().slice(0, 10)

  return (
    <>
      <MetaDePagina
        titulo="Hazte hermano"
        descripcion="Solicita tu alta como hermano del Grupo Parroquial de Nuestra Señora de los Desamparados. Rellena la solicitud y formaliza el alta en Secretaría."
      />

      <Box
        component="section"
        aria-labelledby="hazte-hermano-titulo"
        sx={{
          position: 'relative',
          isolation: 'isolate',
          display: 'grid',
          alignContent: 'center',
          minHeight: { xs: 'calc(100svh - 56px)', sm: 'calc(100svh - 64px)' },
          py: { xs: 4, md: 5 },
          [ESCRITORIO]: { minHeight: '100svh', pt: 'calc(72px + 40px)' },
          '& a:focus-visible, & button:focus-visible': { outline: `2px solid ${GOLD}`, outlineOffset: 4 },
        }}
      >
        <FondoDeSolicitud />
        <ContenedorDePagina>
          <Box
            sx={{
              display: 'grid',
              alignItems: 'start',
              columnGap: { md: 6, lg: 10 },
              rowGap: { xs: 3, md: 4 },
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 5fr) minmax(0, 7fr)' },
              gridTemplateRows: { md: 'auto 1fr' },
              gridTemplateAreas: { xs: '"intro" "tarjeta" "despues"', md: '"intro tarjeta" "despues tarjeta"' },
            }}
          >
            <Revela sx={{ gridArea: 'intro' }}>
              <Typography component="span" sx={ceja}>Solicitud de ingreso</Typography>
              <Typography
                id="hazte-hermano-titulo"
                component="h1"
                sx={{ fontFamily: SERIF, fontSize: 'clamp(38px, 4.4vw, 60px)', lineHeight: 1.05, letterSpacing: '-0.02em', mb: { xs: 1.5, md: 2.5 } }}
              >
                Hazte hermano
              </Typography>
              <Typography sx={{ display: { xs: 'none', md: 'block' }, fontSize: 17, lineHeight: 1.7, color: 'text.secondary', maxWidth: '44ch' }}>
                Ser hermano es acompañar a Nuestra Señora de los Desamparados todo el año: en los
                cultos, en la estación de penitencia del Sábado de Pasión y en la labor de caridad y
                formación del Grupo Parroquial. La solicitud se rellena aquí y se formaliza después en
                Secretaría.
              </Typography>
              <Typography sx={{ display: { xs: 'block', md: 'none' }, fontSize: 15, lineHeight: 1.6, color: 'text.secondary' }}>
                Tres pasos y unos minutos. El alta se formaliza después en Secretaría.
              </Typography>
            </Revela>

            <Revela orden={1} sx={{ gridArea: 'tarjeta' }}>
              <ThemeProvider theme={temaTarjeta}>
                <Box sx={{ ...TARJETA, p: { xs: '24px 20px', sm: '32px', md: '36px 44px' } }}>
                  {enviada ? (
                    <SolicitudRecibida
                      nombre={enviada.nombre}
                      email={enviada.email}
                      fichas={enviada.fichas}
                      soloMenores={enviada.soloMenores}
                    />
                  ) : (
                    <Box component="form" noValidate onSubmit={alEnviar} sx={{ display: 'grid', gap: { xs: 2.5, md: 3 } }}>
                      <Box>
                        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                          {camino ? `Paso ${paso + 1} de ${PASOS.length}` : 'Solicitud de alta'}
                        </Typography>
                        {/* Los tres títulos apilados en la misma celda, como los campos:
                            en móvil el del último paso ocupa dos líneas y, si solo
                            estuviera el actual, la tarjeta crecería al llegar a él. */}
                        <Box sx={{ display: 'grid', mt: 0.25 }}>
                          {PASOS.map((p, indice) => (
                            <Typography
                              key={p.titulo}
                              id={indice === paso ? 'paso-titulo' : undefined}
                              component="h2"
                              aria-hidden={indice !== paso || undefined}
                              sx={{ gridArea: '1 / 1', visibility: indice === paso ? 'visible' : 'hidden', fontFamily: SERIF, fontSize: { xs: 24, md: 28 }, lineHeight: 1.2 }}
                            >
                              {p.titulo}
                            </Typography>
                          ))}
                        </Box>
                        {/* Barra de pasos: un tramo por paso, hechos y actual en dorado. */}
                        <Box aria-hidden="true" sx={{ display: 'grid', gridTemplateColumns: `repeat(${PASOS.length}, 1fr)`, gap: '6px', mt: 2 }}>
                          {PASOS.map((p, indice) => (
                            <Box key={p.titulo} sx={{ height: 3, backgroundColor: indice <= paso ? GOLD : FILETE_TARJETA, transition: 'background-color .3s ease' }} />
                          ))}
                        </Box>
                      </Box>

                      {/* Los tres pasos van apilados en la misma celda: la tarjeta
                          mide siempre lo que el más alto y no cambia de altura al
                          pasar de uno a otro. Los que no tocan quedan invisibles e
                          inertes: ni se ven, ni se tabulan, ni los lee un lector. */}
                      <Box sx={{ display: 'grid' }}>
                        {PASOS.map((p, indice) => {
                          const activo = indice === paso
                          return (
                            <Box
                              key={p.titulo}
                              component="fieldset"
                              aria-labelledby={activo ? 'paso-titulo' : undefined}
                              inert={!activo}
                              sx={{ gridArea: '1 / 1', visibility: activo ? 'visible' : 'hidden', border: 0, m: 0, p: 0, minWidth: 0 }}
                            >
                              <Grid container spacing={{ xs: 1.5, md: 2 }}>
                                {p.campos[0] === 'camino' && (
                                  <Grid size={{ xs: 12 }}>
                                    <EleccionCamino valor={camino} onElegir={elegirCamino} />
                                  </Grid>
                                )}

                                {p.campos[0] === 'nombre' && (
                                  <>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                      <TextField label="Nombre" autoComplete="given-name" {...campo('nombre')} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                      <TextField label="Apellidos" autoComplete="family-name" {...campo('apellidos')} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                      <TextField
                                        label="DNI/NIE"
                                        slotProps={{ htmlInput: { autoCapitalize: 'characters', spellCheck: false } }}
                                        {...campo('dni', camino === 'SOLO_MENORES' ? 'El tuyo: es el de la cuenta.' : 'Con la letra final.')}
                                      />
                                    </Grid>
                                    {/* Sin ficha propia no hace falta: no va a entrar en el censo. */}
                                    {camino !== null && conFichaPropia(camino) && (
                                      <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField
                                          label="Fecha de nacimiento"
                                          type="date"
                                          autoComplete="bday"
                                          slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hoy } }}
                                          {...campo('fechaNacimiento')}
                                        />
                                      </Grid>
                                    )}
                                  </>
                                )}

                                {p.campos[0] === 'menores' && (
                                  <Grid size={{ xs: 12 }}>
                                    <PasoMenores
                                      menores={menores}
                                      errores={errors}
                                      register={register}
                                      setValue={setValue}
                                      watch={watch}
                                      apellidosDelTitular={getValues('apellidos')}
                                      hoy={hoy}
                                    />
                                  </Grid>
                                )}

                                {p.campos[0] === 'email' && (
                                  <>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                      <TextField label="Email" type="email" autoComplete="email" {...campo('email')} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                      <TextField label="Teléfono" type="tel" autoComplete="tel" {...campo('telefono', 'Nueve dígitos.')} />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                      <TextField label="Dirección" autoComplete="street-address" {...campo('direccion')} />
                                    </Grid>
                                    <Grid size={{ xs: 6, sm: 8 }}>
                                      <TextField label="Ciudad" autoComplete="address-level2" {...campo('ciudad')} />
                                    </Grid>
                                    <Grid size={{ xs: 6, sm: 4 }}>
                                      <TextField
                                        label="Código postal"
                                        autoComplete="postal-code"
                                        slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 5 } }}
                                        {...campo('codigoPostal')}
                                      />
                                    </Grid>
                                  </>
                                )}

                                {p.campos[0] === 'password' && (
                                  <>
                                    <Grid size={{ xs: 12 }}>
                                      <Typography sx={{ fontSize: 15, lineHeight: 1.6, color: 'text.secondary', maxWidth: '60ch' }}>
                                        {camino === 'SOLO_MENORES'
                                          ? 'Con tu email y esta contraseña entrarás al área de hermanos para gestionar sus fichas cuando Secretaría active el alta.'
                                          : 'Con tu email y esta contraseña entrarás al área de hermanos cuando Secretaría active tu alta.'}
                                      </Typography>
                                    </Grid>
                                    {/* El email se escribió en el paso anterior y ahí sigue, pero
                                        oculto e inerte: sin este campo junto a la contraseña, el
                                        gestor de contraseñas no sabe de qué usuario es. */}
                                    <input
                                      type="email"
                                      name="usuario"
                                      autoComplete="username"
                                      value={getValues('email')}
                                      readOnly
                                      tabIndex={-1}
                                      aria-hidden="true"
                                      style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', opacity: 0 }}
                                    />
                                    <Grid size={{ xs: 12, sm: 8 }}>
                                      <CampoContrasena
                                        label="Contraseña"
                                        autoComplete="new-password"
                                        {...campo('password', `Al menos ${LONGITUD_MINIMA} caracteres. Evita palabras evidentes y secuencias.`)}
                                      />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                      <FormControl error={!!errors.aceptarPolitica} sx={{ mt: 0.5 }}>
                                        <FormControlLabel
                                          control={<Checkbox {...register('aceptarPolitica')} sx={{ mt: '-6px' }} />}
                                          label={
                                            <>
                                              Acepto la{' '}
                                              <Box
                                                component={Link}
                                                to="/politica-privacidad"
                                                target="_blank"
                                                rel="noopener"
                                                sx={{ color: 'secondary.main', textDecoration: 'underline', textUnderlineOffset: 3 }}
                                              >
                                                política de privacidad
                                              </Box>
                                            </>
                                          }
                                          slotProps={{ typography: { sx: { fontSize: 16, lineHeight: 1.5, pt: '3px' } } }}
                                        />
                                        <FormHelperText sx={{ ml: '33px', mt: 0.25, fontSize: 13 }}>
                                          {errors.aceptarPolitica?.message
                                            ?? 'Usamos tus datos solo para tramitar el alta y tu relación con el Grupo Parroquial.'}
                                        </FormHelperText>
                                      </FormControl>
                                    </Grid>
                                  </>
                                )}
                              </Grid>
                            </Box>
                          )
                        })}
                      </Box>

                      {errorEnvio && (
                        <Alert
                          severity="error"
                          role="alert"
                          action={ofrecerVuelta ? (
                            <Boton type="button" appVariant="outline" onClick={() => void pedirVuelta()} sx={{ borderRadius: '3px', height: 40, whiteSpace: 'nowrap' }}>
                              Pedir la reactivación
                            </Boton>
                          ) : undefined}
                        >
                          {errorEnvio}
                        </Alert>
                      )}
                      {vueltaPedida && <Alert severity="success" role="status">{vueltaPedida}</Alert>}

                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, borderTop: `1px solid ${FILETE_TARJETA}`, pt: { xs: 2.5, md: 3 } }}>
                        {/* Altura fija en los dos botones: el de contorno lleva 1 px de
                            borde y, sin esto, la fila crecía 2 px al aparecer «Atrás». */}
                        {paso > 0 ? (
                          <Boton type="button" appVariant="outline" onClick={retroceder} sx={{ ...BOTON_PIE, px: { xs: 2, sm: 3 } }}>
                            Atrás
                          </Boton>
                        ) : (
                          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Da el primer paso para seguir tu camino con Nuestra Señora de los Desamparados.</Typography>
                        )}
                        {/* En el primer paso se avanza eligiendo: un «Continuar» ahí
                            solo serviría para pasar sin haber elegido nada. */}
                        {paso > 0 && (
                          <Boton type="submit" disabled={isSubmitting} sx={{ ...BOTON_PIE, px: { xs: 2.5, sm: 5 } }}>
                            {esUltimo ? (isSubmitting ? 'Enviando…' : 'Enviar solicitud') : 'Continuar'}
                          </Boton>
                        )}
                      </Box>
                    </Box>
                  )}
                </Box>
              </ThemeProvider>
            </Revela>

            <Revela orden={2} sx={{ gridArea: 'despues' }}>
              <ProcesoAlta />
            </Revela>
          </Box>
        </ContenedorDePagina>
      </Box>
    </>
  )
}
