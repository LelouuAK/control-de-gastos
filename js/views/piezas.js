// Filas y bloques que se repiten en varias pantallas.
import { html } from '../ui.js';
import { categoriaPorId, cuentaPorId, deudaPorId } from '../calc.js';
import { cuandoEs, dinero, diaSemana, fechaHumana } from '../format.js';

// Un movimiento en una lista. Toque = editar.
export function filaMovimiento(estado, m, { conFecha = false } = {}) {
  const cat = categoriaPorId(estado, m.categoriaId);
  const cuenta = cuentaPorId(estado, m.cuentaId)?.nombre;
  const variasCuentas = estado.cuentas.length > 1; // con una sola cuenta no hace falta repetir su nombre
  const detalle =
    m.tipo === 'transferencia'
      ? `${cuenta} a ${cuentaPorId(estado, m.cuentaDestinoId)?.nombre}`
      : [conFecha && fechaHumana(m.fecha), cat?.nombre, variasCuentas && cuenta, m.deudaId && deudaPorId(estado, m.deudaId) && `abono a ${deudaPorId(estado, m.deudaId).nombre}`].filter(Boolean).join(', ');
  const icono = m.tipo === 'transferencia' ? '⇄' : (cat?.icono ?? '•');
  return html`<button type="button" class="fila mov" data-accion="mov-editar" data-id="${m.id}">
    <span class="ico ${m.tipo}">${icono}</span>
    <span class="et">${m.concepto}<small>${detalle}</small></span>
    <span class="val ${m.tipo}">${m.tipo === 'ingreso' ? '+' : m.tipo === 'gasto' ? '−' : ''}${dinero(m.monto)}</span>
  </button>`;
}

// Un pago fijo o una cuota que falta pagar/cobrar, con su botón rápido.
export function filaPendiente(estado, p, hoy) {
  const cat = categoriaPorId(estado, p.categoriaId);
  const cuando = p.vencido ? `Atrasado: ${fechaHumana(p.fecha)}` : `${cuandoEs(p.fecha, hoy)}${p.fecha === hoy ? '' : `, ${diaSemana(p.fecha)}`}`;
  const accion = p.clase === 'deuda' ? 'cuota-pagar' : 'pend-abrir';
  return html`<div class="fila pend ${p.vencido ? 'vencido' : ''}">
    <button type="button" class="pend-info" data-accion="${accion}" data-id="${p.id}" data-fecha="${p.fecha}">
      <span class="ico ${p.clase === 'deuda' ? 'deuda' : p.tipo}">${p.clase === 'deuda' ? '🧾' : (cat?.icono ?? '•')}</span>
      <span class="et">${p.concepto}<small>${cuando}</small></span>
      <span class="val ${p.tipo}">${p.tipo === 'ingreso' ? '+' : '−'}${dinero(p.monto)}</span>
    </button>
    <button type="button" class="rapido" data-accion="${p.clase === 'deuda' ? 'cuota-pagar' : 'pend-ya'}" data-id="${p.id}" data-fecha="${p.fecha}" aria-label="${p.tipo === 'ingreso' ? 'Marcar como cobrado' : 'Marcar como pagado'}: ${p.concepto}">${p.tipo === 'ingreso' ? 'Cobrar' : 'Pagar'}</button>
  </div>`;
}

// Etiqueta de la situación de una deuda este mes.
export function etiquetaDeuda(e, hoy) {
  if (e.situacion === 'liquidada') return html`<span class="etq ok">Pagada</span>`;
  if (e.situacion === 'pagada') return html`<span class="etq ok">Cuota del mes pagada</span>`;
  if (e.situacion === 'vencida') return html`<span class="etq mal">Cuota atrasada</span>`;
  return html`<span class="etq">Cuota: ${cuandoEs(e.fechaCuota, hoy).toLowerCase()}</span>`;
}

export const vacio = (texto, boton) => html`<div class="vacio"><p>${texto}</p>${boton}</div>`;
