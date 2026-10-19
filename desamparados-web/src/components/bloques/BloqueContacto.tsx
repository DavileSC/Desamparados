import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link } from 'react-router-dom'
import { Alert, Box, Grid, TextField, Typography } from '@mui/material'
import EmailIcon from '@mui/icons-material/Email'
import PhoneIcon from '@mui/icons-material/Phone'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import TarjetaCristal from '../TarjetaCristal'
import Boton from '../Boton'
import { contactSchema, type ContactFormData } from '../../features/contacto/schema'
import { enviarMensajeDeContacto } from '../../lib/api/contacto'
import type { BloqueContacto as Datos, LineaDatos } from '../../lib/api/contenido'
import { valorDe } from './presentacion'
import { laCorporacion, mayuscula, segunLaCorporacion } from '../../domain/articulos'
import { CORMORANT } from '../../features/actualidad/agenda/letraAlmanaque'
import { MARCA, alfa } from '../../theme/marca'

// Trampa para robots: fuera de la vista, del tabulador y de los lectores de
// pantalla. Una persona no la ve ni la rellena; un programa que rellena todo
// lo que encuentra, sí, y el servidor descarta ese envío sin decírselo.
const trampaOculta = {
  position: 'absolute',
  left: '-10000px',
  top: 'auto',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
} as const

const esCorreo = ({ valor }: LineaDatos) => valor.includes('@')
const esTelefono = ({ valor }: LineaDatos) => /^[+\d][\d\s().-]{6,}$/.test(valor.trim())

/**
 * El icono de cada línea de la tarjeta, deducido de lo que dice.
 *
 * Las líneas se escriben en el CMS y no llevan icono propio: elegirlo sería un
 * campo más que rellenar, para algo que se adivina solo. Un correo tiene
 * arroba, un teléfono son cifras, y la dirección y el horario se reconocen por
 * cómo se llaman. Lo que no encaja lleva un icono neutro.
 */
function iconoDe(linea: LineaDatos) {
  const color = { color: 'secondary.main' }
  if (esCorreo(linea)) return <EmailIcon sx={color} />
  if (esTelefono(linea)) return <PhoneIcon sx={color} />
  if (/horario|hora/i.test(linea.etiqueta)) return <AccessTimeIcon sx={color} />
  if (/direcci|sede|lugar|dónde|donde/i.test(linea.etiqueta)) return <LocationOnIcon sx={color} />
  return <InfoOutlinedIcon sx={color} />
}

/** En la carta, el correo y el teléfono se pulsan: uno abre el correo y el otro llama. */
function enlaceDe(linea: LineaDatos): string | null {
  if (esCorreo(linea)) return `mailto:${linea.valor.trim()}`
  if (esTelefono(linea)) return `tel:${linea.valor.replace(/[^\d+]/g, '')}`
  return null
}

/**
 * Cuánto se ha tardado en rellenar el formulario, desde que se abrió (o se vació
 * tras enviar). El servidor descarta en silencio lo que se rellena en menos de
 * 3 segundos, que no es de una persona.
 */
function useTiempoRelleno() {
  const abiertoEn = useRef(0)
  useEffect(() => { abiertoEn.current = Date.now() }, [])
  const medir = useCallback(() => Date.now() - abiertoEn.current, [])
  const reiniciar = useCallback(() => { abiertoEn.current = Date.now() }, [])
  return { medir, reiniciar }
}

/**
 * El formulario de contacto y, a su lado, la tarjeta con las formas de llegar
 * al Grupo Parroquial; o, con «Carta», el formulario escrito como una carta y
 * los datos al pie.
 *
 * Era la página de Contacto entera, escrita a mano. El formulario sigue siendo
 * de código —lo que llega se envía por correo y sus comprobaciones y su trampa
 * para robots no son algo que convenga poder tocar desde el CMS—; lo editable
 * es la tarjeta: su título y sus líneas. Sin líneas, la tarjeta no se pinta y
 * el formulario ocupa todo el ancho.
 */
