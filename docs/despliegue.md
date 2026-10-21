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
`instalacion/datos-entidad.json` (siempre con `www.`): de ahí lo toman la web (su
dirección canónica, el sitemap, `robots.txt`), el contenedor de la web al
arrancar (`docker/nginx/generar-sitio.mjs` rellena `sitio.conf`) y
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
| `sitio.conf` | `conf.d/desamparados.conf` | Los tres `server`: el 80 que redirige, el 443 sin `www` y el sitio. Lleva `__DOMINIO__` y `__DOMINIO_SIN_WWW__`, que rellena `generar-sitio.mjs` al arrancar el contenedor (`40-instalacion.sh`), salvo que el compose monte otro encima |

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
| `EMAIL_FROM_NAME` | Nombre del remitente. Por defecto, el nombre corto de la instalación y «Secretaría» («Desamparados · Secretaría») |
| `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT` | Un servicio de envío en vez de Gmail (Brevo: `smtp-relay.brevo.com`, `587`). `EMAIL_USER` y `EMAIL_PASS` pasan a ser el usuario y la clave SMTP del servicio. Gmail deja unos 500 correos al día y los saca con la dirección de la cuenta de Gmail |
| `EMAIL_FROM` | La dirección con la que salen los correos (`noreply@…`). Obligatoria con `EMAIL_SMTP_HOST`; por defecto, `EMAIL_USER`. Tiene que estar dada de alta como remitente en el servicio, con el dominio autenticado (DKIM) |
| `CORREOS_MASIVOS_POR_DIA` | Cuántos correos de los envíos a muchos (comunicados, aviso de apertura de papeletas) salen al día; lo que no cabe sale al siguiente, solo. Por defecto `250`, por debajo de los 300 de Brevo gratis: los correos sueltos no cuentan y necesitan margen. Con Gmail se puede subir a unos `450` |
| `CORREO_AVISOS_SECRETO` | La clave de los avisos de rebote de Brevo (ver «Rebotes de correo»). Sin ella, `/api/correo/avisos` responde 404 y los rebotes no se apuntan. Al menos 24 caracteres: `openssl rand -hex 24` |
| `CONTACT_EMAIL_TO` | Destinatario del formulario de contacto y del aviso de solicitudes, y «Responder a» de todos los correos. Por defecto, `EMAIL_FROM` o `EMAIL_USER` |
| `CONTACT_EMAIL_USER`, `CONTACT_EMAIL_PASS` | Cuenta aparte para el formulario de contacto |
| `TOTP_ENC_KEY_ANTERIOR` | Solo durante una rotación de `TOTP_ENC_KEY`. Ver «Rotar `TOTP_ENC_KEY`» |
| `AUDIT_RETENTION_DAYS` | Días que se conserva la auditoría. Por defecto `730`; mínimo `30` |
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

### Rebotes de correo (Brevo)

Brevo acepta el correo y es el servidor del destinatario quien lo devuelve
minutos después (buzón que no existe, dirección mal escrita, queja de spam).
Para enterarse, Brevo avisa a la API y la dirección queda marcada: la ficha
del censo lo dice, «Más filtros → Correo → Que rebota» las saca todas, la cola
no gasta cupo en ellas y el boletín cuenta ese envío como «rebotó». Una queja
de spam también da de baja del boletín.

1. La clave, `CORREO_AVISOS_SECRETO` en el `.env`. Una instalación nueva ya
   la trae (la genera `instalar.sh`). En una de antes, generarla con
   `openssl rand -hex 24`, ponerla en su propia línea y **recrear** la API:
   `docker compose … up -d api`. Un `restart` no basta: el contenedor solo lee
   el `.env` al crearse.
2. En Brevo: Transactional → Settings → Webhook → «Add a new webhook».
   En la pantalla nueva de Brevo es el menú de la cuenta → Settings →
   Webhooks → «Create outbound webhook» (octubre de 2026).
   - URL: `https://DOMINIO/api/correo/avisos`.
   - Authentication method: **Bearer token**, con la clave. (O Basic, con
     cualquier usuario y la clave de contraseña.)
   - Event category: **Transactional email**. Encendidos solo *Hard Bounced*,
     *Complaint*, *Unsubscribed*, *Blocked* e *Invalid*. *Soft Bounced* no:
     Brevo lo reintenta y, si no llega, acaba en *Hard Bounced*.
   - Sin «batched» (por lotes): el cuerpo pasaría del tope de 100 KB de la API.
3. Comprobarlo: `curl -s -X POST https://DOMINIO/api/correo/avisos` responde
   `{"message":"Falta la clave del aviso."}` (401). Con «Endpoint no
   encontrado» (404), la API no ve la clave: falta recrearla.
4. Probarlo de verdad: un boletín a una sola ficha de prueba con un correo de
   Gmail que no exista. A los pocos minutos la ficha avisa de que el buzón no
   existe y el boletín cuenta «1 correo rebotó». Probado así en pruebas el
   16-10-2026.

En la web de pruebas, la contraseña de nginx tapa la ruta: el bloque
`location = /api/correo/avisos` de `docker/servidor/nginx-pruebas.conf` la deja
pasar, como el aviso del banco.

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
# Su carpeta personal: useradd --system no la crea, y docker la necesita
# (~/.docker) para construir cuando actualizar.sh corre como este usuario.
sudo install -d -o desamparados -g desamparados -m 700 /home/desamparados

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
(`modulos.activos` de `instalacion/datos-entidad.json`) y no toca ninguna que ya
exista. No hay que sembrar nada a mano por esto. La siembra completa también
crea esas filas, del mismo modo, pero no hace falta lanzarla solo por los
módulos:

