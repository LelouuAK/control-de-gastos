// Objetivos de ahorro: para qué estás juntando dinero, cuánto llevas y cuánto apartar al mes.
// Un aporte aparta dinero de una cuenta (sigue en la cuenta, pero ya tiene destino); retirar lo libera.
import { html, abrirHoja, aviso, campo, confirmar, entradaMonto, opciones, opcionesSelect, cabecera, barra } from '../ui.js';
import { cambiar, obtener } from '../store.js';
import { estadoObjetivo, resumenObjetivos, cuentasActivas } from '../calc.js';
import { dinero, fechaCorta, fechaHumana, hoyISO, numEntrada, parseMonto, uid } from '../format.js';
import { vacio } from './piezas.js';

export const id = 'objetivos';
export const rutas = ['objetivos', 'objetivo'];
export const titulo = 'Objetivos de ahorro';
export const pestana = 'ajustes';

const ICONOS = '🎯 🐷 🏠 🚗 🏍️ ✈️ 🎓 💍 👶 🩺 💻 📱 🎁 🛟'.split(' ');
const objetivoPorId = (estado, oid) => estado.objetivos.find((o) => o.id === oid);

function lista(estado) {
  const r = resumenObjetivos(estado);
  return html`
    ${cabecera(titulo, { accion: html`<button type="button" class="btn-mas" data-accion="obj-nuevo" aria-label="Agregar objetivo">+</button>` })}
    ${estado.objetivos.length
      ? html`<section class="hero chico"><p class="hero-et">Llevas ahorrado</p><p class="hero-num">${dinero(r.ahorrado)}</p>${barra(r.avance, 'objetivo')}<p class="hero-sub">${Math.round(r.avance * 100)}% de ${dinero(r.meta)} entre todos tus objetivos.</p></section>
        <div class="grupo">${r.lista.map(
          (o) => html`<a class="fila objetivo-fila" href="#objetivo/${o.objetivo.id}"><span class="ico">${o.objetivo.icono}</span>
            <span class="et">${o.objetivo.nombre}<small>${o.cumplido ? '¡Meta cumplida!' : `Faltan ${dinero(o.falta)}${o.porMes ? `, ${dinero(o.porMes)} al mes` : ''}`}</small>${barra(o.avance, 'objetivo')}</span>
            <span class="val">${Math.round(o.avance * 100)}%</span></a>`,
        )}</div>`
      : vacio('Ponle nombre y monto a lo que quieres lograr: un fondo de emergencia, una moto, un viaje. Cada aporte te acerca a la meta.', html`<button type="button" class="btn" data-accion="obj-nuevo">Crear un objetivo</button>`)}`;
}

function detalle(estado, oid) {
  const o = objetivoPorId(estado, oid);
  if (!o) return html`${cabecera('Objetivo', { volver: '#objetivos', textoVolver: 'Objetivos' })}<p class="fila-vacia">Este objetivo ya no existe.</p>`;
  const e = estadoObjetivo(o);
  const aportes = o.aportes.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  const cuenta = (id) => estado.cuentas.find((c) => c.id === id)?.nombre;
  return html`
    ${cabecera(`${o.icono} ${o.nombre}`, { volver: '#objetivos', textoVolver: 'Objetivos', accion: html`<button type="button" class="btn-texto" data-accion="obj-editar" data-id="${o.id}">Editar</button>` })}
    <section class="hero chico">
      <p class="hero-et">${e.cumplido ? '¡Meta cumplida!' : 'Llevas'}</p>
      <p class="hero-num">${dinero(e.ahorrado)}</p>
      ${barra(e.avance, 'objetivo')}
      <p class="hero-sub">${Math.round(e.avance * 100)}% de ${dinero(o.meta)}${e.falta > 0 ? `. Faltan ${dinero(e.falta)}` : ''}${o.fechaLimite ? `, para el ${fechaCorta(o.fechaLimite)}` : ''}${e.porMes ? ` (${dinero(e.porMes)} al mes)` : ''}.</p>
    </section>
    <div class="botones">
      <button type="button" class="btn" data-accion="obj-aportar" data-id="${o.id}">Aportar</button>
      <button type="button" class="btn sec" data-accion="obj-retirar" data-id="${o.id}" ${e.ahorrado <= 0 && 'disabled'}>Retirar</button>
    </div>
    <h2 class="grupo-t">Aportes</h2>
    ${aportes.length
      ? html`<div class="grupo">${aportes.map(
          (a) => html`<button type="button" class="fila" data-accion="aporte-editar" data-id="${o.id}" data-aporte="${a.id}"><span class="et">${a.monto < 0 ? 'Retiro' : 'Aporte'}<small>${[fechaHumana(a.fecha), cuenta(a.cuentaId), a.nota].filter(Boolean).join(', ')}</small></span><span class="val ${a.monto < 0 ? '' : 'ingreso'}">${dinero(a.monto, { signo: true })}</span></button>`,
        )}</div>`
      : html`<p class="fila-vacia">Aún no hay aportes.</p>`}`;
}

export const render = (estado, ui, param) => (param ? detalle(estado, param) : lista(estado));

