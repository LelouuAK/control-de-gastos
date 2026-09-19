// Pestaña «Mes»: el tablero de un mes (o la suma de todos). Sale de la hoja «Control Mensual» y suma
// el crucero y el gasto personal de la hoja «Plan de Ahorro» para ver todo lo del mes en un solo lugar.
import { html, aviso } from '../ui.js';
import { tablero, extrasDelMes } from '../calc.js';
import { cambiar, obtener } from '../store.js';
import { dinero, nombreMes, nombreMesAnio, abreviaturaMes, mesDeHoy, mesSiguiente, diasEnMes, hoyISO, uid } from '../format.js';
import { hacerRespaldo, respaldoPendiente } from '../respaldo.js';
import { filaExtra } from './extras.js';

export const id = 'mes';
export const titulo = 'Control mensual';

const guion = { guionSiCero: true };
const enMinuscula = (mesId) => nombreMes(mesId).toLowerCase();
const avance = (hechos, total, uno, varios) => `${hechos} de ${total} ${total === 1 ? uno : varios}`;

function vencido(mesId, dia) {
  const actual = mesDeHoy();
  if (mesId !== actual) return mesId < actual;
  return new Date().getDate() > Math.min(dia, diasEnMes(mesId));
}

// Un pago fijo vence si sigue Pendiente y su día del mes ya pasó.
const vence = (mesId, dia, estado, monto) => monto > 0 && estado === 'Pendiente' && vencido(mesId, dia);
const notaPago = (mesId, dia, estado, monto) => (vence(mesId, dia, estado, monto) ? `Venció el día ${dia}` : `Se paga el día ${dia}`);
const notaExtras = (pendientes, total) => (total > 0 ? (pendientes > 0 ? `${dinero(pendientes)} pendiente` : 'Todos pagados') : '');

// Fila con monto y selector Pendiente / Pagado. `accion` y `campo` dicen a qué dato se aplica el cambio.
function filaEstado({ nombre, nota, alerta = false, monto, estado, accion, campo = '' }) {
  const boton = (valor, clase) =>
    html`<button type="button" class="${clase}" aria-pressed="${String(estado === valor)}" data-accion="${accion}" data-campo="${campo}" data-valor="${valor}">${valor}</button>`;
  return html`
    <div class="fila fila-pago">
      <div class="et">${nombre}<small class="${alerta ? 'vence' : ''}">${nota}</small></div>
      <div class="val">${dinero(monto)}</div>
      <div class="seg" role="group" aria-label="Estado de ${nombre}">${boton('Pendiente', 'pend')}${boton('Pagado', 'pag')}</div>
    </div>`;
}

// Fila de solo lectura (montos sueltos, subtotales y la vista Total). `total` la marca como resultado.
const fila = (nombre, valor, { nota = '', total = false, opciones } = {}) =>
  html`<div class="fila ${total && 'total'}"><span class="et">${nombre}${nota && html`<small>${nota}</small>`}</span><span class="val ${valor < 0 ? 'neg' : ''}">${dinero(valor, opciones)}</span></div>`;

// Cómo se reparte el salario: ya pagado, por pagar y lo que te queda.
function cinta(d) {
  const libre = Math.max(d.libre, 0);
  const base = Math.max(d.salario, d.gastos);
  const partes = [['pag', d.pagado], ['por', d.pendiente], ['libre', libre]].filter(([, v]) => v > 0.005);
  return html`
    <div class="cinta" role="img" aria-label="Del salario: ${dinero(d.pagado)} ya pagado, ${dinero(d.pendiente)} por pagar, ${dinero(libre)} te queda">
      ${base > 0 && partes.map(([clase, v]) => html`<i class="${clase}" style="flex-grow:${v / base}"></i>`)}
    </div>
    <ul class="leyenda">
      <li><span><i class="pag"></i>Ya pagado</span><b>${dinero(d.pagado)}</b></li>
      <li><span><i class="por"></i>Por pagar</span><b>${dinero(d.pendiente, guion)}</b></li>
      <li><span><i class="libre"></i>Te queda</span><b>${dinero(libre)}</b></li>
    </ul>`;
}

const avisoInicial = (estado) =>
  estado.config.salario === 0 &&
  html`<section class="bienvenida">
    <h2>Carga tus datos</h2>
    <p>La app está en blanco. Importa el archivo con tus datos del Excel, o escribe tu salario y pagos en Config.</p>
    <div class="grupo">
      <label class="fila accion">Importar archivo de datos<input type="file" class="oculto" accept=".json,application/json" data-cambio="restaurar"></label>
      <a class="fila accion" href="#config">Ir a Config</a>
    </div>
  </section>`;

