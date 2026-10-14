import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Button, Skeleton, Stack, Typography } from '@mui/material'
import QRCode from 'qrcode'
import { misMoviles } from '../../../lib/api/aprobacion'
import { ApuntarAqui } from '../../cms/AvisosEnElMovil'

/**
 * El último paso de activar el doble factor, con el módulo encendido: apuntar
 * el móvil para aprobar las entradas con un aviso, aprovechando que se está
 * configurando la seguridad. Es opcional; más teléfonos, en «Mi seguridad».
 *
 * Desde el móvil se apunta aquí mismo. Desde el ordenador no se puede: el
 * aviso lo recibe el navegador del móvil, que tiene que dar él su permiso.
 * Por eso el QR, que abre «Mi seguridad» en el móvil.
 */
export default function PasoAvisosEnElMovil({ alSeguir, ocupado }: { alSeguir: () => void; ocupado: boolean }) {
  const { data, isPending, isError } = useQuery({ queryKey: ['moviles-apuntados'], queryFn: misMoviles })
  const [apuntado, setApuntado] = useState(false)

  // Sin las claves en el servidor, o si no responde, el paso sobra: al CMS.
  // Una sola vez: `alSeguir` cambia en cada render de quien lo pasa.
  const sobra = isError || (data !== undefined && !data.disponible)
  const seguirRef = useRef(alSeguir)
  useEffect(() => { seguirRef.current = alSeguir })
  useEffect(() => {
    if (sobra) seguirRef.current()
  }, [sobra])

  if (isPending || sobra) {
    return (
      <Box aria-busy="true" aria-label="Cargando">
        <Skeleton variant="text" width="50%" sx={{ fontSize: 24 }} />
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="80%" />
      </Box>
    )
  }

  return (
    <Stack spacing={2.5}>
      <Typography variant="h5" component="h2">Avisos en el móvil</Typography>
      <Typography variant="body2" color="text.secondary">
        Además del código, puedes aprobar las entradas con un aviso: al entrar desde el ordenador te
        llega «¿Eres tú?» al móvil, tocas el número que ves en pantalla y listo. Es opcional, y puedes
        apuntar más teléfonos cuando quieras en «Mi seguridad».
      </Typography>

      {apuntado ? (
        <Alert severity="success">Listo: este móvil recibirá los avisos.</Alert>
      ) : (
        <ApuntarAqui clavePublica={data.clavePublica} alApuntar={() => setApuntado(true)} enOrdenador={<QrAlMovil />} />
      )}

      <Button
        variant={apuntado ? 'contained' : 'text'}
        disabled={ocupado}
        onClick={alSeguir}
        sx={{ alignSelf: 'flex-start', ...(apuntado ? {} : { color: 'text.secondary' }) }}
      >
        {apuntado ? 'Entrar en el CMS' : 'Ahora no, entrar en el CMS'}
      </Button>
    </Stack>
  )
}

/** En el ordenador: un QR que abre «Mi seguridad» en el móvil, donde se apunta. */
function QrAlMovil() {
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    QRCode.toDataURL(`${window.location.origin}/cms/mi-seguridad`, { margin: 1, width: 440 })
      .then((url) => { if (vivo) setQr(url) })
      .catch(() => undefined)
    return () => { vivo = false }
  }, [])

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
      {qr
        ? <Box component="img" src={qr} alt="QR para abrir «Mi seguridad» en el móvil" sx={{ width: 180, height: 180, borderRadius: 1, border: 1, borderColor: 'divider' }} />
        : <Skeleton variant="rectangular" width={180} height={180} />}
      <Box component="ol" sx={{ flex: '1 1 220px', m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 1, fontSize: 15, lineHeight: 1.45 }}>
        <li>Escanea el QR con la cámara del móvil.</li>
        <li>Entra con tu cuenta (te pedirá el código de la app).</li>
        <li>Pulsa «Avisarme en este móvil» y acepta las notificaciones.</li>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ flexBasis: '100%' }}>
        En el iPhone, «Mi seguridad» te dirá antes cómo añadir la web a la pantalla de inicio: sin eso no llegan los avisos.
      </Typography>
    </Box>
  )
}
