import { useState } from 'react'
import { Alert, Box, Button, Checkbox, FormControlLabel, Link as EnlaceMui, Stack, TextField, Typography } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import VentanaFormulario from '../VentanaFormulario'
import { ErrorDeApi } from '../../../lib/api/cliente'
import {
  CLAVE_INSTAGRAM, conectarInstagram, desconectarInstagram, estadoInstagram,
  publicarNoticiaEnInstagram, type EstadoInstagram, type PublicacionEnInstagram,
} from '../../../lib/api/instagram'
import {
  CLAVE_X, conectarX, desconectarX, enlaceParaPublicarEnX, estadoX, publicarNoticiaEnX,
  type ClavesX, type EstadoX, type PublicacionEnX,
} from '../../../lib/api/x'
import type { NoticiaDeLaApi } from '../../../lib/api/noticias'
import { site } from '../../../config/site'
import { LARGO_MAXIMO_PIE, PROPORCION_MAXIMA, PROPORCION_MINIMA, pieDeInstagram, problemaDelPie } from '../../../../../shared/instagram.mjs'
import { LARGO_MAXIMO_X, largoEnX, problemaDelTextoX, textoParaX } from '../../../../../shared/x.mjs'

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

const mensajeDeError = (e: unknown, siNo: string) => (e instanceof ErrorDeApi || e instanceof Error ? e.message : siNo)

interface Props {
  /** La noticia tal como está guardada: lo que se manda es lo guardado, no lo que se está escribiendo. */
  noticia: NoticiaDeLaApi
  /** Hay cambios sin guardar en la ficha. */
  sucio: boolean
}

/**
 * Mandar la noticia a las redes desde su ficha, las dos por su API. Sin la
 * cuenta de X conectada, se puede abrir X con el post escrito y publicarlo allí.
 *
 * Solo una noticia publicada y sin cambios a medias: desde las redes se llega
 * a la web, y lo que se manda es lo que se ve en ella.
 */
