# Despliegue

> **El despliegue no debe ejecutarse todavía.** Este documento describe lo que
> hará falta el día que se autorice; escribirlo antes evita improvisar durante
> la puesta en producción.
>
> **El VPS del Grupo no es una máquina vacía**: tiene su propio nginx con la
> página de mantenimiento y los puertos 80 y 443. Allí se usa además
> `compose.servidor.yaml` (nginx del contenedor detrás del del sistema,
> imágenes construidas en GitHub). Cómo está ese servidor y cómo se monta la
> web de pruebas: [`servidor.md`](servidor.md).

Todo el montaje va en contenedores, con un único `docker compose`. Los ficheros
viven en el repositorio y se despliegan con él:

| Fichero | Qué es |
|---|---|
| `compose.yaml` | Los servicios de producción. Es el fichero que se usa en el servidor |
| `compose.local.yaml` | Sobrescritura para probarlo en tu equipo. En el servidor no se usa |
| `docker/api.Dockerfile` | La imagen de la API, y la de mantenimiento (migraciones, siembra, scripts) |
| `docker/web.Dockerfile` | Construye la SPA con Vite y la sirve con nginx |
| `docker/nginx/` | La configuración de nginx: el sitio, las cabeceras y el formato del registro |
| `docker/clamav/clamd.conf` | La configuración del antivirus |
| `docker/.env.example` | Plantilla del `.env`, que se copia a la raíz y se rellena |

## Qué hay que contratar

**Ya está contratado:** un **OVH VPS-1**, 2 vCores, 4 GB de memoria y 40 GB de
disco, con Ubuntu y Docker ya instalados. Todavía no hay nada desplegado en él.

Los requisitos de abajo salen de decisiones ya tomadas en el código. Se dejan
escritos porque son los que hay que volver a comprobar el día que se cambie de
máquina o de proveedor.

### Requisitos que no se pueden negociar

| Requisito | Por qué |
|---|---|
| **Un VPS con acceso de administrador** y Docker Engine con el plugin `compose` | Todo el montaje son contenedores. Un alojamiento compartido de los que llevan cPanel no vale: no deja instalar Docker ni tocar los puertos 80 y 443 |
| **Los puertos 80 y 443 libres** en la máquina | Los publica el contenedor de nginx. Si hay otro servidor web escuchando, hay que quitarlo |
| **Disco para las subidas** | Los ficheros del CMS van al sistema de archivos, no a la base de datos, y se montan desde una carpeta del servidor |
| **Certificado TLS** | Con Let's Encrypt basta, y el compose ya trae el contenedor que lo renueva |

Lo que **ya no** hace falta instalar en el servidor: Node, MariaDB, nginx ni
ClamAV. Los traen las imágenes. Sí hacen falta `age` y `rclone` para las copias
de seguridad, que se ejecutan desde fuera de los contenedores.

MariaDB es la **11.8**, fijada en el compose. Es la de desarrollo y la del CI,
y trae `innodb_snapshot_isolation=ON`, que decide qué pasa cuando dos personas
guardan lo mismo a la vez. Con otra versión habría que volver a probarlo.

### Tamaño

Para una web de este tamaño el consumo es bajo. Lo que decide es el antivirus:

| Con qué | Memoria recomendada | Nota |
|---|---|---|
| Sin ClamAV | 2 GB | Node + MariaDB + nginx van holgados, incluso en contenedores |
| **Con ClamAV** | **4 GB** | `clamd` carga la base de firmas en memoria y se come él solo más de 1 GB |

En producción ClamAV es **obligatorio** (el backend no arranca sin
`CLAMAV_HOST`), así que la cifra que vale es la de 4 GB, y aquí es un mínimo
real y no un número holgado: Docker añade lo suyo por encima.

Dos núcleos sobran. El disco depende de cuántas fotos y PDF suba el Grupo
Parroquial: 40 GB dan para mucho tiempo, contando las copias de seguridad
locales y las imágenes de Docker (unos 2 GB entre todas).

#### La swap no es opcional en esta máquina

El VPS vino **sin swap ninguna**, como suelen venir los de OVH. Con 4 GB justos
y ClamAV dentro, eso es un riesgo real. Los picos de la recarga de firmas
están quitados y ClamAV tiene su tope (ver «Tres cosas del contenedor del
antivirus»), pero el margen sigue siendo corto: sin colchón, el núcleo no
ralentiza nada, **mata un proceso**, y puede tocarle a la base de datos.

Se añadieron 2 GB de swapfile, con `swappiness` baja para que sea un colchón de
emergencia y no algo que el sistema use a diario (en un servidor web, usarla a
diario se nota en la latencia):

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf && sudo sysctl --system
```

La línea en `/etc/fstab` es lo que la deja puesta tras un reinicio. Sin ella, la
swap desaparece al primer arranque y nadie se entera hasta que algo muere.

Con el montaje completo la estimación es de 1,7–2,3 GB en contenedores
(ClamAV se lleva la mayor parte), así que quedan entre 1 y 1,6 GB libres. Es
suficiente para la web, pero **no da para meter servicios grandes al lado**:
una analítica auto-alojada como Umami, que necesita además su propio
PostgreSQL, se comería la mitad de ese margen.

### El dominio

También está sin comprar. Se escribe en un único sitio, `identidad.dominio` de
`shared/datos-entidad.json` (siempre con `www.`): de ahí lo toman la web (su
dirección canónica, el sitemap, `robots.txt`), la imagen de nginx al
construirse (`docker/nginx/generar-sitio.mjs` rellena `sitio.conf`) y
`docker/instalar.sh`, que lo pone en `FRONTEND_URL` y `API_URL`. Al elegirlo,
recordar que **la API vivirá bajo ese mismo
dominio en la ruta `/api/`**, así que no hace falta un subdominio aparte para
ella — y de hecho no debe tenerlo.

### Almacenamiento externo para las copias

Una copia que solo vive en el servidor no sobrevive a perder el servidor. Hace
falta un almacenamiento de objetos fuera (Backblaze B2, un bucket S3 de otro
proveedor, un Hetzner Storage Box...) al que `rclone` pueda subir. Mejor si
admite reglas de ciclo de vida o bloqueo de objetos: ver
[Copias de seguridad](#copias-de-seguridad).

## Piezas

| Servicio | Qué es | Notas |
|---|---|---|
| `web` | nginx: sirve la SPA construida con Vite, hace de proxy de la API y sirve los archivos subidos | Es el único que publica puertos (80 y 443) |
| `api` | La API de Express | Escucha en el 3001, **sin publicar**: solo se llega por la red interna |
| `db` | MariaDB 11.8 | Puerto sin publicar. Los datos, en el volumen `datos-db` |
| `clamav` | El antivirus de las subidas | Perfil `antivirus`. Puerto sin publicar |
| `certbot` | Renueva el certificado de Let's Encrypt | Perfil `tls` |
| `migraciones` | Aplica las migraciones y termina | La API no arranca hasta que este acaba bien |
| `herramientas` | Siembra, purga, scripts de mantenimiento | Perfil `manual`: se usa con `docker compose run --rm` |

Los perfiles se activan con `COMPOSE_PROFILES` en el `.env`; en el servidor van
`antivirus,tls`.

**La imagen de la API se construye desde la raíz del repositorio, no desde
`backend-desamparados/`.** `shared/` es dependencia de ejecución —la importan
`src/domain/contenido.ts` y `src/schemas/contenido.schema.ts`—, así que sin esa
carpeta al lado el proceso no arranca. La de la web necesita además
`backend-desamparados/src/domain/password-debil`, que es la lista de
contraseñas prohibidas y es la misma a los dos lados.

**Las subidas se montan desde el disco del servidor**
(`./backend-desamparados/storage`), no desde un volumen de Docker. Así la copia
de seguridad las empaqueta leyendo una carpeta normal, restaurar es un `rsync`
y se pueden mirar sin entrar en ningún contenedor. `storage/public` llega
además al contenedor de nginx **en solo lectura**; `storage/private` no se le
monta: esa se descarga por la API, con sesión.

La API **solo escucha dentro de la red del compose**. Dentro del contenedor
tiene que escuchar en `0.0.0.0` (`HOST`, que el compose fija) porque
`127.0.0.1` allí solo lo alcanza el propio contenedor y nginx no llegaría; como
el puerto 3001 no se publica, la garantía es la misma que daba escuchar en
`127.0.0.1` fuera de Docker. **El arranque deja un aviso por esto**
(«HOST=0.0.0.0: la API escucha fuera de la propia máquina»): es esperado y no
se silencia, porque la comprobación sigue siendo buena en cualquier otro
montaje. Aun así, conviene que el cortafuegos solo deje abiertos el 22, el 80 y
el 443.

## Lo que más fácilmente se olvida: el reenvío de la SPA

El router vive en el navegador. Si alguien entra directamente a
`https://…/actualidad/noticias`, el servidor busca un fichero con ese nombre, no
lo encuentra y responde 404 sin llegar a cargar la aplicación. **Toda ruta que
no corresponda a un fichero real tiene que devolver `index.html`.** Está en el
`location /` de `docker/nginx/sitio.conf`.

