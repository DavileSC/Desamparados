// src/dtos/auth.dto.ts

/** Qué es el menor para quien lo apunta (ver `PARENTESCOS` en auth.schema). */
export type Parentesco = 'HIJO' | 'SOBRINO' | 'NIETO' | 'AHIJADO' | 'OTRO';

/** Un menor a cargo del adulto que abre la cuenta. */
export interface MenorAltaDto {
  nombre: string;
  /** Sin ellos se heredan los del adulto, que es lo normal con un hijo. */
  apellidos?: string;
  primerApellido?: string;
  segundoApellido?: string;
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
    primerApellido?: string;
    segundoApellido?: string;
    telefono: string;  // Necesario para contacto
    direccion?: string;
    poblacion?: string;
    codigoPostal?: string;
    provincia?: string;
    comunidadAutonoma?: string;
    pais?: string;
    /** Quiere el boletín de noticias por correo. */
    boletin?: boolean;
    /** Autoriza publicar las fotos en que aparezca él y los menores que inscribe. */
    autorizaImagen?: boolean;
  };

  /** Su propia ficha en el censo. Sin esto, la cuenta no es de un hermano. */
  titular?: {
    fechaNacimiento: string; // 'AAAA-MM-DD'
    sexo: 'HOMBRE' | 'MUJER';
    estadoCivil: 'SOLTERO' | 'CASADO' | 'PAREJA_DE_HECHO' | 'SEPARADO' | 'DIVORCIADO' | 'VIUDO';
    fechaBautismo: string; // 'AAAA-MM-DD'
    lugarBautismo?: string;
    parroquiaBautismo?: string;
  };

  /** La cuota: domiciliada (con su cuenta) o en Secretaría. Sin él, en Secretaría. */
  pago?: {
    forma: 'DOMICILIACION' | 'EFECTIVO';
    iban?: string;
    /** Visto desde quien rellena el alta: él mismo, un familiar hermano u otra persona. */
    titularidad?: 'PROPIA' | 'FAMILIAR_HERMANO' | 'OTRA_PERSONA';
    titularCuenta?: string;
  };

  /** La foto y el certificado de bautismo que se adjuntan (nombres en storage/private). */
  documentos?: { foto?: string; certificadoBautismo?: string };

  /** Los menores que apunta. */
  menores?: MenorAltaDto[];

  /**
   * Campo trampa: en la web está escondido y ninguna persona lo ve. Si llega
   * con algo escrito, lo ha rellenado un programa.
   */
  comentarioAdicional?: string;
}

/** Pedir volver tras una baja. */
export interface ReactivacionDto {
  dni: string;
  email: string;
}

export interface LoginDto {
  email: string;
  password: string;
  /** «Recuérdame»: sesión persistente (2 días el CMS, 7 los hermanos) en vez de la duración por rol. */
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