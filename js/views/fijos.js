// Pagos fijos: lo que se repite (salario, alquiler, teléfono, suscripciones) y pagos programados de una sola vez.
// No se anotan solos: cuando toca, aparecen en Inicio como «Por pagar» y se marcan con un toque.
import { html, abrirHoja, aviso, campo, confirmar, entradaMonto, opciones, opcionesSelect, cabecera } from '../ui.js';
import { cambiar, obtener } from '../store.js';
import { categoriaPorId, categoriasDe, cuentasActivas, ocurrencias, omitida, pagoDeFijo, suma } from '../calc.js';
import { dinero, fechaHumana, hoyISO, numEntrada, parseMonto, sumarDias, uid } from '../format.js';
import { vacio } from './piezas.js';

export const id = 'fijos';
export const titulo = 'Pagos fijos';
export const pestana = 'ajustes';

const FRECUENCIAS = [
  ['mensual', 'Cada mes'],
  ['semanal', 'Cada semana'],
  ['trimestral', 'Cada 3 meses'],
  ['anual', 'Cada año'],
  ['unica', 'Una sola vez'],
];
const nombreFrecuencia = (f) => FRECUENCIAS.find((x) => x[0] === f)[1];
const fijoPorId = (estado, fid) => estado.fijos.find((f) => f.id === fid);

// Próxima fecha que falta registrar (o la última atrasada) de un pago fijo.
function siguiente(estado, fijo, hoy) {
  const fechas = ocurrencias(fijo, fijo.inicio, sumarDias(hoy, 400));
  return fechas.find((f) => !omitida(fijo, f) && !pagoDeFijo(estado, fijo, f)) ?? null;
}

// Cuánto suma por mes (aproximado) para comparar ingresos y pagos fijos.
const alMes = (f) => ({ mensual: f.monto, semanal: (f.monto * 52) / 12, trimestral: f.monto / 3, anual: f.monto / 12, unica: 0 })[f.frecuencia];

export function render(estado) {
  const hoy = hoyISO();
  const grupo = (tipo) => estado.fijos.filter((f) => f.tipo === tipo && f.frecuencia !== 'unica');
  const unicos = estado.fijos.filter((f) => f.frecuencia === 'unica' && siguiente(estado, f, hoy));
  const fila = (f) => {
    const prox = siguiente(estado, f, hoy);
    const cat = categoriaPorId(estado, f.categoriaId);
    const cuando = f.pausado ? 'En pausa' : prox ? `${prox < hoy ? 'Atrasado desde el' : 'Próximo:'} ${fechaHumana(prox)}` : 'Al día';
    return html`<button type="button" class="fila ${f.pausado ? 'pausado' : ''}" data-accion="fijo-editar" data-id="${f.id}">
      <span class="ico">${cat?.icono ?? '•'}</span>
      <span class="et">${f.concepto}<small class="${prox && prox < hoy && !f.pausado ? 'mal' : ''}">${f.frecuencia === 'unica' ? '' : `${nombreFrecuencia(f.frecuencia)}. `}${cuando}</small></span>
      <span class="val ${f.tipo}">${f.tipo === 'ingreso' ? '+' : '−'}${dinero(f.monto)}</span>
    </button>`;
  };
  const ingresos = grupo('ingreso');
  const gastos = grupo('gasto');
  const entra = suma(ingresos.filter((f) => !f.pausado).map(alMes));
  const sale = suma(gastos.filter((f) => !f.pausado).map(alMes));
  return html`
    ${cabecera(titulo, { accion: html`<button type="button" class="btn-mas" data-accion="fijo-nuevo" aria-label="Agregar pago fijo">+</button>` })}
    ${estado.fijos.length
      ? html`<div class="resumen-fijos">
          <div><small>Entra al mes</small><b class="ingreso">${dinero(entra)}</b></div>
          <div><small>Sale al mes</small><b>${dinero(sale)}</b></div>
          <div><small>Queda</small><b class="${entra - sale < 0 ? 'neg' : ''}">${dinero(entra - sale)}</b></div>
        </div>
        ${ingresos.length > 0 && html`<h2 class="grupo-t">Ingresos</h2><div class="grupo">${ingresos.map(fila)}</div>`}
        ${gastos.length > 0 && html`<h2 class="grupo-t">Pagos</h2><div class="grupo">${gastos.map(fila)}</div>`}
        ${unicos.length > 0 && html`<h2 class="grupo-t">Programados una sola vez</h2><div class="grupo">${unicos.map(fila)}</div>`}
        <p class="nota">Cuando llega la fecha aparecen en Inicio para marcarlos como pagados o cobrados.</p>`
      : vacio('Anota lo que se repite: tu salario, el alquiler, el plan del teléfono, la cuota del gimnasio. La app te recuerda cuándo toca y cuánto te queda.', html`<button type="button" class="btn" data-accion="fijo-nuevo">Agregar un pago fijo</button>`)}`;
}

