import FacebookIcon from '@mui/icons-material/Facebook'
import InstagramIcon from '@mui/icons-material/Instagram'
import XIcon from '@mui/icons-material/X'
import YouTubeIcon from '@mui/icons-material/YouTube'
import { useContacto } from '../../hooks/useContacto'
import IconoTikTok from './IconoTikTok'

/**
 * Los perfiles de la corporación: la barra de escritorio, el pie del cajón del
 * móvil y el pie de página. Solo los que tienen URL: un icono que lleva a `#`
 * es un enlace muerto. Mientras llegan los datos de contacto, ninguno.
 */
export function useEnlacesDeRedes() {
  const redes = useContacto()?.redes
  if (!redes) return []
  return [
    { icon: <InstagramIcon fontSize="small" />, href: redes.instagram, label: 'Instagram' },
    { icon: <IconoTikTok fontSize="small" />, href: redes.tiktok, label: 'TikTok' },
    { icon: <XIcon fontSize="small" />, href: redes.x, label: 'X' },
    { icon: <FacebookIcon fontSize="small" />, href: redes.facebook, label: 'Facebook' },
    { icon: <YouTubeIcon fontSize="small" />, href: redes.youtube, label: 'YouTube' },
  ].flatMap((red) => (red.href ? [{ ...red, href: red.href }] : []))
}
