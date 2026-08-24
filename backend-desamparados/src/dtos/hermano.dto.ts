// Datos que un usuario puede rellenar al crear un familiar
export interface CreateHermanoDto {
  nombre: string;
  apellidos: string;
  fechaNacimiento: string;
  dni?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  poblacion?: string;
  codigoPostal?: string;
}

// Datos que un usuario puede editar de su propia ficha o la de sus familiares
export interface UpdateHermanoDto {
  nombre?: string;
  apellidos?: string;
  fechaNacimiento?: string;
  dni?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  poblacion?: string;
  codigoPostal?: string;
}

// Datos que SOLO Secretaría puede editar (Todo lo anterior + Privilegios Cofrades)
export interface UpdateAdminHermanoDto extends UpdateHermanoDto {
  tieneTunicaPropia?: boolean;
  tunica?: string;       
  alturaHombro?: number; 
  puesto?: string;       
}

export interface EmancipateHermanoDto {
  newEmail: string;
  newPassword: string;
  newDni?: string; 
}