## Configuración de nginx

Son cuatro ficheros en `docker/nginx/`, y la imagen los coloca en su sitio:

| Fichero | Dónde acaba | Qué lleva |
|---|---|---|
| `comun.conf` | `conf.d/00-comun.conf` (contexto `http`) | `server_tokens off` y el formato de registro |
| `seguridad.conf` | `snippets/desamparados-seguridad.conf` | Las cabeceras de seguridad de la web |
| `seguridad-sin-hsts.conf` | `snippets/…-sin-hsts.conf` | Igual, sin HSTS. **Solo lo usa la prueba en local** |
| `sitio.conf` | `conf.d/desamparados.conf` | Los tres `server`: el 80 que redirige, el 443 sin `www` y el sitio. Lleva `__DOMINIO__` y `__DOMINIO_SIN_WWW__`, que rellena `generar-sitio.mjs` al construir la imagen |

Las decisiones que están escritas ahí y conviene no deshacer por descuido:

- **El registro de accesos no guarda la consulta de la URL.** Con el formato
  por defecto (`combined`) quedarían en disco el token de recuperación de
  contraseña (el enlace del correo es `/reset-password?token=…`) y las
  búsquedas del censo, que van en `?q=` con nombres y DNI. Tampoco se registran
  el Referer ni el agente de usuario.
- **Un `location` con `add_header` propio no hereda los del `server`.** Por eso
  no hay ninguno a nivel de server y el fragmento se incluye en cada `location`
  de la web. La API no lo incluye: lleva solo las cabeceras de helmet, y si
  heredara estas llevaría dos de cada, con dos CSP que el navegador aplicaría a
  la vez.
- **`index.html` nunca se cachea** y los `assets/` sí, para siempre: llevan
  hash en el nombre. Si se cachea el `index.html`, los visitantes siguen viendo
  la versión vieja después de cada despliegue.
- **Tres topes de cuerpo distintos**: 1 MB por defecto (la web estática no
  recibe cuerpos), 3 MB en `/api/` (el CMS admite hasta 2 MB de JSON en
  noticias, páginas y publicaciones) y 25 MB en `/api/upload/` (los PDF llegan
  a 20 MB y las fotos a 5). Con el tope general, nginx cortaría con un 413
  antes de que la petición llegase a la API.
- **`X-Forwarded-For` se pone explícitamente.** nginx no lo añade por su
  cuenta: sin esa línea reenviaría intacto el que mandase el cliente y Express
  (`NUM_PROXIES=1`) se creería una IP inventada, con lo que cualquiera podría
  estrenar cupo en los limitadores de intentos en cada petición.
- **El destino del proxy va en una variable, con el DNS de Docker.** nginx
  resuelve un nombre de upstream una sola vez, al arrancar, y se queda con la
  IP. Al recrear el contenedor de la API —un despliegue, un `up -d api` tras
  cambiar el `.env`— cambia de IP y nginx seguiría hablando con la vieja: 502
  hasta reiniciarlo también. Con `resolver 127.0.0.11` y `proxy_pass
  $destino_api`, lo revisa cada 30 s. Comprobado: la API pasó de `.4` a `.8` y
  nginx siguió respondiendo sin tocarlo.
- **`/storage/public/` se sirve del disco**, sin gastar proceso de Node ni cupo
  del limitador, y con un día de caché: el nombre de cada archivo es aleatorio
  y no se reutiliza, pero una foto borrada del CMS (la de un menor, por
  ejemplo) seguiría sirviéndose desde la caché de cada navegador todo lo que
  diga esa cabecera.

### Por qué estas cabeceras y no las de helmet

Helmet las pone en Express, **que solo sirve `/api/`**. El HTML de la web lo
sirve nginx, así que sin el fragmento la página que de verdad ejecuta
JavaScript se queda sin `Content-Security-Policy` y sin protección contra
clickjacking. La cookie `httpOnly` evita que un XSS se lleve la sesión; el CSP
es la otra mitad, la que dificulta el XSS en sí.

Dos diferencias deliberadas respecto al CSP de helmet, y **si se copia el de
helmet tal cual, la web se rompe**:

| Directiva | Por qué |
|---|---|
| `frame-src https://www.google.com` | El pie incrusta el mapa de Google Maps tras aceptar cookies. Sin esto el mapa no carga |
| `img-src … https:` | `imagenUrl` del CMS es texto libre: se pueden pegar imágenes alojadas fuera. Con `'self'` se verían rotas |

`img-src https:` es permisivo a propósito. Se puede cerrar a `'self' data: blob:`
el día que el CMS obligue a subir las imágenes en vez de aceptar una URL.

### Comprobar que nginx ve la IP del visitante, no la de Docker

Cuando la petición entra por un puerto publicado, en Linux la traducción la
hace `iptables` y la IP de origen se conserva. Pero si el demonio tiene activo
el proxy de espacio de usuario, el tráfico puede llegar con la IP de la puerta
de enlace de Docker (`172.x.0.1`) **para todo el mundo**. Eso rompe dos cosas a
la vez: los registros dejan de decir quién entró, y los limitadores de intentos
tratan a todos los visitantes como si fueran uno, con un único cupo
compartido.

