// Genera las pantallas de A4 (claro/oscuro + gráficas) como artboards .dc.html.
// La geometría de las gráficas se calcula aquí para que el SVG salga exacto.
// Cargos: 'hm' (Hermano Mayor, lo ve todo) y 'redes' (solo contenido).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const ALTO_COMPLETO = 2660;
// Anchos interiores reales de las tarjetas: columna 1088, tarjeta con 22 px de relleno y 1 px de borde.
const ANCHO_MEDIA = 488;
const ANCHO_ENTERA = 1042;

const miles = (n) => (n < 0 ? '−' : '') + String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const eur = (n) => `${miles(n)}&nbsp;€`;
const r1 = (n) => Math.round(n * 10) / 10;

const I = {
  home: '<path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"></path>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="m21 16-5-5-9 9"></path>',
  news: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"></path><path d="M17 9h3v8a2 2 0 0 1-2 2"></path><path d="M8 9h5M8 13h5"></path>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"></path><path d="M5 17a3 3 0 0 1 3-3h11"></path>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>',
  users: '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"></path>',
  box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"></path><path d="M3 7.5 12 12l9-4.5M12 12v9"></path>',
  wallet: '<rect x="3" y="6" width="18" height="14" rx="2"></rect><path d="M3 10h18M16 15h2"></path>',
  chart: '<path d="M3 21h18M6 17v-6M11 17V6M16 17v-4"></path>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="2"></rect><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"></path>',
  shield: '<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"></path>',
  search: '<circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path>',
  plus: '<path d="M12 5v14M5 12h14"></path>',
  sun: '<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"></path>',
  ok: '<circle cx="12" cy="12" r="9"></circle><path d="m8 12 3 3 5-6"></path>',
  clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
  alert: '<path d="M12 3 2 20h20z"></path><path d="M12 10v4M12 17v.5"></path>',
  chevron: '<path d="m6 9 6 6 6-6"></path>',
};
const ico = (p, size = 18, style = '') => `<svg class="i" viewBox="0 0 24 24" style="width: ${size}px; height: ${size}px;${style}">${p}</svg>`;

