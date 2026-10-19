import type { Editor, JSONContent } from '@tiptap/react'
import { NodeSelection, TextSelection } from '@tiptap/pm/state'
import type { Node as NodoPm } from '@tiptap/pm/model'

/**
 * Lo que se hace con las piezas desde fuera del texto: los paneles de los
 * lados y sus botones. Todo trabaja sobre la pieza de primer nivel donde está
 * el cursor (un párrafo dentro de un recuadro es el recuadro).
 */

export interface BloqueActual { nodo: NodoPm; pos: number; indice: number }

export type TipoDePieza = 'texto' | 'lista' | 'recuadro' | 'oracion' | 'boton' | 'foto' | 'separador'

/** Lo que mete cada botón de «Añadir». */
export const PIEZAS_NUEVAS: Record<TipoDePieza, JSONContent> = {
  texto: { type: 'paragraph' },
  lista: { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }] },
  recuadro: { type: 'recuadro', attrs: { titulo: '' }, content: [{ type: 'paragraph' }] },
  oracion: { type: 'oracion' },
  boton: { type: 'boton', attrs: { texto: '', enlace: '/area-hermano' } },
  foto: { type: 'foto', attrs: { src: '', alt: '', pie: '' } },
  separador: { type: 'separador' },
}

/** La pieza de primer nivel donde está el cursor, o la elegida con un clic. */
export function bloqueActual(editor: Editor): BloqueActual | null {
  const { selection, doc } = editor.state
  if (selection instanceof NodeSelection && selection.$from.depth === 0) {
    return { nodo: selection.node, pos: selection.from, indice: selection.$from.index(0) }
  }
  const { $from } = selection
  if ($from.depth < 1) return null
  const indice = $from.index(0)
  return { nodo: doc.child(indice), pos: $from.before(1), indice }
}

/** Pone el cursor en la pieza que empieza en `pos`: la elige si es un átomo, o entra en su texto. */
function irA(editor: Editor, pos: number) {
  const { state, view } = editor
  const nodo = state.doc.nodeAt(pos)
  if (!nodo) return
  const sel = nodo.isAtom ? NodeSelection.create(state.doc, pos) : TextSelection.near(state.doc.resolve(pos + 1))
  view.dispatch(state.tr.setSelection(sel).scrollIntoView())
  view.focus()
}

/**
 * Mete una pieza detrás de la actual, o al final si aún no se ha entrado en
 * el cuerpo (el cursor de partida está en la primera pieza, y ahí no lo ha
 * puesto nadie).
 */
export function insertarPieza(editor: Editor, pieza: JSONContent, dondeElCursor: boolean) {
  const { doc } = editor.state
  const ultimo = doc.lastChild
  const actual = dondeElCursor
    ? bloqueActual(editor)
    : ultimo ? { nodo: ultimo, pos: doc.content.size - ultimo.nodeSize, indice: doc.childCount - 1 } : null
  // Un párrafo vacío donde está el cursor se sustituye: es el hueco donde se quería poner.
  const vacio = actual && actual.nodo.type.name === 'paragraph' && actual.nodo.content.size === 0
  const pos = actual ? (vacio ? actual.pos : actual.pos + actual.nodo.nodeSize) : doc.content.size
  const tr = editor.state.tr
  if (vacio) tr.delete(actual.pos, actual.pos + actual.nodo.nodeSize)
  tr.insert(pos, editor.schema.nodeFromJSON(pieza))
  editor.view.dispatch(tr)
  irA(editor, pos)
}

/** Mete un dato (la pastilla) donde está el cursor de ese editor. */
export function insertarCampo(editor: Editor, clave: string) {
  editor.chain().focus().insertContent({ type: 'campo', attrs: { clave } }).insertContent(' ').run()
}

/** Sube o baja una pieza un puesto. */
export function moverBloque(editor: Editor, b: BloqueActual, sentido: -1 | 1) {
  const { doc } = editor.state
  const otro = b.indice + sentido
  if (otro < 0 || otro >= doc.childCount) return
  const vecino = doc.child(otro)
  const tr = editor.state.tr.delete(b.pos, b.pos + b.nodo.nodeSize)
  const destino = sentido === -1 ? b.pos - vecino.nodeSize : b.pos + vecino.nodeSize
  tr.insert(destino, b.nodo)
  editor.view.dispatch(tr)
  irA(editor, destino)
}

/** Quita la pieza. La protección del editor no deja quitar un bloque obligatorio. */
export function quitarBloque(editor: Editor, b: BloqueActual) {
  editor.view.dispatch(editor.state.tr.delete(b.pos, b.pos + b.nodo.nodeSize))
  editor.view.focus()
}

/** Cambia los datos de un átomo (el texto de un botón, la foto…). */
export function cambiarAtributos(editor: Editor, b: BloqueActual, atributos: Record<string, unknown>) {
  const tr = editor.state.tr.setNodeMarkup(b.pos, undefined, { ...b.nodo.attrs, ...atributos })
  // La pieza sigue elegida: el panel de la derecha no se cierra a cada letra.
  tr.setSelection(NodeSelection.create(tr.doc, b.pos))
  editor.view.dispatch(tr)
}

/** Pasa un texto a lista u oración, y vuelta. */
export function convertirTexto(editor: Editor, a: 'texto' | 'lista' | 'oracion') {
  const cadena = editor.chain().focus()
  if (editor.isActive('bulletList') && a !== 'lista') cadena.liftListItem('listItem')
  if (a === 'lista') { if (!editor.isActive('bulletList')) cadena.setParagraph().toggleBulletList() }
  else if (a === 'oracion') cadena.setNode('oracion')
  else cadena.setParagraph()
  cadena.run()
}
