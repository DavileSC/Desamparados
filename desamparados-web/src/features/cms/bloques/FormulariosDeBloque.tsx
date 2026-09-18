import { useState } from 'react'
import { Alert, Button, Chip, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined'
import MovieOutlinedIcon from '@mui/icons-material/MovieOutlined'
import topes from '../../../../../shared/topes-contenido.json'
import EditorTexto from '../EditorTexto'
import CampoImagen from '../CampoImagen'
import CampoTexto from '../contenido/CampoTexto'
import CamposDeMedio from '../contenido/CamposDeMedio'
import CampoEnlace from '../contenido/CampoEnlace'
import { FOTO_NUEVA, VIDEO_NUEVO } from '../contenido/medios'
import type {
  BloqueTexto, BloqueFoto, BloqueGaleria, BloqueTarjetas, BloqueLlamada, BloqueDatos,
  BloqueItinerario, BloqueCronologia, BloqueListado, BloqueContacto,
  FuenteListado, HitoHistoria, LineaDatos, MedioGaleria, TonoHito,
} from '../../../lib/api/contenido'

/**
 * El formulario de cada tipo de bloque, todos juntos en este fichero,
 * separados del registro de `formularios.tsx` (`NOMBRE_BLOQUE`, `FORMULARIOS`,
 * `BLOQUE_NUEVO`). Un fichero que declara componentes Y exporta datos sueltos
 * rompe el *fast refresh* de Vite (aviso `react/only-export-components`), así
 * que la separación es esa y no otra: `components/bloques/registro.tsx` evita
 * el mismo aviso con un componente por fichero, pero aquí los tres formularios
 * son pequeños y solo los usa `formularios.tsx`, así que basta con un fichero
 * para los tres en vez de tres ficheros de uno.
 */

export type Props<T> = { bloque: T; onCambio: (cambios: Partial<T>) => void }

export function FormularioTexto({ bloque, onCambio }: Props<BloqueTexto>) {
  return (
    <EditorTexto
      valor={bloque.html}
      onCambio={(html) => onCambio({ html })}
      etiqueta="Contenido del bloque"
    />
  )
}

export function FormularioFoto({ bloque, onCambio }: Props<BloqueFoto>) {
  return (
    <Stack spacing={2}>
      <CampoImagen
        valor={bloque.url}
        onCambio={(url) => onCambio({ url })}
        etiqueta="Foto"
        ayuda="JPG, PNG o WebP apaisado, de hasta 5 MB."
        apaisada
      />
      <CampoTexto
        etiqueta="Descripción"
        valor={bloque.alt}
        onCambio={(alt) => onCambio({ alt })}
        ayuda="Lo que se ve, en una frase. Es lo que oye quien usa un lector de pantalla."
        maxLength={topes.descripcion}
      />
      <CampoTexto
        etiqueta="Pie (opcional)"
        valor={bloque.pie}
        onCambio={(pie) => onCambio({ pie })}
        ayuda="Frase corta bajo la foto. Se puede dejar vacía."
        maxLength={topes.etiqueta}
      />
    </Stack>
  )
}

/**
 * Una tarjeta recién añadida, en blanco y sin enlace. Antes apuntaba a la
 * portada por defecto, y una tarjeta a medio hacer llevaba al inicio sin que
 * nadie lo hubiera decidido.
 */
const TARJETA_NUEVA = { titulo: '', descripcion: '', enlace: '' }

export function FormularioTarjetas({ bloque, onCambio }: Props<BloqueTarjetas>) {
  const cambiar = (indice: number, campo: 'titulo' | 'descripcion' | 'enlace', valor: string) =>
    onCambio({ tarjetas: bloque.tarjetas.map((t, i) => (i === indice ? { ...t, [campo]: valor } : t)) })

  const anadir = () => onCambio({ tarjetas: [...bloque.tarjetas, { ...TARJETA_NUEVA }] })
  const quitar = (indice: number) =>
    onCambio({ tarjetas: bloque.tarjetas.filter((_, i) => i !== indice) })

  // Los dos límites son los del esquema del servidor, que lee el mismo JSON:
  // una lista vacía no pinta nada, y el tope de arriba evita una página
  // interminable. El servidor sigue siendo quien decide; esto solo evita
  // ofrecer algo que se va a rechazar.
  const sobranParaQuitar = bloque.tarjetas.length > 1
  const cabenMas = bloque.tarjetas.length < topes.tarjetasPorBloque

  return (
    <Stack spacing={2}>
      {bloque.tarjetas.map((tarjeta, indice) => (
        <Stack key={indice} spacing={1.5} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Stack direction="row" sx={{ alignItems: 'center' }}>
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>Tarjeta {indice + 1}</Typography>
            <Tooltip title={sobranParaQuitar ? 'Quitar' : 'El bloque necesita al menos una tarjeta'}><span>
              <IconButton size="small" color="error" aria-label={`Quitar la tarjeta ${indice + 1}`}
                disabled={!sobranParaQuitar} onClick={() => quitar(indice)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span></Tooltip>
          </Stack>
          <TextField label={`Título de la tarjeta ${indice + 1}`} value={tarjeta.titulo}
            onChange={(e) => cambiar(indice, 'titulo', e.target.value)} size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.titulo } }} />
          <TextField label="Descripción" value={tarjeta.descripcion} multiline
            onChange={(e) => cambiar(indice, 'descripcion', e.target.value)} size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.textoTarjeta } }} />
          <CampoEnlace etiqueta={`Enlace de la tarjeta ${indice + 1}`} valor={tarjeta.enlace} opcional
            onCambio={(ruta) => cambiar(indice, 'enlace', ruta)}
            ayuda="Opcional. Sin enlace, la tarjeta es informativa y no lleva a ninguna parte." />
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={anadir} disabled={!cabenMas} sx={{ alignSelf: 'flex-start' }}>
        Añadir tarjeta
      </Button>
      {!cabenMas && (
        <Typography variant="caption" color="text.secondary">
          Son ya {topes.tarjetasPorBloque} tarjetas, el máximo de un bloque.
        </Typography>
      )}
    </Stack>
  )
}