export default function BloqueContacto({ bloque }: { bloque: Datos }) {
  // Los datos, al lado del formulario (el de siempre), debajo, sin ellos o al pie de la carta.
  const disposicion = valorDe(bloque, 'disposicion')
  if (disposicion === 'carta') return <Carta bloque={bloque} />

  const conTarjeta = bloque.lineas.length > 0 && disposicion !== 'solo'
  const alLado = conTarjeta && disposicion === 'lado'

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12, md: alLado ? 7 : 12 }}>
        <FormularioDeContacto />
      </Grid>

      {conTarjeta && (
        <Grid size={{ xs: 12, md: alLado ? 5 : 12 }}>
          <TarjetaCristal sx={{ p: 4, height: '100%' }}>
            {bloque.tituloDatos && (
              <Typography variant="h4" component="h2" sx={{ mb: 4 }}>
                {bloque.tituloDatos}
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {bloque.lineas.map((linea, indice) => (
                <Box key={`${linea.etiqueta}-${indice}`} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  {iconoDe(linea)}
                  <Box>
                    <Typography variant="overline" sx={{ display: 'block', lineHeight: 1.2 }}>
                      {linea.etiqueta}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {linea.valor}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </TarjetaCristal>
        </Grid>
      )}
    </Grid>
  )
}

/** Las etiquetas de la carta: las del estilo «carta» del bloque de texto (Formación), en el oro apagado. */
const ETIQUETA_CARTA = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  color: MARCA.acentoApagado,
} as const

/**
 * La carta (19-10-2026): sin tarjeta ni hoja, sobre el fondo de la página y al
 * ancho de un texto en carta, para que se lea como Formación. El asunto, el
 * mensaje sobre renglones y la firma (quien escribe); al pie, tras un filete,
 * los datos de contacto en dos columnas.
 */
function Carta({ bloque }: { bloque: Datos }) {
  return (
    <Box sx={{ maxWidth: 680, mx: 'auto' }}>
      <FormularioDeContacto carta />

      {bloque.lineas.length > 0 && (
        <Box component="section" sx={{ mt: { xs: 6, md: 7 }, pt: 4, borderTop: `1px solid ${alfa(MARCA.acentoApagado, 0.35)}` }}>
          {bloque.tituloDatos && (
            <Typography component="h2" sx={{ fontFamily: CORMORANT, fontWeight: 600, fontSize: 26, lineHeight: 1.2, color: 'text.primary', mb: 3 }}>
              {bloque.tituloDatos}
            </Typography>
          )}
          <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, columnGap: 5, rowGap: 3 }}>
            {bloque.lineas.map((linea, indice) => {
              const destino = enlaceDe(linea)
              return (
                <Box key={`${linea.etiqueta}-${indice}`}>
                  <Box component="dt" sx={{ ...ETIQUETA_CARTA, fontSize: 11, letterSpacing: '0.24em', mb: 1 }}>{linea.etiqueta}</Box>
                  <Box component="dd" sx={{ m: 0, fontSize: 15, lineHeight: 1.55, color: 'text.secondary', overflowWrap: 'anywhere' }}>
                    {destino ? (
                      <Box component="a" href={destino} sx={{ color: 'text.primary', textDecoration: 'none', borderBottom: `1px solid ${alfa(MARCA.acentoApagado, 0.5)}`, '&:hover': { color: 'secondary.main' } }}>
                        {linea.valor}
                      </Box>
                    ) : linea.valor}
                  </Box>
                </Box>
              )
            })}
          </Box>
        </Box>
      )}
    </Box>
  )
}

/**
 * Los campos de la carta: subrayados, sin caja, con la etiqueta en mayúsculas
 * encima siempre (no flota dentro del campo), y el mensaje sobre renglones.
 */
const CAMPO_CARTA = {
  '& .MuiInputLabel-root': { ...ETIQUETA_CARTA, position: 'static', transform: 'none', mb: 0.5 },
  '& .MuiInputLabel-root.Mui-focused': { color: MARCA.acentoApagado },
  '& .MuiInputLabel-root.Mui-error': { color: 'error.main' },
  // MUI deja hueco arriba para la etiqueta flotante; aquí la etiqueta va encima, fuera del campo.
  '& .MuiInputLabel-root + .MuiInput-root': { mt: 0, fontSize: 17 },
  '& .MuiInput-input': { py: 1.25 },
  '& .MuiInput-underline:after': { borderBottomColor: MARCA.acento },
  '& textarea': {
    lineHeight: '36px',
    // Renglones apenas marcados, como una hoja pautada sobre el fondo oscuro.
    backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 35px, rgba(243, 235, 220, 0.12) 35px, rgba(243, 235, 220, 0.12) 36px)',
    backgroundAttachment: 'local',
  },
} as const

/**
 * Los campos, el envío y la trampa para robots. En la carta, el orden es el de
 * una carta: asunto, mensaje y la firma de quien escribe, en una fila.
 */
