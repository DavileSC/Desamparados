/**
 * Menú del CMS y roles que pasan la guarda de cada una de sus rutas.
 *
 * Las dos constantes viven juntas y fuera de los componentes por dos motivos:
 *
 * 1. `AdminLayout.test.tsx` las compara entre sí para que el menú y las guardas
 *    no puedan divergir sin que un test lo note (así se coló el hallazgo del
 *    Hermano Mayor expulsado de Tesorería, Contabilidad y Auditoría: el menú las
 *    enseñaba pero la guarda de ruta lo echaba a /area-hermano).
 *
 * 2. Exportarlas desde un fichero de componentes rompe el *fast refresh* de
 *    Vite, y tenerlas cruzadas entre `AdminLayout.tsx` y `routes/index.tsx`
 *    arriesgaba un ciclo de módulos: `routes/index.tsx` ya importa AdminLayout,
 *    así que si AdminLayout hubiera importado los roles de vuelta, el orden de
 *    inicialización de los ES modules podía dejar una de las dos leyendo
 *    `undefined` en el arranque. Este fichero no importa nada, de modo que el
 *    ciclo es imposible.
 */

export const itemsMenu = [
  { label: 'Panel', href: '/cms', roles: ['ADMIN', 'HERMANO_MAYOR', 'SECRETARIA', 'TESORERIA', 'REDES', 'ALBACERIA'] },
  { label: 'Portada', href: '/cms/portada', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'] },
  { label: 'Noticias', href: '/cms/noticias', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'] },
  { label: 'Publicaciones', href: '/cms/publicaciones', roles: ['ADMIN', 'REDES', 'HERMANO_MAYOR'] },
  { label: 'Agenda', href: '/cms/agenda', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'] },
  { label: 'Hermanos', href: '/cms/hermanos', roles: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'] },
  { label: 'Tesorería', href: '/cms/tesoreria', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'] },
  { label: 'Inventario', href: '/cms/inventario', roles: ['ADMIN', 'ALBACERIA', 'HERMANO_MAYOR'] },
  { label: 'Contabilidad', href: '/cms/contabilidad', roles: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'] },
  { label: 'Auditoría', href: '/cms/auditoria', roles: ['ADMIN', 'HERMANO_MAYOR'] },
  { label: 'Mi seguridad', href: '/cms/mi-seguridad', roles: ['ADMIN', 'HERMANO_MAYOR', 'SECRETARIA', 'TESORERIA', 'REDES', 'ALBACERIA'] },
]

/** Única fuente de verdad de las `RequireRole` de `routes/index.tsx`. */
export const rolesPorRutaCms = {
  panel: ['ADMIN', 'REDES', 'SECRETARIA', 'HERMANO_MAYOR', 'TESORERIA', 'ALBACERIA'],
  // Las fotos de la cabecera son contenido: los mismos roles que las noticias.
  portada: ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
  noticias: ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
  publicaciones: ['ADMIN', 'REDES', 'HERMANO_MAYOR'],
  agenda: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'],
  hermanos: ['ADMIN', 'SECRETARIA', 'HERMANO_MAYOR'],
  tesoreria: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'],
  inventario: ['ADMIN', 'ALBACERIA', 'HERMANO_MAYOR'],
  contabilidad: ['ADMIN', 'TESORERIA', 'HERMANO_MAYOR'],
  auditoria: ['ADMIN', 'HERMANO_MAYOR'],
  // La gestión del 2FA propio es de todo el staff: cada cuenta debe poder
  // protegerse, no solo la de ADMIN.
  'mi-seguridad': ['ADMIN', 'REDES', 'SECRETARIA', 'HERMANO_MAYOR', 'TESORERIA', 'ALBACERIA'],
} satisfies Record<string, string[]>
