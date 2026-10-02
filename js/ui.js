// Piezas de interfaz compartidas: plantillas seguras, avisos, hojas de captura y confirmaciones.
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

class Seguro {
  constructor(s) {
    this.s = s;
  }
}

const aTexto = (v) =>
  v instanceof Seguro ? v.s : Array.isArray(v) ? v.map(aTexto).join('') : v == null || v === false ? '' : String(v).replace(/[&<>"']/g, (c) => ESCAPES[c]);

// Plantilla que escapa todo lo que se le interpola (conceptos escritos por el usuario, etc.).
export const html = (partes, ...valores) => new Seguro(partes.reduce((s, p, i) => s + p + (i < valores.length ? aTexto(valores[i]) : ''), ''));
export const pintar = (el, seguro) => {
  el.innerHTML = seguro.s;
};

const $ = (id) => document.getElementById(id);

let reloj;
export function aviso(mensaje, { accion, alAccion, fijo = false } = {}) {
  const el = $('aviso');
  pintar(el, html`<span>${mensaje}</span>${accion && html`<button type="button">${accion}</button>`}`);
  el.hidden = false;
  el.querySelector('button')?.addEventListener(
    'click',
    () => {
      ocultarAviso();
      alAccion?.();
    },
    { once: true },
  );
  clearTimeout(reloj);
  if (!fijo) reloj = setTimeout(ocultarAviso, 6000);
}
export const ocultarAviso = () => {
  $('aviso').hidden = true;
};

let cerrarHoja = () => {};

// Hoja tipo iOS: Cancelar / título / Guardar. alGuardar(FormData) devuelve un texto de error o nada si todo salió bien.
// alCerrar se llama una sola vez, sea cual sea la forma de cerrar (Guardar, Cancelar, franja oscura o gesto del sistema).
export function abrirHoja({ titulo, cuerpo, guardar = 'Guardar', alGuardar, eliminar, alEliminar, alCerrar, alAbrir, compacta = false }) {
  const dlg = $('hoja');
  dlg.classList.toggle('compacta', compacta);
  let cerrada = false;
  cerrarHoja = () => {
    if (cerrada) return;
    cerrada = true;
    if (dlg.open) dlg.close();
    alCerrar?.();
  };
  pintar(
    dlg,
    html`<form novalidate>
      <header class="hoja-cab">
        <button type="button" class="cancelar" data-hoja="cerrar">Cancelar</button>
        <h2>${titulo}</h2>
        ${alGuardar && html`<button type="submit" class="guardar">${guardar}</button>`}
      </header>
      <div class="hoja-cuerpo">
        ${cuerpo}
        <p class="error" role="alert" hidden></p>
        ${eliminar && html`<button type="button" class="peligro" data-hoja="eliminar">${eliminar}</button>`}
      </div>
    </form>`,
  );
  const form = dlg.querySelector('form');
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const error = alGuardar?.(new FormData(form));
    if (!error) return cerrarHoja();
    const p = form.querySelector('.error');
    p.textContent = error;
    p.hidden = false;
  });
  form.addEventListener('click', (ev) => {
    const accion = ev.target.closest('[data-hoja]')?.dataset.hoja;
    if (accion === 'cerrar') cerrarHoja();
    if (accion === 'eliminar') {
      cerrarHoja();
      alEliminar();
    }
  });
  alAbrir?.(form);
  dlg.showModal();
}

export function confirmar({ titulo, mensaje, aceptar }) {
  return new Promise((resolver) => {
    abrirHoja({
      titulo,
      guardar: aceptar,
      compacta: true,
      cuerpo: html`<p class="mensaje">${mensaje}</p>`,
      alGuardar: () => resolver(true),
      alCerrar: () => resolver(false), // si ya se resolvió con true, esta llamada no cambia nada
    });
  });
}

export function iniciarHoja() {
  const dlg = $('hoja');
  dlg.addEventListener('click', (ev) => {
    if (ev.target === dlg) cerrarHoja(); // toque en la franja oscura de arriba
  });
  // Cierre por gesto del sistema (p. ej. tecla Esc). Solo cuenta si la hoja ya está cerrada de verdad:
  // un evento «close» tardío de la hoja anterior no debe cerrar la nueva.
  dlg.addEventListener('close', () => {
    if (!dlg.open) cerrarHoja();
  });
}

export const campo = (etiqueta, control) => html`<label class="campo"><span>${etiqueta}</span>${control}</label>`;

export const entradaMonto = (nombre, valor = '') =>
  html`<input name="${nombre}" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" placeholder="0.00" value="${valor}">`;

// Opciones excluyentes como botones (radio con estilo de control segmentado).
export const opciones = (nombre, lista, valor) =>
  html`<div class="seg" role="radiogroup">${lista.map(([v, texto]) => html`<label><input type="radio" name="${nombre}" value="${v}" ${v === valor && 'checked'}><span>${texto}</span></label>`)}</div>`;

export const opcionesSelect = (lista, valor) => lista.map(([v, texto]) => html`<option value="${v}" ${v === valor && 'selected'}>${texto}</option>`);

// Encabezado de una pantalla interior: botón para volver y, opcionalmente, una acción a la derecha.
export const cabecera = (titulo, { volver = '#ajustes', textoVolver = 'Ajustes', accion } = {}) => html`
  <header class="cab-interior">
    <a class="volver" href="${volver}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>${textoVolver}</a>
    ${accion}
  </header>
  <h1 class="titulo">${titulo}</h1>`;

// Barra de avance (0 a 1).
export const barra = (avance, clase = '') => html`<div class="barra ${clase}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(avance * 100)}"><i style="width:${Math.max(0, Math.min(1, avance)) * 100}%"></i></div>`;

// Cuotas de una deuda como fichas: llenas las pagadas, vacías las que faltan (hasta 24; si son más, una barra).
export function fichas(pagadas, total) {
  if (!(total > 0) || total > 24) return barra(total > 0 ? pagadas / total : 0, 'deuda');
  return html`<div class="fichas" role="img" aria-label="${pagadas} de ${total} cuotas pagadas">${Array.from({ length: total }, (_, i) => html`<i class="${i < pagadas ? 'llena' : ''}"></i>`)}</div>`;
}
