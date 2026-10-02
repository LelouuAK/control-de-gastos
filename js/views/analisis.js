// Análisis: Resumen (el periodo con contexto), Histórico (mes a mes y el año) y Comparar (contra el tramo anterior).
import { html, barra, opcionesSelect } from '../ui.js';
import { resumenMes, resumenObjetivos } from '../calc.js';
import { resumenAnalisis, comparar, lecturaDelMes, prevision, paraObjetivosEsteMes } from '../finanzas.js';
import { abreviaturaMes, dinero, fechaHumana, hoyISO, nombreMes } from '../format.js';
import { filaMovimiento } from './piezas.js';

export const id = 'analisis';
export const titulo = 'Análisis';

const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const conSigno = (x) => (x == null ? '—' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(Math.round(x * 100))}%`);
const pestanas = (ui) => html`<div class="seg-nav" role="tablist">
  ${[
    ['resumen', 'Resumen'],
    ['historico', 'Histórico'],
    ['comparar', 'Comparar'],
  ].map(([v, t]) => html`<button type="button" role="tab" aria-selected="${ui.analisisTab === v}" data-accion="an-tab" data-tab="${v}">${t}</button>`)}
</div>`;
const chips = (lista, valor, accion) => html`<div class="chips">${lista.map(([v, t]) => html`<button type="button" class="chip" aria-pressed="${valor === v}" data-accion="${accion}" data-valor="${v}">${t}</button>`)}</div>`;

// Categorías desplegables: al tocar una se ven sus movimientos.
function categorias(estado, grupos, total) {
  return html`<div class="grupo">${grupos.map(
    (g) => html`<details class="cat-det">
      <summary class="fila"><span class="ico">${g.categoria?.icono ?? '•'}</span>
        <span class="et">${g.categoria?.nombre ?? 'Sin categoría'}<small>${g.n} ${g.n === 1 ? 'movimiento' : 'movimientos'}, ${Math.round((total ? g.total / total : 0) * 100)}%</small>${barra(total ? g.total / total : 0, g.movs[0]?.tipo === 'ingreso' ? 'objetivo' : 'gasto')}</span>
        <span class="val">${dinero(g.total)}</span></summary>
      <div class="cat-movs">${g.movs.map((m) => filaMovimiento(estado, m, { conFecha: true }))}</div>
    </details>`,
  )}</div>`;
}

function resumen(estado, ui) {
  const hoy = hoyISO();
  const r = resumenAnalisis(estado, ui.periodo, hoy, ui.cuentaAnalisis);
  const meta = estado.ajustes.metaAhorroPct;
  const maximo = Math.max(r.ingresos, r.gastos, 0.01);
  const plan = prevision(estado, hoy, 30);
  const objetivos = paraObjetivosEsteMes(estado, hoy);
  const ro = resumenObjetivos(estado, hoy);
  const nombrePeriodo = { mes: 'del mes', '3meses': 'de los últimos 3 meses', anio: 'del año' }[ui.periodo];
  return html`
    ${chips(
      [
        ['mes', 'Este mes'],
        ['3meses', '3 meses'],
        ['anio', 'Este año'],
      ],
      ui.periodo,
      'an-periodo',
    )}
    <label class="fila filtro-cuenta"><span class="et">Cuenta</span><select data-cambio="an-cuenta">${opcionesSelect([['', 'Todas'], ...estado.cuentas.map((c) => [c.id, c.nombre])], ui.cuentaAnalisis)}</select></label>

    <section class="tarjeta-balance">
      <p class="hero-et">Balance ${nombrePeriodo}</p>
      <p class="hero-num ${r.balance < 0 ? 'neg' : ''}">${dinero(r.balance, { signo: true })}</p>
      <p class="hero-sub">${r.n === 0 ? 'Sin movimientos en este periodo.' : r.balance >= 0 ? 'Entra más de lo que sale.' : 'Sale más de lo que entra.'}</p>
      <div class="comparativa">
        <span>Ingresos</span>${barra(r.ingresos / maximo, 'objetivo')}<b class="ingreso">${dinero(r.ingresos)}</b>
        <span>Gastos</span>${barra(r.gastos / maximo, 'gasto')}<b>${dinero(r.gastos)}</b>
      </div>
    </section>

    <div class="kpis">
      <div><small>Ahorraste</small><b class="${r.tasaAhorro != null && r.tasaAhorro >= meta ? 'ingreso' : ''}">${pct(r.tasaAhorro)}</b><span>Tu meta: ${pct(meta)}</span></div>
      <div><small>Gasto por día</small><b>${dinero(r.gastoDiario)}</b><span>Media de ${r.periodo.transcurridos} ${r.periodo.transcurridos === 1 ? 'día' : 'días'}</span></div>
      ${r.proyeccion != null
        ? html`<div><small>Gasto al cerrar el mes</small><b>${dinero(r.proyeccion)}</b><span>Con pagos pendientes y tu ritmo</span></div>`
        : html`<div><small>Movimientos</small><b>${r.n}</b><span>En el periodo</span></div>`}
      <div><small>Gastos frente al anterior</small><b class="${r.cambioGastos > 0 ? 'neg' : r.cambioGastos < 0 ? 'ingreso' : ''}">${conSigno(r.cambioGastos)}</b><span>${r.anterior.gastos > 0 ? `Antes: ${dinero(r.anterior.gastos)}` : 'Sin referencia anterior'}</span></div>
    </div>

    ${ui.periodo === 'mes' &&
    !ui.cuentaAnalisis &&
    lecturaDelMes(estado, hoy).length > 0 &&
    html`<h2 class="grupo-t">Lo importante de este mes</h2>
      <ol class="lectura">${lecturaDelMes(estado, hoy).map((f) => html`<li>${f}</li>`)}</ol>`}

    <h2 class="grupo-t con-enlace"><span>Próximos 30 días</span><a href="#centro">Previsión</a></h2>
    <div class="grupo">
      <div class="fila"><span class="et">Por cobrar</span><span class="val ingreso">+${dinero(plan.cobros)}</span></div>
      <div class="fila"><span class="et">Por pagar<small>Pagos fijos y cuotas, con lo atrasado</small></span><span class="val">−${dinero(plan.pagos)}</span></div>
      <div class="fila"><span class="et">Para tus objetivos<small>Lo que toca apartar este mes</small></span><span class="val">−${dinero(objetivos)}</span></div>
      <div class="fila total"><span class="et">Queda después del plan</span><span class="val ${plan.cobros - plan.pagos - objetivos < 0 ? 'neg' : ''}">${dinero(plan.cobros - plan.pagos - objetivos)}</span></div>
    </div>

    ${estado.objetivos.length > 0 &&
    html`<h2 class="grupo-t con-enlace"><span>Objetivos de ahorro</span><a href="#objetivos">Ver todos</a></h2>
      <div class="grupo"><a class="fila" href="#objetivos"><span class="et">${dinero(ro.ahorrado)} de ${dinero(ro.meta)}<small>${estado.objetivos.length} ${estado.objetivos.length === 1 ? 'objetivo' : 'objetivos'}</small>${barra(ro.avance, 'objetivo')}</span><span class="val">${pct(ro.avance)}</span></a></div>`}

    <h2 class="grupo-t">Dónde se va tu dinero</h2>
    ${r.gastosPorCategoria.length ? categorias(estado, r.gastosPorCategoria.slice(0, 8), r.gastos) : html`<p class="fila-vacia">No hay gastos en este periodo.</p>`}

    <div class="grupo separado herramientas">
      <a class="fila" href="#planificacion"><span class="ico">🧭</span><span class="et">Planificación<small>Cuánto puedes gastar, límites y avisos</small></span><span class="flecha"></span></a>
      <a class="fila" href="#centro"><span class="ico">🩺</span><span class="et">Centro financiero<small>Salud financiera, fondo de emergencia y previsión</small></span><span class="flecha"></span></a>
    </div>`;
}

function historico(estado, ui) {
  const anio = ui.anio;
  const meses = Array.from({ length: 12 }, (_, i) => `${anio}-${String(i + 1).padStart(2, '0')}`);
  const mesSel = ui.mes.startsWith(String(anio)) ? ui.mes : meses[hoyISO().startsWith(String(anio)) ? Number(hoyISO().slice(5, 7)) - 1 : 0];
  const r = resumenMes(estado, mesSel);
  const anual = meses.map((m) => ({ id: m, ...resumenMes(estado, m) }));
  const tot = { ingresos: anual.reduce((s, m) => s + m.ingresos, 0), gastos: anual.reduce((s, m) => s + m.gastos, 0) };
  const maximo = Math.max(0.01, ...anual.flatMap((m) => [m.ingresos, m.gastos]));
  return html`
    <div class="nav-mes">
      <button type="button" data-accion="an-anio" data-paso="-1" aria-label="Año anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
      <span>${anio}</span>
      <button type="button" data-accion="an-anio" data-paso="1" aria-label="Año siguiente"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
    </div>
    <div class="meses-rejilla">${meses.map((m) => html`<button type="button" aria-pressed="${m === mesSel}" data-accion="an-mes" data-mes="${m}">${abreviaturaMes(m)}</button>`)}</div>

    <h2 class="grupo-t">${nombreMes(mesSel)} de ${anio}</h2>
    <div class="balance">
      <div><small>Ingresos</small><b class="ingreso">${dinero(r.ingresos)}</b></div>
      <div><small>Gastos</small><b>${dinero(r.gastos)}</b></div>
      <div><small>Ahorro</small><b class="${r.balance < 0 ? 'neg' : ''}">${dinero(r.balance)}</b></div>
    </div>
    ${r.ingresosPorCategoria.length > 0 && html`<h2 class="grupo-t">Ingresos por categoría</h2>${categorias(estado, r.ingresosPorCategoria, r.ingresos)}`}
    ${r.gastosPorCategoria.length > 0 ? html`<h2 class="grupo-t">Gastos por categoría</h2>${categorias(estado, r.gastosPorCategoria, r.gastos)}` : html`<p class="fila-vacia separado">No hay gastos en ${nombreMes(mesSel).toLowerCase()}.</p>`}

    <h2 class="grupo-t">Resumen de ${anio}</h2>
    <div class="balance">
      <div><small>Ingresos</small><b class="ingreso">${dinero(tot.ingresos)}</b></div>
      <div><small>Gastos</small><b>${dinero(tot.gastos)}</b></div>
      <div><small>Ahorro</small><b class="${tot.ingresos - tot.gastos < 0 ? 'neg' : ''}">${dinero(tot.ingresos - tot.gastos)}</b></div>
    </div>
    <h2 class="grupo-t">Mes a mes</h2>
    <div class="grupo">${anual.map(
      (m) => html`<button type="button" class="fila anual ${m.id === mesSel ? 'sel' : ''}" data-accion="an-mes" data-mes="${m.id}">
        <span class="anual-mes">${abreviaturaMes(m.id)}</span>
        <span class="anual-barras">${barra(m.ingresos / maximo, 'objetivo')}${barra(m.gastos / maximo, 'gasto')}</span>
        <span class="val ${m.balance < 0 ? 'neg' : m.n ? '' : 'suave'}">${m.n ? dinero(m.balance, { signo: true }) : '—'}</span>
      </button>`,
    )}</div>`;
}

function comparacion(estado, ui) {
  const c = comparar(estado, ui.modoComparar, hoyISO());
  const rango = (r) => `${fechaHumana(r.desde)}${r.desde === r.hasta ? '' : ` – ${fechaHumana(r.hasta)}`}`;
  const fila = (nombre, f, invertir = false) => {
    const malo = invertir ? f.diferencia > 0 : f.diferencia < 0;
    return html`<div class="comp-fila"><span class="comp-nombre">${nombre}</span>
      <span class="comp-act"><small>Ahora</small><b>${dinero(f.actual)}</b></span>
      <span class="comp-ant"><small>Antes</small>${dinero(f.anterior)}</span>
      <span class="comp-dif ${f.diferencia === 0 ? '' : malo ? 'neg' : 'ingreso'}">${dinero(f.diferencia, { signo: true })}${f.cambio != null && f.diferencia !== 0 && html`<small>${conSigno(f.cambio)}</small>`}</span></div>`;
  };
  return html`
    <p class="nota sin-margen">Compara lo que entra y sale ahora con el mismo número de días justo antes.</p>
    ${chips(
      [
        ['7', '7 días'],
        ['14', '14 días'],
        ['mes', 'Este mes'],
      ],
      ui.modoComparar,
      'an-comparar',
    )}
    <div class="rangos"><div><small>Ahora</small><b>${rango(c.actual)}</b><span>${c.actual.dias} días</span></div><span class="vs">frente a</span><div><small>Antes</small><b>${rango(c.anterior)}</b><span>${c.anterior.dias} días</span></div></div>
    <div class="grupo comp">${fila('Ingresos', c.ingresos)}${fila('Gastos', c.gastos, true)}${fila('Balance', c.balance)}</div>
    <h2 class="grupo-t">Gastos por categoría</h2>
    ${c.categorias.length
      ? html`<div class="grupo">${c.categorias.map(
          (g) => html`<details class="cat-det">
            <summary class="fila"><span class="ico">${g.categoria?.icono ?? '•'}</span>
              <span class="et">${g.categoria?.nombre ?? 'Sin categoría'}<small>${dinero(g.actual)} ahora, ${dinero(g.anterior)} antes</small></span>
              <span class="val ${g.diferencia > 0 ? 'neg' : g.diferencia < 0 ? 'ingreso' : ''}">${dinero(g.diferencia, { signo: true })}<small class="cambio">${g.nueva ? 'Nueva' : g.cambio == null ? '' : conSigno(g.cambio)}</small></span></summary>
            <div class="cat-movs">${[...g.movs, ...g.movsAnterior].map((m) => filaMovimiento(estado, m, { conFecha: true }))}</div>
          </details>`,
        )}</div>`
      : html`<p class="fila-vacia">No hay gastos en ninguno de los dos tramos.</p>`}`;
}

export function render(estado, ui) {
  const vista = { resumen, historico, comparar: comparacion }[ui.analisisTab];
  return html`<p class="saludo">Tu dinero, con contexto</p><h1 class="titulo">${titulo}</h1>${pestanas(ui)}${vista(estado, ui)}`;
}

export const acciones = {
  'an-tab': (el, ui) => {
    ui.analisisTab = el.dataset.tab;
  },
  'an-periodo': (el, ui) => {
    ui.periodo = el.dataset.valor;
  },
  'an-comparar': (el, ui) => {
    ui.modoComparar = el.dataset.valor;
  },
  'an-anio': (el, ui) => {
    ui.anio += Number(el.dataset.paso);
  },
  'an-mes': (el, ui) => {
    ui.mes = el.dataset.mes;
  },
};

export const cambios = {
  'an-cuenta': (el, ui) => {
    ui.cuentaAnalisis = el.value;
  },
};
