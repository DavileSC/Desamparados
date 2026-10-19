import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { Helmet } from 'react-helmet-async'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEditor, type Editor } from '@tiptap/react'
import PantallaEdicion from '../PantallaEdicion'
import {
  catalogoDeEmails, crearPlantilla, guardarPlantilla, pruebaDePlantilla, traerPlantilla, usarPlantilla, vistaPreviaDePlantilla,
  type CatalogoDeEmails, type DatosPlantilla, type PlantillaDeCorreo, type UsoDeCorreo, type VistaPrevia,
} from '../../../lib/api/emails'
import { site } from '../../../config/site'
import { SIN_PROTECCION, extensionesDelCuerpo } from './editor/extensiones'
import { piezasAlEditor, piezasDelEditor } from './editor/piezas'
import { PIEZAS_NUEVAS, insertarCampo, insertarPieza } from './editor/acciones'
import HojaDelCorreo, { type Cabecera } from './editor/HojaDelCorreo'
import BarraDeFormato from './editor/BarraDeFormato'
import PanelPiezas from './editor/PanelPiezas'
import PanelDeLaPieza from './editor/PanelDeLaPieza'
import Repaso from './editor/Repaso'
import Revision from './editor/Revision'
import Versiones from './editor/Versiones'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)

/**
 * Crear o editar una plantilla de un correo. Una nueva parte del texto
 * original de ese correo.
 *
 * Se escribe sobre la propia carta (forma A de las maquetas del 19-10-2026):
 * a la izquierda, lo que se puede añadir y los datos que se rellenan solos; a
 * la derecha, la pieza elegida y el repaso. «Revisar» enseña el correo de
 * verdad, compuesto por el servidor, en la bandeja, el ordenador y el móvil.
 */
export default function EmailEditPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const nueva = id === undefined || id === 'nueva'
  const { data: catalogo } = useQuery({ queryKey: ['emails'], queryFn: catalogoDeEmails })
  const { data: guardada, error: errorCarga } = useQuery({ queryKey: ['emails', 'plantilla', id], queryFn: () => traerPlantilla(Number(id)), enabled: !nueva })

  const usoClave = nueva ? params.get('uso') ?? '' : guardada?.uso ?? ''
  const uso = catalogo?.usos.find((u) => u.clave === usoClave)

  if (errorCarga) return <Alert severity="error">{mensaje(errorCarga, 'No se ha podido cargar la plantilla.')}</Alert>
  if (catalogo && !uso) return <Alert severity="error">Ese correo no existe.</Alert>
  if (!catalogo || !uso || (!nueva && !guardada)) return <CircularProgress aria-label="Cargando la plantilla" />

  // Un correo que aún sale con el texto de la web: «Editar» abre ese texto, y la
  // plantilla se llama como el correo hasta que alguien le ponga otro nombre.
  const primera = nueva && !uso.libre && !uso.plantillas.some((p) => p.enUso)
  const inicial: DatosPlantilla = nueva
    ? { nombre: primera && uso.plantillas.length === 0 ? uso.nombre : '', uso: uso.clave, ...uso.original }
    : { nombre: guardada!.nombre, uso: guardada!.uso, asunto: guardada!.asunto, resumen: guardada!.resumen, titulo: guardada!.titulo, contenido: guardada!.contenido, despedida: guardada!.despedida }

  return <EditorDePlantilla key={id ?? 'nueva'} catalogo={catalogo} uso={uso} inicial={inicial} id={nueva ? null : Number(id)} enUso={Boolean(guardada?.enUso)} primera={primera} />
}

interface PropsEditor {
  catalogo: CatalogoDeEmails
  uso: UsoDeCorreo
  inicial: DatosPlantilla
  id: number | null
  enUso: boolean
  /**
   * Se está editando el texto de la web de un correo sin plantilla en uso: al
   * guardar, la plantilla pasa a usarse. Guardarla sin usarla dejaría el
   * correo igual, y quien pulsó «Editar» creería que lo ha cambiado.
   */
  primera: boolean
}

