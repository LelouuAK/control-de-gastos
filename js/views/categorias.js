// Categorías de gastos e ingresos: se pueden renombrar, cambiar de ícono, agregar o quitar.
import { html, abrirHoja, aviso, campo, confirmar, cabecera } from '../ui.js';
import { cambiar, obtener } from '../store.js';
import { categoriaPorId, categoriasDe } from '../calc.js';
import { uid } from '../format.js';

export const id = 'categorias';
export const titulo = 'Categorías';
export const pestana = 'ajustes';

const ICONOS = '🛒 🍔 ☕ 🚌 🚗 ⛽ 🏠 💡 💧 📱 💊 🏥 🎬 🎮 🍻 🛍️ 👕 👪 🐶 🎓 📚 ✈️ 🎁 💇 🏋️ 🙂 🧾 💳 📦 💼 ✨ 💵 🏦 📈 🐷 🎯'.split(' ');

export function render(estado, ui) {
  const tipo = ui.tipoCategoria;
  const usos = (id) => estado.movimientos.filter((m) => m.categoriaId === id).length;
  return html`
    ${cabecera(titulo, { accion: html`<button type="button" class="btn-mas" data-accion="cat-nueva" aria-label="Agregar categoría">+</button>` })}
    <div class="seg-nav" role="tablist">
      <button type="button" role="tab" aria-selected="${tipo === 'gasto'}" data-accion="cat-tipo" data-tipo="gasto">Gastos</button>
      <button type="button" role="tab" aria-selected="${tipo === 'ingreso'}" data-accion="cat-tipo" data-tipo="ingreso">Ingresos</button>
    </div>
    <div class="grupo">${categoriasDe(estado, tipo).map(
      (c) => html`<button type="button" class="fila" data-accion="cat-editar" data-id="${c.id}"><span class="ico">${c.icono}</span><span class="et">${c.nombre}</span><span class="val suave">${usos(c.id)} mov.</span></button>`,
    )}</div>`;
}

function abrirCategoria(catId, tipo) {
  const estado = obtener();
  const existente = catId ? categoriaPorId(estado, catId) : null;
  const icono = existente?.icono ?? (tipo === 'ingreso' ? '💵' : '📦');
  abrirHoja({
    titulo: existente ? 'Editar categoría' : `Nueva categoría de ${tipo === 'ingreso' ? 'ingreso' : 'gasto'}`,
    cuerpo: html`<div class="grupo">${campo('Nombre', html`<input name="nombre" type="text" autocomplete="off" enterkeyhint="done" value="${existente?.nombre ?? ''}">`)}</div>
      <h2 class="grupo-t">Ícono</h2>
      <div class="iconos" role="radiogroup">${ICONOS.map((i) => html`<label><input type="radio" name="icono" value="${i}" ${i === icono && 'checked'}><span>${i}</span></label>`)}</div>`,
    alGuardar(datos) {
      const nombre = String(datos.get('nombre')).trim();
      if (!nombre) return 'Ponle un nombre a la categoría.';
      const valores = { nombre, icono: String(datos.get('icono') ?? icono) };
      cambiar((e) => {
        if (existente) Object.assign(categoriaPorId(e, existente.id), valores);
        else e.categorias.push({ id: uid(), tipo, ...valores });
      });
      aviso(existente ? 'Categoría guardada' : 'Categoría agregada');
    },
    eliminar: existente && 'Eliminar categoría',
    async alEliminar() {
      const usada = estado.movimientos.some((m) => m.categoriaId === existente.id) || estado.fijos.some((f) => f.categoriaId === existente.id);
      if (usada) return aviso('Hay movimientos o pagos fijos en esta categoría. Cámbialos de categoría antes de eliminarla.');
      if (!(await confirmar({ titulo: 'Eliminar categoría', mensaje: `Se quita «${existente.nombre}».`, aceptar: 'Eliminar' }))) return;
      cambiar((e) => {
        e.categorias = e.categorias.filter((c) => c.id !== existente.id);
        e.limites = e.limites.filter((l) => l.categoriaId !== existente.id);
      });
      aviso('Categoría eliminada');
    },
  });
}

export const acciones = {
  'cat-tipo': (el, ui) => {
    ui.tipoCategoria = el.dataset.tipo;
  },
  'cat-nueva': (el, ui) => {
    abrirCategoria(null, ui.tipoCategoria);
    return false;
  },
  'cat-editar': (el) => {
    abrirCategoria(el.dataset.id);
    return false;
  },
};
