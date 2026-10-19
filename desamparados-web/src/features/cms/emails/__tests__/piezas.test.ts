import { afterEach, describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/react'
import type { BloqueDeUso, CampoDeUso, Pieza } from '../../../../lib/api/emails'
import { SIN_PROTECCION, extensionesDelCuerpo } from '../editor/extensiones'
import { piezasAlEditor, piezasDelEditor, textoAlEditor, textoDelEditor } from '../editor/piezas'
import { bloqueActual, moverBloque } from '../editor/acciones'

const campos = new Map<string, CampoDeUso>([['nombre', { clave: 'nombre', etiqueta: 'Nombre', ayuda: 'El nombre de pila', ejemplo: 'Juan' }]])
const bloques = new Map<string, BloqueDeUso>([['papeleta', { clave: 'papeleta', ayuda: 'La papeleta', obligatorio: true }]])

let editor: Editor | null = null
const nuevo = (piezas: Pieza[]) => {
  editor = new Editor({ extensions: extensionesDelCuerpo(campos, bloques), content: piezasAlEditor(piezas) })
  return editor
}
afterEach(() => { editor?.destroy(); editor = null })

// Todas las piezas de la paleta, con formato, campos, saltos y enlaces.
const TODAS: Pieza[] = [
  { tipo: 'parrafo', trozos: [{ texto: 'Hola, ' }, { texto: '{{nombre}}', negrita: true }, { texto: ':\nsegunda línea, ' }, { texto: 'la agenda', cursiva: true, enlace: '/agenda' }] },
  { tipo: 'lista', elementos: [[{ texto: 'Uno' }], [{ texto: 'Dos {{nombre}}' }]] },
  { tipo: 'recuadro', titulo: 'Antes de salir', piezas: [{ tipo: 'parrafo', trozos: [{ texto: 'Puntualidad.' }] }, { tipo: 'lista', elementos: [[{ texto: 'Vela' }]] }] },
  { tipo: 'oracion', trozos: [{ texto: 'Dale, Señor, el descanso eterno.' }] },
  { tipo: 'boton', texto: 'Ver la agenda', enlace: '/agenda' },
  { tipo: 'foto', src: `/storage/public/${'a'.repeat(32)}.webp`, alt: 'El trono', pie: 'Salida de 2026' },
  { tipo: 'separador' },
  { tipo: 'fijo', clave: 'papeleta' },
]

describe('las piezas en el editor', () => {
  it('van y vuelven sin perder nada', () => {
    expect(piezasDelEditor(nuevo(TODAS).getJSON())).toEqual(TODAS)
  })

  it('las líneas guardan los campos como {{clave}} y no admiten saltos', () => {
    expect(textoDelEditor(textoAlEditor('Hola, {{nombre}}, bienvenido'))).toBe('Hola, {{nombre}}, bienvenido')
    expect(textoDelEditor(textoAlEditor('dos\nlíneas'))).toBe('dos líneas')
  })

  it('el párrafo vacío del final no es una pieza', () => {
    expect(piezasDelEditor(nuevo([{ tipo: 'separador' }, { tipo: 'parrafo', trozos: [] }]).getJSON())).toEqual([{ tipo: 'separador' }])
  })

  it('un bloque que no puede faltar no se quita, ni seleccionando todo; moverlo, sí', () => {
    const e = nuevo([{ tipo: 'parrafo', trozos: [{ texto: 'Su sitio:' }] }, { tipo: 'fijo', clave: 'papeleta' }])
    e.commands.clearContent()
    expect(piezasDelEditor(e.getJSON())).toContainEqual({ tipo: 'fijo', clave: 'papeleta' })

    e.commands.setNodeSelection(e.state.doc.child(0).nodeSize)
    moverBloque(e, bloqueActual(e)!, -1)
    expect(piezasDelEditor(e.getJSON())[0]).toEqual({ tipo: 'fijo', clave: 'papeleta' })

    // Volver a una versión sí puede quitarlo: lo dirá el repaso.
    e.view.dispatch(e.state.tr.delete(0, e.state.doc.content.size).setMeta(SIN_PROTECCION, true))
    expect(piezasDelEditor(e.getJSON())).toEqual([])
  })
})
