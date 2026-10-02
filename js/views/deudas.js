// Deudas: lo que debes (un préstamo, una tarjeta, un viaje a cuotas…), cuánto falta y cuánto pagar cada mes.
// Cada pago es un gasto ligado a la deuda (se anota aquí o con el botón + eligiendo «Abona a una deuda»).
import { html, abrirHoja, aviso, campo, confirmar, entradaMonto, opciones, opcionesSelect, cabecera, fichas, barra } from '../ui.js';
import { cambiar, obtener } from '../store.js';
import { deudaPorId, estadoDeuda, resumenDeudas, cuentasActivas } from '../calc.js';
import { dinero, fechaHumana, hoyISO, mesDeHoy, nombreMesAnio, numEntrada, parseMonto, uid } from '../format.js';
import { filaMovimiento, etiquetaDeuda, vacio } from './piezas.js';
import { pagarCuota } from './hojas.js';

export const id = 'deudas';
export const rutas = ['deudas', 'deuda'];
export const titulo = 'Deudas';
export const pestana = 'inicio';

function lista(estado) {
  const hoy = hoyISO();
  const r = resumenDeudas(estado, hoy);
  const activas = r.lista.filter((d) => d.situacion !== 'liquidada');
  const pagadas = r.lista.filter((d) => d.situacion === 'liquidada');
  const tarjeta = (d) => html`<a class="deuda-tarjeta" href="#deuda/${d.deuda.id}">
    <span class="dt-cab"><b>${d.deuda.nombre}</b>${etiquetaDeuda(d, hoy)}</span>
    <span class="dt-cifras"><span><small>Falta</small>${dinero(d.falta)}</span>${d.situacion !== 'liquidada' && html`<span><small>${d.situacion === 'pagada' ? 'Próxima cuota' : 'Cuota del mes'}</small>${dinero(d.cuota)}</span>`}</span>
    ${fichas(d.cuotasPagadas, d.totalCuotas)}
    <span class="dt-pie">${d.cuotasPagadas} de ${d.totalCuotas} cuotas${d.situacion !== 'liquidada' && `, termina en ${nombreMesAnio(d.fin).toLowerCase()}`}</span>
  </a>`;
  return html`
    ${cabecera(titulo, { volver: '#inicio', textoVolver: 'Inicio', accion: html`<button type="button" class="btn-mas" data-accion="deuda-nueva" aria-label="Agregar deuda">+</button>` })}
    ${estado.deudas.length
      ? html`<section class="hero chico">
          <p class="hero-et">Debes en total</p>
          <p class="hero-num">${dinero(r.falta)}</p>
          ${barra(r.total > 0 ? r.pagado / r.total : 0, 'deuda')}
          <p class="hero-sub">${dinero(r.pagado)} pagado de ${dinero(r.total)}${r.cuotasDelMes > 0 && `. Este mes te toca pagar ${dinero(r.cuotasDelMes)}.`}</p>
        </section>
        <div class="tarjetas">${activas.map(tarjeta)}</div>
        ${pagadas.length > 0 && html`<h2 class="grupo-t">Ya pagadas</h2><div class="tarjetas">${pagadas.map(tarjeta)}</div>`}`
      : vacio('Anota lo que debes: un préstamo, la tarjeta, un viaje en cuotas o dinero que te prestaron. La app reparte lo que falta en cuotas y te avisa cuando toca pagar.', html`<button type="button" class="btn" data-accion="deuda-nueva">Agregar una deuda</button>`)}`;
}

