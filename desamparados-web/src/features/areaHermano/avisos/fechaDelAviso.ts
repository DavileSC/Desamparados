/** «14 de octubre de 2026»: el día en que se mandó el aviso. */
export const fechaDelAviso = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
