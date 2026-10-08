import type { ComponentType } from 'react'
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined'
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined'
import HowToVoteOutlinedIcon from '@mui/icons-material/HowToVoteOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import ConfirmationNumberOutlinedIcon from '@mui/icons-material/ConfirmationNumberOutlined'
import VolunteerActivismOutlinedIcon from '@mui/icons-material/VolunteerActivismOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined'
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined'
import SensorsOutlinedIcon from '@mui/icons-material/SensorsOutlined'
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined'
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined'
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import DirectionsWalkOutlinedIcon from '@mui/icons-material/DirectionsWalkOutlined'
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined'
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined'
import WebOutlinedIcon from '@mui/icons-material/WebOutlined'
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined'
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined'
import HistoryEduOutlinedIcon from '@mui/icons-material/HistoryEduOutlined'
import MailOutlinedIcon from '@mui/icons-material/MailOutlined'
import DraftsOutlinedIcon from '@mui/icons-material/DraftsOutlined'
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined'
import CATALOGO from '../../../shared/paginas-publicas.json'
import type { PanelResponse } from '../lib/api/panel'
import { cumple, type ClaveModulo, type Requisito } from '../domain/modulos'

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
 * «Junta» es de la junta de gobierno en sentido estricto: los datos e
 * informes de todas las áreas y el Informe anual (que también escribe
 * Secretaría, su epílogo).
 *
 * «Web pública» es el apartado del constructor de páginas: páginas de la web
 * pública compuestas por bloques, distinto de «Contenido», que son la portada,
 * con su formulario fijo, y lo que se publica por entradas (noticias,
 * publicaciones, agenda).
 */
export const GRUPOS = ['Web', 'Censo y procesión', 'Cuentas', 'Junta', 'Sistema'] as const
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
  /** De qué módulo es la entrada: apagado, no sale. `nucleo` es lo que no se apaga. */
  modulo: Requisito
  /** Se esconde si este módulo está encendido: «Ropero» solo vale cuando no hay «Inventario», que ya lo lleva dentro. */
  ocultoSiActivo?: ClaveModulo
}

const TODOS = ['ADMIN', 'HERMANO_MAYOR', 'SECRETARIA', 'TESORERIA', 'REDES', 'ALBACERIA']