const avisoRespaldo = (estado) =>
  estado.config.salario !== 0 &&
  respaldoPendiente(estado) &&
  html`<section class="bienvenida">
    <h2>Guarda un respaldo</h2>
    <p>Tus datos viven solo en este iPhone. Si borras la app sin respaldo, se pierden.</p>
    <div class="grupo"><button type="button" class="fila accion" data-accion="respaldar">Respaldar ahora</button></div>
  </section>`;

// Un mes: cada pago con su estado, y los subtotales que llevan al ahorro.
function detalleMes(estado, f) {
  const extras = extrasDelMes(estado, f.id);
  const mes = enMinuscula(f.id);
  const mostrarCrucero = f.crucero > 0 || f.cruceroPagado;
  return html`
    <h2 class="grupo-t">Pagos de ${mes}</h2>
    <div class="grupo">
      ${fila('Salario', f.salario)}
      ${filaEstado({ nombre: 'Plan móvil', nota: notaPago(f.id, estado.config.movilDia, f.estadoMovil, f.movil), alerta: vence(f.id, estado.config.movilDia, f.estadoMovil, f.movil), monto: f.movil, estado: f.estadoMovil, accion: 'mes-estado', campo: 'movil' })}
      ${filaEstado({ nombre: 'Abuelos', nota: notaPago(f.id, estado.config.abuelosDia, f.estadoAbuelos, f.abuelos), alerta: vence(f.id, estado.config.abuelosDia, f.estadoAbuelos, f.abuelos), monto: f.abuelos, estado: f.estadoAbuelos, accion: 'mes-estado', campo: 'abuelos' })}
      ${fila('Extras', f.extras, { opciones: guion, nota: notaExtras(f.extrasPendientes, f.extras) })}
      ${extras.map((x) => filaExtra(x, true))}
      <button type="button" class="fila accion" data-accion="extra-nuevo">+ Anotar extra</button>
      ${fila('Saldo libre', f.saldo, { total: true, nota: 'Salario menos pagos y extras' })}
    </div>

    ${f.enPlan && (mostrarCrucero || f.personal > 0) &&
    html`<h2 class="grupo-t">Crucero y gastos personales</h2>
      <div class="grupo">
        ${mostrarCrucero && filaEstado({ nombre: 'Crucero', nota: `Cuota de ${mes}`, monto: f.crucero, estado: f.cruceroPagado ? 'Pagado' : 'Pendiente', accion: 'mes-crucero' })}
        ${f.personal > 0 && filaEstado({ nombre: 'Gastos personales', nota: 'Estimado del mes', monto: f.personal, estado: f.personalPagado ? 'Pagado' : 'Pendiente', accion: 'mes-personal' })}
        ${fila('Ahorro del mes', f.libre, { total: true, nota: 'Saldo libre menos crucero y gastos personales' })}
      </div>`}
  `;
}

// La suma de todos los meses, con la misma forma que un mes (sin selectores: se cambian mes por mes).
function detalleTotal(t, meses) {
  return html`
    <h2 class="grupo-t">Pagos de todos los meses</h2>
    <div class="grupo">
      ${fila('Salario', t.salario)}
      ${fila('Plan móvil', t.movil, { nota: avance(t.mesesMovilPagados, meses, 'mes pagado', 'meses pagados') })}
      ${fila('Abuelos', t.abuelos, { nota: avance(t.mesesAbuelosPagados, meses, 'mes pagado', 'meses pagados') })}
      ${fila('Extras', t.extras, { opciones: guion, nota: notaExtras(t.extrasPendientes, t.extras) })}
      ${fila('Saldo libre', t.saldo, { total: true, nota: 'Salario menos pagos y extras' })}
    </div>
    ${t.mesesPlan > 0 &&
    html`<h2 class="grupo-t">Crucero y gastos personales</h2>
      <div class="grupo">
        ${t.cuotas > 0 && fila('Crucero', t.crucero, { nota: avance(t.cuotasPagadas, t.cuotas, 'cuota pagada', 'cuotas pagadas') })}
        ${t.personal > 0 && fila('Gastos personales', t.personal, { nota: avance(t.mesesPersonalPagados, t.mesesPlan, 'mes pagado', 'meses pagados') })}
        ${fila('Te queda en total', t.libre, { total: true, nota: t.mesesPlan < meses ? 'Incluye los meses anteriores al plan de ahorro' : 'Saldo libre menos crucero y gastos personales' })}
      </div>`}
  `;
}