En la prueba local siempre se ve `172.19.0.1`, porque la petición sale de la
propia máquina; eso no dice nada. **Hay que mirarlo en el servidor, con una
visita desde fuera**: `docker compose logs web` tiene que enseñar la IP del
visitante. Si enseñara la de la puerta de enlace, la salida es poner
`"userland-proxy": false` en `/etc/docker/daemon.json` y reiniciar Docker.

## Decidido: mismo dominio para web y API

La configuración es la definitiva: **la web y la API comparten dominio**, con
`/api/` como ruta. No es una preferencia, es un **requisito de funcionamiento**:

1. `NUM_PROXIES` y el rate limiting funcionan con la IP real que pasa el proxy.
2. **La sesión viaja en una cookie `httpOnly` con `SameSite=Strict` y
   `Path=/api`.** Con la API en otro dominio el navegador no la mandaría y nadie
   podría iniciar sesión.

Por eso el bloque `location /api/` del proxy es obligatorio. Y por eso
`VITE_API_URL` se deja sin definir al construir la web: el cliente cae entonces
en `/api`, una ruta del mismo dominio.

## Variables de entorno

Un **único fichero `.env` en la raíz del repositorio**, a partir de
`docker/.env.example`. Es distinto de `backend-desamparados/.env`, que es el que
se usa para trabajar fuera de Docker; con el compose, la API no lee aquel.

Compose lo usa para dos cosas: sustituir las `${VARIABLES}` del `compose.yaml`
y pasárselo entero al contenedor de la API. `dotenv` no pisa lo que ya viene
del entorno, así que la fuente es una sola.

**Estas las pone el compose y no hay que escribirlas**: `NODE_ENV`, `HOST`,
`PORT`, `DATABASE_HOST`, `DATABASE_URL`, `CLAMAV_HOST` y `CLAMAV_PORT`.
`DATABASE_URL` se arma a partir de las piezas de abajo, así que **la contraseña
de la base de datos no debe llevar caracteres que haya que codificar en una
URL** (nada de `@ : / # ? &`); la plantilla explica cómo generarla.

El backend comprueba el entorno al arrancar (`src/config/entorno.ts`) y, si
falta algo de lo obligatorio, no arranca y enumera todo lo que falta.

Obligatorias en producción:

| Variable | Para qué |
|---|---|
| `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` | Conexión a MariaDB. Las usan a la vez la API y el contenedor de la base de datos, que crea ese usuario en su primer arranque |
| `DATABASE_ROOT_PASSWORD` | Solo para el root de MariaDB. La aplicación nunca entra con ella |
| `JWT_SECRET` | Firma de las sesiones, 32 caracteres como mínimo. `docker compose run --rm herramientas npm run gen:secret` |
| `TOTP_ENC_KEY` | Clave de cifrado del secreto del doble factor: exactamente 64 caracteres hexadecimales. `docker compose run --rm herramientas npm run gen:clave-totp`. **Si se pierde, todos los cargos tienen que volver a activar el doble factor**: guardarla también fuera del servidor |
| `FRONTEND_URL` | Origen permitido por CORS y base de los enlaces de los correos. Con `https://` |
| `API_URL` | Base de las URL de los archivos subidos. Con `https://`; en este montaje, el mismo dominio que `FRONTEND_URL` |
| `EMAIL_USER`, `EMAIL_PASS` | Cuenta desde la que salen los correos |
| `NUM_PROXIES` | Cuántos proxies hay delante: `1` con este montaje, `2` si además se pone Cloudflare. Se exige explícita porque un valor equivocado deja falsear la IP ante los limitadores |
| `CLAMAV_REQUIRED=true` | Con `false` no arranca |

Del despliegue, no de la aplicación:

| Variable | Efecto |
|---|---|
| `COMPOSE_PROFILES` | Qué se levanta. En el servidor, `antivirus,tls` |
| `APP_UID`, `APP_GID` | Con qué usuario corre la API. Tiene que coincidir con el dueño de `storage/`. Por defecto `1000` |

Opcionales:

| Variable | Efecto |
|---|---|
| `EMAIL_FROM_NAME` | Nombre del remitente. Por defecto «Secretaría» |
| `CONTACT_EMAIL_TO` | Destinatario del formulario de contacto. Por defecto, `EMAIL_USER` |
| `CONTACT_EMAIL_USER`, `CONTACT_EMAIL_PASS` | Cuenta aparte para el formulario de contacto |
| `TOTP_ENC_KEY_ANTERIOR` | Solo durante una rotación de `TOTP_ENC_KEY`. Ver «Rotar `TOTP_ENC_KEY`» |
| `AUDIT_RETENTION_DAYS` | Días que se conserva la auditoría. Por defecto `730`; mínimo `30` |
| `NORMATIVA_URL` | Sin ella, el enlace a la normativa no aparece en los correos. Puede apuntar a un PDF subido desde el CMS: ese fichero cuenta como «en uso» y no se borra con `limpiar:huerfanos --borrar` |
| `SEED_ADMIN_EMAIL` | Obligatoria para sembrar en producción |

### El pago en línea (Redsys)

El área de hermanos cobra cuotas y lo de la salida con el TPV virtual del
banco. Se contrata **con el banco del Grupo** («TPV virtual Redsys»), y el
banco entrega el número de comercio (FUC), el terminal y la clave SHA-256.
Bizum va aparte: se pide que lo activen en el mismo TPV.

| Variable | Efecto |
|---|---|
| `PAGO_EN_LINEA` | `redsys` para cobrar con el banco; `simulado` da los pagos por hechos sin mover dinero; `no` o sin definir, apagado |
| `REDSYS_ENTORNO` | `pruebas` (por defecto) no cobra; `real` cobra de verdad y exige las claves |
| `REDSYS_COMERCIO`, `REDSYS_TERMINAL`, `REDSYS_CLAVE` | Las que da el banco. En pruebas, sin ellas se usan las públicas de Redsys |
| `REDSYS_BIZUM=si` | Solo si el banco ha activado Bizum en el TPV |
| `PAGO_DE_PRUEBA_EN_PRODUCCION=si` | Solo en la web de pruebas: consiente un pago que no cobra (simulado, o Redsys sin `real`) con `NODE_ENV=production`. Sin ella, eso impide arrancar |

Tres cosas que no se ven:

- **El banco avisa del cobro a `API_URL/api/pagos/redsys/notificacion`.** Solo
  ese aviso, firmado, da un recibo por pagado; la vuelta del navegador no
  cuenta. La dirección tiene que ser pública y con https (lo es con este
  montaje). En el portal del banco, la «notificación online» tiene que estar
  activada y en modo HTTP (POST), no por correo.
- **Lo que el banco cobra y ya no cuadra** (el recibo se pagó en Secretaría
  mientras el hermano estaba en la página del banco, o el importe cambió)
  queda como incidencia arriba de Tesorería. El dinero se devuelve desde el
  portal del banco con el número de pedido y se marca como devuelto.
