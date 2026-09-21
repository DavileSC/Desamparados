import type { useBlocker } from 'react-router-dom'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'

/**
 * El aviso de salir de una ficha con cambios sin guardar, que es el mismo en
 * todas: solo cambia de qué se está hablando («esta noticia», «este evento»).
 *
 * Lo tenían copiado las tres fichas con su texto escrito entero, y basta con
 * que una se quede sin `peligro` o sin `Seguir editando` para que salir del
 * CMS signifique una cosa distinta según en qué pantalla estés.
 */
export default function AvisoCambiosSinGuardar({ bloqueo, deQue }: {
  bloqueo: ReturnType<typeof useBlocker>
  /** Cómo se nombra lo que se está editando: «esta noticia», «este evento». */
  deQue: string
}) {
  return (
    <DialogoConfirmacion
      abierto={bloqueo.state === 'blocked'}
      titulo="Hay cambios sin guardar"
      mensaje={`Si sales ahora se van a perder los cambios que has hecho en ${deQue}.`}
      textoConfirmar="Salir sin guardar"
      textoCancelar="Seguir editando"
      peligro
      onConfirmar={() => bloqueo.proceed?.()}
      onCancelar={() => bloqueo.reset?.()}
    />
  )
}
