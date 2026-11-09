import db from '../config/db';
import { encrypt } from '../utils/bcrypt.handle';
import { MotivoBaja, Prisma, Role } from '@prisma/client';
import { RegisterDto, ReactivacionDto } from '../dtos/auth.dto';
import { comprobarEsAdulto, comprobarEsMenor, diaDeHoy, instanteDeDia } from '../domain/fechas-hermano.js';
import { EmailService } from './email.service';
import { HttpError } from '../utils/error.handle';
import { enmascararEmail } from '../utils/log-privacidad.js';
import { apellidosTrasCambio } from '../domain/apellidos.js';
import { AuditoriaService, ACCIONES_AUDITORIA, type MetaDeAuditoria } from './auditoria.service.js';

/**
 * Lo que responde el alta, se haya creado o no. Es el mismo texto que recibe
 * el robot de la trampa (auth.controller): nada en la respuesta distingue un
 * alta hecha de una que chocó con un dato ya registrado.
 */
export const MENSAJE_ALTA = 'Solicitud enviada correctamente. Revisa tu email y pásate por Secretaría para formalizar tu alta.';

/** Por qué un alta no se crea. Solo para la auditoría, nunca para la respuesta. */
type Choque =
  | { motivo: 'correo_de_cuenta'; entidad: 'user'; id: number }
  | { motivo: 'carrera'; entidad: null; id: null };

/**
 * Un DNI del alta que ya estaba registrado. `quien` es «adulto» (quien
 * rellena el formulario) o la posición del menor en la lista. Se guarda en
 * el alta retenida y Secretaría lo ve en Solicitudes; la respuesta no lo dice.
 */
export type ChoqueDeDni =
  | { motivo: 'dni_de_cuenta'; quien: 'adulto'; dni: string; entidad: 'user'; id: number }
  | { motivo: 'dni_en_el_censo'; quien: 'adulto'; dni: string; entidad: 'hermano'; id: number }
  | { motivo: 'dni_de_menor_en_el_censo'; quien: number; dni: string; entidad: 'hermano'; id: number };

/**
 * Darse de alta: el formulario de «Hazte hermano» y la petición de volver de
 * quien se dio de baja. Las dos cosas abren la puerta al censo y ninguna
 * reparte sesión: lo que sale de aquí nace bloqueado, esperando a Secretaría.
 *
 * Entrar es otra cosa y vive en `auth.service`.
 */
