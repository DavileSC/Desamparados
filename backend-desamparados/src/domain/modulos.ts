import catalogo from '../../../shared/modulos.json' with { type: 'json' };
import { leerDatosEntidad } from '../../../shared/datos-entidad.mjs';

/**
 * Los módulos que una instalación puede apagar. Van escritos aquí, y no solo
 * en `shared/modulos.json`, para que `conModulo('tiend')` no compile: el
 * import de un JSON pierde los literales y deja `string`. La prueba
 * `test/modulos-catalogo.test.ts` comprueba que las dos listas son la misma,
 * en el mismo orden. La web lleva su copia en `src/domain/modulos.ts`.
 */
export const CLAVES_MODULO = [
  'noticias', 'publicaciones', 'agenda', 'comunicados', 'alta-web', 'area-hermanos',
  'procesion', 'puerta', 'cortejo-directo', 'inventario', 'cartas', 'difuntos', 'apadrinamientos',
  'remesas', 'pago-en-linea', 'cuotas-en-linea', 'donativos', 'tienda', 'tienda-web', 'loteria', 'modelo-182', 'contabilidad',
  'cabildos', 'informe-anual',
] as const;
export type ClaveModulo = (typeof CLAVES_MODULO)[number];

/**
 * Los módulos «de instalación» (`deInstalacion` de `shared/modulos.json`): lo
 * hecho a medida para una corporación, como sus páginas propias. No son una
 * opción de Administración, así que no están en `CLAVES_MODULO` (ni en la
 * tabla `Modulo`, ni en la pantalla, ni en `cambiar`): los enciende el fichero
 * de la instalación y nada más. Escritos aquí por lo mismo que los otros.
 */
export const CLAVES_DE_INSTALACION = ['paginas-propias'] as const;
export type ClaveDeInstalacion = (typeof CLAVES_DE_INSTALACION)[number];
/** Todo lo que puede estar encendido: lo que pregunta una guarda, un menú o el sitemap. */
export type ClaveEncendible = ClaveModulo | ClaveDeInstalacion;

/**
 * La marca de lo que no se apaga. Existe para que cada pieza del núcleo lo
 * diga: la guardiana (`test/modulos-cobertura.test.ts`) no distingue «es del
 * núcleo» de «se olvidó la etiqueta» si no se escribe.
 */
export const NUCLEO = 'nucleo' as const;
export type Modulo = ClaveModulo | ClaveDeInstalacion | typeof NUCLEO;

export interface FichaDeModulo {
  clave: ClaveModulo;
  nombre: string;
  /** El grupo del menú del CMS, para agrupar la pantalla de Módulos igual. */
  grupo: string;
  descripcion: string;
  /** Dependencias duras: sin ellas encendidas, este no se enciende. */
  requiere: ClaveModulo[];
}

export const CATALOGO_MODULOS: readonly FichaDeModulo[] = catalogo.modulos as FichaDeModulo[];

export const esClaveDeModulo = (valor: unknown): valor is ClaveModulo =>
  typeof valor === 'string' && (CLAVES_MODULO as readonly string[]).includes(valor);

export const esClaveDeInstalacion = (valor: unknown): valor is ClaveDeInstalacion =>
  typeof valor === 'string' && (CLAVES_DE_INSTALACION as readonly string[]).includes(valor);

export const esClaveEncendible = (valor: unknown): valor is ClaveEncendible =>
  esClaveDeModulo(valor) || esClaveDeInstalacion(valor);

interface FichaDeInstalacion { clave: ClaveDeInstalacion; nombre: string; descripcion: string }
export const CATALOGO_DE_INSTALACION: readonly FichaDeInstalacion[] = catalogo.deInstalacion as FichaDeInstalacion[];

/** El nombre que se enseña de cualquier módulo, también de los de instalación («El módulo «…» no está activado»). */
export function nombreDeModulo(clave: ClaveEncendible): string {
  if (esClaveDeModulo(clave)) return fichaDe(clave).nombre;
  const ficha = CATALOGO_DE_INSTALACION.find((m) => m.clave === clave);
  if (!ficha) throw new Error(`El módulo «${clave}» no está en shared/modulos.json`);
  return ficha.nombre;
}

export function fichaDe(clave: ClaveModulo): FichaDeModulo {
  const ficha = CATALOGO_MODULOS.find((m) => m.clave === clave);
  if (!ficha) throw new Error(`El módulo «${clave}» no está en shared/modulos.json`);
  return ficha;
}

// Una sola lectura: cada `leerDatosEntidad` repetiría sus avisos en el log.
const ACTIVOS_DEL_FICHERO = leerDatosEntidad().modulos.activos;

/** Con qué arranca esta instalación. Una clave que no sea del catálogo se ignora. */
export const LOTE_INICIAL: readonly ClaveModulo[] = ACTIVOS_DEL_FICHERO.filter(esClaveDeModulo);

/**
 * Los módulos de instalación encendidos. A diferencia del lote, que solo
 * siembra filas la primera vez, esto se lee del fichero en cada arranque y
 * manda siempre: quitar una clave del fichero y reiniciar la apaga.
 */
export const DE_INSTALACION_ENCENDIDOS: readonly ClaveDeInstalacion[] = ACTIVOS_DEL_FICHERO.filter(esClaveDeInstalacion);

/**
 * Lo que hay que encender antes de encender `clave`: sus requisitos y los de
 * estos, sin los que ya están. Los más básicos primero, que es el orden en
 * que se encienden.
 */
export function requisitosQueFaltan(clave: ClaveModulo, activos: ReadonlySet<string>): ClaveModulo[] {
  const faltan: ClaveModulo[] = [];
  const vistos = new Set<ClaveModulo>([clave]);
  const visitar = (c: ClaveModulo) => {
    for (const r of fichaDe(c).requiere) {
      if (activos.has(r) || vistos.has(r)) continue;
      vistos.add(r);
      visitar(r);
      faltan.push(r);
    }
  };
  visitar(clave);
  return faltan;
}

/**
 * Los módulos encendidos que requieren `clave`, directa o indirectamente:
 * mientras haya alguno, `clave` no se puede apagar. En el orden del catálogo.
 */
export function dependientesActivos(clave: ClaveModulo, activos: ReadonlySet<string>): ClaveModulo[] {
  const dependientes = new Set<ClaveModulo>();
  const visitar = (c: ClaveModulo) => {
    for (const m of CATALOGO_MODULOS) {
      if (!activos.has(m.clave) || dependientes.has(m.clave) || !m.requiere.includes(c)) continue;
      dependientes.add(m.clave);
      visitar(m.clave);
    }
  };
  visitar(clave);
  return CLAVES_MODULO.filter((c) => dependientes.has(c));
}
