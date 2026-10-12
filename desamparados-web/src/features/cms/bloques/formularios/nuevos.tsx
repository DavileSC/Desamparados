/**
 * Los formularios de los bloques que llegaron con las opciones de
 * presentación: foto con texto, cita, vídeo, botones, preguntas, descargas,
 * mapa, cuenta atrás y espacio. Aquí va solo el contenido; cómo se ven se
 * elige en la pestaña «Presentación».
 */
import { Alert, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material'
import { valorDe } from '../../../../components/bloques/presentacion'
import topes from '../../../../../../shared/topes-contenido.json'
import EditorTexto from '../../EditorTexto'
import CampoImagen from '../../CampoImagen'
import CampoPdf from '../../CampoPdf'
import CampoTexto from '../../contenido/CampoTexto'
import CampoEnlace from '../../contenido/CampoEnlace'
import CamposDeMedio from '../../contenido/CamposDeMedio'
import { site } from '../../../../config/site'
import { deLaCorporacion } from '../../../../domain/articulos'
import ListaEditable from './ListaEditable'
import type { Props } from './comunes'
import type {
  BloqueFotoTexto, BloqueCita, BloqueVideo, BloqueBotones, BloquePreguntas,
  BloqueDescargas, BloqueMapa, BloqueCuentaAtras, BotonDeBloque, BloqueDibujo, NombreDeDibujo, BloqueAnillos, FinDeAnillo,
  BloquePuertas, Puerta, BloquePrograma, BloqueRelacion,
} from '../../../../lib/api/contenido'

export function FormularioFotoTexto({ bloque, onCambio }: Props<BloqueFotoTexto>) {
  return (
    <Stack spacing={2}>
      <CampoImagen valor={bloque.url} onCambio={(url) => onCambio({ url })} etiqueta="Foto" apaisada
        ayuda="JPG, PNG o WebP de hasta 5 MB. En el móvil va encima del texto." />
      <CampoTexto etiqueta="Descripción de la foto" valor={bloque.alt} onCambio={(alt) => onCambio({ alt })}
        ayuda="Lo que se ve, en una frase. Es lo que oye quien usa un lector de pantalla." maxLength={topes.descripcion} />
      <CampoTexto etiqueta="Pie de foto" valor={bloque.pie} onCambio={(pie) => onCambio({ pie })}
        ayuda="Opcional. Una línea pequeña debajo de la foto." maxLength={topes.etiqueta} />
      <EditorTexto valor={bloque.html} onCambio={(html) => onCambio({ html })} etiqueta="Texto al lado de la foto" />
      <TextField label="Texto del botón" value={bloque.boton} onChange={(e) => onCambio({ boton: e.target.value })} size="small" fullWidth
        helperText="Opcional. Con texto, el botón necesita a dónde llevar."
        slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
      <CampoEnlace etiqueta="Destino del botón" valor={bloque.enlace} opcional onCambio={(enlace) => onCambio({ enlace })}
        ayuda="La página a la que lleva el botón. Vacío si no hay botón." />
    </Stack>
  )
}

export function FormularioCita({ bloque, onCambio }: Props<BloqueCita>) {
  return (
    <Stack spacing={2}>
      <CampoTexto etiqueta="La cita" valor={bloque.texto} onCambio={(texto) => onCambio({ texto })} multilinea
        ayuda="Las palabras que se destacan, sin comillas: las pone la web." maxLength={topes.parrafo} />
      <CampoTexto etiqueta="Quién lo dijo" valor={bloque.autor} onCambio={(autor) => onCambio({ autor })}
        ayuda="Opcional, como «San Pablo de la Cruz»." maxLength={topes.etiqueta} />
      <CampoTexto etiqueta="Dónde" valor={bloque.fuente} onCambio={(fuente) => onCambio({ fuente })}
        ayuda="Opcional, como «Homilía del triduo, 2025»." maxLength={topes.descripcion} />
    </Stack>
  )
}

export function FormularioVideo({ bloque, onCambio }: Props<BloqueVideo>) {
  return (
    <CamposDeMedio
      medio={{ tipo: 'video', url: bloque.url, portada: bloque.portada, alt: bloque.alt, pie: bloque.pie }}
      onCambio={({ url, portada, alt, pie }) => onCambio({
        ...(url !== undefined && { url }), ...(portada !== undefined && { portada }),
        ...(alt !== undefined && { alt }), ...(pie !== undefined && { pie }),
      })}
    />
  )
}

const BOTON_NUEVO = (): BotonDeBloque => ({ texto: '', enlace: '/', estilo: 'secundario' })

export function FormularioBotones({ bloque, onCambio }: Props<BloqueBotones>) {
  return (
    <ListaEditable elementos={bloque.botones} onCambio={(botones) => onCambio({ botones })} nuevo={BOTON_NUEVO}
      nombre="Botón" maximo={topes.botonesPorBloque}
      pintar={(boton, cambiar, i) => (
        <>
          <TextField label={`Texto del botón ${i + 1}`} value={boton.texto} onChange={(e) => cambiar({ texto: e.target.value })} size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
          <CampoEnlace etiqueta={`Destino del botón ${i + 1}`} valor={boton.enlace} onCambio={(enlace) => cambiar({ enlace })}
            ayuda="La página a la que lleva." />
          <TextField select label="Aspecto" value={boton.estilo} size="small" fullWidth
            onChange={(e) => cambiar({ estilo: e.target.value as BotonDeBloque['estilo'] })}>
            <MenuItem value="principal">Principal (granate)</MenuItem>
            <MenuItem value="secundario">Secundario (con contorno)</MenuItem>
          </TextField>
        </>
      )} />
  )
}

export function FormularioPreguntas({ bloque, onCambio }: Props<BloquePreguntas>) {
  return (
    <ListaEditable elementos={bloque.preguntas} onCambio={(preguntas) => onCambio({ preguntas })}
      nuevo={() => ({ pregunta: '', respuesta: '' })} nombre="Pregunta" maximo={topes.preguntasPorBloque}
      pintar={(item, cambiar, i) => (
        <>
          <TextField label={`Pregunta ${i + 1}`} value={item.pregunta} onChange={(e) => cambiar({ pregunta: e.target.value })} size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: topes.titulo } }} />
          <TextField label="Respuesta" value={item.respuesta} onChange={(e) => cambiar({ respuesta: e.target.value })} size="small" fullWidth multiline minRows={3}
            helperText="Deja una línea en blanco entre párrafos."
            slotProps={{ htmlInput: { maxLength: topes.respuesta } }} />
        </>
      )} />
  )
}