/**
 * Claves estables para las filas de la galería.
 *
 * Hacen falta aquí y no en las tarjetas porque estas filas llevan
 * `CampoImagen`, que guarda estado propio mientras sube una foto. Con la
 * posición por clave, React reutiliza cada instancia en su sitio al reordenar
 * en vez de moverla: una subida en vuelo terminaría escribiendo su ruta en el
 * medio que hubiera pasado a ocupar esa posición, y la foto acabaría en otra
 * fila. Es el mismo problema que está anotado en `BloquesDePagina.tsx`, y se
 * resuelve igual que en `bloques/filas.ts`: un contador de módulo que reparte
 * claves que no se repiten.
 *
 * La lista de claves va en paralelo a `bloque.medios` y se mueve en los mismos
 * manejadores. No puede desajustarse porque este formulario es el único que
 * toca esa lista; aun así, al pintar se cae a la posición si faltara alguna.
 */
let ultimaClave = 0
const siguienteClave = () => ++ultimaClave

/** Copia de la lista con dos posiciones cambiadas. */
function intercambiar<T>(lista: T[], indice: number, destino: number): T[] {
  const copia = [...lista]
  copia[indice] = lista[destino]
  copia[destino] = lista[indice]
  return copia
}

export function FormularioGaleria({ bloque, onCambio }: Props<BloqueGaleria>) {
  const [claves, setClaves] = useState<number[]>(() => bloque.medios.map(siguienteClave))

  const cambiar = (indice: number, cambios: Partial<MedioGaleria>) =>
    onCambio({ medios: bloque.medios.map((m, i) => (i === indice ? { ...m, ...cambios } : m)) })

  const anadir = (medio: MedioGaleria) => {
    setClaves((actuales) => [...actuales, siguienteClave()])
    onCambio({ medios: [...bloque.medios, { ...medio }] })
  }

  const quitar = (indice: number) => {
    setClaves((actuales) => actuales.filter((_, i) => i !== indice))
    onCambio({ medios: bloque.medios.filter((_, i) => i !== indice) })
  }

  const mover = (indice: number, salto: -1 | 1) => {
    const destino = indice + salto
    if (destino < 0 || destino >= bloque.medios.length) return
    setClaves((actuales) => intercambiar(actuales, indice, destino))
    onCambio({ medios: intercambiar(bloque.medios, indice, destino) })
  }

  // El límite es el del esquema del servidor, que lee el mismo JSON.
  const cabenMas = bloque.medios.length < topes.mediosPorGaleria

  return (
    <Stack spacing={2}>
      {bloque.medios.length === 0 && (
        <Alert severity="info">
          Una galería vacía no se puede guardar. Añade una foto o un vídeo, o quita el bloque entero.
        </Alert>
      )}

      {bloque.medios.map((medio, indice) => (
        <Stack key={claves[indice] ?? indice} spacing={1.5}
          sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Chip size="small" icon={medio.tipo === 'video' ? <MovieOutlinedIcon /> : <AddPhotoAlternateOutlinedIcon />}
              label={medio.tipo === 'video' ? 'Vídeo' : 'Foto'} />
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              Posición {indice + 1} de {bloque.medios.length}
            </Typography>
            <Tooltip title="Subir"><span>
              <IconButton size="small" aria-label={`Subir el medio ${indice + 1}`}
                disabled={indice === 0} onClick={() => mover(indice, -1)}>
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
            </span></Tooltip>
            <Tooltip title="Bajar"><span>
              <IconButton size="small" aria-label={`Bajar el medio ${indice + 1}`}
                disabled={indice === bloque.medios.length - 1} onClick={() => mover(indice, 1)}>
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
            </span></Tooltip>
            <Tooltip title="Quitar">
              <IconButton size="small" color="error" aria-label={`Quitar el medio ${indice + 1}`}
                onClick={() => quitar(indice)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <CamposDeMedio
            medio={medio}
            onCambio={(cambios) => cambiar(indice, cambios)}
            etiquetaDireccion={`Dirección del vídeo ${indice + 1}`}
          />
        </Stack>
      ))}

      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Button startIcon={<AddPhotoAlternateOutlinedIcon />} onClick={() => anadir(FOTO_NUEVA)} disabled={!cabenMas}>
          Añadir foto
        </Button>
        <Button startIcon={<MovieOutlinedIcon />} onClick={() => anadir(VIDEO_NUEVO)} disabled={!cabenMas}>
          Añadir vídeo
        </Button>
      </Stack>
      {!cabenMas && (
        <Typography variant="caption" color="text.secondary">
          Son ya {topes.mediosPorGaleria} medios, el máximo de una galería.
        </Typography>
      )}
    </Stack>
  )
}

export function FormularioLlamada({ bloque, onCambio }: Props<BloqueLlamada>) {
  return (
    <Stack spacing={2}>
      <CampoTexto
        etiqueta="Texto"
        valor={bloque.texto}
        onCambio={(texto) => onCambio({ texto })}
        ayuda="Párrafo dentro del recuadro, encima del botón. Se puede dejar vacío."
        maxLength={topes.parrafo}
        multilinea
      />
      <TextField label="Texto del botón" value={bloque.boton}
        onChange={(e) => onCambio({ boton: e.target.value })} size="small" fullWidth
        helperText="Lo que se lee dentro del botón, como «Hazte hermano». Sin esto el bloque no se puede guardar."
        slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
      <CampoEnlace etiqueta="Destino del botón" valor={bloque.enlace}
        onCambio={(enlace) => onCambio({ enlace })}
        ayuda="La página a la que lleva el botón." />
    </Stack>
  )
}

/** Una línea recién añadida, en blanco. */
const LINEA_NUEVA = { etiqueta: '', valor: '' }

export function FormularioDatos({ bloque, onCambio }: Props<BloqueDatos>) {
  return <EditorDeLineas lineas={bloque.lineas} onCambio={(lineas) => onCambio({ lineas })} minimo={1} />
}

/**
 * Las líneas de concepto y valor: las del bloque de datos y las de la tarjeta
 * del bloque de contacto. Las reglas son las mismas salvo el mínimo: un bloque
 * de datos sin líneas no pinta nada, pero la tarjeta de contacto sin líneas
 * simplemente no sale y el formulario ocupa todo el ancho.
 */
function EditorDeLineas({ lineas, onCambio, minimo }: {
  lineas: LineaDatos[]
  onCambio: (lineas: LineaDatos[]) => void
  minimo: 0 | 1
}) {
  const cambiar = (indice: number, campo: 'etiqueta' | 'valor', texto: string) =>
    onCambio(lineas.map((l, i) => (i === indice ? { ...l, [campo]: texto } : l)))

  const anadir = () => onCambio([...lineas, { ...LINEA_NUEVA }])
  const quitar = (indice: number) => onCambio(lineas.filter((_, i) => i !== indice))

  // Los dos límites son los del esquema del servidor, que lee el mismo JSON.
  const sobranParaQuitar = lineas.length > minimo
  const cabenMas = lineas.length < topes.lineasPorBloque

  return (
    <Stack spacing={2}>
      {lineas.map((linea, indice) => (
        <Stack key={indice} direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ alignItems: { md: 'flex-start' } }}>
          <TextField label={`Concepto ${indice + 1}`} value={linea.etiqueta}
            onChange={(e) => cambiar(indice, 'etiqueta', e.target.value)} size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
          <TextField label="Valor" value={linea.valor}
            onChange={(e) => cambiar(indice, 'valor', e.target.value)} size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.lugar } }} />
          <Tooltip title={sobranParaQuitar ? 'Quitar' : 'El bloque necesita al menos una línea'}><span>
            <IconButton size="small" color="error" aria-label={`Quitar la línea ${indice + 1}`}
              disabled={!sobranParaQuitar} onClick={() => quitar(indice)}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span></Tooltip>
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={anadir} disabled={!cabenMas} sx={{ alignSelf: 'flex-start' }}>
        Añadir línea
      </Button>
      {!cabenMas && (
        <Typography variant="caption" color="text.secondary">
          Son ya {topes.lineasPorBloque} líneas, el máximo de un bloque.
        </Typography>
      )}
    </Stack>
  )
}

