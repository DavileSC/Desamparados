import { useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert, Box, Checkbox, FormControl, FormControlLabel, FormHelperText, Grid, TextField, Typography,
} from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import PageContainer from '../../../components/PageContainer'
import { Revela } from '../../../components/AnimatedSection'
import AppButton from '../../../components/AppButton'
import CampoContrasena from '../../../components/CampoContrasena'
import { LONGITUD_MINIMA } from '../../../lib/passwordPolicy'
import { register as apiRegister } from '../../../lib/api/auth'
import { ApiError } from '../../../lib/api/client'
import { GOLD, SERIF, ceja } from '../../home/estilos'
import { membershipSchema, type MembershipFormData } from './schema'
import { temaTarjeta, FILETE_TARJETA, TARJETA } from './temaTarjeta'
import ProcesoAlta from './ProcesoAlta'
import SolicitudRecibida from './SolicitudRecibida'

type Campo = keyof MembershipFormData

/**
 * El formulario cabe en pantalla porque va por pasos: cada uno tiene los
 * campos justos para no tener que bajar, también en un móvil. Los tres pasos
 * son los grupos que pide el servidor para abrir la ficha (`registerSchema`
 * del backend): quién eres, cómo localizarte y con qué entrarás.
 */
const PASOS: { titulo: string; campos: Campo[] }[] = [
  { titulo: 'Datos personales', campos: ['nombre', 'apellidos', 'dni', 'fechaNacimiento'] },
  { titulo: 'Contacto y domicilio', campos: ['email', 'telefono', 'direccion', 'ciudad', 'codigoPostal'] },
  { titulo: 'Acceso al área de hermanos', campos: ['password', 'aceptarPolitica'] },
]
const pasoDe = (campo: Campo) => PASOS.findIndex((paso) => paso.campos.includes(campo))
/** El primer campo en orden de pasos, para llevar allí a la persona cuando algo falla. */
const primeroEnOrden = (campos: Campo[]) => [...campos].sort((a, b) => pasoDe(a) - pasoDe(b))[0]

/** Del `usuario.dni` que manda el servidor al `dni` que conoce el formulario. */
const CAMPOS_API: Record<string, Campo> = {
  'usuario.dni': 'dni',
  'usuario.email': 'email',
  'usuario.telefono': 'telefono',
  'usuario.nombre': 'nombre',
  'usuario.apellidos': 'apellidos',
  'usuario.direccion': 'direccion',
  'usuario.poblacion': 'ciudad',
  'usuario.codigoPostal': 'codigoPostal',
  'usuario.password': 'password',
  'hermano.fechaNacimiento': 'fechaNacimiento',
}

const VALORES_INICIALES: MembershipFormData = {
  nombre: '', apellidos: '', email: '', password: '', dni: '', telefono: '',
  direccion: '', ciudad: '', codigoPostal: '', fechaNacimiento: '', aceptarPolitica: false,
}

// Mismo umbral que el navbar (`DESKTOP_NAV_MIN`): por debajo la barra va en
// flujo y mide 56 px en móvil y 64 en tableta; desde ahí es fija de 72 px y se
// pone encima de la página, así que la sección la deja pasar con su relleno.
const ESCRITORIO = '@media (min-width:1024px)'

/** Fondo de página: la foto se funde a él en los bordes. */
const FONDO = '#262326'
const FONDO_VELO = 'rgba(38, 35, 38, 0.55)'
const FONDO_VELO_LEVE = 'rgba(38, 35, 38, 0.25)'
/** Presencia leve: se intuye la corona y el rostro, sin competir con el texto. */
const OPACIDAD_VIRGEN = 0.18

/** Botones del pie de la tarjeta: misma altura los dos y sin partir el texto en móvil. */
const BOTON_PIE = { borderRadius: '3px', height: 48, py: 0, whiteSpace: 'nowrap' } as const

