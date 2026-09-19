// Hoja «Plan de Ahorro»: cuánto puedes ahorrar cada mes después del crucero y tus gastos personales.
import { html, aviso } from '../ui.js';
import { planAhorro, mesPorDefecto } from '../calc.js';
import { cambiar } from '../store.js';
import { dinero, nombreMes, numEntrada, parseMonto } from '../format.js';

export const id = 'ahorro';
export const titulo = 'Plan de ahorro';

const abiertos = new Set(); // meses desplegados; se conserva entre repintados
let inicializado = false;

const clase = (n) => (n < 0 ? 'val neg' : 'val');
const fila = (nombre, valor, extra = '') => html`<div class="fila ${extra}"><span class="et">${nombre}</span><span class="${clase(valor)}">${dinero(valor)}</span></div>`;
const filaEntrada = (nombre, nota, entrada) => html`<label class="fila"><span class="et">${nombre}${nota && html`<small>${nota}</small>`}</span>${entrada}</label>`;

export function render(estado) {
  if (!inicializado) {
    inicializado = true;
    abiertos.add(mesPorDefecto(estado));
  }
  const { filas, totales: t } = planAhorro(estado);
  const c = estado.config;
  const rango = filas.length ? `de ${nombreMes(filas[0].id).toLowerCase()} a ${nombreMes(filas.at(-1).id).toLowerCase()}` : 'sin meses todavía';
  return html`
    <h1 class="titulo">${titulo}</h1>
    <p class="sub">Meses del plan: ${rango}. Lo que queda después del crucero y de tus gastos personales es tu ahorro.</p>

    <h2 class="grupo-t">Supuestos</h2>
    <div class="grupo">
      ${filaEntrada('Gasto personal mensual estimado', 'Comida, transporte, salidas. Cámbialo por tu gasto real.', html`<input class="num" type="text" inputmode="decimal" autocomplete="off" data-cambio="ahorro-param" data-campo="gastoPersonal" value="${numEntrada(c.gastoPersonal)}" aria-label="Gasto personal mensual estimado">`)}
      ${filaEntrada('Meta de ahorro (% del salario)', 'Cámbialo a lo que quieras lograr.', html`<input class="num" type="text" inputmode="decimal" autocomplete="off" data-cambio="ahorro-param" data-campo="metaAhorroPct" value="${Math.round(c.metaAhorroPct * 1000) / 10}" aria-label="Meta de ahorro en porcentaje">`)}
    </div>

    <h2 class="grupo-t">Mes por mes</h2>
    ${filas.length
      ? filas.map(
          (f) => html`
            <details class="grupo mes-ahorro" ${abiertos.has(f.id) && 'open'}>
              <summary class="fila" data-accion="ahorro-toggle" data-id="${f.id}">
                <span class="mes-n">${nombreMes(f.id)}</span>
                <span class="${clase(f.ahorroPlan)}">${dinero(f.ahorroPlan)}</span>
                <span class="etq ${f.cumple ? 'ok' : 'bad'}">${f.cumple ? 'Cumple' : 'No cumple'}</span>
              </summary>
              <div>
                ${fila('Saldo libre', f.saldo)}${fila('Para crucero', f.paraCrucero)}${fila('Gasto personal', f.gastoPersonal)}
                ${fila('Ahorro planeado', f.ahorroPlan, 'total')}${fila('Meta de ahorro', f.meta)}${fila('Ahorro acumulado', f.acumulado)}
                ${filaEntrada('Ahorro real', 'Escríbelo cuando termine el mes', html`<input class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" data-cambio="ahorro-real" data-id="${f.id}" value="${f.real == null ? '' : numEntrada(f.real)}" aria-label="Ahorro real de ${nombreMes(f.id)}">`)}
                ${f.diferencia !== null && fila('Real vs plan', f.diferencia)}
              </div>
            </details>`,
        )
      : html`<p class="vacio">No hay meses en el plan. Cambia «Primer mes del plan» en Config.</p>`}

    ${filas.length > 0 &&
    html`<h2 class="grupo-t">Total del plan</h2>
      <div class="grupo">
        ${fila('Saldo libre', t.saldo)}${fila('Para crucero', t.paraCrucero)}${fila('Gasto personal', t.gastoPersonal)}
        ${fila('Ahorro planeado', t.ahorroPlan, 'total')}${fila('Meta de ahorro', t.meta)}${fila('Ahorro real', t.real)}${fila('Real vs plan', t.diferencia)}
      </div>`}

    <details class="ayuda">
      <summary>Cómo funciona</summary>
      <ul>
        <li>Saldo libre = salario – plan móvil – abuelos – extras (viene de Mes).</li>
        <li>Orden de prioridad: 1) cuotas del crucero, 2) gasto personal, 3) lo que sobra es tu ahorro planeado.</li>
        <li>«Para crucero» reparte el faltante de Crucero en partes iguales entre los meses; se ajusta si registras abonos.</li>
        <li>Cuando pase el mes, escribe cuánto ahorraste de verdad en «Ahorro real» y mira la diferencia contra el plan.</li>
        <li>Al recibir el salario, aparta primero el ahorro planeado (transfiérelo a otra cuenta) y gasta lo demás.</li>
        <li>Cuando termines de pagar el crucero, ese monto pasa automáticamente a ahorro.</li>
      </ul>
    </details>
  `;
}

export const acciones = {
  'ahorro-toggle': (el) => {
    const mes = el.dataset.id;
    if (!abiertos.delete(mes)) abiertos.add(mes);
    return false; // el navegador abre/cierra el detalle solo; no hace falta repintar
  },
};

export const cambios = {
  'ahorro-param': (el) => {
    const valor = parseMonto(el.value);
    const campo = el.dataset.campo;
    if (campo === 'metaAhorroPct') {
      if (!(valor >= 0 && valor <= 100)) return aviso('La meta va de 0 a 100 %.');
      return cambiar((e) => {
        e.config.metaAhorroPct = valor / 100;
      });
    }
    if (!(valor >= 0)) return aviso('Escribe un monto válido.');
    cambiar((e) => {
      e.config[campo] = valor;
    });
  },
  'ahorro-real': (el) => {
    const texto = el.value.trim();
    const valor = texto === '' ? null : parseMonto(texto);
    if (Number.isNaN(valor)) return aviso('Escribe un monto válido.');
    cambiar((e) => {
      e.meses.find((m) => m.id === el.dataset.id).ahorroReal = valor;
    });
  },
};
