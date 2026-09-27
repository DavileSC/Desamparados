import { useId, type ReactNode } from 'react'
import { Alert, Box, CircularProgress, Divider, IconButton, Paper, Stack, TextField, Tooltip, Typography } from '@mui/material'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import { Helmet } from 'react-helmet-async'
import PantallaEdicion from './PantallaEdicion'
import CampoImagen from './CampoImagen'
import CampoVideo from './CampoVideo'
import SeccionPlegable from './contenido/SeccionPlegable'
import CampoTexto from './contenido/CampoTexto'
import VistaPreviaPortada from './contenido/VistaPreviaPortada'
import Hero from '../inicio/Hero'
import NoticiasDestacadas from '../inicio/NoticiasDestacadas'
import AgendaYDirecto from '../inicio/AgendaYDirecto'
import AccesosRapidos from '../inicio/AccesosRapidos'
import EscenaProcesion from '../inicio/EscenaProcesion'
import PublicacionesDestacadas from '../inicio/PublicacionesDestacadas'
import EdicionTesela from './portada/EdicionTesela'
import { MAX_FOTOS_PORTADA, useEdicionDePortada } from './portada/useEdicionDePortada'

export { MAX_FOTOS_PORTADA }

const AYUDA_FOTO = 'JPG, PNG o WebP apaisado, de al menos 1920 píxeles de ancho y hasta 5 MB.'
const AYUDA_FOTO_AGENDA = `${AYUDA_FOTO} Va detrás del calendario a todo lo ancho, desenfocada y oscurecida para que no le quite protagonismo. `
  + 'Sin foto, el bloque queda sobre fondo oscuro liso. Al cambiarla y guardar, la anterior se borra del servidor salvo que la use algo más.'
const AYUDA_FOTO_SABADO = `${AYUDA_FOTO} Ocupa el fondo del bloque a todo lo ancho. `
  + 'Al cambiarla y guardar, la anterior se borra del servidor salvo que la use algo más.'

export default function PortadaAdminPage() {
  const idMosaico = useId()
  const {
    filas, textos, error, guardado, guardando, sucio, borrador,
    cambiar, quitar, mover, anadir, descartar, guardar,
    cambiarHero, cambiarActualidad, cambiarAgenda, cambiarPlaca, cambiarTesela,
    cambiarSabado, cambiarPublicaciones,
  } = useEdicionDePortada()

  if (error && (!filas || !textos)) return <Alert severity="error">{error}</Alert>
  if (!filas || !textos || !borrador) return <CircularProgress aria-label="Cargando la portada" />

  // Lo que se está escribiendo, con la forma de lo que sirve la API: los bloques
  // de la vista previa lo leen como si fuera lo guardado.
  const vista = (bloque: ReactNode) => <VistaPreviaPortada portada={borrador}>{bloque}</VistaPreviaPortada>

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
        onDescartar={descartar}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Cada apartado es un bloque de la página de inicio, en el mismo orden en que se ven al bajar por ella.
          Ábrelo para cambiar sus textos. Lo que no sale aquí (los destinos de los enlaces, los iconos y el orden
          de los bloques) es parte del diseño y no se toca desde el CMS.
        </Typography>

        <SeccionPlegable titulo="Cabecera" abiertaPorDefecto vistaPrevia={vista(<Hero />)}>
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

          <Divider sx={{ pt: 1 }} />

          <CampoVideo
            etiqueta="Vídeo de fondo (opcional)"
            uso="hero"
            valor={textos.hero.video}
            onCambio={(video) => cambiarHero({ video })}
            ayuda={'Si lo pones, sustituye a las fotos: se repite en bucle y sin sonido, así que conviene uno tranquilo '
              + 'y sin cortes bruscos, de 8 a 30 segundos. La primera foto de arriba se ve mientras carga, y es lo único '
              + 'que ve quien tiene activado el ahorro de datos o el «reducir movimiento». Al quitarlo o cambiarlo y '
              + 'guardar, el anterior se borra del servidor.'}
          />
        </SeccionPlegable>

        <SeccionPlegable titulo="Actualidad" vistaPrevia={vista(<NoticiasDestacadas />)}>
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

        <SeccionPlegable titulo="Agenda y Cultos" vistaPrevia={vista(<AgendaYDirecto />)}>
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
          <CampoImagen
            etiqueta="Foto del fondo"
            ayuda={AYUDA_FOTO_AGENDA}
            apaisada
            valor={textos.agenda.imagenUrl}
            onCambio={(imagenUrl) => cambiarAgenda({ imagenUrl })}
          />
        </SeccionPlegable>

        <SeccionPlegable titulo="Accesos directos" vistaPrevia={vista(<AccesosRapidos />)}>
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

        <SeccionPlegable titulo="Sábado de Pasión" vistaPrevia={vista(<EscenaProcesion />)}>
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

        <SeccionPlegable titulo="Publicaciones" vistaPrevia={vista(<PublicacionesDestacadas />)}>
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
