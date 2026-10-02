// Movimientos: lista del mes con buscador y filtros, o calendario con lo anotado y lo que viene cada día.
import { html, opcionesSelect } from '../ui.js';
import { movimientosDelMes, ordenarMovimientos, fijosPendientes, cuotasPendientes, suma } from '../calc.js';
import { dinero, diaSemana, diasEnMes, fechaHumana, hoyISO, mesDeHoy, nombreMesAnio, sumarMeses } from '../format.js';
import { filaMovimiento, filaPendiente } from './piezas.js';

export const id = 'movimientos';
export const titulo = 'Movimientos';

const TIPOS = [
  ['todos', 'Todos'],
  ['gasto', 'Gastos'],
  ['ingreso', 'Ingresos'],
  ['transferencia', 'Transferencias'],
];
const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const navegadorMes = (mesId, accion = 'mes-mover') => html`<div class="nav-mes">
  <button type="button" data-accion="${accion}" data-paso="-1" aria-label="Mes anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>
  <span>${nombreMesAnio(mesId)}</span>
  <button type="button" data-accion="${accion}" data-paso="1" aria-label="Mes siguiente"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>
</div>`;

function filtrar(estado, ui) {
  const f = ui.filtros;
  const texto = sinTildes(ui.buscar.trim());
  // Con texto se busca en todos los meses; sin texto, solo en el mes elegido.
  let lista = texto ? estado.movimientos : movimientosDelMes(estado, ui.mes);
  if (texto) lista = lista.filter((m) => sinTildes(`${m.concepto} ${m.nota}`).includes(texto));
  if (ui.tipo !== 'todos') lista = lista.filter((m) => m.tipo === ui.tipo);
  if (f.cuenta) lista = lista.filter((m) => m.cuentaId === f.cuenta || m.cuentaDestinoId === f.cuenta);
  if (f.categoria) lista = lista.filter((m) => m.categoriaId === f.categoria);
  return ordenarMovimientos(lista);
}

function vistaLista(estado, ui) {
  const lista = filtrar(estado, ui);
  const ingresos = suma(lista.filter((m) => m.tipo === 'ingreso').map((m) => m.monto));
  const gastos = suma(lista.filter((m) => m.tipo === 'gasto').map((m) => m.monto));
  const dias = Map.groupBy ? Map.groupBy(lista, (m) => m.fecha) : lista.reduce((g, m) => g.set(m.fecha, [...(g.get(m.fecha) ?? []), m]), new Map());
  const activos = (ui.filtros.cuenta ? 1 : 0) + (ui.filtros.categoria ? 1 : 0);
  return html`
    <div class="buscador">
      <input id="buscar" type="search" placeholder="Buscar por concepto o nota" autocomplete="off" enterkeyhint="search" value="${ui.buscar}" data-entrada="buscar" aria-label="Buscar movimientos">
      <button type="button" class="btn-filtros" data-accion="filtros" aria-expanded="${ui.verFiltros}">Filtros${activos > 0 && html` <b>${activos}</b>`}</button>
    </div>
    ${ui.verFiltros &&
    html`<div class="grupo filtros">
      <label class="fila"><span class="et">Cuenta</span><select data-cambio="filtro" data-campo="cuenta">${opcionesSelect([['', 'Todas'], ...estado.cuentas.map((c) => [c.id, c.nombre])], ui.filtros.cuenta)}</select></label>
      <label class="fila"><span class="et">Categoría</span><select data-cambio="filtro" data-campo="categoria">${opcionesSelect([['', 'Todas'], ...estado.categorias.map((c) => [c.id, `${c.icono} ${c.nombre}`])], ui.filtros.categoria)}</select></label>
      ${activos > 0 && html`<button type="button" class="fila accion" data-accion="filtros-limpiar">Quitar filtros</button>`}
    </div>`}
    <div class="chips">${TIPOS.map(([v, t]) => html`<button type="button" class="chip" aria-pressed="${ui.tipo === v}" data-accion="tipo" data-tipo="${v}">${t}</button>`)}</div>
    <p class="conteo"><span>${lista.length} ${lista.length === 1 ? 'movimiento' : 'movimientos'}${ui.buscar.trim() && ' en todos los meses'}</span><span><b class="ingreso">+${dinero(ingresos)}</b> <b class="gasto">−${dinero(gastos)}</b></span></p>
    ${lista.length
      ? [...dias].map(
          ([fecha, movs]) => html`<h2 class="dia-t"><span>${diaSemana(fecha)} ${fechaHumana(fecha)}</span></h2>
          <div class="grupo">${movs.map((m) => filaMovimiento(estado, m))}</div>`,
        )
      : html`<p class="fila-vacia">${ui.buscar.trim() || activos || ui.tipo !== 'todos' ? 'Nada coincide con la búsqueda o los filtros.' : 'No hay movimientos este mes. Toca + para anotar uno.'}</p>`}`;
}