```bash
docker compose run --rm herramientas npm run seed   # no hace falta: lo mismo que hace el arranque, y el resto de la siembra
```

En producción la siembra solo pone los ejemplos (noticias, agenda,
publicaciones, enseres, salidas) en las tablas que estén vacías, así que
volver a lanzarla no devuelve lo que la Junta haya borrado.

En una instalación nueva, `modulos.activos` decide con qué módulos arranca:
hay que ajustarlo **antes del primer arranque**, porque después todas las
filas ya existen y ni el arranque ni la siembra las tocan (se cambian desde
la pantalla de Módulos del CMS).

**Los módulos de instalación son la excepción** (`deInstalacion` de
`shared/modulos.json`; hoy solo `paginas-propias`, las páginas hechas a medida
de Desamparados: `/desamparados`, `/rosario` y `/sabado-de-pasion` con su
recorrido, trono y enseres). No están en la tabla ni en la pantalla de
Módulos: cuentan si su clave está en `modulos.activos` **en cada arranque**.
Quitarla y reiniciar la API los apaga; ponerla los enciende. El fichero de
Desamparados (también el de la web de pruebas) tiene que llevar
`"paginas-propias"`, o esas seis páginas desaparecen del menú, la web, la API,
el CMS y el sitemap.

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

### Si una migración falla a medias

En MariaDB los cambios de estructura (`ALTER TABLE`, `CREATE INDEX`…) no se
deshacen si la migración falla después: lo que ya se ejecutó se queda. Prisma
apunta esa migración como fallida y, mientras siga así, **todo despliegue se
para con el error `P3009`** y la API no arranca. No se arregla volviendo a
desplegar: hay que decidir a mano en qué quedó.

1. **Copia de seguridad antes de tocar nada** (ver «Copias de seguridad»).
2. Ver cuál falló y por qué:

   ```bash
   docker compose logs --no-color --tail 80 migraciones
   docker compose run --rm herramientas npx prisma migrate status
   ```

3. Abrir su `migration.sql` (en `backend-desamparados/prisma/migrations/`) y
   comprobar en la base qué sentencias llegaron a hacerse, por ejemplo con
   `SHOW CREATE TABLE` (como root dentro del contenedor `db`, igual que en
   «Restaurar»).
4. Elegir una de dos salidas:
   - **Terminarla a mano**: ejecutar las sentencias que faltan y decirle a
     Prisma que está hecha:

     ```bash
     docker compose run --rm herramientas npx prisma migrate resolve --applied <carpeta_de_la_migración>
     ```

   - **Deshacerla a mano**: revertir lo que sí se hizo, decirle a Prisma que
     no cuenta, corregir la migración en el repositorio y volver a desplegar:

     ```bash
     docker compose run --rm herramientas npx prisma migrate resolve --rolled-back <carpeta_de_la_migración>
     ```

5. Volver a desplegar y comprobar con `migrate status` que no queda ninguna
   pendiente ni fallida.

Una migración ya aplicada en el servidor **no se edita**: Prisma guarda su
suma de comprobación y daría error. Lo que haya que corregir va en una
migración nueva.

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
`instalacion/datos-entidad.json` (nombre, nombre corto, advocación, localidad,
dominio, datos de Secretaría) y en el `.env` (secretos y claves del banco). El
código es el mismo para todas. Junto al primero, también fuera de git y
opcionales: la marca (`instalacion/marca/`), las fotos fijas
(`instalacion/imagenes/`) y el contenido con el que nace la web
(`instalacion/contenido-inicial.json`, ver «El contenido de partida»).

### Los datos de la corporación

Viven en `instalacion/datos-entidad.json`, junto al `.env` y, como él, **fuera
de git** (`.gitignore`). Si estuvieran versionados, `actualizar.sh` se negaría
a actualizar cualquier copia con datos propios, y un `git pull` chocaría con
los de cada cliente. Se crean copiando `shared/datos-entidad.ejemplo.json` (una
corporación inventada, con cada campo explicado) y rellenándolo.

Quién los lee:

- **La API**, al arrancar: `shared/datos-entidad.mjs` los busca, y el compose
  los monta en el contenedor (`./instalacion`, de solo lectura). La imagen de
  la API no los lleva.
- **La web**, de lo que escribe la API. La web compilada no los lleva: hay
  **una sola imagen para todas las corporaciones**. La API, al arrancar y cada
  vez que se cambian en el CMS, escribe en `storage/public/instalacion/`
  `/instalacion.js` (que deja la identidad y la marca en
  `window.__INSTALACION__` para la web, `src/config/instalacion.ts`), el
  manifest y la cabecera de `index.html` (título, iconos, vista previa al
  compartir), y nginx los sirve de ahí y mete la cabecera con SSI. Si
  `/instalacion.js` no llega, la web no se monta y enseña un aviso. En `npm run
  dev`, el plugin de Vite (`scripts/instalacion-vite.mjs`) sirve lo que haya
  escrito la API local o, si no, lo compone del fichero; el build no los
  necesita.