/**
 * Los tres colores de un hito. No hay un color libre: cada uno responde a algo
 * de la web, y así se le explica a quien edita.
 */
const TONOS: { valor: TonoHito; nombre: string }[] = [
  { valor: 'ninguno', nombre: 'Ninguno' },
  { valor: 'granate', nombre: 'Granate: el color del Sábado de Pasión' },
  { valor: 'oro', nombre: 'Dorado: el momento actual' },
]

/** Un hito recién añadido, en blanco y sin color. */
const HITO_NUEVO: HitoHistoria = { periodo: '', etiqueta: '', titulo: '', relato: '', foto: { url: '', alt: '', pie: '' }, tono: 'ninguno' }

/**
 * Los hitos de una cronología: lo que antes era la pantalla «Historia» del
 * grupo «Contenido», ahora como formulario de bloque.
 *
 * Las filas llevan clave estable por lo mismo que las de la galería: cada una
 * tiene un `CampoImagen`, que guarda estado mientras sube, y al reordenar la
 * foto en vuelo acabaría en el hito que hubiera pasado a ocupar esa posición.
 */
export function FormularioCronologia({ bloque, onCambio }: Props<BloqueCronologia>) {
  const [claves, setClaves] = useState<number[]>(() => bloque.hitos.map(siguienteClave))

  const cambiar = (indice: number, cambios: Partial<HitoHistoria>) =>
    onCambio({ hitos: bloque.hitos.map((h, i) => (i === indice ? { ...h, ...cambios } : h)) })
  const cambiarFoto = (indice: number, cambios: Partial<HitoHistoria['foto']>) =>
    cambiar(indice, { foto: { ...bloque.hitos[indice].foto, ...cambios } })

  const anadir = () => {
    setClaves((actuales) => [...actuales, siguienteClave()])
    onCambio({ hitos: [...bloque.hitos, structuredClone(HITO_NUEVO)] })
  }
  const quitar = (indice: number) => {
    setClaves((actuales) => actuales.filter((_, i) => i !== indice))
    onCambio({ hitos: bloque.hitos.filter((_, i) => i !== indice) })
  }
  const mover = (indice: number, salto: -1 | 1) => {
    const destino = indice + salto
    if (destino < 0 || destino >= bloque.hitos.length) return
    setClaves((actuales) => intercambiar(actuales, indice, destino))
    onCambio({ hitos: intercambiar(bloque.hitos, indice, destino) })
  }

  // Los dos límites son los del esquema del servidor, que lee el mismo JSON.
  const sobranParaQuitar = bloque.hitos.length > 1
  const cabenMas = bloque.hitos.length < topes.hitosPorCronologia

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Cada hito es un momento, en el orden en que se leen. En la página de Historia, el índice
        de la cabecera se hace solo con el periodo y la etiqueta de los hitos de la primera cronología.
      </Typography>

      {bloque.hitos.map((hito, indice) => {
        const n = indice + 1
        return (
          <Stack key={claves[indice] ?? indice} spacing={2} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>Hito {n}</Typography>
              <Tooltip title="Subir"><span>
                <IconButton size="small" aria-label={`Subir el hito ${n}`}
                  disabled={indice === 0} onClick={() => mover(indice, -1)}>
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
              <Tooltip title="Bajar"><span>
                <IconButton size="small" aria-label={`Bajar el hito ${n}`}
                  disabled={indice === bloque.hitos.length - 1} onClick={() => mover(indice, 1)}>
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
              <Tooltip title={sobranParaQuitar ? 'Quitar' : 'La cronología necesita al menos un hito'}><span>
                <IconButton size="small" color="error" aria-label={`Quitar el hito ${n}`}
                  disabled={!sobranParaQuitar} onClick={() => quitar(indice)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </span></Tooltip>
            </Stack>

            {/* Los tres campos cortos en una fila: con la columna de edición
                ancha caben, y el relato queda solo con todo el ancho. */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'flex-start' } }}>
              <TextField
                label={`Periodo del hito ${n}`}
                value={hito.periodo}
                onChange={(e) => cambiar(indice, { periodo: e.target.value })}
                helperText="En grande, en serif: «Años 50», «1954» o «Hoy»."
                slotProps={{ htmlInput: { maxLength: topes.etiqueta } }}
                size="small"
                sx={{ width: { xs: '100%', md: 220 }, flexShrink: 0 }}
              />
              <TextField
                label={`Etiqueta del hito ${n}`}
                value={hito.etiqueta}
                onChange={(e) => cambiar(indice, { etiqueta: e.target.value })}
                helperText="Bajo el periodo y en el índice de la cabecera."
                slotProps={{ htmlInput: { maxLength: topes.etiqueta } }}
                size="small"
                fullWidth
              />
              <TextField
                select
                label={`Color del hito ${n}`}
                value={hito.tono}
                onChange={(e) => cambiar(indice, { tono: e.target.value as TonoHito })}
                helperText="Tiñe el periodo y el punto de la línea. No hay colores libres."
                slotProps={{ select: { native: true } }}
                size="small"
                sx={{ width: { xs: '100%', md: 320 }, flexShrink: 0 }}
              >
                {TONOS.map((tono) => <option key={tono.valor} value={tono.valor}>{tono.nombre}</option>)}
              </TextField>
            </Stack>
            <TextField
              label={`Título del hito ${n}`}
              value={hito.titulo}
              onChange={(e) => cambiar(indice, { titulo: e.target.value })}
              helperText="Encabezado del hito, junto a su texto."
              slotProps={{ htmlInput: { maxLength: topes.titulo } }}
              size="small"
              fullWidth
            />
            <TextField
              label={`Relato del hito ${n}`}
              value={hito.relato}
              onChange={(e) => cambiar(indice, { relato: e.target.value })}
              helperText="El texto del hito. Una línea en blanco separa un párrafo del siguiente."
              slotProps={{ htmlInput: { maxLength: topes.relato } }}
              multiline
              minRows={4}
              size="small"
              fullWidth
            />
            <CampoImagen
              etiqueta={`Foto del hito ${n}`}
              ayuda="JPG, PNG o WebP apaisado, de hasta 5 MB. Sale dentro del hito, debajo de su texto."
              apaisada
              valor={hito.foto.url}
              onCambio={(url) => cambiarFoto(indice, { url })}
            />
            {hito.foto.url !== '' && (
              <>
                <TextField
                  label={`Qué se ve en la foto del hito ${n}`}
                  value={hito.foto.alt}
                  onChange={(e) => cambiarFoto(indice, { alt: e.target.value })}
                  helperText="La foto, en una frase. Es lo que oye quien usa un lector de pantalla."
                  slotProps={{ htmlInput: { maxLength: topes.descripcion } }}
                  size="small"
                  fullWidth
                />
                <TextField
                  label={`Pie de la foto del hito ${n}`}
                  value={hito.foto.pie}
                  onChange={(e) => cambiarFoto(indice, { pie: e.target.value })}
                  helperText="Línea pequeña bajo la foto. Puede quedar vacía."
                  slotProps={{ htmlInput: { maxLength: topes.etiqueta } }}
                  size="small"
                  fullWidth
                />
              </>
            )}
          </Stack>
        )
      })}

      <Button startIcon={<AddIcon />} onClick={anadir} disabled={!cabenMas} sx={{ alignSelf: 'flex-start' }}>
        Añadir hito
      </Button>
      {!cabenMas && (
        <Typography variant="caption" color="text.secondary">
          Son ya {topes.hitosPorCronologia} hitos, el máximo de una cronología.
        </Typography>
      )}
    </Stack>
  )
}

