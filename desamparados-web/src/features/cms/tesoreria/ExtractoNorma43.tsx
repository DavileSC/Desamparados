import { useState } from 'react'
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { aplicarNorma43, previaNorma43, type PreviaNorma43 } from '../../../lib/api/tesoreria'
import VentanaFormulario from '../VentanaFormulario'
import { euros } from '../contabilidad/formato'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const dia = (texto: string) => `${Number(texto.slice(8, 10))} ${MESES[Number(texto.slice(5, 7)) - 1]} ${texto.slice(0, 4)}`
const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
const plural = (n: number, uno: string, varios: string) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`)

interface Props {
  abierto: boolean
  onCerrar: () => void
  /** Se aplicó: la lista de remesas tiene que recargarse. */
  onAplicado: (mensaje: string) => void
}

/**
 * Subir el extracto del banco (Norma 43, el que se descarga de la banca en
 * línea) y ver qué hará antes de hacerlo: qué recibos se marcan como
 * devueltos, qué remesas se dan por cobradas y qué movimientos hay que mirar
 * a mano. Los que no son de ninguna remesa ni se enseñan.
 */
export default function ExtractoNorma43({ abierto, onCerrar, onAplicado }: Props) {
  const [fichero, setFichero] = useState<File | null>(null)
  const [previa, setPrevia] = useState<PreviaNorma43 | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Se limpia al abrir, no al cerrar: así no parpadea mientras se va.
  const [abiertoAntes, setAbiertoAntes] = useState(abierto)
  if (abierto !== abiertoAntes) {
    setAbiertoAntes(abierto)
    if (abierto) { setFichero(null); setPrevia(null); setError(null) }
  }

  const elegir = async (elegido: File | null) => {
    setFichero(elegido); setPrevia(null); setError(null)
    if (!elegido) return
    setLeyendo(true)
    try { setPrevia(await previaNorma43(elegido)) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido leer el extracto.')) }
    finally { setLeyendo(false) }
  }

  const aplicar = async () => {
    if (!fichero) return
    setAplicando(true); setError(null)
    try {
      const r = await aplicarNorma43(fichero)
      onAplicado(`${r.message}${r.omitidos.length ? ` Sin aplicar: ${r.omitidos.join(' ')}` : ''}`)
    } catch (err: unknown) { setError(mensaje(err, 'No se ha podido aplicar el extracto.')) }
    finally { setAplicando(false) }
  }

  const devoluciones = previa?.devoluciones.filter((d) => !d.yaAplicado) ?? []
  const cobros = previa?.cobros.filter((c) => !c.yaAplicado) ?? []
  const yaAplicados = (previa?.devoluciones.length ?? 0) - devoluciones.length + (previa?.cobros.length ?? 0) - cobros.length
  const hayQueHacer = devoluciones.length + cobros.length > 0

  return (
    <VentanaFormulario
      abierto={abierto}
      titulo="Extracto del banco"
      textoGuardar="Aplicar"
      sucio={false}
      guardando={aplicando}
      puedeGuardar={Boolean(previa) && previa!.errores.length === 0 && hayQueHacer && !leyendo}
      error={error}
      ancho="md"
      onGuardar={aplicar}
      onCerrar={onCerrar}
    >
      <Typography variant="body2" color="text.secondary">
        Descarga de la banca en línea los movimientos de la cuenta en formato Norma 43 (también lo llaman «AEB 43» o «CSB 43»).
        Se marcan como devueltos los recibos que el banco devolvió y se dan por cobradas las remesas que abonó.
      </Typography>
      <Box>
        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
          {fichero ? 'Elegir otro fichero' : 'Elegir fichero'}
          <input type="file" hidden accept=".n43,.aeb,.csb,.txt,.dat,text/plain" aria-label="Fichero del extracto" onChange={(e) => void elegir(e.target.files?.[0] ?? null)} />
        </Button>
        {fichero && <Typography variant="body2" sx={{ mt: 1 }}>{fichero.name}</Typography>}
      </Box>

      {leyendo && <CircularProgress size={24} aria-label="Leyendo el extracto" />}
      {previa && previa.errores.length > 0 && (
        <Alert severity="error">
          Este fichero no se puede aplicar:
          <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>{previa.errores.map((e) => <li key={e}>{e}</li>)}</Box>
        </Alert>
      )}
      {previa && previa.errores.length === 0 && <>
        <Typography variant="body2">
          {previa.cuentas.map((c) => `Cuenta ${c.cuenta}, del ${dia(c.desde)} al ${dia(c.hasta)}: ${plural(c.movimientos, 'movimiento', 'movimientos')}.`).join(' ')}
        </Typography>
        {!hayQueHacer && (
          <Alert severity="info">
            {yaAplicados > 0 ? 'Todo lo de este extracto ya estaba aplicado.' : 'En este extracto no hay devoluciones ni cobros de remesas.'}
          </Alert>
        )}
        {devoluciones.length > 0 && (
          <Box>
            <Typography variant="subtitle2">{plural(devoluciones.length, 'recibo devuelto', 'recibos devueltos')}</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {devoluciones.map((d) => (
                <Typography component="li" variant="body2" key={d.reciboId}>
                  {d.hermano.apellidos}, {d.hermano.nombre} · {d.concepto} · {euros(d.importe)} · el {dia(d.fecha)}
                  {d.estado === 'PAGADO' ? ' (ya estaba cobrado: se apunta el reverso en Contabilidad)' : ''}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
        {cobros.length > 0 && (
          <Box>
            <Typography variant="subtitle2">{plural(cobros.length, 'remesa cobrada', 'remesas cobradas')}</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              {cobros.map((c) => (
                <Typography component="li" variant="body2" key={c.remesaId}>
                  {c.mensajeId} · {euros(c.importe)} · abonada el {dia(c.fecha)}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
        {previa.dudosos.length > 0 && (
          <Alert severity="warning">
            {plural(previa.dudosos.length, 'movimiento parece', 'movimientos parecen')} de una remesa, pero no se sabe de qué recibo. No se tocan: míralos a mano.
            <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
              {previa.dudosos.map((d) => (
                <li key={d.linea}>{dia(d.fecha)} · {d.signo === 'CARGO' ? '−' : '+'}{euros(d.importe)} · {d.texto || 'sin concepto'} · {d.motivo}</li>
              ))}
            </Box>
          </Alert>
        )}
      </>}
    </VentanaFormulario>
  )
}