- **El contenedor de la web**, al arrancar, del mismo montaje
  (`./instalacion:/app/instalacion:ro`): `docker/nginx/40-instalacion.sh`
  comprueba el fichero y escribe `robots.txt` y el sitio de producción con el
  dominio. Si el compose monta otro sitio encima (`sitio-tras-proxy.conf` en
  el VPS, `sitio-local.conf` en local), no se toca.

**La identidad (el nombre, el tipo, la descripción, los datos legales) y la
marca, el fichero solo las siembra**: la primera vez que arranca la API pasan a
la base y a `storage/marca/`, y desde entonces se cambian en Sistema → «Datos de
la corporación» → «Identidad y marca», como el contacto. Cambiarlas en el
fichero ya no hace nada (la API lo dice en el registro). El dominio y los
módulos de instalación sí se siguen leyendo del fichero.

**Cambiar el fichero no pide construir nada**: se cambia y se reinicia lo que
lo lee:

```bash
docker compose -f compose.yaml -f compose.servidor.yaml restart api web
# o, si se ha cambiado también el compose: … up -d --force-recreate api web
```

**Un fichero mal puesto tumba también la web**: el contenedor sale con el
error en `docker compose logs web` (y el compose lo reintenta en bucle). Es a
propósito, como la API: mejor caída que con los datos de otro.
`desplegar-desamparados` lo comprueba tras la API, pidiendo `/instalacion.js`.

**Sin el fichero no arranca nada**, y es a propósito: la API, Vite y los
guiones se paran con un mensaje que dice qué hacer. Caer en el ejemplo
mandaría correos y PDF con el nombre de una corporación inventada sin que
nadie lo notara. Solo las pruebas usan el ejemplo sin pedirlo (Node y Vitest
lo marcan en el entorno), así que también vigilan que nada dependa de
Desamparados. Con `DATOS_ENTIDAD=<ruta desde la raíz>` se elige otro fichero;
el CI de verificación lo pone al ejemplo.

En el PC de desarrollo hace falta el de Desamparados en `instalacion/`. El del
último commit que lo tuvo en git:

```bash
mkdir -p instalacion
git show 935099b:shared/datos-entidad.json > instalacion/datos-entidad.json
```

**Antes de cargar su censo**, el contrato de encargado del tratamiento firmado:
la corporación es responsable de los datos de sus hermanos y quien instala y
mantiene, encargado. Plantilla y cómo rellenarla en
[`venta/contrato-encargado-tratamiento.md`](venta/contrato-encargado-tratamiento.md).

### La marca

Lo que hace reconocible a cada corporación sin tocar el código: **dos colores**
y **unas imágenes** (el escudo, los iconos, la imagen de compartir y la de los
correos). Viven fuera de git y fuera de las imágenes de Docker: una sola imagen
sirve a cualquier corporación y un `git pull` no choca con la marca de nadie.

**Se cambian desde el CMS**: Sistema → «Datos de la corporación» → «Identidad y
marca», solo Administración. Ahí se suben las imágenes (cualquier PNG, JPEG o
WebP: la API las pasa al formato y la medida de su sitio y saca del escudo
sobre oscuro los cuatro iconos) y se eligen los colores, con una muestra y el
aviso de contraste antes de guardar. Se aplica al momento a los correos y los
PDF, y la web lo enseña en la siguiente página que se abra: no se reinicia
nada. Las imágenes subidas viven en `storage/marca/` (entran en la copia de
seguridad con el resto de `storage/`) y lo que sirve nginx, en
`storage/public/marca/`.

**Lo de abajo (el grupo `marca` del fichero y `instalacion/marca/`) solo
siembra la primera vez**: es la forma de llegar con la marca ya puesta a una
instalación nueva. Si la primera vez no hay nada, se usa la **marca de
partida** (`shared/marca-de-partida/`): el burdeos y el oro de siempre y un
escudo genérico (un contorno de escudo con filete, sin símbolos), y luego se
sube la buena desde el CMS.

#### Los colores

En el grupo `marca` de `instalacion/datos-entidad.json`:

```json
"marca": { "colorPrincipal": "#6e1822", "colorAcento": "#dec72b" }
```

- **`colorPrincipal`**: el de relleno con letra blanca encima (botones, avatar,
  lo elegido). El de partida es el burdeos `#6e1822`.
- **`colorAcento`**: el que se escribe sobre el fondo oscuro de la web (enlaces
  activos, filetes, foco). El de partida es el oro `#dec72b`.
- Formato **`#rrggbb`**. Las mayúsculas valen (se guardan en minúsculas); la
  forma corta `#abc` y los nombres (`red`) son un error y no arranca nada.
  `null`, o quitar el grupo, deja los de partida.

De esos dos salen **todos** los tonos de la web, de los PDF y de los correos
(`shared/colores-de-marca.mjs`): cada uno conserva el matiz del color dado y
ajusta su luminosidad hasta cumplir el contraste que le toca. **Un color que no
da el contraste no impide arrancar: se corrige y se avisa** con la cifra y el
color que se usará en su lugar, por ejemplo:

```
marca.colorPrincipal #e8a0a0: con letra blanca da 2,1:1 (AA pide 4,5:1); los botones usarán #9c4a4a.
```

Se avisa también si los dos colores casi no se distinguen (menos de 1,3:1
entre ellos). Con los colores de partida, o con `null`, cada tono es
exactamente el de siempre: Desamparados no cambia ni un píxel.