/**
 * Las fuentes de un listado, con lo que quien edita necesita saber: qué sale
 * y desde dónde se escribe. Es lo que decide, porque el bloque no tiene más.
 */
const FUENTES: { valor: FuenteListado; nombre: string; ayuda: string }[] = [
  { valor: 'noticias-recientes', nombre: 'Últimas noticias (3)', ayuda: 'Las tres noticias más recientes, con un enlace a todas. Se escriben en «Noticias».' },
  { valor: 'agenda-proxima', nombre: 'Próximos actos (4)', ayuda: 'Los cuatro próximos actos, con un enlace a la agenda completa. Se escriben en «Agenda».' },
  { valor: 'noticias', nombre: 'Todas las noticias', ayuda: 'El archivo entero, por páginas, con la última noticia destacada. Se escriben en «Noticias».' },
  { valor: 'agenda', nombre: 'Agenda completa', ayuda: 'Todos los actos por venir, por páginas. Se escriben en «Agenda».' },
  { valor: 'publicaciones', nombre: 'Todas las publicaciones', ayuda: 'Boletines, dossieres y el resto, por páginas. Se suben en «Publicaciones».' },
  { valor: 'boletines', nombre: 'Boletines', ayuda: 'Solo los boletines, por páginas. Se suben en «Publicaciones».' },
  { valor: 'dossier', nombre: 'Dossier de prensa', ayuda: 'Solo las apariciones en los medios, por páginas. Se suben en «Publicaciones».' },
]