- **Probarlo antes de cobrar:** con `REDSYS_ENTORNO=pruebas` todo el camino
  funciona sin mover dinero (tarjeta 4548 8100 0000 0003, 12/49, CVV 123). En
  producción, pruebas o simulado **impiden arrancar** salvo que el `.env`
  diga `PAGO_DE_PRUEBA_EN_PRODUCCION=si` (lo lleva la web de pruebas, y
  entonces solo se avisa en el registro): un olvido así daría recibos por
  pagados sin cobrar.
- **Probarlo en local con el banco de verdad** (su entorno de pruebas): el
  aviso necesita una dirección pública. Con
  `cloudflared tunnel --url http://localhost:3001` se abre una, y en el
  `.env` del backend van `PAGO_EN_LINEA=redsys`, `API_URL=<la del túnel>` y
  `FRONTEND_URL` con el puerto de Vite (el banco devuelve ahí al hermano).
  Bizum no se puede terminar con el terminal público de Redsys (error SIS0475
  al autenticarse): hace falta el de pruebas del banco con Bizum activado.

### El Modelo 182 (donativos)

No necesita variables de entorno. Antes de enero, en Tesorería → «Modelo 182»
→ «Datos del Grupo», se ponen el **NIF del Grupo**, el teléfono y la persona
de contacto con Hacienda y quién firma los certificados. Se guardan en la base
(`Configuracion`, clave `modelo_182`), no en el repositorio: el NIF no se
publica. El fichero se presenta en la Sede de la Agencia Tributaria
(«Presentación mediante fichero») con el certificado digital del Grupo.

### Las remesas SEPA (adeudos domiciliados)

Tesorería cobra los recibos de quienes domicilian con un fichero de adeudos
(`pain.008.001.02`, SEPA CORE) que se genera en Tesorería → Remesas y se sube
a mano a la banca en línea. Hay que contratar con el banco del Grupo los
**adeudos directos SEPA (Core)**: el banco da el **identificador de acreedor**.

| Variable | Efecto |
|---|---|
| `SEPA_ACREEDOR_NOMBRE` | El nombre del Grupo tal como sale en el extracto del hermano (sin tildes: se quitan solas) |
| `SEPA_ACREEDOR_ID` | El identificador de acreedor que da el banco (en España, `ES` + control + sufijo + NIF, p. ej. `ES26000G12345678`) |
| `SEPA_ACREEDOR_IBAN` | La cuenta del Grupo donde se cobran |
| `SEPA_ACREEDOR_BIC` | Opcional: con el IBAN basta |

Sin ellas, Tesorería ve qué recibos entrarían pero no puede generar el
fichero, y la pantalla dice qué falta. Si se rellena alguna, el backend no
arranca hasta que estén todas y bien (el control del identificador y del IBAN
se comprueba al arrancar).

Lo que no se ve:

- **Los adeudos van todos como recurrentes (`RCUR`)**, y el banco del hermano
  como `NOTPROVIDED`. Es lo que aceptan los bancos españoles desde 2016; si el
  del Grupo pidiera `FRST` en el primer adeudo de cada mandato, se cambia en
  `backend-desamparados/src/domain/sepa.ts`.
- **El mandato**: cada adeudo lleva la fecha en que el hermano dio la cuenta
  (al darse de alta o al cambiarla desde su área). La referencia incluye esa
  fecha: una cuenta nueva es un mandato nuevo.
- **La fecha de cobro** tiene que ser un día hábil de los bancos (TARGET2) con
  dos días hábiles de margen. Si el banco del Grupo pide más, se sube
  `DIAS_HABILES_DE_MARGEN` en el mismo fichero.
- **Las devoluciones y el cobro** salen del extracto del banco: en Remesas,
  «Extracto del banco» lee el fichero Norma 43 de la banca en línea, marca
  como devueltos los recibos que el banco devolvió (los reconoce por el
  `REC-…` o la referencia del mandato) y da por cobradas las remesas que
  abonó. Lo que no sabe casar lo enseña y no lo toca. También se pueden
  marcar a mano.

### El antivirus, tal como funciona de verdad

`src/utils/clamd.ts` decide así:

| Configuración | Qué pasa con una subida |
|---|---|
| Sin `CLAMAV_HOST` y `CLAMAV_REQUIRED` en `false` o sin definir | **No se analiza**: se acepta tal cual, y el registro lo avisa una vez |
| Sin `CLAMAV_HOST` y `CLAMAV_REQUIRED=true` | Se rechazan todas con **503** |
| Con `CLAMAV_HOST` y `clamd` respondiendo | Se analiza; si hay virus (`FOUND`), se rechaza con **400** |
| Con `CLAMAV_HOST` y `clamd` caído, lento (más de 60 s) o con una respuesta que no se entiende | **Se rechaza siempre** con **503**, también con `CLAMAV_REQUIRED=false` |

O sea: `CLAMAV_REQUIRED` solo cambia algo cuando **no** hay `CLAMAV_HOST`. Aquí
el compose siempre lo pone, así que lo que manda es si el contenedor está en
marcha: si se cae, las subidas del CMS fallan hasta que vuelva. Es lo que se
quiere.

Tres cosas del contenedor del antivirus:

- **El primer arranque tarda varios minutos**: se baja la base de firmas
  entera. Hasta que el healthcheck pase, las subidas responden 503. Las firmas
  quedan en el volumen `firmas-clamav`, así que los arranques siguientes son
  rápidos.
- **`docker/clamav/clamd.conf` sustituye entero al de la imagen**, así que
  tiene que repetir lo suyo. Sin `LocalSocket`, el propio contenedor se queda
  esperando un socket que nadie crea y clamd no llega a levantarse. Lo único
  que se añade es `StreamMaxLength 25M`: los PDF de las publicaciones llegan a
  20 MB y, con un tope menor, clamd cortaría el análisis y la subida daría un
  503 que no se parece en nada al problema. También se añade
  `ConcurrentDatabaseReload no` (ver la tercera).
- **La memoria está atada.** Al llegar firmas nuevas, clamd por defecto carga
  la base nueva sin soltar la vieja y `freshclam` la carga otra vez para
  probarla: dos picos de más de 1 GB cada uno en un VPS de 4. Los dos están
  quitados (`ConcurrentDatabaseReload no` en `clamd.conf` y
  `FRESHCLAM_CONF_TestDatabases: "no"` en el compose), así que el consumo se
  queda en algo más de 1 GB fijo. Mientras recarga, unos segundos, los
  análisis esperan. Además el contenedor tiene un tope de 1800 MB
  (`mem_limit`): si se pasa, el núcleo lo mata a él y no a la base de datos, y
  `restart` lo vuelve a levantar. Si `docker stats` lo muestra rozando el tope,
  se sube en el compose.

### Vídeos propios: el servidor no los recomprime

El hero de la portada y las galerías (y el bloque «Vídeo») admiten vídeos
subidos desde el CMS, además de los enlaces de YouTube o Vimeo. Para que no
saturen este VPS, **el servidor nunca convierte un vídeo**: recomprimir con
ffmpeg dejaría los dos núcleos al 100 % varios minutos por vídeo. El vídeo tiene
que llegar ya preparado y el servidor solo comprueba que lo está, leyendo sus
cabeceras (`backend-desamparados/src/domain/mp4.ts`), que no cuesta nada:

