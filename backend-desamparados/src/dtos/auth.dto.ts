// src/dtos/auth.dto.ts

/** Qué es el menor para quien lo apunta (ver `PARENTESCOS` en auth.schema). */
export type Parentesco = 'HIJO' | 'SOBRINO' | 'NIETO' | 'AHIJADO' | 'OTRO';

/** Un menor a cargo del adulto que abre la cuenta. */
export interface MenorAltaDto {
  nombre: string;
  /** Sin ellos se heredan los del adulto, que es lo normal con un hijo. */
  apellidos?: string;
  /** Un niño no tiene; uno de quince, casi siempre sí. */
  dni?: string;
  email?: string;
  parentesco?: Parentesco;
  fechaNacimiento: string; // 'AAAA-MM-DD'
}

/**
 * El alta, en sus tres caminos: solo `titular` (un adulto que se hace hermano),
 * `titular` y `menores` (y además apunta a quien tiene a su cargo), o solo
 * `menores` (no se hace hermano: su cuenta existe para gestionarlos).
 */
export interface RegisterDto {
  // DATOS DE CUENTA (OBLIGATORIOS)
  usuario: {
    email: string;
    password: string;
    dni: string;       // Necesario para User
    nombre: string;
    apellidos: string;
    telefono: string;  // Necesario para contacto
    direccion?: string;
    poblacion?: string;
    codigoPostal?: string;
  };

  /** Su propia ficha en el censo. Sin esto, la cuenta no es de un hermano. */
  titular?: {
    fechaNacimiento: string; // 'AAAA-MM-DD'
  };

  /** Los menores que apunta. */
  menores?: MenorAltaDto[];
}

/** Pedir volver tras una baja. */
export interface ReactivacionDto {
  dni: string;
  email: string;
}

export interface LoginDto {
  email: string;
  password: string;
  /** "Recordarme": sesión persistente de 72 h en vez de la duración por rol. */
  recordarme?: boolean;
  /** De qué login viene la petición: el 2FA solo se exige en el CMS. */
  contexto?: 'cms' | 'hermanos';
}

// =================================================================
//  RECUPERACIÓN DE CONTRASEÑA
// =================================================================

export interface RequestPasswordResetDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string; // Usaremos el validador 'password' que ya tienes
}