export function FormularioListado({ bloque, onCambio }: Props<BloqueListado>) {
  const fuente = FUENTES.find((f) => f.valor === bloque.fuente)
  return (
    <TextField
      select
      label="Qué se enseña"
      value={bloque.fuente}
      onChange={(e) => onCambio({ fuente: e.target.value as FuenteListado })}
      helperText={fuente?.ayuda ?? 'Elige de dónde salen los elementos.'}
      slotProps={{ select: { native: true } }}
      size="small"
      fullWidth
    >
      {FUENTES.map((f) => <option key={f.valor} value={f.valor}>{f.nombre}</option>)}
    </TextField>
  )
}

export function FormularioContacto({ bloque, onCambio }: Props<BloqueContacto>) {
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        El formulario (nombre, email, teléfono, asunto y mensaje) es fijo: lo que se envía llega por
        correo. Aquí se edita la tarjeta que va a su lado. Sin líneas, la tarjeta no sale y el
        formulario ocupa todo el ancho.
      </Typography>
      <CampoTexto
        etiqueta="Título de la tarjeta"
        valor={bloque.tituloDatos}
        onCambio={(tituloDatos) => onCambio({ tituloDatos })}
        ayuda="Encabezado de la tarjeta, como «Datos de contacto». Puede quedar vacío."
        maxLength={topes.titulo}
      />
      <Typography variant="subtitle2">Líneas de la tarjeta</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mt: '0 !important' }}>
        El icono de cada línea sale solo: un sobre si el valor es un correo, un teléfono si son cifras,
        un reloj si el concepto habla de horario y un marcador si habla de dirección.
      </Typography>
      <EditorDeLineas lineas={bloque.lineas} onCambio={(lineas) => onCambio({ lineas })} minimo={0} />
    </Stack>
  )
}