export function FormularioDescargas({ bloque, onCambio }: Props<BloqueDescargas>) {
  return (
    <ListaEditable elementos={bloque.archivos} onCambio={(archivos) => onCambio({ archivos })}
      nuevo={() => ({ titulo: '', descripcion: '', url: '' })} nombre="Documento" maximo={topes.descargasPorBloque}
      pintar={(archivo, cambiar, i) => (
        <>
          <TextField label={`Nombre del documento ${i + 1}`} value={archivo.titulo} onChange={(e) => cambiar({ titulo: e.target.value })} size="small" fullWidth
            helperText={`Como se lee en la web: «Reglas ${deLaCorporacion()}».`}
            slotProps={{ htmlInput: { maxLength: topes.titulo } }} />
          <TextField label="Descripción" value={archivo.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })} size="small" fullWidth
            helperText="Opcional. Una línea debajo del nombre."
            slotProps={{ htmlInput: { maxLength: topes.descripcion } }} />
          <CampoPdf valor={archivo.url} onCambio={(url) => cambiar({ url })} etiqueta={`PDF del documento ${i + 1}`} apilada />
        </>
      )} />
  )
}

export function FormularioMapa({ bloque, onCambio }: Props<BloqueMapa>) {
  return (
    <Stack spacing={2}>
      <CampoTexto etiqueta="Nombre del lugar" valor={bloque.lugar} onCambio={(lugar) => onCambio({ lugar })}
        ayuda="Opcional, como «Parroquia de los Padres Pasionistas»." maxLength={topes.titulo} />
      <CampoTexto etiqueta="Dirección" valor={bloque.direccion} onCambio={(direccion) => onCambio({ direccion })}
        ayuda="Lo que buscarías en Google Maps: calle, número y ciudad." maxLength={topes.lugar} />
      <CampoTexto etiqueta="Indicaciones" valor={bloque.indicaciones ?? ''} onCambio={(indicaciones) => onCambio({ indicaciones })} multilinea
        ayuda="Opcional. Para orientarse: el barrio, la entrada. Se lucen con «Datos al lado» en Presentación." maxLength={topes.parrafo} />
      <Typography variant="caption" color="text.secondary">
        El mapa no se carga hasta que el visitante acepta las cookies o pulsa «Mostrar el mapa»: Google recibe su IP.
      </Typography>
    </Stack>
  )
}