// ---------- estilos: los dos temas son variables CSS; la raíz lleva la clase ----------
const ESTILOS = `
    body { margin: 0; font-family: "Hanken Grotesk", "Segoe UI", system-ui, sans-serif; }
    a { color: var(--enlace); } a:hover { color: var(--texto); }
    .raiz.oscuro {
      --fondo: #262326; --tarjeta: #1d1b1e; --borde: transparent; --filete: rgba(204,196,201,0.1);
      --texto: #ffffff; --texto2: #cbc5c8; --tenue: #8f8a8d;
      --boton2: rgba(255,255,255,0.06); --boton2borde: transparent;
      --accionFondo: rgba(160,61,68,0.22); --accionTexto: #ffb3b4; --enlace: #ffb3b4;
      --inverso: #fbf9f6; --inversoTexto: #1b1c1a; --inversoTenue: #7b757a; --inversoPista: #e4e2df;
      --rejilla: rgba(204,196,201,0.12); --cero: rgba(204,196,201,0.4);
      --entrada: #3987e5; --salida: #b0414a; --contexto: #4a454a; --enfasis: #ffffff; --neutro: #8f8a8d;
      --pillUrg: rgba(227,73,72,0.18); --pillPen: rgba(237,161,0,0.18); --pillNeu: rgba(255,255,255,0.08);
      --emergente: #100e11; --emergenteBorde: rgba(204,196,201,0.18); --banda: rgba(255,255,255,0.05);
    }
    .raiz.claro {
      --fondo: #f4f2ee; --tarjeta: #ffffff; --borde: #e3dfda; --filete: #efebe6;
      --texto: #1b1c1a; --texto2: #4a454a; --tenue: #7b757a;
      --boton2: #ffffff; --boton2borde: #e3dfda;
      --accionFondo: rgba(110,24,34,0.07); --accionTexto: #6e1822; --enlace: #6e1822;
      --inverso: #1d1b1e; --inversoTexto: #ffffff; --inversoTenue: rgba(255,255,255,0.55); --inversoPista: rgba(255,255,255,0.12);
      --rejilla: #efebe6; --cero: #b9b3b0;
      --entrada: #2a78d6; --salida: #b0414a; --contexto: #d6d0cb; --enfasis: #1b1c1a; --neutro: #7b757a;
      --pillUrg: rgba(227,73,72,0.12); --pillPen: rgba(237,161,0,0.16); --pillNeu: #efeeeb;
      --emergente: #ffffff; --emergenteBorde: #e3dfda; --banda: rgba(27,28,26,0.045);
    }
    .raiz { background: var(--fondo); color: var(--texto); transition: background-color 0.25s ease, color 0.25s ease; }
    .raiz .card, .raiz .cifra { transition: background-color 0.25s ease; }
    svg.i { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
    .side { width: 264px; flex-shrink: 0; background: #100e11; }
    .sideIn { height: 900px; box-sizing: border-box; padding: 26px 14px 16px; display: flex; flex-direction: column; }
    .buscar { margin: 22px 0 6px; height: 38px; border-radius: 10px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); font-size: 13px; display: flex; align-items: center; gap: 10px; padding: 0 8px 0 12px; }
    .kbd { font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.16); color: rgba(255,255,255,0.55); }
    .etq { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.36); padding: 16px 12px 6px; }
    .grupo { display: flex; flex-direction: column; gap: 2px; }
    .item { height: 36px; display: flex; align-items: center; gap: 12px; padding: 0 8px 0 12px; border-radius: 10px; font-size: 14px; color: rgba(255,255,255,0.66); }
    .item.activo { background: #a03d44; color: #ffffff; }
    .lbl { flex-grow: 1; }
    .badge { min-width: 22px; height: 20px; padding: 0 6px; border-radius: 10px; font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; color: #100e11; }
    .tema { display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: rgba(255,255,255,0.06); margin: 0 2px 14px; }
    .seg { flex: 1; height: 30px; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 8px; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.55); cursor: pointer; }
    .seg.on { background: rgba(255,255,255,0.14); color: #ffffff; }
    .ov { font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--tenue); }
    .serif { font-family: "Libre Caslon Text", Georgia, serif; font-weight: 400; }
    .btn { height: 40px; padding: 0 16px; border-radius: 10px; display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
    .btn2 { background: var(--boton2); border: 1px solid var(--boton2borde); color: var(--texto); }
    .card { background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 14px; }
    .card-h { display: flex; justify-content: space-between; align-items: baseline; padding: 18px 22px 12px; }
    .h2 { font-family: "Libre Caslon Text", Georgia, serif; font-weight: 400; font-size: 21px; line-height: 1.3; margin: 0; }
    .suave { font-size: 13px; color: var(--tenue); }
    .fila { display: flex; align-items: center; gap: 16px; padding: 13px 22px; border-top: 1px solid var(--filete); }
    .subfila { padding: 14px 22px 6px; border-top: 1px solid var(--filete); font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--tenue); }
    .pill { width: 96px; flex-shrink: 0; height: 26px; border-radius: 13px; display: inline-flex; align-items: center; gap: 7px; padding: 0 10px; font-size: 12px; font-weight: 600; color: var(--texto); box-sizing: border-box; }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .t1 { font-size: 15px; font-weight: 600; }
    .t2 { font-size: 13px; color: var(--tenue); margin-top: 2px; }
    .accion { height: 34px; padding: 0 12px 0 14px; border-radius: 9px; background: var(--accionFondo); color: var(--accionTexto); font-size: 13px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .lleva { height: 28px; padding: 0 12px; border-radius: 14px; background: var(--pillNeu); color: var(--texto2); font-size: 12px; font-weight: 600; display: inline-flex; align-items: center; flex-shrink: 0; white-space: nowrap; }
    .cifra { background: var(--tarjeta); border: 1px solid var(--borde); border-radius: 14px; padding: 16px 18px; }
    .cl { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--tenue); white-space: nowrap; }
    .cv { font-size: 26px; font-weight: 600; letter-spacing: -0.01em; margin: 8px 0 2px; white-space: nowrap; }
    .act { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 12px; padding: 10px 22px; border-top: 1px solid var(--filete); font-size: 14px; color: var(--texto2); }
    .act strong { color: var(--texto); }
    .hora { font-size: 12px; color: var(--tenue); font-variant-numeric: tabular-nums; padding-top: 2px; }
    .acto { display: flex; gap: 14px; align-items: center; padding: 12px 22px; border-top: 1px solid var(--filete); }
    .fecha { width: 44px; flex-shrink: 0; text-align: center; }
    .dia { font-family: "Libre Caslon Text", Georgia, serif; font-size: 22px; line-height: 1.1; }
    .mes { font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--tenue); }
    .g { padding: 20px 22px; display: flex; flex-direction: column; gap: 14px; }
    .gh { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
    .gt { font-family: "Libre Caslon Text", Georgia, serif; font-weight: 400; font-size: 20px; line-height: 1.25; margin: 0; }
    .gs { font-size: 13px; color: var(--tenue); margin-top: 3px; }
    .vt { font-size: 12px; font-weight: 600; color: var(--enlace); white-space: nowrap; padding-top: 4px; }
    .ley { display: flex; flex-wrap: wrap; gap: 18px; font-size: 13px; color: var(--texto2); }
    .ley span { display: inline-flex; align-items: center; gap: 7px; }
    .ley strong { color: var(--texto); font-variant-numeric: tabular-nums; }
    .sw { width: 10px; height: 10px; border-radius: 2px; }
    .bh { display: flex; flex-direction: column; gap: 10px; }
    .bhf { display: grid; grid-template-columns: 176px minmax(0, 1fr) 82px; gap: 12px; align-items: center; font-size: 13px; }
    .bhl { color: var(--texto2); }
    .bht { height: 14px; border-left: 1px solid var(--cero); }
    .bhv { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
    .tx { font-family: "Hanken Grotesk", "Segoe UI", system-ui, sans-serif; font-size: 11px; font-variant-numeric: tabular-nums; }
`;