#### Las imágenes

En `instalacion/marca/`, con estos nombres exactos. **Todos son opcionales** y
**solo PNG o JPEG**: los PDF (PDFKit) no admiten WebP ni SVG, y Outlook no
pinta WebP.

| Fichero | Formato | Medidas | Para qué | Si falta |
|---|---|---|---|---|
| `escudo-sobre-oscuro.png` | PNG con transparencia | alto ≥ 176; ideal 176–480; hasta 150 KB | La web: barra, cajón, CMS, área de hermanos, acceso, placas de las noticias sin foto | El de partida (blanco) |
| `escudo-sobre-claro.png` | PNG con transparencia | alto ≥ 200; ideal ~300 | El membrete de los correos y el pie de los PDF | El de partida (casi negro) |
| `escudo-destacado.png` | PNG con transparencia | alto ≥ 200 | La papeleta (web y PDF) y los membretes de los PDF | `escudo-sobre-claro.png` en papel; `escudo-sobre-oscuro.png` en la banda negra de los informes y en la web |
| `favicon-32.png` | PNG | 32×32 exactos | La pestaña del navegador | El de partida |
| `apple-touch-icon.png` | PNG **opaco** | 180×180 exactos | El icono de iOS en la pantalla de inicio | El de partida |
| `icono-192.png` | PNG | 192×192 exactos | El manifest (Android) | El de partida |
| `icono-512.png` | PNG | 512×512 exactos | El manifest; y la imagen de compartir si no hay `compartir.jpg` | El de partida |
| `compartir.jpg` | JPEG | ideal 1200×630; ancho ≥ 600; hasta 1 MB | `og:image` al compartir un enlace y la imagen de los datos estructurados | `icono-512.png`, en pequeño (`twitter:card=summary`) |
| `correo-cabecera.jpg` | JPEG | ancho ≥ 600, ideal 1200; hasta 150 KB | La imagen bajo el membrete de los correos a los hermanos | Los correos van sin imagen |

Las subcarpetas (`originales/`, para guardar los ficheros de partida del
cliente) y los ficheros que empiezan por `.` se ignoran.

**Errores y avisos.** Lo comprueba la API al arrancar (`src/domain/marca.ts`,
con `shared/marca.mjs`); al subir desde el CMS, las mismas reglas dicen por qué
no sirve una imagen.

- **Error: no arranca la API**, con el fichero y el motivo en
  `docker compose logs api`. Un fichero que **está pero no sirve**: no es
  PNG ni JPEG, o es de un formato con la extensión de otro (un WebP renombrado
  a `.png`: cambiar la extensión no basta, hay que convertirlo); está cortado o
  roto; no se puede leer (permisos: ver abajo); un icono sin su medida exacta;
  más de 2 MB (casi seguro un original sin preparar); o la carpeta misma no se
  puede leer.
- **Aviso: arranca**, y el aviso queda en el registro (`[marca] …`). Falta un
  fichero (se usa el de partida o su respaldo); medidas por debajo de lo
  recomendado o muy por encima de lo que se ve; peso alto; un escudo sin
  transparencia; un `apple-touch-icon.png` con canal alfa (iOS pinta de negro
  lo transparente); un fichero que no es de la marca, con el nombre que
  probablemente quería ser (`escudo-sobre-oscuro.webp` → «¿`escudo-sobre-oscuro.png`?»);
  no hay carpeta (todo de partida).

Un PNG entrelazado no es error: PDFKit lo lee bien (hay prueba que lo compara).

#### Preparar los ficheros: `npm run marca`

Para sembrar una instalación nueva sin pasar por el CMS; desde el CMS no hace
falta, la API hace lo mismo al subir (`shared/preparar-marca.mjs`).
`desamparados-web/scripts/preparar-marca.mjs`. Usa `sharp` del backend (no es
dependencia de la web), así que pide `npm install` en `backend-desamparados/`.
Desde la raíz, las rutas son relativas a donde se lanza:

```bash
# Los cuatro iconos (favicon, apple-touch-icon, 192 y 512) de una instalación,
# a partir de su escudo para fondo oscuro, centrado sobre la tinta #100e11 y
# sin canal alfa (así apple-touch-icon sale opaco).
npm --prefix desamparados-web run marca -- --escudo escudo-blanco.png --destino instalacion/marca

# El escudo de la web reducido (176–300 px de alto) y en PNG de paleta: va en
# todas las páginas y el original pesaría demasiado. El de Desamparados queda
# en ~25 KB.
npm --prefix desamparados-web run marca -- --optimizar escudo-blanco.png --destino instalacion/marca/escudo-sobre-oscuro.png

# Rehace los PNG de shared/marca-de-partida/ desde su escudo.svg. Solo si
# cambia el SVG; esos PNG están en git.
npm --prefix desamparados-web run marca -- --partida
```

`compartir.jpg` y `correo-cabecera.jpg` se preparan a mano (recortar y
exportar en JPEG); el escudo sobre claro y el destacado, también.

#### Permisos

La API publica la marca en `storage/public/marca/`, siempre en `0644`, y nginx
la sirve desde ahí; la semilla la lee del montaje, como el usuario `node`. Aun
así, **los ficheros de `instalacion/marca/` tienen que poder leerlos otros
usuarios**: en `0644`, y la carpeta en `755`. No copiarlos como
`datos-entidad.json` (`-m 640`): la API no podría leerlos y no arrancaría
(«no se puede leer (EACCES)… chmod 644»).

