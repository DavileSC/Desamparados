import { useState } from 'react'
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
import { cancelarSolicitud, corregirFicha, inscribirEnMesa, type FichaDeMesa } from '../../../lib/api/mesa'
import type { Salida } from '../../../lib/api/salidas'
import DatosPersona from './DatosPersona'
import { leyenda, useDatosPersona } from './datosDeLaFicha'
import { AvisoSituacion, CampoPuesto, type Aviso } from './piezas'
import { alturaEnMetros, puestoDelCatalogo, euros } from './formato'
import { mensajeDeFallo, useClaveDeOperacion } from './enVivo'

interface Props {
  ficha: FichaDeMesa
  salida: Salida
  role: string
  puestosUsados: string[]
  onHecho: (aviso: Aviso) => void
  onRecargar: () => void
}

/**
 * Zona de Inscripción: a quien llega sin haber pedido la papeleta se le
 * confirman los datos y se le apunta con el puesto que pide (lo decide el
 * Grupo: se puede cambiar en Túnicas). No se cobra aquí: si debe algo, pasa
 * por Tesorería; si no, directo a Túnicas.
 */
export default function ZonaInscripcion({ ficha, salida, role, puestosUsados, onHecho, onRecargar }: Props) {
  const { datos, setDatos, correccion } = useDatosPersona(ficha)
  const [puesto, setPuesto] = useState(ficha.propuesta.puesto)
  const [altura, setAltura] = useState(alturaEnMetros(ficha.alturaHombro))
  const [donativo, setDonativo] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { clave, renovar } = useClaveDeOperacion()

  const conDonativo = salida.cobro === 'DONATIVO'
  const conAltura = puestoDelCatalogo(puesto, salida.puestos)?.alturaHombro || ficha.alturaHombro !== null || altura !== ''
  const importeDonativo = donativo.trim() ? Number(donativo.replace(',', '.')) : 0
  const donativoValido = Number.isFinite(importeDonativo) && importeDonativo >= 0 && importeDonativo <= 1000
  const deuda = ficha.requisitos.cuotasPendientes.reduce((s, c) => s + c.importe, 0)

  if (ficha.papeleta || ficha.solicitud) {
    return (
      <Alert severity="info">
        {ficha.papeleta
          ? `Ya recogió su papeleta: ${ficha.papeleta.puesto}.`
          : `Ya está apuntado como ${ficha.solicitud!.puesto}.`} Búscalo en el listado para corregirlo.
      </Alert>
    )
  }

  const apuntar = async () => {
    setEnviando(true); setError(null)
    try {
      const cambios = correccion()
      if (Object.keys(cambios).length > 0) await corregirFicha(ficha.id, cambios)
      const r = await inscribirEnMesa({
        hermanoId: ficha.id,
        salida: ficha.salida,
        puesto: puesto.trim(),
        clave,
        ...(observaciones.trim() && { observaciones: observaciones.trim() }),
        ...(altura.trim() && { alturaHombro: altura.trim() }),
        ...(conDonativo && { donativo: Math.round(importeDonativo * 100) / 100 }),
      })
      renovar()
      const quien = `${datos.nombre.trim()} ${datos.primerApellido.trim()}`
      // Si no era él (un clic de más), se deshace ahí mismo.
      const deshacer = async (): Promise<Aviso> => {
        await cancelarSolicitud(r.solicitudId)
        return { tono: 'info', texto: `Deshecho: ${quien} ya no está apuntado.` }
      }
      onHecho(r.requisitos.puedeRecoger
        ? { tono: 'success', texto: `${quien}, apuntado como ${r.puesto}. Que pase a Túnicas.`, deshacer }
        : { tono: 'warning', texto: `${quien}, apuntado como ${r.puesto}. Que pase a Tesorería: tiene ${euros(r.requisitos.totalPendiente)} por pagar.`, deshacer })
    } catch (e) {
      setError(mensajeDeFallo(e, 'No se ha podido apuntar.'))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Stack spacing={2.25} component="form" onSubmit={(e) => { e.preventDefault(); void apuntar() }}>
      <AvisoSituacion ficha={ficha} role={role} onRecargar={onRecargar} />
      {ficha.anterior && (
        <Typography variant="body2" color="text.secondary">En {ficha.anterior.year} salió de {ficha.anterior.puesto}.</Typography>
      )}

      <DatosPersona datos={datos} onCambiar={setDatos} />

      <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, display: 'grid', gap: 1.5 }}>
        <Typography component="legend" sx={leyenda}>{salida.nombre}</Typography>
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: conAltura ? 'minmax(0, 2fr) minmax(0, 1fr)' : '1fr' }}>
          <CampoPuesto valor={puesto} onCambiar={setPuesto} puestos={salida.puestos} usados={puestosUsados} />
          {conAltura && (
            <TextField size="small" label="Talla (hombro)" placeholder="1,45" value={altura} onChange={(e) => setAltura(e.target.value)} slotProps={{ htmlInput: { inputMode: 'decimal' } }} helperText="En metros" />
          )}
        </Box>
        {conDonativo && (
          <TextField
            size="small" label="Donativo (la voluntad)" placeholder="0" value={donativo} onChange={(e) => setDonativo(e.target.value)}
            error={!donativoValido} helperText={donativoValido ? 'En euros. Puede ser 0; se cobra en Tesorería.' : 'Un importe entre 0 y 1000 €'}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
        )}
        <TextField size="small" label="Observaciones" value={observaciones} onChange={(e) => setObservaciones(e.target.value)} multiline minRows={1} maxRows={4} />
      </Box>

      {deuda > 0 && (
        <Alert severity="warning" icon={false}>
          Debe {ficha.requisitos.cuotasPendientes.length === 1 ? `la cuota de ${ficha.requisitos.cuotasPendientes[0].year}` : `${ficha.requisitos.cuotasPendientes.length} cuotas`} ({euros(deuda)}): después de apuntarlo, que pase por Tesorería.
        </Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      <Button type="submit" variant="contained" size="large" disabled={enviando || ficha.situacion !== 'activo' || !puesto.trim() || !donativoValido}>
        {enviando ? 'Apuntando…' : 'Apuntar'}
      </Button>
    </Stack>
  )
}
