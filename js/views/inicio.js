// Inicio: cuánto te queda este mes, qué falta pagar, tus deudas, cuentas, objetivos y lo último que anotaste.
import { html, barra, fichas } from '../ui.js';
import { planDelMes, proximos, resumenDeudas, resumenObjetivos, saldoCuenta, patrimonio, ordenarMovimientos, cuentasActivas } from '../calc.js';
import { dinero, hoyISO, nombreMes } from '../format.js';
import { respaldoPendiente } from '../respaldo.js';
import { avisos } from '../finanzas.js';
import { listaAvisos } from './planificacion.js';
import { filaMovimiento, filaPendiente, etiquetaDeuda } from './piezas.js';

export const id = 'inicio';
export const titulo = 'Inicio';

const ICONO_CUENTA = { banco: '🏦', efectivo: '💵', tarjeta: '💳', ahorro: '🐷', otro: '👛' };
export const iconoCuenta = (tipo) => ICONO_CUENTA[tipo] ?? '👛';

const pct = (parte, total) => (total > 0 ? Math.max(0, parte) / total : 0);

function hero(p) {
  const entra = p.recibido + p.porCobrar;
  const base = Math.max(entra, p.gastado + p.porPagar, 0.01);
  const partes = [
    ['gastado', p.gastado],
    ['porpagar', p.porPagar],
    ['queda', Math.max(p.teQueda, 0)],
  ];
  return html`<section class="hero">
    <p class="hero-et">Te queda en ${nombreMes(p.mesId).toLowerCase()}</p>
    <p class="hero-num ${p.teQueda < 0 ? 'neg' : ''}">${dinero(p.teQueda)}</p>
    <p class="hero-sub">${p.teQueda < 0 ? 'Este mes sale más de lo que entra.' : p.porPagar > 0 ? 'Después de todo lo que falta pagar este mes.' : 'No tienes pagos pendientes este mes.'}</p>
    <div class="cinta" aria-hidden="true">${partes.filter(([, v]) => v > 0).map(([c, v]) => html`<i class="${c}" style="flex-grow:${pct(v, base)}"></i>`)}</div>
    <ul class="leyenda">
      <li><span><i class="entra"></i>Entra</span><b>${dinero(entra)}</b>${p.porCobrar > 0 && html`<em>${dinero(p.porCobrar)} por cobrar</em>`}</li>
      <li><span><i class="gastado"></i>Gastado</span><b>${dinero(p.gastado)}</b></li>
      <li><span><i class="porpagar"></i>Por pagar</span><b>${dinero(p.porPagar)}</b>${p.atrasado > 0 && html`<em class="mal">${dinero(p.atrasado)} atrasado</em>`}</li>
    </ul>
  </section>`;
}

