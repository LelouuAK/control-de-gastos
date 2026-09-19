// Hoja «Plan de Ahorro»: cuánto puedes ahorrar cada mes después del crucero y tus gastos personales.
import { html, aviso } from '../ui.js';
import { planAhorro, mesPorDefecto } from '../calc.js';
import { cambiar } from '../store.js';
import { dinero, abreviaturaMes, nombreMes, numEntrada, parseMonto } from '../format.js';

export const id = 'ahorro';
export const titulo = 'Plan de ahorro';

const abiertos = new Set(); // meses desplegados; se conserva entre repintados
let inicializado = false;

const enMinuscula = (mesId) => nombreMes(mesId).toLowerCase();
const clase = (n) => (n < 0 ? 'val neg' : 'val');
const porcentaje = (parte, total) => `${Math.round((parte / total) * 100)} %`;

// Un paso de la cascada: op es «−» (se resta), «=» (resultado) o vacío (punto de partida).
const paso = (op, nombre, valor, { nota = '', total = false, aparte = false } = {}) => html`
  <div class="fila ${total && 'total'} ${aparte && 'aparte'}">
    <span class="op" aria-hidden="true">${op}</span>
    <span class="et">${nombre}${nota && html`<small>${nota}</small>`}</span>
    <span class="${clase(valor)}">${dinero(valor)}</span>
  </div>`;

const filaEntrada = (nombre, nota, entrada) => html`<label class="fila"><span class="et">${nombre}${nota && html`<small>${nota}</small>`}</span>${entrada}</label>`;

// Una barra por mes con el ahorro de ese mes; la línea punteada es la meta.
function grafico(filas, meta) {
  const W = 320;
  const H = 158;
  const arriba = 24;
  const abajo = 26;
  const valores = filas.map((f) => f.ahorroPlan);
  const max = Math.max(meta, ...valores, 1);
  const min = Math.min(0, ...valores);
  const y = (v) => arriba + ((max - v) / (max - min)) * (H - arriba - abajo);
  const salto = W / filas.length;
  const ancho = Math.min(46, salto * 0.62);
  const conMonto = filas.length <= 8;
  const corto = filas.length > 5; // con muchas barras el monto va sin centavos
  const texto = (v) => (corto ? `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v))}` : dinero(v));
  const resumen = filas.map((f) => `${nombreMes(f.id)} ${dinero(f.ahorroPlan)}`).join(', ');
  return html`
    <svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ahorro por mes: ${resumen}. Meta: ${dinero(meta)} al mes.">
      <line x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="graf-base"></line>
      ${filas.map((f, i) => {
        const x = salto * i + (salto - ancho) / 2;
        const v = f.ahorroPlan;
        const arribaBarra = Math.min(y(v), y(0));
        const alto = Math.max(Math.abs(y(v) - y(0)), 2);
        const yTexto = v >= 0 ? arribaBarra - 6 : arribaBarra + alto + 14;
        return html`
          <rect x="${x}" y="${arribaBarra}" width="${ancho}" height="${alto}" rx="4" class="${f.cumple ? 'barra-ok' : 'barra-mal'}"></rect>
          ${conMonto && html`<text x="${x + ancho / 2}" y="${yTexto}" text-anchor="middle" class="graf-monto">${texto(v)}</text>`}
          <text x="${x + ancho / 2}" y="${H - 8}" text-anchor="middle" class="graf-mes">${abreviaturaMes(f.id)}</text>`;
      })}
      <line x1="0" x2="${W}" y1="${y(meta)}" y2="${y(meta)}" class="graf-meta"></line>
    </svg>`;
}

// A dónde va el saldo libre de todo el plan: crucero, gastos personales y ahorro.
function reparto(t) {
  const base = Math.max(t.saldo, t.paraCrucero + t.gastoPersonal);
  if (!(base > 0)) return '';
  const partes = [['cru', 'Crucero', t.paraCrucero], ['per', 'Personales', t.gastoPersonal], ['libre', 'Ahorro', t.ahorroPlan]];
  return html`
    <h2 class="grupo-t">Cómo se reparte tu saldo libre</h2>
    <div class="cinta" role="img" aria-label="De ${dinero(t.saldo)} de saldo libre: ${partes.map(([, n, v]) => `${n} ${dinero(v)}`).join(', ')}">
      ${partes.filter(([, , v]) => v > 0.005).map(([c, , v]) => html`<i class="${c}" style="flex-grow:${v / base}"></i>`)}
    </div>
    <ul class="leyenda">
      ${partes.map(([c, nombre, v]) => html`<li><span><i class="${c}"></i>${nombre}</span><b>${dinero(v)}</b><em>${porcentaje(Math.max(v, 0), base)}</em></li>`)}
    </ul>`;
}

const veredicto = (t) => {
  const diferencia = t.ahorroPlan - t.meta;
  return diferencia >= 0
    ? html`<span class="etq ok">Superas tu meta de ${dinero(t.meta)} por ${dinero(diferencia)}</span>`
    : html`<span class="etq bad">Te faltan ${dinero(-diferencia)} para tu meta de ${dinero(t.meta)}</span>`;
};

