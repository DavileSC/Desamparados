// test/seed-demo.test.ts
//
// La siembra de demostración se parte en dos: aquí se comprueba la parte que
// *decide* los datos, que es pura y no toca la base de datos. Lo que escribe en
// MariaDB (`prisma/seed-demo.ts`) se limita a volcar lo que sale de aquí, así
// que estos casos corren siempre, sin necesidad de tener la base levantada.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  EJERCICIOS_DEMO,
  generarHermanos,
  generarPapeletas,
  generarPrendas,
  conCingulosSinDevolver,
  generarRecibos,
  generarReparto,
  generarSolicitudes,
  generarTransacciones,
} from '../prisma/demo/generar.js';
import { CATEGORIAS, PRENDAS } from '../prisma/seed-contenido.js';
import { demostracionDesactivada } from '../prisma/seed-demo.js';

const ANIO = 2026;
const SALIDA = 'Estación de penitencia';

describe('hermanos de demostración', () => {
  test('genera los que se le piden', () => {
    assert.equal(generarHermanos(300, ANIO).length, 300);
  });

  test('es determinista: dos siembras dan exactamente lo mismo', () => {
    // Sin esto, cada `npm run seed` cambiaría las cifras del panel y no habría
    // forma de comparar una captura con la siguiente.
    assert.deepEqual(generarHermanos(50, ANIO), generarHermanos(50, ANIO));
  });

  test('ningún DNI ni correo se repite', () => {
    // El esquema los tiene como únicos: un choque revienta la siembra entera.
    const hermanos = generarHermanos(300, ANIO);
    assert.equal(new Set(hermanos.map((h) => h.dni)).size, 300);
    assert.equal(new Set(hermanos.map((h) => h.email)).size, 300);
  });

  test('los números de hermano no se repiten, y algunos activos no tienen', () => {
    const hermanos = generarHermanos(300, ANIO);
    const numeros = hermanos.map((h) => h.numeroHermano).filter((n) => n !== null);
    assert.equal(new Set(numeros).size, numeros.length);

    const sinNumero = hermanos.filter((h) => h.activo && h.numeroHermano === null);
    assert.ok(sinNumero.length > 0, 'el panel enseña esa cifra: con cero no se ve nunca');
    assert.ok(sinNumero.length < 300 * 0.3, 'y con demasiados parecería un error de datos');
  });

  test('hay gente en los cinco tramos de edad del panel', () => {
    const hermanos = generarHermanos(300, ANIO);
    const edad = (h: { fechaNacimiento: Date }) => ANIO - h.fechaNacimiento.getUTCFullYear();
    const tramos = [
      hermanos.filter((h) => edad(h) <= 17),
      hermanos.filter((h) => edad(h) >= 18 && edad(h) <= 30),
      hermanos.filter((h) => edad(h) >= 31 && edad(h) <= 45),
      hermanos.filter((h) => edad(h) >= 46 && edad(h) <= 60),
      hermanos.filter((h) => edad(h) >= 61),
    ];
    for (const [i, tramo] of tramos.entries()) {
      assert.ok(tramo.length > 0, `el tramo ${i} se queda vacío y su barra sale a cero`);
    }
  });

  test('las altas se reparten por los cinco ejercicios', () => {
    // «Papeletas por año» y la línea del censo necesitan varios ejercicios para
    // tener forma: si todos entran el mismo año, la línea es un escalón.
    const hermanos = generarHermanos(300, ANIO);
    for (const anio of EJERCICIOS_DEMO(ANIO)) {
      const altas = hermanos.filter((h) => h.fechaAlta.getUTCFullYear() === anio);
      assert.ok(altas.length > 0, `nadie se dio de alta en ${anio}`);
    }
  });

  test('hay altas en los últimos doce meses, que es lo que mira el panel', () => {
    const hermanos = generarHermanos(300, ANIO);
    const haceUnAnio = new Date(Date.UTC(ANIO - 1, new Date().getUTCMonth(), 1));
    const recientes = hermanos.filter((h) => h.fechaAlta >= haceUnAnio);
    assert.ok(recientes.length > 0, 'la cifra de altas en doce meses saldría a cero');
  });

  test('hay bajas, y cada baja tiene su fecha', () => {
    const hermanos = generarHermanos(300, ANIO);
    const bajas = hermanos.filter((h) => !h.activo);
    assert.ok(bajas.length > 0, 'sin bajas, la cifra de bajas del panel sale siempre a cero');
    for (const baja of bajas) {
      assert.ok(baja.fechaBaja !== null, `${baja.dni} está de baja sin fecha`);
      assert.ok(baja.fechaBaja! >= baja.fechaAlta, `${baja.dni} se fue antes de entrar`);
    }
    for (const activo of hermanos.filter((h) => h.activo)) {
      assert.equal(activo.fechaBaja, null);
    }
  });

  test('el tallaje sirve para la previsión de túnicas y varales', () => {
    const hermanos = generarHermanos(300, ANIO);
    const conTalla = hermanos.filter((h) => h.tunica !== null);
    const conAltura = hermanos.filter((h) => h.alturaHombro !== null);
    assert.ok(conTalla.length > 0);
    assert.ok(conAltura.length > 0);
    for (const h of conAltura) {
      assert.ok(h.alturaHombro! >= 120 && h.alturaHombro! <= 200, `altura imposible: ${h.alturaHombro}`);
    }
  });

  test('nadie nace en el futuro ni se da de alta antes de nacer', () => {
    for (const h of generarHermanos(300, ANIO)) {
      assert.ok(h.fechaNacimiento.getUTCFullYear() < ANIO, `${h.dni} nace en el futuro`);
      assert.ok(h.fechaAlta > h.fechaNacimiento, `${h.dni} se da de alta antes de nacer`);
    }
  });
});

