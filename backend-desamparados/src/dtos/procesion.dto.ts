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
