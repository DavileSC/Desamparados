# Editar en pantalla propia, ficha completa del hermano y emancipación desde el CMS

Diseño acordado el 29 de agosto de 2026.

## El problema

El CMS se construyó y se probó con la base casi vacía. Al llenarla con trescientos
hermanos salieron a la vista tres cosas que con un hermano no se veían:

- **Se edita debajo del listado.** Al pulsar «Editar» aparece un formulario al
  final de la página, con las trescientas fichas todavía encima. Hay que bajar a
  buscarlo, y no queda claro qué se está editando ni cómo se sale.
- **La ficha del hermano se queda corta.** El servidor acepta dieciséis campos;
  el CMS enseña cinco (nombre, apellidos, correo, teléfono y número de hermano).
  Lo demás —DNI, fecha de nacimiento, dirección, población, tallaje, puesto— no
  se puede corregir desde ningún sitio.
- **La barra lateral se va con el scroll.** En Tesorería la página mide veinte
  mil píxeles: se navega a ciegas, sin menú a la vista.

Y una cuarta que no se ve en pantalla porque no está: **la emancipación existe
en el servidor pero no en el CMS**. `POST /hermanos/mis-perfiles/:id/emancipar`
la puede llamar el tutor sobre su propio dependiente, con transacción, control
del gestor fantasma y auditoría. Secretaría no tiene forma de hacerlo, y es
quien atiende al hermano que viene a la casa parroquial a pedirlo.

## Decisiones tomadas

| Decisión | Qué se eligió | Por qué |
|---|---|---|
| Contraseña al emancipar desde el CMS | El sistema envía un enlace al hermano | Secretaría no debe conocer la contraseña de nadie. Con el flujo de hoy tendría que inventársela y dictarla por teléfono. |
| Confirmación en la edición | Al guardar **y** al salir con cambios | Son los dos sustos típicos: escribir sin querer y perder lo escrito. |
| Datos bancarios (IBAN, titular, forma de pago) | Fuera de esta fase | No hay domiciliaciones reales todavía; abrirlos ahora es exponer datos sin necesidad. |
| Orden de trabajo | Menú fijo y edición en pantalla propia primero | Es lo que más se nota al usar el CMS a diario. |
| Alta de contenido nuevo | Se queda como está, en línea sobre el listado | Lo que molesta es editar, no crear: el formulario de alta está arriba y se ve entero. La pantalla nueva servirá igual si más adelante se quiere mover. |
| Solicitudes de alta en el CMS | Pestaña propia dentro de Hermanos, con el número de pendientes | Hoy la sección desaparece entera cuando no hay ninguna, y nadie puede saber que existe. |
| Quién aprueba altas | También el Hermano Mayor | Ya tiene acceso a todo salvo la administración del sistema; que no pueda admitir hermanos se queda descolgado. |
| Solicitudes en el censo de demostración | Se siembran unas cuantas | Sin ellas esa mitad de la pantalla no se puede ver ni probar sin darse de alta a mano desde la web. |

## 1. Barra lateral fija

El `aside` de `AdminLayout` pasa a `position: sticky`, pegado arriba y con la
altura de la ventana, con scroll propio por si el menú creciera. En móvil no
cambia nada: sigue siendo el cajón que se abre con el botón y se cierra al
elegir sección.

**Se comprueba** con un test que exige que el contenedor del menú sea `sticky` y
ocupe el alto de la ventana, y a ojo en el navegador bajando del todo en
Tesorería.

## 2. Editar en su propia pantalla

### Rutas

Cada ficha se edita en su URL, colgando de la sección a la que pertenece:

```
/cms/hermanos/:id/editar
/cms/noticias/:id/editar
/cms/publicaciones/:id/editar
/cms/agenda/:id/editar
/cms/inventario/:id/editar
```

Ser una ruta y no un panel superpuesto da tres cosas gratis: el enlace se puede
pasar a otra persona, el botón atrás del navegador hace lo que se espera, y el
listado desaparece de verdad en vez de quedarse debajo.

Cada ruta de edición lleva **la misma guarda de rol que su listado**, tomada de
`rolesPorRutaCms`. El test que hoy compara el menú con las guardas se amplía
para cubrir también las rutas de edición: si alguien añade una sección y olvida
la guarda de su pantalla de edición, el test lo dice.

### El componente compartido

`PantallaEdicion` envuelve las cinco: cabecera con el título de lo que se está
editando, el contenido del formulario, y una barra de acciones con **Guardar** y
**Cancelar**. Recibe el título, si el formulario está sucio, qué hacer al
guardar y a dónde volver. Nada más: cada pantalla sigue siendo dueña de sus
campos.