```bash
sudo install -d -o desamparados -g desamparados -m 755 /srv/desamparados/instalacion/marca
sudo install -o desamparados -g desamparados -m 644 <ficheros> /srv/desamparados/instalacion/marca/
```

En Windows, nunca con `>` de PowerShell: escribe en UTF-16 y estropea los
binarios. `cp` o `copy`, o Git Bash.

#### Aplicar un cambio

Desde el CMS, al guardar o al subir. `instalacion/marca/` y el grupo `marca`
del fichero ya no cambian nada tras la primera vez: para volver a sembrar
desde ellos habría que borrar la fila `corporacion_marca` de `Configuracion` y
la carpeta `storage/marca/`, y reiniciar la API.

En el CMS se ve qué imagen es propia y cuál de partida. En el registro:

```bash
sudo docker compose -f compose.yaml -f compose.servidor.yaml logs api | grep -i marca
```

**Caché.** nginx sirve `/marca/` con una semana de caché, pero cada URL lleva
`?v=` con los 8 primeros caracteres del sha256 del fichero, e `index.html` no
se cachea: **un escudo nuevo se ve en cuanto se recarga la página**. Lo que no
se puede cambiar: los correos ya enviados (llevan las imágenes incrustadas),
el icono de un móvil que ya añadió la web a su pantalla de inicio y la imagen
que una red social ya guardó de un enlace. Los iconos de antes de esta etapa
(`/favicon.ico`, `/favicon-32.png`, `/apple-touch-icon.png`, `/icono-192.png`,
`/icono-512.png`, en la raíz) redirigen con un 301 a `/marca/`.

#### Antes del primer despliegue con la marca fuera de git (Desamparados)

Desde la etapa 4 de la Fase 8 (octubre de 2026), la imagen ya no lleva el
escudo ni los iconos de Desamparados. **Sin este paso, el VPS arrancaría con el
escudo genérico** (no se rompe nada, pero se ve). Se hace antes de lanzar el
despliegue.

En el PC, desde PowerShell en la carpeta del proyecto (con `instalacion/marca/`
completa: ver `notas-del-proyecto.md` §13 si no la tiene):

```powershell
scp -r instalacion\marca ubuntu@51.255.45.220:/tmp/marca
```

(`/tmp/marca` no debe existir antes: si existe, `scp -r` la mete dentro, en
`/tmp/marca/marca`.)

En el servidor:

```bash
sudo install -d -o desamparados -g desamparados -m 755 /srv/desamparados/instalacion/marca
sudo install -o desamparados -g desamparados -m 644 /tmp/marca/*.* /srv/desamparados/instalacion/marca/
rm -r /tmp/marca
ls -l /srv/desamparados/instalacion/marca
```

`*.*` deja fuera `originales/`, que no hace falta en el servidor. Tras el
despliegue, el `grep -i marca` de arriba no tiene que decir ningún «Falta …».

**Con la identidad y la marca en el CMS (octubre de 2026), basta con que esto
esté hecho antes del primer arranque de esa versión**: la API copia entonces
`instalacion/marca/` a `storage/marca/` y la identidad y los colores del
fichero a la base. En el VPS de pruebas ya lo está; en una instalación nueva,
se hace antes de `instalar.sh`.

### Las fotos de la corporación

Las fotos fijas que trae la web de una corporación (el hero, las cabeceras de
las páginas, el ajuar, los enseres, el trono, los nazarenos, el templo…) viven
en **`instalacion/imagenes/`**, fuera de git y fuera de la imagen de Docker,
como la marca. La web las pide en **`/images/…`**, la misma dirección de
siempre: la base de datos guarda esas URL en las páginas y en la portada, y no
hay que tocarlas.

- **Qué va**: lo que antes era `desamparados-web/public/images/`, **con la
  misma estructura** (`hero-1920.webp`, `cabeceras/rostro.webp`,
  `ajuar/manto.webp`…): `/images/cabeceras/rostro.webp` es
  `instalacion/imagenes/cabeceras/rostro.webp`. Solo se sirven fotos (`.webp`,
  `.jpg`, `.jpeg`, `.png`, `.avif`, `.gif`); otro fichero, uno oculto o uno que
  no está dan **404**.
- **Las cabeceras llevan su copia de 1000 px** al lado
  (`cabeceras/rostro-1000.webp`), que es la que se baja el móvil; y algunas
  fijas, sus copias reducidas (`hero-960.webp`, `nazarenos-1200.webp`…). La
  lista, en `desamparados-web/src/config/fotosDeLaInstalacion.ts`.
- **Cómo se sirven**: nginx las lee **directamente del montaje**
  (`location /images/` con `alias /app/instalacion/imagenes/`, en
  `docker/nginx/ubicaciones.conf` y `sitio-local.conf`), sin copiarlas en cada
  arranque como la marca: son megas y el VPS es justo. En `npm run dev` y
  `vite preview` las sirve el plugin de `scripts/instalacion-vite.mjs` desde la
  misma carpeta. Una foto nueva se ve al momento, sin reiniciar nada (nginx la
  cachea una semana en el navegador: a una sustituida con el mismo nombre le
  cuesta eso).
