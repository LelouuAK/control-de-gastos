import { iniciar, obtener, suscribir, alFallarGuardado, hayGuardado } from './store.js';
import { pintar, aviso, iniciarHoja } from './ui.js';
import { mesDeHoy, usarMoneda } from './format.js';
import * as inicio from './views/inicio.js';
import * as movimientos from './views/movimientos.js';
import * as analisis from './views/analisis.js';
import * as ajustes from './views/ajustes.js';
import * as cuentas from './views/cuentas.js';
import * as categorias from './views/categorias.js';
import * as deudas from './views/deudas.js';
import * as objetivos from './views/objetivos.js';
import * as fijos from './views/fijos.js';
import * as planificacion from './views/planificacion.js';
import * as centro from './views/centro.js';
import { abrirMovimiento, abrirPendiente, registrarFijo } from './views/hojas.js';

const vistas = [inicio, movimientos, analisis, ajustes, cuentas, categorias, deudas, objetivos, fijos, planificacion, centro];

// Acciones que se usan desde cualquier pantalla (botón + y las filas de movimientos y pendientes).
const comunes = {
  'mov-nuevo': () => {
    abrirMovimiento();
    return false;
  },
  'mov-editar': (el) => {
    abrirMovimiento({ id: el.dataset.id });
    return false;
  },
  'pend-abrir': (el) => {
    abrirPendiente(el.dataset.id, el.dataset.fecha);
    return false;
  },
  'pend-ya': (el) => {
    registrarFijo(el.dataset.id, el.dataset.fecha);
    return false;
  },
};
const juntar = (clave) => Object.assign({}, ...vistas.map((v) => v[clave] ?? {}));
const acciones = { ...comunes, ...juntar('acciones') };
const cambios = juntar('cambios');
const entradas = juntar('entradas');

// Estado de la pantalla (no se guarda): mes elegido, filtros de Movimientos, etc.
const ui = { mes: mesDeHoy(), modo: 'lista', buscar: '', tipo: 'todos', filtros: { cuenta: '', categoria: '' }, verFiltros: false, dia: null, tipoCategoria: 'gasto',
  analisisTab: 'resumen', periodo: 'mes', cuentaAnalisis: '', anio: new Date().getFullYear(), modoComparar: 'mes' };
const contenedor = document.getElementById('vista');

// Rutas: #inicio, #movimientos, #deudas, #deuda/<id>, #cuenta/<id>, #planificacion/limites…
function rutaActual() {
  const [base, param] = location.hash.slice(1).split('/');
  const vista = vistas.find((v) => (v.rutas ?? [v.id]).includes(base)) ?? inicio;
  return { vista, param: param ?? null };
}

function repintar() {
  const estado = obtener();
  usarMoneda(estado.ajustes.moneda);
  const { vista, param } = rutaActual();
  // Si se estaba escribiendo en un campo (el buscador), se devuelve el foco tras repintar.
  const foco = document.activeElement?.id && contenedor.contains(document.activeElement) ? document.activeElement : null;
  const cursor = foco?.selectionStart;
  pintar(contenedor, vista.render(estado, ui, param));
  document.title = `${vista.titulo} · Control de gastos`;
  const pestana = vista.pestana ?? vista.id;
  for (const enlace of document.querySelectorAll('#tabs a')) {
    enlace.setAttribute('aria-current', enlace.getAttribute('href') === `#${pestana}` ? 'page' : 'false');
  }
  if (foco) {
    const nuevo = document.getElementById(foco.id);
    nuevo?.focus();
    if (cursor != null) nuevo?.setSelectionRange?.(cursor, cursor);
  }
}

// Un solo oyente para todos los botones y campos: data-accion (toque), data-cambio (campo editado) y data-entrada (al escribir).
document.addEventListener('click', async (ev) => {
  const el = ev.target.closest('[data-accion]');
  const accion = el && acciones[el.dataset.accion];
  if (!accion) return;
  if ((await accion(el, ui)) !== false) repintar();
});
document.addEventListener('change', async (ev) => {
  const el = ev.target.closest('[data-cambio]');
  if (!el || !cambios[el.dataset.cambio]) return;
  await cambios[el.dataset.cambio](el, ui);
  repintar(); // deja el campo con su valor ya formateado, o con el anterior si no era válido
});
document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-entrada]');
  if (!el || !entradas[el.dataset.entrada]) return;
  entradas[el.dataset.entrada](el, ui);
  repintar();
});
window.addEventListener('hashchange', () => {
  window.scrollTo(0, 0);
  repintar();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) repintar(); // al volver a la app puede haber cambiado el día
});

iniciarHoja();
await iniciar();
alFallarGuardado(() => aviso('No se pudo guardar en este dispositivo. Haz un respaldo cuanto antes.', { fijo: true }));
suscribir(repintar);
repintar();
if (!hayGuardado()) aviso('Este navegador no permite guardar datos. Ábrela desde Safari o desde el ícono de inicio.', { fijo: true });

if ('serviceWorker' in navigator) {
  // Si ya había una versión instalada y llega una nueva, recarga para usarla (salvo que haya una hoja abierta).
  const habiaVersion = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (habiaVersion && !document.getElementById('hoja').open) location.reload();
  });
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
