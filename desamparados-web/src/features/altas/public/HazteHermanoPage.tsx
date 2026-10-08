import { useState, type FormEvent } from 'react'
import { flushSync } from 'react-dom'
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Alert, Box, Checkbox, FormControl, FormControlLabel, FormHelperText, FormLabel, Grid, MenuItem, Radio, RadioGroup,
  TextField, Typography,
} from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import MetaDePagina from '../../../components/MetaDePagina'
import { Link } from 'react-router-dom'
import ContenedorDePagina from '../../../components/ContenedorDePagina'
import { Revela } from '../../../components/SeccionAnimada'
import Boton from '../../../components/Boton'
import CampoContrasena from '../../../components/CampoContrasena'
import { LONGITUD_MINIMA } from '../../../lib/politicaDeContrasena'
import { register as apiRegister } from '../../../lib/api/auth'
import { ErrorDeApi } from '../../../lib/api/cliente'
import { GOLD, SERIF, ceja } from '../../inicio/estilos'
import {
  DOCUMENTOS_ALTA, ESTADOS_CIVILES, SEXOS, conFichaPropia, conMenores, membershipSchema, menorVacio,
  type Camino, type MembershipFormData,
} from './schema'
import { ESTADO_CIVIL, SEXO } from '../../areaHermano/perfil/etiquetas'
import { esDeLaTabla, provinciaDeCodigoPostal } from '../../../lib/provincias'
import CampoDocumento from './CampoDocumento'
import { temaTarjeta, FILETE_TARJETA, TARJETA } from './temaTarjeta'
import ProcesoAlta from './ProcesoAlta'
import SolicitudRecibida from './SolicitudRecibida'
import EleccionCamino from './EleccionCamino'
import PasoMenores from './PasoMenores'
import FondoDeSolicitud from './FondoDeSolicitud'

import { CAMPOS_API, VALORES_INICIALES, pasosDe, type Campo } from './pasos'
import { deLaCorporacion, laCorporacion } from '../../../domain/articulos'
import { site } from '../../../config/site'

// Mismo umbral que el navbar (`DESKTOP_NAV_MIN`): por debajo la barra va en
// flujo y mide 56 px en móvil y 64 en tableta; desde ahí es fija de 72 px y se
// pone encima de la página, así que la sección la deja pasar con su relleno.
const ESCRITORIO = '@media (min-width:1024px)'


/** Fuera de la pantalla pero en el árbol: un robot lo rellena, una persona no lo ve. */
const TRAMPA_OCULTA = { position: 'absolute', left: '-10000px', top: 'auto', width: '1px', height: '1px', overflow: 'hidden' } as const

/** Botones del pie de la tarjeta: misma altura los dos y sin partir el texto en móvil. */
const BOTON_PIE = { borderRadius: '3px', height: 48, py: 0, whiteSpace: 'nowrap' } as const

/** Campos que no son una casilla con foco: el cambio de paso no se lo pasa. */
const SIN_FOCO: Campo[] = ['camino', 'menores', 'foto', 'certificadoBautismo', 'titularidad', 'formaPago', 'sexo', 'estadoCivil']

const ETIQUETA_DOMICILIO = { provincia: 'Provincia', comunidadAutonoma: 'Comunidad autónoma', pais: 'País' } as const
const AUTOCOMPLETAR_DOMICILIO = { provincia: 'address-level1', comunidadAutonoma: 'off', pais: 'country-name' } as const

const TITULARIDAD = {
  PROPIA: 'Sí, soy titular',
  FAMILIAR_HERMANO: 'No, es un familiar hermano/a',
  OTRA_PERSONA: 'No, es otra persona',
} as const