/** Los dibujos que sabe trazar la web, con el nombre que lee quien edita. */
const DIBUJOS: { valor: NombreDeDibujo; nombre: string }[] = [
  { valor: 'templo', nombre: 'Un templo: estructura triangular en forma de concha' },
  { valor: 'signoPasionista', nombre: 'El signo pasionista' },
]

export function FormularioDibujo({ bloque, onCambio }: Props<BloqueDibujo>) {
  return (
    <Stack spacing={2}>
      <TextField select label="Dibujo" value={bloque.dibujo} size="small" fullWidth
        onChange={(e) => onCambio({ dibujo: e.target.value as NombreDeDibujo })}
        helperText="Se dibuja solo al bajar por la página. El lado se elige en «Presentación».">
        {DIBUJOS.map((d) => <MenuItem key={d.valor} value={d.valor}>{d.nombre}</MenuItem>)}
      </TextField>
      <CampoImagen valor={bloque.foto?.url ?? ''} etiqueta="Ilustración (opcional)" apaisada
        onCambio={(url) => onCambio({ foto: { ...bloque.foto, url, alt: bloque.foto?.alt ?? '' } })}
        ayuda="Si subes una, se ve en lugar del dibujo de líneas. Mejor en PNG o WebP con el fondo transparente." />
      {(bloque.foto?.url ?? '') !== '' && (
        <CampoTexto etiqueta="Descripción de la ilustración" valor={bloque.foto?.alt ?? ''} maxLength={topes.descripcion}
          onCambio={(alt) => onCambio({ foto: { ...bloque.foto, url: bloque.foto?.url ?? '', alt } })}
          ayuda="Lo que se ve, en una frase. Es lo que oye quien usa un lector de pantalla." />
      )}
      {(bloque.foto?.url ?? '') !== '' && (
        // La ley europea de IA pide decir que una imagen está generada: la web lo pone debajo.
        <FormControlLabel label="Generada con inteligencia artificial"
          control={<Switch checked={bloque.foto?.ia ?? false} onChange={(e) => bloque.foto && onCambio({ foto: { ...bloque.foto, ia: e.target.checked } })} />} />
      )}
      <EditorTexto valor={bloque.html} onCambio={(html) => onCambio({ html })} etiqueta="Texto al lado del dibujo" />
    </Stack>
  )
}

/** El color de cada anillo, en el orden en que se dibujan: para que quien edita sepa cuál es cuál. */
const ANILLO = ['oro, arriba', 'rosa, a la izquierda', 'crema, a la derecha']