function detalle(estado, deudaId) {
  const hoy = hoyISO();
  const deuda = deudaPorId(estado, deudaId);
  if (!deuda) return html`${cabecera('Deuda', { volver: '#deudas', textoVolver: 'Deudas' })}<p class="fila-vacia">Esta deuda ya no existe.</p>`;
  const e = estadoDeuda(estado, deuda, hoy);
  const fila = (nombre, valor) => html`<div class="fila"><span class="et">${nombre}</span><span class="val">${valor}</span></div>`;
  return html`
    ${cabecera(deuda.nombre, { volver: '#deudas', textoVolver: 'Deudas', accion: html`<button type="button" class="btn-texto" data-accion="deuda-editar" data-id="${deuda.id}">Editar</button>` })}
    <section class="hero chico">
      <p class="hero-et">${e.situacion === 'liquidada' ? 'Deuda pagada por completo' : 'Falta pagar'}</p>
      <p class="hero-num">${dinero(e.falta)}</p>
      ${fichas(e.cuotasPagadas, e.totalCuotas)}
      <p class="hero-sub">${Math.round(e.avance * 100)}% pagado: ${dinero(e.pagado)} de ${dinero(deuda.total)}.</p>
    </section>
    ${e.situacion !== 'liquidada' &&
    html`<div class="cuota-mes ${e.situacion}">
      <div><small>${e.situacion === 'pagada' ? 'Próxima cuota' : `Cuota de ${nombreMesAnio(e.mesCuota).toLowerCase()}`}</small><b>${dinero(e.cuota)}</b>
      <span>${e.situacion === 'pagada' ? `Ya pagaste ${dinero(e.pagadoEsteMes)} este mes.` : `${e.situacion === 'vencida' ? 'Tocaba' : 'Toca'} el ${fechaHumana(e.fechaCuota)}.${e.pagadoEsteMes > 0 ? ` Ya abonaste ${dinero(e.pagadoEsteMes)}; falta esto.` : ''}`}</span></div>
      <button type="button" class="btn" data-accion="cuota-pagar" data-id="${deuda.id}">Registrar pago</button>
    </div>`}
    <h2 class="grupo-t">Plan de pago</h2>
    <div class="grupo">
      ${fila('Monto total', dinero(deuda.total))}
      ${fila(deuda.cuotaFija ? 'Cuota fija' : 'Número de cuotas', deuda.cuotaFija ? dinero(deuda.cuotaFija) : deuda.cuotas)}
      ${fila('Primer mes', nombreMesAnio(deuda.inicio))}
      ${fila('Día de pago', `${deuda.diaPago} de cada mes`)}
      ${e.situacion !== 'liquidada' && fila('Meses que faltan', e.mesesRestantes)}
      ${e.situacion !== 'liquidada' && fila('Terminas en', nombreMesAnio(e.fin))}
    </div>
    ${deuda.nota && html`<p class="nota">${deuda.nota}</p>`}
    <h2 class="grupo-t">Pagos realizados</h2>
    ${e.pagos.length ? html`<div class="grupo">${e.pagos.map((m) => filaMovimiento(estado, m, { conFecha: true }))}</div>` : html`<p class="fila-vacia">Aún no hay pagos. Cada pago baja lo que falta y la cuota de los meses siguientes.</p>`}`;
}

export const render = (estado, ui, param) => (param ? detalle(estado, param) : lista(estado));

function ajustarForma(form) {
  const fija = form.elements.forma.value === 'fija';
  form.querySelector('[data-forma="cuotas"]').hidden = fija;
  form.querySelector('[data-forma="fija"]').hidden = !fija;
}

