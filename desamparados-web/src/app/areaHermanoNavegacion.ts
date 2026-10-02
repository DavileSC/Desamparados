import type { ComponentType } from 'react'
import PersonIcon from '@mui/icons-material/Person'
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom'
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk'
import ReceiptIcon from '@mui/icons-material/Receipt'
import type { Modulo } from '../domain/modulos'

export interface EntradaArea {
  label: string
  href: string
  icono: ComponentType
  /** De qué módulo es: apagado, no sale. Recibos es del núcleo; el pago en línea dentro de ella, no. */
  modulo: Modulo
}

/**
 * El menú del área de hermanos. Fuera del componente, como el del CMS
 * (`cmsNavegacion.ts`): la guardiana de módulos lo lee y los tests lo cruzan.
 */
export const entradasDelArea: EntradaArea[] = [
  { label: 'Mi perfil', href: '/area-hermano/perfil', icono: PersonIcon, modulo: 'nucleo' },
  // Las fichas de quienes están a su cargo: un menor apuntado por su padre, su
  // tío o su padrino. Sin esta pantalla, el alta de un menor solo se podía
  // hacer el día del registro y nunca más.
  { label: 'Mi familia', href: '/area-hermano/familia', icono: FamilyRestroomIcon, modulo: 'nucleo' },
  { label: 'Procesión', href: '/area-hermano/procesion', icono: DirectionsWalkIcon, modulo: 'procesion' },
  { label: 'Recibos', href: '/area-hermano/recibos', icono: ReceiptIcon, modulo: 'nucleo' },
]