// ---------- piezas comunes ----------
function sidebar(rol) {
  const item = (icon, label, { activo = false, badge = null, color = '' } = {}) =>
    `<div class="item${activo ? ' activo' : ''}">${ico(icon)}<span class="lbl">${label}</span>${badge !== null ? `<span class="badge" style="background: ${color};">${badge}</span>` : ''}</div>`;
  const grupos = rol === 'redes'
    ? `<div class="etq">Hoy</div>
      <div class="grupo">${item(I.home, 'Inicio', { activo: true })}</div>
      <div class="etq">Contenido</div>
      <div class="grupo">${item(I.image, 'Portada')}${item(I.news, 'Noticias', { badge: 2, color: '#eda100' })}${item(I.book, 'Publicaciones')}</div>
      <div class="etq">Tu cuenta</div>
      <div class="grupo">${item(I.shield, 'Mi seguridad')}</div>`
    : `<div class="etq">Hoy</div>
      <div class="grupo">${item(I.home, 'Inicio', { activo: true })}</div>
      <div class="etq">Contenido</div>
      <div class="grupo">${item(I.image, 'Portada')}${item(I.news, 'Noticias', { badge: 2, color: '#eda100' })}${item(I.book, 'Publicaciones')}${item(I.cal, 'Agenda')}</div>
      <div class="etq">Hermandad</div>
      <div class="grupo">${item(I.users, 'Hermanos', { badge: 3, color: '#eda100' })}${item(I.box, 'Inventario')}</div>
      <div class="etq">Cuentas</div>
      <div class="grupo">${item(I.wallet, 'Tesorería', { badge: 14, color: '#e34948' })}${item(I.chart, 'Contabilidad')}</div>
      <div class="etq">Sistema</div>
      <div class="grupo">${item(I.clip, 'Auditoría')}${item(I.shield, 'Mi seguridad')}</div>`;
  return `<aside class="side">
    <div class="sideIn">
      <div style="padding: 0 10px;">
        <div class="serif" style="font-size: 19px; letter-spacing: 0.04em; color: #ffffff;">DESAMPARADOS</div>
        <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.14em; color: rgba(255,255,255,0.45); margin-top: 4px;">CMS</div>
      </div>
      <div class="buscar">${ico(I.search)}<span class="lbl">Buscar…</span><span class="kbd">Ctrl K</span></div>
      ${grupos}
      <div style="margin-top: auto;"></div>
      <div class="tema">
        <span class="{{clsClaro}}" onClick="{{aClaro}}">${ico(I.sun, 15)}Claro</span>
        <span class="{{clsOscuro}}" onClick="{{aOscuro}}">${ico(I.moon, 15)}Oscuro</span>
      </div>
      <div style="border-top: 1px solid rgba(255,255,255,0.08); padding: 14px 8px 0; display: flex; align-items: center; gap: 12px;">
        <div style="width: 34px; height: 34px; border-radius: 50%; background: #6e1822; color: #ffffff; font-size: 12px; font-weight: 700; display: flex; align-items: center; justify-content: center;">${rol === 'redes' ? 'R' : 'HM'}</div>
        <div style="flex-grow: 1;">
          <div style="font-size: 13px; font-weight: 600; color: #ffffff;">${rol === 'redes' ? 'Redes' : 'Hermano Mayor'}</div>
          <div style="font-size: 12px; color: rgba(255,255,255,0.45);">Cerrar sesión</div>
        </div>
      </div>
    </div>
  </aside>`;
}

const TAREAS = [
  { pill: 'Urgente', fondo: 'var(--pillUrg)', dot: '#e34948', t1: '14 recibos devueltos', t2: 'Tesorería · remesa de septiembre', accion: 'Revisar', lleva: 'Tesorería' },
  { pill: 'Pendiente', fondo: 'var(--pillPen)', dot: '#eda100', t1: '2 noticias en borrador', t2: 'Noticias · la más antigua lleva 6 días sin publicar', accion: 'Publicar', lleva: 'Redes' },
  { pill: 'Pendiente', fondo: 'var(--pillPen)', dot: '#eda100', t1: '3 hermanos sin número de hermano', t2: 'Hermanos · altas recientes', accion: 'Asignar', lleva: 'Secretaría' },
  { pill: 'Mañana', fondo: 'var(--pillNeu)', dot: 'var(--tenue)', t1: '6 citas de reparto', t2: 'Reparto · 2 turnos, capacidad para 40', accion: 'Ver turnos', lleva: 'Secretaría' },
];

const filaTarea = (t, conBoton) => `<div class="fila">
            <span class="pill" style="background: ${t.fondo};"><span class="dot" style="background: ${t.dot};"></span>${t.pill}</span>
            <div style="flex-grow: 1;"><div class="t1">${t.t1}</div><div class="t2">${t.t2}</div></div>
            ${conBoton ? `<span class="accion">${t.accion} →</span>` : `<span class="lleva">Lo lleva ${t.lleva}</span>`}
          </div>`;