export class RegistroService {
  /**
   * El alta, en sus tres caminos (ver `registerSchema`): un adulto que se hace
   * hermano, uno que además apunta a menores a su cargo, y uno que solo los
   * apunta a ellos y no entra en el censo.
   *
   * Todo nace bloqueado y no es hermano de nada hasta que Secretaría lo
   * aprueba: la cuenta con `active: false` y cada ficha con `activo: false`. Es
   * la misma puerta de siempre; lo que cambia es que por ella pueden entrar
   * varias personas de una vez.
   */
  static async registerUser(
    { usuario, titular, menores = [], pago, documentos = {} }: RegisterDto,
    meta: MetaDeAuditoria = {},
  ): Promise<{ fichas: number; message: string; creada: boolean; retenida: boolean }> {
    if (!titular && menores.length === 0) {
      throw new HttpError('No hay a quién dar de alta: marca si te apuntas tú, si apuntas a un menor, o las dos cosas.');
    }

    // El bautismo, después del nacimiento y no en el futuro.
    if (titular && (titular.fechaBautismo < titular.fechaNacimiento || titular.fechaBautismo > diaDeHoy())) {
      throw new HttpError('Revisa la fecha de bautismo: no puede ser anterior al nacimiento ni posterior a hoy.');
    }

    // La cuota (anual): sin forma de pago, como las webs de antes, en Secretaría.
    const domiciliada = pago?.forma === 'DOMICILIACION';
    if (domiciliada) {
      if (!pago.iban) throw new HttpError('Para domiciliar la cuota hace falta el IBAN de la cuenta.');
      if (!pago.titularidad) throw new HttpError('Indica quién es el titular de la cuenta.');
      if (pago.titularidad !== 'PROPIA' && !pago.titularCuenta?.trim()) {
        throw new HttpError('Escribe el nombre del titular de la cuenta.');
      }
    }

    // Las edades, antes de tocar nada: quien va a tener ficha propia es mayor
    // de edad, y a quien se apunta como menor se le comprueba que de verdad lo
    // es (con 18 cumplidos el alta la hace él, con su DNI).
    if (titular) comprobarEsAdulto(new Date(titular.fechaNacimiento));
    for (const menor of menores) comprobarEsMenor(new Date(menor.fechaNacimiento), menor.nombre);

    // Los DNI de los menores, distintos entre sí. Sin esto, dos fichas del
    // mismo envío chocarían contra el índice único ya dentro de la transacción
    // y el alta entera moriría con un 500. Esto solo mira el propio formulario:
    // no dice nada de quién hay en el censo.
    const dnisDeMenores = menores.map((m) => m.dni).filter((valor): valor is string => Boolean(valor));
    if (new Set(dnisDeMenores).size !== dnisDeMenores.length) {
      throw new HttpError('Has repetido el mismo DNI en dos de los menores.');
    }
    if (dnisDeMenores.includes(usuario.dni)) {
      throw new HttpError('Has puesto tu propio DNI en uno de los menores.');
    }

    const fichasPedidas = (titular ? 1 : 0) + menores.length;

    // SEGURIDAD: un correo o un DNI que ya está registrado NO se dice en la
    // respuesta. Antes salía un 409 «Ya hay una ficha en el censo con el DNI
    // …», y el formulario servía para averiguar si alguien es hermano —que
    // revela sus creencias (art. 9 RGPD)— probando DNI uno a uno. Ahora se
    // responde lo mismo que a un alta hecha (como `solicitarReactivacion`), y
    // el correo que llega tampoco lo delata: ver `altaNoTramitada` y `retener`.
    // El correo de la confirmación es el mismo en todos los caminos.
    const confirmacion = {
      sexo: titular?.sexo,
      certificadoAdjunto: !!documentos.certificadoBautismo && menores.length === 0,
    };
    // El correo primero: si es de una cuenta, el buzón es de su dueño y a él sí
    // se le puede contar que esa alta no sigue. Otra cuenta con ese correo no
    // puede existir, así que esta no se guarda.
    const deCorreo = await db.user.findFirst({ where: { email: usuario.email }, select: { id: true } });
    if (deCorreo) {
      return this.altaNoTramitada(usuario, { motivo: 'correo_de_cuenta', entidad: 'user', id: deCorreo.id }, fichasPedidas, meta, confirmacion);
    }
    // Un DNI ya registrado no tumba la solicitud: espera en Solicitudes a que
    // Secretaría compruebe quién es (puede ser un error al escribirlo, alguien
    // que ya estaba y no se acordaba, o un DNI ajeno).
    const choques = await this.buscarChoquesDeDni({ usuario, titular, menores });
    if (choques.length > 0) return this.retener({ usuario, titular, menores, pago, documentos }, choques, meta, confirmacion);

    let result;
    try {
      result = await this.crearCuentaYFichas({ usuario, titular, menores, pago, documentos }, await encrypt(usuario.password));
    } catch (error) {
      // Otra alta con el mismo correo o DNI que entró entre la comprobación y
      // la transacción: el índice único la para, y se contesta igual que a
      // cualquier otro choque, no con un 409 que lo delataría.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.altaNoTramitada(usuario, { motivo: 'carrera', entidad: null, id: null }, fichasPedidas, meta, confirmacion, false);
      }
      throw error;
    }

    // 2. TAREAS ASÍNCRONAS (Envío de Email fuera de la transacción)
    // El "catch" asegura que si falla el email, no se rompa el registro de la API
    // El certificado solo se da por entregado si es el único que hace falta:
    // los menores traen el suyo en persona.
    EmailService.enviarConfirmacionRegistro(result.user.email, result.user.nombre, confirmacion)
      .catch(error => {
        console.error(`❌ [Error Email] Fallo al enviar el correo de confirmación a ${enmascararEmail(result.user.email)}:`, error);
      });

    // Aviso al buzón de Secretaría. Sin él, una solicitud solo se veía entrando
    // al CMS a mirar el contador de «Hermanos», y podía quedarse parada semanas.
    this.avisarASecretaria(result.user.nombre, result.user.apellidos, result.user.email, result.fichas.length);

