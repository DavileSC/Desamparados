// Crea una cuenta del CMS con un cargo y sin ficha de hermano, con una
// contraseña al azar. Para quien solo tiene que entrar a una pantalla (el
// cortejo en directo, la puerta) y no está en el censo: desde el CMS no se
// puede dar de alta a nadie a mano, solo importando el censo.
//
// Uso (desde backend-desamparados):
//   npm run cuenta:crear-cargo -- correo@ejemplo.org ALBACERIA "Nombre" "Apellidos"
//
// La primera vez que entre en el CMS le pedirá el doble factor, como a
// cualquier cargo. Si el correo ya tiene cuenta no se toca: el cargo de una
// cuenta que ya existe se cambia en el CMS, en Accesos.
import crypto from 'node:crypto';
import { Role } from '@prisma/client';
import db from '../src/config/db.js';
import { encrypt } from '../src/utils/bcrypt.handle.js';
import { ACCIONES_AUDITORIA, AuditoriaService } from '../src/services/auditoria.service.js';

const CARGOS = [Role.ADMIN, Role.TESORERIA, Role.ALBACERIA, Role.HERMANO_MAYOR, Role.REDES, Role.SECRETARIA] as const;

try {
  const [escrito, cargo, nombre, apellidos] = process.argv.slice(2).map((a) => a.trim());
  // En minúsculas, como lo guardan el alta y el login: con mayúsculas, las
  // comparaciones que se hacen fuera de la base (la cola, los rebotes) no la reconocían.
  const email = escrito?.toLowerCase();
  if (!email || !cargo || !nombre || !apellidos) {
    throw new Error('Uso: npm run cuenta:crear-cargo -- correo CARGO "Nombre" "Apellidos"');
  }
  if (!(CARGOS as readonly string[]).includes(cargo)) {
    throw new Error(`Cargo desconocido: ${cargo}. Vale uno de ${CARGOS.join(', ')}.`);
  }
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new Error(`Ya hay una cuenta con el correo ${email}: su cargo se cambia en el CMS, en Accesos.`);
  }

  const password = crypto.randomBytes(18).toString('base64url');
  const creada = await db.user.create({
    data: {
      email,
      // El mismo hash que el resto de la aplicación (bcrypt, 10 rondas).
      password: await encrypt(password),
      // El DNI es obligatorio y único, y esta cuenta no lo tiene: uno que no
      // pasa por DNI de nadie y que se ve a la legua que es de relleno.
      dni: `SIN-DNI-${crypto.randomBytes(4).toString('hex')}`,
      nombre,
      apellidos,
      telefono: '',
      role: cargo as Role,
    },
  });

  // Queda en la auditoría como cualquier cargo dado desde Accesos: una cuenta
  // de Administración creada en el servidor no podía aparecer sin rastro.
  await AuditoriaService.log(ACCIONES_AUDITORIA.STAFF_PROMOTE, {}, 'user', creada.id, { despues: { rol: cargo }, cuentaNueva: true, desde: 'npm run cuenta:crear-cargo' });

  console.log(JSON.stringify({ email, cargo, password }));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
