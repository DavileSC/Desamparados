import { useState } from 'react'
import { Button } from '@mui/material'
import DialogoConfirmacion from '../../../components/DialogoConfirmacion'
import { cancelarSolicitud, type FichaDeMesa } from '../../../lib/api/mesa'
import type { Aviso } from './piezas'
import { mensajeDeFallo } from './enVivo'

interface Props {
  ficha: FichaDeMesa
  onHecho: (aviso: Aviso) => void
}

/**
 * Cancelar la inscripción de quien está apuntado y aún no ha recogido, desde
 * cualquier zona: si se apuntó a quien no era, se ve en el puesto donde se
 * nota y se arregla ahí, sin ir al listado. Si pagó algo, se le devuelve.
 */
export default function CancelarInscripcion({ ficha, onHecho }: Props) {
  const [preguntando, setPreguntando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const solicitud = ficha.solicitud
  if (!solicitud || ficha.papeleta) return null

  const cancelar = async () => {
    setPreguntando(false)
    setEnviando(true)
    try {
      const r = await cancelarSolicitud(solicitud.id)
      onHecho({ tono: 'info', texto: `${ficha.nombre} ${ficha.primerApellido ?? ''}: ${r.message}` })
    } catch (e) {
      onHecho({ tono: 'warning', texto: mensajeDeFallo(e, 'No se ha podido cancelar la inscripción.') })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <Button size="small" color="error" onClick={() => setPreguntando(true)} disabled={enviando} sx={{ alignSelf: 'start' }}>
        Cancelar la inscripción
      </Button>
      <DialogoConfirmacion
        abierto={preguntando}
        titulo="¿Cancelar la inscripción?"
        mensaje={`${ficha.nombre} ${ficha.apellidos} deja de estar apuntado. Si pagó algo de la salida, se le devuelve con su apunte en contabilidad.`}
        textoConfirmar="Cancelar la inscripción"
        textoCancelar="Volver"
        peligro
        onConfirmar={() => void cancelar()}
        onCancelar={() => setPreguntando(false)}
      />
    </>
  )
}