export default function PanelRedes({ noticia, sucio }: Props) {
  const queryClient = useQueryClient()
  const { data: cuenta } = useQuery({ queryKey: CLAVE_INSTAGRAM, queryFn: estadoInstagram })
  const [conectando, setConectando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [enInstagram, setEnInstagram] = useState<PublicacionEnInstagram>({
    instagramId: noticia.instagramId ?? null, instagramEnlace: noticia.instagramEnlace ?? null, instagramEl: noticia.instagramEl ?? null,
  })
  const { data: cuentaX } = useQuery({ queryKey: CLAVE_X, queryFn: estadoX })
  const [conectandoX, setConectandoX] = useState(false)
  const [publicandoX, setPublicandoX] = useState(false)
  const [enX, setEnX] = useState<PublicacionEnX>({ xId: noticia.xId ?? null, xEnlace: noticia.xEnlace ?? null, xEl: noticia.xEl ?? null })

  const lista = noticia.visible && !sucio
  const motivo = !noticia.visible ? 'Publícala en la web para mandarla a las redes.'
    : sucio ? 'Guarda los cambios antes de mandarla: se manda lo que se ve en la web.'
    : null
  // La de la web pública, no la de donde se está: desde la web de pruebas, que
  // pide contraseña, el post llevaría a una puerta cerrada.
  const direccion = `${site.url}/noticias/${noticia.slug}`
  const cambiarCuenta = (estado: EstadoInstagram) => queryClient.setQueryData(CLAVE_INSTAGRAM, estado)

  return (
    <Stack spacing={2}>
      {motivo && <Typography variant="body2" sx={{ color: 'text.secondary' }}>{motivo}</Typography>}

      <Box>
        <Typography variant="subtitle2" component="h3">Instagram</Typography>
        {cuenta && !cuenta.conectada && (
          <>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>No hay ninguna cuenta conectada.</Typography>
            <Button size="small" variant="outlined" onClick={() => setConectando(true)}>Conectar Instagram</Button>
          </>
        )}
        {cuenta?.conectada && (
          <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              En @{cuenta.usuario} ·{' '}
              <EnlaceMui component="button" type="button" variant="body2" onClick={() => setConectando(true)}>cambiar</EnlaceMui>
            </Typography>
            {cuenta.errorAlRenovar && (
              <Alert severity="warning" sx={{ width: '100%' }}>
                {cuenta.errorAlRenovar}{' '}
                <EnlaceMui component="button" type="button" onClick={() => setConectando(true)}>Volver a conectar</EnlaceMui>
              </Alert>
            )}
            {enInstagram.instagramEl ? (
              <>
                <Typography variant="body2">Mandada el {fechaCorta(enInstagram.instagramEl)}.</Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {enInstagram.instagramEnlace && (
                    <Button size="small" href={enInstagram.instagramEnlace} target="_blank" rel="noopener" startIcon={<OpenInNewIcon />}>Ver en Instagram</Button>
                  )}
                  <Button size="small" color="inherit" disabled={!lista} onClick={() => setPublicando(true)}>Mandar otra vez</Button>
                </Stack>
              </>
            ) : !noticia.imagenUrl ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>Instagram no publica sin foto: ponle una a la noticia.</Typography>
            ) : (
              <Button size="small" variant="outlined" disabled={!lista} onClick={() => setPublicando(true)}>Publicar en Instagram</Button>
            )}
          </Stack>
        )}
      </Box>

      <Box>
        <Typography variant="subtitle2" component="h3">X</Typography>
        {cuentaX && !cuentaX.conectada && (
          <>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
              No hay ninguna cuenta conectada: se abre X con el título y el enlace ya escritos, y allí se pulsa «Publicar».
            </Typography>
            <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                disabled={!lista}
                href={enlaceParaPublicarEnX({ titulo: noticia.titulo, direccion })}
                target="_blank"
                rel="noopener"
                startIcon={<OpenInNewIcon />}
              >
                Publicar en X
              </Button>
              <Button size="small" color="inherit" onClick={() => setConectandoX(true)}>Conectar X</Button>
            </Stack>
          </>
        )}
        {cuentaX?.conectada && (
          <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              En @{cuentaX.usuario} ·{' '}
              <EnlaceMui component="button" type="button" variant="body2" onClick={() => setConectandoX(true)}>cambiar</EnlaceMui>
            </Typography>
            {cuentaX.errorDeClaves && (
              <Alert severity="warning" sx={{ width: '100%' }}>
                {cuentaX.errorDeClaves}{' '}
                <EnlaceMui component="button" type="button" onClick={() => setConectandoX(true)}>Volver a conectar</EnlaceMui>
              </Alert>
            )}
            {enX.xEl ? (
              <>
                <Typography variant="body2">Mandada el {fechaCorta(enX.xEl)}.</Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {enX.xEnlace && (
                    <Button size="small" href={enX.xEnlace} target="_blank" rel="noopener" startIcon={<OpenInNewIcon />}>Ver en X</Button>
                  )}
                  <Button size="small" color="inherit" disabled={!lista} onClick={() => setPublicandoX(true)}>Mandar otra vez</Button>
                </Stack>
              </>
            ) : (
              <Button size="small" variant="outlined" disabled={!lista} onClick={() => setPublicandoX(true)}>Publicar en X</Button>
            )}
          </Stack>
        )}
      </Box>

      {conectando && cuenta && (
        <VentanaConectarInstagram cuenta={cuenta} onHecho={(estado) => { cambiarCuenta(estado); setConectando(false) }} onCerrar={() => setConectando(false)} />
      )}
      {publicando && cuenta?.usuario && (
        <VentanaPublicarInstagram
          noticia={noticia}
          usuario={cuenta.usuario}
          otraVez={enInstagram.instagramEl !== null}
          onHecho={(publicada) => { setEnInstagram(publicada); setPublicando(false) }}
          onCaducada={() => void queryClient.invalidateQueries({ queryKey: CLAVE_INSTAGRAM })}
          onCerrar={() => setPublicando(false)}
        />
      )}
      {conectandoX && cuentaX && (
        <VentanaConectarX
          cuenta={cuentaX}
          onHecho={(estado) => { queryClient.setQueryData(CLAVE_X, estado); setConectandoX(false) }}
          onCerrar={() => setConectandoX(false)}
        />
      )}
      {publicandoX && cuentaX?.usuario && (
        <VentanaPublicarX
          noticia={noticia}
          direccion={direccion}
          usuario={cuentaX.usuario}
          otraVez={enX.xEl !== null}
          onHecho={(publicada) => { setEnX(publicada); setPublicandoX(false) }}
          onFalloDeClaves={() => void queryClient.invalidateQueries({ queryKey: CLAVE_X })}
          onCerrar={() => setPublicandoX(false)}
        />
      )}
    </Stack>
  )
}