function EditorDePlantilla({ catalogo, uso, inicial, id, enUso, primera }: PropsEditor) {
  const navegar = useNavigate()
  const cliente = useQueryClient()
  const campos = useMemo(() => new Map([...catalogo.comunes, ...uso.campos].map((c) => [c.clave, c])), [catalogo, uso])
  const bloques = useMemo(() => new Map(uso.bloques.map((b) => [b.clave, b])), [uso])

  const [nombre, setNombre] = useState(inicial.nombre)
  const [cabecera, setCabecera] = useState<Cabecera>({ asunto: inicial.asunto, resumen: inicial.resumen, titulo: inicial.titulo, despedida: inicial.despedida })
  const [contenido, setContenido] = useState(inicial.contenido)
  // Con qué se compara para saber si hay cambios: lo cargado, ya pasado por el editor.
  const [referencia, setReferencia] = useState<string | null>(null)
  const [modo, setModo] = useState<'escribir' | 'revisar'>('escribir')
  const [movil, setMovil] = useState(false)
  const [previa, setPrevia] = useState<VistaPrevia | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [probando, setProbando] = useState(false)
  const [versiones, setVersiones] = useState(false)
  // El último sitio donde estuvo el cursor: ahí van los datos que se pulsan en el panel.
  const activo = useRef<Editor | null>(null)
  // Hasta que no se entra en el cuerpo, las piezas nuevas van al final.
  const cuerpoTocado = useRef(false)

  const firma = (n: string, c: Cabecera, piezas: PlantillaDeCorreo['contenido']) => JSON.stringify({ n, ...c, piezas })

  const editor = useEditor({
    extensions: extensionesDelCuerpo(campos, bloques),
    content: piezasAlEditor(inicial.contenido),
    editorProps: { attributes: { 'aria-label': 'Texto de la carta', role: 'textbox', 'aria-multiline': 'true', spellcheck: 'true' } },
    onCreate: ({ editor: e }) => {
      const piezas = piezasDelEditor(e.getJSON())
      setContenido(piezas)
      setReferencia(firma(inicial.nombre, { asunto: inicial.asunto, resumen: inicial.resumen, titulo: inicial.titulo, despedida: inicial.despedida }, piezas))
    },
    onUpdate: ({ editor: e }) => setContenido(piezasDelEditor(e.getJSON())),
    onFocus: ({ editor: e }) => { activo.current = e; cuerpoTocado.current = true },
  })

  const plantilla: PlantillaDeCorreo = useMemo(() => ({ ...cabecera, contenido }), [cabecera, contenido])

  // La vista previa (y el repaso), medio segundo después de dejar de escribir.
  useEffect(() => {
    let cancelado = false
    const reloj = window.setTimeout(() => {
      vistaPreviaDePlantilla(uso.clave, plantilla)
        .then((p) => { if (!cancelado) setPrevia(p) })
        .catch(() => { /* la vista previa es una ayuda: si falla, se queda la anterior */ })
    }, 500)
    return () => { cancelado = true; window.clearTimeout(reloj) }
  }, [plantilla, uso.clave])

  if (!editor) return <CircularProgress aria-label="Preparando el editor" />

  const sucio = referencia !== null && firma(nombre, cabecera, contenido) !== referencia
  const problemas = previa?.problemas ?? []
  const datos: DatosPlantilla = { nombre, uso: uso.clave, ...plantilla }

  /** Carga unas piezas en el editor, aunque quiten un bloque obligatorio (lo dirá el repaso). */
  const cargar = (p: PlantillaDeCorreo) => {
    setCabecera({ asunto: p.asunto, resumen: p.resumen, titulo: p.titulo, despedida: p.despedida })
    const doc = editor.schema.nodeFromJSON(piezasAlEditor(p.contenido))
    editor.view.dispatch(editor.state.tr.replaceWith(0, editor.state.doc.content.size, doc.content).setMeta(SIN_PROTECCION, true))
  }

  const guardar = async (yUsar = false) => {
    if (!nombre.trim()) { setError('Ponle un nombre a la plantilla: solo lo ves tú, para reconocerla.'); return }
    if (problemas.length) { setError(problemas.join(' ')); setModo('revisar'); return }
    setGuardando(true); setError(null)
    try {
      const p = id === null ? await crearPlantilla(datos) : await guardarPlantilla(id, datos)
      if (yUsar) await usarPlantilla(uso.clave, p.id)
      await cliente.invalidateQueries({ queryKey: ['emails'] })
      navegar('/cms/emails')
    } catch (err: unknown) {
      setError(mensaje(err, 'No se ha podido guardar la plantilla.'))
      setGuardando(false)
    }
  }

  const probar = async () => {
    setError(null); setAviso(null); setProbando(true)
    try { setAviso((await pruebaDePlantilla(uso.clave, plantilla)).message) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido mandar la prueba.')) }
    finally { setProbando(false) }
  }

  const titulo = primera ? 'Editar el correo' : id === null ? 'Nueva plantilla' : 'Editar plantilla'

  const extra = (
    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
      {id !== null && <Button onClick={() => setVersiones(true)} disabled={guardando}>Versiones</Button>}
      <Button onClick={() => void probar()} disabled={guardando || probando || problemas.length > 0}>{probando ? 'Mandando…' : 'Mandarme una prueba'}</Button>
      {!uso.libre && !enUso && !primera && <Button variant="outlined" onClick={() => void guardar(true)} disabled={guardando}>Guardar y usar</Button>}
    </Stack>
  )

  return <>
    <Helmet><title>{`${titulo} | CMS ${site.nombreCorto}`}</title><meta name="robots" content="noindex" /></Helmet>
    <PantallaEdicion
      titulo={titulo}
      nombre={uso.nombre}
      sucio={sucio}
      guardando={guardando}
      volverA="/cms/emails"
      onGuardar={() => guardar(primera)}
      onDescartar={() => { setNombre(inicial.nombre); cargar(inicial) }}
      anchoCompleto
      extra={extra}
    >
      <Stack spacing={2.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: { md: 'flex-start' }, justifyContent: 'space-between' }}>
          <Box sx={{ flex: '1 1 auto', maxWidth: 520 }}>
            <TextField
              label="Nombre de la plantilla" value={nombre} onChange={(e) => setNombre(e.target.value)} required size="small" fullWidth
              helperText="Solo lo ves tú, para reconocerla: «Bienvenida 2027», «Pésame breve»…" slotProps={{ htmlInput: { maxLength: 120 } }}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{uso.descripcion}</Typography>
          </Box>
          <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap', gap: 1.5 }}>
            <ToggleButtonGroup exclusive size="small" value={modo} onChange={(_, v) => { if (v) setModo(v) }} aria-label="Escribir o revisar">
              <ToggleButton value="escribir">Escribir</ToggleButton>
              <ToggleButton value="revisar">Revisar</ToggleButton>
            </ToggleButtonGroup>
            {modo === 'escribir' && (
              <ToggleButtonGroup exclusive size="small" value={movil ? 'movil' : 'ordenador'} onChange={(_, v) => { if (v) setMovil(v === 'movil') }} aria-label="Ver como">
                <ToggleButton value="ordenador">Ordenador</ToggleButton>
                <ToggleButton value="movil">Móvil</ToggleButton>
              </ToggleButtonGroup>
            )}
          </Stack>
        </Stack>

        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        {aviso && <Alert severity="success" onClose={() => setAviso(null)}>{aviso}</Alert>}

        {/* Los dos modos siguen montados: el editor no se pierde al ir a revisar y volver. */}
        <Box sx={{ display: modo === 'escribir' ? 'grid' : 'none', gap: 3, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '250px minmax(0, 1fr) 290px' }, alignItems: 'start' }}>
          <Box sx={{ order: { xs: 2, lg: 0 } }}>
            <PanelPiezas
              bloques={uso.bloques}
              campos={uso.campos}
              comunes={catalogo.comunes}
              contenido={contenido}
              onAnadir={(tipo) => { insertarPieza(editor, PIEZAS_NUEVAS[tipo], cuerpoTocado.current); cuerpoTocado.current = true }}
              onPonerBloque={(clave) => { insertarPieza(editor, { type: 'fijo', attrs: { clave } }, cuerpoTocado.current); cuerpoTocado.current = true }}
              onDato={(clave) => insertarCampo(activo.current ?? editor, clave)}
            />
          </Box>
          <Stack spacing={1.5} sx={{ minWidth: 0 }}>
            <BarraDeFormato editor={editor} />
            <HojaDelCorreo
              uso={uso}
              conCabecera={catalogo.conCabecera}
              cabecera={cabecera}
              onCabecera={(c) => setCabecera((antes) => ({ ...antes, ...c }))}
              cuerpo={editor}
              campos={campos}
              onActivarLinea={(e) => { activo.current = e }}
              movil={movil}
            />
          </Stack>
          <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: { lg: 16 }, order: { xs: 1, lg: 0 } }}>
            <Paper variant="outlined" sx={{ p: 2 }}><PanelDeLaPieza editor={editor} bloques={bloques} /></Paper>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}><Repaso previa={previa} asunto={cabecera.asunto} bloques={uso.bloques} /></Paper>
          </Stack>
        </Box>

        {modo === 'revisar' && <Revision previa={previa} asunto={cabecera.asunto} bloques={uso.bloques} firma={uso.firma} onProbar={() => void probar()} probando={probando} />}
      </Stack>
    </PantallaEdicion>

    {id !== null && (
      <Versiones id={id} abierto={versiones} onCerrar={() => setVersiones(false)} onElegir={(v) => { cargar(v); setVersiones(false); setAviso('Versión cargada. Guarda para quedarte con ella.') }} />
    )}
  </>
}