export default function HazteHermanoPage() {
  const [paso, setPaso] = useState(0)
  const [enviada, setEnviada] = useState<{ nombre: string; email: string } | null>(null)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  const {
    register, handleSubmit, setError, setFocus, trigger, reset, getValues,
    formState: { errors, isSubmitting },
  } = useForm<MembershipFormData>({
    resolver: zodResolver(membershipSchema),
    defaultValues: VALORES_INICIALES,
    // Cada campo avisa al salir de él, no al final con diez errores de golpe.
    mode: 'onTouched',
  })

  const esUltimo = paso === PASOS.length - 1

  /** Cambia al paso del campo y le pasa el foco: el paso se pinta ya, para que el campo se pueda enfocar. */
  const irA = (campo: Campo) => {
    flushSync(() => setPaso(pasoDe(campo)))
    setFocus(campo)
  }

  const avanzar = async () => {
    const valido = await trigger(PASOS[paso].campos, { shouldFocus: true })
    if (valido) irA(PASOS[paso + 1].campos[0])
  }

  const retroceder = () => irA(PASOS[paso - 1].campos[0])

  const onSubmit = async (data: MembershipFormData) => {
    setErrorEnvio(null)
    try {
      await apiRegister({ ...data, poblacion: data.ciudad })
      setEnviada({ nombre: data.nombre.trim(), email: data.email.trim() })
      reset()
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
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
      setErrorEnvio(error instanceof ApiError ? error.message : 'No se ha podido enviar la solicitud. Inténtalo de nuevo en unos minutos.')
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
      <Helmet>
        <title>Hazte hermano | Desamparados</title>
        <meta
          name="description"
          content="Solicita tu alta como hermano del Grupo Parroquial de Nuestra Señora de los Desamparados. Rellena la solicitud y formaliza el alta en Secretaría."
        />
      </Helmet>

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
        {/* La Virgen, velada, detrás de la solicitud. Es la foto de siempre del
            hero, a su alto completo para que corona y rostro entren enteros en
            cualquier ventana: a sangre y ampliada, en una pantalla apaisada solo
            cabía la mitad de arriba y los ojos quedaban en el borde. En
            escritorio ocupa la columna del texto y se funde al fondo antes de
            la tarjeta; en móvil va a todo el ancho y la tarjeta tinta el resto.
            Arriba y abajo se funde al fondo de página, para que no se note el
            corte con la barra ni con el pie. */}
        <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, zIndex: -1, overflow: 'hidden', pointerEvents: 'none' }}>
          <Box
            component="img"
            src="/images/hero-1920.webp"
            srcSet="/images/hero-960.webp 960w, /images/hero-1920.webp 1920w"
            sizes="(min-width: 900px) 60vw, 100vw"
            alt=""
            decoding="async"
            fetchPriority="low"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: { xs: '100%', md: '60%' },
              maxWidth: 'none',
              objectFit: 'cover',
              // El rostro está al 40 % del ancho de la foto: alineado con el
              // 40 % de su caja queda bajo el texto, no bajo la tarjeta.
              objectPosition: '40% 50%',
              opacity: OPACIDAD_VIRGEN,
              filter: 'saturate(0.85)',
            }}
          />
          <Box sx={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${FONDO} 0%, transparent 22%, transparent 76%, ${FONDO} 100%)` }} />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: {
                xs: `linear-gradient(90deg, ${FONDO_VELO_LEVE} 0%, transparent 30%, ${FONDO_VELO} 100%)`,
                md: `linear-gradient(90deg, ${FONDO_VELO_LEVE} 0%, transparent 20%, transparent 32%, ${FONDO} 60%)`,
              },
            }}
          />
        </Box>
        <PageContainer>
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
                formación del Grupo Parroquial. La solicitud son tres pasos y se formaliza después en
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
                    <SolicitudRecibida nombre={enviada.nombre} email={enviada.email} />
                  ) : (
                    <Box component="form" noValidate onSubmit={alEnviar} sx={{ display: 'grid', gap: { xs: 2.5, md: 3 } }}>
                      <Box>
                        <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                          Paso {paso + 1} de {PASOS.length}
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
                                {indice === 0 && (
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
                                        {...campo('dni', 'Con la letra final.')}
                                      />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                      <TextField
                                        label="Fecha de nacimiento"
                                        type="date"
                                        autoComplete="bday"
                                        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hoy } }}
                                        {...campo('fechaNacimiento')}
                                      />
                                    </Grid>
                                  </>
                                )}

                                {indice === 1 && (
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

                                {indice === 2 && (
                                  <>
                                    <Grid size={{ xs: 12 }}>
                                      <Typography sx={{ fontSize: 15, lineHeight: 1.6, color: 'text.secondary', maxWidth: '60ch' }}>
                                        Con tu email y esta contraseña entrarás al área de hermanos cuando Secretaría active tu alta.
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

                      {errorEnvio && <Alert severity="error" role="alert">{errorEnvio}</Alert>}

                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, borderTop: `1px solid ${FILETE_TARJETA}`, pt: { xs: 2.5, md: 3 } }}>
                        {/* Altura fija en los dos botones: el de contorno lleva 1 px de
                            borde y, sin esto, la fila crecía 2 px al aparecer «Atrás». */}
                        {paso > 0 ? (
                          <AppButton type="button" appVariant="outline" onClick={retroceder} sx={{ ...BOTON_PIE, px: { xs: 2, sm: 3 } }}>
                            Atrás
                          </AppButton>
                        ) : (
                          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Todos los campos son obligatorios.</Typography>
                        )}
                        <AppButton type="submit" disabled={isSubmitting} sx={{ ...BOTON_PIE, px: { xs: 2.5, sm: 5 } }}>
                          {esUltimo ? (isSubmitting ? 'Enviando…' : 'Enviar solicitud') : 'Continuar'}
                        </AppButton>
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
        </PageContainer>
      </Box>
    </>
  )
}