describe('recibos de demostración', () => {
  const hermanos = generarHermanos(300, ANIO);
  const recibos = generarRecibos(hermanos, ANIO, SALIDA);

  test('es determinista', () => {
    assert.deepEqual(generarRecibos(hermanos, ANIO, SALIDA), generarRecibos(hermanos, ANIO, SALIDA));
  });

  test('respeta la unicidad de hermano, año y concepto que exige el esquema', () => {
    // @@unique([hermanoId, year, concepto]): un choque aborta la siembra entera.
    const claves = recibos.map((r) => `${r.dniHermano}|${r.year}|${r.concepto}`);
    assert.equal(new Set(claves).size, claves.length);
  });

  test('nadie paga por un año en el que no era hermano', () => {
    const porDni = new Map(hermanos.map((h) => [h.dni, h]));
    for (const recibo of recibos) {
      const hermano = porDni.get(recibo.dniHermano)!;
      assert.ok(recibo.year >= hermano.fechaAlta.getUTCFullYear(), `${recibo.dniHermano} paga ${recibo.year} y entró después`);
      if (hermano.fechaBaja) {
        assert.ok(recibo.year <= hermano.fechaBaja.getUTCFullYear(), `${recibo.dniHermano} paga ${recibo.year} y ya se había ido`);
      }
    }
  });

  test('cubre los cinco ejercicios', () => {
    for (const anio of EJERCICIOS_DEMO(ANIO)) {
      assert.ok(recibos.some((r) => r.year === anio), `${anio} se queda sin recibos`);
    }
  });

  test('solo los cobrados llevan fecha y método de pago', () => {
    for (const recibo of recibos) {
      if (recibo.estado === 'PAGADO') {
        assert.ok(recibo.fechaPago !== null, 'un recibo cobrado sin fecha de pago descuadra la tesorería');
        assert.ok(recibo.metodoPago !== null);
        assert.ok(recibo.fechaPago! >= recibo.fechaEmision, 'cobrado antes de emitirse');
      } else {
        assert.equal(recibo.fechaPago, null, `un recibo ${recibo.estado} no puede tener fecha de pago`);
      }
    }
  });

  test('la barra de estados del panel tiene los tres colores', () => {
    // El panel pinta cobrados, pendientes y devueltos: con un solo estado la
    // barra sale de una pieza y no se ve si funciona.
    for (const estado of ['PAGADO', 'PENDIENTE', 'DEVUELTO']) {
      assert.ok(recibos.some((r) => r.estado === estado), `ningún recibo en estado ${estado}`);
    }
  });

  test('quedan cobros pendientes en el ejercicio en curso', () => {
    const pendientes = recibos.filter((r) => r.year === ANIO && r.estado === 'PENDIENTE');
    assert.ok(pendientes.length > 0, 'la cifra de «pendiente de cobro» del panel saldría a cero');
  });

  test('los importes son dinero de verdad: positivos y con dos decimales', () => {
    for (const recibo of recibos) {
      assert.ok(recibo.importe > 0, `importe no positivo: ${recibo.importe}`);
      assert.equal(Math.round(recibo.importe * 100), recibo.importe * 100, `${recibo.importe} tiene más de dos decimales`);
    }
  });

  test('la cuota anual la paga todo el mundo y la papeleta solo quien sale', () => {
    const cuotas = recibos.filter((r) => r.tipo === 'CUOTA_HERMANO');
    const papeletas = recibos.filter((r) => r.tipo === 'PAPELETA_SITIO');
    assert.ok(cuotas.length > papeletas.length, 'debería haber más cuotas que papeletas');
    assert.ok(papeletas.length > 0);
  });
});

