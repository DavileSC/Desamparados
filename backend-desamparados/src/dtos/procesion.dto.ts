import type { PuestoDelCatalogo } from '../domain/salidas.js';
import type { ConfiguracionCortejo } from '../domain/cortejo.js';
import type { Articulo } from '../domain/articulos.js';

// 1. LA SOLICITUD DE LA PAPELETA (ÁREA DE HERMANOS)
// Cuando el hermano dice "Quiero salir de cirio y pasaré el martes"
export interface AvisarAsistenciaDto {
  turnoId: number;   // El ID del día elegido (de él sale la salida)
  hermanoId: number; // Quién va
  /** El puesto que le gustaría. Lo decide el Grupo: la mesa lo confirma o lo cambia. */
  puesto: string;
  /** Solo en las salidas de donativo: la voluntad que da, en euros (0 es válido). */
  donativo?: number;
}

// 2. CREACIÓN DE TURNOS DE REPARTO (ADMIN)
// Cuando Secretaría abre un nuevo día en el calendario
export interface CrearTurnoDto {
  fecha: string;             // Cadena ISO (ej: "2026-03-15")
  horaInicio: string;        // Cadena ISO
  horaFin: string;           // Cadena ISO
  capacidadEstimada: number; // Cuántos hermanos se espera atender
  /** El slug de la salida del reparto: el controlador la busca y la pasa al servicio. */
  salida: string;
}

// 3. LA SALIDA PROCESIONAL (CMS)
// Lo que da de alta o cambia Secretaría. La fecha a mano no entra aquí: se
// fija con su propia ruta (crea el acto de la Agenda).
export interface DatosSalida {
  nombre: string;
  slug: string;
  /** Con qué se escribe «del Sábado de Pasión» o «de la Procesión Magna» (domain/articulos.ts). */
  articulo: Articulo;
  orden: number;
  activa: boolean;
  conRopa: boolean;
  cobro: 'CUOTA' | 'DONATIVO';
  importeCuota: number;
  fecha: 'PASCUA' | 'MANUAL';
  diasDesdePascua: number | null;
  horaSalida: string | null;
  lugar: string | null;
  puestos: PuestoDelCatalogo[];
  indicaciones: string | null;
}

/** La salida tal como la necesitan la web y el CMS: su fila y la fecha de este año, ya calculada. */
export interface SalidaWeb {
  id: number;
  slug: string;
  nombre: string;
  articulo: Articulo;
  orden: number;
  activa: boolean;
  conRopa: boolean;
  cobro: 'CUOTA' | 'DONATIVO';
  importeCuota: number;
  fecha: 'PASCUA' | 'MANUAL';
  diasDesdePascua: number | null;
  horaSalida: string | null;
  lugar: string | null;
  eventoId: number | null;
  plazoAbierto: boolean;
  puestos: PuestoDelCatalogo[];
  cortejo: ConfiguracionCortejo | null;
  indicaciones: string | null;
  /** El año de la próxima vez que sale (anioDeLaSalida). */
  anio: number;
  /** Su fecha ese año (fechaDeSalida), AAAA-MM-DD; null si una MANUAL no la tiene todavía. */
  fechaDelAnio: string | null;
  /**
   * El acto de la Agenda de una salida a mano, con su día, su hora y su
   * lugar; `null` en una `PASCUA` o en una `MANUAL` sin fecha fijada todavía.
   * `fechaDelAnio` solo da el día: esto es lo que necesita el CMS para
   * rellenar el formulario con lo que ya hay fijado.
   */
  acto: { inicio: string; lugar: string | null } | null;
}

/** La salida en la lista del CMS: lo de la web y lo que la ficha necesita para avisar. */
export interface SalidaCms extends SalidaWeb {
  /** Solicitudes de su año (`anio`) aún sin recoger: con ellas, cambiar la fecha o el cobro pide avisar a esos hermanos. */
  solicitudesPendientes: number;
}
