import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react'
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate, useParams } from 'react-router-dom'
import PantallaEdicion from './PantallaEdicion'
import DialogoConfirmacion from '../../components/DialogoConfirmacion'
import { useVolverAlListado } from '../../hooks/useVolverAlListado'
import { useModulos } from '../../hooks/useModulos'
import { MOTIVOS_BAJA, darDeBajaHermano, emanciparHermano, fichaDeHermano, reactivarHermano, actualizarHermano, type AdminBrother, type DatosDeFichaDeHermano, type FichaDelCenso, type MotivoBaja } from '../../lib/api/hermanos'
import { PARENTESCOS } from '../../lib/api/auth'
import { ESTADO_CIVIL, SEXO } from '../areaHermano/perfil/etiquetas'
import { site } from '../../config/site'

const PARENTESCO = Object.fromEntries(PARENTESCOS.map((p) => [p.value, p.label]))

const MAYORIA_DE_EDAD = 18

/**
 * El día de Madrid (AAAA-MM-DD) de un instante. Todo el censo razona en el día
 * del Grupo Parroquial, igual que el servidor: un alta aprobada a las 00:30 de
 * Málaga son las 22:30 UTC del día anterior, y leída como día UTC salía un día
 * antes (y de mes, si era día 1). 'en-CA' formatea justo como AAAA-MM-DD.
 */
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' })
const diaMadrid = (instante: Date) => formatoDia.format(instante)

/** Día de hoy en Madrid, el mismo «hoy» con el que el servidor valida la baja. */
const hoyDia = () => diaMadrid(new Date())

/**
 * Años cumplidos, contando si ya ha llegado el cumpleaños de este año. Antes se
 * dividía entre 365,25 días y, en la semana del cumpleaños, el aviso de «ya
 * tiene 18» no coincidía con lo que decide el servidor.
 */
const aniosCumplidos = (nacimiento: string) => {
  const [anio, mes, dia] = aDia(nacimiento).split('-').map(Number)
  const [anioHoy, mesHoy, diaHoy] = hoyDia().split('-').map(Number)
  let edad = anioHoy - anio
  if (mesHoy < mes || (mesHoy === mes && diaHoy < dia)) edad -= 1
  return edad
}

/** El servidor manda ISO; los campos de fecha del navegador quieren el día (de Madrid). */
function aDia(iso: string | null) {
  return iso ? diaMadrid(new Date(iso)) : ''
}

/** AAAA-MM-DD → dd/mm/aaaa, sin pasar por Date (y sin líos de zona horaria). */
const diaLegible = (dia: string) => dia.split('-').reverse().join('/')

/**
 * En qué punto del censo está la ficha. Las tres se tratan distinto: solo una
 * activa se da de baja, solo una de baja se reactiva, y una pendiente se
 * aprueba o se rechaza desde Solicitudes.
 */
type Estado = 'activo' | 'baja' | 'pendiente'
const estadoDe = (f: AdminBrother): Estado => (f.activo ? 'activo' : f.fechaBaja ? 'baja' : 'pendiente')

/** Marca con la que el servidor deja una cuenta suprimida por el RGPD (ver cuenta-anonimizada.ts). */
const esCuentaSuprimida = (f: AdminBrother) => f.user?.email?.endsWith('@eliminado.local') ?? false

// Sin `activo`: la ficha no da altas ni bajas. Antes el interruptor «Hermano
// activo» y la fecha de baja se mandaban siempre y activaban solicitudes sin
// aprobarlas o dejaban a alguien de baja pero activo. Ahora hay botones para
// dar de baja y reactivar, y la fecha de baja solo se corrige si ya la hay.
type Formulario = {
  nombre: string; primerApellido: string; segundoApellido: string; dni: string; fechaNacimiento: string
  sexo: string; estadoCivil: string; profesion: string; lugarNacimiento: string; parentesco: string
  telefono: string; telefonoFijo: string; email: string; email2: string
  direccion: string; poblacion: string; codigoPostal: string; provincia: string; comunidadAutonoma: string; pais: string
  boletin: boolean
  autorizaImagen: boolean
  numeroHermano: string; fechaAlta: string; fechaBaja: string
  fechaJura: string; presentadoPor: string; presentadoPor2: string; fechaBautismo: string; lugarBautismo: string; parroquiaBautismo: string
  fechaMedalla: string; tratamiento: string
  tieneTunicaPropia: boolean; tunica: string; alturaHombro: string; puesto: string
}