function FormularioDeContacto({ carta = false }: { carta?: boolean }) {
  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const tiempoRelleno = useTiempoRelleno()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nombre: '',
      email: '',
      telefono: '',
      asunto: '',
      mensaje: '',
      comentarioAdicional: '',
    },
  })

  const onSubmit = async (data: ContactFormData) => {
    setSuccess(false)
    setServerError(null)
    try {
      await enviarMensajeDeContacto(data, tiempoRelleno.medir())
      setSuccess(true)
      reset()
      tiempoRelleno.reiniciar()
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'No se ha podido enviar el mensaje. Inténtalo de nuevo más tarde.')
    }
  }

  // En la carta, subrayados y con la etiqueta encima; si no, los de siempre.
  const comoCampo = carta ? { variant: 'standard' as const, sx: CAMPO_CARTA, slotProps: { inputLabel: { shrink: true } } } : {}

  const nombre = (
    <TextField
      label="Nombre"
      autoComplete="name"
      fullWidth
      error={!!errors.nombre}
      helperText={errors.nombre?.message}
      {...comoCampo}
      {...register('nombre')}
    />
  )
  const email = (
    <TextField
      label="Email"
      type="email"
      autoComplete="email"
      fullWidth
      error={!!errors.email}
      helperText={errors.email?.message}
      {...comoCampo}
      {...register('email')}
    />
  )
  const telefono = (
    <TextField
      label="Teléfono (opcional)"
      type="tel"
      autoComplete="tel"
      fullWidth
      error={!!errors.telefono}
      helperText={errors.telefono?.message}
      {...comoCampo}
      {...register('telefono')}
    />
  )
  const asunto = (
    <TextField
      label="Asunto"
      fullWidth
      error={!!errors.asunto}
      helperText={errors.asunto?.message}
      {...comoCampo}
      {...register('asunto')}
    />
  )
  const mensaje = (
    <TextField
      label="Mensaje"
      multiline
      rows={carta ? 6 : 5}
      fullWidth
      error={!!errors.mensaje}
      helperText={errors.mensaje?.message}
      {...comoCampo}
      {...register('mensaje')}
    />
  )

  // Lo que pide la protección de datos en un formulario así: quién, para qué y dónde leer más.
  const privacidad = (
    <Typography sx={{ color: 'text.secondary', fontSize: 13, lineHeight: 1.6 }}>
      {mayuscula(laCorporacion())} {segunLaCorporacion('usa', 'usan')} estos datos solo para contestarte y no los {segunLaCorporacion('cede', 'ceden')} a nadie. Más información en la{' '}
      <Box component={Link} to="/politica-privacidad" sx={{ color: 'secondary.main', textDecoration: 'underline', textUnderlineOffset: 3 }}>
        política de privacidad
      </Box>
      .
    </Typography>
  )

  const enviar = (
    <Boton type="submit" disabled={isSubmitting} sx={carta ? { flexShrink: 0 } : undefined}>
      Enviar mensaje
    </Boton>
  )

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{ display: 'flex', flexDirection: 'column', gap: carta ? 3.5 : 3 }}
    >
      {success && (
        <Alert severity="success">
          Mensaje enviado correctamente. Gracias por contactar con nosotros.
        </Alert>
      )}
      {serverError && <Alert severity="error">{serverError}</Alert>}

      {carta ? (
        <>
          {asunto}
          {mensaje}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 3.5 }}>
            {nombre}
            {email}
            {telefono}
          </Box>
        </>
      ) : (
        <>
          {nombre}
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>{email}</Grid>
            <Grid size={{ xs: 12, md: 6 }}>{telefono}</Grid>
          </Grid>
          {asunto}
          {mensaje}
        </>
      )}

      {/* Ni el nombre ni la etiqueta son de los que autocompletan el navegador o
          los gestores de contraseñas (web, url, nombre…), y los data-* les piden
          expresamente que lo ignoren: si lo rellenaran por una persona, su
          mensaje se descartaría como si fuera de un robot. */}
      <Box aria-hidden="true" sx={trampaOculta}>
        <label htmlFor="contacto-comentario-adicional">Deja este campo vacío</label>
        <input
          id="contacto-comentario-adicional"
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

      {carta ? (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, gap: 3 }}>
          {privacidad}
          {enviar}
        </Box>
      ) : (
        <>
          {privacidad}
          {enviar}
        </>
      )}
    </Box>
  )
}
