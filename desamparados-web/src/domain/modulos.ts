import CATALOGO from '../../../shared/modulos.json'

/**
 * Los módulos que una instalación puede apagar: la copia tipada de la web.
 * Van escritos aquí, y no solo en `shared/modulos.json`, para que
 * `pagina(TiendaPage, 'tiend')` no compile (el import de un JSON pierde los
 * literales). `__tests__/modulos.test.ts` comprueba que las dos listas son
 * la misma, en el mismo orden; el backend tiene su copia en
 * `src/domain/modulos.ts`.
 */
export const CLAVES_MODULO = [
  'noticias', 'publicaciones', 'agenda', 'comunicados', 'alta-web', 'area-hermanos',
  'procesion', 'puerta', 'cortejo-directo', 'inventario', 'cartas', 'difuntos', 'apadrinamientos',
  'remesas', 'pago-en-linea', 'cuotas-en-linea', 'donativos', 'tienda', 'tienda-web', 'loteria', 'modelo-182', 'contabilidad',
  'cabildos', 'informe-anual',
] as const
export type ClaveModulo = (typeof CLAVES_MODULO)[number]

/**
 * Los módulos «de instalación» (`deInstalacion` de `shared/modulos.json`), como
 * las páginas propias de una corporación: no salen en la pantalla de Módulos
 * ni se cambian desde el CMS, los enciende el fichero de la instalación. La
 * API los manda en la misma lista de activos, así que rutas, menús y páginas
 * preguntan por ellos igual que por los demás.
 */
export const CLAVES_DE_INSTALACION = ['paginas-propias'] as const
export type ClaveDeInstalacion = (typeof CLAVES_DE_INSTALACION)[number]

/** La marca de lo que no se apaga: cada pieza del núcleo lo dice, y la guardiana lo exige. */
export type Modulo = ClaveModulo | ClaveDeInstalacion | 'nucleo'
/** Lo que necesita una pieza: un módulo, o una lista que vale con cualquiera de ellos (el Inventario, con enseres o con ropero). */
export type Requisito = Modulo | Modulo[]

export interface FichaDeModulo {
  clave: ClaveModulo
  nombre: string
  /** El grupo del menú del CMS: la pantalla de Módulos agrupa igual. */
  grupo: string
  descripcion: string
  requiere: ClaveModulo[]
}

const CATALOGO_MODULOS = CATALOGO.modulos as FichaDeModulo[]

export const fichaDeModulo = (clave: ClaveModulo): FichaDeModulo => CATALOGO_MODULOS.find((m) => m.clave === clave)!

/** El nombre que se enseña de cualquier módulo, también de los de instalación. */
export const nombreDeModulo = (clave: Exclude<Modulo, 'nucleo'>): string =>
  [...CATALOGO_MODULOS, ...CATALOGO.deInstalacion].find((m) => m.clave === clave)?.nombre ?? clave

/** Si una pieza con este requisito se enseña con estos módulos encendidos. */
export function cumple(requisito: Requisito, activos: ReadonlySet<string>): boolean {
  const lista = Array.isArray(requisito) ? requisito : [requisito]
  return lista.some((m) => m === 'nucleo' || activos.has(m))
}

/**
 * Los módulos encendidos que requieren `clave`, directa o indirectamente:
 * mientras haya alguno, `clave` no se puede apagar. La misma regla que aplica
 * el servidor (`domain/modulos.ts` del backend), adelantada aquí para avisar
 * antes de preguntar. En el orden del catálogo.
 */
export function dependientesActivos(clave: ClaveModulo, activos: ReadonlySet<string>): ClaveModulo[] {
  const dependientes = new Set<ClaveModulo>()
  const visitar = (c: ClaveModulo) => {
    for (const m of CATALOGO_MODULOS) {
      if (!activos.has(m.clave) || dependientes.has(m.clave) || !m.requiere.includes(c)) continue
      dependientes.add(m.clave)
      visitar(m.clave)
    }
  }
  visitar(clave)
  return CLAVES_MODULO.filter((c) => dependientes.has(c))
}