/** Lo opcional vacío viaja como `null`: así se borra en el servidor. */
const opcional = (valor: string) => (valor.trim() === '' ? null : valor.trim())

/** Lo que cambia al dar de baja o reactivar: se refresca sin tocar lo que se esté editando. */
const camposDeEstado = (f: AdminBrother) => ({
  numeroHermano: f.numeroHermano?.toString() ?? '', fechaAlta: aDia(f.fechaAlta), fechaBaja: aDia(f.fechaBaja),
})

const desdeFicha = (f: AdminBrother & { parentesco?: string | null }): Formulario => ({
  nombre: f.nombre, primerApellido: f.primerApellido ?? f.apellidos, segundoApellido: f.segundoApellido ?? '',
  dni: f.dni ?? '', fechaNacimiento: aDia(f.fechaNacimiento),
  sexo: f.sexo ?? '', estadoCivil: f.estadoCivil ?? '', profesion: f.profesion ?? '', lugarNacimiento: f.lugarNacimiento ?? '',
  parentesco: f.parentesco ?? '',
  telefono: f.telefono ?? '', telefonoFijo: f.telefonoFijo ?? '', email: f.email ?? '', email2: f.email2 ?? '',
  direccion: f.direccion ?? '', poblacion: f.poblacion ?? '', codigoPostal: f.codigoPostal ?? '',
  provincia: f.provincia ?? '', comunidadAutonoma: f.comunidadAutonoma ?? '', pais: f.pais ?? '', boletin: f.boletin, autorizaImagen: f.autorizaImagen,
  fechaJura: aDia(f.fechaJura), presentadoPor: f.presentadoPor ?? '', presentadoPor2: f.presentadoPor2 ?? '',
  fechaMedalla: aDia(f.fechaMedalla), tratamiento: f.tratamiento ?? '',
  fechaBautismo: aDia(f.fechaBautismo), lugarBautismo: f.lugarBautismo ?? '', parroquiaBautismo: f.parroquiaBautismo ?? '',
  ...camposDeEstado(f),
  tieneTunicaPropia: f.tieneTunicaPropia, tunica: f.tunica ?? '',
  alturaHombro: f.alturaHombro?.toString() ?? '', puesto: f.puesto ?? '',
})

