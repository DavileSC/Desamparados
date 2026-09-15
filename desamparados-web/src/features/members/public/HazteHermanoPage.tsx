import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert, Box, Checkbox, FormControl, FormControlLabel, FormHelperText, Grid, TextField, Typography,
} from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import PageContainer from '../../../components/PageContainer'
import AnimatedSection, { Revela } from '../../../components/AnimatedSection'
import AppButton from '../../../components/AppButton'
import CampoContrasena from '../../../components/CampoContrasena'
import { LONGITUD_MINIMA } from '../../../lib/passwordPolicy'
import { register as apiRegister } from '../../../lib/api/auth'
import { ApiError } from '../../../lib/api/client'
import { GOLD, PAPEL, SERIF, TINTA, ceja } from '../../home/estilos'
import { membershipSchema, type MembershipFormData } from './schema'
import { temaPapel, FILETE_PAPEL, TINTA_SOBRE_PAPEL } from './temaPapel'
import ProcesoAlta from './ProcesoAlta'
import SolicitudRecibida from './SolicitudRecibida'

/** Del `usuario.dni` que manda el servidor al `dni` que conoce el formulario. */
const CAMPOS_API: Record<string, keyof MembershipFormData> = {
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

/** Un grupo de campos del pliego: leyenda en serif asentada sobre un filete. */
function Grupo({ leyenda, descripcion, children }: { leyenda: string; descripcion?: string; children: ReactNode }) {
  return (
    <Box
      component="fieldset"
      // La leyenda se asienta sobre el filete, como el título de cada apartado
      // de un impreso: es el navegador quien parte el borde superior del
      // fieldset justo donde va el legend.
      sx={{ border: 0, borderTop: `1px solid ${FILETE_PAPEL}`, m: 0, p: 0, minWidth: 0 }}
    >
      <Typography component="legend" sx={{ fontFamily: SERIF, fontSize: { xs: 21, md: 23 }, lineHeight: 1.25, p: 0, mb: descripcion ? 0.75 : 2.5 }}>
        {leyenda}
      </Typography>
      {descripcion && (
        <Typography sx={{ fontSize: 15, lineHeight: 1.6, color: 'text.secondary', maxWidth: '60ch', mb: 2.5 }}>
          {descripcion}
        </Typography>
      )}
      <Grid container spacing={{ xs: 2, md: 2.5 }}>{children}</Grid>
    </Box>
  )
}

export default function HazteHermanoPage() {
  const [enviada, setEnviada] = useState<{ nombre: string; email: string } | null>(null)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

  const {
    register, handleSubmit, setError, setFocus, reset,
    formState: { errors, isSubmitting },
  } = useForm<MembershipFormData>({
    resolver: zodResolver(membershipSchema),
    defaultValues: VALORES_INICIALES,
    // Cada campo avisa al salir de él, no al final con diez errores de golpe.
    mode: 'onTouched',
  })

  const onSubmit = async (data: MembershipFormData) => {
    setErrorEnvio(null)
    try {
      await apiRegister({ ...data, poblacion: data.ciudad })
      setEnviada({ nombre: data.nombre.trim(), email: data.email.trim() })
      reset()
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) {
        // El servidor dice qué campo falla; enseñarlo bajo su casilla en vez
        // de un «Error de validación» suelto que no dice qué corregir.
        let primero: keyof MembershipFormData | null = null
        for (const [campoApi, mensaje] of Object.entries(error.fields)) {
          const campo = CAMPOS_API[campoApi]
          if (!campo) continue
          setError(campo, { type: 'server', message: mensaje })
          primero ??= campo
        }
        if (primero) { setFocus(primero); return }
      }
      setErrorEnvio(error instanceof ApiError ? error.message : 'No se ha podido enviar la solicitud. Inténtalo de nuevo en unos minutos.')
    }
  }

  const campo = (nombre: keyof MembershipFormData, ayuda?: string) => ({
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
        sx={{ position: 'relative', backgroundColor: TINTA, overflow: 'hidden', '@supports (overflow: clip)': { overflow: 'clip' } }}
      >
        {/* La misma «D» que la placa «Hazte hermano» de la portada: quien
            llega desde allí reconoce el sitio. */}
        <Box
          aria-hidden="true"
          sx={{
            position: 'absolute',
            right: { xs: -20, md: 48 },
            bottom: { xs: -70, md: -150 },
            fontFamily: SERIF,
            fontSize: { xs: 260, md: 520 },
            lineHeight: 1,
            color: 'rgba(255, 255, 255, 0.045)',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          D
        </Box>
        <PageContainer sx={{ position: 'relative', pt: { xs: 8, md: 12 }, pb: { xs: 7, md: 10 } }}>
          <Typography component="span" sx={ceja}>Solicitud de ingreso</Typography>
          <Typography
            id="hazte-hermano-titulo"
            component="h1"
            sx={{ fontFamily: SERIF, fontSize: 'clamp(40px, 5.2vw, 68px)', lineHeight: 1.05, letterSpacing: '-0.02em', maxWidth: '12ch', mb: { xs: 2.5, md: 3 } }}
          >
            Hazte hermano
          </Typography>
          <Typography sx={{ fontSize: { xs: 16, md: 18 }, lineHeight: 1.7, color: 'text.secondary', maxWidth: '58ch' }}>
            Ser hermano es acompañar a Nuestra Señora de los Desamparados todo el año: en los cultos,
            en la estación de penitencia del Sábado de Pasión y en la labor de caridad y formación del
            Grupo Parroquial. La solicitud se rellena en unos minutos y se formaliza después en Secretaría.
          </Typography>
        </PageContainer>
      </Box>

      <AnimatedSection
        cascada
        sx={{
          py: { xs: 6, md: 10 },
          '& a:focus-visible, & button:focus-visible': { outline: `2px solid ${GOLD}`, outlineOffset: 4 },
        }}
      >
        <PageContainer>
          {/* El pliego va primero: quien llega desde la placa de la portada
              viene a rellenarlo. La columna con el proceso queda a su derecha
              en escritorio y debajo en móvil, como una nota al margen. */}
          <Grid container spacing={{ xs: 6, md: 8 }}>
            <Grid size={{ xs: 12, md: 8 }}>
              <Revela>
                <ThemeProvider theme={temaPapel}>
                  <Box
                    sx={{
                      backgroundColor: PAPEL,
                      color: TINTA_SOBRE_PAPEL,
                      p: { xs: '32px 20px', sm: '40px 36px', md: '56px 64px' },
                      boxShadow: '0 30px 60px -30px rgba(0, 0, 0, 0.9)',
                      '& a:focus-visible, & button:focus-visible': { outline: '2px solid #6e1822', outlineOffset: 3 },
                    }}
                  >
                    {enviada ? (
                      <SolicitudRecibida nombre={enviada.nombre} email={enviada.email} />
                    ) : (
                      <Box
                        component="form"
                        noValidate
                        onSubmit={handleSubmit(onSubmit)}
                        sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 3.5, md: 4 } }}
                      >
                        <Typography sx={{ fontSize: 15, lineHeight: 1.6, color: 'text.secondary' }}>
                          Todos los campos son obligatorios. Con ellos abrimos tu ficha de hermano
                          y te avisamos cuando el alta esté formalizada.
                        </Typography>

                        <Grupo leyenda="Datos personales">
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
                        </Grupo>

                        <Grupo leyenda="Contacto">
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField label="Email" type="email" autoComplete="email" {...campo('email')} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField label="Teléfono" type="tel" autoComplete="tel" {...campo('telefono', 'Nueve dígitos.')} />
                          </Grid>
                        </Grupo>

                        <Grupo leyenda="Domicilio">
                          <Grid size={{ xs: 12 }}>
                            <TextField label="Dirección" autoComplete="street-address" {...campo('direccion')} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 8 }}>
                            <TextField label="Ciudad" autoComplete="address-level2" {...campo('ciudad')} />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <TextField
                              label="Código postal"
                              autoComplete="postal-code"
                              slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 5 } }}
                              {...campo('codigoPostal')}
                            />
                          </Grid>
                        </Grupo>

                        <Grupo
                          leyenda="Acceso al área de hermanos"
                          descripcion="Con tu email y esta contraseña entrarás al área de hermanos cuando Secretaría active tu alta."
                        >
                          <Grid size={{ xs: 12, sm: 8 }}>
                            <CampoContrasena
                              label="Contraseña"
                              autoComplete="new-password"
                              {...campo('password', `Al menos ${LONGITUD_MINIMA} caracteres. Evita palabras evidentes y secuencias.`)}
                            />
                          </Grid>
                        </Grupo>

                        <FormControl error={!!errors.aceptarPolitica} sx={{ borderTop: `1px solid ${FILETE_PAPEL}`, pt: { xs: 3, md: 3.5 } }}>
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
                                  sx={{ color: 'primary.main', textDecoration: 'underline', textUnderlineOffset: 3 }}
                                >
                                  política de privacidad
                                </Box>
                              </>
                            }
                            slotProps={{ typography: { sx: { fontSize: 16, lineHeight: 1.5, pt: '3px' } } }}
                          />
                          <FormHelperText sx={{ ml: '33px', mt: 0.5, fontSize: 13 }}>
                            {errors.aceptarPolitica?.message
                              ?? 'Usamos tus datos solo para tramitar el alta y tu relación con el Grupo Parroquial.'}
                          </FormHelperText>
                        </FormControl>

                        {errorEnvio && <Alert severity="error" role="alert">{errorEnvio}</Alert>}

                        <AppButton
                          type="submit"
                          disabled={isSubmitting}
                          sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' }, borderRadius: '3px', px: 5 }}
                        >
                          {isSubmitting ? 'Enviando…' : 'Enviar solicitud'}
                        </AppButton>
                      </Box>
                    )}
                  </Box>
                </ThemeProvider>
              </Revela>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Revela orden={1} sx={{ position: { md: 'sticky' }, top: { md: 96 } }}>
                <ProcesoAlta />
              </Revela>
            </Grid>
          </Grid>
        </PageContainer>
      </AnimatedSection>
    </>
  )
}
