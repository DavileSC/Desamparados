import { useEffect, useState } from 'react'
import { Alert, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { Helmet } from 'react-helmet-async'
import { useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import topes from '../../../../shared/topes-contenido.json'
import PantallaEdicion from './PantallaEdicion'
import CampoImagen from './CampoImagen'
import CampoTexto from './contenido/CampoTexto'
import SeccionPlegable from './contenido/SeccionPlegable'
import EditorDeBloques from './bloques/EditorDeBloques'
import { conClave, sinClave, type Fila } from './bloques/filas'
import { problemaDeBloque, NOMBRE_BLOQUE } from './bloques/formularios'
import { paginaPublica } from '../../app/cmsNavegacion'
import { ApiError } from '../../lib/api/client'
import {
  getContenido, guardarContenido,
  type CabeceraPagina, type PaginaDeBloques, type SlugContenido,
} from '../../lib/api/contenido'

export const AVISO_SIN_TITULO = 'La página se ha quedado sin título. Ponle uno antes de guardar.'

/**
 * Dónde sale la foto de la cabecera, cuando no es donde sale en las demás.
 * Historia tiene maquetación propia y su foto no va en la cabecera sino, muy
 * velada, detrás de la página entera.
 */
const AYUDA_FOTO_CABECERA: Record<string, string> = {
  historia: 'JPG, PNG o WebP grande y apaisado, de hasta 5 MB. Se ve muy velada detrás de toda la página de Historia. Sin foto, el fondo queda liso.',
}

/**
 * Traduce `ApiError.fields` («bloques.2»: motivo) a algo que diga de qué
 * bloque habla, con su posición y su tipo, igual que la comprobación del
 * cliente: es la red de seguridad para lo que el cliente no haya previsto, y
 * el mensaje tiene que ser tan localizable como el suyo.
 */
function mensajeDelServidor(fields: Record<string, string>, filas: Fila[]): string {
  const detalle = Object.entries(fields)
    .map(([campo, texto]) => {
      const bloque = /^bloques\.(\d+)/.exec(campo)
      if (!bloque) return `${campo}: ${texto}`
      const indice = Number(bloque[1])
      const nombre = filas[indice] ? (NOMBRE_BLOQUE[filas[indice].bloque.tipo] ?? filas[indice].bloque.tipo) : null
      return `El bloque ${indice + 1}${nombre ? ` (${nombre})` : ''}: ${texto}`
    })
    .join(' ')
  return `El servidor ha rechazado la página. ${detalle}`
}

/** Las claves de las filas que nombra `ApiError.fields`, para desplegarlas. */
function clavesDelServidor(fields: Record<string, string>, filas: Fila[]): Set<number> {
  const claves = new Set<number>()
  for (const campo of Object.keys(fields)) {
    const indice = /^bloques\.(\d+)/.exec(campo)?.[1]
    if (indice !== undefined && filas[Number(indice)]) claves.add(filas[Number(indice)].clave)
  }
  return claves
}

export default function PaginaAdminPage() {
  const { slug = '' } = useParams()
  // La ficha del catálogo (`shared/paginas-publicas.json`): de ahí salen el
  // nombre que se enseña y la ruta pública a la que lleva la vista previa.
  const ficha = paginaPublica(slug)
  const queryClient = useQueryClient()
  const [cabecera, setCabecera] = useState<CabeceraPagina | null>(null)
  const [filas, setFilas] = useState<Fila[]>([])
  const [inicial, setInicial] = useState<PaginaDeBloques | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  // Los bloques que han fallado la última comprobación, para desplegarlos:
  // pueden estar plegados y fuera de la vista, y sin esto el aviso no dice a
  // quién agarrarse.
  const [clavesInvalidas, setClavesInvalidas] = useState<Set<number>>(new Set())

  useEffect(() => {
    getContenido<PaginaDeBloques>(slug as SlugContenido)
      .then(({ cabecera: c, bloques }) => {
        setCabecera(c)
        setFilas(bloques.map(conClave))
        setInicial({ cabecera: c, bloques })
      })
      .catch(() => setError('No se ha podido cargar la página.'))
  }, [slug])

  const guardar = async () => {
    if (!cabecera) return
    // El servidor también lo rechaza (cabeceraSchema, bloques.schema.ts): se
    // comprueba aquí antes para no gastar una petición y dar un aviso claro.
    if (cabecera.titulo.trim() === '') { setError(AVISO_SIN_TITULO); return }

    // Un bloque recién añadido nace en blanco (BLOQUE_NUEVO) y se queda
    // plegado por defecto: sin esta comprobación, guardar mandaba un 400 del
    // servidor sin decir cuál era el bloque culpable, que ni siquiera estaba
    // a la vista.
    const invalida = filas
      .map((fila, indice) => ({ fila, indice, motivo: problemaDeBloque(fila.bloque) }))
      .find((f) => f.motivo !== null)
    if (invalida) {
      setClavesInvalidas(new Set([invalida.fila.clave]))
      const nombre = NOMBRE_BLOQUE[invalida.fila.bloque.tipo] ?? invalida.fila.bloque.tipo
      setError(`El bloque ${invalida.indice + 1} (${nombre}) ${invalida.motivo}.`)
      return
    }

    const datos: PaginaDeBloques = { cabecera, bloques: sinClave(filas) }
    if (JSON.stringify(datos) === JSON.stringify(inicial)) return
    setGuardando(true); setError(null); setClavesInvalidas(new Set())
    try {
      await guardarContenido(slug as SlugContenido, datos)
      setInicial(datos)
      void queryClient.invalidateQueries({ queryKey: ['contenido', slug] })
    } catch (e: unknown) {
      if (e instanceof ApiError && Object.keys(e.fields).length > 0) {
        // Red de seguridad: algo que el cliente no comprobó, pero el servidor
        // sí. `ApiError.fields` (client.ts) trae el campo y el motivo
        // concretos; con eso se puede decir de qué bloque habla en vez del
        // genérico «Error de validación».
        setError(mensajeDelServidor(e.fields, filas))
        setClavesInvalidas(clavesDelServidor(e.fields, filas))
      } else {
        setError(e instanceof Error ? e.message : 'No se ha podido guardar la página.')
      }
    } finally { setGuardando(false) }
  }

  if (error && !cabecera) return <Alert severity="error">{error}</Alert>
  if (!cabecera) return <CircularProgress aria-label="Cargando la página" />

  const documento: PaginaDeBloques = { cabecera, bloques: sinClave(filas) }

  return (
    <>
      <Helmet><title>{cabecera.titulo} | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      <PantallaEdicion
        titulo={cabecera.titulo || 'Página'}
        nombre={ficha ? `Página «${ficha.nombre}»` : 'Página de la web pública'}
        sucio={JSON.stringify(documento) !== JSON.stringify(inicial)}
        guardando={guardando}
        volverA="/cms/paginas"
        onGuardar={guardar}
      >
        <Stack spacing={3}>
          <Button component="a" href={ficha?.ruta ?? '/'} target="_blank" rel="noopener noreferrer"
            startIcon={<OpenInNewIcon />} sx={{ alignSelf: 'flex-start' }}>
            Vista previa
          </Button>

          {/* La cabecera va aparte y sin botón de quitar: está siempre. */}
          <Paper sx={{ p: 2.5 }}>
            <SeccionPlegable titulo="Cabecera de la página" abiertaPorDefecto>
              {/* Solo la trae Historia: las demás cabeceras no pintan ceja. */}
              {cabecera.ceja !== undefined && (
                <CampoTexto etiqueta="Antetítulo" valor={cabecera.ceja}
                  onCambio={(ceja) => setCabecera({ ...cabecera, ceja })}
                  ayuda="Línea pequeña en mayúsculas, encima del título grande." maxLength={topes.etiqueta} />
              )}
              <CampoTexto etiqueta="Título" valor={cabecera.titulo}
                onCambio={(titulo) => setCabecera({ ...cabecera, titulo })}
                ayuda="Encabezado grande de la página, arriba del todo." maxLength={topes.titulo} />
              <CampoTexto etiqueta="Subtítulo" valor={cabecera.subtitulo}
                onCambio={(subtitulo) => setCabecera({ ...cabecera, subtitulo })}
                ayuda="Frase bajo el título." maxLength={topes.descripcion} />
              <CampoImagen valor={cabecera.foto} onCambio={(foto) => setCabecera({ ...cabecera, foto })}
                etiqueta="Foto de la cabecera"
                ayuda={AYUDA_FOTO_CABECERA[slug] ?? 'Opcional. Sin foto, la cabecera queda lisa.'} apaisada />
              <CampoTexto etiqueta="Descripción de la foto" valor={cabecera.fotoAlt}
                onCambio={(fotoAlt) => setCabecera({ ...cabecera, fotoAlt })}
                ayuda="Lo que se ve en la foto. Déjala vacía si no hay foto." maxLength={topes.descripcion} />
              {slug === 'historia' && (
                <Typography variant="body2" color="text.secondary">
                  En Historia, los bloques de cronología van en una franja oscura y el primero forma el
                  índice de la cabecera, y un bloque de llamada es el cierre: su texto es la línea pequeña,
                  su título la frase grande y su botón el enlace con flecha.
                </Typography>
              )}
            </SeccionPlegable>
          </Paper>

          <EditorDeBloques filas={filas} onCambio={setFilas} clavesInvalidas={clavesInvalidas} />
        </Stack>
      </PantallaEdicion>
    </>
  )
}