describe('contabilidad de demostración', () => {
  const hermanos = generarHermanos(300, ANIO);
  const recibos = generarRecibos(hermanos, ANIO, SALIDA);
  const movimientos = generarTransacciones(recibos, ANIO);

  test('es determinista', () => {
    assert.deepEqual(generarTransacciones(recibos, ANIO), generarTransacciones(recibos, ANIO));
  });

  test('solo usa categorías que el seed de contenido ya siembra', () => {
    // Inventarse una categoría aquí reventaría la siembra: el modelo exige
    // categoriaId y nadie crearía esa fila.
    for (const movimiento of movimientos) {
      const categoria = CATEGORIAS.find((c) => c.nombre === movimiento.categoria);
      assert.ok(categoria, `la categoría «${movimiento.categoria}» no existe en el seed de contenido`);
      assert.equal(categoria!.tipo, movimiento.tipo, `«${movimiento.categoria}» no es de tipo ${movimiento.tipo}`);
    }
  });

  test('cada recibo cobrado deja su ingreso, por el mismo importe y el mismo día', () => {
    const cobrados = recibos.filter((r) => r.estado === 'PAGADO');
    const ingresosPorRecibo = new Map(
      movimientos.filter((m) => m.claveRecibo !== null).map((m) => [m.claveRecibo!, m]),
    );
    for (const recibo of cobrados) {
      const clave = `${recibo.dniHermano}|${recibo.year}|${recibo.concepto}`;
      const ingreso = ingresosPorRecibo.get(clave);
      assert.ok(ingreso, `el recibo ${clave} está cobrado y no tiene ingreso`);
      assert.equal(ingreso!.importe, recibo.importe);
      assert.deepEqual(ingreso!.fecha, recibo.fechaPago);
    }
  });

  test('no hay movimientos con fecha futura', () => {
    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);
    for (const movimiento of movimientos) {
      assert.ok(movimiento.fecha < manana, `movimiento en el futuro: ${movimiento.fecha.toISOString()}`);
    }
  });

  test('los doce meses de la serie del panel tienen ingresos y gastos', () => {
    // La línea de tesorería es de doce meses: un mes sin movimientos deja un
    // valle a cero que parece un fallo del gráfico.
    const hoy = new Date();
    for (let atras = 0; atras < 12; atras++) {
      const mes = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - atras, 1));
      const clave = `${mes.getUTCFullYear()}-${String(mes.getUTCMonth() + 1).padStart(2, '0')}`;
      const delMes = movimientos.filter(
        (m) => `${m.fecha.getUTCFullYear()}-${String(m.fecha.getUTCMonth() + 1).padStart(2, '0')}` === clave,
      );
      assert.ok(delMes.some((m) => m.tipo === 'INGRESO'), `${clave} se queda sin ingresos`);
      assert.ok(delMes.some((m) => m.tipo === 'GASTO'), `${clave} se queda sin gastos`);
    }
  });

  test('los importes son dinero de verdad: positivos y con dos decimales', () => {
    for (const movimiento of movimientos) {
      assert.ok(movimiento.importe > 0, `importe no positivo: ${movimiento.importe}`);
      assert.equal(Math.round(movimiento.importe * 100), movimiento.importe * 100);
    }
  });

  test('el ejercicio en curso cierra en positivo', () => {
    // Un grupo parroquial que gasta más de lo que ingresa es una historia
    // distinta de la que cuenta esta demostración.
    const delAnio = movimientos.filter((m) => m.fecha.getUTCFullYear() === ANIO);
    const suma = (tipo: string) =>
      delAnio.filter((m) => m.tipo === tipo).reduce((total, m) => total + m.importe, 0);
    assert.ok(suma('INGRESO') > suma('GASTO'), 'el saldo del ejercicio sale negativo');
  });

  test('hay gasto repartido entre varias categorías, no todo en una', () => {
    // El panel pinta «por categoría contable»: con una sola categoría la lista
    // tiene una fila y no se ve si el bloque funciona.
    const categoriasDeGasto = new Set(movimientos.filter((m) => m.tipo === 'GASTO').map((m) => m.categoria));
    assert.ok(categoriasDeGasto.size >= 4, `solo ${categoriasDeGasto.size} categorías de gasto`);
  });
});