function abrirObjetivo(oid) {
  const estado = obtener();
  const existente = oid ? objetivoPorId(estado, oid) : null;
  const icono = existente?.icono ?? '🎯';
  abrirHoja({
    titulo: existente ? 'Editar objetivo' : 'Nuevo objetivo',
    cuerpo: html`<div class="grupo">
        ${campo('Nombre', html`<input name="nombre" type="text" autocomplete="off" enterkeyhint="done" placeholder="Ej. Fondo de emergencia" value="${existente?.nombre ?? ''}">`)}
        ${campo('Meta', entradaMonto('meta', existente ? numEntrada(existente.meta) : ''))}
        ${campo('Fecha límite', html`<input name="fecha" type="date" value="${existente?.fechaLimite ?? ''}">`)}
      </div>
      <p class="nota">La fecha es opcional: si la pones, la app calcula cuánto apartar cada mes.</p>
      <h2 class="grupo-t">Ícono</h2>
      <div class="iconos" role="radiogroup">${ICONOS.map((i) => html`<label><input type="radio" name="icono" value="${i}" ${i === icono && 'checked'}><span>${i}</span></label>`)}</div>`,
    alGuardar(datos) {
      const nombre = String(datos.get('nombre')).trim();
      const meta = parseMonto(datos.get('meta'));
      if (!nombre) return 'Ponle un nombre al objetivo.';
      if (!(meta > 0)) return 'Escribe la meta, mayor que cero.';
      const valores = { nombre, meta, fechaLimite: String(datos.get('fecha')) || null, icono: String(datos.get('icono') ?? icono) };
      let nuevoId;
      cambiar((e) => {
        if (existente) Object.assign(objetivoPorId(e, existente.id), valores);
        else e.objetivos.push({ id: (nuevoId = uid()), creado: new Date().toISOString(), aportes: [], ...valores });
      });
      aviso(existente ? 'Objetivo guardado' : 'Objetivo creado');
      if (nuevoId) location.hash = `#objetivo/${nuevoId}`;
    },
    eliminar: existente && 'Eliminar objetivo',
    async alEliminar() {
      if (!(await confirmar({ titulo: 'Eliminar objetivo', mensaje: `Se quita «${existente.nombre}» y sus aportes. El dinero apartado vuelve a quedar libre en tus cuentas.`, aceptar: 'Eliminar' }))) return;
      cambiar((e) => {
        e.objetivos = e.objetivos.filter((o) => o.id !== existente.id);
      });
      location.hash = '#objetivos';
      aviso('Objetivo eliminado');
    },
  });
}

function abrirAporte(oid, { retiro = false, aporteId = null } = {}) {
  const estado = obtener();
  const o = objetivoPorId(estado, oid);
  const existente = aporteId ? o.aportes.find((a) => a.id === aporteId) : null;
  const esRetiro = existente ? existente.monto < 0 : retiro;
  const cuentas = [['', 'Ninguna en particular'], ...estado.cuentas.filter((c) => !c.archivada || c.id === existente?.cuentaId).map((c) => [c.id, c.nombre])];
  abrirHoja({
    titulo: existente ? 'Editar' : esRetiro ? 'Retirar' : 'Aportar',
    cuerpo: html`
      ${opciones('clase', [['aporte', 'Aportar'], ['retiro', 'Retirar']], esRetiro ? 'retiro' : 'aporte')}
      <div class="grupo separado">
        ${campo('Monto', entradaMonto('monto', existente ? numEntrada(Math.abs(existente.monto)) : ''))}
        ${campo('Cuenta', html`<select name="cuenta">${opcionesSelect(cuentas, existente?.cuentaId ?? cuentasActivas(estado)[0]?.id ?? '')}</select>`)}
        ${campo('Fecha', html`<input name="fecha" type="date" value="${existente?.fecha ?? hoyISO()}">`)}
        ${campo('Nota', html`<input name="nota" type="text" autocomplete="off" enterkeyhint="done" placeholder="Opcional" value="${existente?.nota ?? ''}">`)}
      </div>`,
    alGuardar(datos) {
      const monto = parseMonto(datos.get('monto'));
      const fecha = String(datos.get('fecha'));
      if (!(monto > 0)) return 'Escribe un monto mayor que cero.';
      if (!fecha) return 'Elige la fecha.';
      const signo = datos.get('clase') === 'retiro' ? -1 : 1;
      const ahorrado = estadoObjetivo(o).ahorrado - (existente?.monto ?? 0);
      if (signo < 0 && monto > ahorrado + 1e-9) return `Solo puedes retirar hasta ${dinero(ahorrado)}.`;
      const valores = { monto: signo * monto, fecha, cuentaId: String(datos.get('cuenta')) || null, nota: String(datos.get('nota')).trim() };
      cambiar((e) => {
        const obj = objetivoPorId(e, oid);
        if (existente) Object.assign(obj.aportes.find((a) => a.id === existente.id), valores);
        else obj.aportes.push({ id: uid(), ...valores });
      });
      aviso(signo < 0 ? 'Retiro anotado' : 'Aporte anotado');
    },
    eliminar: existente && 'Eliminar',
    alEliminar() {
      cambiar((e) => {
        const obj = objetivoPorId(e, oid);
        obj.aportes = obj.aportes.filter((a) => a.id !== existente.id);
      });
      aviso('Eliminado', { accion: 'Deshacer', alAccion: () => cambiar((e) => objetivoPorId(e, oid).aportes.push(existente)) });
    },
  });
}

export const acciones = {
  'obj-nuevo': () => {
    abrirObjetivo();
    return false;
  },
  'obj-editar': (el) => {
    abrirObjetivo(el.dataset.id);
    return false;
  },
  'obj-aportar': (el) => {
    abrirAporte(el.dataset.id);
    return false;
  },
  'obj-retirar': (el) => {
    abrirAporte(el.dataset.id, { retiro: true });
    return false;
  },
  'aporte-editar': (el) => {
    abrirAporte(el.dataset.id, { aporteId: el.dataset.aporte });
    return false;
  },
};