function abrirFijo(fid) {
  const estado = obtener();
  const existente = fid ? fijoPorId(estado, fid) : null;
  const f = existente ?? { tipo: 'gasto', concepto: '', monto: null, cuentaId: cuentasActivas(estado)[0]?.id, categoriaId: null, frecuencia: 'mensual', inicio: hoyISO(), pausado: false };
  const cats = (tipo) => categoriasDe(estado, tipo).map((c) => [c.id, `${c.icono} ${c.nombre}`]);
  abrirHoja({
    titulo: existente ? 'Editar pago fijo' : 'Nuevo pago fijo',
    cuerpo: html`
      ${opciones('tipo', [['gasto', 'Pago'], ['ingreso', 'Ingreso']], f.tipo)}
      <div class="grupo separado">
        ${campo('Concepto', html`<input name="concepto" type="text" autocomplete="off" enterkeyhint="done" placeholder="Ej. Alquiler" value="${f.concepto}">`)}
        ${campo('Monto', entradaMonto('monto', f.monto == null ? '' : numEntrada(f.monto)))}
        ${campo('Se repite', html`<select name="frecuencia">${opcionesSelect(FRECUENCIAS, f.frecuencia)}</select>`)}
        ${campo('Primera fecha', html`<input name="inicio" type="date" value="${f.inicio}">`)}
        <div data-solo="gasto">${campo('Categoría', html`<select name="catGasto">${opcionesSelect(cats('gasto'), f.tipo === 'gasto' ? f.categoriaId : 'vivienda')}</select>`)}</div>
        <div data-solo="ingreso">${campo('Categoría', html`<select name="catIngreso">${opcionesSelect(cats('ingreso'), f.tipo === 'ingreso' ? f.categoriaId : 'salario')}</select>`)}</div>
        ${campo('Cuenta', html`<select name="cuenta">${opcionesSelect(estado.cuentas.filter((c) => !c.archivada || c.id === f.cuentaId).map((c) => [c.id, c.nombre]), f.cuentaId)}</select>`)}
      </div>
      <p class="nota">Si se repite, las siguientes fechas caen el mismo día de cada mes (o semana) que la primera.</p>
      ${existente && html`<div class="grupo separado"><label class="fila"><span class="et">En pausa<small>No aparece como pendiente mientras esté en pausa.</small></span><input type="checkbox" name="pausado" class="interruptor" ${f.pausado && 'checked'}></label></div>`}`,
    alAbrir(form) {
      const ajustar = () => {
        for (const el of form.querySelectorAll('[data-solo]')) el.hidden = el.dataset.solo !== form.elements.tipo.value;
      };
      ajustar();
      form.addEventListener('change', (ev) => ev.target.name === 'tipo' && ajustar());
    },
    alGuardar(datos) {
      const concepto = String(datos.get('concepto')).trim();
      const monto = parseMonto(datos.get('monto'));
      const inicio = String(datos.get('inicio'));
      const tipo = String(datos.get('tipo'));
      if (!concepto) return 'Escribe el concepto.';
      if (!(monto > 0)) return 'Escribe un monto mayor que cero.';
      if (!inicio) return 'Elige la primera fecha.';
      const valores = {
        tipo,
        concepto,
        monto,
        inicio,
        frecuencia: String(datos.get('frecuencia')),
        categoriaId: String(datos.get(tipo === 'gasto' ? 'catGasto' : 'catIngreso')),
        cuentaId: String(datos.get('cuenta')),
        pausado: datos.get('pausado') === 'on',
      };
      cambiar((e) => {
        if (existente) Object.assign(fijoPorId(e, existente.id), valores);
        else e.fijos.push({ id: uid(), omitidas: [], ...valores });
      });
      aviso(existente ? 'Pago fijo guardado' : 'Pago fijo agregado');
    },
    eliminar: existente && 'Eliminar pago fijo',
    async alEliminar() {
      if (!(await confirmar({ titulo: 'Eliminar pago fijo', mensaje: `Se quita «${existente.concepto}». Lo que ya registraste se queda en Movimientos.`, aceptar: 'Eliminar' }))) return;
      cambiar((e) => {
        e.fijos = e.fijos.filter((x) => x.id !== existente.id);
        for (const m of e.movimientos) if (m.fijo?.id === existente.id) m.fijo = null;
      });
      aviso('Pago fijo eliminado');
    },
  });
}

export const acciones = {
  'fijo-nuevo': () => {
    abrirFijo();
    return false;
  },
  'fijo-editar': (el) => {
    abrirFijo(el.dataset.id);
    return false;
  },
};
