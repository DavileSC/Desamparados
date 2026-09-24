import type { ComponentType } from 'react'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import DirectionsWalkOutlinedIcon from '@mui/icons-material/DirectionsWalkOutlined'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import WebOutlinedIcon from '@mui/icons-material/WebOutlined'
import CATALOGO from '../../../shared/paginas-publicas.json'
import type { PanelResponse } from '../lib/api/panel'

/**
 * Menú del CMS, agrupado por áreas, y roles que pasan la guarda de cada una
 * de sus rutas.
 *
 * Las dos exportaciones de guardas y roles viven juntas y fuera de los
 * componentes por dos motivos:
 *
 * 1. `MarcoCms.test.tsx` las compara entre sí para que el menú y las guardas
 *    no puedan divergir sin que un test lo note (así se coló el hallazgo del
 *    Hermano Mayor expulsado de Tesorería, Contabilidad y Auditoría: el menú las
 *    enseñaba pero la guarda de ruta lo echaba a /area-hermano).
 *
 * 2. Exportarlas desde un fichero de componentes rompe el *fast refresh* de
 *    Vite, y tenerlas cruzadas entre `MarcoCms.tsx` y `routes/index.tsx`
 *    arriesgaba un ciclo de módulos: `routes/index.tsx` ya importa MarcoCms,
 *    así que si MarcoCms hubiera importado los roles de vuelta, el orden de
 *    inicialización de los ES modules podía dejar una de las dos leyendo
 *    `undefined` en el arranque. Este fichero no importa nada de componentes,
 *    de modo que el ciclo es imposible.
 */

/**
 * Áreas del menú, en el orden en que se pintan. «Censo y enseres» y no
 * «Hermandad»: la corporación es un Grupo Parroquial.
 *
 * «Web pública» es el apartado del constructor de páginas: páginas de la web
 * pública compuestas por bloques, distinto de «Contenido», que son la portada,
 * con su formulario fijo, y lo que se publica por entradas (noticias,
 * publicaciones, agenda).
 */
export const GRUPOS = ['Web', 'Censo y procesión', 'Cuentas', 'Sistema'] as const
export type Grupo = (typeof GRUPOS)[number]

/**
 * Dónde va cada entrada: en un grupo del menú, suelta arriba del todo (el
 * Inicio, que no necesita rótulo) o en el menú de la cuenta, abajo (lo que es
 * de quien entra y no del Grupo, como su 2FA).
 */
export type Lugar = Grupo | 'suelta' | 'cuenta'

/** De dónde sale el número que se enseña junto a una sección. */
export type ClaveContador = 'noticiasBorradores' | 'hermanosSinNumero'

export interface ItemMenu {
  label: string
  href: string
  roles: string[]
  grupo: Lugar
  icono: ComponentType<{ fontSize?: 'small' | 'inherit' | 'medium' | 'large' }>
  /** El número dice cuántos hay; el tono, cuánta prisa corre. */
  contador?: { de: ClaveContador; tono: 'aviso' | 'error' }
}

const TODOS = ['ADMIN', 'HERMANO_MAYOR', 'SECRETARIA', 'TESORERIA', 'REDES', 'ALBACERIA']