function mesDetalle(f) {
  return html`
    <details class="grupo mes-ahorro" ${abiertos.has(f.id) && 'open'}>
      <summary class="fila" data-accion="ahorro-toggle" data-id="${f.id}">
        <span class="mes-n">${nombreMes(f.id)}<small>Acumulado ${dinero(f.acumulado)}</small></span>
        <span class="${clase(f.ahorroPlan)}">${dinero(f.ahorroPlan)}</span>
        <span class="etq ${f.cumple ? 'ok' : 'bad'}">${f.cumple ? 'Cumple' : 'No cumple'}</span>
      </summary>
      <div>
        ${paso('', 'Saldo libre', f.saldo, { nota: 'Lo que sobra del salario después de pagos y extras' })}
        ${paso('−', 'Cuota del crucero', f.paraCrucero, { nota: f.cruceroPagado ? 'Ya pagada' : '' })}
        ${paso('−', 'Gastos personales', f.gastoPersonal, { nota: f.personalPagado ? 'Ya pagados' : '' })}
        ${paso('=', 'Ahorro del mes', f.ahorroPlan, { total: true, nota: f.cumple ? `Cumples tu meta de ${dinero(f.meta)}` : `No llegas a tu meta de ${dinero(f.meta)}` })}
        ${paso('', 'Ahorro acumulado', f.acumulado, { aparte: true, nota: f.primero ? 'Es el primer mes del plan' : `${dinero(f.acumuladoAnterior)} de meses anteriores + ${dinero(f.ahorroPlan)} de este mes` })}
        ${filaEntrada('Ahorro real', 'Escríbelo cuando termine el mes', html`<input class="num" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" data-cambio="ahorro-real" data-id="${f.id}" value="${f.real == null ? '' : numEntrada(f.real)}" aria-label="Ahorro real de ${nombreMes(f.id)}">`)}
        ${f.diferencia !== null && paso('', 'Real contra el plan', f.diferencia, { nota: f.diferencia >= 0 ? 'Ahorraste más de lo planeado' : 'Ahorraste menos de lo planeado' })}
      </div>
    </details>`;
}

export function render(estado) {
  if (!inicializado) {
    inicializado = true;
    abiertos.add(mesPorDefecto(estado));
  }
  const { filas: crudas, totales: t } = planAhorro(estado);
  const filas = crudas.map((f, i) => ({ ...f, primero: i === 0 }));
  const c = estado.config;
  const rango = filas.length ? `de ${enMinuscula(filas[0].id)} a ${enMinuscula(filas.at(-1).id)}` : '';
  return html`
    <h1 class="titulo">${titulo}</h1>
    ${filas.length
      ? html`
        <section class="hero">
          <p class="hero-et">Ahorrarás en total ${rango}</p>
          <p class="hero-num ${t.ahorroPlan < 0 ? 'neg' : ''}">${dinero(t.ahorroPlan)}</p>
          <p class="veredicto">${veredicto(t)}</p>
          ${grafico(filas, filas[0].meta)}
          <p class="nota">Cada barra es lo que ahorras ese mes. La línea punteada es tu meta: ${dinero(filas[0].meta)} al mes.</p>
        </section>
        ${reparto(t)}`
      : html`<p class="vacio">No hay meses en el plan. Cambia «Primer mes del plan» en Config.</p>`}

    ${filas.length > 0 && html`<h2 class="grupo-t">Mes por mes</h2>${filas.map(mesDetalle)}`}

    ${filas.some((f) => f.real != null) &&
    html`<h2 class="grupo-t">Tu ahorro real contra el plan</h2>
      <div class="grupo">
        ${paso('', 'Ahorro real anotado', t.real, { nota: 'Suma de los meses donde escribiste tu ahorro real' })}
        ${paso('', 'Diferencia contra el plan', t.diferencia, { total: true, nota: t.diferencia >= 0 ? 'Vas por encima de lo planeado' : 'Vas por debajo de lo planeado' })}
      </div>`}

    <h2 class="grupo-t">Supuestos</h2>
    <div class="grupo">
      ${filaEntrada('Gasto personal mensual estimado', 'Comida, transporte, salidas. Cámbialo por tu gasto real.', html`<input class="num" type="text" inputmode="decimal" autocomplete="off" data-cambio="ahorro-param" data-campo="gastoPersonal" value="${numEntrada(c.gastoPersonal)}" aria-label="Gasto personal mensual estimado">`)}
      ${filaEntrada('Meta de ahorro (% del salario)', 'Cámbialo a lo que quieras lograr.', html`<input class="num" type="text" inputmode="decimal" autocomplete="off" data-cambio="ahorro-param" data-campo="metaAhorroPct" value="${Math.round(c.metaAhorroPct * 1000) / 10}" aria-label="Meta de ahorro en porcentaje">`)}
    </div>

    <details class="ayuda">
      <summary>Cómo funciona</summary>
      <ul>
        <li>Saldo libre = salario – plan móvil – abuelos – extras (viene de Mes).</li>
        <li>Ahorro del mes = saldo libre – cuota del crucero – gastos personales. Es lo que te sobra ese mes.</li>
        <li>Ahorro acumulado = la suma de los ahorros de todos los meses del plan hasta ese mes.</li>
        <li>La cuota del crucero reparte lo que falta en partes iguales entre los meses que quedan, y se ajusta sola cuando marcas una cuota como pagada.</li>
        <li>Cuando pase el mes, escribe cuánto ahorraste de verdad en «Ahorro real» y mira la diferencia contra el plan.</li>
        <li>Al recibir el salario, aparta primero el ahorro del mes (transfiérelo a otra cuenta) y gasta lo demás.</li>
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
