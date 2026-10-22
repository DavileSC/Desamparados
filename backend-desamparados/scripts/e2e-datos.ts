// Los datos de las pruebas de punta a punta (desamparados-web/e2e): las
// cuentas con las que entran y lo que necesitan encontrar. Los crea la
// preparación de Playwright antes de empezar y los borra al acabar.
//
// Uso (desde backend-desamparados):
//   npx tsx scripts/e2e-datos.ts preparar <sufijo>   → JSON con lo creado
//   npx tsx scripts/e2e-datos.ts limpiar <sufijo>
//
// Todo lleva el sufijo en el correo: así se borra solo lo de esa ejecución y
// nunca nada del censo, aunque se lance contra la base de desarrollo de
// alguien. Las contraseñas son fijas y están en el repositorio: en
// producción no arranca.
//
// Los correos acaban en `.invalido`, que la API nunca envía
// (`esDireccionDeNadie`): una prueba contra un backend con la cuenta de
// correo de verdad no manda nada a nadie.
import * as OTPAuth from 'otpauth';
import { EstadoPago, Role, TipoRecibo } from '@prisma/client';
import db from '../src/config/db.js';
import { encrypt } from '../src/utils/bcrypt.handle.js';
import { cifrarSecretoTotp } from '../src/utils/cifrado-totp.js';
import { SalidasService } from '../src/services/procesion/salidas.service.js';
import { PlazoPapeletasService } from '../src/services/procesion/plazo.service.js';
import { privateStorageDir } from '../src/middleware/upload.middleware.js';
import { buzonPedido } from '../src/utils/buzon-pruebas.js';
import { rm } from 'node:fs/promises';
import path from 'node:path';

const PASSWORD_E2E = 'Punta-a-Punta-2026';

/** Lo que se compra en la tienda: el nombre lleva el sufijo para encontrarlo y borrarlo. */
const producto = (sufijo: string) => `Medalla de prueba ${sufijo}`;
/** La noticia que la prueba publica desde el CMS: la crea ella, aquí solo se borra. */
const noticia = (sufijo: string) => `Noticia de prueba ${sufijo}`;

const correo = (quien: string, sufijo: string) => `e2e-${quien}-${sufijo}@pruebas.invalido`;

/**
 * La página de bloques que edita la prueba del constructor: una del núcleo,
 * que está en cualquier instalación. La recogida la deja como estaba.
 */
const PAGINA = { slug: 'formacion', ruta: '/nuestros-fines/formacion' } as const;

async function cuenta(quien: string, sufijo: string, role: Role, extra: { twoFactorEnabled?: boolean; twoFactorSecret?: string } = {}) {
  return db.user.create({
    data: {
      email: correo(quien, sufijo),
      password: await encrypt(PASSWORD_E2E),
      dni: `E2E-${quien}-${sufijo}`,
      nombre: 'Prueba',
      apellidos: 'Punta a Punta',
      telefono: '600000000',
      role,
      ...extra,
      // Un minuto en el pasado, por lo mismo que en test/fixtures/usuarios.ts:
      // una sesión que naciera en el mismo segundo quedaría ya invalidada.
      tokenValidAfter: new Date(Date.now() - 60_000),
      cmsValidoDesde: new Date(Date.now() - 60_000),
      hermanoValidoDesde: new Date(Date.now() - 60_000),
    },
  });
}

async function preparar(sufijo: string) {
  // Una cuenta del equipo sin doble factor: la prueba lo activa desde la web.
  const nueva = await cuenta('alta2fa', sufijo, Role.ADMIN);
  // Y las que ya lo tienen: la prueba entra calculando el código del secreto.
  // Una por prueba: la API no acepta dos veces el código del mismo medio
  // minuto, y dos entradas seguidas con la misma cuenta chocarían.
  const conCodigo = async (quien: string) => {
    const secreto = new OTPAuth.Secret({ size: 20 });
    const c = await cuenta(quien, sufijo, Role.ADMIN, { twoFactorEnabled: true, twoFactorSecret: cifrarSecretoTotp(secreto.base32) });
    return { email: c.email, secreto: secreto.base32 };
  };

  // Un hermano con su ficha y la papeleta de este año ya pagada, en la
  // primera salida: la que su área enseña con el QR para la puerta.
  const hermano = await cuenta('hermano', sufijo, Role.USER);
  const ficha = await db.hermano.create({
    data: {
      userId: hermano.id, nombre: 'Prueba', apellidos: 'Punta a Punta', dni: hermano.dni,
      fechaNacimiento: new Date('1990-05-15'), esTitular: true, activo: true, tieneTunicaPropia: false,
    },
  });
  const [salida] = await SalidasService.listar();
  if (!salida) throw new Error('No hay ninguna salida activa: ¿se sembró la base?');
  const year = PlazoPapeletasService.anioDeLaProcesion(salida);
  const recibo = await db.recibo.create({
    data: { year, concepto: `Papeleta de sitio ${year}`, importe: 0, tipo: TipoRecibo.PAPELETA_SITIO, estado: EstadoPago.EXENTO, hermanoId: ficha.id },
  });
  await db.papeletaSitio.create({
    data: { year, salidaId: salida.id, puesto: 'Cirio', tramo: 'Tramo 1', numero: 7, hermanoId: ficha.id, reciboId: recibo.id },
  });

  const enVenta = await db.producto.create({ data: { nombre: producto(sufijo), precio: '12.50', existencias: 5 } });

  return {
    password: PASSWORD_E2E,
    sinDobleFactor: { email: nueva.email },
    admin: await conCodigo('admin'),
    redaccion: await conCodigo('noticias'),
    secretaria: await conCodigo('altas'),
    paginas: await conCodigo('paginas'),
    puerta: await conCodigo('puerta'),
    pagina: { ...PAGINA, subtitulo: `Subtítulo de prueba ${sufijo}` },
    hermano: { email: hermano.email, salida: salida.nombre },
    producto: { id: enVenta.id, nombre: enVenta.nombre },
    comprador: correo('compra', sufijo),
    alta: correo('alta', sufijo),
    noticia: noticia(sufijo),
    // Hay correos que no van a quien se apunta sino a Secretaría (el aviso de
    // un alta nueva). Si este backend los manda de verdad, esas pruebas no se
    // hacen: se le pide arrancar con EMAIL_BUZON_PRUEBAS=true.
    correoDeVerdad: !buzonPedido() && Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS),
  };
}