export const itemsMenu: ItemMenu[] = [
  { label: 'Inicio', href: '/cms', roles: TODOS, grupo: 'suelta', icono: HomeOutlinedIcon },
  { label: 'Páginas', href: '/cms/paginas', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], grupo: 'Web', icono: WebOutlinedIcon },
  { label: 'Portada', href: '/cms/portada', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], grupo: 'Web', icono: ImageOutlinedIcon },
  { label: 'Noticias', href: '/cms/noticias', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], grupo: 'Web', icono: ArticleOutlinedIcon, contador: { de: 'noticiasBorradores', tono: 'aviso' } },
  { label: 'Publicaciones', href: '/cms/publicaciones', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], grupo: 'Web', icono: MenuBookOutlinedIcon },
  { label: 'Agenda', href: '/cms/agenda', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'], grupo: 'Web', icono: CalendarMonthOutlinedIcon },
  { label: 'Hermanos', href: '/cms/hermanos', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'], grupo: 'Censo y procesión', icono: GroupsOutlinedIcon, contador: { de: 'hermanosSinNumero', tono: 'aviso' } },
  // Los días de reparto y el plazo de la papeleta: los ve la Junta del censo, los cambia Secretaría.
  { label: 'Procesión', href: '/cms/procesion', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'], grupo: 'Censo y procesión', icono: DirectionsWalkOutlinedIcon },
  // Apuntar a quien sale, con su ropa y cobrando: la Junta que está en la mesa.
  { label: 'Mesa de procesión', href: '/cms/procesion/mesa', roles: ['ADMIN', 'SECRETARIA', 'TESORERIA', 'ALBACERIA'], grupo: 'Censo y procesión', icono: HowToRegOutlinedIcon },
  { label: 'Inventario', href: '/cms/inventario', roles: ['ADMIN', 'ALBACERIA', 'HERMANO_MAYOR'], grupo: 'Censo y procesión', icono: Inventory2OutlinedIcon },
  { label: 'Tesorería', href: '/cms/tesoreria', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'], grupo: 'Cuentas', icono: AccountBalanceWalletOutlinedIcon },
  { label: 'Contabilidad', href: '/cms/contabilidad', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'], grupo: 'Cuentas', icono: BarChartOutlinedIcon },
  { label: 'Accesos', href: '/cms/accesos', roles: ['ADMIN'], grupo: 'Sistema', icono: ManageAccountsOutlinedIcon },
  { label: 'Auditoría', href: '/cms/auditoria', roles: ['ADMIN', 'HERMANO_MAYOR'], grupo: 'Sistema', icono: FactCheckOutlinedIcon },
  { label: 'Mi seguridad', href: '/cms/mi-seguridad', roles: TODOS, grupo: 'cuenta', icono: ShieldOutlinedIcon },
]

/** Única fuente de verdad de las `ExigeRol` de `routes/index.tsx`. */
export const rolesPorRutaCms = {
  panel: ['ADMIN', 'REDES', 'SECRETARIA', 'HERMANO_MAYOR', 'TESORERIA', 'ALBACERIA'],
  // Las páginas por bloques: el índice y la pantalla de cada una, con los
  // mismos roles que el resto del contenido. Las dos claves llevan la misma
  // lista a propósito: son la misma pantalla en dos pasos, y dejar entrar al
  // índice a quien no puede abrir ninguna página sería enseñarle una lista de
  // enlaces que todos le rebotan.
  paginas: ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
  'paginas/corporacion': ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
  // Las fotos de la cabecera son contenido: los mismos roles que las noticias.
  portada: ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
  noticias: ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
  publicaciones: ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
  agenda: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'],
  hermanos: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'],
  procesion: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'],
  // Los mismos que pueden inscribir y cobrar en el backend (rolesMesaReparto).
  'procesion/mesa': ['ADMIN', 'SECRETARIA', 'TESORERIA', 'ALBACERIA'],
  tesoreria: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'],
  inventario: ['ADMIN', 'ALBACERIA', 'HERMANO_MAYOR'],
  contabilidad: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'],
  // Repartir cargos es repartir privilegios: ni el Hermano Mayor. El backend
  // lo estrecha igual (checkRole(SOLO_ADMIN) en adminRoutes).
  accesos: ['ADMIN'],
  auditoria: ['ADMIN', 'HERMANO_MAYOR'],
  // La gestión del 2FA propio es de todo el staff: cada cuenta debe poder
  // protegerse, no solo la de ADMIN.
  'mi-seguridad': ['ADMIN', 'REDES', 'SECRETARIA', 'HERMANO_MAYOR', 'TESORERIA', 'ALBACERIA'],
} satisfies Record<string, string[]>

/**
 * Los números del menú, del mismo panel que alimenta el Inicio. Tesorería no
 * lleva: los devueltos ya se ven en su tarjeta y en el Inicio, y un segundo
 * número (solo los que faltan por reemitir) confundía más que avisaba.
 */
export function contadoresDelPanel(panel?: PanelResponse): Record<ClaveContador, number> {
  return {
    noticiasBorradores: panel?.actividad.noticias.borradores ?? 0,
    hermanosSinNumero: panel?.censo.sinNumeroHermano ?? 0,
  }
}

/** Nombre del cargo tal y como se enseña. */
export const NOMBRE_CARGO: Record<string, string> = {
  ADMIN: 'Administración',
  HERMANO_MAYOR: 'Hermano Mayor',
  SECRETARIA: 'Secretaría',
  TESORERIA: 'Tesorería',
  REDES: 'Redes',
  ALBACERIA: 'Albacería',
}

/**
 * Las páginas de la web pública que se editan por bloques, tal y como las
 * declara `shared/paginas-publicas.json`. Añadir una es añadirla ahí: el índice
 * del CMS, el enlace de «Vista previa» y el título de cada pantalla salen de
 * esta misma lista.
 */
export interface PaginaPublica {
  slug: string
  nombre: string
  ruta: string
  grupo: string
  descripcion: string
}

export const PAGINAS_PUBLICAS: PaginaPublica[] = CATALOGO.paginas

/** Dónde vive en la web pública cada página editable. */
export const RUTA_PUBLICA: Record<string, string> = Object.fromEntries(
  PAGINAS_PUBLICAS.map((pagina) => [pagina.slug, pagina.ruta]),
)

/** La ficha de una página del catálogo, o `undefined` si el slug no es de ahí. */
export const paginaPublica = (slug: string): PaginaPublica | undefined =>
  PAGINAS_PUBLICAS.find((pagina) => pagina.slug === slug)