| | Hero | Galería y bloque «Vídeo» |
|---|---|---|
| Formato | MP4, vídeo H.264, sonido AAC o sin sonido | igual |
| Peso máximo | 5 MB | 15 MB |
| Duración máxima | 30 s | 2 minutos |
| Tamaño de imagen | hasta 1920×1080, horizontal o vertical | igual |

Los topes están en `shared/topes-video.json`, que leen a la vez el servidor y el
CMS. El CMS los comprueba antes de enviar nada, así que nadie espera a que suban
15 MB para enterarse de que el vídeo es largo. Si se suben, hay que revisar
también `client_max_body_size` de `/api/upload/` en nginx (25 MB) y
`StreamMaxLength` de ClamAV (25 MB).

Lo que ahorra en la web:

- **Galerías**: el vídeo no se descarga hasta que alguien le da al play; hasta
  entonces se ve su foto de portada, que el CMS saca sola del vídeo al subirlo.
- **Hero**: quien tiene el «ahorro de datos» del móvil, una conexión lenta o
  el «reducir movimiento» del sistema ve las fotos y no se descarga el vídeo.
  Lleva botón de pausa.
- nginx sirve los MP4 por trozos (Range): el navegador empieza a reproducir
  en seguida y quien se va a mitad no se descarga el resto.

Lo que cuesta al servidor es el peso, no la duración: un vídeo de 2 minutos y
15 MB gasta lo mismo que uno de 20 segundos y 15 MB. La duración máxima está
por la calidad: con más minutos en los mismos megas se ve peor. Por eso, a
partir de un minuto, conviene exportarlo a 720p. Para vídeos más largos (la
procesión entera, una homilía), YouTube o Vimeo: ellos los sirven y el VPS no
gasta nada.

**Cómo preparar un vídeo** (en el ordenador, nunca en el servidor): HandBrake,
que es gratuito. Preset «Fast 1080p30», contenedor MP4, códec de vídeo H.264,
marcar «Optimizado para web» y recortar el tramo en la pestaña de inicio y fin.
Para el hero, además, quitar la pista de sonido (se reproduce sin sonido y solo
pesaría) y, si pasa de 5 MB, subir el «RF» a 24–26 o bajar a 720p. Los vídeos
del iPhone vienen en H.265 (.mov): el servidor los rechaza porque Firefox y
muchos Windows no los reproducen, y HandBrake los convierte.

La política de seguridad de nginx lleva `media-src 'self' blob:`: `'self'` para
reproducir los vídeos propios y `blob:` para que el CMS pueda abrir el vídeo en
el navegador antes de subirlo y sacarle la foto de portada.

## El usuario del sistema y los permisos de `storage`

Los contenedores no corren como root, y la API escribe en una carpeta del
servidor. Las dos cosas tienen que encajar:

```bash
# Un usuario propio, sin shell. El uid importa: es el del contenedor.
sudo useradd --system --shell /usr/sbin/nologin --uid 1000 desamparados 2>/dev/null \
  || echo "el uid 1000 ya existe: pon el suyo en APP_UID/APP_GID del .env"

# El repositorio, en /srv/desamparados.
sudo chown -R desamparados:desamparados /srv/desamparados
sudo chmod 600 /srv/desamparados/.env

# La carpeta de las subidas, del usuario de la API. La privada, solo suya.
# La pública la lee además el nginx del contenedor, que corre con su propio
# usuario (no www-data ni root): con 750 no podría y cada foto daría 403.
B=/srv/desamparados/backend-desamparados
sudo install -d -o desamparados -g desamparados -m 750 "$B/storage/private"
sudo install -d -o desamparados -g desamparados -m 755 "$B/storage" "$B/storage/public"
```

Si el uid 1000 ya está cogido en esa máquina, se usa otro y se pone en
`APP_UID`/`APP_GID` del `.env`. Lo que no puede pasar es que no coincidan: la
API no podría escribir las subidas.

Quien ejecuta `docker compose` tiene que poder hablar con Docker (estar en el
grupo `docker`, o usar `sudo`). Dar el grupo `docker` equivale a dar root en la
máquina: que lo tenga solo quien despliega.

## Orden de una puesta en producción

Desde `/srv/desamparados`, con el repositorio ya clonado y el `.env` relleno.

**1. El certificado, la primera vez.** nginx no arranca si el certificado no
existe, y certbot no puede validar si nginx no está: hay que romper el círculo
una vez, con el puerto 80 libre.

```bash
# El -p 80:80 es imprescindible: `--standalone` levanta su propio servidor en
# ese puerto y el servicio certbot no publica ninguno por su cuenta. Por eso
# este paso va ANTES del primer `up`, con el 80 todavía libre.
docker compose run --rm -p 80:80 --entrypoint certbot certbot \
  certonly --standalone \
  -d www.desamparadosmalaga.com -d desamparadosmalaga.com \
  --agree-tos -m secretaria@… --no-eff-email
```

Las renovaciones posteriores no necesitan esto: las hace el contenedor
`certbot` por webroot, con el sitio en marcha, y el de `web` recarga nginx cada
seis horas para tomar el certificado nuevo.

**2. Levantar todo.**

```bash
docker compose up -d --build
```

Construye las dos imágenes, espera a que la base de datos esté sana, aplica las
migraciones (`prisma migrate deploy`, nunca `migrate dev`) y solo entonces
arranca la API y nginx. Si las migraciones fallan, la API **no** arranca: es
deliberado.

**3. Sembrar, solo la primera vez.**

```bash
docker compose run --rm herramientas npm run seed
```

Crea el administrador con una contraseña aleatoria que se muestra **una sola
vez** —cópiala en ese momento— y el contenido de ejemplo, que se sustituye
después desde el CMS. No crea la cuenta de hermano de prueba, y se niega a
sembrar sin `SEED_ADMIN_EMAIL`.

**4. Cifrar los secretos del doble factor, una vez tras definir
`TOTP_ENC_KEY`.**

```bash
docker compose run --rm herramientas npm run 2fa:cifrar-secretos
```

Se puede repetir sin miedo. **Para cambiar la clave después no basta con
sustituirla**: sigue «Rotar `TOTP_ENC_KEY`».

**5. Comprobar.**

```bash
curl -fsS https://www.desamparadosmalaga.com/api/health   # {"status":"ok",…}
docker compose ps                                          # todo `healthy`
```

Si el administrador pierde el acceso:
`docker compose run --rm herramientas npm run admin:nueva-contrasena -- correo@del.admin`
genera una contraseña nueva y cierra sus sesiones.

Si alguien pierde el doble factor y no hay otro ADMIN que pueda rescatarlo
desde el CMS (el rescate de allí es solo de ADMIN y nunca sobre la propia
cuenta):
`docker compose run --rm herramientas npm run 2fa:rescatar -- correo@de.la.cuenta`.
Apaga su 2FA, borra sus códigos de respaldo y cierra sus sesiones; queda en la
auditoría como `2FA_RESET_ADMIN` con `via: consola`.