async function limpiar(sufijo: string) {
  const deEstaEjecucion = { startsWith: 'e2e-', endsWith: `-${sufijo}@pruebas.invalido` };

  // Las compras: el pago, el apunte en contabilidad y el pedido (sus líneas
  // se van con él).
  const pedidos = await db.pedidoTienda.findMany({ where: { email: deEstaEjecucion }, select: { id: true, transaccionId: true } });
  const pagos = await db.pagoEnLinea.findMany({
    where: { origen: 'TIENDA', referenciaId: { in: pedidos.map((p) => p.id) } },
    select: { id: true, transaccionId: true },
  });
  const apuntes = [...pedidos, ...pagos].flatMap((x) => (x.transaccionId === null ? [] : [x.transaccionId]));
  await db.pagoEnLinea.deleteMany({ where: { id: { in: pagos.map((p) => p.id) } } });
  await db.pedidoTienda.deleteMany({ where: { id: { in: pedidos.map((p) => p.id) } } });
  await db.transaccion.deleteMany({ where: { id: { in: apuntes } } });
  await db.producto.deleteMany({ where: { nombre: producto(sufijo) } });
  await db.noticia.deleteMany({ where: { titulo: noticia(sufijo) } });

  // Las páginas que se editaron: vuelven a la última versión que no es de
  // estas cuentas (o a su texto de partida si no tenían fila), y fuera las
  // versiones de la prueba.
  const deLaPrueba = (await db.user.findMany({ where: { email: deEstaEjecucion }, select: { id: true } })).map((u) => u.id);
  const tocadas = await db.versionContenido.findMany({ where: { autorId: { in: deLaPrueba } }, select: { slug: true }, distinct: ['slug'] });
  for (const { slug } of tocadas) {
    const anterior = await db.versionContenido.findFirst({
      where: { slug, OR: [{ autorId: null }, { autorId: { notIn: deLaPrueba } }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { datos: true },
    });
    if (anterior) await db.contenidoPagina.update({ where: { slug }, data: { datos: anterior.datos as object } });
    else await db.contenidoPagina.deleteMany({ where: { slug } });
  }
  await db.versionContenido.deleteMany({ where: { autorId: { in: deLaPrueba } } });

  // Las fichas, con sus papeletas y recibos, y después las cuentas. La foto
  // y el certificado del alta se quedarían en disco sin ficha que los nombre.
  const fichas = { user: { email: deEstaEjecucion } };
  const documentos = await db.hermano.findMany({ where: fichas, select: { foto: true, certificadoBautismo: true } });
  for (const nombre of documentos.flatMap((d) => [d.foto, d.certificadoBautismo])) {
    if (nombre) await rm(path.join(privateStorageDir, path.basename(nombre)), { force: true });
  }
  await db.papeletaSitio.deleteMany({ where: { hermano: fichas } });
  await db.recibo.deleteMany({ where: { hermano: fichas } });
  await db.hermano.deleteMany({ where: fichas });
  const { count } = await db.user.deleteMany({ where: { email: deEstaEjecucion } });
  return { cuentas: count, pedidos: pedidos.length };
}

try {
  if (process.env.NODE_ENV?.trim() === 'production') throw new Error('Los datos de las pruebas no se crean en producción.');
  const [orden, sufijo] = process.argv.slice(2);
  if (!sufijo || !/^[a-z0-9]{4,16}$/.test(sufijo)) throw new Error('Falta el sufijo (de 4 a 16 letras o cifras en minúscula).');
  if (orden === 'preparar') {
    // A medias no se queda nada: sin datos, Playwright no llega a la recogida.
    const preparado = await preparar(sufijo).catch(async (error: unknown) => {
      await limpiar(sufijo);
      throw error;
    });
    console.log(JSON.stringify(preparado));
  }
  else if (orden === 'limpiar') console.log(JSON.stringify(await limpiar(sufijo)));
  else throw new Error('Uso: npx tsx scripts/e2e-datos.ts preparar|limpiar <sufijo>');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
