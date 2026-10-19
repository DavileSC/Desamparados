import type { JSONContent } from '@tiptap/react'
import type { Linea, Pieza, PiezaDeTexto, Trozo } from '../../../../lib/api/emails'

/**
 * Del documento del editor (tiptap) a las piezas que guarda el servidor, y
 * vuelta. El editor es una forma de escribir; lo que vale es la pieza: si el
 * documento trae algo que no es de la paleta (un pegado raro), se queda en
 * texto o se descarta, nunca viaja tal cual.
 *
 * Un campo es un nodo propio en el editor (la pastilla) y `{{clave}}` dentro
 * del texto de la pieza.
 */

const CAMPO = /(\{\{\s*[a-z_]+\s*\}\}|\n)/

// ------------------------------------------------------------ del texto al editor

type Marca = { type: string; attrs?: Record<string, unknown> }

function marcasDe(t: Trozo): Marca[] | undefined {
  const marcas: Marca[] = []
  if (t.negrita) marcas.push({ type: 'bold' })
  if (t.cursiva) marcas.push({ type: 'italic' })
  if (t.enlace) marcas.push({ type: 'link', attrs: { href: t.enlace } })
  return marcas.length ? marcas : undefined
}

/** Un texto con campos y saltos, en nodos del editor con las marcas dadas. */
function nodosDeTexto(texto: string, marcas?: Marca[]): JSONContent[] {
  return texto.split(CAMPO).filter((parte) => parte !== '').map((parte): JSONContent => {
    if (parte === '\n') return { type: 'hardBreak' }
    const campo = /^\{\{\s*([a-z_]+)\s*\}\}$/.exec(parte)
    if (campo) return { type: 'campo', attrs: { clave: campo[1] }, ...(marcas ? { marks: marcas } : {}) }
    return { type: 'text', text: parte, ...(marcas ? { marks: marcas } : {}) }
  })
}

const lineaAlEditor = (l: Linea): JSONContent[] => l.flatMap((t) => nodosDeTexto(t.texto, marcasDe(t)))
const parrafo = (l: Linea): JSONContent => {
  const content = lineaAlEditor(l)
  return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
}

/** Un texto de una línea (asunto, título…) en nodos del editor, sin formato. */
export const textoAlEditor = (texto: string): JSONContent => ({
  type: 'doc',
  content: [texto ? { type: 'paragraph', content: nodosDeTexto(texto.replace(/\n/g, ' ')) } : { type: 'paragraph' }],
})

function piezaDeTextoAlEditor(x: PiezaDeTexto): JSONContent {
  return x.tipo === 'parrafo'
    ? parrafo(x.trozos)
    : { type: 'bulletList', content: (x.elementos.length ? x.elementos : [[]]).map((e) => ({ type: 'listItem', content: [parrafo(e)] })) }
}

