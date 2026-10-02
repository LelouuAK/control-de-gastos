// Hojas de captura que se usan desde varias pantallas: movimiento (botón +) y pagos pendientes.
import { html, abrirHoja, aviso, campo, entradaMonto, opciones, opcionesSelect } from '../ui.js';
import { cambiar, obtener } from '../store.js';
import { cuentasActivas, categoriasDe, cuentaPorId, deudaPorId, estadoDeuda } from '../calc.js';
import { estadoLimites } from '../finanzas.js';
import { dinero, fechaHumana, hoyISO, numEntrada, parseMonto, uid } from '../format.js';

const TIPOS = [
  ['gasto', 'Gasto'],
  ['ingreso', 'Ingreso'],
  ['transferencia', 'Transferencia'],
];

// Muestra solo los campos que corresponden al tipo elegido (gasto, ingreso o transferencia).
function ajustarTipo(form) {
  const tipo = form.elements.tipo.value;
  for (const el of form.querySelectorAll('[data-solo]')) el.hidden = !el.dataset.solo.split(' ').includes(tipo);
}

// Nuevo movimiento o edición de uno existente. «previo» rellena los campos (p. ej. el pago de una cuota).
export function abrirMovimiento({ id, previo = {} } = {}) {
  const estado = obtener();
  const existente = id ? estado.movimientos.find((m) => m.id === id) : null;
  const dados = Object.fromEntries(Object.entries(previo).filter(([, v]) => v !== undefined));
  const m = existente ?? { tipo: 'gasto', fecha: hoyISO(), cuentaId: cuentasActivas(estado)[0]?.id, ...dados };
  const cuentas = (incluir) => estado.cuentas.filter((c) => !c.archivada || c.id === incluir).map((c) => [c.id, c.nombre]);
  const cats = (tipo) => categoriasDe(estado, tipo).map((c) => [c.id, `${c.icono} ${c.nombre}`]);
  const vinculo = m.fijo ? estado.fijos.find((f) => f.id === m.fijo.id) : null;

  abrirHoja({
    titulo: existente ? 'Editar movimiento' : 'Nuevo movimiento',
    cuerpo: html`
      ${opciones('tipo', TIPOS, m.tipo)}
      <label class="monto-grande"><span>Monto</span>${entradaMonto('monto', m.monto ? numEntrada(m.monto) : '')}</label>
      <div class="grupo">
        ${campo('Concepto', html`<input name="concepto" type="text" autocomplete="off" enterkeyhint="done" placeholder="Ej. Supermercado" value="${m.concepto ?? ''}">`)}
        <div data-solo="gasto">${campo('Categoría', html`<select name="catGasto">${opcionesSelect(cats('gasto'), m.tipo === 'gasto' ? m.categoriaId : 'comida')}</select>`)}</div>
        <div data-solo="ingreso">${campo('Categoría', html`<select name="catIngreso">${opcionesSelect(cats('ingreso'), m.tipo === 'ingreso' ? m.categoriaId : 'salario')}</select>`)}</div>
        ${campo(html`<span data-solo="gasto ingreso">Cuenta</span><span data-solo="transferencia">Desde</span>`, html`<select name="cuenta">${opcionesSelect(cuentas(m.cuentaId), m.cuentaId)}</select>`)}
        <div data-solo="transferencia">${campo('Hacia', html`<select name="destino">${opcionesSelect(cuentas(m.cuentaDestinoId), m.cuentaDestinoId ?? cuentasActivas(estado).find((c) => c.id !== m.cuentaId)?.id)}</select>`)}</div>
        ${campo('Fecha', html`<input name="fecha" type="date" value="${m.fecha}">`)}
        ${estado.deudas.length > 0 &&
        html`<div data-solo="gasto">${campo('Abona a una deuda', html`<select name="deuda"><option value="">No</option>${opcionesSelect(estado.deudas.map((d) => [d.id, d.nombre]), m.deudaId)}</select>`)}</div>`}
        ${campo('Nota', html`<input name="nota" type="text" autocomplete="off" enterkeyhint="done" placeholder="Opcional" value="${m.nota ?? ''}">`)}
      </div>
      ${vinculo && html`<p class="nota">Registrado como el pago fijo «${vinculo.concepto}» del ${fechaHumana(m.fijo.fecha)}.</p>`}`,
    alAbrir(form) {
      ajustarTipo(form);
      form.addEventListener('change', (ev) => {
        if (ev.target.name === 'tipo') ajustarTipo(form);
        // Un pago de deuda va a la categoría Deudas, salvo que la persona elija otra.
        if (ev.target.name === 'deuda' && ev.target.value && form.elements.catGasto.querySelector('option[value="deudas"]')) form.elements.catGasto.value = 'deudas';
      });
    },
    alGuardar(datos) {
      const tipo = String(datos.get('tipo'));
      const monto = parseMonto(datos.get('monto'));
      const fecha = String(datos.get('fecha'));
      const cuentaId = String(datos.get('cuenta'));
      const cuentaDestinoId = tipo === 'transferencia' ? String(datos.get('destino')) : null;
      if (!(monto > 0)) return 'Escribe un monto mayor que cero.';
      if (!fecha) return 'Elige la fecha.';
      if (!cuentaId) return 'Primero crea una cuenta en Ajustes.';
      if (tipo === 'transferencia' && cuentaDestinoId === cuentaId) return 'Elige dos cuentas distintas.';
      const categoriaId = tipo === 'gasto' ? String(datos.get('catGasto')) : tipo === 'ingreso' ? String(datos.get('catIngreso')) : null;
      const deudaId = tipo === 'gasto' ? String(datos.get('deuda') ?? '') || null : null;
      const nombreCategoria = estado.categorias.find((c) => c.id === categoriaId)?.nombre;
      const concepto = String(datos.get('concepto')).trim() || (deudaId ? `Pago de ${deudaPorId(estado, deudaId).nombre}` : tipo === 'transferencia' ? 'Transferencia' : nombreCategoria);
      const valores = { tipo, monto, concepto, fecha, cuentaId, cuentaDestinoId, categoriaId, deudaId, nota: String(datos.get('nota')).trim() };
      cambiar((e) => {
        if (existente) Object.assign(e.movimientos.find((x) => x.id === existente.id), valores);
        else e.movimientos.push({ id: uid(), fijo: m.fijo ?? null, creado: new Date().toISOString(), ...valores });
      });
      // Si la categoría tiene límite, se dice cuánto queda de él este mes.
      const limite = tipo === 'gasto' && estadoLimites(obtener(), fecha.slice(0, 7)).find((l) => l.categoriaId === categoriaId);
      const resto = limite ? (limite.queda >= 0 ? ` Te quedan ${dinero(limite.queda)} de ${limite.categoria.nombre}.` : ` Te pasaste ${dinero(-limite.queda)} del límite de ${limite.categoria.nombre}.`) : '';
      aviso(`${existente ? 'Movimiento guardado' : tipo === 'ingreso' ? 'Ingreso anotado' : tipo === 'gasto' ? 'Gasto anotado' : 'Transferencia anotada'}.${resto}`);
    },
    eliminar: existente && 'Eliminar movimiento',
    alEliminar() {
      cambiar((e) => {
        e.movimientos = e.movimientos.filter((x) => x.id !== existente.id);
      });
      aviso('Movimiento eliminado', { accion: 'Deshacer', alAccion: () => cambiar((e) => e.movimientos.push(existente)) });
    },
  });
}