export default function HermanoEditPage() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { activo } = useModulos()
  // El listado del que se vino, con su página y sus filtros: el enlace de editar
  // los trae en el state. Sin state (URL tecleada) se cae en la ruta pelada.
  const volverAlListado = useVolverAlListado('/cms/hermanos')
  const [ficha, setFicha] = useState<FichaDelCenso | null>(null)
  const [form, setForm] = useState<Formulario | null>(null)
  const [inicial, setInicial] = useState<Formulario | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  // Baja, reactivación y emancipación comparten este estado: mientras una está
  // en marcha, ninguno de sus botones responde (un doble clic no manda dos).
  const [trabajando, setTrabajando] = useState(false)
  // Y además una guarda síncrona: el diálogo de confirmación tarda en cerrarse
  // (la transición de salida) y un segundo clic en su botón llegaría a tiempo.
  const enMarcha = useRef(false)
  const [dandoDeBaja, setDandoDeBaja] = useState(false)
  const [fechaBajaNueva, setFechaBajaNueva] = useState('')
  const [fechaDefuncion, setFechaDefuncion] = useState('')
  const [motivoBaja, setMotivoBaja] = useState<MotivoBaja | ''>('')
  const [reactivando, setReactivando] = useState(false)
  const [emancipando, setEmancipando] = useState(false)
  const [correoNuevo, setCorreoNuevo] = useState('')
  const [dniNuevo, setDniNuevo] = useState('')

  useEffect(() => {
    fichaDeHermano(Number(id))
      .then((f) => { setFicha(f); setForm(desdeFicha(f)); setInicial(desdeFicha(f)) })
      .catch(() => setError('No se ha podido cargar la ficha del hermano.'))
  }, [id])

  const campo = useCallback(<K extends keyof Formulario>(clave: K, valor: Formulario[K]) => {
    setForm((actual) => (actual ? { ...actual, [clave]: valor } : actual))
  }, [])

  /**
   * Tras dar de baja, reactivar o emancipar se recarga la ficha, pero en el
   * formulario solo se tocan número y fechas: si había cambios sin guardar en
   * otros campos, siguen ahí.
   */
  const refrescar = async () => {
    const nueva = await fichaDeHermano(Number(id))
    setFicha(nueva)
    setForm((actual) => (actual ? { ...actual, ...camposDeEstado(nueva) } : actual))
    setInicial((actual) => (actual ? { ...actual, ...camposDeEstado(nueva) } : actual))
  }

  const guardar = async () => {
    if (!form || !ficha) return
    const estado = estadoDe(ficha)
    if (estado === 'baja' && form.fechaBaja && form.fechaAlta && form.fechaBaja < form.fechaAlta) {
      setError('La fecha de baja no puede ser anterior a la de alta.')
      return
    }
    setError(null)
    setGuardando(true)
    // Las fechas solo viajan si se han tocado. El formulario conoce el día, no la
    // hora: reenviar un alta sin cambiarla la reescribía (y, leída como día UTC,
    // la movía al día anterior sin rastro en la auditoría).
    const tocada = (clave: 'fechaNacimiento' | 'fechaAlta' | 'fechaBaja') => !!form[clave] && form[clave] !== inicial?.[clave]
    // Bautismo, jura y medalla se pueden vaciar: si se tocan, viajan (vacías, como null).
    const cambiada = (clave: 'fechaBautismo' | 'fechaJura' | 'fechaMedalla') => form[clave] !== inicial?.[clave]
    try {
      await actualizarHermano(Number(id), {
        nombre: form.nombre,
        primerApellido: form.primerApellido.trim(),
        segundoApellido: opcional(form.segundoApellido),
        ...(form.dni ? { dni: form.dni } : {}),
        sexo: (form.sexo || null) as DatosDeFichaDeHermano['sexo'],
        estadoCivil: (form.estadoCivil || null) as DatosDeFichaDeHermano['estadoCivil'],
        profesion: opcional(form.profesion),
        lugarNacimiento: opcional(form.lugarNacimiento),
        ...(!ficha.esTitular && form.parentesco ? { parentesco: form.parentesco as DatosDeFichaDeHermano['parentesco'] } : {}),
        telefonoFijo: opcional(form.telefonoFijo),
        email2: opcional(form.email2),
        provincia: opcional(form.provincia),
        comunidadAutonoma: opcional(form.comunidadAutonoma),
        pais: opcional(form.pais),
        boletin: form.boletin,
        autorizaImagen: form.autorizaImagen,
        ...(cambiada('fechaBautismo') ? { fechaBautismo: form.fechaBautismo || null } : {}),
        lugarBautismo: opcional(form.lugarBautismo),
        parroquiaBautismo: opcional(form.parroquiaBautismo),
        ...(cambiada('fechaJura') ? { fechaJura: form.fechaJura || null } : {}),
        presentadoPor: opcional(form.presentadoPor),
        presentadoPor2: opcional(form.presentadoPor2),
        ...(cambiada('fechaMedalla') ? { fechaMedalla: form.fechaMedalla || null } : {}),
        tratamiento: opcional(form.tratamiento),
        ...(tocada('fechaNacimiento') ? { fechaNacimiento: form.fechaNacimiento } : {}),
        ...(form.telefono ? { telefono: form.telefono } : {}),
        ...(form.email ? { email: form.email } : {}),
        direccion: form.direccion,
        poblacion: form.poblacion,
        codigoPostal: form.codigoPostal,
        // El número solo se corrige en fichas activas: a las pendientes y a las
        // de baja se lo dan «Aprobar» y «Reactivar».
        ...(estado === 'activo' && form.numeroHermano ? { numeroHermano: Number(form.numeroHermano) } : {}),
        ...(tocada('fechaAlta') ? { fechaAlta: form.fechaAlta } : {}),
        // Y la fecha de baja solo se corrige donde ya hay una baja.
        ...(estado === 'baja' && tocada('fechaBaja') ? { fechaBaja: form.fechaBaja } : {}),
        tieneTunicaPropia: form.tieneTunicaPropia,
        tunica: form.tunica,
        ...(form.alturaHombro ? { alturaHombro: Number(form.alturaHombro) } : {}),
        puesto: form.puesto,
      })
      navegar(volverAlListado)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar la ficha.')
      setGuardando(false)
    }
  }

  const abrirBaja = () => { setFechaBajaNueva(hoyDia()); setMotivoBaja(''); setDandoDeBaja(true) }

  /** Envuelve baja, reactivación y emancipación: una sola a la vez, y nunca dos veces. */
  const trabajar = async (tarea: () => Promise<void>) => {
    if (enMarcha.current) return
    enMarcha.current = true
    setTrabajando(true)
    setError(null)
    setAviso(null)
    try {
      await tarea()
    } finally {
      enMarcha.current = false
      setTrabajando(false)
    }
  }

  const darDeBaja = () => trabajar(async () => {
    try {
      if (!motivoBaja) return
      const { message } = await darDeBajaHermano(Number(id), fechaBajaNueva, motivoBaja, fechaDefuncion || undefined)
      setDandoDeBaja(false)
      await refrescar()
      setAviso(message)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido dar de baja al hermano.')
      setDandoDeBaja(false)
    }
  })

  const reactivar = () => trabajar(async () => {
    setReactivando(false)
    try {
      const { message } = await reactivarHermano(Number(id))
      await refrescar()
      setAviso(message)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido reactivar al hermano.')
    }
  })

  const emancipar = () => trabajar(async () => {
    try {
      const cuenta = await emanciparHermano(Number(id), {
        newEmail: correoNuevo,
        ...(dniNuevo ? { newDni: dniNuevo } : {}),
      })
      setEmancipando(false)
      setAviso(`Se ha creado la cuenta de ${cuenta.email} y se le ha enviado un enlace para que ponga su contraseña.`)
      await refrescar()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido emancipar al hermano.')
      setEmancipando(false)
    }
  })

  if (error && !form) return <Alert severity="error">{error}</Alert>
  if (!form || !ficha) return <CircularProgress aria-label="Cargando la ficha" />

  const estado = estadoDe(ficha)
  const nombreCompleto = `${ficha.nombre} ${ficha.apellidos}`
  const cuentaSuprimida = esCuentaSuprimida(ficha)
  const mayorDeEdad = aniosCumplidos(ficha.fechaNacimiento) >= MAYORIA_DE_EDAD
  const hoy = hoyDia()
  // La baja se compara con el alta guardada, que es con la que la compara el servidor.
  const fechaBajaValida = !!fechaBajaNueva && fechaBajaNueva <= hoy && fechaBajaNueva >= aDia(ficha.fechaAlta)

  const texto = (clave: keyof Formulario, etiqueta: string, tipo = 'text', extra: Partial<ComponentProps<typeof TextField>> = {}) => (
    <TextField
      label={etiqueta}
      type={tipo}
      value={form[clave] as string}
      onChange={(e) => campo(clave, e.target.value as never)}
      // Sin `shrink`, la etiqueta se solapa con el dd/mm/aaaa del campo de fecha.
      slotProps={tipo === 'date' ? { inputLabel: { shrink: true } } : undefined}
      fullWidth
      {...extra}
    />
  )

  /** Un desplegable de la ficha; con `vacio`, se puede dejar sin indicar. */
  const opciones = (clave: keyof Formulario, etiqueta: string, mapa: Record<string, string>, vacio = true) => (
    <TextField select label={etiqueta} value={form[clave] as string} onChange={(e) => campo(clave, e.target.value as never)} fullWidth>
      {vacio && <MenuItem value=""><em>Sin indicar</em></MenuItem>}
      {Object.entries(mapa).map(([valor, textoOpcion]) => <MenuItem key={valor} value={valor}>{textoOpcion}</MenuItem>)}
    </TextField>
  )

  return (
    <>
      <Helmet><title>{`Editar hermano | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {aviso && <Alert severity="success" sx={{ mb: 3 }}>{aviso}</Alert>}
      <PantallaEdicion
        titulo="Editar hermano"
        nombre={nombreCompleto}
        sucio={JSON.stringify(form) !== JSON.stringify(inicial)}
        guardando={guardando}
        volverA={volverAlListado}
        onGuardar={guardar}
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>Datos personales</Typography>
            <Stack spacing={2}>
              {texto('nombre', 'Nombre')}
              {texto('primerApellido', 'Primer apellido')}
              {texto('segundoApellido', 'Segundo apellido')}
              {texto('dni', 'DNI')}
              {texto('fechaNacimiento', 'Fecha de nacimiento', 'date')}
              {opciones('sexo', 'Sexo', SEXO)}
              {opciones('estadoCivil', 'Estado civil', ESTADO_CIVIL)}
              {texto('profesion', 'Profesión')}
              {texto('lugarNacimiento', 'Natural de')}
              {!ficha.esTitular && opciones('parentesco', 'Parentesco con el titular de la cuenta', PARENTESCO, false)}
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>Contacto</Typography>
            <Stack spacing={2}>
              {texto('telefono', 'Teléfono móvil')}
              {texto('telefonoFijo', 'Teléfono fijo')}
              {texto('email', 'Correo electrónico')}
              {texto('email2', 'Segundo correo')}
              {texto('direccion', 'Dirección')}
              {texto('poblacion', 'Población')}
              {texto('codigoPostal', 'Código postal')}
              {texto('provincia', 'Provincia')}
              {texto('comunidadAutonoma', 'Comunidad autónoma')}
              {texto('pais', 'País')}
              <FormControlLabel
                control={<Switch checked={form.boletin} onChange={(e) => campo('boletin', e.target.checked)} />}
                label="Recibe el boletín de noticias"
              />
              <FormControlLabel
                control={<Switch checked={form.autorizaImagen} onChange={(e) => campo('autorizaImagen', e.target.checked)} />}
                label="Autoriza que se publiquen sus fotos"
              />
            </Stack>
          </Box>
          <Divider />
          <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>{site.tipo}</Typography>
            <Stack spacing={2}>
              {estado === 'activo' && (
                <Typography variant="body2" color="text.secondary">
                  En el censo desde el {diaLegible(aDia(ficha.fechaAlta))}.
                </Typography>
              )}
              {estado === 'baja' && (
                <Alert severity="warning">
                  De baja desde el {diaLegible(aDia(ficha.fechaBaja))}{ficha.motivoBaja ? ` (${MOTIVOS_BAJA[ficha.motivoBaja].toLowerCase()})` : ''}: no está en el censo ni tiene número.
                </Alert>
              )}
              {estado === 'pendiente' && (
                <Alert
                  severity="info"
                  action={<Button color="inherit" size="small" component={Link} to="/cms/hermanos?vista=solicitudes">Ir a Solicitudes</Button>}
                >
                  Solicitud de alta pendiente. Se aprueba o se rechaza desde Solicitudes; hasta entonces no tiene número ni está en el censo.
                </Alert>
              )}
              {texto('numeroHermano', 'Número de hermano', 'number', estado === 'activo' ? {} : {
                disabled: true,
                helperText: 'Lo asignan «Aprobar» o «Reactivar».',
              })}
              {texto('fechaAlta', 'Fecha de alta', 'date')}
              {texto('fechaJura', 'Fecha de jura', 'date')}
              {texto('presentadoPor', 'Presentado por')}
              {texto('presentadoPor2', 'Presentado también por')}
              {texto('fechaMedalla', 'Imposición de la medalla', 'date')}
              {texto('tratamiento', 'Tratamiento', 'text', {
                placeholder: 'D., Dña., Rvdo. P., Ilmo. Sr. D.…',
                helperText: 'Cómo se le nombra en la papeleta y las cartas. Vacío: «D.» o «Dña.» según el sexo.',
                slotProps: { htmlInput: { maxLength: 40 } },
              })}
              {texto('fechaBautismo', 'Fecha de bautismo', 'date', { helperText: 'Opcional. Dato religioso: solo lo ven el hermano y la gestión del censo.' })}
              {texto('lugarBautismo', 'Bautizado/a en')}
              {texto('parroquiaBautismo', 'Parroquia de bautismo')}
              {estado === 'baja' && texto('fechaBaja', 'Fecha de baja', 'date', {
                helperText: 'Solo para corregir la fecha. No puede ser anterior al alta.',
                slotProps: { inputLabel: { shrink: true }, htmlInput: { min: form.fechaAlta || undefined, max: hoy } },
              })}
              <Box>
                {estado === 'activo' && (
                  <Button variant="outlined" color="error" disabled={trabajando} onClick={abrirBaja}>Dar de baja</Button>
                )}
                {estado === 'baja' && (
                  <Button variant="outlined" disabled={trabajando} onClick={() => setReactivando(true)}>Reactivar</Button>
                )}
              </Box>
            </Stack>
          </Box>
          {activo('procesion') && (
            <>
              <Divider />
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>Procesión</Typography>
                <Stack spacing={2}>
                  {texto('puesto', 'Puesto en el cortejo')}
                  {texto('tunica', 'Talla de túnica')}
                  {texto('alturaHombro', 'Altura de hombro (cm)', 'number')}
                  <FormControlLabel
                    control={<Switch checked={form.tieneTunicaPropia} onChange={(e) => campo('tieneTunicaPropia', e.target.checked)} />}
                    label="Tiene túnica propia"
                  />
                </Stack>
              </Box>
            </>
          )}

          {(!ficha.esTitular || cuentaSuprimida) && (
            <>
              <Divider />
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>Cuenta y tutor</Typography>
                <Typography variant="body2" color="text.secondary">
                  {cuentaSuprimida
                    // Reactivar a quien pidió borrar sus datos devuelve la ficha
                    // al censo, pero no reabre aquella cuenta: se le crea otra.
                    ? 'Su cuenta de acceso se eliminó a petición suya (RGPD). Si vuelve a necesitar entrar en la web, créale una cuenta nueva: le llegará un enlace para poner su contraseña.'
                    : ficha.enCensoImportado
                      ? 'No tiene cuenta: está en el censo importado hasta que se sepa de qué familia es.'
                      : `Depende de la cuenta de ${ficha.user?.email ?? 'otro hermano'}.`}
                </Typography>
                {mayorDeEdad && estado === 'activo' && !cuentaSuprimida && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Ya ha cumplido {MAYORIA_DE_EDAD} años: puede tener cuenta propia.
                  </Alert>
                )}
                {!mayorDeEdad && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Podrá tener cuenta propia cuando cumpla {MAYORIA_DE_EDAD} años.
                  </Typography>
                )}
                {mayorDeEdad && estado !== 'activo' && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Solo un hermano en el censo puede tener cuenta propia.
                  </Typography>
                )}
                <Button sx={{ mt: 2 }} disabled={!mayorDeEdad || estado !== 'activo' || trabajando} onClick={() => setEmancipando(true)}>
                  {/* Del censo importado no se emancipa: no hay familia de la que separarse.
                      Es el mismo camino (cuenta nueva y enlace), dicho como lo que es. */}
                  {cuentaSuprimida ? 'Crear cuenta nueva' : ficha.enCensoImportado ? 'Darle cuenta propia' : 'Emancipar'}
                </Button>
              </Box>
            </>
          )}
        </Stack>
      </PantallaEdicion>

      {/*
        La baja lleva fecha, y DialogoConfirmacion solo admite un mensaje de
        texto: por eso este diálogo es propio, con el mismo patrón (pregunta,
        «Volver» y la acción en rojo).
      */}
      <Dialog open={dandoDeBaja} onClose={() => { if (!trabajando) setDandoDeBaja(false) }} aria-labelledby="dialogo-baja">
        <DialogTitle id="dialogo-baja">¿Dar de baja a {nombreCompleto}?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Sale del censo y pierde su número de hermano: si vuelve, se le dará uno nuevo al final de la lista.
            Si era el último perfil activo de su cuenta, la cuenta queda bloqueada.
          </DialogContentText>
          <TextField
            label="Fecha de baja"
            type="date"
            value={fechaBajaNueva}
            onChange={(e) => setFechaBajaNueva(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: aDia(ficha.fechaAlta), max: hoy } }}
            helperText="Por defecto, hoy. No puede ser anterior al alta ni posterior a hoy."
            error={!!fechaBajaNueva && !fechaBajaValida}
            fullWidth
            sx={{ mt: 3 }}
          />
          <TextField
            select
            label="Motivo"
            value={motivoBaja}
            onChange={(e) => setMotivoBaja(e.target.value as MotivoBaja)}
            helperText={motivoBaja === 'FALLECIMIENTO'
              ? 'No se envía el correo de baja.'
              : motivoBaja === 'IMPAGO'
                ? 'El correo de baja dirá que es por no constar el pago de las cuotas.'
                : 'Queda en la ficha y en la auditoría.'}
            fullWidth
            sx={{ mt: 2 }}
          >
            {(Object.entries(MOTIVOS_BAJA) as [MotivoBaja, string][]).map(([valor, texto]) => <MenuItem key={valor} value={valor}>{texto}</MenuItem>)}
          </TextField>
          {motivoBaja === 'FALLECIMIENTO' && (
            <TextField
              label="Fecha del fallecimiento"
              type="date"
              value={fechaDefuncion}
              onChange={(e) => setFechaDefuncion(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: aDia(ficha.fechaAlta), max: hoy } }}
              helperText="Si no es la de la baja. De ella salen sus aniversarios, en la pestaña «Difuntos»."
              fullWidth
              sx={{ mt: 2 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={trabajando} onClick={() => setDandoDeBaja(false)}>Volver</Button>
          <Button variant="contained" color="error" disabled={trabajando || !fechaBajaValida || !motivoBaja} onClick={() => void darDeBaja()}>
            {trabajando ? 'Dando de baja…' : 'Dar de baja'}
          </Button>
        </DialogActions>
      </Dialog>

      <DialogoConfirmacion
        abierto={reactivando}
        titulo={`¿Reactivar a ${nombreCompleto}?`}
        mensaje="Vuelve al censo con fecha de alta de hoy y un número nuevo al final de la lista, y su cuenta recupera el acceso a la web."
        textoConfirmar="Reactivar"
        onConfirmar={() => void reactivar()}
        onCancelar={() => setReactivando(false)}
      />

      <Dialog open={emancipando} onClose={() => { if (!trabajando) setEmancipando(false) }} aria-labelledby="dialogo-emancipar">
        <DialogTitle id="dialogo-emancipar">
          {cuentaSuprimida ? `Crear una cuenta nueva a ${nombreCompleto}`
            : ficha.enCensoImportado ? `Darle cuenta propia a ${nombreCompleto}` : `Emancipar a ${nombreCompleto}`}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Se le crea su propia cuenta y se le manda un enlace para que ponga su contraseña.
            Aquí no se escribe ninguna contraseña: la elige el hermano.
          </Typography>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Correo del hermano" type="email" value={correoNuevo} onChange={(e) => setCorreoNuevo(e.target.value)} fullWidth autoFocus />
            {/* El DNI solo hace falta si la ficha no lo tiene: la cuenta lo exige. */}
            {!ficha.dni && <TextField label="DNI del hermano" value={dniNuevo} onChange={(e) => setDniNuevo(e.target.value)} fullWidth />}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={trabajando} onClick={() => setEmancipando(false)}>Volver</Button>
          <Button variant="contained" disabled={trabajando || !correoNuevo || (!ficha.dni && !dniNuevo)} onClick={() => void emancipar()}>
            {trabajando ? 'Creando la cuenta…' : ficha.enCensoImportado ? 'Crear su cuenta' : 'Emancipar hermano'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
