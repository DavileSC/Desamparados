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
  `REDSYS_ENTORNO=pruebas`.

Comprobar sin enseñar los valores:

```bash
sudo grep -E '^[A-Z_]+=' /srv/desamparados/.env | sed -E 's/=.+/=****/; s/=$/= (VACÍA)/'
```

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

### 7. El subdominio en el nginx del sistema

```bash
sudo cp /srv/desamparados/docker/servidor/nginx-pruebas.conf /etc/nginx/sites-available/pruebas.desamparadosmalaga.com
sudo ln -s /etc/nginx/sites-available/pruebas.desamparadosmalaga.com /etc/nginx/sites-enabled/
# La contraseña de la puerta (el usuario, el que se quiera):
printf 'grupo:%s\n' "$(openssl passwd -apr1)" | sudo tee /etc/nginx/pruebas.htpasswd >/dev/null
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
una en una (`src/utils/fila-de-fotos.ts`). La memoria de la API subió de
350 a ~790 MB con las subidas y no volvió a bajar: si sigue así tras una hora
tranquila, `MALLOC_ARENA_MAX=2` en la API.

Para repetirlas:

1. En el servidor, el límite de la API (todo sale de una IP) y un usuario de
   la puerta solo para la carga. El usuario se crea **una vez**: el `tee -a`
   añade otra línea cada vez que se lanza y nginx solo mira la primera.
   ```bash
   echo 'LIMITE_GLOBAL_POR_IP=1000000' | sudo tee -a /srv/desamparados/.env
   cd /srv/desamparados && sudo docker compose -f compose.yaml -f compose.servidor.yaml up -d api
   sudo sed -i '/^carga:/d' /etc/nginx/pruebas.htpasswd
   printf 'carga:%s\n' "$(openssl passwd -apr1)" | sudo tee -a /etc/nginx/pruebas.htpasswd >/dev/null
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