export function render(estado) {
  const hoy = hoyISO();
  const plan = planDelMes(estado, hoy);
  const lista = proximos(estado, hoy, 14);
  const deudas = resumenDeudas(estado, hoy);
  const objetivos = resumenObjetivos(estado, hoy);
  const ultimos = ordenarMovimientos(estado.movimientos).slice(0, 5);
  const nada = !estado.movimientos.length && !estado.fijos.length && !estado.deudas.length;
  // Los pagos atrasados o cercanos ya salen en «Por pagar y cobrar»; aquí solo límites y un mes en rojo.
  const avisosLimites = avisos(estado, hoy, { conPagos: false });

  return html`
    <p class="saludo">${estado.ajustes.nombre ? `Hola, ${estado.ajustes.nombre}` : 'Hola'}</p>
    ${hero(plan)}

    ${respaldoPendiente(estado) && html`<a class="aviso-respaldo" href="#ajustes">Haz un respaldo de tus datos: viven solo en este teléfono.</a>`}

    ${avisosLimites.length > 0 && html`<h2 class="grupo-t con-enlace"><span>Avisos</span><a href="#planificacion">Planificación</a></h2>${listaAvisos(avisosLimites)}`}

    ${nada &&
    html`<section class="bienvenida">
      <h2>Empieza en tres pasos</h2>
      <ol>
        <li><a href="#fijos">Anota tus pagos fijos</a>: salario, alquiler, teléfono.</li>
        <li><a href="#deudas">Agrega lo que debes</a> y en cuántas cuotas lo pagarás.</li>
        <li>Toca <b>+</b> cada vez que gastes o recibas dinero.</li>
      </ol>
    </section>`}

    ${lista.length > 0 &&
    html`<h2 class="grupo-t con-enlace"><span>Por pagar y cobrar</span><a href="#fijos">Pagos fijos</a></h2>
      <div class="grupo">${lista.slice(0, 6).map((p) => filaPendiente(estado, p, hoy))}</div>
      ${lista.length > 6 && html`<p class="nota">Y ${lista.length - 6} más en las próximas dos semanas.</p>`}`}

    <h2 class="grupo-t con-enlace"><span>Deudas</span><a href="#deudas">${estado.deudas.length ? 'Ver todas' : 'Agregar'}</a></h2>
    ${estado.deudas.length
      ? html`<a class="tarjeta-deudas" href="#deudas">
          <span class="td-cifra"><small>Debes en total</small>${dinero(deudas.falta)}</span>
          ${barra(deudas.total > 0 ? deudas.pagado / deudas.total : 0, 'deuda')}
          <span class="td-pie">${dinero(deudas.pagado)} pagado de ${dinero(deudas.total)}</span>
        </a>
        <div class="grupo">${deudas.lista
          .filter((d) => d.situacion !== 'liquidada')
          .map(
            (d) => html`<a class="fila deuda-fila" href="#deuda/${d.deuda.id}">
              <span class="et">${d.deuda.nombre}<small>Falta ${dinero(d.falta)}${d.cuota > 0 && `, cuota de ${dinero(d.cuota)}`}</small>${fichas(d.cuotasPagadas, d.totalCuotas)}</span>
              ${etiquetaDeuda(d, hoy)}
            </a>`,
          )}</div>`
      : html`<a class="fila-vacia" href="#deudas">Préstamos, tarjetas, cuotas de un viaje o lo que le debes a alguien: anótalo y la app te dice cuánto pagar cada mes.</a>`}

    <h2 class="grupo-t con-enlace"><span>Cuentas</span><a href="#cuentas">Gestionar</a></h2>
    <div class="grupo">
      <div class="fila total"><span class="et">Tienes en total</span><span class="val">${dinero(patrimonio(estado))}</span></div>
      ${cuentasActivas(estado).map((c) => html`<a class="fila" href="#cuenta/${c.id}"><span class="ico">${iconoCuenta(c.tipo)}</span><span class="et">${c.nombre}</span><span class="val">${dinero(saldoCuenta(estado, c.id))}</span></a>`)}
    </div>

    ${estado.objetivos.length > 0 &&
    html`<h2 class="grupo-t con-enlace"><span>Objetivos de ahorro</span><a href="#objetivos">Ver todos</a></h2>
      <div class="grupo">${objetivos.lista.map(
        (o) => html`<a class="fila objetivo-fila" href="#objetivo/${o.objetivo.id}">
          <span class="ico">${o.objetivo.icono}</span>
          <span class="et">${o.objetivo.nombre}<small>${dinero(o.ahorrado)} de ${dinero(o.objetivo.meta)}</small>${barra(o.avance, 'objetivo')}</span>
          <span class="val">${Math.round(o.avance * 100)}%</span>
        </a>`,
      )}</div>`}

    <h2 class="grupo-t con-enlace"><span>Últimos movimientos</span>${ultimos.length > 0 && html`<a href="#movimientos">Ver todos</a>`}</h2>
    ${ultimos.length
      ? html`<div class="grupo">${ultimos.map((m) => filaMovimiento(estado, m, { conFecha: true }))}</div>`
      : html`<p class="fila-vacia">Aún no hay movimientos. Toca <b>+</b> para anotar el primero.</p>`}
  `;
}

export const acciones = {};
