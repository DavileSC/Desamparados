import db from '../config/db';
import { encrypt } from '../utils/bcrypt.handle';
import { Role } from '@prisma/client';
import { RegisterDto, ReactivacionDto } from '../dtos/auth.dto';
import { comprobarEsAdulto, comprobarEsMenor, diaDeHoy, instanteDeDia } from '../domain/fechas-hermano.js';
import { EmailService } from './email.service';
import { HttpError } from '../utils/error.handle';
import { enmascararEmail } from '../utils/log-privacidad.js';
import { apellidosTrasCambio } from '../domain/apellidos.js';

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
  static async registerUser({ usuario, titular, menores = [], pago, documentos = {} }: RegisterDto) {
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

    const checkUser = await db.user.findFirst({
      where: { OR: [{ email: usuario.email }, { dni: usuario.dni }] }
    });
    if (checkUser) throw new HttpError('El email o DNI ya están registrados.', 409);

    // Las edades, antes de tocar nada: quien va a tener ficha propia es mayor
    // de edad, y a quien se apunta como menor se le comprueba que de verdad lo
    // es (con 18 cumplidos el alta la hace él, con su DNI).
    if (titular) comprobarEsAdulto(new Date(titular.fechaNacimiento));
    for (const menor of menores) comprobarEsMenor(new Date(menor.fechaNacimiento), menor.nombre);

    // Los DNI de los menores: libres en el censo y distintos entre sí. Sin lo
    // segundo, dos fichas del mismo envío chocarían contra el índice único ya
    // dentro de la transacción y el alta entera moriría con un 500.
    const dnisDeMenores = menores.map((m) => m.dni).filter((valor): valor is string => Boolean(valor));
    if (new Set(dnisDeMenores).size !== dnisDeMenores.length) {
      throw new HttpError('Has repetido el mismo DNI en dos de los menores.');
    }
    if (dnisDeMenores.includes(usuario.dni)) {
      throw new HttpError('Has puesto tu propio DNI en uno de los menores.');
    }
    if (dnisDeMenores.length > 0) {
      const ocupado = await db.hermano.findFirst({ where: { dni: { in: dnisDeMenores } }, select: { dni: true } });
      if (ocupado) throw new HttpError(`Ya hay una ficha en el censo con el DNI ${ocupado.dni}.`, 409);
    }

    // Quien vuelve tras una baja, o tras suprimir su cuenta, conserva su ficha
    // con el DNI en el censo: una ficha nueva chocaría con el índice único y
    // daría un 500. Lo que toca es que Secretaría reactive la que ya existe, y
    // para eso está `solicitarReactivacion`, que es lo que ofrece la web cuando
    // le llega este 409. Solo estorba si el adulto iba a tener ficha: quien
    // apunta a un menor sin hacerse hermano no crea ninguna con su DNI.
    if (titular) {
      const fichaConEseDni = await db.hermano.findFirst({ where: { dni: usuario.dni }, select: { id: true } });
      if (fichaConEseDni) {
        throw new HttpError(
          'Ya hay una ficha en el censo con ese DNI. Si fuiste hermano, pide a Secretaría que te reactive.',
          409
        );
      }
    }

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
        fechaMandato: new Date(),
        titularidadCuenta: propia
          ? (esElAdulto ? 'PROPIA' as const : titular ? 'FAMILIAR_HERMANO' as const : 'OTRA_PERSONA' as const)
          : pago.titularidad,
        // Vacío es «el propio hermano», como en su perfil.
        titularCuenta: propia ? (esElAdulto ? null : nombreDelAdulto) : pago.titularCuenta!.trim(),
      };
    };

    const hashedPassword = await encrypt(usuario.password);

    // 1. TRANSACCIÓN RÁPIDA DE BASE DE DATOS
    const result = await db.$transaction(async (tx) => {
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
            ...cuentaDe(false),
          })),
        ],
      });

      // `createMany` no devuelve las filas: se leen para el aviso a Secretaría.
      const fichas = await tx.hermano.findMany({ where: { userId: newUser.id }, select: { id: true } });
      return { user: newUser, fichas };
    });

    // 2. TAREAS ASÍNCRONAS (Envío de Email fuera de la transacción)
    // El "catch" asegura que si falla el email, no se rompa el registro de la API
    // El certificado solo se da por entregado si es el único que hace falta:
    // los menores traen el suyo en persona.
    EmailService.enviarConfirmacionRegistro(result.user.email, result.user.nombre, {
      sexo: titular?.sexo,
      certificadoAdjunto: !!documentos.certificadoBautismo && menores.length === 0,
    })
      .catch(error => {
        console.error(`❌ [Error Email] Fallo al enviar el correo de confirmación a ${enmascararEmail(result.user.email)}:`, error);
      });

    // Aviso al buzón de Secretaría. Sin él, una solicitud solo se veía entrando
    // al CMS a mirar el contador de «Hermanos», y podía quedarse parada semanas.
    EmailService.enviarAvisoSolicitud({
      nombre: result.user.nombre,
      apellidos: result.user.apellidos,
      email: result.user.email,
      // Cuántas personas trae el alta: no es lo mismo una ficha que una familia.
      fichas: result.fichas.length,
    }).catch(error => {
      console.error('❌ [Error Email] Fallo al avisar a Secretaría de la solicitud nueva:', error);
    });

    // 3. RETORNAMOS LA RESPUESTA AL USUARIO
    return {
      user: { id: result.user.id, email: result.user.email }, // Retornamos info segura, sin password
      fichas: result.fichas.length,
      message: 'Solicitud enviada correctamente. Revisa tu email y pásate por Secretaría para formalizar tu alta.'
    };
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
      where: { dni, activo: false, fechaBaja: { not: null } },
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