export default function HazteHermanoPage() {
  const [paso, setPaso] = useState(0)
  const [camino, setCamino] = useState<Camino | null>(null)
  const [enviada, setEnviada] = useState<{ nombre: string; email: string; fichas: number; soloMenores: boolean } | null>(null)
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)

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
  const formaPago = useWatch({ control, name: 'formaPago' })
  const titularidad = useWatch({ control, name: 'titularidad' })

  /**
   * El código postal dice la provincia y la comunidad: se rellenan solas, salvo
   * que la persona haya escrito otra cosa a mano (entonces se respeta).
   */
  const alCambiarCodigoPostal = (valor: string) => {
    const hallada = provinciaDeCodigoPostal(valor)
    if (!hallada) return
    if (esDeLaTabla(getValues('provincia'))) setValue('provincia', hallada.provincia)
    if (esDeLaTabla(getValues('comunidadAutonoma'))) setValue('comunidadAutonoma', hallada.comunidad)
  }

  const pasoDe = (campo: Campo) => PASOS.findIndex((p) => p.campos.includes(campo))
  /** El primer campo en orden de pasos, para llevar allí a la persona cuando algo falla. */
  const primeroEnOrden = (campos: Campo[]) => [...campos].sort((a, b) => pasoDe(a) - pasoDe(b))[0]

  /** Cambia al paso del campo y le pasa el foco: el paso se pinta ya, para que el campo se pueda enfocar. */
  const irA = (campo: Campo) => {
    const destino = pasoDe(campo)
    flushSync(() => setPaso(destino === -1 ? 0 : destino))
    if (!SIN_FOCO.includes(campo)) setFocus(campo)
  }

  const irAlPaso = (indice: number) => {
    flushSync(() => setPaso(indice))
    const primero = PASOS[indice].campos[0]
    if (!SIN_FOCO.includes(primero)) setFocus(primero)
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

  const onSubmit = async (data: MembershipFormData) => {
    setErrorEnvio(null)
    try {
      const propia = conFichaPropia(data.camino)
      const respuesta = await apiRegister({
        ...data,
        poblacion: data.ciudad,
        // Sin ficha propia no se manda fecha de nacimiento: el servidor la usa
        // justo para saber si hay que crearla. Ni lo que va con ella.
        fechaNacimiento: propia ? data.fechaNacimiento : undefined,
        ficha: propia && data.sexo && data.estadoCivil
          ? {
              sexo: data.sexo, estadoCivil: data.estadoCivil, fechaBautismo: data.fechaBautismo,
              lugarBautismo: data.lugarBautismo, parroquiaBautismo: data.parroquiaBautismo,
            }
          : undefined,
        pago: data.formaPago
          ? { forma: data.formaPago, iban: data.iban, titularidad: data.titularidad, titularCuenta: data.titularCuenta }
          : undefined,
        foto: propia ? data.foto : null,
        certificadoBautismo: propia ? data.certificadoBautismo : null,
        menores: conMenores(data.camino) ? data.menores : undefined,
      })
      setEnviada({ nombre: data.nombre.trim(), email: data.email.trim(), fichas: respuesta.fichas, soloMenores: !conFichaPropia(data.camino) })
      reset()
      setCamino(null)
      setPaso(0)
    } catch (error) {
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
        descripcion={`Solicita tu alta como hermano ${deLaCorporacion()} de ${site.titular}. Rellena la solicitud y formaliza el alta en Secretaría.`}
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
                Ser hermano es acompañar a {site.titular} todo el año: en los
                cultos, en la estación de penitencia del Sábado de Pasión y en la labor de caridad y
                formación {deLaCorporacion()}. La solicitud se rellena aquí y se formaliza después en
                Secretaría.
              </Typography>
              <Typography sx={{ display: { xs: 'block', md: 'none' }, fontSize: 15, lineHeight: 1.6, color: 'text.secondary' }}>
                Unos minutos. El alta se formaliza después en Secretaría.
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
                      {/* Campo trampa para robots, escondido fuera de la pantalla.
                          Ni el nombre ni la etiqueta son de los que autocompletan el
                          navegador o los gestores de contraseñas (web, url, nombre…), y
                          los data-* les piden expresamente que lo ignoren: si lo
                          rellenaran por una persona, su alta se descartaría como si
                          fuera de un robot. */}
                      <Box aria-hidden="true" sx={TRAMPA_OCULTA}>
                        <label htmlFor="alta-comentario-adicional">Deja este campo vacío</label>
                        <input
                          id="alta-comentario-adicional"
                          type="text"
                          tabIndex={-1}
                          autoComplete="off"
                          data-lpignore="true"
                          data-1p-ignore="true"
                          data-bwignore="true"
                          data-form-type="other"
                          {...register('comentarioAdicional')}
                        />
                      </Box>
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
                                      <TextField label="Primer apellido" autoComplete="family-name" {...campo('primerApellido')} />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                      <TextField label="Segundo apellido" autoComplete="off" {...campo('segundoApellido')} />
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
                                    {camino !== null && conFichaPropia(camino) && (
                                      <>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                          <Controller
                                            control={control}
                                            name="sexo"
                                            render={({ field }) => (
                                              <TextField select label="Sexo" fullWidth {...field} error={!!errors.sexo} helperText={errors.sexo?.message}>
                                                {SEXOS.map((valor) => <MenuItem key={valor} value={valor}>{SEXO[valor]}</MenuItem>)}
                                              </TextField>
                                            )}
                                          />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                          <Controller
                                            control={control}
                                            name="estadoCivil"
                                            render={({ field }) => (
                                              <TextField select label="Estado civil" fullWidth {...field} error={!!errors.estadoCivil} helperText={errors.estadoCivil?.message}>
                                                {ESTADOS_CIVILES.map((valor) => <MenuItem key={valor} value={valor}>{ESTADO_CIVIL[valor]}</MenuItem>)}
                                              </TextField>
                                            )}
                                          />
                                        </Grid>
                                      </>
                                    )}
                                  </>
                                )}

                                {p.campos[0] === 'fechaBautismo' && (
                                  <>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                      <TextField
                                        label="Fecha de bautismo"
                                        type="date"
                                        slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hoy } }}
                                        {...campo('fechaBautismo')}
                                      />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                      <TextField label="Bautizado/a en" autoComplete="off" {...campo('lugarBautismo', 'La localidad. Opcional.')} />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                      <TextField label="Parroquia" autoComplete="off" {...campo('parroquiaBautismo', 'Opcional.')} />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                      <Controller
                                        control={control}
                                        name="certificadoBautismo"
                                        render={({ field }) => (
                                          <CampoDocumento
                                            etiqueta="Certificado de bautismo"
                                            ayuda={`Opcional: si no lo tienes a mano, lo puedes entregar en Secretaría. ${DOCUMENTOS_ALTA.certificadoBautismo.tipos}, hasta ${DOCUMENTOS_ALTA.certificadoBautismo.megas} MB.`}
                                            aceptar={DOCUMENTOS_ALTA.certificadoBautismo.extensiones}
                                            valor={field.value}
                                            onCambiar={(fichero) => { field.onChange(fichero); void trigger('certificadoBautismo') }}
                                            error={errors.certificadoBautismo?.message}
                                          />
                                        )}
                                      />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
                                        Solo los ve la Secretaría {deLaCorporacion()}.
                                      </Typography>
                                    </Grid>
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
                                      primerApellidoDelTitular={getValues('primerApellido')}
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
                                    <Grid size={{ xs: 5, sm: 4 }}>
                                      <TextField
                                        label="Código postal"
                                        autoComplete="postal-code"
                                        slotProps={{ htmlInput: { inputMode: 'numeric', maxLength: 5 } }}
                                        {...campo('codigoPostal')}
                                        {...register('codigoPostal', { onChange: (e: { target: { value: string } }) => alCambiarCodigoPostal(e.target.value) })}
                                      />
                                    </Grid>
                                    <Grid size={{ xs: 7, sm: 8 }}>
                                      <TextField label="Localidad" autoComplete="address-level2" {...campo('ciudad')} />
                                    </Grid>
                                    {/* Controlados: se rellenan solos desde el código postal, y
                                        un campo sin controlar no subiría la etiqueta al llenarse. */}
                                    {(['provincia', 'comunidadAutonoma', 'pais'] as const).map((nombre) => (
                                      <Grid key={nombre} size={{ xs: 12, sm: nombre === 'pais' ? 12 : 6 }}>
                                        <Controller
                                          control={control}
                                          name={nombre}
                                          render={({ field }) => (
                                            <TextField
                                              {...field}
                                              label={ETIQUETA_DOMICILIO[nombre]}
                                              autoComplete={AUTOCOMPLETAR_DOMICILIO[nombre]}
                                              fullWidth
                                              error={!!errors[nombre]}
                                              helperText={errors[nombre]?.message}
                                            />
                                          )}
                                        />
                                      </Grid>
                                    ))}
                                  </>
                                )}

                                {p.campos[0] === 'formaPago' && (
                                  <>
                                    <Grid size={{ xs: 12 }}>
                                      <Typography sx={{ fontSize: 15, lineHeight: 1.6, color: 'text.secondary', maxWidth: '60ch' }}>
                                        La cuota de hermano es anual. Puedes domiciliarla en tu banco o pagarla en Secretaría.
                                      </Typography>
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                      <Controller
                                        control={control}
                                        name="formaPago"
                                        render={({ field }) => (
                                          <TextField select label="Forma de pago" fullWidth {...field} error={!!errors.formaPago} helperText={errors.formaPago?.message}>
                                            <MenuItem value="DOMICILIACION">Domiciliación bancaria</MenuItem>
                                            <MenuItem value="EFECTIVO">En Secretaría</MenuItem>
                                          </TextField>
                                        )}
                                      />
                                    </Grid>
                                    {formaPago === 'DOMICILIACION' && (
                                      <>
                                        <Grid size={{ xs: 12 }}>
                                          <TextField
                                            label="IBAN"
                                            autoComplete="off"
                                            placeholder="ES00 0000 0000 0000 0000 0000"
                                            slotProps={{ htmlInput: { autoCapitalize: 'characters', spellCheck: false } }}
                                            {...campo('iban')}
                                          />
                                        </Grid>
                                        <Grid size={{ xs: 12 }}>
                                          <FormControl>
                                            <FormLabel id="alta-titularidad" sx={{ fontSize: 15, color: 'text.primary', '&.Mui-focused': { color: 'text.primary' } }}>
                                              ¿Eres titular de la cuenta?
                                            </FormLabel>
                                            <Controller
                                              control={control}
                                              name="titularidad"
                                              render={({ field }) => (
                                                <RadioGroup aria-labelledby="alta-titularidad" {...field}>
                                                  {(Object.entries(TITULARIDAD) as [keyof typeof TITULARIDAD, string][]).map(([valor, texto]) => (
                                                    <FormControlLabel key={valor} value={valor} control={<Radio />} label={texto} />
                                                  ))}
                                                </RadioGroup>
                                              )}
                                            />
                                          </FormControl>
                                        </Grid>
                                        {titularidad !== 'PROPIA' && (
                                          <Grid size={{ xs: 12 }}>
                                            <TextField label="Nombre y apellidos del titular" autoComplete="off" {...campo('titularCuenta')} />
                                          </Grid>
                                        )}
                                      </>
                                    )}
                                  </>
                                )}

                                {p.campos.includes('password') && (
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
                                    {camino !== null && conFichaPropia(camino) && (
                                      <Grid size={{ xs: 12 }}>
                                        <Controller
                                          control={control}
                                          name="foto"
                                          render={({ field }) => (
                                            <CampoDocumento
                                              etiqueta="Fotografía"
                                              ayuda={`Para tu ficha. Opcional. ${DOCUMENTOS_ALTA.foto.tipos}, hasta ${DOCUMENTOS_ALTA.foto.megas} MB.`}
                                              aceptar={DOCUMENTOS_ALTA.foto.extensiones}
                                              valor={field.value}
                                              onCambiar={(fichero) => { field.onChange(fichero); void trigger('foto') }}
                                              error={errors.foto?.message}
                                            />
                                          )}
                                        />
                                      </Grid>
                                    )}
                                    <Grid size={{ xs: 12, sm: 8 }}>
                                      <CampoContrasena
                                        label="Contraseña"
                                        autoComplete="new-password"
                                        {...campo('password', `Al menos ${LONGITUD_MINIMA} caracteres. Evita palabras evidentes y secuencias.`)}
                                      />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                      <FormControlLabel
                                        control={<Checkbox {...register('boletin')} sx={{ mt: '-6px' }} />}
                                        label="Quiero recibir el boletín de noticias por correo"
                                        slotProps={{ typography: { sx: { fontSize: 16, lineHeight: 1.5, pt: '3px' } } }}
                                        sx={{ alignItems: 'flex-start' }}
                                      />
                                    </Grid>
                                    {/* Aparte de la política: publicar la cara de alguien pide su permiso, y el de quien inscribe por los menores. */}
                                    <Grid size={{ xs: 12 }}>
                                      <FormControlLabel
                                        control={<Checkbox {...register('autorizaImagen')} sx={{ mt: '-6px' }} />}
                                        label={`Autorizo que se publiquen en la web y en las redes ${deLaCorporacion()} las fotos de cultos y salidas en que ${
                                          camino === null || camino === 'HERMANO' ? 'aparezca' : conFichaPropia(camino) ? 'aparezcamos yo o los menores que inscribo' : 'aparezcan los menores que inscribo'
                                        }`}
                                        slotProps={{ typography: { sx: { fontSize: 16, lineHeight: 1.5, pt: '3px' } } }}
                                        sx={{ alignItems: 'flex-start' }}
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
                                            ?? `Usamos tus datos solo para tramitar el alta y tu relación con ${laCorporacion()}.`}
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
                          <Boton type="button" appVariant="outline" onClick={retroceder} sx={{ ...BOTON_PIE, px: { xs: 2, sm: 3 } }}>
                            Atrás
                          </Boton>
                        ) : (
                          <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{`Da el primer paso para seguir tu camino con ${site.titular}.`}</Typography>
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
