import { type ReactNode, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material'
import { useBlocker } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import AvisoCambiosSinGuardar from '../ficha/AvisoCambiosSinGuardar'
import { useAvisoAlCerrarLaPestana } from '../../../hooks/useAvisoAlCerrarLaPestana'
import {
  datosDeContactoDelCms, guardarDatosDeContacto, ponerDatosDeContacto, type DatosDeContacto,
} from '../../../lib/api/corporacion'
import { ErrorDeApi } from '../../../lib/api/cliente'
import type { Red } from '../../../../../shared/datos-entidad.mjs'
import type { AccionesDelFormulario } from './acciones'

const CLAVE_CMS = ['cms', 'corporacion'] as const

type Tipo = 'texto' | 'correo' | 'enlace'
interface Campo {
  /** La misma ruta que da el servidor en sus errores (`secretaria.email`): así cada aviso cae en su campo. */
  ruta: string
  etiqueta: string
  /** Los topes del esquema de la API (`corporacion.schema.ts`), para no enterarse al guardar. */
  max: number
  tipo: Tipo
  ayuda?: string
  ejemplo?: string
}

// Un `Record<Red, …>` y no una lista suelta: si mañana se añade una red al
// fichero de la instalación, esto deja de compilar en vez de quedarse sin campo.
const REDES: Record<Red, string> = { facebook: 'Facebook', instagram: 'Instagram', x: 'X (Twitter)', tiktok: 'TikTok', youtube: 'YouTube' }

const BLOQUES: { titulo: string; resumen: string; campos: Campo[] }[] = [
  {
    titulo: 'Secretaría',
    resumen: 'Sale en el pie de toda la web, en el alta y en los correos.',
    campos: [
      { ruta: 'secretaria.horario', etiqueta: 'Horario', max: 120, tipo: 'texto', ejemplo: 'Martes y jueves, de 19:00 a 21:00' },
      { ruta: 'secretaria.telefono', etiqueta: 'Teléfono', max: 30, tipo: 'texto' },
      { ruta: 'secretaria.email', etiqueta: 'Correo', max: 254, tipo: 'correo' },
    ],
  },
  {
    titulo: 'Sede',
    resumen: 'Dónde está: el pie la enseña en el mapa y el enlace «Cómo llegar» la busca en Google Maps.',
    campos: [
      { ruta: 'sede.nombre', etiqueta: 'Nombre', max: 120, tipo: 'texto', ejemplo: 'Parroquia de…' },
      { ruta: 'sede.calle', etiqueta: 'Calle y número', max: 160, tipo: 'texto' },
      { ruta: 'sede.codigoPostal', etiqueta: 'Código postal', max: 10, tipo: 'texto' },
      { ruta: 'sede.localidad', etiqueta: 'Localidad', max: 80, tipo: 'texto' },
    ],
  },
  {
    titulo: 'Redes',
    resumen: 'La dirección entera de cada perfil. Una red vacía no sale en la web.',
    campos: (Object.keys(REDES) as Red[]).map((red) => ({ ruta: `redes.${red}`, etiqueta: REDES[red], max: 300, tipo: 'enlace', ejemplo: 'https://…' })),
  },
  {
    titulo: 'Protección de datos',
    resumen: 'Dónde se piden el acceso, la rectificación o la supresión de los datos personales.',
    campos: [
      { ruta: 'privacidad.emailDerechos', etiqueta: 'Correo para ejercer los derechos', max: 254, tipo: 'correo', ayuda: 'Vacío: se usa el correo de Secretaría.' },
    ],
  },
]
const CAMPOS = BLOQUES.flatMap((b) => b.campos)

type Formulario = Record<string, string>

// Los datos van por rutas planas mientras se editan: así el formulario, sus
// errores y los del servidor hablan del mismo `secretaria.email`.
function aFormulario(datos: DatosDeContacto): Formulario {
  const grupos = datos as unknown as Record<string, Record<string, string | null>>
  return Object.fromEntries(CAMPOS.map(({ ruta }) => {
    const [grupo, clave] = ruta.split('.')
    return [ruta, grupos[grupo][clave] ?? '']
  }))
}

// Vacío viaja como `null`, que es «pendiente»: la web deja el hueco antes que enseñar un dato a medias.
function aDatos(formulario: Formulario): DatosDeContacto {
  const salida: Record<string, Record<string, string | null>> = {}
  for (const { ruta } of CAMPOS) {
    const [grupo, clave] = ruta.split('.')
    salida[grupo] ??= {}
    salida[grupo][clave] = formulario[ruta].trim() || null
  }
  return salida as unknown as DatosDeContacto
}

/** Lo mismo que comprueba la API, dicho antes de guardar. */
function errorDe(tipo: Tipo, valor: string): string | null {
  const v = valor.trim()
  if (!v) return null
  if (tipo === 'correo' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Tiene que ser un correo, como secretaria@ejemplo.es.'
  if (tipo === 'enlace' && !/^https:\/\/\S+$/.test(v)) return 'Tiene que empezar por https://'
  return null
}

/**
 * Sistema › Datos de la corporación › Contacto: cómo se la contacta.
 * Secretaría, la sede, las redes y el correo de los derechos viven en la base y
 * no en el fichero de la instalación, que solo los siembra la primera vez,
 * porque cambian (un horario nuevo, otra red) y Secretaría no debe depender de
 * un despliegue para ello. Al guardar, el pie y los textos legales los enseñan
 * ya, sin recargar.
 */
export default function Contacto({ bloques, enAsistente = false, marco, alGuardar }: {
  /** Los títulos de los bloques que se enseñan; sin él, todos. */
  bloques?: string[]
  /** Sin el marco de ficha (título y resumen a la izquierda): el asistente pone el suyo. */
  enAsistente?: boolean
  /** Quien pone los botones (el asistente): recibe el formulario y lo que hace falta para guardar. */
  marco?: (contenido: ReactNode, acciones: AccionesDelFormulario) => ReactNode
  alGuardar?: () => void
} = {}) {
  const cliente = useQueryClient()
  const { data, isPending, isError } = useQuery({ queryKey: CLAVE_CMS, queryFn: datosDeContactoDelCms })
  const [formulario, setFormulario] = useState<Formulario>({})

  const guardar = useMutation({
    mutationFn: () => guardarDatosDeContacto(aDatos(formulario)),
    onSuccess: (guardado) => {
      cliente.setQueryData(CLAVE_CMS, guardado)
      ponerDatosDeContacto(cliente, guardado)
      alGuardar?.()
    },
  })

  const [copiado, setCopiado] = useState<typeof data>(undefined)
  // Antes de los `return`, porque los avisos son hooks. Mientras lo del
  // servidor aún no ha pasado al formulario, no hay nada sin guardar.
  const sinGuardar = Boolean(data && data === copiado) && CAMPOS.some(({ ruta }) => formulario[ruta].trim() !== aFormulario(data!)[ruta])
  // Son veinte campos: al ir a otra pantalla del CMS o cerrar la pestaña se
  // perdían sin preguntar, como no pasa en las demás fichas.
  // También al pasar a la otra pestaña, que cambia `?ver=`.
  const bloqueo = useBlocker(({ currentLocation, nextLocation }) =>
    sinGuardar && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search))
  useAvisoAlCerrarLaPestana(sinGuardar)

  // Lo del servidor pasa al formulario al pintar, no en un efecto: así no se
  // ve un instante con los campos vacíos (como en Ajustes del Inicio).
  if (data && data !== copiado) {
    setCopiado(data)
    setFormulario(aFormulario(data))
    // React repinta enseguida con el formulario ya lleno: este pase lo leería vacío.
    return null
  }

  if (isPending) return <CircularProgress aria-label="Cargando los datos de la corporación" />
  if (isError) return <Alert severity="error">No se han podido cargar los datos de la corporación. Inténtalo de nuevo en unos minutos.</Alert>

  const errores = Object.fromEntries(CAMPOS.map((c) => [c.ruta, errorDe(c.tipo, formulario[c.ruta])]))
  const hayErrores = Object.values(errores).some(Boolean)
  const delServidor = guardar.error instanceof ErrorDeApi ? guardar.error.fields : {}

  const cambiar = (ruta: string, valor: string) => {
    setFormulario((f) => ({ ...f, [ruta]: valor }))
    guardar.reset()
  }

  const contenido = (
    <Stack spacing={3}>
      {BLOQUES.filter((b) => !bloques || bloques.includes(b.titulo)).map((bloque) => {
        const campos = (
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, alignContent: 'start' }}>
            {bloque.campos.map((campo) => {
              const error = errores[campo.ruta] ?? delServidor[campo.ruta] ?? null
              return (
                <TextField
                  key={campo.ruta}
                  size="small"
                  label={campo.etiqueta}
                  value={formulario[campo.ruta]}
                  onChange={(e) => cambiar(campo.ruta, e.target.value)}
                  placeholder={campo.ejemplo}
                  type={campo.tipo === 'correo' ? 'email' : campo.tipo === 'enlace' ? 'url' : 'text'}
                  error={Boolean(error)}
                  helperText={error ?? campo.ayuda}
                  slotProps={{ htmlInput: { maxLength: campo.max } }}
                />
              )
            })}
          </Box>
        )
        return enAsistente ? (
          <Stack key={bloque.titulo} component="section" aria-label={bloque.titulo} spacing={1.5}>
            <Typography variant="h3" component="h2" sx={{ fontSize: 18 }}>{bloque.titulo}</Typography>
            {campos}
          </Stack>
        ) : (
          <Paper key={bloque.titulo} variant="outlined" component="section" aria-label={bloque.titulo}
            sx={{ p: { xs: 2, md: 3 }, display: 'grid', gap: { xs: 2, md: 4 }, gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 260px) minmax(0, 1fr)' } }}>
            <Stack spacing={0.75}>
              <Typography variant="h3" component="h2" sx={{ fontSize: 22 }}>{bloque.titulo}</Typography>
              <Typography variant="body2" color="text.secondary">{bloque.resumen}</Typography>
            </Stack>
            {campos}
          </Paper>
        )
      })}
      {guardar.isError && <Alert severity="error">{guardar.error.message}</Alert>}
    </Stack>
  )
  const acciones: AccionesDelFormulario = { sinGuardar, hayErrores, guardando: guardar.isPending, guardar: () => guardar.mutate() }

  return (
    <>
      {marco ? marco(contenido, acciones) : (
        <Box component="form" noValidate onSubmit={(e) => { e.preventDefault(); guardar.mutate() }}>
          <Stack spacing={3}>
            {contenido}
            {guardar.isSuccess && !sinGuardar && <Alert severity="success">Guardado: la web ya enseña los datos nuevos.</Alert>}
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
              {hayErrores && <Typography variant="body2" color="text.secondary">Corrige los campos marcados para guardar.</Typography>}
              <Button type="submit" variant="contained" disabled={!sinGuardar || hayErrores || guardar.isPending}>
                {guardar.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}
      <AvisoCambiosSinGuardar bloqueo={bloqueo} deQue="los datos de la corporación" />
    </>
  )
}
