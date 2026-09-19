// Hoja «Crucero»: faltante, abonos realizados y abono sugerido por mes.
import { html, abrirHoja, aviso, campo, entradaMonto } from '../ui.js';
import { crucero } from '../calc.js';
import { cambiar, obtener } from '../store.js';
import { dinero, fechaCorta, hoyISO, mesDeHoy, nombreMes, numEntrada, parseMonto, uid } from '../format.js';

export const id = 'crucero';
export const titulo = 'Crucero';

const X0 = 10;
const X1 = 310;
const OLAS = `M${X0} 46 q4.75 -5 9.5 0${' t9.5 0'.repeat(31)}`;

// El barco avanza por la ruta según lo ya abonado.
function ruta(avance) {
  const x = X0 + (X1 - X0) * avance;
  return html`
    <svg viewBox="0 0 320 64" role="img" aria-label="Llevas ${Math.round(avance * 100)}% del crucero pagado">
      <defs><clipPath id="hecho"><rect x="0" y="0" width="${x}" height="64"></rect></clipPath></defs>
      <path d="${OLAS}" class="ola-falta"></path>
      <path d="${OLAS}" class="ola-hecha" clip-path="url(#hecho)"></path>
      <circle cx="${X0}" cy="46" r="3.5" class="puerto"></circle>
      <circle cx="${X1}" cy="46" r="5.5" class="destino ${avance >= 1 ? 'listo' : ''}"></circle>
      <g transform="translate(${x} 45)">
        <rect x="-2.5" y="-23" width="5" height="8" rx="1" class="chimenea"></rect>
        <rect x="-9" y="-16" width="18" height="8" rx="1.5" class="barco"></rect>
        <path d="M-15 -8H15L10 0H-10Z" class="barco"></path>
      </g>
    </svg>`;
}

// «Cuota de septiembre» si el abono está ligado a un mes, seguido de la nota del usuario.
const notaAbono = (a) => [a.mes && `Cuota de ${nombreMes(a.mes).toLowerCase()}`, a.nota].filter(Boolean).join('. ');

const fila = (nombre, valor, extra = '') => html`<div class="fila ${extra}"><span class="et">${nombre}</span><span class="val">${valor}</span></div>`;

export function render(estado) {
  const c = crucero(estado);
  const avance = c.inicial > 0 ? Math.min(Math.max(c.abonado / c.inicial, 0), 1) : 0;
  const abonos = estado.abonos.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  return html`
    <h1 class="titulo">${titulo}</h1>
    <section class="hero">
      <p class="hero-et">${c.inicial > 0 && c.actual <= 0 ? 'Crucero pagado' : 'Faltante actual'}</p>
      <p class="hero-num">${dinero(Math.max(c.actual, 0))}</p>
      <div class="ruta">${ruta(avance)}</div>
      <p class="ruta-pie"><span>${Math.round(avance * 100)}% pagado</span><span>${dinero(c.abonado)} de ${dinero(c.inicial)}</span></p>
    </section>

    <h2 class="grupo-t">Seguimiento del faltante</h2>
    <div class="grupo">
      ${fila('Faltante inicial', dinero(c.inicial))}${fila('Total abonado', dinero(c.abonado, { guionSiCero: true }))}${fila('Faltante actual', dinero(c.actual), 'total')}
      <div class="fila"><span class="et">Meses restantes para pagar<small>${c.mesesPagados} de ${c.meses} cuotas pagadas. El total se cambia en <a href="#config">Config</a></small></span><span class="val">${c.restantes}</span></div>
      ${fila('Abono sugerido por mes', dinero(c.sugerido), 'total')}
    </div>

    <h2 class="grupo-t">Abonos realizados</h2>
    ${abonos.length
      ? html`<div class="grupo">${abonos.map((a) => html`<button type="button" class="fila" data-accion="abono-editar" data-id="${a.id}"><span class="et">${fechaCorta(a.fecha)}${notaAbono(a) && html`<small>${notaAbono(a)}</small>`}</span><span class="val">${dinero(a.monto)}</span></button>`)}</div>`
      : html`<p class="vacio">Aún no registras abonos. Cada abono baja el faltante actual.</p>`}
    <button type="button" class="fab" data-accion="abono-nuevo">+ Registrar abono</button>
  `;
}

function abrirHojaAbono(idAbono) {
  const estado = obtener();
  const existente = idAbono ? estado.abonos.find((a) => a.id === idAbono) : null;
  const mesesPlan = estado.meses.filter((m) => m.id >= estado.config.ahorroDesde);
  // Un abono nuevo se propone como la cuota del mes en curso, si es del plan y aún no tiene cuota pagada.
  const hoy = mesDeHoy();
  const cuotaInicial = existente ? existente.mes : mesesPlan.some((m) => m.id === hoy) && !estado.abonos.some((a) => a.mes === hoy) ? hoy : null;
  abrirHoja({
    titulo: existente ? 'Editar abono' : 'Nuevo abono',
    cuerpo: html`<div class="grupo">
      ${campo('Fecha', html`<input name="fecha" type="date" value="${existente?.fecha ?? hoyISO()}">`)}
      ${campo(
        'Cuota de',
        html`<select name="mes"><option value="">Ninguna</option>${mesesPlan.map((m) => html`<option value="${m.id}" ${m.id === cuotaInicial && 'selected'}>${nombreMes(m.id)} ${m.id.slice(0, 4)}</option>`)}</select>`,
      )}
      ${campo('Monto', entradaMonto('monto', existente ? numEntrada(existente.monto) : ''))}
      ${campo('Nota', html`<input name="nota" type="text" autocomplete="off" enterkeyhint="done" placeholder="Opcional" value="${existente?.nota ?? ''}">`)}
    </div>`,
    alGuardar(datos) {
      const fecha = String(datos.get('fecha'));
      const monto = parseMonto(datos.get('monto'));
      if (!fecha) return 'Elige la fecha del abono.';
      if (!(monto > 0)) return 'Escribe un monto mayor que cero.';
      const nota = String(datos.get('nota')).trim();
      const mes = String(datos.get('mes')) || null; // la cuota del mes a la que corresponde, si se eligió
      cambiar((e) => {
        if (existente) Object.assign(e.abonos.find((a) => a.id === existente.id), { fecha, monto, nota, mes });
        else e.abonos.push({ id: uid(), fecha, monto, nota, mes });
      });
      aviso('Abono guardado');
    },
    eliminar: existente && 'Eliminar abono',
    alEliminar() {
      cambiar((e) => {
        e.abonos = e.abonos.filter((a) => a.id !== existente.id);
      });
      aviso('Abono eliminado', { accion: 'Deshacer', alAccion: () => cambiar((e) => e.abonos.push(existente)) });
    },
  });
}

export const acciones = {
  'abono-nuevo': () => {
    abrirHojaAbono();
    return false;
  },
  'abono-editar': (el) => {
    abrirHojaAbono(el.dataset.id);
    return false;
  },
};