- **Sin la carpeta no se rompe nada**: cada foto es un 404 y la web pinta su
  fondo donde iba (la cabecera de la portada sin foto, los carteles de la
  agenda sin la columna de la foto…). Una instalación nueva no tiene por qué
  tenerla: sus fotos las sube desde el CMS (`/storage/public/`).

**Permisos.** Como nginx las lee del montaje con su propio usuario (no root),
**tienen que poder leerlas otros**: ficheros en `644` y **todas las carpetas en
`755`, `instalacion/` incluida** (la crea así `instalar.sh`). Con un fichero en
`640` esa foto da **403**; con una carpeta en `750`, todas las de dentro.

#### Antes del primer despliegue con las fotos fuera de git (Desamparados)

Desde la etapa 6 de la Fase 8 (octubre de 2026), la imagen ya no lleva las
fotos de Desamparados. **El VPS NECESITA `instalacion/imagenes/` antes de
desplegar**: sin ella, todas las fotos de las páginas, de la portada y de la
agenda que apuntan a `/images/` dan 404 (no se rompe la web, pero se queda sin
fotos). En el PC, desde PowerShell en la carpeta del proyecto (con
`instalacion/imagenes/` completa; si no la tiene, ver `notas-del-proyecto.md`
§13):

```powershell
scp -r instalacion\imagenes ubuntu@51.255.45.220:/tmp/imagenes
```

(`/tmp/imagenes` no debe existir antes: si existe, `scp -r` la mete dentro.)

En el servidor (`cp -r` con `--no-preserve=mode` y después los permisos, que
`install` no copia carpetas enteras):

```bash
sudo rm -rf /srv/desamparados/instalacion/imagenes
sudo cp -r --no-preserve=mode,ownership /tmp/imagenes /srv/desamparados/instalacion/imagenes
sudo chown -R desamparados:desamparados /srv/desamparados/instalacion/imagenes
sudo find /srv/desamparados/instalacion/imagenes -type d -exec chmod 755 {} +
sudo find /srv/desamparados/instalacion/imagenes -type f -exec chmod 644 {} +
sudo chmod 755 /srv/desamparados/instalacion
rm -r /tmp/imagenes
```

No hace falta reiniciar nada para que se vean (nginx las lee en cada
petición), pero el `location /images/` nuevo llega con la imagen nueva: hasta
el despliegue, la web vieja las sigue sirviendo de dentro. Comprobarlo después:

```bash
curl -sI https://pruebas.desamparadosmalaga.com/images/hero-1920.webp | head -3   # 200, image/webp
curl -sI https://pruebas.desamparadosmalaga.com/images/no-esta.webp | head -1     # 404
```

Un 403 es de permisos (ver arriba).

### El mapa del barrio

El plano del recorrido (el bloque «Itinerario» sobre el mapa, su editor en el
CMS y la página 404) se pinta sobre **las calles del barrio de la
corporación**: un fichero de OpenStreetMap que vive en
**`instalacion/mapas/barrio.json`**, fuera de git y de la imagen, como las
fotos. La web lo pide en **`/mapas/barrio.json`**: nginx lo lee del montaje
(`location = /mapas/barrio.json` con `alias`, en `ubicaciones.conf` y
`sitio-local.conf`) y Vite, en `npm run dev` y `vite preview`, desde la misma
carpeta. Las fuentes del mapa (`/mapas/fuentes/`, glifos de MapLibre) son
genéricas y siguen en la web.

- **Sin el fichero no se rompe nada** (404): el itinerario «sobre el mapa» se
  enseña como la línea de paradas, la 404 se queda con el texto y el editor
  del recorrido del CMS dice que esta instalación no tiene mapa del barrio (las
  paradas se siguen editando).
- **Permisos**: como las fotos, `644` el fichero y `755` las carpetas,
  `instalacion/` incluida. Si no, 403 y el mapa dice «No se pudo cargar».
- **Comprimido, opcional pero recomendable**: pesa más de un mega. Con un
  `barrio.json.gz` al lado (`gzip -k -9 barrio.json`), nginx manda ese
  (`gzip_static`) y no comprime en cada visita. Si se regenera el `.json`, hay
  que rehacer el `.gz`, o se seguiría sirviendo el viejo.
- **Caché**: un día en el navegador.

#### Antes del primer despliegue con el mapa fuera de git (Desamparados)

Desde la etapa 6 de la Fase 8, la imagen ya no lleva el barrio de
Desamparados. **El VPS NECESITA `instalacion/mapas/barrio.json` antes de
desplegar**: sin él, la página del recorrido sale en lista y la 404 sin plano.
En el PC, desde PowerShell en la carpeta del proyecto:

```powershell
scp instalacion\mapas\barrio.json ubuntu@51.255.45.220:/tmp/barrio.json
```

En el servidor:

```bash
sudo install -d -o desamparados -g desamparados -m 755 /srv/desamparados/instalacion/mapas
sudo install -o desamparados -g desamparados -m 644 /tmp/barrio.json /srv/desamparados/instalacion/mapas/barrio.json
cd /srv/desamparados/instalacion/mapas && sudo -u desamparados gzip -k -9 -f barrio.json && sudo chmod 644 barrio.json.gz
rm /tmp/barrio.json
curl -sI https://pruebas.desamparadosmalaga.com/mapas/barrio.json | head -1   # 200 (tras el despliegue)
```

