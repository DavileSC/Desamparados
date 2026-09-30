import { useState } from 'react'
import { Alert, Box, Button, CircularProgress, ListItemText, Menu, MenuItem, Stack, Typography } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { exportarCenso, importarCenso, previaImportacionCenso, type PreviaImportacionCenso } from '../../../lib/api/hermanos'
import { guardarEnDisco } from '../../../lib/api/datos'
import VentanaFormulario from '../VentanaFormulario'

const mensaje = (err: unknown, porDefecto: string) => (err instanceof Error ? err.message : porDefecto)
const plural = (n: number, uno: string, varios: string) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`)

const EXPORTACIONES = [
  { formato: 'xlsx', bajas: false, texto: 'Excel · solo activos' },
  { formato: 'xlsx', bajas: true, texto: 'Excel · con las bajas' },
  { formato: 'csv', bajas: false, texto: 'CSV · solo activos' },
  { formato: 'csv', bajas: true, texto: 'CSV · con las bajas' },
] as const

interface Props {
  /** Se importó algo: el censo tiene que recargarse. */
  onImportado: (mensaje: string) => void
  onError: (mensaje: string) => void
}

/**
 * Sacar el censo a Excel o CSV y traer el de otra parte (el Excel de siempre
 * de una corporación que empieza con el programa). Importar enseña antes qué
 * filas entran y por qué no entran las otras.
 */
export default function HojaCenso({ onImportado, onError }: Props) {
  const [menu, setMenu] = useState<HTMLElement | null>(null)
  const [exportando, setExportando] = useState(false)
  const [abierta, setAbierta] = useState(false)
  const [fichero, setFichero] = useState<File | null>(null)
  const [previa, setPrevia] = useState<PreviaImportacionCenso | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [importando, setImportando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exportar = async (formato: 'xlsx' | 'csv', bajas: boolean) => {
    setMenu(null); setExportando(true)
    try { guardarEnDisco(await exportarCenso(formato, bajas), `censo.${formato}`) }
    catch (err: unknown) { onError(mensaje(err, 'No se ha podido exportar el censo.')) }
    finally { setExportando(false) }
  }

  const abrir = () => { setFichero(null); setPrevia(null); setError(null); setAbierta(true) }

  const elegir = async (elegido: File | null) => {
    setFichero(elegido); setPrevia(null); setError(null)
    if (!elegido) return
    setLeyendo(true)
    try { setPrevia(await previaImportacionCenso(elegido)) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido leer el fichero.')) }
    finally { setLeyendo(false) }
  }

  const importar = async () => {
    if (!fichero) return
    setImportando(true); setError(null)
    try { const r = await importarCenso(fichero); setAbierta(false); onImportado(r.message) }
    catch (err: unknown) { setError(mensaje(err, 'No se ha podido importar el censo.')) }
    finally { setImportando(false) }
  }

  const ignoradas = previa?.columnas.filter((c) => c.clave === null && c.titulo) ?? []

  return <>
    <Button variant="outlined" startIcon={<DownloadIcon />} disabled={exportando} onClick={(e) => setMenu(e.currentTarget)} aria-haspopup="menu">
      {exportando ? 'Exportando…' : 'Exportar'}
    </Button>
    <Menu anchorEl={menu} open={menu !== null} onClose={() => setMenu(null)}>
      {EXPORTACIONES.map((x) => (
        <MenuItem key={x.texto} onClick={() => void exportar(x.formato, x.bajas)}><ListItemText>{x.texto}</ListItemText></MenuItem>
      ))}
    </Menu>
    <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={abrir}>Importar</Button>

    <VentanaFormulario
      abierto={abierta}
      titulo="Importar el censo"
      textoGuardar={previa?.importables ? `Importar ${plural(previa.importables, 'ficha', 'fichas')}` : 'Importar'}
      sucio={false}
      guardando={importando}
      puedeGuardar={Boolean(previa?.importables) && !leyendo}
      error={error}
      ancho="md"
      onGuardar={importar}
      onCerrar={() => setAbierta(false)}
    >
      <Typography variant="body2" color="text.secondary">
        Un Excel (.xlsx) o un CSV con una fila de títulos: Nombre, Apellidos (o Primer y Segundo apellido), DNI, Fecha de
        nacimiento, Correo, Teléfono, Dirección, Población, Código postal, Fecha de alta, Fecha de baja, Número, IBAN… Sirve
        el que sale al exportar. Quien ya está en el censo no se vuelve a crear.
      </Typography>
      <Box>
        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
          {fichero ? 'Elegir otro fichero' : 'Elegir fichero'}
          <input type="file" hidden accept=".xlsx,.csv,text/csv" aria-label="Fichero del censo" onChange={(e) => void elegir(e.target.files?.[0] ?? null)} />
        </Button>
        {fichero && <Typography variant="body2" sx={{ mt: 1 }}>{fichero.name}</Typography>}
      </Box>

      {leyendo && <CircularProgress size={24} aria-label="Leyendo el fichero" />}
      {previa && <>
        <Alert severity={previa.importables > 0 ? 'info' : 'warning'}>
          {previa.importables > 0
            ? `De ${plural(previa.filas, 'fila', 'filas')}, ${previa.importables === 1 ? 'entra 1' : `entran ${previa.importables}`}.`
            : `Ninguna de las ${previa.filas} filas se puede importar.`}
        </Alert>
        {previa.importables > 0 && (
          <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 2.5 }}>
            {previa.conCuenta > 0 && (
              <Typography component="li" variant="body2">
                {plural(previa.conCuenta, 'recibe', 'reciben')} su propia cuenta (tienen DNI y correo): entran con «¿Olvidaste tu contraseña?».
              </Typography>
            )}
            {previa.importables - previa.conCuenta > 0 && (
              <Typography component="li" variant="body2">
                {plural(previa.importables - previa.conCuenta, 'queda', 'quedan')} sin cuenta propia: se les da con «Emancipar» desde su ficha cuando la pidan.
              </Typography>
            )}
            {previa.sinNumero > 0 && (
              <Typography component="li" variant="body2">
                {plural(previa.sinNumero, 'activo no trae', 'activos no traen')} número: lo reciben a continuación del último, por antigüedad.
              </Typography>
            )}
            {previa.deBaja > 0 && <Typography component="li" variant="body2">{plural(previa.deBaja, 'entra de baja', 'entran de baja')}.</Typography>}
            {previa.domiciliadas > 0 && <Typography component="li" variant="body2">{plural(previa.domiciliadas, 'trae', 'traen')} cuenta bancaria: quedan domiciliados.</Typography>}
          </Stack>
        )}
        {ignoradas.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            Columnas que no se usan: {ignoradas.map((c) => `«${c.titulo}»`).join(', ')}.
          </Typography>
        )}
        {previa.errores.length > 0 && (
          <Alert severity="warning">
            {plural(previa.errores.length, 'fila se queda', 'filas se quedan')} fuera. Corrígelas en el fichero y vuelve a importarlo: lo ya importado no se repite.
            <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5, maxHeight: 220, overflowY: 'auto' }}>
              {previa.errores.map((x) => <li key={x.fila}>Fila {x.fila}: {x.errores.join(' ')}</li>)}
            </Box>
          </Alert>
        )}
      </>}
    </VentanaFormulario>
  </>
}