function parteSuperior(rol) {
  const redes = rol === 'redes';
  const cabecera = `<div style="display: flex; justify-content: space-between; align-items: flex-end; gap: 24px;">
        <div>
          <div class="ov">Viernes, 11 de septiembre de 2026</div>
          <h1 class="serif" style="font-size: 40px; line-height: 1.15; letter-spacing: -0.01em; margin: 10px 0 8px;">Buenos días, ${redes ? 'Redes' : 'Hermano Mayor'}</h1>
          <p style="margin: 0; font-size: 16px; color: var(--texto2);">${redes
            ? 'Tienes <strong style="color: var(--texto);">2 noticias</strong> por publicar. El resto de la junta lleva 3 asuntos más.'
            : 'Tienes <strong style="color: var(--texto);">4 asuntos</strong> esperando. El lunes, Misa de hermandad.'}</p>
        </div>
        <div style="display: flex; gap: 10px;">
          ${redes ? '' : `<div class="btn btn2">${ico(I.plus)}Nuevo acto</div>
          <div class="btn btn2">${ico(I.plus)}Nuevo apunte</div>`}
          <div class="btn" style="background: #6e1822; color: #ffffff;">${ico(I.plus)}Nueva noticia</div>
        </div>
      </div>`;

  const filas = redes
    ? [filaTarea(TAREAS[1], true), '<div class="subfila">En el resto de la junta</div>', filaTarea(TAREAS[0], false), filaTarea(TAREAS[2], false), filaTarea(TAREAS[3], false)].join('\n          ')
    : TAREAS.map((t) => filaTarea(t, true)).join('\n          ');

  // Para todos los cargos, la actividad se limita a lo público (contenido y agenda);
  // la actividad completa sigue en Auditoría, que solo ven Admin y Hermano Mayor.
  const actividad = redes
    ? `<div class="card-h"><h2 class="h2">Actividad del equipo</h2><span class="suave">Contenido y agenda</span></div>
          <div class="act"><span class="hora">Hoy 10:05</span><span><strong>Secretaría</strong> añadió «Triduo a la Virgen» a la agenda</span></div>
          <div class="act"><span class="hora">Ayer 19:12</span><span><strong>Redes</strong> publicó «Horario de verano de la capilla»</span></div>
          <div class="act" style="padding-bottom: 14px;"><span class="hora">9 sep</span><span><strong>Redes</strong> cambió una foto de la portada</span></div>`
    : `<div class="card-h"><h2 class="h2">Actividad del equipo</h2><a style="font-size: 13px; font-weight: 600; text-decoration: none;">Ver auditoría →</a></div>
          <div class="act"><span class="hora">Hoy 09:40</span><span><strong>Secretaría</strong> dio de alta a un hermano</span></div>
          <div class="act"><span class="hora">Ayer 19:12</span><span><strong>Redes</strong> publicó «Horario de verano de la capilla»</span></div>
          <div class="act" style="padding-bottom: 14px;"><span class="hora">Ayer 11:05</span><span><strong>Tesorería</strong> remesó 212 recibos</span></div>`;

  return `${cabecera}

    <div style="display: grid; grid-template-columns: minmax(0, 1fr) 352px; gap: 24px; align-items: start;">
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <section class="card">
          <div class="card-h"><h2 class="h2">Para hoy</h2><span class="suave">${redes ? '1 tuyo · 3 del resto de la junta' : 'Según tu cargo · 4 asuntos'}</span></div>
          ${filas}
        </section>

        <div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px;">
          <div class="cifra"><div class="cl">Hermanos activos</div><div class="cv">1.284</div><div class="suave">+34 en doce meses</div></div>
          <div class="cifra"><div class="cl">Papeletas 2026</div><div class="cv">612</div><div class="suave">de sitio</div></div>
          <div class="cifra"><div class="cl">Por cobrar</div><div class="cv">2.130&nbsp;€</div><div class="suave">71 recibos</div></div>
          <div class="cifra"><div class="cl">Saldo 2026</div><div class="cv">12.860&nbsp;€</div><div class="suave">superávit</div></div>
        </div>

        <section class="card">
          ${actividad}
        </section>
      </div>

      <div style="display: flex; flex-direction: column; gap: 20px;">
        <section style="background: var(--inverso); color: var(--inversoTexto); border-radius: 14px; padding: 22px; transition: background-color 0.25s ease;">
          <div style="font-size: 12px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--inversoTenue);">Sábado de Pasión · 20 mar 2027</div>
          <div style="display: flex; align-items: baseline; gap: 10px; margin: 8px 0 2px;">
            <span class="serif" style="font-size: 68px; line-height: 1;">190</span>
            <span class="serif" style="font-size: 20px; color: var(--inversoTenue);">días</span>
          </div>
          <div style="font-size: 14px; color: var(--inversoTenue);">para la estación de penitencia</div>
          <div style="margin-top: 18px; height: 6px; border-radius: 3px; background: var(--inversoPista); overflow: hidden;"><div style="width: 47%; height: 100%; background: #a03d44;"></div></div>
          <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: var(--inversoTenue);"><span>28 mar 2026</span><span>47&nbsp;% del curso</span><span>20 mar 2027</span></div>
        </section>

        <section class="card">
          <div class="card-h"><h2 class="h2">Próximos actos</h2><a style="font-size: 13px; font-weight: 600; text-decoration: none;">Agenda →</a></div>
          <div class="acto"><div class="fecha"><div class="dia">14</div><div class="mes">sep</div></div><div><div class="t1">Misa de hermandad</div><div class="t2">Lunes · 20:30 · Culto</div></div></div>
          <div class="acto"><div class="fecha"><div class="dia">18</div><div class="mes">sep</div></div><div><div class="t1">Ensayo de costaleros</div><div class="t2">Viernes · 21:00 · Ensayo</div></div></div>
          <div class="acto"><div class="fecha"><div class="dia">25</div><div class="mes">sep</div></div><div><div class="t1">Cabildo general ordinario</div><div class="t2">Viernes · 20:00 · Reunión</div></div></div>
          <div class="acto" style="padding-bottom: 16px;"><div class="fecha"><div class="dia">2</div><div class="mes">oct</div></div><div><div class="t1">Triduo a la Virgen</div><div class="t2">Viernes · 20:00 · Culto</div></div></div>
        </section>
      </div>
    </div>`;
}