export function render(estado, ui) {
  const { filas, totales: t } = tablero(estado);
  const f = filas.find((x) => x.id === ui.mesSel) ?? filas.at(-1);
  const d = ui.total ? t : f; // lo que alimenta la cifra grande y la cinta
  const anioActual = mesDeHoy().slice(0, 4);
  const etiqueta = ui.total ? 'Te queda en total' : `Te queda en ${enMinuscula(f.id)}`;
  return html`
    <h1 class="titulo">${titulo}</h1>
    ${avisoInicial(estado)}${avisoRespaldo(estado)}
    <nav class="meses" aria-label="Mes">
      <button type="button" class="chip total" aria-current="${String(ui.total)}" data-accion="mes-total">Total</button>
      ${filas.map((m) => html`<button type="button" class="chip" aria-current="${String(!ui.total && m.id === f.id)}" data-accion="mes-sel" data-id="${m.id}">${abreviaturaMes(m.id)}${m.id.slice(0, 4) !== anioActual ? ` ’${m.id.slice(2, 4)}` : ''}</button>`)}
      <button type="button" class="chip mas" data-accion="mes-mas">+ Mes</button>
    </nav>
    <section class="hero">
      <p class="hero-et">${etiqueta}</p>
      <p class="hero-num ${d.libre < 0 ? 'neg' : ''}">${dinero(d.libre)}</p>
      ${cinta(d)}
    </section>
    ${ui.total ? detalleTotal(t, filas.length) : detalleMes(estado, f)}
    <p class="nota">Por pagar es lo que sigue en Pendiente: pagos fijos, extras, crucero y gastos personales.</p>
    ${!ui.total && f.id === filas.at(-1).id && filas.length > 1 && html`<button type="button" class="enlace peligro" data-accion="mes-quitar">Quitar ${enMinuscula(f.id)}</button>`}
  `;
}

export const acciones = {
  'mes-total': (el, ui) => {
    ui.total = true;
  },
  'mes-sel': (el, ui) => {
    ui.total = false;
    ui.mesSel = el.dataset.id;
  },
  'mes-mas': (el, ui) => {
    const nuevo = mesSiguiente(obtener().meses.at(-1).id);
    cambiar((e) => e.meses.push({ id: nuevo, movil: 'Pendiente', abuelos: 'Pendiente', personal: 'Pendiente', ahorroReal: null }));
    ui.total = false;
    ui.mesSel = nuevo;
    aviso(`${nombreMesAnio(nuevo)} agregado`);
  },
  'mes-estado': (el, ui) =>
    cambiar((e) => {
      e.meses.find((m) => m.id === ui.mesSel)[el.dataset.campo] = el.dataset.valor;
    }),
  'mes-personal': (el, ui) =>
    cambiar((e) => {
      e.meses.find((m) => m.id === ui.mesSel).personal = el.dataset.valor;
    }),
  // Pagar la cuota del crucero registra el abono de ese mes; volver a Pendiente lo quita. Así Mes y Crucero siempre coinciden.
  'mes-crucero': (el, ui) => {
    const estado = obtener();
    const f = tablero(estado).filas.find((x) => x.id === ui.mesSel);
    const pagar = el.dataset.valor === 'Pagado';
    if (pagar === f.cruceroPagado) return false;
    const mes = enMinuscula(ui.mesSel);
    if (pagar) {
      const abono = { id: uid(), fecha: hoyISO(), monto: Math.round(f.crucero * 100) / 100, nota: '', mes: ui.mesSel };
      cambiar((e) => e.abonos.push(abono));
      aviso(`Cuota de ${mes} pagada: se registró el abono`, { accion: 'Deshacer', alAccion: () => cambiar((e) => { e.abonos = e.abonos.filter((a) => a.id !== abono.id); }) });
    } else {
      const quitados = estado.abonos.filter((a) => a.mes === ui.mesSel);
      cambiar((e) => {
        e.abonos = e.abonos.filter((a) => a.mes !== ui.mesSel);
      });
      aviso(`Cuota de ${mes} pendiente: se quitó el abono`, { accion: 'Deshacer', alAccion: () => cambiar((e) => e.abonos.push(...quitados)) });
    }
  },
  'mes-quitar': (el, ui) => {
    const estado = obtener();
    const mes = estado.meses.find((m) => m.id === ui.mesSel);
    if (extrasDelMes(estado, mes.id).length) {
      aviso('Este mes tiene extras. Bórralos primero.');
      return false;
    }
    if (estado.abonos.some((a) => a.mes === mes.id)) {
      aviso('Este mes tiene una cuota del crucero pagada. Quítala primero.');
      return false;
    }
    cambiar((e) => {
      e.meses = e.meses.filter((m) => m.id !== mes.id);
    });
    aviso(`${nombreMesAnio(mes.id)} quitado`, {
      accion: 'Deshacer',
      alAccion: () =>
        cambiar((e) => {
          e.meses.push(mes);
          e.meses.sort((a, b) => a.id.localeCompare(b.id));
        }),
    });
  },
  respaldar: () => {
    hacerRespaldo();
    return false;
  },
};