export const itemsMenu: ItemMenu[] = [
  { label: 'Inicio', href: '/cms', roles: TODOS, grupo: 'suelta', icono: HomeOutlinedIcon, modulo: 'nucleo' },
  { label: 'Páginas', href: '/cms/paginas', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], grupo: 'Web', icono: WebOutlinedIcon, modulo: 'nucleo' },
  { label: 'Portada', href: '/cms/portada', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], grupo: 'Web', icono: ImageOutlinedIcon, modulo: 'nucleo' },
  { label: 'Noticias', href: '/cms/noticias', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], grupo: 'Web', icono: ArticleOutlinedIcon, contador: { de: 'noticiasBorradores', tono: 'aviso' }, modulo: 'noticias' },
  { label: 'Publicaciones', href: '/cms/publicaciones', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'], grupo: 'Web', icono: MenuBookOutlinedIcon, modulo: 'publicaciones' },
  { label: 'Boletín y avisos', href: '/cms/comunicados', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR', 'REDES'], grupo: 'Web', icono: EmailOutlinedIcon, modulo: 'comunicados' },
  // Las plantillas de los correos que manda la web: Secretaría, el Hermano Mayor y Administración.
  { label: 'Emails', href: '/cms/emails', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'], grupo: 'Web', icono: DraftsOutlinedIcon, modulo: 'nucleo' },
  { label: 'Agenda', href: '/cms/agenda', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'], grupo: 'Web', icono: CalendarMonthOutlinedIcon, modulo: 'agenda' },
  { label: 'Hermanos', href: '/cms/hermanos', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'], grupo: 'Censo y procesión', icono: GroupsOutlinedIcon, contador: { de: 'hermanosSinNumero', tono: 'aviso' }, modulo: 'nucleo' },
  // Los días de reparto y el plazo de la papeleta: los ve la Junta del censo, los cambia Secretaría.
  { label: 'Cartas', href: '/cms/cartas', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'], grupo: 'Censo y procesión', icono: MailOutlinedIcon, modulo: 'cartas' },
  { label: 'Procesión', href: '/cms/procesion', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'], grupo: 'Censo y procesión', icono: DirectionsWalkOutlinedIcon, modulo: 'procesion' },
  { label: 'Salidas', href: '/cms/procesion/salidas', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'], grupo: 'Censo y procesión', icono: EventRepeatOutlinedIcon, modulo: 'procesion' },
  // Apuntar a quien sale, con su ropa y cobrando: la Junta que está en la mesa.
  { label: 'Mesa de procesión', href: '/cms/procesion/mesa', roles: ['ADMIN', 'SECRETARIA', 'TESORERIA', 'ALBACERIA'], grupo: 'Censo y procesión', icono: HowToRegOutlinedIcon, modulo: 'procesion' },
  // Leer el QR de las papeletas al entrar: la Junta que está en la puerta.
  { label: 'Puerta del templo', href: '/cms/procesion/puerta', roles: ['ADMIN', 'SECRETARIA', 'TESORERIA', 'ALBACERIA', 'HERMANO_MAYOR'], grupo: 'Censo y procesión', icono: QrCodeScannerOutlinedIcon, modulo: 'puerta' },
  { label: 'Cortejo en directo', href: '/cms/procesion/directo', roles: ['ADMIN', 'SECRETARIA', 'ALBACERIA', 'HERMANO_MAYOR'], grupo: 'Censo y procesión', icono: SensorsOutlinedIcon, modulo: 'cortejo-directo' },
  { label: 'Inventario', href: '/cms/inventario', roles: ['ADMIN', 'ALBACERIA', 'HERMANO_MAYOR'], grupo: 'Censo y procesión', icono: Inventory2OutlinedIcon, modulo: 'inventario' },
  // Sin Inventario (los enseres) pero con Procesión, el ropero sigue existiendo: la
  // misma pantalla, con el nombre de lo único que enseña. Con Inventario encendido
  // no sale, porque Inventario ya lleva el ropero en su segunda pestaña.
  { label: 'Ropero', href: '/cms/inventario', roles: ['ADMIN', 'ALBACERIA', 'HERMANO_MAYOR'], grupo: 'Censo y procesión', icono: Inventory2OutlinedIcon, modulo: 'procesion', ocultoSiActivo: 'inventario' },
  { label: 'Apadrinamientos', href: '/cms/apadrinamientos', roles: ['ADMIN', 'ALBACERIA', 'TESORERIA', 'HERMANO_MAYOR'], grupo: 'Censo y procesión', icono: VolunteerActivismOutlinedIcon, modulo: 'apadrinamientos' },
  { label: 'Tesorería', href: '/cms/tesoreria', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'], grupo: 'Cuentas', icono: AccountBalanceWalletOutlinedIcon, modulo: 'nucleo' },
  { label: 'Tienda', href: '/cms/tienda', roles: ['ADMIN', 'SECRETARIA', 'TESORERIA', 'HERMANO_MAYOR'], grupo: 'Cuentas', icono: StorefrontOutlinedIcon, modulo: 'tienda' },
  // Los talonarios se reparten y se devuelven en Secretaría; el dinero lo lleva Tesorería.
  { label: 'Lotería', href: '/cms/loteria', roles: ['ADMIN', 'SECRETARIA', 'TESORERIA', 'HERMANO_MAYOR'], grupo: 'Cuentas', icono: ConfirmationNumberOutlinedIcon, modulo: 'loteria' },
  { label: 'Contabilidad', href: '/cms/contabilidad', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'], grupo: 'Cuentas', icono: BarChartOutlinedIcon, modulo: 'contabilidad' },
  { label: 'Datos e informes', href: '/cms/datos', roles: ['ADMIN', 'HERMANO_MAYOR'], grupo: 'Junta', icono: InsightsOutlinedIcon, modulo: 'nucleo' },
  { label: 'Informe anual', href: '/cms/informe-anual', roles: ['ADMIN', 'HERMANO_MAYOR', 'SECRETARIA'], grupo: 'Junta', icono: HistoryEduOutlinedIcon, modulo: 'informe-anual' },
  { label: 'Cabildos', href: '/cms/cabildos', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'], grupo: 'Junta', icono: HowToVoteOutlinedIcon, modulo: 'cabildos' },
  { label: 'Accesos', href: '/cms/accesos', roles: ['ADMIN'], grupo: 'Sistema', icono: ManageAccountsOutlinedIcon, modulo: 'nucleo' },
  // Encender y apagar módulos abre pantallas a toda la junta: solo Administración.
  { label: 'Módulos', href: '/cms/modulos', roles: ['ADMIN'], grupo: 'Sistema', icono: ExtensionOutlinedIcon, modulo: 'nucleo' },
  { label: 'Auditoría', href: '/cms/auditoria', roles: ['ADMIN', 'HERMANO_MAYOR'], grupo: 'Sistema', icono: FactCheckOutlinedIcon, modulo: 'nucleo' },
  { label: 'Ajustes del Inicio', href: '/cms/ajustes-inicio', roles: ['ADMIN', 'HERMANO_MAYOR'], grupo: 'cuenta', icono: TuneOutlinedIcon, modulo: 'nucleo' },
  { label: 'Mi seguridad', href: '/cms/mi-seguridad', roles: TODOS, grupo: 'cuenta', icono: ShieldOutlinedIcon, modulo: 'nucleo' },
]

/**
 * Lo que ve un cargo con estos módulos: su rol, el módulo de la entrada y la
 * regla de «Ropero». Fuera de los componentes para probarla sola.
 */
export function menuCmsVisible(items: ItemMenu[], role: string | undefined, activos: ReadonlySet<string>): ItemMenu[] {
  return items.filter((item) =>
    role !== undefined && item.roles.includes(role)
    && cumple(item.modulo, activos)
    && !(item.ocultoSiActivo && activos.has(item.ocultoSiActivo)))
}

// Los roles viven en su propio fichero, sin iconos, para que `routes/index.tsx`
// los lea sin arrastrar los del menú a la web pública; aquí se reexportan para
// que el menú y sus guardas se sigan leyendo (y probando) juntos.
export { rolesPorRutaCms } from './rolesCms'

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
