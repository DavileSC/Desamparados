/**
 * Roles que pasan la guarda de cada ruta del CMS. Aparte de `cmsNavegacion`
 * porque `routes/index.tsx` los necesita al arrancar cualquier página, también
 * las públicas, y aquel fichero importa los iconos del menú: no importar nada
 * aquí es lo que mantiene esos iconos fuera del trozo de entrada.
 *
 * Única fuente de verdad de las `ExigeRol` de `routes/index.tsx`.
 */
export const rolesPorRutaCms = {
  panel: ['ADMIN', 'REDES', 'SECRETARIA', 'HERMANO_MAYOR', 'TESORERIA', 'ALBACERIA'],
  // Las páginas por bloques: el índice y la pantalla de cada una, con los
  // mismos roles que el resto del contenido. Las dos claves llevan la misma
  // lista a propósito: son la misma pantalla en dos pasos, y dejar entrar al
  // índice a quien no puede abrir ninguna página sería enseñarle una lista de
  // enlaces que todos le rebotan.
  paginas: ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
  'paginas/:slug': ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
  // Las fotos de la cabecera son contenido: los mismos roles que las noticias.
  portada: ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
  noticias: ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
  publicaciones: ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
  // Los apadrinamientos: la guarda de /api/apadrinamientos/admin.
  apadrinamientos: ['ADMIN', 'ALBACERIA', 'TESORERIA', 'HERMANO_MAYOR'],
  // El cortejo en directo: la guarda de /api/cortejo-directo/admin.
  'procesion/directo': ['ADMIN', 'SECRETARIA', 'ALBACERIA', 'HERMANO_MAYOR'],
  // La puerta del templo: la guarda de /api/procesion/admin/puerta (rolesJunta).
  'procesion/puerta': ['ADMIN', 'SECRETARIA', 'TESORERIA', 'ALBACERIA', 'HERMANO_MAYOR'],
  // La tienda: la guarda de /api/tienda/admin.
  tienda: ['ADMIN', 'SECRETARIA', 'TESORERIA', 'HERMANO_MAYOR'],
  // La lotería: la guarda de /api/loteria.
  loteria: ['ADMIN', 'SECRETARIA', 'TESORERIA', 'HERMANO_MAYOR'],
  // Los cabildos y el libro de actas: la guarda de /api/cabildos.
  cabildos: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'],
  // El boletín y los avisos por correo: la guarda de /api/comunicados.
  comunicados: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR', 'REDES'],
  // Las plantillas de los correos: la guarda de /api/plantillas-correo.
  emails: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'],
  'emails/:id': ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'],
  agenda: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'],
  hermanos: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'],
  // Llevan los datos del censo: los mismos que lo gestionan (la guarda de /api/cartas).
  cartas: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'],
  procesion: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'],
  // Las salidas procesionales: la guarda de /api/cms/salidas. El Hermano Mayor
  // las ve, pero solo ADMIN y SECRETARIA pueden guardar (lo oculta la pantalla).
  'procesion/salidas': ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'],
  // Los mismos que pueden inscribir y cobrar en el backend (rolesMesaReparto).
  'procesion/mesa': ['ADMIN', 'SECRETARIA', 'TESORERIA', 'ALBACERIA'],
  tesoreria: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'],
  inventario: ['ADMIN', 'ALBACERIA', 'HERMANO_MAYOR'],
  contabilidad: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'],
  // Las cifras de todas las áreas y sus informes: la misma guarda que /api/datos.
  datos: ['ADMIN', 'HERMANO_MAYOR'],
  // El Informe anual lo escribe también Secretaría (su epílogo): la guarda de /api/datos/informe-anual.
  'informe-anual': ['ADMIN', 'HERMANO_MAYOR', 'SECRETARIA'],
  'informe-anual/:anio': ['ADMIN', 'HERMANO_MAYOR', 'SECRETARIA'],
  // Repartir cargos es repartir privilegios: ni el Hermano Mayor. El backend
  // lo estrecha igual (checkRole(SOLO_ADMIN) en adminRoutes).
  accesos: ['ADMIN'],
  // Los módulos de la instalación: solo Administración, como los accesos.
  modulos: ['ADMIN'],
  // Las visitas de la web pública: la guarda de /api/estadisticas-de-visitas.
  estadisticas: ['ADMIN', 'HERMANO_MAYOR'],
  // Los datos de contacto: la guarda de /api/cms/corporacion.
  corporacion: ['ADMIN', 'SECRETARIA'],
  auditoria: ['ADMIN', 'HERMANO_MAYOR'],
  // La foto del retablo del Inicio: la misma guarda que PUT /api/panel/retablo.
  'ajustes-inicio': ['ADMIN', 'HERMANO_MAYOR'],
  // La gestión del 2FA propio es de todo el staff: cada cuenta debe poder
  // protegerse, no solo la de ADMIN.
  'mi-seguridad': ['ADMIN', 'REDES', 'SECRETARIA', 'HERMANO_MAYOR', 'TESORERIA', 'ALBACERIA'],
} satisfies Record<string, string[]>
