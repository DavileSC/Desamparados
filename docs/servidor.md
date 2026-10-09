# El servidor (VPS de OVH)

Cómo está el servidor de verdad y cómo se monta en él la web de pruebas. La
guía general del despliegue, pensada para una máquina vacía, es
[`despliegue.md`](despliegue.md); este documento dice qué cambia en esta.

**El estado real del servidor manda sobre lo que pone aquí.** Antes de cambiar
algo, mirarlo; si no coincide, decirlo y corregir este documento.

**Los comandos del servidor los ejecuta el usuario**, no Claude: Claude los
prepara y explica, y trabaja con la salida que se le pega.

## Lo que hay

Comprobado el 05-10-2026.

| | |
|---|---|
| Proveedor | OVH, VPS-1: 2 vCores, 4 GB (3,7 útiles), 40 GB de disco (33 libres) |
| Nombre | `vps-53f0533e`, IP `51.255.45.220` |
| Sistema | Ubuntu 26.04.1 LTS, núcleo 7.0 |
| Acceso | SSH por clave en el 22, usuario `ubuntu` con sudo; sin contraseña ni root directo |
| Swap | 2 GB en `/swapfile` |
| Docker | 29.8 con Compose 5.5. `ubuntu` no está en el grupo `docker`: se usa `sudo` |
| Cortafuegos | UFW: solo 22, 80 y 443 (IPv4 e IPv6) |
| Además | fail2ban (jaula `sshd`) y `unattended-upgrades`, activos |
| nginx | **El del sistema** (1.28), con el 80 y el 443. Un solo sitio: `/etc/nginx/sites-available/desamparadosmalaga.com` |
| Certificados | certbot del sistema. `desamparadosmalaga.com` y `www`, renovación automática probada |
| Página de mantenimiento | `/var/www/desamparadosmalaga/`, servida en el dominio principal |

El dominio está en **IONOS** (registro y DNS) y el servidor en OVH: los
registros se cambian en el panel de IONOS. `@` es un A a la IP; `www`, un CNAME
a `@`; `pruebas`, un A a la IP. **Ninguno debe tener AAAA**: el servidor no
tiene IPv6 pública, e IONOS, al crear un subdominio, puede contestar con la
IPv6 de su página de aparcamiento, que hace fallar el certificado. Al crear
`pruebas`, IONOS le añadió también registros de correo (MX, SPF, DKIM): no
afectan a la web.

### Reglas para tocarlo

- Mirar antes de cambiar, y no dar por hecho que algo sigue como estaba.
- `sudo nginx -t` antes de cada `reload` de nginx (y `reload`, no `restart`);
  `sudo sshd -t` antes de tocar SSH, sin cerrar la sesión abierta hasta
  comprobar que se puede entrar.
- No abrir puertos nuevos: todo entra por el nginx del sistema.
- No reiniciar la máquina ni desactivar fail2ban o las actualizaciones
  automáticas sin un motivo claro.
- Ningún secreto en este documento ni en el chat (contraseñas, claves, el
  `.env`). Si hace falta saber si una variable existe, se mira enmascarada.

## Cómo va montada la web

```
visitante ──https──▶ nginx del sistema ──┬─ desamparadosmalaga.com, www: página de mantenimiento
                     (80, 443, certbot)  └─ pruebas.…: usuario y contraseña ──▶ 127.0.0.1:8080
                                                                                 │
                                    docker compose (compose.yaml + compose.servidor.yaml)
                                    nginx del contenedor ─▶ api ─▶ db (MariaDB 11.8)
                                                            └────▶ clamav
```

- El nginx del sistema sigue mandando: tiene los puertos, los certificados y la
  página de mantenimiento, que no se toca hasta la presentación.
- Nuestro montaje es el de siempre con dos cambios (`compose.servidor.yaml`): el
  nginx del contenedor escucha solo en `127.0.0.1:8080`, por http, y las
  imágenes no se construyen aquí, se descargan del registro de GitHub.
- La IP del visitante pasa en `X-Forwarded-For` de un nginx al otro; la API
  sigue con `NUM_PROXIES=1` (por qué, en `docker/nginx/sitio-tras-proxy.conf`).
- Dos usuarios del sistema: **`desamparados`**, sin shell, dueño de
  `/srv/desamparados` y de las subidas, en el grupo `docker`; y
  **`despliegue`**, por el que entra GitHub, que solo puede lanzar el guion de
  despliegue como `desamparados`.

## Puesta en marcha de la web de pruebas (una vez)

Desde la sesión de `ubuntu`, en este orden. Cada bloque se puede comprobar
antes de pasar al siguiente.

### 1. Los usuarios y la carpeta de configuración