// ---------- gráficas ----------
const MESES12 = ['oct', 'nov', 'dic', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep'];
const ACTIVOS = [1253, 1256, 1258, 1262, 1265, 1269, 1271, 1274, 1277, 1279, 1282, 1284];
const ALTAS = [4, 3, 3, 5, 6, 7, 3, 3, 4, 2, 3, 3];
const BAJAS = [1, 0, 1, 1, 3, 3, 1, 0, 1, 0, 0, 1];
const MESES9 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep'];
const INGRESOS = [9800, 4200, 3900, 6100, 3800, 3600, 5200, 4100, 7600];
const GASTOS = [3100, 2800, 9400, 6200, 2400, 2100, 2600, 2240, 4600];

const txt = (x, y, s, { anchor = 'start', color = 'var(--tenue)', peso = 400, tam = 11 } = {}) =>
  `<text class="tx" x="${r1(x)}" y="${r1(y)}" text-anchor="${anchor}" style="fill: ${color}; font-size: ${tam}px; font-weight: ${peso};">${s}</text>`;
const linea = (x1, y1, x2, y2, color = 'var(--rejilla)') =>
  `<line x1="${r1(x1)}" y1="${r1(y1)}" x2="${r1(x2)}" y2="${r1(y2)}" style="stroke: ${color}; stroke-width: 1;"></line>`;

// Columna con el extremo de datos redondeado (4 px) y la base recta.
function columna(x, yBase, yTope, w, color, haciaAbajo = false) {
  const h = Math.abs(yBase - yTope);
  if (h < 0.5) return '';
  const r = Math.min(4, h, w / 2);
  const d = haciaAbajo
    ? `M${r1(x)},${r1(yBase)} H${r1(x + w)} V${r1(yTope - r)} Q${r1(x + w)},${r1(yTope)} ${r1(x + w - r)},${r1(yTope)} H${r1(x + r)} Q${r1(x)},${r1(yTope)} ${r1(x)},${r1(yTope - r)} Z`
    : `M${r1(x)},${r1(yBase)} V${r1(yTope + r)} Q${r1(x)},${r1(yTope)} ${r1(x + r)},${r1(yTope)} H${r1(x + w - r)} Q${r1(x + w)},${r1(yTope)} ${r1(x + w)},${r1(yTope + r)} V${r1(yBase)} Z`;
  return `<path d="${d}" style="fill: ${color};"></path>`;
}

const lienzo = (W, H, s) => `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display: block; overflow: visible;">${s}</svg>`;

function graficaCenso(W) {
  const H = 232, L = 46, R = 50, T = 18, B = 42;
  const pw = W - L - R, ph = H - T - B;
  const y0 = 1240, y1 = 1290;
  const Y = (v) => T + ph - ((v - y0) / (y1 - y0)) * ph;
  const X = (i) => L + (i * pw) / (ACTIVOS.length - 1);
  let s = '';
  for (const t of [1240, 1260, 1280]) s += linea(L, Y(t), W - R + 8, Y(t)) + txt(L - 10, Y(t) + 4, miles(t), { anchor: 'end' });
  const pts = ACTIVOS.map((v, i) => `${r1(X(i))},${r1(Y(v))}`);
  s += `<path d="M${pts.join(' L')} L${r1(X(11))},${r1(Y(y0))} L${r1(X(0))},${r1(Y(y0))} Z" style="fill: var(--enfasis); opacity: 0.08;"></path>`;
  s += `<path d="M${pts.join(' L')}" style="fill: none; stroke: var(--enfasis); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round;"></path>`;
  s += `<circle cx="${r1(X(0))}" cy="${r1(Y(ACTIVOS[0]))}" r="4" style="fill: var(--enfasis); stroke: var(--tarjeta); stroke-width: 2;"></circle>`;
  // La etiqueta inicial va debajo del punto: la línea sube hacia la derecha y por debajo no hay trazo.
  s += txt(X(0) + 8, Y(ACTIVOS[0]) + 20, '1.253', { color: 'var(--texto2)', peso: 600, tam: 12 });
  s += `<circle cx="${r1(X(11))}" cy="${r1(Y(ACTIVOS[11]))}" r="5" style="fill: var(--enfasis); stroke: var(--tarjeta); stroke-width: 2;"></circle>`;
  s += txt(X(11) + 10, Y(ACTIVOS[11]) + 4, '1.284', { color: 'var(--texto)', peso: 700, tam: 13 });
  MESES12.forEach((m, i) => { s += txt(X(i), H - B + 18, m, { anchor: 'middle' }); });
  s += txt(X(0), H - B + 33, '2025', { anchor: 'middle', color: 'var(--texto2)', peso: 600 });
  s += txt(X(3), H - B + 33, '2026', { anchor: 'middle', color: 'var(--texto2)', peso: 600 });
  return lienzo(W, H, s);
}

function graficaAltasBajas(W) {
  const H = 232, L = 34, R = 10, T = 20, B = 42;
  const pw = W - L - R, ph = H - T - B;
  const top = 10, bot = -5;
  const Y = (v) => T + ((top - v) / (top - bot)) * ph;
  const slot = pw / 12, bw = 16;
  let s = '';
  for (const t of [10, 5, -5]) s += linea(L, Y(t), W - R, Y(t)) + txt(L - 8, Y(t) + 4, t > 0 ? `+${t}` : `−${-t}`, { anchor: 'end' });
  s += linea(L, Y(0), W - R, Y(0), 'var(--cero)') + txt(L - 8, Y(0) + 4, '0', { anchor: 'end' });
  ALTAS.forEach((a, i) => {
    const x = L + slot * i + (slot - bw) / 2;
    if (a > 0) s += columna(x, Y(0) - 1, Y(a), bw, 'var(--entrada)');
    if (BAJAS[i] > 0) s += columna(x, Y(0) + 1, Y(-BAJAS[i]), bw, 'var(--salida)', true);
    s += txt(x + bw / 2, H - B + 18, MESES12[i], { anchor: 'middle' });
  });
  const xm = L + slot * 5 + slot / 2;
  s += txt(xm, Y(7) - 7, '+7', { anchor: 'middle', color: 'var(--texto)', peso: 700, tam: 12 });
  s += txt(xm, Y(-3) + 15, '−3', { anchor: 'middle', color: 'var(--texto)', peso: 700, tam: 12 });
  s += txt(L + slot * 0.5, H - B + 33, '2025', { anchor: 'middle', color: 'var(--texto2)', peso: 600 });
  s += txt(L + slot * 3.5, H - B + 33, '2026', { anchor: 'middle', color: 'var(--texto2)', peso: 600 });
  return lienzo(W, H, s);
}

const GEO_DINERO = { H: 300, L: 66, R: 12, T: 24, B: 30 };
const ranuraDinero = (W) => (W - GEO_DINERO.L - GEO_DINERO.R) / 9;

function graficaDinero(W) {
  const { H, L, R, T, B } = GEO_DINERO;
  const ph = H - T - B;
  const Y = (v) => T + ph - (v / 10000) * ph;
  const slot = ranuraDinero(W), bw = 22;
  let s = '';
  // Banda del mes señalado (marzo): es la «mira» del paso del ratón.
  s += `<rect x="${r1(L + slot * 2 + 4)}" y="${T - 10}" width="${r1(slot - 8)}" height="${r1(ph + 10)}" rx="8" style="fill: var(--banda);"></rect>`;
  for (const t of [2500, 5000, 7500, 10000]) s += linea(L, Y(t), W - R, Y(t)) + txt(L - 12, Y(t) + 4, `${miles(t)} €`, { anchor: 'end' });
  s += linea(L, Y(0), W - R, Y(0), 'var(--cero)') + txt(L - 12, Y(0) + 4, '0 €', { anchor: 'end' });
  INGRESOS.forEach((v, i) => {
    const cx = L + slot * i + slot / 2;
    s += columna(cx - bw - 1, Y(0), Y(v), bw, 'var(--entrada)');
    s += columna(cx + 1, Y(0), Y(GASTOS[i]), bw, 'var(--salida)');
    s += txt(cx, H - 8, MESES9[i], { anchor: 'middle', color: i === 2 ? 'var(--texto)' : 'var(--tenue)', peso: i === 2 ? 700 : 400, tam: 12 });
  });
  s += txt(L + slot / 2 - bw / 2 - 1, Y(9800) - 8, '9.800 €', { anchor: 'middle', color: 'var(--texto)', peso: 700, tam: 12 });
  return lienzo(W, H, s);
}

function graficaPapeletas(W) {
  const H = 232, L = 40, R = 10, T = 26, B = 30;
  const pw = W - L - R, ph = H - T - B;
  const datos = [[2022, 548], [2023, 571], [2024, 590], [2025, 604], [2026, 612]];
  const Y = (v) => T + ph - (v / 700) * ph;
  const slot = pw / datos.length, bw = 24;
  let s = '';
  // Rejilla en 250 y 500: por debajo de las cifras de las columnas, así nunca las cruza.
  for (const t of [250, 500]) s += linea(L, Y(t), W - R, Y(t)) + txt(L - 10, Y(t) + 4, String(t), { anchor: 'end' });
  s += linea(L, Y(0), W - R, Y(0), 'var(--cero)') + txt(L - 10, Y(0) + 4, '0', { anchor: 'end' });
  datos.forEach(([anio, v], i) => {
    const x = L + slot * i + (slot - bw) / 2;
    const actual = anio === 2026;
    s += columna(x, Y(0), Y(v), bw, actual ? 'var(--enfasis)' : 'var(--contexto)');
    s += txt(x + bw / 2, Y(v) - 8, String(v), { anchor: 'middle', color: actual ? 'var(--texto)' : 'var(--texto2)', peso: actual ? 700 : 600, tam: 12 });
    s += txt(x + bw / 2, H - 8, String(anio), { anchor: 'middle', color: actual ? 'var(--texto)' : 'var(--tenue)', peso: actual ? 700 : 400, tam: 12 });
  });
  return lienzo(W, H, s);
}

function barrasH(filas, color, fmtValor) {
  const max = Math.max(...filas.map((f) => f[1]));
  return `<div class="bh">${filas.map(([l, v]) => `
            <div class="bhf"><span class="bhl">${l}</span><div class="bht"><div style="width: ${r1((v / max) * 100)}%; height: 100%; background: ${color}; border-radius: 0 4px 4px 0;"></div></div><span class="bhv">${fmtValor(v)}</span></div>`).join('')}
          </div>`;
}

const tarjeta = (titulo, sub, cuerpo, span = 6) => `<section class="card g" style="grid-column: span ${span};">
          <div class="gh"><div><h3 class="gt">${titulo}</h3><div class="gs">${sub}</div></div><span class="vt">Ver tabla</span></div>
          ${cuerpo}
        </section>`;

function seccionDatos() {
  // El tooltip se coloca con la misma geometría que la gráfica: a la derecha de la banda de marzo,
  // bajo de altura para no tapar las columnas de abril.
  const izquierdaTooltip = Math.round(GEO_DINERO.L + ranuraDinero(ANCHO_ENTERA) * 3 + 6);
  const tooltipMarzo = `<div style="position: absolute; left: ${izquierdaTooltip}px; top: 26px; width: 188px; background: var(--emergente); border: 1px solid var(--emergenteBorde); border-radius: 10px; padding: 10px 12px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3); font-size: 13px; box-sizing: border-box;">
            <div style="font-size: 12px; font-weight: 600; color: var(--tenue); margin-bottom: 6px;">Marzo · déficit de 5.500&nbsp;€</div>
            <div style="display: flex; align-items: center; gap: 8px;"><span style="width: 12px; height: 2px; background: var(--entrada);"></span><strong style="font-variant-numeric: tabular-nums;">3.900&nbsp;€</strong><span style="color: var(--tenue);">Ingresos</span></div>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;"><span style="width: 12px; height: 2px; background: var(--salida);"></span><strong style="font-variant-numeric: tabular-nums;">9.400&nbsp;€</strong><span style="color: var(--tenue);">Gastos</span></div>
          </div>`;

  const recibos = `<div>
            <div style="display: flex; align-items: baseline; gap: 10px;"><span style="font-size: 44px; font-weight: 600; letter-spacing: -0.02em; line-height: 1;">94&nbsp;%</span><span class="gs">cobrado · 1.126 de 1.197 recibos</span></div>
            <div style="display: flex; gap: 2px; height: 14px; border-radius: 7px; overflow: hidden; margin: 16px 0 14px;">
              <div style="width: 94.1%; background: #1baf7a;"></div><div style="width: 4.8%; background: #eda100;"></div><div style="width: 1.2%; min-width: 6px; background: #e34948;"></div>
            </div>
            <div style="display: grid; grid-template-columns: 22px minmax(0, 1fr) 70px 92px; row-gap: 10px; column-gap: 10px; align-items: center; font-size: 14px;">
              <span style="color: #1baf7a; display: flex;">${ico(I.ok, 18)}</span><span style="color: var(--texto2);">Cobrados</span><strong style="text-align: right; font-variant-numeric: tabular-nums;">1.126</strong><span style="text-align: right; color: var(--texto2); font-variant-numeric: tabular-nums;">33.780&nbsp;€</span>
              <span style="color: #eda100; display: flex;">${ico(I.clock, 18)}</span><span style="color: var(--texto2);">Pendientes</span><strong style="text-align: right; font-variant-numeric: tabular-nums;">57</strong><span style="text-align: right; color: var(--texto2); font-variant-numeric: tabular-nums;">1.710&nbsp;€</span>
              <span style="color: #e34948; display: flex;">${ico(I.alert, 18)}</span><span style="color: var(--texto2);">Devueltos por el banco</span><strong style="text-align: right; font-variant-numeric: tabular-nums;">14</strong><span style="text-align: right; color: var(--texto2); font-variant-numeric: tabular-nums;">420&nbsp;€</span>
            </div>
          </div>`;

  return `<section style="display: flex; flex-direction: column; gap: 20px; border-top: 1px solid var(--filete); padding-top: 32px; margin-top: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end;">
        <div><div class="ov">La hermandad en datos · igual para toda la junta</div><h2 class="serif" style="font-size: 30px; line-height: 1.2; margin: 8px 0 0;">Cómo va el año</h2></div>
        <span class="suave">Solo cifras de conjunto: aquí nunca aparecen datos de una persona.</span>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <span class="btn btn2" style="height: 34px; font-size: 13px;">Ejercicio 2026 ${ico(I.chevron, 14)}</span>
        <span class="suave">El censo se mide en los últimos 12 meses; el dinero, en el ejercicio.</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 20px;">
        ${tarjeta('Censo de hermanos', 'Hermanos activos al cierre de cada mes', `<div class="ley"><span>Al cierre de septiembre, <strong>1.284</strong>; en octubre eran 1.253.</span></div>
          ${graficaCenso(ANCHO_MEDIA)}`)}
        ${tarjeta('Altas y bajas', 'Cuántos entran y cuántos se van cada mes', `<div class="ley"><span><span class="sw" style="background: var(--entrada);"></span>Altas <strong>46</strong></span><span><span class="sw" style="background: var(--salida);"></span>Bajas <strong>12</strong></span><span>Marzo, el mes con más movimiento</span></div>
          ${graficaAltasBajas(ANCHO_MEDIA)}`)}

        ${tarjeta('Ingresos y gastos por mes', 'Lo que entra y lo que sale cada mes de 2026. En marzo y abril (Cuaresma y Semana Santa, del 29 de marzo al 5 de abril) se gasta más de lo que entra.', `<div class="ley"><span><span class="sw" style="background: var(--entrada);"></span>Ingresos <strong>48.300&nbsp;€</strong></span><span><span class="sw" style="background: var(--salida);"></span>Gastos <strong>35.440&nbsp;€</strong></span><span>Superávit <strong>12.860&nbsp;€</strong></span></div>
          <div style="position: relative;">
            ${graficaDinero(ANCHO_ENTERA)}
            ${tooltipMarzo}
          </div>`, 12)}

        ${tarjeta('En qué se gasta', 'Gastos de 2026 por categoría contable', barrasH([
          ['Estación de penitencia', 11200], ['Cultos y liturgia', 9800], ['Caridad', 5400],
          ['Mantenimiento y enseres', 4300], ['Administración', 2740], ['Otros', 2000],
        ], 'var(--salida)', eur))}
        ${tarjeta('Cobro de recibos', 'Recibos del ejercicio 2026 según su estado', recibos)}

        ${tarjeta('Papeletas de sitio', 'Últimos cinco años · +12&nbsp;% desde 2022', `${graficaPapeletas(ANCHO_MEDIA)}
          <div class="gs" style="margin-top: 0;">En 2026: 418 nazarenos · 96 costaleros · 58 acólitos · 40 insignias.</div>`)}
        ${tarjeta('Hermanos por edad', 'Hermanos activos por tramo de edad', barrasH([
          ['0 a 17 años', 164], ['18 a 30', 198], ['31 a 45', 312], ['46 a 60', 351], ['61 o más', 259],
        ], 'var(--neutro)', (v) => miles(v)))}
      </div>
    </section>`;
}

// ---------- documento ----------
function documento({ tema, rol, alto, conDatos }) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&amp;family=Libre+Caslon+Text:ital,wght@0,400;0,700;1,400&amp;display=swap">
  <style>${ESTILOS}  </style>
</helmet>
<div class="{{clsRaiz}}" style="width: 1440px; height: ${alto}px; display: flex; overflow: hidden;">
  ${sidebar(rol)}

  <main style="flex-grow: 1; min-width: 0; padding: 36px 44px 44px; display: flex; flex-direction: column; gap: 26px;">
    ${parteSuperior(rol)}
    ${conDatos ? seccionDatos() : ''}
  </main>
</div>
</x-dc>
<script data-dc-script data-props='{"tema":{"editor":"enum","options":["oscuro","claro"],"default":"${tema}"},"$preview":{"width":1440,"height":${alto}}}'>
class Component extends DCLogic {
  renderVals() {
    const elegido = this.state && this.state.tema;
    const tema = elegido || this.props.tema || '${tema}';
    return {
      clsRaiz: 'raiz ' + tema,
      clsClaro: tema === 'claro' ? 'seg on' : 'seg',
      clsOscuro: tema === 'oscuro' ? 'seg on' : 'seg',
      aClaro: () => this.setState({ tema: 'claro' }),
      aOscuro: () => this.setState({ tema: 'oscuro' }),
    };
  }
}
</script>
</body>
</html>
`;
}

const salidas = [
  ['JuntaInicio.dc.html', { tema: 'oscuro', rol: 'hm', alto: ALTO_COMPLETO, conDatos: true }],
  ['JuntaInicioClaro.dc.html', { tema: 'claro', rol: 'hm', alto: ALTO_COMPLETO, conDatos: true }],
  ['JuntaRedes.dc.html', { tema: 'claro', rol: 'redes', alto: 900, conDatos: false }],
];
for (const [nombre, opciones] of salidas) {
  const html = documento(opciones);
  writeFileSync(join(DIR, nombre), html);
  console.log(`${nombre}: ${(html.length / 1024).toFixed(1)} KB`);
}
