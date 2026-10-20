import { Extension, Node, ReactNodeViewRenderer, mergeAttributes } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as NodoPm } from '@tiptap/pm/model'
import type { BloqueDeUso, CampoDeUso } from '../../../../lib/api/emails'
import { VistaBoton, VistaCampo, VistaFijo, VistaFoto, VistaRecuadro, VistaSeparador } from './vistas'

/**
 * Las piezas del correo dentro del editor. Cada nodo de aquí es una pieza de
 * la paleta (piezas.ts las traduce a lo que guarda el servidor) y se pinta
 * como saldrá en el correo (vistas.tsx).
 *
 * Los que no se escriben (botón, foto, separador, bloques de la web) son
 * átomos: se eligen con un clic y se ajustan en el panel de la derecha.
 */

export interface OpcionesDeCampos { campos: Map<string, CampoDeUso> }
export interface OpcionesDeBloques { bloques: Map<string, BloqueDeUso> }

// ------------------------------------------------------------ el campo (la pastilla)

export const Campo = Node.create<OpcionesDeCampos>({
  name: 'campo',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addOptions: () => ({ campos: new Map() }),
  addAttributes: () => ({ clave: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-campo]', getAttrs: (el) => ({ clave: (el as HTMLElement).dataset.campo }) }],
  renderHTML: ({ node, HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-campo': node.attrs.clave }), `{{${node.attrs.clave}}}`],
  renderText: ({ node }) => `{{${node.attrs.clave}}}`,
  addNodeView() { return ReactNodeViewRenderer(VistaCampo, { as: 'span' }) },
})

// ------------------------------------------------------------ el recuadro

export const Recuadro = Node.create({
  name: 'recuadro',
  group: 'block',
  content: '(paragraph|bulletList)+',
  defining: true,
  addAttributes: () => ({ titulo: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-recuadro]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-recuadro': '' }), 0],
  addNodeView() { return ReactNodeViewRenderer(VistaRecuadro) },
})

// ------------------------------------------------------------ la oración

export const Oracion = Node.create({
  name: 'oracion',
  group: 'block',
  content: 'inline*',
  // La regla, por encima de la del párrafo (50): un <p data-oracion> pegado es
  // una oración. No el nodo entero: el primero del esquema es el que se pone
  // cuando el documento se queda vacío, y tiene que ser el párrafo.
  parseHTML: () => [{ tag: 'p[data-oracion]', priority: 60 }],
  renderHTML: ({ HTMLAttributes }) => ['p', mergeAttributes(HTMLAttributes, { 'data-oracion': '' }), 0],
})

// ------------------------------------------------------------ los átomos: botón, foto, separador y bloques de la web

export const Boton = Node.create({
  name: 'boton',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({ texto: { default: '' }, enlace: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-boton]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-boton': '' })],
  addNodeView() { return ReactNodeViewRenderer(VistaBoton) },
})

export const Foto = Node.create({
  name: 'foto',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({ src: { default: '' }, alt: { default: '' }, pie: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-foto]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-foto': '' })],
  addNodeView() { return ReactNodeViewRenderer(VistaFoto) },
})

export const Separador = Node.create({
  name: 'separador',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  parseHTML: () => [{ tag: 'div[data-separador]' }],
  renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-separador': '' })],
  addNodeView() { return ReactNodeViewRenderer(VistaSeparador) },
})

export const Fijo = Node.create<OpcionesDeBloques>({
  name: 'fijo',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addOptions: () => ({ bloques: new Map() }),
  addAttributes: () => ({ clave: { default: '' } }),
  parseHTML: () => [{ tag: 'div[data-fijo]', getAttrs: (el) => ({ clave: (el as HTMLElement).dataset.fijo }) }],
  renderHTML: ({ node, HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-fijo': node.attrs.clave })],
  addNodeView() { return ReactNodeViewRenderer(VistaFijo) },
})

// ------------------------------------------------------------ que no se quite lo que no puede faltar

/** Cuántas veces está cada bloque obligatorio en el documento. */
function obligatoriosEn(doc: NodoPm, obligatorios: Set<string>) {
  const cuenta = new Map<string, number>()
  doc.forEach((n) => { if (n.type.name === 'fijo' && obligatorios.has(n.attrs.clave)) cuenta.set(n.attrs.clave, (cuenta.get(n.attrs.clave) ?? 0) + 1) })
  return cuenta
}

/** Para cambiar el documento entero sin pasar por la protección (volver a una versión). */
export const SIN_PROTECCION = 'sinProteccion'

/**
 * Un bloque obligatorio (la tabla de recibos en el aviso del cargo) no se puede
 * borrar: ni con la tecla de borrar, ni seleccionando todo, ni cortando. Moverlo
 * sí, porque mover es quitar y poner en el mismo paso.
 */
export const ProteccionDeObligatorios = Extension.create<{ obligatorios: Set<string> }>({
  name: 'proteccionDeObligatorios',
  addOptions: () => ({ obligatorios: new Set() }),
  addProseMirrorPlugins() {
    const { obligatorios } = this.options
    return [new Plugin({
      key: new PluginKey('proteccionDeObligatorios'),
      filterTransaction: (tr, estado) => {
        if (!tr.docChanged || tr.getMeta(SIN_PROTECCION) || obligatorios.size === 0) return true
        const antes = obligatoriosEn(estado.doc, obligatorios)
        const despues = obligatoriosEn(tr.doc, obligatorios)
        return [...antes].every(([clave, veces]) => (despues.get(clave) ?? 0) >= veces)
      },
    })]
  },
})

// ------------------------------------------------------------ los juegos de extensiones

/** El cuerpo del correo: la paleta cerrada, sin títulos, citas ni código. */
export function extensionesDelCuerpo(campos: Map<string, CampoDeUso>, bloques: Map<string, BloqueDeUso>) {
  return [
    StarterKit.configure({
      heading: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false,
      orderedList: false, strike: false, underline: false,
      link: { openOnClick: false, autolink: false, linkOnPaste: false, HTMLAttributes: { rel: null, target: null } },
      // Cada elemento de la lista es una línea: sin listas dentro de listas.
      listItem: { HTMLAttributes: {} },
    }),
    Campo.configure({ campos }),
    Recuadro, Oracion, Boton, Foto, Separador,
    Fijo.configure({ bloques }),
    ProteccionDeObligatorios.configure({ obligatorios: new Set([...bloques.values()].filter((b) => b.obligatorio).map((b) => b.clave)) }),
  ]
}

/**
 * Una línea (asunto, título, despedida…): un solo párrafo de texto con
 * campos, sin formato ni saltos.
 */
export function extensionesDeLinea(campos: Map<string, CampoDeUso>) {
  const UnaLinea = Extension.create({
    name: 'unaLinea',
    addKeyboardShortcuts: () => ({ Enter: () => true, 'Shift-Enter': () => true, 'Mod-Enter': () => true }),
  })
  return [
    StarterKit.configure({
      heading: false, blockquote: false, codeBlock: false, code: false, horizontalRule: false, bulletList: false,
      orderedList: false, listItem: false, listKeymap: false, strike: false, underline: false, link: false,
      bold: false, italic: false, hardBreak: false, dropcursor: false, gapcursor: false, trailingNode: false,
    }),
    Campo.configure({ campos }),
    UnaLinea,
  ]
}