### Despliegues posteriores

```bash
cd /srv/desamparados
git pull
docker compose up -d --build
```

Las imágenes se reconstruyen, las migraciones nuevas se aplican solas y los
contenedores se sustituyen. Los pasos 3 y 4 no se repiten.

**Si hay fotos subidas antes del 8 de octubre de 2026**, se les generan sus
copias reducidas (640 y 1280 px de ancho), que la web pide en `srcset` sin
preguntar si existen. Es idempotente y no toca lo que ya está; también hay que
pasarlo después de `npm run fotos:webp`:

```bash
docker compose run --rm herramientas npm run imagenes:variantes
```

**Si la base se sembró antes del 18 de septiembre de 2026, hay un paso más, y
va antes de que nadie abra el CMS:**

```bash
docker compose run --rm herramientas npm run migrar:bloques             # dice qué haría
docker compose run --rm herramientas npm run migrar:bloques -- --aplicar
```

Desde que toda la web pública se edita por bloques, el Recorrido, la Sagrada
Titular y la Historia tienen otra forma en `ContenidoPagina`. `prisma migrate
deploy` no la cambia: es contenido, no esquema. Y `mezclarConDefectos` solo
conserva del documento guardado las claves que existen en los valores por
defecto, así que **un documento con la forma antigua se queda sin ninguna: esas
tres páginas vuelven a los textos de partida y lo que se hubiera editado
desaparece sin un solo error**. Por eso va aquí y no en «lo que más fácilmente
se olvida».

Sin `--aplicar` solo informa, y es idempotente: una fila que ya tiene `bloques`
se deja como está, así que correrlo dos veces no pisa nada. En una base recién
sembrada no hace falta —la siembra ya escribe la forma nueva— pero tampoco
estorba.

Si no se está seguro de si toca, el arranque de la API lo dice: si quedan filas
con la forma antigua, lo avisa en el registro nada más levantar.

**Con la migración `20261031200000_modulos_activables`, los módulos se
siembran solos al arrancar.** `docker compose up -d --build` aplica la
migración (`npx prisma migrate deploy`, dentro del contenedor `migraciones`),
que crea la tabla `Modulo`, y al levantar la API `src/index.ts` llama a
`ModulosService.cargar()`, que crea las filas que falten con el lote inicial
(`modulos.activos` de `shared/datos-entidad.json`) y no toca ninguna que ya
exista. No hay que sembrar nada a mano por esto. La siembra completa también
crea esas filas, del mismo modo, pero no hace falta lanzarla solo por los
módulos:

```bash
docker compose run --rm herramientas npm run seed   # opcional: lo mismo que hace el arranque, y el resto de la siembra
```

En una instalación nueva, `modulos.activos` decide con qué módulos arranca:
hay que ajustarlo **antes del primer arranque**, porque después todas las
filas ya existen y ni el arranque ni la siembra las tocan (se cambian desde
la pantalla de Módulos del CMS).

**Si hay fotos subidas antes del 27 de septiembre de 2026, conviene pasarlas a
WebP una vez** (desde entonces la subida lo hace sola):

```bash
docker compose run --rm herramientas npm run fotos:webp                 # dice qué haría y cuánto se ahorra
docker compose run --rm herramientas npm run fotos:webp -- --aplicar
```

Reduce a 1920 px, quita metadatos y pasa a WebP los JPG y PNG de
`storage/public` y las fotos de las fichas de `storage/private`, y cambia sus
direcciones en la base. Con las fotos de desarrollo, de 42 MB a 12 MB. Primero
escribe las WebP, luego cambia las direcciones en una transacción y al final
borra los originales, así que un corte a medias no rompe nada y se puede
relanzar. Hazlo después de la copia de seguridad del día: los originales no
vuelven.

La web queda fuera de servicio unos segundos mientras se cambia el contenedor
de nginx. Si algún día molesta, la salida es construir antes
(`docker compose build`) y levantar después: la parada se reduce a lo que tarde
en arrancar el contenedor ya construido.

### Por qué `node --import tsx` y no JavaScript compilado

El código usa imports sin extensión (`moduleResolution: bundler`), que Node no
resuelve por sí solo: compilar con `tsc` no basta, habría que reescribir todos
los imports o añadir un empaquetador. Para una API de este tamaño no compensa:
`tsx` (en `dependencies`, no en las de desarrollo) transpila al arrancar en uno
o dos segundos. La imagen de producción no lleva `devDependencies`; las lleva
la de `herramientas`, porque el CLI de Prisma hace falta para las migraciones.

## Una instalación por corporación

La web se vende con **una instalación por cliente**: su servidor, su base y su
dominio. Todo lo que distingue a una corporación de otra está en
`shared/datos-entidad.json` (nombre, nombre corto, advocación, localidad,
dominio, datos de Secretaría) y en el `.env` (secretos y claves del banco). El
código es el mismo para todas.

**Antes de cargar su censo**, el contrato de encargado del tratamiento firmado:
la corporación es responsable de los datos de sus hermanos y quien instala y
mantiene, encargado. Plantilla y cómo rellenarla en
[`venta/contrato-encargado-tratamiento.md`](venta/contrato-encargado-tratamiento.md).

### Instalar una nueva

En un servidor limpio con Docker y su plugin compose:

```bash
sudo git clone <repositorio> /srv/desamparados
cd /srv/desamparados
# shared/datos-entidad.json con los datos de la corporación, y el dominio
# apuntando ya a este servidor.
sudo ./docker/instalar.sh secretaria@corporacion.es
```

Hace en orden lo de «El usuario del sistema…» y «Orden de una puesta en
producción»: crea el usuario, genera el `.env` con secretos nuevos, prepara
`storage/`, pide el certificado, levanta todo, siembra y cifra los secretos
del doble factor. Si se corta, se vuelve a lanzar: no pisa un `.env` que ya
exista ni repite el certificado. **La contraseña del administrador sale una
sola vez por pantalla.** Lo que no puede adivinar (correo saliente, copias,
Redsys, SEPA) lo dice al terminar.

Con `--sin-certificado` se salta el paso 4, para probar antes de tener el
dominio.

### Actualizar una

```bash
cd /srv/desamparados
sudo -u desamparados ./docker/actualizar.sh           # a lo último de main
sudo -u desamparados ./docker/actualizar.sh v1.4.0    # a una versión concreta
```

Hace la copia de seguridad **antes** de tocar nada (lee
`/etc/desamparados/copia.env`; sin ella se niega, salvo con `--sin-copia`),
trae el código solo por avance rápido, construye las imágenes con la web aún en
marcha, levanta (las migraciones se aplican solas) y espera a que la API esté
sana. No vuelve atrás solo: con la base ya migrada, el código anterior no la
entendería. Si algo falla, dice cómo restaurar.

### Actualizar todas

Desde tu equipo, con un fichero de instalaciones (nombre, destino de ssh y,
si no es la de siempre, carpeta):