#### El barrio de otra corporación

No hay orden que lo genere: el de Desamparados se descargó a mano de
[Overpass](https://overpass-turbo.eu) el 25-09-2026. Para otra corporación:

1. **La caja**: el recorrido con unos 400 m de margen por cada lado, en
   grados `[oeste, sur, este, norte]`. Más grande pesa más y no aporta nada.
2. **La consulta** en Overpass, con esa caja (`sur,oeste,norte,este`):
   ```
   [out:json][timeout:60];
   (
     way["highway"](S,O,N,E);
     way["building"](S,O,N,E);
     way["leisure"~"park|garden"](S,O,N,E);
     way["landuse"~"grass|forest|recreation_ground"](S,O,N,E);
   );
   out geom;
   ```
3. **Convertirla a la forma que lee la web** (`Barrio` en
   `desamparados-web/src/components/mapa/barrio.ts`; el de Desamparados sirve
   de ejemplo):
   - `licencia`: «Datos © colaboradores de OpenStreetMap, con licencia ODbL
     (https://www.openstreetmap.org/copyright). Descargados de Overpass el
     <fecha>.» Es obligatoria (ODbL) y el mapa la enseña siempre.
   - `caja`: la del paso 1.
   - `calles`: FeatureCollection de `LineString` con `{ clase, nombre }`;
     `clase` es `mayor` (primary, secondary, tertiary…), `menor` (residential,
     unclassified, living_street), `peatonal` (pedestrian, footway, steps) o
     `servicio` (service). El editor pega el recorrido a estas calles.
   - `edificios`: FeatureCollection de `Polygon` con `{ alto }` en metros (de
     `height`, o `building:levels` × 3; si no hay nada, 10). El más cercano a
     la salida del recorrido se pinta como el templo.
   - `verdes`: FeatureCollection de `Polygon`.
   - Coordenadas con 6 decimales (de sobra para un barrio y el fichero pesa
     menos).
4. Dejarlo en `instalacion/mapas/barrio.json` (y su `.gz`), con los permisos
   de arriba. Después se dibuja el recorrido en el CMS, en el bloque
   «Itinerario» de la página del recorrido.

### El contenido de partida

Los textos con los que nace la web pública (la portada y las 20 páginas por
bloques) salen de **`shared/contenido-por-defecto.json`**, que desde la etapa
6 de la Fase 8 es **neutro**: textos genéricos y presentables, sin nombre de
corporación, ciudad, templo ni calles, y sin ninguna foto. Cada corporación
los cambia desde el CMS. Una prueba (`sin-corporacion-escrita.test.ts`) impide
que vuelva a nombrar a nadie o a citar fotos de `/images/`.

Lo propio de una corporación puede traerse escrito en
**`instalacion/contenido-inicial.json`** (la «semilla»), fuera de git como
`datos-entidad.json`:

- **Misma forma que el de partida** y cualquier subconjunto de páginas: una
  clave por página (`"portada"`, `"historia"`…), y dentro de cada una solo lo
  que se quiera cambiar; lo que falte sale del neutro (los objetos se mezclan
  campo a campo; una lista, como `bloques`, sustituye entera a la del neutro).
- **Se valida al arrancar la API**: una página que no existe, una clave que el
  neutro no tiene (se perdería en silencio), un valor de otro tipo o un
  documento que no pasa el esquema de su página **impiden arrancar**, con la
  lista de todo lo que falla. El HTML se sanea como en un guardado del CMS.
- **Solo cuenta para las páginas que aún no tienen fila** en la base
  (`ContenidoPagina`). El arranque de la API (y `npm run seed`) crea las que
  falten con la semilla de esa página o, si no la trae, con el neutro. **Nunca
  pisa una que exista**: desde que hay fila, manda la base, como con el
  contacto y los módulos. Cambiar el fichero después no cambia nada.
- **Sin el fichero no pasa nada**: las páginas que falten nacen neutras.

**El VPS de Desamparados no la necesita**: sus 21 páginas ya están en la base
con su contenido de siempre, y el arranque no las toca. La de Desamparados
(el contenido de partida tal como era antes de la etapa 6) está guardada en
`instalacion/contenido-inicial.json` del PC A; sirve para montar una base
nueva de Desamparados (otra web de pruebas, una restauración sin copia) con su
contenido. Para eso se sube como `contenido-inicial.json`, en `644`, **antes del
primer arranque** contra esa base.

En las pruebas no se lee la de la máquina; una prueba que quiera una la pide
con `CONTENIDO_INICIAL_DE_PRUEBA=<ruta relativa a la raíz>` (hay ejemplos en
`shared/__fixtures__/contenido-inicial/`).

### Instalar una nueva

En un servidor limpio con Docker y su plugin compose:

```bash
sudo git clone <repositorio> /srv/desamparados
cd /srv/desamparados
# El dominio apuntando ya a este servidor. La primera vez, instalar.sh crea
# instalacion/datos-entidad.json desde el ejemplo y para: se rellena y se
# vuelve a lanzar (no sigue mientras tenga el dominio del ejemplo).
sudo ./docker/instalar.sh secretaria@corporacion.es
```

Antes de lanzarlo, si los tiene, se dejan en `instalacion/` lo demás de la
corporación: `marca/`, `imagenes/`, `mapas/barrio.json` y
`contenido-inicial.json` (cada uno en su apartado de arriba). Ninguno es
obligatorio, pero **`contenido-inicial.json` solo cuenta en el primer
arranque**: después ya existen todas las páginas. Por eso el guion, justo antes
de arrancar, dice qué ha encontrado y qué pasa con lo que falta.

Hace en orden lo de «El usuario del sistema…» y «Orden de una puesta en
producción»: crea el usuario, genera el `.env` con secretos nuevos (y para la
primera vez hasta que se pongan en él `EMAIL_USER` y `EMAIL_PASS`: sin correo
saliente la API no arranca en producción), prepara
`storage/` y los permisos de `instalacion/` (755 la carpeta; `marca/`,
`imagenes/` y `mapas/` en 755/644, que nginx los lee con su propio usuario),
pide el certificado, levanta todo, comprueba que la web ha escrito sus datos
al arrancar (si no, enseña su registro y para), siembra y cifra los secretos
del doble factor. Si se corta, se vuelve a lanzar: no pisa un `.env` que ya
exista ni repite el certificado. **La contraseña del administrador sale una
sola vez por pantalla.** Lo demás que no puede adivinar (copias, Redsys,
SEPA) lo dice al terminar.

Con `--sin-certificado` se salta el paso 4, para probar antes de tener el
dominio, y el `.env` nace sin el perfil `tls`. Al volver a lanzarlo sin la
opción, saca el certificado y añade `tls` a `COMPOSE_PROFILES`: sin él no
arranca `certbot`, que es quien lo renueva.

Si falta `contenido-inicial.json` y la API no ha arrancado nunca, pregunta
antes de levantar nada si se sigue sin él (solo con alguien delante: lanzado
sin terminal, sigue).

### Actualizar una

```bash
cd /srv/desamparados
sudo -u desamparados ./docker/actualizar.sh           # a lo último de main
sudo -u desamparados ./docker/actualizar.sh v1.4.0    # a una versión concreta
```

Hace la copia de seguridad **antes** de tocar nada (lee
`/etc/desamparados/copia.env`; sin ella se niega, salvo con `--sin-copia`),
deja `instalacion/` en los permisos de arriba (si no puede, avisa: lo que
nginx no lea da 403), trae el código solo por avance rápido, construye las
imágenes con la web aún en marcha, levanta (las migraciones se aplican solas),
espera a que la API esté sana y comprueba que la web ha arrancado: con un dato
o una imagen de la marca mal puestos, la web sale y el compose la reintenta en
bucle sin decir nada; el guion enseña su registro. No vuelve atrás solo: con la base ya migrada, el código anterior no la
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
ejecutar `sudo -u desamparados ./docker/actualizar.sh` sin contraseña, y hay
que haber entrado una vez a mano en cada servidor para aceptar su huella: el
guion usa ssh sin preguntas y, con una huella desconocida, esa instalación
cuenta como fallida («Host key verification failed»).

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
   Y `instalacion/` (datos de la corporación, marca, fotos fijas, mapa), que
   no está en git ni en la imagen: sin ella la web no arranca. El `.env` no va
   en la copia: lleva `TOTP_ENC_KEY`, y la copia no debe ir con su llave.
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
# restauracion/db.sql, restauracion/storage/ y restauracion/instalacion/

# 2. La base de datos, primero en una de prueba. `mariadb` como root dentro
#    del contenedor, con la clave de su propio entorno (como backup-vps.sh):
#    con `-p` y `exec -T` el cliente leería la contraseña del volcado y
#    respondería «Access denied».
root() { docker compose exec -T db sh -c 'MYSQL_PWD="$MARIADB_ROOT_PASSWORD" mariadb -u root "$@"' sh "$@"; }
root -e "CREATE DATABASE desamparados_prueba CHARACTER SET utf8mb4"
root desamparados_prueba < restauracion/db.sql
root -e "SELECT COUNT(*) FROM desamparados_prueba.User"

# 3. Solo para restaurar de verdad:
#    docker compose stop api web
#    root desamparados_db < restauracion/db.sql
#    Como root y devolviendo el dueño: «sudo -u desamparados rsync» no puede
#    leer la carpeta donde se ha descifrado la copia.
#    sudo rsync -a --delete restauracion/storage/ \
#      /srv/desamparados/backend-desamparados/storage/
#    sudo chown -R desamparados:desamparados /srv/desamparados/backend-desamparados/storage
#    Lo mismo con instalacion/, que nginx lee con su usuario: 755/644.
#    sudo rsync -a --delete restauracion/instalacion/ /srv/desamparados/instalacion/
#    sudo chown -R desamparados:desamparados /srv/desamparados/instalacion
#    sudo find /srv/desamparados/instalacion -type d -exec chmod 755 {} + -o -type f -exec chmod 644 {} +
#    docker compose start api web

# 4. Borrar lo descifrado al terminar: lleva el censo entero en claro
rm -rf restauracion
root -e "DROP DATABASE desamparados_prueba"
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
- [ ] Si el correo sale por Brevo: dar de alta el webhook de los rebotes y
      probarlo («Rebotes de correo»). Sin él, un correo que rebota sigue
      saliendo como enviado y la ficha no avisa.
- [ ] Rellenar los datos legales en `desamparados-web/src/config/site.ts`: hasta
      entonces, el aviso legal muestra «pendiente de confirmar».
