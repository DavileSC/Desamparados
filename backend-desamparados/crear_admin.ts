// crear_admin.ts
import db from './src/config/db.js'; // <--- IMPORTAMOS TU INSTANCIA CONFIGURADA
import bcrypt from 'bcryptjs';
import process from 'node:process';

async function main() {
  console.log('1. 🔵 Iniciando conexión a la Base de Datos (usando adaptador)...');
  
  // Hash de la contraseña
  const hashedPassword = await bcrypt.hash('admin123', 10);
  console.log('2. 🔐 Contraseña encriptada correctamente.');

  console.log('3. 🚀 Intentando crear usuario Admin...');
  
  try {
    // Usamos 'db' en lugar de 'prisma'
    const user = await db.user.create({
      data: {
        email: 'admin@cofradia.com',
        dni: '00000000A',
        nombre: 'Administrador',
        apellidos: 'Sistema',
        telefono: '600000000',
        password: hashedPassword,
        role: 'ADMIN'
      }
    });
    console.log('------------------------------------------------');
    console.log('✅ ¡ADMIN CREADO CON ÉXITO!');
    console.log('🆔 ID:', user.id);
    console.log('📧 Email:', user.email);
    console.log('------------------------------------------------');
  } catch (error: any) {
    if (error.code === 'P2002') {
      console.log('⚠️ El usuario YA EXISTÍA (Error de duplicado P2002).');
    } else {
      console.error('❌ ERROR GRAVE CREANDO USUARIO:', error);
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    // Forzamos el cierre del proceso porque el pool de conexiones puede quedarse abierto
    console.log('4. 👋 Fin del proceso.');
    process.exit(0);
  });