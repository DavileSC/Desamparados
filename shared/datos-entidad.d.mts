// Tipos de datos-entidad.mjs, para importarlo desde TypeScript (la API, la web y
// la configuración de Vite). Es la forma que devuelve `validarDatosEntidad`, ya
// con los opcionales rellenos: un `null` es «pendiente de confirmar». Los
// `_comentario` del fichero no se leen y no van aquí.

export type Articulo = 'el' | 'la' | 'los' | 'las'
export type Red = 'facebook' | 'instagram' | 'x' | 'tiktok' | 'youtube'

export interface Identidad {
  nombre: string
  nombreCorto: string
  tipo: string
  tipoCorto: string
  articulo: Articulo
  titular: string
  localidad: string
  dominio: string
  descripcion: string
  denominacion: string | null
  domicilio: string | null
  /** Las normas o estatutos por los que se rige, enlazados desde el aviso legal. */
  normas: { titulo: string; url: string } | null
}

export interface Marca {
  colorPrincipal: string | null
  colorAcento: string | null
}

export interface Secretaria {
  horario: string | null
  telefono: string | null
  email: string | null
}

export interface Sede {
  nombre: string | null
  calle: string | null
  codigoPostal: string | null
  localidad: string | null
}

export interface DatosEntidad {
  identidad: Identidad
  marca: Marca
  /** Secretaría, sede, redes y privacidad solo siembran la base: después mandan las del CMS. */
  secretaria: Secretaria
  sede: Sede
  redes: Record<Red, string | null>
  privacidad: { emailDerechos: string | null }
  modulos: { activos: string[] }
}

export interface Validacion {
  datos: DatosEntidad | null
  errores: string[]
  avisos: string[]
}

export declare const RUTA_INSTALACION: string
export declare const RUTA_EJEMPLO: string
export declare const ARTICULOS: readonly Articulo[]
export declare const REDES: readonly Red[]
export declare function rutaDeDatosEntidad(entorno?: Readonly<Record<string, string | undefined>>): string
export declare function sinBom(texto: string): string
export declare function validarDatosEntidad(crudo: unknown): Validacion
export declare function leerDatosEntidad(entorno?: Readonly<Record<string, string | undefined>>): DatosEntidad