    // 3. LA RESPUESTA: sin el id de la cuenta, que el alta que choca no tiene
    // y que bastaría para distinguir las dos.
    return { fichas: result.fichas.length, message: MENSAJE_ALTA, creada: true, retenida: false };
  }

  /**
   * La cuenta (bloqueada) y sus fichas (inactivas): lo que deja un alta a la
   * espera de Secretaría. Lo usan el alta por la web y la tramitación de una
   * retenida con el DNI ya corregido. Puede lanzar el P2002 del índice único.
   *
   * `enviadaEl` es cuándo llegó el formulario: dar la cuenta en él es firmar el
   * mandato SEPA, y una retenida se tramita días después de enviarse.
   */
  static async crearCuentaYFichas({ usuario, titular, menores = [], pago, documentos = {} }: Omit<RegisterDto, 'usuario'> & { usuario: Omit<RegisterDto['usuario'], 'password'> }, hashedPassword: string, enviadaEl: Date = new Date()) {
    const domiciliada = pago?.forma === 'DOMICILIACION';
    // Los apellidos del adulto: por separado si vienen así, y si no, partidos.
    const apellidosDelAdulto = apellidosTrasCambio(usuario)!;

    // La cuenta del IBAN, vista desde cada ficha. Quien rellena el alta dice si
    // es suya, de un familiar hermano o de otra persona; para la ficha de un
    // menor, «suya» es la del adulto que lo apunta, y el nombre se guarda.
    const nombreDelAdulto = `${usuario.nombre} ${apellidosDelAdulto.apellidos}`.trim();
    const cuentaDe = (esElAdulto: boolean) => {
      if (!domiciliada) return { formaPagoPref: 'EFECTIVO' as const };
      const propia = pago.titularidad === 'PROPIA';
      return {
        formaPagoPref: 'DOMICILIACION' as const,
        iban: pago.iban,
        // Dar la cuenta en el alta es autorizar el adeudo: la fecha del mandato SEPA.
        fechaMandato: enviadaEl,
        titularidadCuenta: propia
          ? (esElAdulto ? 'PROPIA' as const : titular ? 'FAMILIAR_HERMANO' as const : 'OTRA_PERSONA' as const)
          : pago.titularidad,
        // Vacío es «el propio hermano», como en su perfil.
        titularCuenta: propia ? (esElAdulto ? null : nombreDelAdulto) : pago.titularCuenta!.trim(),
      };
    };

    return db.$transaction(async (tx) => {
      // Creamos el Usuario BLOQUEADO
      const newUser = await tx.user.create({
        data: {
          email: usuario.email,
          dni: usuario.dni,
          password: hashedPassword,
          role: Role.USER,
          active: false, // <--- Nace bloqueado, pendiente de pago/aprobación
          nombre: usuario.nombre,
          apellidos: apellidosDelAdulto.apellidos,
          telefono: usuario.telefono,
          direccion: usuario.direccion,
          poblacion: usuario.poblacion,
          codigoPostal: usuario.codigoPostal
        },
      });

      // Lo que hereda toda ficha de quien abre la cuenta: por ahí se localiza
      // a la persona, también a un niño de siete años sin teléfono propio.
      const contacto = {
        userId: newUser.id,
        telefono: usuario.telefono,
        email: usuario.email,
        direccion: usuario.direccion,
        poblacion: usuario.poblacion,
        codigoPostal: usuario.codigoPostal,
        provincia: usuario.provincia?.trim() || null,
        comunidadAutonoma: usuario.comunidadAutonoma?.trim() || null,
        pais: usuario.pais?.trim() || null,
        activo: false // <--- Fichas inactivas hasta que Secretaría las apruebe
      };

      await tx.hermano.createMany({
        data: [
          ...(titular ? [{
            ...contacto,
            esTitular: true,
            nombre: usuario.nombre,
            ...apellidosDelAdulto,
            dni: usuario.dni,
            fechaNacimiento: new Date(titular.fechaNacimiento),
            sexo: titular.sexo,
            estadoCivil: titular.estadoCivil,
            fechaBautismo: instanteDeDia(titular.fechaBautismo, 'fechaBautismo'),
            lugarBautismo: titular.lugarBautismo?.trim() || null,
            parroquiaBautismo: titular.parroquiaBautismo?.trim() || null,
            boletin: usuario.boletin ?? false,
            autorizaImagen: usuario.autorizaImagen ?? false,
            ...cuentaDe(true),
            foto: documentos.foto ?? null,
            certificadoBautismo: documentos.certificadoBautismo ?? null,
          }] : []),
          ...menores.map((menor) => ({
            ...contacto,
            esTitular: false,
            nombre: menor.nombre,
            // Los del adulto solo como respaldo: un sobrino o un ahijado llevan
            // los suyos, y el formulario los pide en blanco cuando no es un hijo.
            ...(apellidosTrasCambio(menor) ?? apellidosDelAdulto),
            dni: menor.dni || null,
            email: menor.email || usuario.email,
            parentesco: menor.parentesco ?? null,
            fechaNacimiento: new Date(menor.fechaNacimiento),
            // El boletín va a la ficha del adulto; si no tiene, a las de ellos.
            boletin: !titular && (usuario.boletin ?? false),
            // La foto, en cambio, es de cada uno: quien inscribe decide por los menores.
            autorizaImagen: usuario.autorizaImagen ?? false,
            ...cuentaDe(false),
          })),
        ],
      });

      // `createMany` no devuelve las filas: se leen para el aviso a Secretaría.
      const fichas = await tx.hermano.findMany({ where: { userId: newUser.id }, select: { id: true } });
      return { user: newUser, fichas };
    });
  }

  /**
   * Los DNI del alta que ya están registrados: el del adulto en una cuenta o,
   * si se hace hermano, en una ficha del censo; el de cada menor, en una
   * ficha. Todos, no el primero: Secretaría tiene que verlos todos para
   * corregirlos de una vez.
   */
  static async buscarChoquesDeDni(
    { usuario, titular, menores = [] }: { usuario: { dni: string }; titular?: unknown; menores?: { dni?: string | null }[] },
  ): Promise<ChoqueDeDni[]> {
    const choques: ChoqueDeDni[] = [];
    const deCuenta = await db.user.findFirst({ where: { dni: usuario.dni }, select: { id: true } });
    if (deCuenta) {
      choques.push({ motivo: 'dni_de_cuenta', quien: 'adulto', dni: usuario.dni, entidad: 'user', id: deCuenta.id });
    } else if (titular) {
      // Quien vuelve tras una baja, o tras suprimir su cuenta, conserva su ficha
      // con el DNI en el censo. Solo estorba si el adulto iba a tener ficha:
      // quien apunta a un menor sin hacerse hermano no crea ninguna con su DNI.
      const ficha = await db.hermano.findFirst({ where: { dni: usuario.dni }, select: { id: true } });
      if (ficha) choques.push({ motivo: 'dni_en_el_censo', quien: 'adulto', dni: usuario.dni, entidad: 'hermano', id: ficha.id });
    }
    for (const [indice, menor] of menores.entries()) {
      if (!menor.dni) continue;
      const ficha = await db.hermano.findFirst({ where: { dni: menor.dni }, select: { id: true } });
      if (ficha) choques.push({ motivo: 'dni_de_menor_en_el_censo', quien: indice, dni: menor.dni, entidad: 'hermano', id: ficha.id });
    }
    return choques;
  }

  /**
   * El alta con un DNI ya registrado: se guarda tal cual en `AltaRetenida`
   * para que Secretaría la vea en Solicitudes. Hacia fuera es un alta más:
   * el mismo bcrypt (el mismo tiempo de respuesta), la misma confirmación al
   * correo del formulario y el mismo aviso a Secretaría. La auditoría guarda
   * los motivos, sin DNI ni correo en claro.
   */
  private static async retener(
    { usuario: { password, ...usuario }, titular, menores = [], pago, documentos = {} }: Omit<RegisterDto, 'comentarioAdicional'>,
    choques: ChoqueDeDni[], meta: MetaDeAuditoria,
    confirmacion: Parameters<typeof EmailService.enviarConfirmacionRegistro>[2],
  ) {
    const retenida = await db.altaRetenida.create({
      data: {
        // Por JSON: lo que no vino (undefined) no se guarda.
        datos: JSON.parse(JSON.stringify({ usuario, titular, menores, pago, documentos })) as Prisma.InputJsonValue,
        password: await encrypt(password),
        choques: choques as unknown as Prisma.InputJsonValue,
      },
    });
    await AuditoriaService.log(ACCIONES_AUDITORIA.ALTA_RETENIDA, meta, 'altaRetenida', retenida.id, {
      motivos: choques.map((c) => c.motivo),
      para: enmascararEmail(usuario.email),
    });
    EmailService.enviarConfirmacionRegistro(usuario.email, usuario.nombre, confirmacion).catch((error) => {
      console.error(`❌ [Error Email] Fallo al enviar el correo de confirmación a ${enmascararEmail(usuario.email)}:`, error);
    });
    const fichas = (titular ? 1 : 0) + menores.length;
    this.avisarASecretaria(usuario.nombre, apellidosTrasCambio(usuario)?.apellidos ?? usuario.apellidos, usuario.email, fichas);
    return { fichas, message: MENSAJE_ALTA, creada: false, retenida: true };
  }

  private static avisarASecretaria(nombre: string, apellidos: string, email: string, fichas: number) {
    // Cuántas personas trae el alta: no es lo mismo una ficha que una familia.
    EmailService.enviarAvisoSolicitud({ nombre, apellidos, email, fichas }).catch(error => {
      console.error('❌ [Error Email] Fallo al avisar a Secretaría de la solicitud nueva:', error);
    });
  }

  /**
   * El alta que no se crea porque algo ya estaba registrado. Hace el mismo
   * trabajo caro que un alta de verdad (el bcrypt), para que el tiempo de
   * respuesta no las distinga a ojo; deja el choque en la auditoría para
   * Secretaría (sin datos personales: el motivo y a qué registro apunta) y
   * escribe al correo del formulario.
   *
   * Solo quedan dos casos: el correo ya es de una cuenta (un DNI repetido no
   * llega aquí: se retiene, ver `retener`) y la carrera entre dos altas.
   * Qué correo: si chocó ese mismo correo, el aviso de «no tramitada», que
   * solo lee el dueño del buzón. En la carrera no se sabe qué chocó, así que
   * va la confirmación de siempre: un aviso distinto podría delatar un DNI.
   */
  private static async altaNoTramitada(
    usuario: RegisterDto['usuario'], choque: Choque, fichas: number, meta: MetaDeAuditoria,
    confirmacion: Parameters<typeof EmailService.enviarConfirmacionRegistro>[2], conHash = true,
  ) {
    if (conHash) await encrypt(usuario.password);
    await AuditoriaService.log(ACCIONES_AUDITORIA.ALTA_NO_TRAMITADA, meta, choque.entidad ?? undefined, choque.id ?? undefined, {
      motivo: choque.motivo,
      para: enmascararEmail(usuario.email),
    });
    const envio = choque.motivo === 'correo_de_cuenta'
      ? EmailService.enviarSolicitudNoTramitada(usuario.email, usuario.nombre)
      : EmailService.enviarConfirmacionRegistro(usuario.email, usuario.nombre, confirmacion);
    envio.catch((error) => {
      console.error(`❌ [Error Email] Fallo al avisar a ${enmascararEmail(usuario.email)} de un alta no tramitada:`, error);
    });
    return { fichas, message: MENSAJE_ALTA, creada: false, retenida: false };
  }

  /**
   * Pedir volver tras una baja.
   *
   * La ficha de quien se fue conserva su `fechaBaja`, así que no aparece en la
   * cola de pendientes, que busca las que nunca han estado activas. Borrar esa
   * fecha para colarla ahí perdería cuándo se marchó, de modo que la petición
   * se marca aparte y la cola la recoge por esa marca.
   *
   * SEGURIDAD: responde lo mismo exista o no la ficha. Si distinguiera, el
   * formulario serviría para averiguar qué DNI están en el censo probándolos
   * uno a uno.
   */
  static async solicitarReactivacion({ dni }: ReactivacionDto) {
    const ficha = await db.hermano.findFirst({
      // Una baja por fallecimiento no «pide volver»: con el DNI de un difunto
      // se le colaría a Secretaría en la cola. El OR, porque `not` deja fuera
      // también las bajas sin motivo (NULL).
      where: { dni, activo: false, fechaBaja: { not: null }, OR: [{ motivoBaja: null }, { motivoBaja: { not: MotivoBaja.FALLECIMIENTO } }] },
      select: { id: true, reactivacionSolicitada: true },
    });

    // Insistir no reescribe la fecha: a Secretaría le importa desde cuándo
    // espera esta persona, no cuándo volvió a pulsar el botón.
    if (ficha && !ficha.reactivacionSolicitada) {
      await db.hermano.update({ where: { id: ficha.id }, data: { reactivacionSolicitada: new Date() } });
    }

    return { message: 'Si hay una ficha a tu nombre, Secretaría la revisará y se pondrá en contacto contigo.' };
  }
}
