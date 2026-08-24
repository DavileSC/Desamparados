import { MetodoPago } from '@prisma/client';

// 1. EL AVISO DE ASISTENCIA (APP)
// Cuando el hermano dice "Iré el Martes"
export interface AvisarAsistenciaDto {
  turnoId: number;   // El ID del día elegido
  hermanoId: number; // Quién va
}

// 2. LA INSCRIPCIÓN EN MESA (ADMIN)
// Cuando se genera el recibo, la papeleta y se da la túnica
export interface CrearInscripcionManualDto {
  hermanoId: number;

  // Si venía de un aviso previo (opcional). 
  // Si es null o undefined, es alguien que entró sin avisar.
  citaId?: number; 

  // --- DATOS ECONÓMICOS ---
  metodoPago: MetodoPago; // 'EFECTIVO', 'TARJETA', 'BIZUM', etc.

  // --- DATOS PROCESIÓN ---
  puesto: string;   // "Cirio", "Costalero", "Diputado"
  tramo?: string;   // Opcional

  // --- DATOS ROPA (ALBACERÍA) ---
  // Lo que se lleva puesto en ese momento
  numTunicaAsignada?: string;   // Ej: "T-045"
  numCapiroteAsignado?: string; // Ej: "C-12"
  
  observaciones?: string;
}

// 3. CREACIÓN DE TURNOS DE REPARTO (ADMIN)
// Cuando Secretaría abre un nuevo día en el calendario
export interface CrearTurnoDto {
  fecha: string;             // Cadena ISO (ej: "2026-03-15")
  horaInicio: string;        // Cadena ISO
  horaFin: string;           // Cadena ISO
  capacidadEstimada: number; // Cuántos hermanos se espera atender
}