describe('procesión de demostración', () => {
  const hermanos = generarHermanos(300, ANIO);
  const recibos = generarRecibos(hermanos, ANIO, SALIDA);
  const papeletas = generarPapeletas(hermanos, recibos);

  test('es determinista', () => {
    assert.deepEqual(generarPapeletas(hermanos, recibos), generarPapeletas(hermanos, recibos));
  });

  test('cada papeleta cuelga de un recibo de papeleta que existe', () => {
    // El esquema ata la papeleta a su recibo con una relación obligatoria y
    // única: sin recibo detrás, la fila no entra.
    const recibosPapeleta = new Set(
      recibos.filter((r) => r.tipo === 'PAPELETA_SITIO').map((r) => `${r.dniHermano}|${r.year}|${r.concepto}`),
    );
    for (const papeleta of papeletas) {
      assert.ok(recibosPapeleta.has(papeleta.claveRecibo), `papeleta sin recibo: ${papeleta.claveRecibo}`);
    }
    assert.equal(new Set(papeletas.map((p) => p.claveRecibo)).size, papeletas.length, 'dos papeletas del mismo recibo');
  });

  test('un hermano sale una sola vez por año, como exige el esquema', () => {
    const claves = papeletas.map((p) => `${p.dniHermano}|${p.year}`);
    assert.equal(new Set(claves).size, claves.length);
  });

  test('cubre varios ejercicios, que es lo que compara el gráfico por año', () => {
    const anios = new Set(papeletas.map((p) => p.year));
    assert.ok(anios.size >= 3, `solo ${anios.size} ejercicios con papeletas`);
  });

  test('el puesto de la papeleta es el del hermano', () => {
    const porDni = new Map(hermanos.map((h) => [h.dni, h]));
    for (const papeleta of papeletas) {
      assert.equal(papeleta.puesto, porDni.get(papeleta.dniHermano)!.puesto);
    }
  });

  test('los nazarenos llevan tramo y los hombres de trono no', () => {
    // El tramo es del cortejo de nazarenos; quien va bajo el paso no lleva.
    for (const papeleta of papeletas) {
      if (papeleta.puesto === 'Hombre de trono') {
        assert.equal(papeleta.tramo, null, 'un hombre de trono no va en un tramo del cortejo');
      }
      if (papeleta.puesto.startsWith('Nazareno')) {
        assert.ok(papeleta.tramo !== null, 'un nazareno sin tramo no se puede colocar');
      }
    }
  });
});