function vistaCalendario(estado, ui) {
  const hoy = hoyISO();
  const mes = ui.mes;
  const n = diasEnMes(mes);
  const fin = `${mes}-${String(n).padStart(2, '0')}`;
  const movs = movimientosDelMes(estado, mes);
  // Lo que viene (o se atrasó) en este mes: pagos fijos y cuotas aún sin registrar.
  const pendientes = [...fijosPendientes(estado, fin, hoy), ...cuotasPendientes(estado, fin, hoy)].filter((p) => p.fecha.startsWith(mes));
  const primerDia = (new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1, 1).getDay() + 6) % 7; // lunes = 0
  const dia = ui.dia?.startsWith(mes) ? ui.dia : mes === mesDeHoy() ? hoy : `${mes}-01`;
  const celdas = Array.from({ length: n }, (_, i) => {
    const f = `${mes}-${String(i + 1).padStart(2, '0')}`;
    const delDia = movs.filter((m) => m.fecha === f);
    const marcas = [delDia.some((m) => m.tipo === 'ingreso') && 'ingreso', delDia.some((m) => m.tipo === 'gasto') && 'gasto', pendientes.some((p) => p.fecha === f) && 'pend'].filter(Boolean);
    return html`<button type="button" class="dia ${f === hoy ? 'hoy' : ''}" aria-pressed="${f === dia}" data-accion="dia" data-fecha="${f}" style="${i === 0 ? `grid-column-start:${primerDia + 1}` : ''}">
      <span>${i + 1}</span><span class="marcas">${marcas.map((c) => html`<i class="${c}"></i>`)}</span>
    </button>`;
  });
  const delDia = ordenarMovimientos(movs.filter((m) => m.fecha === dia));
  const pendDia = pendientes.filter((p) => p.fecha === dia);
  const neto = suma(delDia.map((m) => (m.tipo === 'ingreso' ? m.monto : m.tipo === 'gasto' ? -m.monto : 0)));
  return html`
    <div class="calendario">
      <div class="sem">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => html`<span>${d}</span>`)}</div>
      <div class="rejilla">${celdas}</div>
      <p class="cal-ley"><span><i class="ingreso"></i>Ingreso</span><span><i class="gasto"></i>Gasto</span><span><i class="pend"></i>Por pagar o cobrar</span></p>
    </div>
    <h2 class="dia-t"><span>${diaSemana(dia)} ${fechaHumana(dia)}</span>${delDia.length > 0 && html`<span>${dinero(neto, { signo: true })}</span>`}</h2>
    ${pendDia.length > 0 && html`<div class="grupo">${pendDia.map((p) => filaPendiente(estado, p, hoy))}</div>`}
    ${delDia.length ? html`<div class="grupo ${pendDia.length ? 'separado' : ''}">${delDia.map((m) => filaMovimiento(estado, m))}</div>` : !pendDia.length && html`<p class="fila-vacia">Nada anotado este día.</p>`}`;
}

export function render(estado, ui) {
  return html`
    <h1 class="titulo">${titulo}</h1>
    ${navegadorMes(ui.mes)}
    <div class="seg-nav" role="tablist">
      <button type="button" role="tab" aria-selected="${ui.modo === 'lista'}" data-accion="modo" data-modo="lista">Lista</button>
      <button type="button" role="tab" aria-selected="${ui.modo === 'calendario'}" data-accion="modo" data-modo="calendario">Calendario</button>
    </div>
    ${ui.modo === 'calendario' ? vistaCalendario(estado, ui) : vistaLista(estado, ui)}`;
}

export const acciones = {
  'mes-mover': (el, ui) => {
    ui.mes = sumarMeses(ui.mes, Number(el.dataset.paso));
    ui.dia = null;
  },
  modo: (el, ui) => {
    ui.modo = el.dataset.modo;
  },
  tipo: (el, ui) => {
    ui.tipo = el.dataset.tipo;
  },
  filtros: (el, ui) => {
    ui.verFiltros = !ui.verFiltros;
  },
  'filtros-limpiar': (el, ui) => {
    ui.filtros = { cuenta: '', categoria: '' };
  },
  dia: (el, ui) => {
    ui.dia = el.dataset.fecha;
  },
};

export const cambios = {
  filtro: (el, ui) => {
    ui.filtros[el.dataset.campo] = el.value;
  },
};

export const entradas = {
  buscar: (el, ui) => {
    ui.buscar = el.value;
  },
};

// Para que otras pantallas (Análisis, cuentas) abran la lista ya filtrada.
export const verFiltrado = (ui, { mes, cuenta = '', categoria = '', tipo = 'todos' }) => {
  Object.assign(ui, { mes: mes ?? ui.mes, modo: 'lista', buscar: '', tipo, filtros: { cuenta, categoria }, verFiltros: Boolean(cuenta || categoria) });
  location.hash = '#movimientos';
};
