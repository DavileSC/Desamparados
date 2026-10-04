import FacebookIcon from '@mui/icons-material/Facebook'
import InstagramIcon from '@mui/icons-material/Instagram'
import XIcon from '@mui/icons-material/X'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import { site } from '../../config/site'

/**
 * Los perfiles del Grupo Parroquial que salen en la barra de escritorio y al pie
 * del cajón del móvil. Solo los que tienen URL: un icono que lleva a `#` es un
 * enlace muerto.
 */
export const enlacesDeRedes = [
  { icon: <InstagramIcon fontSize="small" />, href: site.redes.instagram, label: 'Instagram' },
  { icon: <XIcon fontSize="small" />, href: site.redes.x, label: 'X' },
  { icon: <FacebookIcon fontSize="small" />, href: site.redes.facebook, label: 'Facebook' },
  { icon: <PlayCircleIcon fontSize="small" />, href: site.redes.youtube, label: 'YouTube' },
].flatMap(red => red.href ? [{ ...red, href: red.href }] : [])
