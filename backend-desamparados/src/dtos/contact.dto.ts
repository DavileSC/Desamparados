/** Lo que llega al correo de la secretaría. */
export interface ContactDto {
  nombre: string;
  email: string;
  telefono?: string; // Opcional: '' o ausente si no lo han escrito
  asunto: string;
  mensaje: string;
}

/** El cuerpo del formulario tal y como lo manda la web, con las señales antispam. */
export interface ContactFormDto extends ContactDto {
  comentarioAdicional?: string; // Campo trampa: una persona lo deja vacío
  tiempoRelleno?: number; // Milisegundos entre abrir el formulario y enviarlo
}