### Las dos confirmaciones

- **Al guardar**: un diálogo que nombra lo que se va a cambiar («¿Guardar los
  cambios en la ficha de Fulano de Tal?»), con Guardar y Volver.
- **Al salir con cambios sin guardar**: aviso de que se van a perder. No basta
  con atarlo al botón Cancelar; se engancha `useBlocker` de react-router, así
  que salta igual si se navega con el botón atrás del navegador o pulsando otra
  sección en el menú lateral. El router de la aplicación es un
  `createBrowserRouter`, así que `useBlocker` está disponible.

Si no se ha tocado nada, Cancelar sale sin preguntar: avisar de que se pierden
cambios que no existen enseña a la gente a ignorar los avisos.

**Ojo con los tests**: `AllTheProviders` monta un `BrowserRouter`, que no es un
data router y no soporta `useBlocker`. Los tests de las pantallas de edición
montarán un `createMemoryRouter` propio.

### De paso: los borrados

Las cinco pantallas confirman los borrados con `window.confirm()` del navegador.
Ya que se introduce un diálogo propio para guardar y para salir con cambios, los
borrados pasan a usar el mismo, con el nombre de lo que se va a borrar dentro
(«¿Eliminar la noticia *Apertura del curso cofrade*?»). Un `confirm` nativo no
dice qué se está borrando, no se puede leer bien en el móvil y no se parece en
nada al resto del CMS.

Queda **fuera** un caso aparte de Inventario: al devolver una prenda se usa un
`window.confirm` para preguntar si necesita lavado o taller. Eso no es una
confirmación, es un dato que se está recogiendo con la herramienta equivocada, y
arreglarlo es cambiar ese flujo, no el diálogo.

## 3. La ficha completa del hermano

Los dieciséis campos que el servidor ya acepta, repartidos en cuatro bloques
para que la pantalla se pueda leer:

| Bloque | Campos |
|---|---|
| Datos personales | nombre, apellidos, DNI, fecha de nacimiento |
| Contacto | teléfono, correo, dirección, población, código postal |
| Hermandad | número de hermano, activo, es titular de la cuenta |
| Procesión | túnica propia, talla de túnica, altura de hombro, puesto |

### Un cambio en el servidor

`updateAdminHermanoSchema` no admite hoy **la fecha de alta ni la de baja**, y
son justo las que secretaría corrige a mano cuando se regulariza una ficha
antigua. Se añaden las dos, con una regla: **la baja nunca puede ser anterior al
alta**, y quitar la fecha de baja de alguien vuelve a ponerlo activo. La regla
vive en el servicio, no solo en el formulario, porque el CMS no es el único que
puede llamar a ese endpoint.

Los datos bancarios se quedan fuera, según lo decidido.

## 4. Tutor y emancipación

### Lo que se ve en la ficha

Un bloque que responde a dos preguntas que hoy no tienen respuesta en el CMS:
**de qué cuenta depende este hermano** (el titular, con su nombre y correo) y
**quién más comparte esa cuenta**. Si un dependiente ya ha cumplido dieciocho
años, un aviso lo señala: es el momento de emanciparlo, y nadie lleva esa cuenta
a mano.

### La acción de emancipar

Botón **Emancipar** para el rol de secretaría, visible solo en fichas que
dependen de la cuenta de otra persona. Pide el correo del hermano y nada más.

Al confirmar, el servidor, en una transacción:

1. Comprueba que la ficha está activa y que tiene DNI (si no lo tiene, lo pide
   en el mismo formulario: la cuenta nueva lo necesita).
2. Comprueba que ni el correo ni el DNI pertenecen ya a otra cuenta. Si alguno
   sí, responde 409 y no toca nada.
3. Crea la cuenta con rol `USER` y **una contraseña aleatoria que nadie conoce y
   con la que no se puede entrar**, porque la cuenta nace sin contraseña útil a
   propósito.
4. Emite un token de restablecimiento —el mismo mecanismo que ya existe, con el
   token guardado hasheado— pero con **72 horas de validez** en lugar de una:
   quien se emancipa no está delante de la pantalla en ese momento.
5. Envía al correo indicado el enlace para poner contraseña.
6. Mueve la ficha a la cuenta nueva y la marca como titular.
7. Si el tutor se queda sin ningún hermano activo a su cargo y no es staff,
   desactiva su cuenta. Es el «control del gestor fantasma» que ya está escrito.
8. Deja constancia en auditoría de quién emancipó a quién.

### El endpoint

```
POST /api/hermanos/admin/:id/emancipar     (rol secretaría)
body: { newEmail, newDni? }
```

