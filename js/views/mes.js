// Hoja «Control Mensual»: por cada mes, salario, plan móvil, abuelos, extras y saldo.
import { html, aviso } from '../ui.js';
import { controlMensual, extrasDelMes } from '../calc.js';
import { cambiar, obtener } from '../store.js';
import { dinero, nombreMes, nombreMesAnio, abreviaturaMes, mesDeHoy, mesSiguiente, diasEnMes } from '../format.js';
import { hacerRespaldo, respaldoPendiente } from '../respaldo.js';
import { filaExtra } from './extras.js';

export const id = 'mes';
export const titulo = 'Control mensual';

const guion = { guionSiCero: true };
const enMinuscula = (mesId) => nombreMes(mesId).toLowerCase();

function vencido(mesId, dia) {
  const actual = mesDeHoy();
  if (mesId !== actual) return mesId < actual;
  return new Date().getDate() > Math.min(dia, diasEnMes(mesId));
}

function filaPago(nombre, campo, monto, estado, dia, mesId) {
  const tarde = monto > 0 && estado === 'Pendiente' && vencido(mesId, dia);
  const boton = (valor, clase) =>
    html`<button type="button" class="${clase}" aria-pressed="${String(estado === valor)}" data-accion="mes-estado" data-campo="${campo}" data-valor="${valor}">${valor}</button>`;
  return html`
    <div class="fila fila-pago">
      <div class="et">${nombre}<small class="${tarde ? 'vence' : ''}">${tarde ? `Venció el día ${dia}` : `Se paga el día ${dia}`}</small></div>
      <div class="val">${dinero(monto)}</div>
      <div class="seg" role="group" aria-label="Estado de ${nombre}">${boton('Pendiente', 'pend')}${boton('Pagado', 'pag')}</div>
    </div>`;
}

// Cómo se reparte el salario del mes: ya pagado, por pagar y libre.
function cinta(f) {
  const libre = Math.max(f.saldo, 0);
  const base = Math.max(f.salario, f.total);
  const partes = [['pag', f.yaPagado], ['por', f.porPagar], ['libre', libre]].filter(([, v]) => v > 0);
  return html`
    <div class="cinta" role="img" aria-label="Del salario: ${dinero(f.yaPagado)} ya pagado, ${dinero(f.porPagar)} por pagar, ${dinero(libre)} libre">
      ${base > 0 && partes.map(([clase, v]) => html`<i class="${clase}" style="flex-grow:${v / base}"></i>`)}
    </div>
    <ul class="leyenda">
      <li><span><i class="pag"></i>Ya pagado</span><b>${dinero(f.yaPagado)}</b></li>
      <li><span><i class="por"></i>Por pagar</span><b>${dinero(f.porPagar)}</b></li>
      <li><span><i class="libre"></i>Libre</span><b>${dinero(libre)}</b></li>
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

const filaTotal = (nombre, valor, opciones) => html`<div class="fila"><span class="et">${nombre}</span><span class="val">${dinero(valor, opciones)}</span></div>`;

export function render(estado, ui) {
  const { filas, totales: t } = controlMensual(estado);
  const f = filas.find((x) => x.id === ui.mesSel) ?? filas.at(-1);
  const extras = extrasDelMes(estado, f.id);
  const anioActual = mesDeHoy().slice(0, 4);
  return html`
    <h1 class="titulo">${titulo}</h1>
    ${avisoInicial(estado)}${avisoRespaldo(estado)}
    <nav class="meses" aria-label="Mes">
      ${filas.map((m) => html`<button type="button" class="chip" aria-current="${String(m.id === f.id)}" data-accion="mes-sel" data-id="${m.id}">${abreviaturaMes(m.id)}${m.id.slice(0, 4) !== anioActual ? ` ’${m.id.slice(2, 4)}` : ''}</button>`)}
      <button type="button" class="chip mas" data-accion="mes-mas">+ Mes</button>
    </nav>
    <section class="hero">
      <p class="hero-et">Saldo libre de ${enMinuscula(f.id)}</p>
      <p class="hero-num ${f.saldo < 0 ? 'neg' : ''}">${dinero(f.saldo)}</p>
      ${cinta(f)}
    </section>

    <h2 class="grupo-t">Pagos de ${enMinuscula(f.id)}</h2>
    <div class="grupo">
      ${filaTotal('Salario', f.salario)}
      ${filaPago('Plan móvil', 'movil', f.movil, f.estadoMovil, estado.config.movilDia, f.id)}
      ${filaPago('Abuelos', 'abuelos', f.abuelos, f.estadoAbuelos, estado.config.abuelosDia, f.id)}
      <div class="fila"><span class="et">Extras${f.extras > 0 && html`<small>${f.extrasPendientes > 0 ? `${dinero(f.extrasPendientes)} pendiente` : 'Todos pagados'}</small>`}</span><span class="val">${dinero(f.extras, guion)}</span></div>
      ${extras.map((x) => filaExtra(x, true))}
      <button type="button" class="fila accion" data-accion="extra-nuevo">+ Anotar extra</button>
      <div class="fila total"><span class="et">Total gastos</span><span class="val">${dinero(f.total)}</span></div>
    </div>

    <h2 class="grupo-t">Total de todos los meses</h2>
    <div class="grupo">
      ${filaTotal('Salario', t.salario)}${filaTotal('Plan móvil', t.movil)}${filaTotal('Abuelos', t.abuelos)}${filaTotal('Extras', t.extras, guion)}
      <div class="fila total"><span class="et">Total gastos</span><span class="val">${dinero(t.total)}</span></div>
      ${filaTotal('Saldo libre', t.saldo)}${filaTotal('Ya pagado', t.yaPagado)}${filaTotal('Por pagar', t.porPagar, guion)}
    </div>
    <p class="nota">Por pagar es lo que sigue en Pendiente: plan móvil, abuelos y extras.</p>
    ${f.id === filas.at(-1).id && filas.length > 1 && html`<button type="button" class="enlace peligro" data-accion="mes-quitar">Quitar ${enMinuscula(f.id)}</button>`}
  `;
}

export const acciones = {
  'mes-sel': (el, ui) => {
    ui.mesSel = el.dataset.id;
  },
  'mes-mas': (el, ui) => {
    const nuevo = mesSiguiente(obtener().meses.at(-1).id);
    cambiar((e) => e.meses.push({ id: nuevo, movil: 'Pendiente', abuelos: 'Pendiente', ahorroReal: null }));
    ui.mesSel = nuevo;
    aviso(`${nombreMesAnio(nuevo)} agregado`);
  },
  'mes-estado': (el, ui) =>
    cambiar((e) => {
      e.meses.find((m) => m.id === ui.mesSel)[el.dataset.campo] = el.dataset.valor;
    }),
  'mes-quitar': (el, ui) => {
    const estado = obtener();
    const mes = estado.meses.find((m) => m.id === ui.mesSel);
    if (extrasDelMes(estado, mes.id).length) {
      aviso('Este mes tiene extras. Bórralos primero.');
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