/** Una parada recién añadida, con una hora que parece una hora. */
const PARADA_NUEVA = { hora: '17:30', lugar: '' }

export function FormularioItinerario({ bloque, onCambio }: Props<BloqueItinerario>) {
  const cambiar = (indice: number, campo: 'hora' | 'lugar', texto: string) =>
    onCambio({ paradas: bloque.paradas.map((p, i) => (i === indice ? { ...p, [campo]: texto } : p)) })

  const anadir = () => onCambio({ paradas: [...bloque.paradas, { ...PARADA_NUEVA }] })
  const quitar = (indice: number) => onCambio({ paradas: bloque.paradas.filter((_, i) => i !== indice) })

  const mover = (indice: number, salto: -1 | 1) => {
    const destino = indice + salto
    if (destino < 0 || destino >= bloque.paradas.length) return
    onCambio({ paradas: intercambiar(bloque.paradas, indice, destino) })
  }

  // Los dos límites son los del esquema del servidor, que lee el mismo JSON.
  const sobranParaQuitar = bloque.paradas.length > 1
  const cabenMas = bloque.paradas.length < topes.paradasPorItinerario

  return (
    <Stack spacing={1.5}>
      {bloque.paradas.map((parada, indice) => (
        // Clave posicional: una parada no tiene identificador y el itinerario
        // repite lugares. Aquí no importa como en la galería, porque ninguno de
        // estos campos guarda estado propio: son dos cuadros de texto.
        <Stack key={indice} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' } }}>
          <TextField
            label={`Hora ${indice + 1}`} value={parada.hora}
            onChange={(e) => cambiar(indice, 'hora', e.target.value)}
            size="small" sx={{ width: { sm: 120 } }}
            placeholder="17:30"
            slotProps={{ htmlInput: { maxLength: 5, inputMode: 'numeric' } }}
          />
          <TextField
            label="Lugar" value={parada.lugar}
            onChange={(e) => cambiar(indice, 'lugar', e.target.value)}
            size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.lugar } }}
          />
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Subir"><span>
              <IconButton size="small" aria-label={`Subir la parada ${indice + 1}`}
                disabled={indice === 0} onClick={() => mover(indice, -1)}>
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
            </span></Tooltip>
            <Tooltip title="Bajar"><span>
              <IconButton size="small" aria-label={`Bajar la parada ${indice + 1}`}
                disabled={indice === bloque.paradas.length - 1} onClick={() => mover(indice, 1)}>
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
            </span></Tooltip>
            <Tooltip title={sobranParaQuitar ? 'Quitar' : 'El itinerario necesita al menos una parada'}><span>
              <IconButton size="small" color="error" aria-label={`Quitar la parada ${indice + 1}`}
                disabled={!sobranParaQuitar} onClick={() => quitar(indice)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span></Tooltip>
          </Stack>
        </Stack>
      ))}
      <Button startIcon={<AddIcon />} onClick={anadir} disabled={!cabenMas} sx={{ alignSelf: 'flex-start' }}>
        Añadir parada
      </Button>
      <Typography variant="caption" color="text.secondary">
        {cabenMas
          ? 'La hora va en formato de 24 horas, como 17:30. Se enseña tal cual dentro de la pastilla.'
          : `Son ya ${topes.paradasPorItinerario} paradas, el máximo de un itinerario.`}
      </Typography>
    </Stack>
  )
}