/**
 * Pegar el token de la cuenta. Los pasos para sacarlo están en
 * docs/despliegue.md; aquí, los justos para no perderse.
 */
function VentanaConectarInstagram({ cuenta, onHecho, onCerrar }: { cuenta: EstadoInstagram; onHecho: (estado: EstadoInstagram) => void; onCerrar: () => void }) {
  const [token, setToken] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hacer = async (accion: () => Promise<EstadoInstagram>, siFalla: string) => {
    setGuardando(true)
    setError(null)
    try {
      onHecho(await accion())
    } catch (e) {
      setError(mensajeDeError(e, siFalla))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <VentanaFormulario
      abierto
      titulo={cuenta.conectada ? 'Cuenta de Instagram' : 'Conectar Instagram'}
      sucio={token !== ''}
      guardando={guardando}
      puedeGuardar={token.trim() !== ''}
      textoGuardar="Conectar"
      error={error}
      onGuardar={() => hacer(() => conectarInstagram(token.trim()), 'No se ha podido conectar la cuenta.')}
      onCerrar={onCerrar}
    >
      {cuenta.conectada && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Typography variant="body2">Conectada: @{cuenta.usuario}.</Typography>
          <Button size="small" color="error" disabled={guardando} onClick={() => void hacer(desconectarInstagram, 'No se ha podido desconectar la cuenta.')}>
            Desconectar
          </Button>
        </Box>
      )}
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        En <EnlaceMui href="https://developers.facebook.com/apps/" target="_blank" rel="noopener">Meta for Developers</EnlaceMui>, abre vuestra
        app → Instagram → «Configuración de la API con inicio de sesión de Instagram» y pulsa «Generar token» junto a la cuenta.
        Copia el token entero y pégalo aquí. El servidor lo renueva solo cada semana.
      </Typography>
      <TextField
        label="Token de Instagram"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        multiline
        minRows={3}
        fullWidth
        slotProps={{ htmlInput: { sx: { fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' } } }}
      />
    </VentanaFormulario>
  )
}

/** Revisar el pie y ver cómo queda la foto antes de mandarla. */
function VentanaPublicarInstagram({ noticia, usuario, otraVez, onHecho, onCaducada, onCerrar }: {
  noticia: NoticiaDeLaApi
  usuario: string
  otraVez: boolean
  onHecho: (publicada: PublicacionEnInstagram) => void
  onCaducada: () => void
  onCerrar: () => void
}) {
  const propuesto = pieDeInstagram(noticia)
  const [pie, setPie] = useState(propuesto)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [proporcion, setProporcion] = useState<number | null>(null)
  const problema = problemaDelPie(pie)

  const publicar = async () => {
    setGuardando(true)
    setError(null)
    try {
      onHecho(await publicarNoticiaEnInstagram(noticia.id, pie, otraVez))
    } catch (e) {
      setError(mensajeDeError(e, 'No se ha podido publicar en Instagram.'))
      // Si era el token caducado, el servidor lo ha apuntado: que el panel lo diga.
      if (e instanceof ErrorDeApi && e.status === 409) onCaducada()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <VentanaFormulario
      abierto
      titulo={otraVez ? 'Mandar otra vez a Instagram' : 'Publicar en Instagram'}
      sucio={pie !== propuesto}
      guardando={guardando}
      puedeGuardar={problema === null}
      textoGuardar={`Publicar en @${usuario}`}
      error={error}
      ancho="md"
      onGuardar={publicar}
      onCerrar={onCerrar}
    >
      {otraVez && <Alert severity="info">Ya está en Instagram: saldrá una publicación nueva, la otra se queda.</Alert>}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: '220px minmax(0, 1fr)' }, alignItems: 'start' }}>
        {/* El mismo recorte que hace el servidor: entre 4:5 y 1,91:1, centrado. */}
        <Box
          component="img"
          src={noticia.imagenUrl ?? undefined}
          alt="La foto tal como sale en Instagram"
          onLoad={(e) => {
            const { naturalWidth: ancho, naturalHeight: alto } = e.currentTarget
            if (alto > 0) setProporcion(Math.min(PROPORCION_MAXIMA, Math.max(PROPORCION_MINIMA, ancho / alto)))
          }}
          sx={{ width: '100%', aspectRatio: proporcion ?? 'auto', objectFit: 'cover', display: 'block', borderRadius: 1 }}
        />
        <TextField
          label="Pie de la foto"
          value={pie}
          onChange={(e) => setPie(e.target.value)}
          multiline
          minRows={6}
          fullWidth
          error={problema !== null && pie !== ''}
          helperText={
            <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <span>{problema ?? 'Los enlaces no se pueden pulsar en Instagram: por eso remite al perfil.'}</span>
              <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{pie.length} / {LARGO_MAXIMO_PIE}</Box>
            </Box>
          }
        />
      </Box>
    </VentanaFormulario>
  )
}

const CAMPOS_X: { clave: keyof ClavesX; etiqueta: string }[] = [
  { clave: 'apiKey', etiqueta: 'API Key' },
  { clave: 'apiSecret', etiqueta: 'API Key Secret' },
  { clave: 'accessToken', etiqueta: 'Access Token' },
  { clave: 'accessSecret', etiqueta: 'Access Token Secret' },
]
const SIN_CLAVES: ClavesX = { apiKey: '', apiSecret: '', accessToken: '', accessSecret: '' }

/**
 * Pegar las cuatro claves de la app de X. Los pasos están en
 * docs/despliegue.md; aquí, los justos, y sobre todo el orden: un Access
 * Token sacado antes de dar permiso de escritura no publica.
 */
function VentanaConectarX({ cuenta, onHecho, onCerrar }: { cuenta: EstadoX; onHecho: (estado: EstadoX) => void; onCerrar: () => void }) {
  const [claves, setClaves] = useState<ClavesX>(SIN_CLAVES)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const limpias: ClavesX = {
    apiKey: claves.apiKey.trim(), apiSecret: claves.apiSecret.trim(),
    accessToken: claves.accessToken.trim(), accessSecret: claves.accessSecret.trim(),
  }

  const hacer = async (accion: () => Promise<EstadoX>, siFalla: string) => {
    setGuardando(true)
    setError(null)
    try {
      onHecho(await accion())
    } catch (e) {
      setError(mensajeDeError(e, siFalla))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <VentanaFormulario
      abierto
      titulo={cuenta.conectada ? 'Cuenta de X' : 'Conectar X'}
      sucio={Object.values(claves).some((v) => v !== '')}
      guardando={guardando}
      puedeGuardar={Object.values(limpias).every((v) => v !== '')}
      textoGuardar="Conectar"
      error={error}
      onGuardar={() => hacer(() => conectarX(limpias), 'No se ha podido conectar la cuenta.')}
      onCerrar={onCerrar}
    >
      {cuenta.conectada && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Typography variant="body2">Conectada: @{cuenta.usuario}.</Typography>
          <Button size="small" color="error" disabled={guardando} onClick={() => void hacer(desconectarX, 'No se ha podido desconectar la cuenta.')}>
            Desconectar
          </Button>
        </Box>
      )}
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        En <EnlaceMui href="https://console.x.com/" target="_blank" rel="noopener">console.x.com</EnlaceMui>, abre vuestra app: con los
        permisos en «Read and write», ve a «Keys and tokens» y genera el Access Token y su Secret. Si los sacaste antes de dar
        ese permiso, vuelve a generarlos: los de antes no publican. Pega cada clave en su sitio.
      </Typography>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
        {CAMPOS_X.map(({ clave, etiqueta }) => (
          <TextField
            key={clave}
            label={etiqueta}
            value={claves[clave]}
            onChange={(e) => setClaves((c) => ({ ...c, [clave]: e.target.value }))}
            autoComplete="off"
            spellCheck={false}
            fullWidth
            slotProps={{ htmlInput: { sx: { fontFamily: 'monospace', fontSize: 13 } } }}
          />
        ))}
      </Box>
    </VentanaFormulario>
  )
}

/** Revisar el texto y decidir si va con la foto antes de mandarlo. */
function VentanaPublicarX({ noticia, direccion, usuario, otraVez, onHecho, onFalloDeClaves, onCerrar }: {
  noticia: NoticiaDeLaApi
  direccion: string
  usuario: string
  otraVez: boolean
  onHecho: (publicada: PublicacionEnX) => void
  onFalloDeClaves: () => void
  onCerrar: () => void
}) {
  const propuesto = textoParaX({ titulo: noticia.titulo, direccion })
  const [texto, setTexto] = useState(propuesto)
  const [conFoto, setConFoto] = useState(Boolean(noticia.imagenUrl))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const problema = problemaDelTextoX(texto)

  const publicar = async () => {
    setGuardando(true)
    setError(null)
    try {
      onHecho(await publicarNoticiaEnX(noticia.id, texto, conFoto, otraVez))
    } catch (e) {
      setError(mensajeDeError(e, 'No se ha podido publicar en X.'))
      // Si eran las claves, el servidor lo ha apuntado: que el panel lo diga.
      if (e instanceof ErrorDeApi && e.status === 409) onFalloDeClaves()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <VentanaFormulario
      abierto
      titulo={otraVez ? 'Mandar otra vez a X' : 'Publicar en X'}
      sucio={texto !== propuesto}
      guardando={guardando}
      puedeGuardar={problema === null}
      textoGuardar={`Publicar en @${usuario}`}
      error={error}
      ancho="md"
      onGuardar={publicar}
      onCerrar={onCerrar}
    >
      {otraVez && <Alert severity="info">Ya está en X: saldrá un post nuevo y el otro se queda. X no deja repetir el mismo texto: cámbialo un poco.</Alert>}
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: noticia.imagenUrl ? '220px minmax(0, 1fr)' : 'minmax(0, 1fr)' }, alignItems: 'start' }}>
        {noticia.imagenUrl && (
          <Box>
            {/* Entera, como la manda el servidor: X la encuadra en el timeline y la enseña completa al pulsarla. */}
            <Box
              component="img"
              src={noticia.imagenUrl}
              alt="La foto que va con el post"
              sx={{ width: '100%', display: 'block', borderRadius: 1, opacity: conFoto ? 1 : 0.35 }}
            />
            <FormControlLabel
              control={<Checkbox size="small" checked={conFoto} onChange={(e) => setConFoto(e.target.checked)} />}
              label="Con la foto"
            />
          </Box>
        )}
        <TextField
          label="Texto del post"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          multiline
          minRows={4}
          fullWidth
          error={problema !== null && texto !== ''}
          helperText={
            <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <span>{problema ?? (conFoto ? 'Con foto, X no enseña la tarjeta del enlace.' : 'Sin foto, X enseña la tarjeta del enlace con la foto de la noticia.')}</span>
              <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{largoEnX(texto)} / {LARGO_MAXIMO_X}</Box>
            </Box>
          }
        />
      </Box>
    </VentanaFormulario>
  )
}
