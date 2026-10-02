// Planificación: cuánto puedes gastar hasta fin de mes, límites por categoría y avisos.
import { html, abrirHoja, aviso, campo, entradaMonto, opcionesSelect, cabecera, barra } from '../ui.js';
import { cambiar, obtener } from '../store.js';
import { categoriasDe, categoriaPorId, resumenMes } from '../calc.js';
import { puedesGastar, prevision, resumenLimites, avisos, saldoPorMes } from '../finanzas.js';
import { abreviaturaMes, dinero, hoyISO, mesDeHoy, nombreMes, numEntrada, parseMonto, sumarMeses } from '../format.js';
import { vacio } from './piezas.js';

export const id = 'planificacion';
export const titulo = 'Planificación';
export const pestana = 'ajustes';

// Línea del saldo total al cierre de cada mes.
function graficaSaldo(puntos) {
  const ancho = 320;
  const alto = 120;
  const valores = puntos.map((p) => p.saldo);
  const min = Math.min(0, ...valores);
  const max = Math.max(1, ...valores);
  const x = (i) => 16 + (i * (ancho - 32)) / Math.max(1, puntos.length - 1);
  const y = (v) => 12 + (1 - (v - min) / (max - min || 1)) * (alto - 40);
  const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.saldo).toFixed(1)}`).join(' ');
  return html`<svg class="graf" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Saldo total al cierre de los últimos ${puntos.length} meses">
    ${min < 0 && html`<line x1="0" x2="${ancho}" y1="${y(0)}" y2="${y(0)}" class="graf-base"></line>`}
    <path d="${linea}" class="graf-linea"></path>
    ${puntos.map((p, i) => html`<circle cx="${x(i)}" cy="${y(p.saldo)}" r="${i === puntos.length - 1 ? 5 : 3.5}" class="graf-punto ${i === puntos.length - 1 ? 'ultimo' : ''}"></circle>
      <text x="${x(i)}" y="${alto - 4}" text-anchor="middle" class="graf-mes">${abreviaturaMes(p.id)}</text>`)}
  </svg>`;
}

export const listaAvisos = (lista) =>
  html`<div class="grupo">${lista.map((a) => html`<a class="fila aviso-fila ${a.nivel}" href="${a.href}"><span class="punto" aria-hidden="true"></span><span class="et">${a.texto}</span></a>`)}</div>`;

function resumen(estado) {
  const hoy = hoyISO();
  const p = puedesGastar(estado, hoy);
  const prev = prevision(estado, hoy, 30);
  const lim = resumenLimites(estado, hoy.slice(0, 7));
  const lista = avisos(estado, hoy);
  const r = resumenMes(estado, hoy.slice(0, 7));
  const saldo = saldoPorMes(estado, hoy, 6);
  return html`
    <section class="hero chico">
      <p class="hero-et">Puedes gastar hasta fin de ${nombreMes(p.mesId).toLowerCase()}</p>
      <p class="hero-num ${p.libre < 0 ? 'neg' : ''}">${dinero(p.libre)}</p>
      <p class="hero-sub">${p.libre > 0 ? `Unos ${dinero(p.porDia)} al día durante ${p.dias === 1 ? 'el día que queda' : `los ${p.dias} días que quedan`}.` : 'Ya no queda margen este mes: revisa los pagos o los gastos.'}</p>
    </section>
    <div class="grupo cascada">
      <div class="fila"><span class="et">Entra este mes<small>Recibido y por cobrar</small></span><span class="val ingreso">+${dinero(p.recibido + p.porCobrar)}</span></div>
      <div class="fila"><span class="et">Ya gastado</span><span class="val">−${dinero(p.gastado)}</span></div>
      <div class="fila"><span class="et">Pagos y cuotas que faltan</span><span class="val">−${dinero(p.porPagar)}</span></div>
      <div class="fila"><span class="et">Para tus objetivos</span><span class="val">−${dinero(p.objetivos)}</span></div>
      <div class="fila total"><span class="et">Puedes gastar</span><span class="val ${p.libre < 0 ? 'neg' : ''}">${dinero(p.libre)}</span></div>
    </div>

    <div class="kpis">
      <div><small>Saldo en 30 días</small><b class="${prev.saldoFinal < 0 ? 'neg' : ''}">${dinero(prev.saldoFinal)}</b><span>Si se cumple lo previsto</span></div>
      <div><small>Resultado del mes</small><b class="${r.balance < 0 ? 'neg' : 'ingreso'}">${dinero(r.balance, { signo: true })}</b><span>Ingresos menos gastos</span></div>
      <a href="#planificacion/limites"><small>Límites usados</small><b class="${lim.uso > 1 ? 'neg' : ''}">${lim.lista.length ? `${Math.round(lim.uso * 100)}%` : '—'}</b><span>${lim.lista.length ? `${dinero(lim.gastado)} de ${dinero(lim.disponible)}` : 'Aún no pones límites'}</span></a>
      <a href="#fijos"><small>Pagos en 30 días</small><b>${prev.lista.filter((x) => x.tipo === 'gasto').length}</b><span>${dinero(prev.pagos)} en total</span></a>
    </div>

    <h2 class="grupo-t">Revisa estos puntos</h2>
    ${lista.length ? listaAvisos(lista) : html`<p class="fila-vacia">Todo en orden: sin pagos atrasados ni límites en riesgo.</p>`}

    <h2 class="grupo-t">Cómo cambia tu saldo</h2>
    <div class="grupo graf-caja">${graficaSaldo(saldo)}<p class="nota centro sin-margen">Hoy tienes ${dinero(saldo.at(-1).saldo)} entre todas tus cuentas.</p></div>`;
}

function limites(estado) {
  const mes = mesDeHoy();
  const lim = resumenLimites(estado, mes);
  const sinLimite = categoriasDe(estado, 'gasto').filter((c) => !estado.limites.some((l) => l.categoriaId === c.id));
  return html`
    <p class="nota sin-margen">Ponle un tope mensual a una categoría. Si activas «acumular», lo que no gastes un mes se suma al siguiente.</p>
    ${lim.lista.length
      ? html`<div class="grupo separado">${lim.lista.map(
          (l) => html`<button type="button" class="fila limite ${l.uso > 1 ? 'pasado' : l.uso >= 0.8 ? 'cerca' : ''}" data-accion="limite-editar" data-id="${l.categoriaId}">
            <span class="ico">${l.categoria.icono}</span>
            <span class="et">${l.categoria.nombre}<small>${l.uso > 1 ? `Te pasaste ${dinero(-l.queda)}` : `Quedan ${dinero(l.queda)}`}; gastado ${dinero(l.gastado)} de ${dinero(l.disponible)}${l.arrastre > 0 ? ` (incluye ${dinero(l.arrastre)} acumulado)` : ''}</small>${barra(Math.min(1, l.uso), l.uso > 1 ? 'gasto' : l.uso >= 0.8 ? '' : 'objetivo')}</span>
            <span class="val">${Number.isFinite(l.uso) ? `${Math.round(l.uso * 100)}%` : '—'}</span>
          </button>`,
        )}</div>`
      : vacio('Aún no pones límites. Empieza por la categoría donde más se te va el dinero.', '')}
    ${sinLimite.length > 0 && html`<button type="button" class="btn ancho" data-accion="limite-nuevo">Agregar un límite</button>`}
    <div class="grupo separado"><a class="fila" href="#fijos"><span class="ico">🔁</span><span class="et">Pagos fijos<small>Ingresos y pagos que se repiten</small></span><span class="flecha"></span></a></div>`;
}

export function render(estado, ui, param) {
  const tab = param === 'limites' ? 'limites' : 'resumen';
  return html`
    ${cabecera(titulo, { volver: '#ajustes', textoVolver: 'Ajustes' })}
    <div class="seg-nav" role="tablist">
      <a role="tab" aria-selected="${tab === 'resumen'}" href="#planificacion">Resumen</a>
      <a role="tab" aria-selected="${tab === 'limites'}" href="#planificacion/limites">Límites</a>
    </div>
    ${tab === 'limites' ? limites(estado) : resumen(estado)}`;
}
export const rutas = ['planificacion'];

// Gasto medio de una categoría en los tres meses anteriores (para sugerir un límite).
function promedio(estado, catId) {
  const meses = [1, 2, 3].map((i) => resumenMes(estado, sumarMeses(mesDeHoy(), -i)));
  const total = meses.reduce((s, r) => s + (r.gastosPorCategoria.find((g) => g.id === catId)?.total ?? 0), 0);
  return total / 3;
}

function abrirLimite(catId) {
  const estado = obtener();
  const existente = catId ? estado.limites.find((l) => l.categoriaId === catId) : null;
  const opciones = categoriasDe(estado, 'gasto').filter((c) => c.id === catId || !estado.limites.some((l) => l.categoriaId === c.id));
  const sugerencia = (id) => {
    const p = promedio(estado, id);
    return p > 0 ? `En los últimos tres meses gastaste en promedio ${dinero(p)} al mes en esta categoría.` : 'Sin gastos en esta categoría los últimos tres meses.';
  };
  abrirHoja({
    titulo: existente ? `Límite de ${categoriaPorId(estado, catId).nombre}` : 'Nuevo límite',
    cuerpo: html`<div class="grupo">
        ${!existente && campo('Categoría', html`<select name="categoria">${opcionesSelect(opciones.map((c) => [c.id, `${c.icono} ${c.nombre}`]), opciones[0]?.id)}</select>`)}
        ${campo('Límite al mes', entradaMonto('monto', existente ? numEntrada(existente.monto) : ''))}
        <label class="campo"><span>Acumular lo que no gaste</span><input type="checkbox" name="acumular" class="interruptor" ${existente?.acumular && 'checked'}></label>
      </div>
      <p class="nota" data-sugerencia>${sugerencia(catId ?? opciones[0]?.id)}</p>`,
    alAbrir(form) {
      form.addEventListener('change', (ev) => {
        if (ev.target.name === 'categoria') form.querySelector('[data-sugerencia]').textContent = sugerencia(ev.target.value);
      });
    },
    alGuardar(datos) {
      const monto = parseMonto(datos.get('monto'));
      if (!(monto > 0)) return 'Escribe un límite mayor que cero.';
      const categoriaId = existente ? catId : String(datos.get('categoria'));
      const acumular = datos.get('acumular') === 'on';
      cambiar((e) => {
        const l = e.limites.find((x) => x.categoriaId === categoriaId);
        // Al empezar a acumular, se cuenta desde este mes.
        if (l) Object.assign(l, { monto, acumular, desde: acumular && !l.acumular ? mesDeHoy() : (l.desde ?? mesDeHoy()) });
        else e.limites.push({ categoriaId, monto, acumular, desde: mesDeHoy() });
      });
      aviso(existente ? 'Límite guardado' : 'Límite agregado');
    },
    eliminar: existente && 'Quitar límite',
    alEliminar() {
      cambiar((e) => {
        e.limites = e.limites.filter((l) => l.categoriaId !== catId);
      });
      aviso('Límite quitado', { accion: 'Deshacer', alAccion: () => cambiar((e) => e.limites.push(existente)) });
    },
  });
}

export const acciones = {
  'limite-nuevo': () => {
    abrirLimite();
    return false;
  },
  'limite-editar': (el) => {
    abrirLimite(el.dataset.id);
    return false;
  },
};
