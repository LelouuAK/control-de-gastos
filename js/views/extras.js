// Hoja «Extras»: lista de gastos extra (mes, concepto, monto) y su estado Pagado/Pendiente.
import { html, abrirHoja, aviso, campo, entradaMonto } from '../ui.js';
import { cambiar, obtener } from '../store.js';
import { dinero, nombreMes, nombreMesAnio, numEntrada, parseMonto, uid } from '../format.js';

export const id = 'extras';
export const titulo = 'Gastos extras';

const suma = (xs) => xs.reduce((a, b) => a + b, 0);

// Fila de un extra: tocar el texto lo edita; tocar la etiqueta lo cambia entre Pagado y Pendiente.
export const filaExtra = (x, sub = false) => html`
  <div class="fila fila-extra ${sub && 'sub'}">
    <button type="button" class="et" data-accion="extra-editar" data-id="${x.id}">${x.concepto}</button>
    <span class="val">${dinero(x.monto)}</span>
    <button type="button" class="etq ${x.estado === 'Pendiente' ? 'warn' : 'ok'}" data-accion="extra-estado" data-id="${x.id}" aria-label="${x.concepto}: ${x.estado}. Toca para cambiar.">${x.estado}</button>
  </div>`;

export function render(estado) {
  const meses = [...new Set(estado.extras.map((x) => x.mes))].sort().reverse();
  const pendientes = suma(estado.extras.filter((x) => x.estado === 'Pendiente').map((x) => x.monto));
  const total = suma(estado.extras.map((x) => x.monto));
  return html`
    <h1 class="titulo">${titulo}</h1>
    <section class="hero">
      <p class="hero-et">Total de extras</p>
      <p class="hero-num">${dinero(total)}</p>
      <ul class="leyenda dos">
        <li><span>Pagado</span><b>${dinero(total - pendientes)}</b></li>
        <li><span>Pendiente</span><b>${dinero(pendientes)}</b></li>
      </ul>
    </section>
    ${meses.length
      ? meses.map((m) => {
          const delMes = estado.extras.filter((x) => x.mes === m);
          return html`
            <h2 class="grupo-t con-total"><span>${nombreMesAnio(m)}</span><span>${dinero(suma(delMes.map((x) => x.monto)))}</span></h2>
            <div class="grupo">${delMes.slice().reverse().map((x) => filaExtra(x))}</div>`;
        })
      : html`<p class="vacio">Aún no hay extras. Toca «Anotar extra» para agregar el primero.</p>`}
    <button type="button" class="fab" data-accion="extra-nuevo">+ Anotar extra</button>
  `;
}

// Hoja de captura para agregar o editar un extra (se usa desde Mes y desde Extras).
export function abrirHojaExtra({ mes, id: idExtra }) {
  const estado = obtener();
  const existente = idExtra ? estado.extras.find((x) => x.id === idExtra) : null;
  const mesInicial = existente?.mes ?? mes;
  const estadoInicial = existente?.estado ?? 'Pagado'; // como en el Excel, un extra nuevo se asume ya pagado
  abrirHoja({
    titulo: existente ? 'Editar extra' : 'Nuevo extra',
    cuerpo: html`<div class="grupo">
      ${campo(
        'Mes',
        html`<select name="mes">${estado.meses.map((m) => html`<option value="${m.id}" ${m.id === mesInicial && 'selected'}>${nombreMes(m.id)} ${m.id.slice(0, 4)}</option>`)}</select>`,
      )}
      ${campo('Concepto', html`<input name="concepto" type="text" autocomplete="off" enterkeyhint="next" placeholder="Ej. Regalo" value="${existente?.concepto ?? ''}">`)}
      ${campo('Monto', entradaMonto('monto', existente ? numEntrada(existente.monto) : ''))}
      <div class="campo">
        <span>Estado</span>
        <div class="seg" role="radiogroup" aria-label="Estado del extra">
          ${['Pendiente', 'Pagado'].map((v) => html`<label class="${v === 'Pagado' ? 'pag' : 'pend'}"><input type="radio" name="estado" value="${v}" ${v === estadoInicial && 'checked'}><span>${v}</span></label>`)}
        </div>
      </div>
    </div>`,
    alGuardar(datos) {
      const concepto = String(datos.get('concepto')).trim();
      const monto = parseMonto(datos.get('monto'));
      if (!concepto) return 'Escribe el concepto del gasto.';
      if (!(monto > 0)) return 'Escribe un monto mayor que cero.';
      const mesElegido = String(datos.get('mes'));
      const estadoElegido = datos.get('estado') === 'Pendiente' ? 'Pendiente' : 'Pagado';
      cambiar((e) => {
        if (existente) Object.assign(e.extras.find((x) => x.id === existente.id), { mes: mesElegido, concepto, monto, estado: estadoElegido });
        else e.extras.push({ id: uid(), mes: mesElegido, concepto, monto, estado: estadoElegido, creado: new Date().toISOString() });
      });
      aviso('Extra guardado');
    },
    eliminar: existente && 'Eliminar extra',
    alEliminar() {
      cambiar((e) => {
        e.extras = e.extras.filter((x) => x.id !== existente.id);
      });
      aviso('Extra eliminado', { accion: 'Deshacer', alAccion: () => cambiar((e) => e.extras.push(existente)) });
    },
  });
}

export const acciones = {
  'extra-nuevo': (el, ui) => {
    abrirHojaExtra({ mes: ui.mesSel });
    return false;
  },
  'extra-editar': (el) => {
    abrirHojaExtra({ id: el.dataset.id });
    return false;
  },
  'extra-estado': (el) =>
    cambiar((e) => {
      const extra = e.extras.find((x) => x.id === el.dataset.id);
      extra.estado = extra.estado === 'Pendiente' ? 'Pagado' : 'Pendiente';
    }),
};
