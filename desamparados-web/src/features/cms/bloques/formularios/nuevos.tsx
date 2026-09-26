/**
 * Los formularios de los bloques que llegaron con las opciones de
 * presentación: foto con texto, cita, vídeo, botones, preguntas, descargas,
 * mapa, cuenta atrás y espacio. Aquí va solo el contenido; cómo se ven se
 * elige en la pestaña «Presentación».
 */
import { Alert, MenuItem, Stack, TextField, Typography } from '@mui/material'
import topes from '../../../../../../shared/topes-contenido.json'
import EditorTexto from '../../EditorTexto'
import CampoImagen from '../../CampoImagen'
import CampoPdf from '../../CampoPdf'
import CampoTexto from '../../contenido/CampoTexto'
import CampoEnlace from '../../contenido/CampoEnlace'
import CamposDeMedio from '../../contenido/CamposDeMedio'
import ListaEditable from './ListaEditable'
import type { Props } from './comunes'
import type {
  BloqueFotoTexto, BloqueCita, BloqueVideo, BloqueBotones, BloquePreguntas,
  BloqueDescargas, BloqueMapa, BloqueCuentaAtras, BotonDeBloque, BloqueDibujo, NombreDeDibujo,
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
            helperText="Como se lee en la web: «Reglas del Grupo Parroquial»."
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
  { valor: 'templo', nombre: 'El templo de Santa María Goretti' },
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
        onCambio={(url) => onCambio({ foto: { url, alt: bloque.foto?.alt ?? '' } })}
        ayuda="Si subes una, se ve en lugar del dibujo de líneas. Mejor en PNG o WebP con el fondo transparente." />
      {(bloque.foto?.url ?? '') !== '' && (
        <CampoTexto etiqueta="Descripción de la ilustración" valor={bloque.foto?.alt ?? ''} maxLength={topes.descripcion}
          onCambio={(alt) => onCambio({ foto: { url: bloque.foto?.url ?? '', alt } })}
          ayuda="Lo que se ve, en una frase. Es lo que oye quien usa un lector de pantalla." />
      )}
      <EditorTexto valor={bloque.html} onCambio={(html) => onCambio({ html })} etiqueta="Texto al lado del dibujo" />
    </Stack>
  )
}

export function FormularioCuentaAtras({ bloque, onCambio }: Props<BloqueCuentaAtras>) {
  return (
    <Stack spacing={2}>
      <TextField label="Fecha y hora" type="datetime-local" value={bloque.fecha} onChange={(e) => onCambio({ fecha: e.target.value })}
        size="small" fullWidth helperText="Hora de Málaga, para quien mire desde donde mire."
        slotProps={{ inputLabel: { shrink: true } }} />
      <CampoTexto etiqueta="Qué llega" valor={bloque.texto} onCambio={(texto) => onCambio({ texto })}
        ayuda="Encima de la cuenta, en pequeño: «Sábado de Pasión 2027»." maxLength={topes.etiqueta} />
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
