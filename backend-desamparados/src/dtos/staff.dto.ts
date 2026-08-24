import { Role } from '@prisma/client';

export { Role }; // Re-exportamos por si el controller lo necesita

export interface CreateStaffDto {
  email: string;
  password: string;
  role: Role;        // ADMIN, TESORERIA, ETC.
  
  // Datos personales (Obligatorios por el "Admin Fix")
  nombre: string;
  apellidos: string;
  dni: string;       
  telefono: string;
  
  direccion?: string; // Opcional
}

export interface UpdateStaffDto {
  email?: string;
  password?: string; // Opcional (solo si se quiere cambiar)
  role?: Role;
  
  nombre?: string;
  apellidos?: string;
  dni?: string;
  telefono?: string;
  direccion?: string;
}