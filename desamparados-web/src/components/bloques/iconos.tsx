import type { SvgIconComponent } from '@mui/icons-material'
import ChurchIcon from '@mui/icons-material/Church'
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import GroupsIcon from '@mui/icons-material/Groups'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import ScheduleIcon from '@mui/icons-material/Schedule'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import MusicNoteIcon from '@mui/icons-material/MusicNote'
import LocalFloristIcon from '@mui/icons-material/LocalFlorist'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined'
import MailOutlinedIcon from '@mui/icons-material/MailOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import type { IconoTarjeta } from '../../lib/api/contenido'

/**
 * Los iconos que puede llevar una tarjeta, con el nombre que lee quien edita.
 * La lista de claves es la de `shared/presentacion-de-bloques.json`
 * (`iconosDeTarjeta`); el test de los bloques comprueba que no falte ninguno.
 */
export const ICONOS: Record<IconoTarjeta, { Icono: SvgIconComponent; nombre: string }> = {
  iglesia: { Icono: ChurchIcon, nombre: 'Iglesia' },
  corazon: { Icono: FavoriteBorderIcon, nombre: 'Corazón' },
  manos: { Icono: VolunteerActivismIcon, nombre: 'Manos (caridad)' },
  libro: { Icono: MenuBookIcon, nombre: 'Libro' },
  calendario: { Icono: EventOutlinedIcon, nombre: 'Calendario' },
  grupo: { Icono: GroupsIcon, nombre: 'Grupo de personas' },
  lugar: { Icono: PlaceOutlinedIcon, nombre: 'Lugar' },
  reloj: { Icono: ScheduleIcon, nombre: 'Reloj' },
  estrella: { Icono: StarBorderIcon, nombre: 'Estrella' },
  musica: { Icono: MusicNoteIcon, nombre: 'Música' },
  flor: { Icono: LocalFloristIcon, nombre: 'Flor' },
  sol: { Icono: Brightness7Icon, nombre: 'Resplandor' },
  foto: { Icono: PhotoCameraOutlinedIcon, nombre: 'Cámara' },
  correo: { Icono: MailOutlinedIcon, nombre: 'Correo' },
  telefono: { Icono: PhoneOutlinedIcon, nombre: 'Teléfono' },
  info: { Icono: InfoOutlinedIcon, nombre: 'Información' },
}
