// Tipos de datos-entidad.mjs, para importarlo desde TypeScript (la API y la
// configuración de Vite). La forma es la de datos-entidad.ejemplo.json; los
// `_comentario` del fichero no se leen y no van aquí.

export interface DatosEntidad {
  identidad: {
    nombre: string
    tipo: string
    tipoCorto: string
    articulo: string
    nombreCorto: string
    titular: string
    localidad: string
    dominio: string
    descripcion: string
    denominacion: string | null
  }
  secretaria: {
    horario: string | null
    telefono: string | null
    email: string | null
  }
  sede: {
    nombre: string | null
    calle: string | null
    codigoPostal: string | null
    localidad: string | null
  }
  modulos: { activos: string[] }
  escudoUrl: string | null
}

export declare const RUTA_INSTALACION: string
export declare const RUTA_EJEMPLO: string
export declare function rutaDeDatosEntidad(entorno?: Readonly<Record<string, string | undefined>>): string
export declare function leerDatosEntidad(entorno?: Readonly<Record<string, string | undefined>>): DatosEntidad
