import { useEffect, useId, useState } from 'react'
import { Alert, Box, CircularProgress, Divider, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { Helmet } from 'react-helmet-async'
import { useQueryClient } from '@tanstack/react-query'
import PantallaEdicion from './PantallaEdicion'
import CampoImagen from './CampoImagen'
import SeccionPlegable from './contenido/SeccionPlegable'
import CampoTexto from './contenido/CampoTexto'
import { getPortada, guardarImagenesPortada, type ImagenPortada, type TextosPortada } from '../../lib/api/portada'
import { guardarContenido } from '../../lib/api/contenido'

/** Tope del servidor (portada.schema.ts): se avisa antes de enviar. */
export const MAX_FOTOS_PORTADA = 12
const AYUDA_FOTO = 'JPG, PNG o WebP apaisado, de al menos 1920 píxeles de ancho y hasta 5 MB.'
const AYUDA_FOTO_SABADO = `${AYUDA_FOTO} Ocupa el fondo del bloque a todo lo ancho. `
  + 'Al cambiarla y guardar, la anterior se borra del servidor salvo que la use algo más.'

/**
 * La misma clave con la que la portada pública guarda su caché
 * (features/home/useContenidoPortada.ts). Si las dos dejan de coincidir,
 * guardar aquí deja de refrescar el inicio y nadie se entera hasta que se
 * queja quien lo lee; hay un test que las compara.
 */
const CLAVE_PORTADA_PUBLICA = ['home', 'portada']

/** Una fila del formulario: la clave la da el propio CMS, para que React siga la fila al reordenar. */
interface Fila extends ImagenPortada {
  clave: number
}

type Tesela = TextosPortada['accesos']['teselas'][number]

let ultimaClave = 0
const conClave = (imagen: ImagenPortada): Fila => ({ ...imagen, clave: ++ultimaClave })
const sinClave = (filas: Fila[]): ImagenPortada[] => filas.map(({ url, descripcion }) => ({ url, descripcion }))

/**
 * Un acceso del mosaico, bajo su nombre actual: es lo único que lo distingue en
 * esta pantalla, porque el destino y el icono los pone el código
 * (features/home/QuickAccess.tsx) y no se editan desde aquí.
 */
function EdicionTesela({ tesela, onCambio }: { tesela: Tesela; onCambio: (cambios: Partial<Tesela>) => void }) {
  const id = useId()
  const nombre = tesela.titulo.trim() || 'Acceso sin nombre'

  return (
    <Paper variant="outlined" role="group" aria-labelledby={id} sx={{ p: 2 }}>
      <Typography id={id} variant="subtitle2" sx={{ mb: 1.5 }}>{nombre}</Typography>
      <Stack spacing={2}>
        <CampoTexto
          etiqueta="Título"
          valor={tesela.titulo}
          onCambio={(titulo) => onCambio({ titulo })}
          maxLength={120}
          ayuda="El nombre del acceso, en grande dentro de la tesela."
        />
        <CampoTexto
          etiqueta="Descripción"
          valor={tesela.descripcion}
          onCambio={(descripcion) => onCambio({ descripcion })}
          maxLength={600}
          ayuda="La línea pequeña bajo el nombre."
        />
      </Stack>
    </Paper>
  )
}

/** La portada entera: los textos de sus seis bloques y las fotos que rotan en la cabecera. */
export default function PortadaAdminPage() {
  const queryClient = useQueryClient()
  const idMosaico = useId()
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [inicialFotos, setInicialFotos] = useState<ImagenPortada[]>([])
  const [textos, setTextos] = useState<TextosPortada | null>(null)
  const [inicialTextos, setInicialTextos] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    getPortada()
      .then(({ imagenes, textos: cargados }) => {
        setFilas(imagenes.map(conClave))
        setInicialFotos(imagenes.map(({ url, descripcion }) => ({ url, descripcion })))
        setTextos(cargados)
        setInicialTextos(JSON.stringify(cargados))
      })
      .catch(() => setError('No se ha podido cargar la portada.'))
  }, [])

  const cambiar = (clave: number, cambios: Partial<ImagenPortada>) =>
    setFilas((actual) => actual?.map((fila) => (fila.clave === clave ? { ...fila, ...cambios } : fila)) ?? actual)

  const quitar = (clave: number) => setFilas((actual) => actual?.filter((fila) => fila.clave !== clave) ?? actual)

  const mover = (indice: number, salto: -1 | 1) =>
    setFilas((actual) => {
      if (!actual) return actual
      const destino = indice + salto
      if (destino < 0 || destino >= actual.length) return actual
      const copia = [...actual]
      copia[indice] = actual[destino]
      copia[destino] = actual[indice]
      return copia
    })

  const anadir = (url: string) => {
    if (!url) return
    setGuardado(false)
    setFilas((actual) => [...(actual ?? []), conClave({ url, descripcion: '' })])
  }

  // Un cambiador por bloque en vez de uno genérico: con una clave genérica, el
  // objeto que sale del spread deja de ser `TextosPortada` para TypeScript y
  // haría falta un cast, que es justo lo que evitaría equivocarse de campo.
  const cambiarHero = (cambios: Partial<TextosPortada['hero']>) =>
    setTextos((t) => t && { ...t, hero: { ...t.hero, ...cambios } })
  const cambiarActualidad = (cambios: Partial<TextosPortada['actualidad']>) =>
    setTextos((t) => t && { ...t, actualidad: { ...t.actualidad, ...cambios } })
  const cambiarAgenda = (cambios: Partial<TextosPortada['agenda']>) =>
    setTextos((t) => t && { ...t, agenda: { ...t.agenda, ...cambios } })
  const cambiarPlaca = (cambios: Partial<TextosPortada['accesos']['placa']>) =>
    setTextos((t) => t && { ...t, accesos: { ...t.accesos, placa: { ...t.accesos.placa, ...cambios } } })
  const cambiarTesela = (indice: number, cambios: Partial<Tesela>) =>
    setTextos((t) => t && {
      ...t,
      accesos: { ...t.accesos, teselas: t.accesos.teselas.map((tesela, i) => (i === indice ? { ...tesela, ...cambios } : tesela)) },
    })
  const cambiarSabado = (cambios: Partial<TextosPortada['sabadoDePasion']>) =>
    setTextos((t) => t && { ...t, sabadoDePasion: { ...t.sabadoDePasion, ...cambios } })
  const cambiarPublicaciones = (cambios: Partial<TextosPortada['publicaciones']>) =>
    setTextos((t) => t && { ...t, publicaciones: { ...t.publicaciones, ...cambios } })

  const fotosSucias = !!filas && JSON.stringify(sinClave(filas)) !== JSON.stringify(inicialFotos)
  const textosSucios = !!textos && JSON.stringify(textos) !== inicialTextos
  const sucio = fotosSucias || textosSucios

  const guardar = async () => {
    if (!filas || !textos) return
    setGuardando(true)
    setGuardado(false)
    setError(null)
    // Lo que de verdad ha llegado al servidor, no lo que se pretendía guardar:
    // el mensaje del final se escribe con esto y no con las banderas de sucio.
    let fotosGuardadas = false
    let textosGuardados = false
    try {
      // Primero las fotos: si fallan, no se ha tocado nada.
      if (fotosSucias) {
        await guardarImagenesPortada(sinClave(filas))
        setInicialFotos(sinClave(filas))
        fotosGuardadas = true
      }
      if (textosSucios) {
        await guardarContenido('portada', textos)
        setInicialTextos(JSON.stringify(textos))
        textosGuardados = true
      }
      // Solo se marca éxito si algo llegó de verdad al servidor: pulsar Guardar
      // sin haber cambiado nada no manda ninguna petición, y decir «guardado»
      // sería la misma mentira pequeña que este botón tiene prohibida.
      setGuardado(fotosGuardadas || textosGuardados)
    } catch (e: unknown) {
      // Son dos almacenes y dos peticiones. Si el fallo llega en la segunda, las
      // fotos YA están guardadas: decirlo, o quien lo lea creerá que no se ha
      // guardado nada y lo repetirá todo.
      const motivo = e instanceof Error ? e.message : 'No se ha podido guardar.'
      // Y decir además POR QUÉ. El aviso terminaba en «vuelve a intentarlo», que
      // con el fallo más probable —un 400 porque uno de los treinta campos lleva
      // un `<`, que el esquema prohíbe— no puede funcionar por muchas veces que
      // se reintente. `lib/api/client.ts` ya trae ahí el campo y el motivo.
      setError(fotosGuardadas ? `Las fotos se han guardado, pero los textos no. ${motivo}` : motivo)
    } finally {
      setGuardando(false)
      // La portada pública comparte caché con el CMS en la misma pestaña: que la
      // siguiente visita al inicio pida lo nuevo en vez de lo guardado. También
      // tras un guardado a medias, porque las fotos sí han cambiado.
      if (fotosGuardadas || textosGuardados) void queryClient.invalidateQueries({ queryKey: CLAVE_PORTADA_PUBLICA })
    }
  }

  if (error && (!filas || !textos)) return <Alert severity="error">{error}</Alert>
  if (!filas || !textos) return <CircularProgress aria-label="Cargando la portada" />

  return (
    <>
      <Helmet><title>Portada | CMS Desamparados</title><meta name="robots" content="noindex" /></Helmet>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {guardado && !sucio && <Alert severity="success" sx={{ mb: 3 }}>Cambios guardados. La portada ya los enseña.</Alert>}
      <PantallaEdicion
        titulo="Portada"
        nombre="Los textos y las fotos de la página de inicio"
        sucio={sucio}
        guardando={guardando}
        volverA="/cms"
        onGuardar={guardar}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Cada apartado es un bloque de la página de inicio, en el mismo orden en que se ven al bajar por ella.
          Ábrelo para cambiar sus textos. Lo que no sale aquí (los destinos de los enlaces, los iconos y el orden
          de los bloques) es parte del diseño y no se toca desde el CMS.
        </Typography>

        <SeccionPlegable titulo="Cabecera" abiertaPorDefecto>
          <CampoTexto
            etiqueta="Antetítulo"
            valor={textos.hero.ceja}
            onCambio={(ceja) => cambiarHero({ ceja })}
            maxLength={60}
            ayuda="El texto pequeño en versalitas, sobre el título grande."
          />
          <CampoTexto
            etiqueta="Título"
            valor={textos.hero.titulo}
            onCambio={(titulo) => cambiarHero({ titulo })}
            maxLength={120}
            ayuda="El titular grande de la primera pantalla."
          />
          <CampoTexto
            etiqueta="Texto"
            valor={textos.hero.parrafo}
            onCambio={(parrafo) => cambiarHero({ parrafo })}
            maxLength={600}
            multilinea
            ayuda="El párrafo bajo el título."
          />
          <CampoTexto
            etiqueta="Botón principal"
            valor={textos.hero.botonPrincipal}
            onCambio={(botonPrincipal) => cambiarHero({ botonPrincipal })}
            maxLength={60}
            ayuda="El botón claro. Sigue llevando a la página del Grupo Parroquial."
          />
          <CampoTexto
            etiqueta="Enlace secundario"
            valor={textos.hero.enlaceSecundario}
            onCambio={(enlaceSecundario) => cambiarHero({ enlaceSecundario })}
            maxLength={60}
            ayuda="El enlace de al lado. Sigue llevando a la agenda."
          />

          <Divider sx={{ pt: 1 }} />

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Fotos de la cabecera</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Se enseñan en este orden, con un fundido de una a otra cada pocos segundos. Sin ninguna, la portada
              usa la foto de siempre. Las fotos que quites o cambies se borran del servidor al guardar, salvo que
              las use también una noticia o una publicación.
            </Typography>

            <Stack component="ol" spacing={2} sx={{ listStyle: 'none', p: 0, m: 0 }}>
              {filas.map((fila, indice) => (
                <Paper key={fila.clave} component="li" variant="outlined" sx={{ p: 2 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'flex-start' } }}>
                    <Box sx={{ flex: 1 }}>
                      <CampoImagen
                        etiqueta={`Foto ${indice + 1}`}
                        ayuda={AYUDA_FOTO}
                        apaisada
                        valor={fila.url}
                        onCambio={(url) => (url ? cambiar(fila.clave, { url }) : quitar(fila.clave))}
                      />
                      <TextField
                        label="Qué se ve en la imagen"
                        value={fila.descripcion}
                        onChange={(e) => cambiar(fila.clave, { descripcion: e.target.value })}
                        helperText="En una frase. Es lo que oye quien usa un lector de pantalla."
                        slotProps={{ htmlInput: { maxLength: 200 } }}
                        size="small"
                        fullWidth
                        sx={{ mt: 2 }}
                      />
                    </Box>
                    <Stack direction={{ xs: 'row', md: 'column' }} spacing={0.5}>
                      <Tooltip title="Subir">
                        <span>
                          <IconButton aria-label={`Subir la foto ${indice + 1}`} disabled={indice === 0} onClick={() => mover(indice, -1)}>
                            <ArrowUpwardIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Bajar">
                        <span>
                          <IconButton aria-label={`Bajar la foto ${indice + 1}`} disabled={indice === filas.length - 1} onClick={() => mover(indice, 1)}>
                            <ArrowDownwardIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>

            <Box sx={{ mt: filas.length ? 3 : 0 }}>
              {filas.length < MAX_FOTOS_PORTADA ? (
                <CampoImagen etiqueta="Añadir una foto" ayuda={AYUDA_FOTO} apaisada valor="" onCambio={anadir} />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Ya hay {MAX_FOTOS_PORTADA} fotos, el máximo. Quita alguna para añadir otra.
                </Typography>
              )}
            </Box>
          </Box>
        </SeccionPlegable>

        <SeccionPlegable titulo="Actualidad">
          <CampoTexto
            etiqueta="Antetítulo"
            valor={textos.actualidad.ceja}
            onCambio={(ceja) => cambiarActualidad({ ceja })}
            maxLength={60}
            ayuda="El texto pequeño en versalitas, sobre el título del bloque de noticias."
          />
          <CampoTexto
            etiqueta="Título"
            valor={textos.actualidad.titulo}
            onCambio={(titulo) => cambiarActualidad({ titulo })}
            maxLength={120}
            ayuda="El titular del bloque de noticias."
          />
          <CampoTexto
            etiqueta="Enlace"
            valor={textos.actualidad.enlace}
            onCambio={(enlace) => cambiarActualidad({ enlace })}
            maxLength={60}
            ayuda="El enlace del final del bloque. Sigue llevando al listado de noticias."
          />
        </SeccionPlegable>

        <SeccionPlegable titulo="Agenda y Cultos">
          <CampoTexto
            etiqueta="Antetítulo"
            valor={textos.agenda.ceja}
            onCambio={(ceja) => cambiarAgenda({ ceja })}
            maxLength={60}
            ayuda="El texto pequeño en versalitas, sobre el título del bloque."
          />
          <CampoTexto
            etiqueta="Título"
            valor={textos.agenda.titulo}
            onCambio={(titulo) => cambiarAgenda({ titulo })}
            maxLength={120}
            ayuda="El titular del bloque de cultos."
          />
          <CampoTexto
            etiqueta="Texto"
            valor={textos.agenda.parrafo}
            onCambio={(parrafo) => cambiarAgenda({ parrafo })}
            maxLength={600}
            multilinea
            ayuda="El párrafo bajo el título del bloque."
          />
          <CampoTexto
            etiqueta="Enlace"
            valor={textos.agenda.enlace}
            onCambio={(enlace) => cambiarAgenda({ enlace })}
            maxLength={60}
            ayuda="El enlace del final del bloque. Sigue llevando al calendario."
          />
          <CampoTexto
            etiqueta="Título del directo"
            valor={textos.agenda.directoTitulo}
            onCambio={(directoTitulo) => cambiarAgenda({ directoTitulo })}
            maxLength={60}
            ayuda="El aviso de la retransmisión, que solo sale cuando hay una en marcha."
          />
          <CampoTexto
            etiqueta="Texto del directo"
            valor={textos.agenda.directoTexto}
            onCambio={(directoTexto) => cambiarAgenda({ directoTexto })}
            maxLength={60}
            ayuda="La línea pequeña bajo ese aviso."
          />
        </SeccionPlegable>

        <SeccionPlegable titulo="Accesos directos">
          <CampoTexto
            etiqueta="Antetítulo de la placa"
            valor={textos.accesos.placa.ceja}
            onCambio={(ceja) => cambiarPlaca({ ceja })}
            maxLength={60}
            ayuda="El texto pequeño en versalitas de la placa granate, la grande del mosaico."
          />
          <CampoTexto
            etiqueta="Título de la placa"
            valor={textos.accesos.placa.titulo}
            onCambio={(titulo) => cambiarPlaca({ titulo })}
            maxLength={120}
            ayuda="El titular de la placa granate."
          />
          <CampoTexto
            etiqueta="Texto de la placa"
            valor={textos.accesos.placa.texto}
            onCambio={(texto) => cambiarPlaca({ texto })}
            maxLength={600}
            multilinea
            ayuda="El párrafo de la placa granate."
          />
          <CampoTexto
            etiqueta="Botón de la placa"
            valor={textos.accesos.placa.boton}
            onCambio={(boton) => cambiarPlaca({ boton })}
            maxLength={60}
            ayuda="El botón del final de la placa. Sigue llevando al formulario de hacerse hermano."
          />

          <Divider sx={{ pt: 1 }} />

          <Box>
            <Typography id={idMosaico} variant="subtitle2" sx={{ mb: 1 }}>Textos de los accesos</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Aquí se cambian el nombre y la línea de debajo de cada acceso. Cuáles salen en la portada, en qué
              orden y a dónde llevan lo decide el código, no esta lista: no se puede añadir, quitar ni reordenar
              ninguno.
            </Typography>
            <Stack role="group" aria-labelledby={idMosaico} spacing={2}>
              {textos.accesos.teselas.map((tesela, indice) => (
                <EdicionTesela key={tesela.clave} tesela={tesela} onCambio={(cambios) => cambiarTesela(indice, cambios)} />
              ))}
            </Stack>
          </Box>
        </SeccionPlegable>

        <SeccionPlegable titulo="Sábado de Pasión">
          <CampoTexto
            etiqueta="Antetítulo"
            valor={textos.sabadoDePasion.ceja}
            onCambio={(ceja) => cambiarSabado({ ceja })}
            maxLength={60}
            ayuda="El texto pequeño en versalitas, sobre el título del bloque."
          />
          <CampoTexto
            etiqueta="Título"
            valor={textos.sabadoDePasion.titulo}
            onCambio={(titulo) => cambiarSabado({ titulo })}
            maxLength={120}
            multilinea
            ayuda="El titular del bloque, sobre la foto. El salto de línea es parte del diseño: lo que escribas después baja a la segunda línea."
          />
          <CampoTexto
            etiqueta="Texto"
            valor={textos.sabadoDePasion.parrafo}
            onCambio={(parrafo) => cambiarSabado({ parrafo })}
            maxLength={600}
            multilinea
            ayuda="El párrafo bajo el título del bloque."
          />
          <CampoTexto
            etiqueta="Enlace"
            valor={textos.sabadoDePasion.enlace}
            onCambio={(enlace) => cambiarSabado({ enlace })}
            maxLength={60}
            ayuda="El enlace del final del bloque. Sigue llevando a la página del Sábado de Pasión."
          />
          {/*
            Sin botón de quitar: el bloque es una banda de foto a sangre y no
            existe el estado «sin foto». El backend tampoco lo admite
            (`rutaImagenPublica` en contenido.schema.ts rechaza la cadena vacía),
            así que quitarla dejaría todo el documento sin poder guardarse.
          */}
          <CampoImagen
            etiqueta="Foto del bloque"
            ayuda={AYUDA_FOTO_SABADO}
            apaisada
            sinQuitar
            valor={textos.sabadoDePasion.imagenUrl}
            onCambio={(imagenUrl) => cambiarSabado({ imagenUrl })}
          />
          <CampoTexto
            etiqueta="Qué se ve en la imagen"
            valor={textos.sabadoDePasion.imagenAlt}
            onCambio={(imagenAlt) => cambiarSabado({ imagenAlt })}
            maxLength={200}
            ayuda="En una frase. No se lee en pantalla: es lo que oye quien usa un lector de pantalla."
          />
        </SeccionPlegable>

        <SeccionPlegable titulo="Publicaciones">
          <CampoTexto
            etiqueta="Botón"
            valor={textos.publicaciones.boton}
            onCambio={(boton) => cambiarPublicaciones({ boton })}
            maxLength={60}
            ayuda="El botón del final del bloque. Sigue llevando al archivo de publicaciones."
          />
          <CampoTexto
            etiqueta="Marca de agua"
            valor={textos.publicaciones.marcaDeAgua}
            onCambio={(marcaDeAgua) => cambiarPublicaciones({ marcaDeAgua })}
            maxLength={60}
            ayuda="La palabra grande y tenue del fondo del bloque."
          />
        </SeccionPlegable>
      </PantallaEdicion>
    </>
  )
}
