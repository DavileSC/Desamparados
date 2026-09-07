// src/dtos/auth.dto.ts

export interface RegisterDto {
  isTutor: boolean; 

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

  // DATOS DEL COFRADE (Opcionales)
  // Al registrarse, solo nos interesa quién es y cuándo nació.
  // El tema de túnicas y alturas se ve luego.
  hermano?: {
    nombre?: string;
    apellidos?: string;
    fechaNacimiento: string; // ISO String (Obligatorio)
    dni?: string;
    
    // Dejamos esto opcional por si es el ADMIN quien registra a alguien 
    // en la casa grupo parroquial "a full", pero en la web no se pide.
    tieneTunicaPropia?: boolean;
    tunica?: string;       
    alturaHombro?: number;    
    puesto?: string;  
  };
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