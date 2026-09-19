// Hoja «Extras»: lista de gastos extra (mes, concepto, monto).
import { html, abrirHoja, aviso, campo, entradaMonto } from '../ui.js';
import { cambiar, obtener } from '../store.js';
import { dinero, nombreMes, nombreMesAnio, numEntrada, parseMonto, uid } from '../format.js';

export const id = 'extras';
export const titulo = 'Gastos extras';

const suma = (xs) => xs.reduce((a, b) => a + b, 0);

export function render(estado) {
  const meses = [...new Set(estado.extras.map((x) => x.mes))].sort().reverse();
  return html`
    <h1 class="titulo">${titulo}</h1>
    <section class="hero">
      <p class="hero-et">Total de extras</p>
      <p class="hero-num">${dinero(suma(estado.extras.map((x) => x.monto)))}</p>
    </section>
    ${meses.length
      ? meses.map((m) => {
          const delMes = estado.extras.filter((x) => x.mes === m);
          return html`
            <h2 class="grupo-t con-total"><span>${nombreMesAnio(m)}</span><span>${dinero(suma(delMes.map((x) => x.monto)))}</span></h2>
            <div class="grupo">
              ${delMes
                .slice()
                .reverse()
                .map((x) => html`<button type="button" class="fila" data-accion="extra-editar" data-id="${x.id}"><span class="et">${x.concepto}</span><span class="val">${dinero(x.monto)}</span></button>`)}
            </div>`;
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
  abrirHoja({
    titulo: existente ? 'Editar extra' : 'Nuevo extra',
    cuerpo: html`<div class="grupo">
      ${campo(
        'Mes',
        html`<select name="mes">${estado.meses.map((m) => html`<option value="${m.id}" ${m.id === mesInicial && 'selected'}>${nombreMes(m.id)} ${m.id.slice(0, 4)}</option>`)}</select>`,
      )}
      ${campo('Concepto', html`<input name="concepto" type="text" autocomplete="off" enterkeyhint="next" placeholder="Ej. Regalo" value="${existente?.concepto ?? ''}">`)}
      ${campo('Monto', entradaMonto('monto', existente ? numEntrada(existente.monto) : ''))}
    </div>`,
    alGuardar(datos) {
      const concepto = String(datos.get('concepto')).trim();
      const monto = parseMonto(datos.get('monto'));
      if (!concepto) return 'Escribe el concepto del gasto.';
      if (!(monto > 0)) return 'Escribe un monto mayor que cero.';
      const mesElegido = String(datos.get('mes'));
      cambiar((e) => {
        if (existente) Object.assign(e.extras.find((x) => x.id === existente.id), { mes: mesElegido, concepto, monto });
        else e.extras.push({ id: uid(), mes: mesElegido, concepto, monto, creado: new Date().toISOString() });
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
};