El servicio actual se reparte en dos caminos sobre el mismo tronco: **el del
tutor**, que fija contraseña y es el que ya existe y no cambia, y **el del
staff**, que no recibe contraseña y manda el enlace. Todo lo demás —las
comprobaciones, la transacción, el gestor fantasma, la auditoría— es común. El
camino del tutor no debe cambiar de comportamiento: hay tests que lo cubren y
tienen que seguir pasando sin tocarlos.

## 5. Las solicitudes de alta

### El problema

La pantalla de Hermanos tiene su bloque de solicitudes pendientes, con Aprobar y
Rechazar, y sale arriba del todo. Pero está escrito
`{canEdit && requests.length > 0 && ...}`: **cuando no hay ninguna solicitud no
se pinta nada**, ni un título ni un aviso. La funcionalidad existe y es
invisible, así que nadie sabe que está ni puede comprobar que funciona. Con el
censo de demostración dentro hay cero solicitudes, y la pantalla lleva días
enseñando solo la mitad de lo que hace.

Una solicitud pendiente es un usuario con alguna ficha `activo: false` y sin
fecha de baja; las crea el alta pública de la web.

### Qué se hace

**Dos pestañas dentro de Hermanos**: «Censo» y «Solicitudes (3)», con el número
de pendientes a la vista en la propia pestaña. Vacía, dice que no hay ninguna
esperando. La pestaña activa va en la URL (`?vista=solicitudes`) para que se
pueda enlazar y para que volver de editar una ficha devuelva a donde se estaba.

**El Hermano Mayor pasa a poder aprobar y rechazar.** Hay que abrirlo en las dos
capas: `rolesSecretaria` en `hermano.routes.ts` para las tres rutas de
solicitudes, y el `canEdit` de la pantalla. El test de permisos no cubre hoy
estas rutas: se añade el caso, tanto el que comprueba que el Hermano Mayor entra
como el que comprueba que Redes y un hermano raso siguen fuera.

**El censo de demostración siembra cuatro o cinco solicitudes**, una de ellas de
un tutor que apunta a un menor a su cargo, para que la pestaña se pueda ver con
contenido. Son usuarios con ficha inactiva y sin fecha de baja, así que no
cuentan como hermanos activos y no mueven las cifras del panel.

## Fuera de alcance, a propósito

- **Los listados truncados**: el CMS pide una sola página con tope fijo (100
  hermanos de 300, 200 recibos de 1.167) y no ofrece pasar de página ni dice que
  falte nada. Es el siguiente bloque de trabajo, y es grande por sí solo.
- **El buscador del Hermano Mayor**, que no filtra porque el cliente ignora la
  consulta en ese rol.
- **Datos bancarios** en la ficha.
- **Mover el alta de contenido** a pantalla propia.
- **La devolución de prendas de Inventario**, que usa un `confirm` para recoger
  un dato.

## Cómo se comprueba

TDD en las dos capas, y después el navegador con los trescientos hermanos
dentro.

**Servidor**

- La cuenta emancipada nace sin contraseña utilizable: intentar entrar con
  cualquier cosa falla.
- El enlace de restablecimiento caduca a las 72 horas, no a la hora.
- Un correo o un DNI ya usados responden 409 y no dejan la ficha a medias.
- Emancipar al último dependiente activo desactiva la cuenta del tutor; si el
  tutor es staff, no.
- El camino del tutor sigue funcionando igual, con sus tests actuales intactos.
- La fecha de baja anterior a la de alta se rechaza; quitar la baja reactiva.

**Cliente**

- La edición vive en su ruta y el listado no se ve mientras se edita.
- Guardar pide confirmación y nombra la ficha.
- Salir con cambios avisa; sin cambios, no.
- Borrar pide confirmación con el nombre de lo que se borra, sin `window.confirm`.
- La pestaña de solicitudes se ve aunque no haya ninguna, y dice que no hay.
- El número de pendientes de la pestaña coincide con lo que devuelve el servidor.
- La barra lateral es `sticky`.
- La ficha enseña los dieciséis campos y el vínculo con el tutor.

## Riesgos

- **`useBlocker` y los tests**: el proveedor de tests usa un router que no lo
  soporta. Se resuelve montando un `createMemoryRouter` en esos tests, pero es
  el punto donde más fácil es perder tiempo.
- **Repartir el servicio de emancipación** puede romper el camino del tutor sin
  que se note. Los tests actuales de ese camino son la red: no se tocan.
- **La pantalla de edición del hermano es grande** (dieciséis campos en cuatro
  bloques). Si el formulario empieza a crecer de más, conviene partirlo por
  bloques antes de que se haga inmanejable.