```bash
./docker/actualizar-copias.sh copias.txt          # se para en la primera que falle
./docker/actualizar-copias.sh copias.txt --seguir # sigue con las demás
```

Se para en la primera que falle a propósito: una versión que sale mal debe
quedarse en una corporación, no en todas. El usuario de ssh necesita poder
ejecutar `sudo -u desamparados ./docker/actualizar.sh` sin contraseña.

## Rotar `TOTP_ENC_KEY`

Los secretos del doble factor están cifrados con esta clave. Si se sustituye
sin más, ninguno se puede descifrar: cada login con 2FA falla y, si todos los
ADMIN lo tienen activo, nadie puede entrar al CMS. La rotación se hace en tres
pasos, sin cortar el servicio más que en los reinicios:

1. Generar la nueva
   (`docker compose run --rm herramientas npm run gen:clave-totp`). En el
   `.env`, pasar la actual a `TOTP_ENC_KEY_ANTERIOR` y poner la nueva en
   `TOTP_ENC_KEY`. `docker compose up -d api`: desde aquí se lee con las dos y
   se escribe con la nueva. El arranque avisa de que hay una rotación en curso.
2. `docker compose run --rm herramientas npm run 2fa:cifrar-secretos`.
   Reescribe con la nueva todo lo que estaba con la anterior. Si termina
   diciendo que hay secretos ilegibles, **no seguir**: esos estaban cifrados
   con una clave que no es ninguna de las dos.
3. Quitar `TOTP_ENC_KEY_ANTERIOR` del `.env` y `docker compose up -d api` otra
   vez. Guardar la nueva clave fuera del servidor.

Si la clave se ha perdido (no hay anterior que poner), no hay forma de
recuperar los secretos: `npm run 2fa:rescatar -- correo` para cada cargo con
2FA, y que cada uno lo vuelva a activar.

## Registros

Todo va a la salida estándar de cada contenedor, que es de donde los recoge
Docker:

```bash
docker compose logs -f api        # la API
docker compose logs -f web        # nginx
docker compose logs --since 1h    # todos
```

- **La API** escribe una línea por petición con fecha, IP, método, ruta **sin
  la consulta**, estado, tamaño y tiempo; el token de recuperación de
  contraseña que va en la ruta se tapa. Los errores 500 dejan el mensaje, el
  código de Prisma y la pila, sin los argumentos de la consulta (que llevarían
  correos o DNI).
- **nginx** escribe con el formato `desamparados`, que no incluye la consulta
  de la URL, ni el Referer, ni el agente de usuario.

Los dos llevan IP, que es un dato personal: no se guardan para siempre. El
`compose.yaml` limita cada registro a cinco ficheros de 10 MB
(`max-size`/`max-file`), que se van descartando solos. Sin eso, el registro de
un contenedor crece hasta llenar el disco.

## Copias de seguridad

`backend-desamparados/scripts/backup-vps.sh` hace, en una pasada:

1. Volcado de MariaDB **desde dentro del contenedor** con
   `mariadb-dump --single-transaction` (consistente, sin bloquear la web),
   comprobando que termina en «Dump completed» y que trae todas las tablas. Las
   credenciales salen del entorno del propio contenedor y nunca pasan por la
   línea de órdenes, donde cualquier usuario del servidor las vería con `ps`.
2. Empaquetado del volcado junto con `storage/` (fotos y PDF, públicos y
   privados): una base restaurada sin sus archivos apunta a ficheros que no hay.
