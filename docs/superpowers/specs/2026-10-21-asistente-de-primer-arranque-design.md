# Asistente de primer arranque

21-10-2026. Fila «Asistente de primer arranque en el CMS» de la hoja de ruta
(PC A). Decidido el 13-10-2026: nada de web de instalación (servidor, dominio,
certificado y Docker siguen en `instalar.sh`); la primera vez que entra
Administración, el CMS la lleva paso a paso por lo que hace suya la web, sin
depender de quien instala.

## Cuándo sale

- Solo a ADMIN. Mientras no esté terminado, al entrar en el CMS se abre
  `/cms/bienvenida` en lugar del Inicio.
- «Seguir más tarde» lo cierra; en el Inicio queda una franja «Te quedan N
  pasos» que vuelve a abrirlo hasta acabarlo. Se retoma en el paso en que se
  dejó.
- **Las instalaciones que ya están en marcha no lo ven**: la primera vez que
  arranca la API con esto, si la base ya tiene hermanos o noticias, se da por
  terminado. Así ni el Grupo ni la web de pruebas lo encuentran al desplegar.
- Se puede volver a abrir desde Sistema → «Datos de la corporación» («Repasar
  con el asistente»), sin que vuelva a salir solo.

## Los pasos

Cada paso guarda al pulsar «Siguiente» con las rutas que ya existen; no hay
datos nuevos, solo un camino ordenado por las pantallas de siempre.

1. **El nombre**: nombre, nombre corto, tipo, artículo, titulares, localidad
   y descripción (la ficha «Identidad» de «Identidad y marca»).
2. **El escudo**: escudo sobre oscuro y sobre claro (se guardan al subirlos,
   como hoy). El destacado, la imagen de compartir y la cabecera de los correos,
   plegados en «Más imágenes (se pueden poner luego)».
3. **Los colores**: principal y acento, con la muestra y los avisos de
   contraste. Se puede dejar los de partida.
4. **El contacto**: Secretaría, sede y redes (la pestaña Contacto).
5. **Los datos legales**: denominación, domicilio y normas. Se puede saltar:
   los textos legales lo dicen como pendiente.
6. **Las secciones**: los módulos, con sus mismas reglas (qué requiere qué).
7. **Listo**: resumen de lo puesto y lo que falta, con «Ver la web» y «Ir al
   CMS».

Solo el paso 1 es obligatorio para seguir; los demás tienen «Saltar este
paso». Lo saltado sale en el resumen y en la franja del Inicio.

## Reutilizar, no copiar

Las fichas de `IdentidadYMarca.tsx` (Identidad, Datos legales, Colores,
Imágenes), el formulario de `Contacto` y la lista de `ModulosAdminPage` se
sacan a componentes que reciben «qué hacer al guardar»: los usan su pantalla de
siempre y el asistente. Una regla nueva en uno sale en los dos.

## La API

- `Configuracion`, clave `asistente_inicial`: `{ paso, saltados, terminado }`
  (`terminado`: fecha o null). Sin migración.
- `GET /api/cms/corporacion/asistente` y `PUT` (solo ADMIN): leer y apuntar
  el paso, los saltados y el final. Auditoría al terminarlo
  (`ASISTENTE_TERMINAR`).
- El Inicio lo pide solo si quien entra es Administración: una petición más
  para un rol, en vez de tocar la sesión de todos.
- Siembra al arrancar la API, junto a la de la marca: sin la fila, `terminado` si hay
  hermanos o noticias; si no, pendiente.

## La web

- Pantalla propia sin el menú del CMS (solo «Seguir más tarde»). Forma C de
  las maquetas (https://claude.ai/artifact/WKaAdSx3XuNyYtnvaVdjee): el paso a
  la izquierda con una barra de progreso y a la derecha «Así queda» (barra,
  portada, correo e icono, con lo que se va escribiendo); en el móvil, la
  vista va encima, en pequeño.
- «Seguir más tarde» vale para la sesión del navegador (`sessionStorage`):
  al volver a entrar, sale otra vez.
- «Ir al CMS», al terminar, recarga la página: el nombre y los colores del
  CMS se leen al cargarla.
- Adaptable: móvil, tableta y el portátil de 1280×552.

## Pruebas

- Backend: siembra (base vacía → pendiente; con hermanos → terminado), solo
  ADMIN, guardar paso y terminar.
- Web: redirige al entrar solo si está pendiente y es ADMIN; avanzar,
  saltar, retomar; los componentes compartidos siguen funcionando en sus
  pantallas.

## Despliegue

Sin migración ni nada a mano: en el VPS de pruebas y en el del Grupo se siembra
como terminado.
