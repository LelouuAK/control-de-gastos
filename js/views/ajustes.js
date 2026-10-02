// Ajustes: tu dinero (cuentas, categorías, deudas, objetivos, pagos fijos), preferencias y tus datos.
import { html, aviso, confirmar } from '../ui.js';
import { cambiar, reemplazarDatos } from '../store.js';
import { patrimonio, resumenDeudas, resumenObjetivos } from '../calc.js';
import { MONEDAS, dinero, fechaCorta } from '../format.js';
import { leerRespaldo, hacerRespaldo, exportarCSV } from '../respaldo.js';
import { datosNuevos } from '../seed.js';
import { VERSION_APP } from '../version.js';

export const id = 'ajustes';
export const titulo = 'Ajustes';

const enlace = (href, ico, nombre, detalle) => html`<a class="fila" href="${href}"><span class="ico">${ico}</span><span class="et">${nombre}<small>${detalle}</small></span><span class="flecha" aria-hidden="true"></span></a>`;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

export function render(estado) {
  const a = estado.ajustes;
  const activas = estado.cuentas.filter((c) => !c.archivada).length;
  const deudas = resumenDeudas(estado);
  const objetivos = resumenObjetivos(estado);
  const ultimo = estado.meta.ultimoRespaldo;
  return html`
    <h1 class="titulo">${titulo}</h1>

    <h2 class="grupo-t">Tu dinero</h2>
    <div class="grupo">
      ${enlace('#cuentas', '🏦', 'Cuentas', `${plural(activas, 'cuenta', 'cuentas')}, ${dinero(patrimonio(estado))} en total`)}
      ${enlace('#fijos', '🔁', 'Pagos fijos', estado.fijos.length ? plural(estado.fijos.length, 'pago fijo', 'pagos fijos') : 'Salario, alquiler, teléfono…')}
      ${enlace('#deudas', '🧾', 'Deudas', estado.deudas.length ? `${plural(estado.deudas.length, 'deuda', 'deudas')}, faltan ${dinero(deudas.falta)}` : 'Lo que debes y en cuántas cuotas')}
      ${enlace('#objetivos', '🎯', 'Objetivos de ahorro', estado.objetivos.length ? `${plural(estado.objetivos.length, 'objetivo', 'objetivos')}, ${dinero(objetivos.ahorrado)} ahorrado` : 'Para qué estás ahorrando')}
      ${enlace('#categorias', '🏷️', 'Categorías', plural(estado.categorias.length, 'categoría', 'categorías'))}
    </div>

    <h2 class="grupo-t">Herramientas</h2>
    <div class="grupo">
      ${enlace('#planificacion', '🧭', 'Planificación', estado.limites.length ? `Cuánto puedes gastar, ${plural(estado.limites.length, 'límite', 'límites')} y avisos` : 'Cuánto puedes gastar, límites y avisos')}
      ${enlace('#centro', '🩺', 'Centro financiero', 'Salud financiera, fondo de emergencia y previsión')}
    </div>

    <h2 class="grupo-t">Preferencias</h2>
    <div class="grupo">
      <label class="fila"><span class="et">Tu nombre<small>Para saludarte en Inicio</small></span><input class="num texto" type="text" autocomplete="given-name" data-cambio="nombre" value="${a.nombre}" placeholder="Opcional"></label>
      <label class="fila"><span class="et">Moneda<small>Solo cambia el símbolo; no convierte montos</small></span>
        <select data-cambio="moneda">${MONEDAS.map(([cod, sim, nombre]) => html`<option value="${cod}" ${cod === a.moneda && 'selected'}>${cod} (${sim}) ${nombre}</option>`)}</select></label>
      <label class="fila"><span class="et">Meta de ahorro<small>Parte de tus ingresos que quieres guardar</small></span>
        <select data-cambio="meta">${[0, 5, 10, 15, 20, 25, 30, 40, 50].map((p) => html`<option value="${p}" ${Math.round(a.metaAhorroPct * 100) === p && 'selected'}>${p}%</option>`)}</select></label>
    </div>

    <h2 class="grupo-t">Tus datos</h2>
    <div class="grupo">
      <div class="fila"><span class="et">Último respaldo</span><span class="val suave">${ultimo ? fechaCorta(ultimo) : 'Nunca'}</span></div>
      <button type="button" class="fila accion" data-accion="respaldar">Respaldar ahora</button>
      <label class="fila accion">Restaurar desde un archivo<input type="file" class="oculto" accept=".json,application/json" data-cambio="restaurar"></label>
      <button type="button" class="fila accion" data-accion="csv">Exportar movimientos (Excel/CSV)</button>
      <button type="button" class="fila accion peligro" data-accion="borrar-todo">Borrar todo y empezar en blanco</button>
    </div>
    <p class="nota">Tus datos se guardan solo en este teléfono. El respaldo es un archivo que puedes guardar en Archivos o iCloud Drive; también acepta respaldos de la versión anterior.</p>
    <p class="nota centro">Control de gastos ${VERSION_APP}</p>`;
}

export const acciones = {
  respaldar: () => {
    hacerRespaldo();
    return false;
  },
  csv: () => {
    exportarCSV();
    return false;
  },
  'borrar-todo': async () => {
    const seguro = await confirmar({ titulo: 'Borrar todo', mensaje: 'Se borrarán tus cuentas, movimientos, pagos fijos, deudas y objetivos de este teléfono. Haz un respaldo antes si quieres conservarlos.', aceptar: 'Borrar' });
    if (seguro) {
      reemplazarDatos(datosNuevos());
      aviso('Datos borrados');
    }
    return false;
  },
};

export const cambios = {
  nombre: (el) =>
    cambiar((e) => {
      e.ajustes.nombre = el.value.trim().slice(0, 30);
    }),
  moneda: (el) =>
    cambiar((e) => {
      e.ajustes.moneda = el.value;
    }),
  meta: (el) =>
    cambiar((e) => {
      e.ajustes.metaAhorroPct = Number(el.value) / 100;
    }),
  restaurar: async (el) => {
    const archivo = el.files?.[0];
    el.value = ''; // permite elegir el mismo archivo otra vez
    if (!archivo) return;
    try {
      const datos = leerRespaldo(await archivo.text());
      const resumen = `${plural(datos.movimientos.length, 'movimiento', 'movimientos')}, ${plural(datos.fijos.length, 'pago fijo', 'pagos fijos')} y ${plural(datos.deudas.length, 'deuda', 'deudas')}`;
      const seguro = await confirmar({ titulo: 'Restaurar datos', mensaje: `Se reemplazarán los datos actuales por los del archivo (${resumen}).`, aceptar: 'Restaurar' });
      if (!seguro) return;
      reemplazarDatos(datos);
      aviso('Datos restaurados');
    } catch (err) {
      aviso(err.message);
    }
  },
};
