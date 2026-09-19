import { iniciar, obtener, suscribir, alFallarGuardado, hayGuardado } from './store.js';
import { pintar, aviso, iniciarHoja } from './ui.js';
import { mesPorDefecto } from './calc.js';
import * as mes from './views/mes.js';
import * as ahorro from './views/ahorro.js';
import * as extras from './views/extras.js';
import * as crucero from './views/crucero.js';
import * as config from './views/config.js';

const vistas = [mes, ahorro, extras, crucero, config];
const acciones = Object.assign({}, ...vistas.map((v) => v.acciones));
const cambios = Object.assign({}, ...vistas.map((v) => v.cambios));
const ui = { mesSel: null };
const contenedor = document.getElementById('vista');

const vistaActual = () => vistas.find((v) => v.id === location.hash.slice(1)) ?? mes;

function repintar() {
  const estado = obtener();
  if (!estado.meses.some((m) => m.id === ui.mesSel)) ui.mesSel = mesPorDefecto(estado);
  const vista = vistaActual();
  pintar(contenedor, vista.render(estado, ui));
  document.title = vista.titulo;
  for (const enlace of document.querySelectorAll('#tabs a')) {
    enlace.setAttribute('aria-current', enlace.getAttribute('href') === `#${vista.id}` ? 'page' : 'false');
  }
  contenedor.querySelector('.chip[aria-current="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

// Un solo oyente para todos los botones y campos: data-accion (toque) y data-cambio (campo editado).
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-accion]');
  const accion = el && acciones[el.dataset.accion];
  if (accion && accion(el, ui) !== false) repintar();
});
document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-cambio]');
  if (!el) return;
  cambios[el.dataset.cambio]?.(el, ui);
  repintar(); // deja el campo con su valor ya formateado, o con el anterior si no era válido
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

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