3. Cifrado con [`age`](https://age-encryption.org) para una clave **pública**.
   La clave privada no está en el servidor: quien se lleve el disco o las
   copias no puede leerlas.
4. Rotación local (14 días por defecto), siempre después de haber hecho una
   copia nueva.
5. Subida con `rclone` al almacenamiento externo, si está configurado.

Las copias quedan en `/var/backups/desamparados/desamparados_AAAAMMDDTHHMMSSZ.tar.gz.age`.

### Preparación (una vez)

En **tu equipo**, no en el servidor, generar el par de claves y guardar la
privada en dos sitios seguros (un gestor de contraseñas y un USB guardado en la
casa parroquial, por ejemplo). Sin ella las copias no se pueden abrir:

```bash
age-keygen -o clave-copias-desamparados.txt
# Public key: age1...   ← esta línea es la que va al servidor
```

En el servidor:

```bash
sudo apt install age rclone          # mariadb-client ya no hace falta
sudo install -d -o desamparados -g desamparados -m 700 /var/backups/desamparados
sudo install -d -m 755 /etc/desamparados
echo 'age1...' | sudo tee /etc/desamparados/copias.pub       # la clave PÚBLICA
sudo -u desamparados -H rclone config                        # el remoto, p. ej. «copias»
```

```bash
# /etc/desamparados/copia.env
BACKUP_AGE_RECIPIENTS=/etc/desamparados/copias.pub
BACKUP_DIR=/var/backups/desamparados
BACKUP_RETENTION_DAYS=14
BACKUP_RCLONE_REMOTE=copias:grupo-parroquial/desamparados
PROYECTO_DIR=/srv/desamparados
```

Ya no hace falta un usuario de MariaDB solo de lectura para la copia: el
volcado lo hace el contenedor con el usuario de la aplicación, que tiene
permisos sobre su propia base y nada más. `--no-tablespaces` evita necesitar el
privilegio `PROCESS`.

**En el almacenamiento externo, la clave que usa `rclone` no debería poder
borrar** (Backblaze B2 permite claves sin `deleteFiles`; S3, bloqueo de objetos
o una política sin `DeleteObject`). Si quien comprometa el servidor puede borrar
también las copias de fuera, no hay copias. La rotación de allí la hacen las
reglas de ciclo de vida del propio almacenamiento (por ejemplo, conservar 90
días); el script solo sube.

**Google Drive** no cumple ninguna de las dos cosas: el permiso de subir ya
deja borrar, y no tiene reglas de ciclo de vida. Ahí la rotación la hace el
guion (`BACKUP_RCLONE_DIAS` y `BACKUP_RCLONE_MESES`) y la copia que no se puede
borrar desde el servidor es otra, la que se baja un equipo por su cuenta. Es lo
que hay montado en el VPS: `servidor.md`, «Copias de seguridad».

### Programación diaria

El script se ejecuta **fuera** de los contenedores —necesita `docker`, `age` y
`rclone`—, así que sigue siendo un timer de systemd:

```ini
# /etc/systemd/system/desamparados-copia.service
[Unit]
Description=Copia de seguridad cifrada (base de datos + storage)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=desamparados
EnvironmentFile=/etc/desamparados/copia.env
ExecStart=/bin/bash /srv/desamparados/backend-desamparados/scripts/backup-vps.sh
Nice=10
IOSchedulingClass=idle
```

```ini
# /etc/systemd/system/desamparados-copia.timer
[Unit]
Description=Copia de seguridad diaria

[Timer]
OnCalendar=*-*-* 04:00:00
RandomizedDelaySec=15min
# Si el servidor estaba apagado a las 4, la hace al arrancar.
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now desamparados-copia.timer
sudo systemctl start desamparados-copia.service    # una primera copia ya
journalctl -u desamparados-copia                    # qué pasó
systemctl list-timers 'desamparados-*'              # cuándo toca la siguiente
```

El usuario `desamparados` tiene que estar en el grupo `docker` para que el
script pueda hablar con el contenedor de la base de datos.

### Restaurar

Una copia que nunca se ha restaurado es una suposición. **Restaurar una sobre
una base de datos de prueba antes de dar por buena la puesta en marcha, y
después cada pocos meses.** En una máquina que tenga la clave privada:

```bash
# 1. Traer la copia (del servidor o del almacenamiento externo) y descifrarla
rclone copy copias:grupo-parroquial/desamparados/desamparados_20260911T040000Z.tar.gz.age .
mkdir restauracion
age -d -i clave-copias-desamparados.txt desamparados_20260911T040000Z.tar.gz.age \
  | tar -xzf - -C restauracion
# restauracion/db.sql y restauracion/storage/

# 2. La base de datos, primero en una de prueba
docker compose exec -T db mariadb -u root -p -e \
  "CREATE DATABASE desamparados_prueba CHARACTER SET utf8mb4"
docker compose exec -T db mariadb -u root -p desamparados_prueba < restauracion/db.sql
docker compose exec -T db mariadb -u root -p -e \
  "SELECT COUNT(*) FROM desamparados_prueba.User"

# 3. Solo para restaurar de verdad:
#    docker compose stop api web
#    docker compose exec -T db mariadb -u root -p desamparados_db < restauracion/db.sql
#    sudo -u desamparados rsync -a --delete restauracion/storage/ \
#      /srv/desamparados/backend-desamparados/storage/
#    docker compose start api web

# 4. Borrar lo descifrado al terminar: lleva el censo entero en claro
rm -rf restauracion
docker compose exec -T db mariadb -u root -p -e "DROP DATABASE desamparados_prueba"
```

En Windows, para el equipo de desarrollo, siguen `scripts/backup-db.ps1` y
`scripts/restore-db.ps1` (solo la base de datos y sin cifrar: no son para el
servidor). La carpeta `backups/` y los `.sql` están en `.gitignore`.

## Purga de la auditoría

La tabla `AuditLog` guarda la IP y el navegador de cada acción sensible: son
datos personales y no pueden conservarse sin límite.
`npm run auditoria:purgar` borra los registros más antiguos que
`AUDIT_RETENTION_DAYS` (730 días por defecto, dos ejercicios contables). Una vez
al día:

```ini
# /etc/systemd/system/desamparados-auditoria.service
[Unit]
Description=Purga de la auditoría más antigua que el plazo de retención
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=desamparados
WorkingDirectory=/srv/desamparados
ExecStart=/usr/bin/docker compose run --rm herramientas npm run auditoria:purgar
```

```ini
# /etc/systemd/system/desamparados-auditoria.timer
[Unit]
Description=Purga diaria de la auditoría

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now desamparados-auditoria.timer
```

Lo mismo sirve para la limpieza de ficheros huérfanos, que se hace a mano
cuando toque:

```bash
docker compose run --rm herramientas npm run limpiar:huerfanos          # solo listar
docker compose run --rm herramientas npm run limpiar:huerfanos -- --borrar
```

Las copias de seguridad conservan lo purgado hasta que rotan: con las de fuera
en 90 días, un registro vive como mucho `AUDIT_RETENTION_DAYS` más 90 días.

## Probarlo en tu equipo antes de tocar el servidor

El mismo montaje, con puertos que no molestan y un certificado autofirmado:

```bash
cp docker/.env.example .env     # y rellenarlo; FRONTEND_URL y API_URL, https://localhost:8443
docker compose -f compose.yaml -f compose.local.yaml up -d --build
docker compose -f compose.yaml -f compose.local.yaml run --rm herramientas npm run seed
```

La web queda en `https://localhost:8443` (el navegador avisará del certificado
autofirmado; es lo esperado). Qué cambia respecto al servidor, y nada más:

- Los puertos son 8080 y 8443.
- El certificado es autofirmado y para `localhost`, generado por el servicio
  `certificado-local`.
- **No se manda `Strict-Transport-Security`**, ni desde nginx ni dejándola
  pasar desde helmet. HSTS se fija por host sin mirar el puerto: una sola
  visita a `https://localhost:8443` con esa cabecera dejaría el navegador
  obligando a HTTPS en cualquier `http://localhost` de tu máquina durante dos
  años, y deshacerlo es ir a `chrome://net-internals/#hsts`.

`NODE_ENV` sigue siendo `production`, que es lo que interesa probar: la cookie
`Secure`, las cabeceras y la siembra segura. Por eso se sirve por HTTPS y no
por HTTP — con la cookie `Secure`, en `http://` no se podría iniciar sesión.

La base de datos de la prueba vive en su propio volumen y no publica el 3306:
no tiene nada que ver con el contenedor `desamparados-mariadb` que usan los
tests, y no se pisan.

Para parar y borrarlo todo, volúmenes incluidos:

```bash
docker compose -f compose.yaml -f compose.local.yaml down -v
```

## Antes de dar por buena la puesta en marcha

- [ ] Rotar `JWT_SECRET` y las credenciales de correo que hayan podido circular
      durante el desarrollo.
- [ ] Guardar `TOTP_ENC_KEY` fuera del servidor y ejecutar
      `docker compose run --rm herramientas npm run 2fa:cifrar-secretos`.
- [ ] Sembrar con `SEED_ADMIN_EMAIL` real. Si alguna vez se sembró sin eso,
      buscar y borrar `admin@cofradia.com` y `hermano@cofradia.com`: sus
      contraseñas están en el repositorio y el dominio es ajeno.
- [ ] Comprobar que `https://…/actualidad/noticias` carga al entrar directamente.
- [ ] Comprobar que `http://…` redirige a `https://www.…` y que el certificado
      cubre `www` y el dominio sin `www`.
- [ ] Comprobar `https://…/api/health` y que `curl http://IP-del-servidor:3001/health`
      desde fuera **no** responde (el puerto no se publica; confírmalo igual).
- [ ] Subir un PDF de más de 5 MB desde el CMS (comprueba el `client_max_body_size`
      de `/api/upload/` y que ClamAV responde). Y, con
      `docker compose stop clamav`, comprobar que una subida da 503: si diera
      201, el antivirus no estaría en el camino.
- [ ] Hacer una copia con `desamparados-copia.service`, comprobar que llega al
      almacenamiento externo y **restaurarla una vez** sobre una base de prueba.
- [ ] Comprobar en `docker compose logs web` que las líneas no llevan `?` (ni,
      por tanto, el `token` del enlace de recuperación).
- [ ] Comprobar, entrando **desde fuera**, que `docker compose logs web` anota
      la IP del visitante y no la de la puerta de enlace de Docker
      (`172.x.0.1`). Si fuera la de Docker, los limitadores de intentos
      tratarían a todos los visitantes como uno solo.
- [ ] Rellenar los datos legales en `desamparados-web/src/config/site.ts`: hasta
      entonces, el aviso legal muestra «pendiente de confirmar».
