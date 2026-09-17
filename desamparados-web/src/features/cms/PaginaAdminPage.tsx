import { useEffect, useState } from 'react'
import { Alert, Button, CircularProgress, Paper, Stack } from '@mui/material'
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
import { RUTA_PUBLICA } from '../../app/cmsNavegacion'
import {
  getContenido, guardarContenido,
  type CabeceraPagina, type PaginaDeBloques, type SlugContenido,
} from '../../lib/api/contenido'

export const AVISO_SIN_TITULO = 'La página se ha quedado sin título. Ponle uno antes de guardar.'

export default function PaginaAdminPage() {
  const { slug = '' } = useParams()
  const queryClient = useQueryClient()
  const [cabecera, setCabecera] = useState<CabeceraPagina | null>(null)
  const [filas, setFilas] = useState<Fila[]>([])
  const [inicial, setInicial] = useState<PaginaDeBloques | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

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
    // El servidor también lo rechaza; mejor no mandarlo y decirlo aquí arriba.
    if (cabecera.titulo.trim() === '') { setError(AVISO_SIN_TITULO); return }

    const datos: PaginaDeBloques = { cabecera, bloques: sinClave(filas) }
    if (JSON.stringify(datos) === JSON.stringify(inicial)) return
    setGuardando(true); setError(null)
    try {
      await guardarContenido(slug as SlugContenido, datos)
      setInicial(datos)
      void queryClient.invalidateQueries({ queryKey: ['contenido', slug] })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar la página.')
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
        nombre="Página de la web pública"
        sucio={JSON.stringify(documento) !== JSON.stringify(inicial)}
        guardando={guardando}
        volverA="/cms"
        onGuardar={guardar}
      >
        <Stack spacing={3}>
          <Button component="a" href={RUTA_PUBLICA[slug] ?? '/'} target="_blank" rel="noopener noreferrer"
            startIcon={<OpenInNewIcon />} sx={{ alignSelf: 'flex-start' }}>
            Vista previa
          </Button>

          {/* La cabecera va aparte y sin botón de quitar: está siempre. */}
          <Paper sx={{ p: 2.5 }}>
            <SeccionPlegable titulo="Cabecera de la página" abiertaPorDefecto>
              <CampoTexto etiqueta="Título" valor={cabecera.titulo}
                onCambio={(titulo) => setCabecera({ ...cabecera, titulo })}
                ayuda="Encabezado grande de la página, arriba del todo." maxLength={topes.titulo} />
              <CampoTexto etiqueta="Subtítulo" valor={cabecera.subtitulo}
                onCambio={(subtitulo) => setCabecera({ ...cabecera, subtitulo })}
                ayuda="Frase bajo el título." maxLength={topes.descripcion} />
              <CampoImagen valor={cabecera.foto} onCambio={(foto) => setCabecera({ ...cabecera, foto })}
                etiqueta="Foto de la cabecera"
                ayuda="Opcional. Sin foto, la cabecera queda lisa." apaisada />
              <CampoTexto etiqueta="Descripción de la foto" valor={cabecera.fotoAlt}
                onCambio={(fotoAlt) => setCabecera({ ...cabecera, fotoAlt })}
                ayuda="Lo que se ve en la foto. Déjala vacía si no hay foto." maxLength={topes.descripcion} />
            </SeccionPlegable>
          </Paper>

          <EditorDeBloques filas={filas} onCambio={setFilas} />
        </Stack>
      </PantallaEdicion>
    </>
  )
}
