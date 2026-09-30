/** «jueves, 15 de octubre de 2026, 20:30», en la hora de Madrid, que es la del Grupo. */
export const fechaCabildo = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