export function FormularioAnillos({ bloque, onCambio }: Props<BloqueAnillos>) {
  // En foco no hay anillos ni cruce: cada fin es solo una palabra y su texto.
  const foco = valorDe(bloque, 'disposicion') === 'foco'
  const cambiarFin = (indice: number, cambios: Partial<FinDeAnillo>) =>
    onCambio({ fines: bloque.fines.map((f, i) => (i === indice ? { ...f, ...cambios } : f)) as BloqueAnillos['fines'] })
  return (
    <Stack spacing={2}>
      {bloque.fines.map((fin, i) => (
        <Stack key={i} spacing={1.5} sx={{ p: { xs: 1.5, sm: 2 }, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="subtitle2">{foco ? `Fin ${i + 1}` : `Anillo ${i + 1} (${ANILLO[i]})`}</Typography>
          <TextField label={`Nombre del fin ${i + 1}`} value={fin.titulo} size="small" fullWidth
            onChange={(e) => cambiarFin(i, { titulo: e.target.value })} slotProps={{ htmlInput: { maxLength: topes.titulo } }}
            helperText={foco ? 'Una sola palabra: en foco se ve muy grande.' : undefined} />
          <TextField label="Texto" value={fin.texto} size="small" fullWidth multiline minRows={2}
            onChange={(e) => cambiarFin(i, { texto: e.target.value })} slotProps={{ htmlInput: { maxLength: topes.textoTarjeta } }} />
          <TextField label="Texto del botón" value={fin.boton} size="small" fullWidth
            onChange={(e) => cambiarFin(i, { boton: e.target.value })}
            helperText="Opcional, como «Ver los cultos». Con texto, necesita a dónde llevar."
            slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
          <CampoEnlace etiqueta={`Destino del botón ${i + 1}`} valor={fin.enlace} opcional
            onCambio={(enlace) => cambiarFin(i, { enlace })} ayuda="La página a la que lleva. Vacío si no hay botón." />
        </Stack>
      ))}
      {!foco && (
        <CampoTexto etiqueta="En el cruce de los tres" valor={bloque.centro} onCambio={(centro) => onCambio({ centro })}
          ayuda={`Una palabra pequeña bajo la cruz, como «${site.nombreCorto}». Opcional.`} maxLength={topes.etiqueta} />
      )}
      <CampoTexto etiqueta={foco ? 'Texto al lado' : 'Texto debajo'} valor={bloque.texto} onCambio={(texto) => onCambio({ texto })} multilinea
        ayuda={foco ? 'Opcional. Va a la izquierda, junto al texto del fin enfocado.' : 'Opcional. Un párrafo bajo los anillos.'} maxLength={topes.parrafo} />
      <Typography variant="caption" color="text.secondary">
        {foco
          ? 'Siempre son tres. El foco pasa solo de uno a otro hasta que alguien pulsa una palabra. En Presentación puedes volver a los anillos.'
          : 'Siempre son tres: uno por anillo. Los colores están pensados para fondo oscuro: elige «Oscuro» en Presentación. También pueden ir «En foco» (Presentación → Disposición).'}
      </Typography>
    </Stack>
  )
}

/** Cómo se ve cada puerta, para que quien edita sepa cuál es cuál. */
const PUERTA = ['la de la izquierda, en oro, con botón de velo crema', 'la de la derecha, en rosa, con botón granate']

export function FormularioPuertas({ bloque, onCambio }: Props<BloquePuertas>) {
  const cambiarPuerta = (indice: number, cambios: Partial<Puerta>) =>
    onCambio({ puertas: bloque.puertas.map((p, i) => (i === indice ? { ...p, ...cambios } : p)) as BloquePuertas['puertas'] })
  return (
    <Stack spacing={2}>
      {bloque.puertas.map((puerta, i) => (
        <Stack key={i} spacing={1.5} sx={{ p: { xs: 1.5, sm: 2 }, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="subtitle2">Puerta {i + 1} ({PUERTA[i]})</Typography>
          <TextField label="Ceja" value={puerta.ceja} size="small" fullWidth
            onChange={(e) => cambiarPuerta(i, { ceja: e.target.value })} helperText="Opcional. Unas palabras pequeñas encima, como «Si lo necesitas»."
            slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
          <TextField label={`Título de la puerta ${i + 1}`} value={puerta.titulo} size="small" fullWidth
            onChange={(e) => cambiarPuerta(i, { titulo: e.target.value })} slotProps={{ htmlInput: { maxLength: topes.titulo } }} />
          <TextField label="Texto" value={puerta.texto} size="small" fullWidth multiline minRows={2}
            onChange={(e) => cambiarPuerta(i, { texto: e.target.value })} slotProps={{ htmlInput: { maxLength: topes.parrafo } }} />
          <Typography variant="body2" color="text.secondary">Datos a la vista (hasta {topes.datosPorPuerta}). Uno sin valor no sale en la web.</Typography>
          <ListaEditable elementos={puerta.datos} onCambio={(datos) => cambiarPuerta(i, { datos })} minimo={0}
            nuevo={() => ({ etiqueta: '', valor: '', nota: '', copiable: false })} nombre="Dato" maximo={topes.datosPorPuerta}
            pintar={(dato, cambiar, j) => (
              <>
                <TextField label={`Nombre del dato ${j + 1}`} value={dato.etiqueta} size="small" fullWidth
                  onChange={(e) => cambiar({ etiqueta: e.target.value })} helperText="Como «Despacho» o «Donativo»."
                  slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
                <TextField label="Valor" value={dato.valor} size="small" fullWidth
                  onChange={(e) => cambiar({ valor: e.target.value })} helperText="Lo que se lee en grande. Vacío, el dato no sale."
                  slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
                <TextField label="Nota" value={dato.nota} size="small" fullWidth
                  onChange={(e) => cambiar({ nota: e.target.value })} helperText="Opcional. Una línea debajo, como «18:00 – 20:00»."
                  slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
                <FormControlLabel control={<Switch checked={dato.copiable} onChange={(e) => cambiar({ copiable: e.target.checked })} />}
                  label="Con botón para copiarlo (una cuenta, un Bizum)" />
              </>
            )} />
          <TextField label="Texto del botón" value={puerta.boton} size="small" fullWidth
            onChange={(e) => cambiarPuerta(i, { boton: e.target.value })}
            helperText="Opcional, como «Escríbenos». Con texto, necesita a dónde llevar."
            slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
          <CampoEnlace etiqueta={`Destino del botón ${i + 1}`} valor={puerta.enlace} opcional
            onCambio={(enlace) => cambiarPuerta(i, { enlace })} ayuda="La página a la que lleva. Vacío si no hay botón." />
        </Stack>
      ))}
      <Typography variant="caption" color="text.secondary">Siempre son dos, una al lado de la otra; en el móvil, una debajo de la otra.</Typography>
    </Stack>
  )
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export function FormularioPrograma({ bloque, onCambio }: Props<BloquePrograma>) {
  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Un culto por fila, en el orden del año. El mes sirve para que la web marque sola cuál es el próximo y ponga su fecha,
        sacada de la Agenda (del primer culto o salida anunciado en ese mes).
      </Typography>
      <ListaEditable elementos={bloque.filas} onCambio={(filas) => onCambio({ filas })}
        nuevo={() => ({ cuando: '', mes: 0, titulo: '', texto: '', boton: '', enlace: '' })} nombre="Culto" maximo={topes.filasPorPrograma}
        pintar={(fila, cambiar, i) => (
          <>
            <TextField label={`Cuándo (culto ${i + 1})`} value={fila.cuando} onChange={(e) => cambiar({ cuando: e.target.value })} size="small" fullWidth
              helperText="Lo que se lee en grande a la izquierda: «Octubre», «Cuaresma», «Cada mes»."
              slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
            <TextField select label="Mes en que cae" value={fila.mes} onChange={(e) => cambiar({ mes: Number(e.target.value) })} size="small" fullWidth
              helperText="Sin mes fijo, nunca sale como «Próximo».">
              <MenuItem value={0}>Sin mes fijo</MenuItem>
              {MESES.map((mes, m) => <MenuItem key={mes} value={m + 1}>{mes}</MenuItem>)}
            </TextField>
            <TextField label="Culto" value={fila.titulo} onChange={(e) => cambiar({ titulo: e.target.value })} size="small" fullWidth
              slotProps={{ htmlInput: { maxLength: topes.titulo } }} />
            <TextField label="Texto" value={fila.texto} onChange={(e) => cambiar({ texto: e.target.value })} size="small" fullWidth multiline minRows={2}
              helperText="Opcional. Una o dos líneas."
              slotProps={{ htmlInput: { maxLength: topes.parrafo } }} />
            <TextField label="Texto del enlace" value={fila.boton} onChange={(e) => cambiar({ boton: e.target.value })} size="small" fullWidth
              helperText="Opcional, como «La estación de penitencia». Con texto, necesita a dónde llevar."
              slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
            <CampoEnlace etiqueta={`Destino del enlace ${i + 1}`} valor={fila.enlace} opcional
              onCambio={(enlace) => cambiar({ enlace })} ayuda="La página a la que lleva. Vacío si no hay enlace." />
          </>
        )} />
    </Stack>
  )
}

export function FormularioRelacion({ bloque, onCambio }: Props<BloqueRelacion>) {
  return (
    <Stack spacing={2}>
      <CampoTexto etiqueta="Mandato" valor={bloque.mandato} onCambio={(mandato) => onCambio({ mandato })}
        ayuda="Opcional, como «2024 — 2028». Sale junto al título." maxLength={topes.etiqueta} />
      <CampoTexto etiqueta="Nota" valor={bloque.nota} onCambio={(nota) => onCambio({ nota })}
        ayuda="Opcional, al otro lado del título: «Elegida en Cabildo General el 12 de junio de 2024»." maxLength={topes.etiqueta} />
      <ListaEditable elementos={bloque.filas} onCambio={(filas) => onCambio({ filas })}
        nuevo={() => ({ cargo: '', nombre: '', texto: '', enlace: '' })} nombre="Cargo" maximo={topes.filasPorRelacion}
        pintar={(fila, cambiar, i) => (
          <>
            <TextField label={`Cargo ${i + 1}`} value={fila.cargo} onChange={(e) => cambiar({ cargo: e.target.value })} size="small" fullWidth
              helperText="Como «Hermano Mayor» o «Vocalía de Cultos». El primero sale algo más grande."
              slotProps={{ htmlInput: { maxLength: topes.etiqueta } }} />
            <TextField label="Quién lo ocupa" value={fila.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} size="small" fullWidth
              helperText="Nombre y apellidos. Vacío, sale solo el cargo con su función."
              slotProps={{ htmlInput: { maxLength: topes.titulo } }} />
            <TextField label="Qué hace" value={fila.texto} onChange={(e) => cambiar({ texto: e.target.value })} size="small" fullWidth
              helperText="Una línea. Opcional."
              slotProps={{ htmlInput: { maxLength: topes.descripcion } }} />
            <CampoEnlace etiqueta={`Página del cargo ${i + 1}`} valor={fila.enlace} opcional
              onCambio={(enlace) => cambiar({ enlace })} ayuda="Opcional: la página de la vocalía. Hace de enlace la línea de «Qué hace»." />
          </>
        )} />
    </Stack>
  )
}

export function FormularioCuentaAtras({ bloque, onCambio }: Props<BloqueCuentaAtras>) {
  return (
    <Stack spacing={2}>
      <TextField label="Fecha y hora" type="datetime-local" value={bloque.fecha} onChange={(e) => onCambio({ fecha: e.target.value })}
        size="small" fullWidth helperText="Hora peninsular española (la de Madrid), para quien mire desde donde mire."
        slotProps={{ inputLabel: { shrink: true } }} />
      <CampoTexto etiqueta="Qué llega" valor={bloque.texto} onCambio={(texto) => onCambio({ texto })}
        ayuda="Encima de la cuenta, en pequeño: «Estación de penitencia 2027»." maxLength={topes.etiqueta} />
      <CampoTexto etiqueta="Texto al llegar" valor={bloque.textoFinal} onCambio={(textoFinal) => onCambio({ textoFinal })}
        ayuda="Lo que se lee cuando la cuenta llega a cero, en vez de los ceros." maxLength={topes.descripcion} />
    </Stack>
  )
}

export function FormularioEspacio() {
  return (
    <Alert severity="info" variant="outlined">
      Este bloque no lleva texto: deja aire entre el de encima y el de debajo. Su alto y la línea se eligen en «Presentación».
    </Alert>
  )
}