// Registra de un toque un pago fijo pendiente (con su monto y la fecha de hoy).
export function registrarFijo(fijoId, fecha) {
  const fijo = obtener().fijos.find((f) => f.id === fijoId);
  if (!fijo) return;
  const mov = { id: uid(), tipo: fijo.tipo, monto: fijo.monto, concepto: fijo.concepto, fecha: hoyISO(), cuentaId: fijo.cuentaId, cuentaDestinoId: null, categoriaId: fijo.categoriaId, nota: '', deudaId: null, fijo: { id: fijo.id, fecha }, creado: new Date().toISOString() };
  cambiar((e) => e.movimientos.push(mov));
  aviso(`${fijo.concepto}: ${fijo.tipo === 'ingreso' ? 'cobrado' : 'pagado'}`, {
    accion: 'Deshacer',
    alAccion: () =>
      cambiar((e) => {
        e.movimientos = e.movimientos.filter((x) => x.id !== mov.id);
      }),
  });
}

// Opciones de un pago fijo pendiente: registrar tal cual, registrar con otro monto o fecha, u omitir esta vez.
export function abrirPendiente(fijoId, fecha) {
  const fijo = obtener().fijos.find((f) => f.id === fijoId);
  if (!fijo) return;
  const verbo = fijo.tipo === 'ingreso' ? 'cobrado' : 'pagado';
  abrirHoja({
    titulo: fijo.concepto,
    compacta: true,
    cuerpo: html`
      <p class="mensaje">${dinero(fijo.monto)}, toca el ${fechaHumana(fecha)}.</p>
      <div class="grupo">
        <button type="button" class="fila accion" data-hoja-op="ya">Marcar como ${verbo}</button>
        <button type="button" class="fila accion" data-hoja-op="cambios">Anotar con otro monto o fecha</button>
        <button type="button" class="fila accion" data-hoja-op="omitir">Omitir esta vez</button>
      </div>`,
    alAbrir(form) {
      form.addEventListener('click', (ev) => {
        const op = ev.target.closest('[data-hoja-op]')?.dataset.hojaOp;
        if (!op) return;
        form.querySelector('[data-hoja="cerrar"]').click();
        if (op === 'ya') registrarFijo(fijoId, fecha);
        if (op === 'cambios') abrirMovimiento({ previo: { tipo: fijo.tipo, monto: fijo.monto, concepto: fijo.concepto, cuentaId: fijo.cuentaId, categoriaId: fijo.categoriaId, fijo: { id: fijo.id, fecha } } });
        if (op === 'omitir') {
          cambiar((e) => e.fijos.find((f) => f.id === fijoId).omitidas.push(fecha));
          aviso(`${fijo.concepto} omitido este ${fechaHumana(fecha)}`, {
            accion: 'Deshacer',
            alAccion: () =>
              cambiar((e) => {
                const f = e.fijos.find((x) => x.id === fijoId);
                f.omitidas = f.omitidas.filter((o) => o !== fecha);
              }),
          });
        }
      });
    },
  });
}

// Pago de una cuota: abre la hoja de movimiento con la cuota sugerida, que se puede cambiar.
export function pagarCuota(deudaId) {
  const estado = obtener();
  const deuda = deudaPorId(estado, deudaId);
  const e = estadoDeuda(estado, deuda);
  const cuenta = cuentaPorId(estado, deuda.cuentaId);
  abrirMovimiento({
    previo: { tipo: 'gasto', monto: e.situacion === 'pagada' ? e.cuota : e.cuota || e.falta, concepto: `Pago de ${deuda.nombre}`, categoriaId: 'deudas', deudaId, cuentaId: cuenta && !cuenta.archivada ? cuenta.id : undefined },
  });
}