/** Las piezas de una plantilla, en el documento del editor. */
export function piezasAlEditor(piezas: Pieza[]): JSONContent {
  const content = piezas.map((x): JSONContent => {
    switch (x.tipo) {
      case 'parrafo': case 'lista': return piezaDeTextoAlEditor(x)
      case 'recuadro': return { type: 'recuadro', attrs: { titulo: x.titulo }, content: (x.piezas.length ? x.piezas : [{ tipo: 'parrafo', trozos: [] } as PiezaDeTexto]).map(piezaDeTextoAlEditor) }
      case 'oracion': {
        const dentro = lineaAlEditor(x.trozos)
        return dentro.length ? { type: 'oracion', content: dentro } : { type: 'oracion' }
      }
      case 'boton': return { type: 'boton', attrs: { texto: x.texto, enlace: x.enlace } }
      case 'foto': return { type: 'foto', attrs: { src: x.src, alt: x.alt, pie: x.pie } }
      case 'separador': return { type: 'separador' }
      case 'fijo': return { type: 'fijo', attrs: { clave: x.clave } }
    }
  })
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

// ------------------------------------------------------------ del editor al texto

const formato = (t: Trozo) => `${t.negrita ? 'n' : ''}${t.cursiva ? 'c' : ''}|${t.enlace ?? ''}`

/** Los nodos de una línea en trozos, juntando los seguidos que llevan el mismo formato. */
function lineaDelEditor(nodos: JSONContent[] = []): Linea {
  const linea: Linea = []
  for (const n of nodos) {
    const marcas = n.marks ?? []
    const enlace = marcas.find((m) => m.type === 'link')?.attrs?.href
    const base: Omit<Trozo, 'texto'> = {
      ...(marcas.some((m) => m.type === 'bold') ? { negrita: true } : {}),
      ...(marcas.some((m) => m.type === 'italic') ? { cursiva: true } : {}),
      ...(typeof enlace === 'string' && enlace ? { enlace } : {}),
    }
    let texto: string
    if (n.type === 'text') texto = n.text ?? ''
    else if (n.type === 'campo') texto = `{{${String(n.attrs?.clave ?? '')}}}`
    else if (n.type === 'hardBreak') texto = '\n'
    else continue
    const trozo: Trozo = { texto, ...base }
    const anterior = linea.at(-1)
    // Un salto no rompe el trozo: va con el formato del texto de antes.
    if (anterior && (formato(anterior) === formato(trozo) || texto === '\n')) anterior.texto += texto
    else linea.push(trozo)
  }
  return linea
}

/** Un texto de una línea (asunto, título…) del editor, con sus campos como `{{clave}}`. */
export function textoDelEditor(doc: JSONContent): string {
  return (doc.content ?? []).map((p) => lineaDelEditor(p.content).map((t) => t.texto).join('')).join(' ').replace(/\n/g, ' ')
}

function piezaDeTextoDelEditor(n: JSONContent): PiezaDeTexto | null {
  if (n.type === 'paragraph') return { tipo: 'parrafo', trozos: lineaDelEditor(n.content) }
  if (n.type === 'bulletList' || n.type === 'orderedList') {
    // Cada elemento de la lista es una línea: lo que se anide dentro se aplana.
    const elementos = (n.content ?? []).map((li) => (li.content ?? []).flatMap((p) => (p.type === 'paragraph' ? [lineaDelEditor(p.content)] : [])).reduce<Linea>((a, l) => (a.length && l.length ? [...a, { texto: '\n' }, ...l] : [...a, ...l]), []))
    return { tipo: 'lista', elementos }
  }
  return null
}

/** El documento del editor, en piezas. Lo que no es de la paleta se descarta. */
export function piezasDelEditor(doc: JSONContent): Pieza[] {
  const piezas: Pieza[] = []
  for (const n of doc.content ?? []) {
    const deTexto = piezaDeTextoDelEditor(n)
    if (deTexto) { piezas.push(deTexto); continue }
    const a = n.attrs ?? {}
    const cadena = (v: unknown) => (typeof v === 'string' ? v : '')
    switch (n.type) {
      case 'recuadro':
        piezas.push({ tipo: 'recuadro', titulo: cadena(a.titulo), piezas: (n.content ?? []).flatMap((x) => piezaDeTextoDelEditor(x) ?? []) })
        break
      case 'oracion': piezas.push({ tipo: 'oracion', trozos: lineaDelEditor(n.content) }); break
      case 'boton': piezas.push({ tipo: 'boton', texto: cadena(a.texto), enlace: cadena(a.enlace) }); break
      case 'foto': piezas.push({ tipo: 'foto', src: cadena(a.src), alt: cadena(a.alt), pie: cadena(a.pie) }); break
      case 'separador': piezas.push({ tipo: 'separador' }); break
      case 'fijo': piezas.push({ tipo: 'fijo', clave: cadena(a.clave) }); break
    }
  }
  // El párrafo vacío del final (donde queda el cursor al escribir) no es una pieza.
  while (piezas.length && piezas.at(-1)!.tipo === 'parrafo' && !(piezas.at(-1) as { trozos: Linea }).trozos.some((t) => t.texto.trim())) piezas.pop()
  return piezas
}
