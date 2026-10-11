import db from '../config/db.js';
import { ACCIONES_AUDITORIA, AuditoriaService, type MetaDeAuditoria } from './auditoria.service.js';
import { aplicarContacto, contactoDelFichero, type DatosDeContacto } from '../domain/datos-entidad.js';

/** La fila de `Configuracion` donde se guardan, en JSON. */
const CLAVE = 'corporacion_contacto';

let enMemoria: DatosDeContacto | null = null;
let cargando: Promise<DatosDeContacto> | null = null;

/**
 * Lo guardado, con lo que falte rellenado desde el fichero: una fila de antes
 * de que existiera una red nueva no deja la red en `undefined`.
 */
function completar(guardado: Partial<DatosDeContacto>): DatosDeContacto {
  const base = contactoDelFichero();
  return {
    secretaria: { ...base.secretaria, ...guardado.secretaria },
    sede: { ...base.sede, ...guardado.sede },
    redes: { ...base.redes, ...guardado.redes },
    privacidad: { ...base.privacidad, ...guardado.privacidad },
  };
}

/**
 * Secretaría, la sede, las redes y el correo de los derechos: en la base, y
 * editables desde Sistema → «Datos de la corporación». La primera vez se
 * siembran del fichero de la instalación y desde entonces manda la base, como
 * con los módulos: cambiar el fichero ya no los toca.
 */
export class CorporacionService {
  /** Lee la base (sembrando si está vacía) y lo deja en memoria para los correos y los PDF. */
  static async cargar(): Promise<DatosDeContacto> {
    const fila = await db.configuracion.findUnique({ where: { key: CLAVE } });
    let datos: DatosDeContacto;
    if (fila) {
      try { datos = completar(JSON.parse(fila.value) as Partial<DatosDeContacto>); }
      catch {
        // Una fila rota no deja la web sin contacto: se avisa y se arranca con el fichero.
        console.error(`[Corporación] La fila ${CLAVE} no es un JSON válido: se usan los datos del fichero.`);
        datos = contactoDelFichero();
      }
    } else {
      datos = contactoDelFichero();
      // `upsert` y no `create`: dos arranques a la vez no chocan.
      await db.configuracion.upsert({
        where: { key: CLAVE }, update: {},
        create: { key: CLAVE, value: JSON.stringify(datos), descripcion: 'Secretaría, sede, redes y privacidad (Sistema → Datos de la corporación)' },
      });
    }
    enMemoria = datos;
    aplicarContacto(datos);
    return datos;
  }

  static async leer(): Promise<DatosDeContacto> {
    if (enMemoria) return enMemoria;
    // Varias peticiones a la vez comparten una sola carga.
    cargando ??= CorporacionService.cargar().finally(() => { cargando = null; });
    return cargando;
  }

  static async guardar(nuevos: DatosDeContacto, meta: MetaDeAuditoria): Promise<DatosDeContacto> {
    const antes = await CorporacionService.leer();
    const datos = completar(nuevos);
    await db.configuracion.upsert({
      where: { key: CLAVE },
      update: { value: JSON.stringify(datos) },
      create: { key: CLAVE, value: JSON.stringify(datos), descripcion: 'Secretaría, sede, redes y privacidad (Sistema → Datos de la corporación)' },
    });
    enMemoria = datos;
    aplicarContacto(datos);
    await AuditoriaService.log(ACCIONES_AUDITORIA.CORPORACION_ACTUALIZAR, meta, 'config', CLAVE, JSON.parse(JSON.stringify({ antes, despues: datos })));
    return datos;
  }

  /** Para las pruebas: que la próxima lectura vuelva a la base. */
  static olvidar(): void {
    enMemoria = null;
  }
}
