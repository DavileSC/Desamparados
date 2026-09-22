// Datos que un usuario puede rellenar al crear un familiar
export interface CreateHermanoDto {
  nombre: string;
  apellidos?: string;
  primerApellido?: string;
  segundoApellido?: string | null;
  fechaNacimiento: string;
  /** Qué es para quien lo apunta: no todo menor a cargo de alguien es su hijo. */
  parentesco?: 'HIJO' | 'SOBRINO' | 'NIETO' | 'AHIJADO' | 'OTRO';
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
  /** Juntos, de los clientes de antes; los nuevos mandan los dos de abajo. */
  apellidos?: string;
  primerApellido?: string;
  segundoApellido?: string | null;
  fechaNacimiento?: string;
  dni?: string;
  sexo?: 'HOMBRE' | 'MUJER' | null;
  estadoCivil?: 'SOLTERO' | 'CASADO' | 'PAREJA_DE_HECHO' | 'SEPARADO' | 'DIVORCIADO' | 'VIUDO' | null;
  profesion?: string | null;
  lugarNacimiento?: string | null;
  telefono?: string;
  telefonoFijo?: string | null;
  email?: string;
  email2?: string | null;
  direccion?: string;
  poblacion?: string;
  codigoPostal?: string;
  provincia?: string | null;
  comunidadAutonoma?: string | null;
  pais?: string | null;
  boletin?: boolean;
  fechaBautismo?: string | null;
  lugarBautismo?: string | null;
  parroquiaBautismo?: string | null;
  formaPagoPref?: 'EFECTIVO' | 'BIZUM' | 'TRANSFERENCIA' | 'TARJETA' | 'DOMICILIACION';
  iban?: string | null;
  titularCuenta?: string | null;
  titularidadCuenta?: 'PROPIA' | 'FAMILIAR_HERMANO' | 'OTRA_PERSONA' | null;
  parentesco?: 'HIJO' | 'SOBRINO' | 'NIETO' | 'AHIJADO' | 'OTRO';
}

// Datos que SOLO Secretaría puede editar (Todo lo anterior + Privilegios Cofrades)
// Sin `activo`: las altas y bajas tienen sus propias operaciones (aprobar,
// reactivar, dar de baja), que asignan número, tocan la cuenta y dejan rastro.
export interface UpdateAdminHermanoDto extends UpdateHermanoDto {
  tieneTunicaPropia?: boolean;
  tunica?: string;
  alturaHombro?: number;
  puesto?: string;
  esTitular?: boolean;
  numeroHermano?: number;
  fechaAlta?: string;
  // Solo en fichas ya dadas de baja: corrige la fecha, no da la baja.
  fechaBaja?: string;
  fechaJura?: string | null;
  presentadoPor?: string | null;
  presentadoPor2?: string | null;
}

// Baja desde secretaría: sin fecha, se toma la de hoy.
export interface BajaHermanoDto {
  fechaBaja?: string;
}

export interface EmancipateHermanoDto {
  newEmail: string;
  newPassword: string;
  newDni?: string; 
}