describe('reparto y albacería de demostración', () => {
  const hermanos = generarHermanos(300, ANIO);
  const { turnos, citas } = generarReparto(hermanos, ANIO);
  const papeletasSinCingulo = generarPapeletas(hermanos, generarRecibos(hermanos, ANIO, SALIDA));
  const prendas = generarPrendas(papeletasSinCingulo);
  const papeletas = conCingulosSinDevolver(papeletasSinCingulo, prendas);

  test('es determinista', () => {
    assert.deepEqual(generarReparto(hermanos, ANIO), generarReparto(hermanos, ANIO));
    assert.deepEqual(generarPrendas(papeletasSinCingulo), generarPrendas(papeletasSinCingulo));
  });

  test('la ropa de cada papeleta existe en el ropero, y un número no va en dos papeletas del mismo año', () => {
    const delRopero = new Set(prendas.map((p) => p.numero));
    const vistas = new Set<string>();
    for (const p of papeletas) {
      for (const numero of [p.numTunicaAsignada, p.numCapiroteAsignado]) {
        if (!numero) continue;
        assert.ok(delRopero.has(numero), `${numero} no está en el ropero`);
        const clave = `${p.year}|${numero}`;
        assert.ok(!vistas.has(clave), `${numero} va en dos papeletas de ${p.year}`);
        vistas.add(clave);
      }
      if (p.origenTunica !== 'ROPERO') assert.equal(p.numTunicaAsignada, null, 'con túnica propia o sin túnica no lleva número del ropero');
    }
  });

  test('la ropa se devuelve: lo poco sin devolver lo tiene quien lo llevó en su última papeleta, con su cíngulo', () => {
    const prestadas = prendas.filter((p) => p.estado === 'PRESTADA');
    assert.ok(prestadas.length > 0, 'la lista «Sin devolver» saldría vacía');
    assert.ok(prestadas.length < prendas.length / 5, `${prestadas.length} sin devolver: casi todo tiene que haber vuelto`);
    for (const prenda of prestadas) {
      const suyas = papeletas.filter((p) => p.dniHermano === prenda.dniHermano && (p.numTunicaAsignada === prenda.numero || p.numCapiroteAsignado === prenda.numero));
      assert.ok(suyas.length > 0, `${prenda.numero} está prestada a quien nunca la llevó`);
    }
    const cingulos = papeletas.filter((p) => p.cingulo === 'PRESTADO');
    assert.ok(cingulos.length > 0);
    for (const p of cingulos) {
      assert.ok(prestadas.some((t) => t.numero === p.numTunicaAsignada && t.dniHermano === p.dniHermano), 'un cíngulo sin devolver sin su túnica');
    }
    assert.ok(papeletas.filter((p) => p.origenTunica === 'ROPERO').every((p) => p.cingulo === 'PRESTADO' || p.cingulo === 'DEVUELTO'));
  });

  test('hay turnos por venir, que es lo que cuenta el panel', () => {
    const proximos = turnos.filter((t) => t.fecha > new Date());
    assert.ok(proximos.length > 0, '«turnos próximos» del panel saldría a cero');
    for (const turno of proximos) {
      assert.ok(turno.capacidadEstimada > 0, 'un turno sin capacidad no atiende a nadie');
      assert.ok(turno.horaFin > turno.horaInicio, 'el turno cierra antes de abrir');
    }
  });

  test('las citas de los turnos por venir están reservadas, y las viejas ya no', () => {
    const porId = new Map(turnos.map((t) => [t.clave, t]));
    for (const cita of citas) {
      const turno = porId.get(cita.claveTurno);
      assert.ok(turno, `cita de un turno que no existe: ${cita.claveTurno}`);
      if (turno!.fecha > new Date()) {
        assert.equal(cita.estado, 'RESERVADA', 'una cita futura no puede estar atendida');
      } else {
        assert.notEqual(cita.estado, 'RESERVADA', 'una cita pasada sigue en reserva');
      }
    }
  });

  test('un hermano no pide dos citas en el mismo turno', () => {
    const claves = citas.map((c) => `${c.dniHermano}|${c.claveTurno}`);
    assert.equal(new Set(claves).size, claves.length);
  });

  test('las prendas no chocan con las que ya siembra el contenido de ejemplo', () => {
    // `numero` es único en el esquema, y el seed de contenido ya usa TUN-001,
    // CAP-001 y FAR-001.
    const yaSembradas = new Set(PRENDAS.map((p) => p.numero));
    for (const prenda of prendas) {
      assert.ok(!yaSembradas.has(prenda.numero), `${prenda.numero} ya existe en el seed de contenido`);
    }
    assert.equal(new Set(prendas.map((p) => p.numero)).size, prendas.length);
  });

  test('solo las prendas prestadas tienen dueño y fecha de entrega', () => {
    for (const prenda of prendas) {
      if (prenda.estado === 'PRESTADA') {
        assert.ok(prenda.dniHermano !== null, `${prenda.numero} está prestada y no se sabe a quién`);
        assert.ok(prenda.fechaAsignacion !== null);
      } else {
        assert.equal(prenda.dniHermano, null, `${prenda.numero} está ${prenda.estado} y tiene dueño`);
      }
    }
  });
});