```bash
sudo useradd --system --shell /usr/sbin/nologin --user-group desamparados
sudo usermod -aG docker desamparados
sudo useradd --create-home --shell /bin/bash despliegue
sudo install -d -m 750 -o desamparados -g desamparados /etc/desamparados
id desamparados; id despliegue
```

El grupo `docker` equivale a root en la máquina: por eso `desamparados` no
tiene shell ni contraseña.

### 2. Una clave para que el servidor lea el repositorio

El repositorio es privado. El servidor lo lee con una clave propia que solo
sirve para leer este repositorio (una *deploy key* de GitHub):

```bash
sudo -u desamparados ssh-keygen -t ed25519 -N "" -C "vps pruebas, solo lectura" -f /etc/desamparados/clave-github
sudo cat /etc/desamparados/clave-github.pub
```

La línea que sale (la **pública**, `.pub`) va en GitHub: repositorio →
Settings → Deploy keys → Add deploy key, **sin** marcar «Allow write access».

La huella de GitHub, para no fiarse de cualquiera que conteste:

```bash
ssh-keyscan -t ed25519 github.com 2>/dev/null | sudo -u desamparados tee /etc/desamparados/github_known_hosts
sudo ssh-keygen -lf /etc/desamparados/github_known_hosts
```

La huella tiene que ser `SHA256:+DiY3wvvV6TuJJhbpZisF/zLDA0zPMSvHdkr4UvCOqU`
(la que publica GitHub en «GitHub's SSH key fingerprints»). Si no coincide, parar.

### 3. El repositorio

```bash
sudo install -d -o desamparados -g desamparados /srv/desamparados
cd /tmp
sudo -u desamparados env GIT_SSH_COMMAND="ssh -i /etc/desamparados/clave-github -o IdentitiesOnly=yes -o UserKnownHostsFile=/etc/desamparados/github_known_hosts" \
  git clone git@github.com:DavileSC/Desamparados.git /srv/desamparados
```

### 4. El `.env`

Los secretos se generan aquí y no salen del servidor:

```bash
cd /srv/desamparados
sudo -u desamparados cp docker/.env.example .env
sudo chmod 600 .env
clave() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 32; }
sudo sed -i \
  -e "s|^COMPOSE_PROFILES=.*|COMPOSE_PROFILES=antivirus|" \
  -e "s|^APP_UID=.*|APP_UID=$(id -u desamparados)|" \
  -e "s|^APP_GID=.*|APP_GID=$(id -g desamparados)|" \
  -e "s|^DATABASE_PASSWORD=.*|DATABASE_PASSWORD=$(clave)|" \
  -e "s|^DATABASE_ROOT_PASSWORD=.*|DATABASE_ROOT_PASSWORD=$(clave)|" \
  -e "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 64)|" \
  -e "s|^TOTP_ENC_KEY=.*|TOTP_ENC_KEY=$(openssl rand -hex 32)|" \
  -e "s|^FRONTEND_URL=.*|FRONTEND_URL=https://pruebas.desamparadosmalaga.com|" \
  -e "s|^API_URL=.*|API_URL=https://pruebas.desamparadosmalaga.com|" \
  -e "s|^EMAIL_USER=.*|EMAIL_USER=davile17x@gmail.com|" \
  -e "s|^SEED_ADMIN_EMAIL=.*|SEED_ADMIN_EMAIL=davile17x@gmail.com|" \
  .env
```

El `.env` del servidor es este, `/srv/desamparados/.env`, y es el único que
lee la API en Docker; el `backend-desamparados/.env` del equipo de desarrollo
no se usa aquí. `TOTP_ENC_KEY` se genera nueva: la base de pruebas no tiene
ninguna cuenta con el doble factor activado (en desarrollo, sin esa variable,
la clave sale de `JWT_SECRET`), así que no hay secretos que conservar.

Quedan a mano, con `sudo nano /srv/desamparados/.env`:

- **`EMAIL_PASS`**: una *contraseña de aplicación* de la cuenta de Gmail
  (Cuenta de Google → Seguridad → Verificación en dos pasos → Contraseñas de
  aplicación), no la contraseña normal. Gmail deja enviar unos 500 correos al
  día.
- Si se quiere probar el pago, las `REDSYS_*` del entorno de **pruebas** (las
  del `.env` de desarrollo), con `PAGO_EN_LINEA=redsys` y
  `REDSYS_ENTORNO=pruebas`, **y además `PAGO_DE_PRUEBA_EN_PRODUCCION=si`**.
  La API corre aquí con `NODE_ENV=production`, y en producción un pago que no
  cobra de verdad (simulado, o Redsys sin `REDSYS_ENTORNO=real`) impide
  arrancar si no se consiente así por escrito. Esa línea es solo de la web de
  pruebas: en la de verdad no debe estar nunca.

Comprobar sin enseñar los valores:

```bash
sudo grep -E '^[A-Z_]+=' /srv/desamparados/.env | sed -E 's/=.+/=****/; s/=$/= (VACÍA)/'
```

Y los datos de la corporación, que tampoco están en git
(`instalacion/datos-entidad.json`, ver «Los datos de la corporación» en
`despliegue.md`). La API los lee del volumen al arrancar y sin ellos no
arranca; `desplegar-desamparados` se para antes si faltan. Son los mismos que
la variable `DATOS_ENTIDAD` de GitHub (paso 6), con la que se compila la web.

**Se sube con `scp`, no pegándolo en `nano`.** El 08-10-2026 se pegó desde
una consola de Windows y llegó con los acentos estropeados («M├ílaga»). El
JSON seguía siendo válido, así que nada falló: la API arrancó y los correos,
los PDF y el emisor del 2FA salieron con esos caracteres hasta el día
siguiente. La web no se enteró, porque se compila con la variable de GitHub.

Desde PowerShell, en la carpeta del proyecto del PC:

```powershell
scp instalacion\datos-entidad.json ubuntu@51.255.45.220:/tmp/datos-entidad.json
```

Y en el servidor:

```bash
cd /srv/desamparados
sudo -u desamparados install -d instalacion
sudo install -o desamparados -g desamparados -m 640 /tmp/datos-entidad.json instalacion/datos-entidad.json
rm /tmp/datos-entidad.json
```

Para comprobarlo, la huella de los datos, sin comentarios ni formato. Tiene
que coincidir con la del mismo fichero en el PC (el mismo `python` desde la
carpeta del proyecto). Que el JSON sea válido no basta: el estropeado también
lo era.

```bash
sudo -u desamparados python3 -c "
import json,hashlib
def l(x):
    if isinstance(x,dict): return {k:l(v) for k,v in x.items() if k!='_comentario'}
    if isinstance(x,list): return [l(v) for v in x]
    return x
print(hashlib.sha256(json.dumps(l(json.load(open('instalacion/datos-entidad.json',encoding='utf-8-sig'))),sort_keys=True,ensure_ascii=False).encode()).hexdigest()[:16])"
```

El fichero es de `desamparados` y solo lo lee él y su grupo: con el usuario
`ubuntu` da «Permission denied», y es lo esperado.

### 5. Las carpetas de las subidas

```bash
B=/srv/desamparados/backend-desamparados
sudo install -d -o desamparados -g desamparados -m 750 "$B/storage/private"
sudo install -d -o desamparados -g desamparados -m 755 "$B/storage" "$B/storage/public"
```

La pública tiene que poder leerla cualquiera: el nginx del contenedor corre
con su propio usuario, y con 750 cada foto daría 403.

### 6. El guion de despliegue y la entrada de GitHub

El guion se copia fuera del repositorio, de root: un commit no puede cambiar lo
que hace la clave de GitHub.

```bash
sudo install -o root -g root -m 755 /srv/desamparados/docker/servidor/desplegar.sh /usr/local/sbin/desplegar-desamparados
echo 'despliegue ALL=(desamparados) NOPASSWD: /usr/local/sbin/desplegar-desamparados *' | sudo tee /etc/sudoers.d/desplegar-desamparados
sudo chmod 440 /etc/sudoers.d/desplegar-desamparados
sudo visudo -cf /etc/sudoers.d/desplegar-desamparados
```

Si `desplegar.sh` cambia en el repositorio, hay que volver a copiarlo con el
`install` de arriba: el servidor no lo actualiza solo, a propósito.

La clave con la que entra GitHub, restringida a lanzar ese guion:

```bash
sudo -u despliegue ssh-keygen -t ed25519 -N "" -C "github actions" -f /home/despliegue/clave-actions
sudo -u despliegue install -d -m 700 /home/despliegue/.ssh
PUB=$(sudo cat /home/despliegue/clave-actions.pub)
printf 'command="sudo -n -u desamparados /usr/local/sbin/desplegar-desamparados \\"$SSH_ORIGINAL_COMMAND\\"",restrict %s\n' "$PUB" \
  | sudo -u despliegue tee /home/despliegue/.ssh/authorized_keys
sudo chmod 600 /home/despliegue/.ssh/authorized_keys
```

En GitHub, repositorio → Settings → Secrets and variables → Actions → New
repository secret:

- **`VPS_CLAVE_SSH`**: lo que sale de `sudo cat /home/despliegue/clave-actions`
  (la privada, entera). Después, borrarla del servidor:
  `sudo shred -u /home/despliegue/clave-actions`.
- **`VPS_HUELLA`**: lo que sale de `ssh-keyscan -t ed25519 51.255.45.220 2>/dev/null`.

Y en la pestaña **Variables** de esa misma página (no es un secreto: todo sale
en la web), **`DATOS_ENTIDAD`**: el contenido entero de
`instalacion/datos-entidad.json`. `desplegar.yml` lo escribe antes de construir
la imagen de la web, que los lleva compilados dentro; sin la variable, el
despliegue se para. Al cambiar los datos hay que cambiar los dos: la variable
(la web) y el fichero del servidor (la API).

### 7. El subdominio en el nginx del sistema

```bash
sudo cp /srv/desamparados/docker/servidor/nginx-pruebas.conf /etc/nginx/sites-available/pruebas.desamparadosmalaga.com
sudo ln -s /etc/nginx/sites-available/pruebas.desamparadosmalaga.com /etc/nginx/sites-enabled/
# La contraseña de la puerta (el usuario, el que se quiera). En tres pasos:
# con `openssl … | sudo tee` en una línea, los dos leen el teclado a la vez y
# se reparten las teclas («Verify failure»).
sudo -v
H=$(openssl passwd -apr1)
echo "grupo:$H" | sudo tee /etc/nginx/pruebas.htpasswd >/dev/null
sudo chown root:www-data /etc/nginx/pruebas.htpasswd && sudo chmod 640 /etc/nginx/pruebas.htpasswd
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d pruebas.desamparadosmalaga.com
sudo nginx -t && sudo systemctl reload nginx
```

`certbot --nginx` añade el bloque https y la redirección, como hizo con el
dominio principal, y lo renueva con el mismo temporizador. El sitio de
mantenimiento no se toca.

### 8. El primer despliegue

En GitHub, pestaña Actions → «Desplegar en el servidor» → Run workflow, sobre
`main`. Construye, prueba la configuración de nginx, entra y levanta todo. La
primera vez tarda más: ClamAV se baja sus firmas (varios minutos). Hasta
entonces, las subidas responden 503.

Comprobar:

```bash
cd /srv/desamparados
sudo docker compose -f compose.yaml -f compose.servidor.yaml ps
curl -fsS http://127.0.0.1:8080/api/health
```

La base queda vacía, con las tablas creadas por las migraciones. Para tener
datos, el paso 9.

### 9. Cargar la base de pruebas del equipo de desarrollo

En el **equipo de desarrollo** (Git Bash, desde la raíz del repositorio). El
guion saca solo los datos, devuelve a las tablas su nombre con mayúsculas (la
MariaDB de Windows los guarda en minúsculas) y pasa a `@ejemplo.invalido` todo
correo que no sea de ejemplo ni esté en la lista (la cuenta de pruebas y la de
redes del Grupo, las dos legítimas):

```bash
cd backend-desamparados
node --env-file=.env scripts/exportar-base-pruebas.mjs ../base-pruebas.sql davile17x@gmail.com rrsspasdesampa@gmail.com
cd ..
tar -czf storage-pruebas.tgz -C backend-desamparados --exclude=storage/correos storage/public storage/private
scp base-pruebas.sql storage-pruebas.tgz ubuntu@51.255.45.220:/tmp/
rm base-pruebas.sql storage-pruebas.tgz
```

En el **servidor**:

```bash
cd /srv/desamparados
dc() { sudo docker compose -f compose.yaml -f compose.servidor.yaml "$@"; }
dc stop api web
dc exec -T db sh -c 'mariadb -u root -p"$MARIADB_ROOT_PASSWORD" "$MARIADB_DATABASE"' < /tmp/base-pruebas.sql
sudo tar -xzf /tmp/storage-pruebas.tgz -C /srv/desamparados/backend-desamparados
sudo chown -R desamparados:desamparados /srv/desamparados/backend-desamparados/storage
sudo chmod 755 /srv/desamparados/backend-desamparados/storage/public
dc start api web
sudo shred -u /tmp/base-pruebas.sql /tmp/storage-pruebas.tgz
```

La contraseña de root de la base no se teclea: la lee el propio contenedor de
su entorno. Las cuentas quedan con las mismas contraseñas que en desarrollo.

## Desplegar

Pestaña Actions → «Desplegar en el servidor» → Run workflow (sobre `main`).
Solo despliega un commit de `main` cuya verificación haya pasado. En el
servidor, `desplegar-desamparados`:

1. Comprueba que el commit es de `main`.
2. Si hay copias configuradas (`/etc/desamparados/copia.env`), hace una.
3. Deja el repositorio en ese commit y apunta `VERSION` en el `.env`.
4. Descarga las imágenes con el token de esa ejecución, que no se guarda.
5. Levanta: las migraciones se aplican solas; si fallan, la API no arranca.
6. Espera a que la API esté sana.
7. Borra las imágenes viejas, menos la anterior.

Para volver a una versión anterior, se lanza el flujo sobre ese commit… solo si
no trae migraciones de por medio: con la base ya migrada, el código viejo no la
entiende (ver «Restaurar» en `despliegue.md`).

## Medir el consumo

Lo que hay que averiguar es si el VPS-1 basta. `docker/servidor/medir.sh` anota
cada minuto la CPU y la memoria de cada contenedor y de la máquina en
`/var/log/desamparados/recursos.csv`.

```bash
sudo install -o root -g root -m 755 /srv/desamparados/docker/servidor/medir.sh /usr/local/sbin/medir-desamparados
sudo tee /etc/systemd/system/desamparados-medir.service >/dev/null <<'EOF'
[Unit]
Description=Medida del consumo de la web (CPU y memoria)

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/medir-desamparados
EOF
sudo tee /etc/systemd/system/desamparados-medir.timer >/dev/null <<'EOF'
[Unit]
Description=Medir el consumo de la web cada minuto

[Timer]
OnCalendar=*-*-* *:*:00
AccuracySec=5s

[Install]
WantedBy=timers.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now desamparados-medir.timer
```

Un día de medidas son unas 10.000 líneas (menos de 1 MB). Para traerlo al
equipo de desarrollo y analizarlo:

```bash
scp ubuntu@51.255.45.220:/var/log/desamparados/recursos.csv .
```

Para pararlo: `sudo systemctl disable --now desamparados-medir.timer`.

## Pruebas de carga

Hechas el 05-10-2026 con `backend-desamparados/scripts/carga.mjs`, lanzado
desde el equipo de desarrollo (nunca desde el VPS: se comería la CPU que se
quiere medir). **El VPS-1 basta, con mucho margen**:

| Escalón (2,5 min cada uno) | Pet./s | p95 API | CPU de la API (de 200 %) | Memoria máquina |
|---|---|---|---|---|
| 10 visitantes a la vez | 33 | 98 ms | 12 / 33 máx. | 2,2 GB |
| 100 visitantes a la vez | 306 | 315 ms | 49 / 59 máx. | 2,4 GB |
| 6 editores subiendo fotos | 1 subida/s | foto 6,3 s | 183 / 198 máx. | 2,6 GB |
| 16 puestos de la mesa (SSE) | 15 | 87 ms | 21 / 41 máx. | 2,5 GB |

Cero errores en ~98.000 peticiones. Lo único que llenaba los dos núcleos era
sharp con varias subidas a la vez; desde entonces las fotos se procesan de
una en una (`src/utils/fila-de-fotos.ts`). Comprobado ese mismo día con 6
editores: la API pasa de 183/198 % a 101/120 % de CPU y de 794 a 545 MB; la
foto tarda más (10,5 s de mediana en vez de 4,7) porque espera su turno.
Queda ver si la memoria de la API baja sola tras las subidas; si no,
`MALLOC_ARENA_MAX=2` en la API.

**El techo** (prueba de estrés del mismo día, escalones de 2 min hasta 300
visitantes, con y sin fotos, `--parar-si 5,3000`):

| Visitantes | Con fotos: pet./s · p95 API | Sin fotos: pet./s · p95 API |
|---|---|---|
| 100 | 306 · 315 ms | 203 · 171 ms |
| 150 | 354 · 2,3 s | 291 · 372 ms |
| 200 | 375 · 2,7 s | 335 · 1,1 s |
| 300 | 389 · 4,3 s, 2 % de errores | 356 · 2,5 s, 1,9 % de errores |

- Se agota la **CPU de la máquina**: carga de 4–5 con 2 núcleos; API al 60–75 %
  (picos del 100 %), nginx y base al 15–20 % cada uno, y el resto, el TLS del
  nginx del sistema. La memoria no pasa de 2,5 GB, la base no pasa del 29 % y
  la red no limita (las fotos siguen en ~150 ms con 260 Mbit/s).
- Unos 150 visitantes del guion (una página cada 1–3 s, sin caché) equivalen
  a entre 1.000 y 3.000 personas reales mirando la web a la vez.
- Los cortes y los 500 con 300 visitantes eran del **nginx del sistema**: 768
  conexiones por proceso, lo que trae Ubuntu (578 avisos «worker_connections
  are not enough»). Subido a 4096, con `worker_rlimit_nofile 8192`:
  ```bash
  sudo sed -i 's/worker_connections [0-9]*;/worker_connections 4096;/' /etc/nginx/nginx.conf
  grep -q worker_rlimit_nofile /etc/nginx/nginx.conf || sudo sed -i '/^worker_processes/a worker_rlimit_nofile 8192;' /etc/nginx/nginx.conf
  sudo nginx -t && sudo systemctl reload nginx
  ```
- Si hiciera falta más, por orden de efecto: caché de unos segundos en nginx
  para la API pública sin sesión, dos procesos de la API (un núcleo cada uno)
  y, solo después, un VPS mayor.

Para repetirlas:

1. En el servidor, el límite de la API (todo sale de una IP) y un usuario de
   la puerta solo para la carga. Se borra antes de crearlo porque el `tee -a`
   añade una línea cada vez y nginx solo mira la primera. La contraseña se
   pide aparte (`sudo -v` y luego `openssl`): en una sola línea con la tubería,
   `openssl` y `sudo` leen el teclado a la vez y da «Verify failure».
   ```bash
   echo 'LIMITE_GLOBAL_POR_IP=1000000' | sudo tee -a /srv/desamparados/.env
   cd /srv/desamparados && sudo docker compose -f compose.yaml -f compose.servidor.yaml up -d api
   sudo sed -i '/^carga:/d' /etc/nginx/pruebas.htpasswd
   sudo -v
   H=$(openssl passwd -apr1)
   echo "carga:$H" | sudo tee -a /etc/nginx/pruebas.htpasswd >/dev/null
   sudo grep -c '^carga:' /etc/nginx/pruebas.htpasswd   # tiene que dar 1
   while true; do sudo /usr/local/sbin/medir-desamparados /var/log/desamparados/carga.csv; sleep 5; done
   ```
2. En el equipo de desarrollo, las credenciales en `%USERPROFILE%\carga.env`
   (variables en la cabecera del guion; una cuenta ADMIN del CMS) y:
   ```powershell
   cd backend-desamparados
   node --env-file=$env:USERPROFILE\carga.env scripts/carga.mjs
   ```
   Mientras dure, nadie debe cerrar la sesión del CMS de esa cuenta: corta la
   del guion (vuelve a entrar solo, hasta cinco veces).
3. Al acabar, deshacerlo y limpiar las subidas de prueba (son de hoy, de ahí
   `--horas=0`; sin `--borrar` solo las lista):
   ```bash
   sudo sed -i '/^LIMITE_GLOBAL_POR_IP=/d' /srv/desamparados/.env
   sudo docker compose -f compose.yaml -f compose.servidor.yaml up -d api
   sudo sed -i '/^carga:/d' /etc/nginx/pruebas.htpasswd
   sudo docker compose -f compose.yaml -f compose.servidor.yaml run --rm herramientas npm run limpiar:huerfanos -- --horas=0 --borrar
   ```

## Copias de seguridad

Tres sitios, para que ninguno solo baste para perderlas:

| Dónde | Cuántas | Quién la pone ahí |
|---|---|---|
| El servidor (`/var/backups/desamparados/copias`) | 14 días | El timer, cada noche a las 4 UTC, las 6 en Madrid en verano y las 5 en invierno (y `desplegar.sh`, antes de cada despliegue) |
| Google Drive de `rrsspasdesampa@gmail.com`, carpeta `copias-desamparados` | 30 días y la primera de cada mes durante 12 meses | El mismo guion, con `rclone` |
| El PC de desarrollo (`%USERPROFILE%\Copias Desamparados`) | Las 8 últimas, una por semana | El PC, que se la baja (`docker/servidor/bajar-copias.ps1`) |

Van cifradas con `age` antes de salir de la base: ni el servidor, ni Google, ni
quien se lleve el PC pueden leerlas sin la **clave privada**, que solo está en
un gestor de contraseñas y en un USB. El guion y la restauración, en
`despliegue.md`, «Copias de seguridad».

Por qué el PC **se baja** la copia en vez de recibirla: en Drive no se puede
dar permiso de subir sin dar también el de borrar, así que quien entrara en el
servidor podría borrar las de Drive. Al PC no puede llegar: el servidor no
tiene ninguna llave suya. El PC entra con el usuario `copias`, que solo puede
leer la carpeta de las copias (sftp de solo lectura, encerrado en ella).

### 1. En el PC: herramientas y claves

En PowerShell:

```powershell
winget install --id FiloSottile.age -e
winget install --id Rclone.Rclone -e
# Cerrar y abrir PowerShell para que las encuentre.

# La clave de las copias. Enseña la PÚBLICA (age1…); la privada queda en el fichero.
age-keygen -o "$env:USERPROFILE\clave-copias-desamparados.txt"

# La llave con la que el PC entra a bajarlas.
ssh-keygen -t ed25519 -N '""' -C "copias desde el PC" -f "$env:USERPROFILE\.ssh\copias-desamparados"
Get-Content "$env:USERPROFILE\.ssh\copias-desamparados.pub"
```

`clave-copias-desamparados.txt` se guarda **en el gestor de contraseñas y en
un USB**, nunca en Drive ni en el servidor. Sin ella las copias no se pueden
abrir. Del PC se borra después de probar una restauración (paso 6).

### 2. En el servidor: el usuario `copias` y la carpeta

```bash
sudo apt install -y age rclone
sudo useradd --system --create-home --home-dir /var/lib/copias --shell /usr/sbin/nologin copias
sudo usermod -aG copias desamparados
# La de arriba es de root (lo exige el encierro de sftp); la de dentro, de la copia.
sudo install -d -m 755 -o root -g root /var/backups/desamparados
sudo install -d -m 2750 -o desamparados -g copias /var/backups/desamparados/copias

# La llave PÚBLICA del PC (la línea ssh-ed25519 … del paso 1), con `restrict` delante.
sudo install -d -m 700 -o copias -g copias /var/lib/copias/.ssh
echo 'restrict ssh-ed25519 AAAA… copias desde el PC' | sudo tee /var/lib/copias/.ssh/authorized_keys >/dev/null
sudo chown copias:copias /var/lib/copias/.ssh/authorized_keys
sudo chmod 600 /var/lib/copias/.ssh/authorized_keys

# Solo sftp, solo lectura y encerrado en /var/backups/desamparados.
sudo tee /etc/ssh/sshd_config.d/copias.conf >/dev/null <<'EOF'
Match User copias
    ChrootDirectory /var/backups/desamparados
    ForceCommand internal-sftp -R
    AllowTcpForwarding no
    X11Forwarding no
    PermitTTY no
    PasswordAuthentication no
EOF
sudo sshd -t && sudo systemctl reload ssh
sudo sshd -T -C user=copias,host=pc,addr=127.0.0.1 | grep -iE 'chrootdirectory|forcecommand|allowusers'
```

**Sin cerrar la sesión SSH abierta**: si algo de `sshd` saliera mal, es la
que permite arreglarlo. `sshd -t` comprueba la configuración antes de
recargar. Si la última orden enseña un `allowusers` que no incluye `copias`,
hay que añadirlo ahí.

### 3. En el servidor: Google Drive

> **Pendiente (06-10-2026).** Drive se ha dejado para más adelante: el remoto
> `copias:` existe, pero sigue con el proyecto compartido de rclone (ver «Un
> proyecto de Google propio») y sin comprobar en qué cuenta escribe. Mientras,
> las tres líneas `BACKUP_RCLONE_*` de `copia.env` (paso 4) van **comentadas**
> con `#`: si están puestas y la subida falla, el guion acaba en error, el
> timer marca fallo y `desplegar.sh` **no despliega**. Sin ellas, la copia se
> queda en el servidor y el PC se la sigue bajando. Para retomarlo: proyecto
> propio, `rclone lsd copias:` sin error con la cuenta del Grupo, quitar el
> permiso de la otra cuenta en myaccount.google.com/connections y descomentar
> las tres líneas.

`rclone` guarda su configuración (con el permiso de Drive, que es un secreto)
en `/etc/desamparados/rclone.conf`, que solo lee `desamparados`:

```bash
sudo -u desamparados env RCLONE_CONFIG=/etc/desamparados/rclone.conf rclone config
```

Respuestas: `n` (remoto nuevo) · nombre `copias` · tipo `drive` · `client_id`
y `client_secret` vacíos · alcance **`drive.file`** (solo ve lo que sube él:
el resto del Drive del Grupo queda fuera) · `service_account_file` vacío ·
opciones avanzadas `n` · navegador automático **`n`**. Entonces enseña una
orden `rclone authorize "drive" "…"`: se ejecuta **en el PC**, se entra con
`rrsspasdesampa@gmail.com`, se acepta, y lo que devuelve el PC se pega en el
servidor. Unidad compartida `n` · `y` para guardar · `q`. Lo que se copia y
pega es un secreto: no se pega en ningún otro sitio.

**Un proyecto de Google propio, no el de rclone.** Con `client_id` vacío,
rclone usa un proyecto que comparten todos sus usuarios del mundo, y Google lo
corta a menudo (403 «Quota exceeded … consumer project_number:202264815644»).
Para copias que no pueden fallar una noche, se crea uno con la cuenta del
Grupo en https://console.cloud.google.com: proyecto nuevo, habilitar **Google
Drive API**, pantalla de consentimiento **Externa** con el permiso
`drive.file` y **publicada en producción** (en «Prueba», Google caduca el
permiso a los 7 días y las copias dejan de subirse sin avisar), y un **ID de
cliente de OAuth** de tipo «Aplicación de escritorio». El ID y el secreto se
meten con `rclone config` → `e` → `copias`, y se vuelve a autorizar. Al
autorizar, Google avisa de que la aplicación no está verificada: es la
vuestra, «Configuración avanzada» → «Ir a…».

**Cambiar de cuenta o de servicio.** El guion solo conoce el destino
`copias:`. Para otra cuenta de Google, `rclone config reconnect copias:` (con
el mismo `sudo -u desamparados env RCLONE_CONFIG=…` delante) y otra vez el
`rclone authorize` en el PC con la cuenta nueva. Para otro servicio
(OneDrive, Dropbox, Backblaze B2…), borrar el remoto `copias` y crearlo de
nuevo con su tipo. Las copias que ya había en la cuenta vieja se quedan allí:
la rotación solo mira la nueva, así que esas se borran a mano.

### 4. En el servidor: la configuración y el timer

```bash
echo 'age1…' | sudo tee /etc/desamparados/copias.pub >/dev/null    # la PÚBLICA del paso 1
sudo tee /etc/desamparados/copia.env >/dev/null <<'EOF'
BACKUP_AGE_RECIPIENTS=/etc/desamparados/copias.pub
BACKUP_DIR=/var/backups/desamparados/copias
BACKUP_RETENTION_DAYS=14
BACKUP_RCLONE_REMOTE=copias:copias-desamparados
BACKUP_RCLONE_DIAS=30
BACKUP_RCLONE_MESES=12
BACKUP_GRUPO_LECTOR=copias
RCLONE_CONFIG=/etc/desamparados/rclone.conf
PROYECTO_DIR=/srv/desamparados
EOF
sudo chown desamparados:desamparados /etc/desamparados/copia.env /etc/desamparados/copias.pub
sudo chmod 640 /etc/desamparados/copia.env /etc/desamparados/copias.pub
```

Sin espacios en los valores: `desplegar.sh` lee este fichero con bash.

El servicio y el timer son los de `despliegue.md`, «Programación diaria»
(`/etc/systemd/system/desamparados-copia.service` y `.timer`). Después:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now desamparados-copia.timer
sudo systemctl start desamparados-copia.service
journalctl -u desamparados-copia -n 20 --no-pager
```

Tiene que acabar en «Copia fuera del servidor correcta» y la rotación, y en
Drive aparece la carpeta `copias-desamparados` con la copia.

### 5. En el PC: la primera bajada y la tarea semanal

La primera vez, a mano, para aceptar la huella del servidor (comprobarla antes
con `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` en el servidor):

```powershell
sftp -i "$env:USERPROFILE\.ssh\copias-desamparados" copias@51.255.45.220
# sftp> ls /copias      (y `bye`)
powershell -ExecutionPolicy Bypass -File "C:\Users\Davile\Documents\Proyecto Desamparados\docker\servidor\bajar-copias.ps1"
```

Y la tarea, los domingos a las 12 (o en cuanto se encienda el PC, si estaba
apagado):

```powershell
$accion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File "C:\Users\Davile\Documents\Proyecto Desamparados\docker\servidor\bajar-copias.ps1"'
$cuando = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 12:00
$ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable
Register-ScheduledTask -TaskName 'Copias Desamparados' -Action $accion -Trigger $cuando -Settings $ajustes
```

Lo que hace cada semana queda en `Copias Desamparados\registro.txt`.

### 6. Probar una restauración

Una copia que nunca se ha abierto es una suposición. En el PC, sin tuberías
(PowerShell 5.1 estropea los datos binarios que pasan por `|`):

```powershell
$copia = Get-ChildItem "$env:USERPROFILE\Copias Desamparados\desamparados_*.age" | Sort-Object Name | Select-Object -Last 1
$r = "$env:TEMP\restauracion"; New-Item -ItemType Directory -Force $r | Out-Null
age -d -i "$env:USERPROFILE\clave-copias-desamparados.txt" -o "$r\copia.tar.gz" $copia.FullName
tar -xzf "$r\copia.tar.gz" -C $r
Get-Content "$r\db.sql" -Tail 1; (Get-ChildItem "$r\storage" -Recurse -File).Count
Remove-Item -Recurse -Force $r    # lleva el censo en claro
```

La última línea del volcado tiene que ser «Dump completed» y `storage` traer
las fotos. Para volcarla en una base, `despliegue.md`, «Restaurar».

## El día de la presentación

Pendiente de preparar. En esencia: la base buena con su propia `TOTP_ENC_KEY`,
`FRONTEND_URL`/`API_URL` al dominio principal, el sitio del dominio principal
del nginx del sistema pasando a `127.0.0.1:8080` (como el de `pruebas`, sin
contraseña), las copias de seguridad configuradas antes de cargar datos
reales, y el correo del Grupo en lugar del personal.

## La aplicación, para quien venga de otro documento

La sesión va en cookies httpOnly (SameSite=Strict, `Path=/api`), sin
`Authorization: Bearer`; el CMS lleva segundo factor (TOTP). Los roles son los
de `enum Role` de `backend-desamparados/prisma/schema.prisma`. El nombre de la
corporación es «Grupo Parroquial Nuestra Señora de los Desamparados» (sin
«de» delante de «Nuestra»).
