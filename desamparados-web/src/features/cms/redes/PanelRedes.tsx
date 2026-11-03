import { useState } from 'react'
import { Alert, Box, Button, Link as EnlaceMui, Stack, TextField, Typography } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import VentanaFormulario from '../VentanaFormulario'
import { ErrorDeApi } from '../../../lib/api/cliente'
import {
  CLAVE_INSTAGRAM, conectarInstagram, desconectarInstagram, enlaceParaPublicarEnX, estadoInstagram,
  publicarNoticiaEnInstagram, type EstadoInstagram, type PublicacionEnInstagram,
} from '../../../lib/api/instagram'
import type { NoticiaDeLaApi } from '../../../lib/api/noticias'
import { LARGO_MAXIMO_PIE, PROPORCION_MAXIMA, PROPORCION_MINIMA, pieDeInstagram, problemaDelPie } from '../../../../../shared/instagram.mjs'

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

const mensajeDeError = (e: unknown, siNo: string) => (e instanceof ErrorDeApi || e instanceof Error ? e.message : siNo)

interface Props {
  /** La noticia tal como está guardada: lo que se manda es lo guardado, no lo que se está escribiendo. */
  noticia: NoticiaDeLaApi
  /** Hay cambios sin guardar en la ficha. */
  sucio: boolean
}

/**
 * Mandar la noticia a las redes desde su ficha. Instagram se publica desde
 * aquí con la API; X se abre con el post escrito y se publica allí, porque su
 * API cobra por cada publicación.
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

  const lista = noticia.visible && !sucio
  const motivo = !noticia.visible ? 'Publícala en la web para mandarla a las redes.'
    : sucio ? 'Guarda los cambios antes de mandarla: se manda lo que se ve en la web.'
    : null
  const direccion = `${window.location.origin}/noticias/${noticia.slug}`
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
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>Se abre X con el título y el enlace ya escritos: allí, pulsa «Publicar».</Typography>
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
      </Box>

      {conectando && cuenta && (
        <VentanaConectar cuenta={cuenta} onHecho={(estado) => { cambiarCuenta(estado); setConectando(false) }} onCerrar={() => setConectando(false)} />
      )}
      {publicando && cuenta?.usuario && (
        <VentanaPublicar
          noticia={noticia}
          usuario={cuenta.usuario}
          otraVez={enInstagram.instagramEl !== null}
          onHecho={(publicada) => { setEnInstagram(publicada); setPublicando(false) }}
          onCaducada={() => void queryClient.invalidateQueries({ queryKey: CLAVE_INSTAGRAM })}
          onCerrar={() => setPublicando(false)}
        />
      )}
    </Stack>
  )
}

/**
 * Pegar el token de la cuenta. Los pasos para sacarlo están en
 * docs/despliegue.md; aquí, los justos para no perderse.
 */
function VentanaConectar({ cuenta, onHecho, onCerrar }: { cuenta: EstadoInstagram; onHecho: (estado: EstadoInstagram) => void; onCerrar: () => void }) {
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
function VentanaPublicar({ noticia, usuario, otraVez, onHecho, onCaducada, onCerrar }: {
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