function abrirDeuda(deudaId) {
  const estado = obtener();
  const existente = deudaId ? deudaPorId(estado, deudaId) : null;
  const d = existente ?? { nombre: '', total: null, cuotas: 12, cuotaFija: null, inicio: mesDeHoy(), diaPago: new Date().getDate(), cuentaId: cuentasActivas(estado)[0]?.id, nota: '' };
  abrirHoja({
    titulo: existente ? 'Editar deuda' : 'Nueva deuda',
    cuerpo: html`
      <div class="grupo">
        ${campo('Nombre', html`<input name="nombre" type="text" autocomplete="off" enterkeyhint="done" placeholder="Ej. Préstamo del carro" value="${d.nombre}">`)}
        ${campo('Monto total', entradaMonto('total', d.total == null ? '' : numEntrada(d.total)))}
      </div>
      <p class="nota">El monto que debes al empezar a anotarla. Si ya pagaste una parte antes, pon solo lo que falta.</p>
      <h2 class="grupo-t">Cómo la pagas</h2>
      ${opciones(
        'forma',
        [
          ['cuotas', 'En un número de meses'],
          ['fija', 'Con cuota fija'],
        ],
        d.cuotaFija ? 'fija' : 'cuotas',
      )}
      <div class="grupo separado">
        <div data-forma="cuotas">${campo('Número de cuotas', html`<input name="cuotas" type="text" inputmode="numeric" autocomplete="off" value="${d.cuotas}">`)}</div>
        <div data-forma="fija">${campo('Cuota mensual', entradaMonto('cuotaFija', d.cuotaFija ? numEntrada(d.cuotaFija) : ''))}</div>
        ${campo('Primer mes de pago', html`<input name="inicio" type="month" value="${d.inicio}">`)}
        ${campo('Día de pago', html`<input name="dia" type="text" inputmode="numeric" autocomplete="off" value="${d.diaPago}">`)}
        ${campo('Se paga desde', html`<select name="cuenta">${opcionesSelect(estado.cuentas.filter((c) => !c.archivada || c.id === d.cuentaId).map((c) => [c.id, c.nombre]), d.cuentaId)}</select>`)}
        ${campo('Nota', html`<input name="nota" type="text" autocomplete="off" enterkeyhint="done" placeholder="Opcional: a quién, tasa, etc." value="${d.nota}">`)}
      </div>`,
    alAbrir(form) {
      ajustarForma(form);
      form.addEventListener('change', (ev) => ev.target.name === 'forma' && ajustarForma(form));
    },
    alGuardar(datos) {
      const nombre = String(datos.get('nombre')).trim();
      const total = parseMonto(datos.get('total'));
      const fija = datos.get('forma') === 'fija';
      const cuotas = Number(datos.get('cuotas'));
      const cuotaFija = fija ? parseMonto(datos.get('cuotaFija')) : null;
      const inicio = String(datos.get('inicio'));
      const diaPago = Number(datos.get('dia'));
      if (!nombre) return 'Ponle un nombre a la deuda.';
      if (!(total > 0)) return 'Escribe el monto total, mayor que cero.';
      if (fija && !(cuotaFija > 0)) return 'Escribe la cuota mensual.';
      if (!fija && !(Number.isInteger(cuotas) && cuotas >= 1 && cuotas <= 600)) return 'El número de cuotas es un número entero, de 1 en adelante.';
      if (!/^\d{4}-\d{2}$/.test(inicio)) return 'Elige el primer mes de pago.';
      if (!(Number.isInteger(diaPago) && diaPago >= 1 && diaPago <= 31)) return 'El día de pago va de 1 a 31.';
      const valores = { nombre, total, cuotas: fija ? (existente?.cuotas ?? 1) : cuotas, cuotaFija, inicio, diaPago, cuentaId: String(datos.get('cuenta')), nota: String(datos.get('nota')).trim() };
      let nuevoId;
      cambiar((e) => {
        if (existente) Object.assign(deudaPorId(e, existente.id), valores);
        else e.deudas.push({ id: (nuevoId = uid()), creado: new Date().toISOString(), ...valores });
      });
      aviso(existente ? 'Deuda guardada' : 'Deuda agregada');
      if (nuevoId) location.hash = `#deuda/${nuevoId}`;
    },
    eliminar: existente && 'Eliminar deuda',
    async alEliminar() {
      const pagos = estado.movimientos.filter((m) => m.deudaId === existente.id).length;
      const seguro = await confirmar({
        titulo: 'Eliminar deuda',
        mensaje: pagos ? `Se quita «${existente.nombre}». Sus ${pagos} pagos se quedan en Movimientos como gastos normales.` : `Se quita «${existente.nombre}».`,
        aceptar: 'Eliminar',
      });
      if (!seguro) return;
      cambiar((e) => {
        e.deudas = e.deudas.filter((x) => x.id !== existente.id);
        for (const m of e.movimientos) if (m.deudaId === existente.id) m.deudaId = null;
      });
      location.hash = '#deudas';
      aviso('Deuda eliminada');
    },
  });
}

export const acciones = {
  'deuda-nueva': () => {
    abrirDeuda();
    return false;
  },
  'deuda-editar': (el) => {
    abrirDeuda(el.dataset.id);
    return false;
  },
  'cuota-pagar': (el) => {
    pagarCuota(el.dataset.id);
    return false;
  },
};