describe('la guarda de la siembra de demostración', () => {
  // Trescientas personas inventadas en el censo real serían un destrozo, y el
  // isDev de este proyecto (NODE_ENV !== 'production') se dispara solo.
  const conEntorno = (entorno: Record<string, string | undefined>, comprobar: () => void) => {
    const previo = { NODE_ENV: process.env.NODE_ENV, SEED_DEMO: process.env.SEED_DEMO };
    Object.assign(process.env, entorno);
    try {
      comprobar();
    } finally {
      Object.assign(process.env, previo);
    }
  };

  test('en producción no se siembra, y dice por qué', () => {
    conEntorno({ NODE_ENV: 'production', SEED_DEMO: undefined }, () => {
      assert.equal(demostracionDesactivada(), 'NODE_ENV=production');
    });
  });

  test('SEED_DEMO=0 la apaga en cualquier entorno', () => {
    conEntorno({ NODE_ENV: 'development', SEED_DEMO: '0' }, () => {
      assert.equal(demostracionDesactivada(), 'SEED_DEMO=0');
    });
  });

  test('en desarrollo se siembra', () => {
    conEntorno({ NODE_ENV: 'development', SEED_DEMO: undefined }, () => {
      assert.equal(demostracionDesactivada(), null);
    });
  });
});

describe('solicitudes de alta de demostración', () => {
  const solicitudes = generarSolicitudes(ANIO);

  test('hay unas cuantas esperando', () => {
    assert.ok(solicitudes.length >= 4 && solicitudes.length <= 6, `son ${solicitudes.length}`);
  });

  test('es determinista', () => {
    assert.deepEqual(generarSolicitudes(ANIO), generarSolicitudes(ANIO));
  });

  test('alguna trae un menor a cargo, que es el caso que interesa probar', () => {
    // Es el caso que luego se emancipa desde el CMS.
    const conMenor = solicitudes.filter((s) => s.fichas.length > 1);
    assert.ok(conMenor.length > 0);
    for (const solicitud of conMenor) {
      const menores = solicitud.fichas.filter((f) => !f.esTitular);
      assert.ok(menores.length > 0);
      for (const menor of menores) {
        assert.ok(ANIO - menor.fechaNacimiento.getUTCFullYear() < 18, 'el dependiente debería ser menor');
      }
    }
  });

  test('cada solicitud tiene exactamente un titular', () => {
    for (const solicitud of solicitudes) {
      assert.equal(solicitud.fichas.filter((f) => f.esTitular).length, 1);
    }
  });

  test('no chocan con los DNI ni los correos del censo', () => {
    // Los dos campos son únicos en el esquema: un choque aborta la siembra.
    const censo = generarHermanos(300, ANIO);
    const dnis = new Set(censo.map((h) => h.dni));
    const correos = new Set(censo.map((h) => h.email));
    for (const solicitud of solicitudes) {
      assert.ok(!dnis.has(solicitud.dni), `${solicitud.dni} ya está en el censo`);
      assert.ok(!correos.has(solicitud.email), `${solicitud.email} ya está en el censo`);
      for (const ficha of solicitud.fichas) {
        if (ficha.dni) assert.ok(!dnis.has(ficha.dni));
      }
    }
  });
});
