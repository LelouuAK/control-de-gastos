// Cuentas: dónde está tu dinero (banco, efectivo, tarjeta…), cada una con su saldo y sus movimientos.
import { html, abrirHoja, aviso, campo, confirmar, entradaMonto, opcionesSelect, cabecera } from '../ui.js';
import { cambiar, obtener } from '../store.js';
import { cuentaPorId, saldoCuenta, reservadoEnCuenta, patrimonio, ordenarMovimientos, suma } from '../calc.js';
import { dinero, numEntrada, parseMonto, uid } from '../format.js';
import { filaMovimiento } from './piezas.js';
import { iconoCuenta } from './inicio.js';

export const id = 'cuentas';
export const rutas = ['cuentas', 'cuenta'];
export const titulo = 'Cuentas';
export const pestana = 'ajustes';

const TIPOS = [
  ['banco', 'Cuenta de banco'],
  ['efectivo', 'Efectivo'],
  ['tarjeta', 'Tarjeta'],
  ['ahorro', 'Ahorros'],
  ['otro', 'Otra'],
];

function lista(estado) {
  const activas = estado.cuentas.filter((c) => !c.archivada);
  const archivadas = estado.cuentas.filter((c) => c.archivada);
  const fila = (c) => html`<a class="fila" href="#cuenta/${c.id}"><span class="ico">${iconoCuenta(c.tipo)}</span><span class="et">${c.nombre}<small>${TIPOS.find((t) => t[0] === c.tipo)?.[1]}</small></span><span class="val ${saldoCuenta(estado, c.id) < 0 ? 'neg' : ''}">${dinero(saldoCuenta(estado, c.id))}</span></a>`;
  return html`
    ${cabecera(titulo, { accion: html`<button type="button" class="btn-mas" data-accion="cuenta-nueva" aria-label="Agregar cuenta">+</button>` })}
    <section class="hero chico"><p class="hero-et">Tienes en total</p><p class="hero-num">${dinero(patrimonio(estado))}</p></section>
    <div class="grupo">${activas.map(fila)}</div>
    ${archivadas.length > 0 && html`<h2 class="grupo-t">Archivadas</h2><div class="grupo">${archivadas.map(fila)}</div>`}
    <p class="nota">Separa tu dinero como lo tienes en la vida real. Al anotar un gasto eliges de qué cuenta salió.</p>`;
}

function detalle(estado, cuentaId) {
  const c = cuentaPorId(estado, cuentaId);
  if (!c) return html`${cabecera('Cuenta', { volver: '#cuentas', textoVolver: 'Cuentas' })}<p class="fila-vacia">Esta cuenta ya no existe.</p>`;
  const movs = ordenarMovimientos(estado.movimientos.filter((m) => m.cuentaId === c.id || m.cuentaDestinoId === c.id));
  const reservado = reservadoEnCuenta(estado, c.id);
  const entra = suma(movs.filter((m) => (m.tipo === 'ingreso' || m.cuentaDestinoId === c.id) && m.tipo !== 'gasto').map((m) => m.monto));
  const sale = suma(movs.filter((m) => m.tipo === 'gasto' || (m.tipo === 'transferencia' && m.cuentaId === c.id)).map((m) => m.monto));
  return html`
    ${cabecera(c.nombre, { volver: '#cuentas', textoVolver: 'Cuentas', accion: html`<button type="button" class="btn-texto" data-accion="cuenta-editar" data-id="${c.id}">Editar</button>` })}
    <section class="hero chico">
      <p class="hero-et">Saldo actual${c.archivada ? ' (archivada)' : ''}</p>
      <p class="hero-num ${saldoCuenta(estado, c.id) < 0 ? 'neg' : ''}">${dinero(saldoCuenta(estado, c.id))}</p>
      ${reservado > 0 && html`<p class="hero-sub">${dinero(reservado)} apartado para objetivos; libre ${dinero(saldoCuenta(estado, c.id) - reservado)}.</p>`}
    </section>
    <div class="grupo">
      <div class="fila"><span class="et">Entró</span><span class="val ingreso">+${dinero(entra)}</span></div>
      <div class="fila"><span class="et">Salió</span><span class="val">−${dinero(sale)}</span></div>
      <button type="button" class="fila accion" data-accion="cuenta-ajustar" data-id="${c.id}">Corregir el saldo</button>
    </div>
    <h2 class="grupo-t">Movimientos de esta cuenta</h2>
    ${movs.length ? html`<div class="grupo">${movs.slice(0, 60).map((m) => filaMovimiento(estado, m, { conFecha: true }))}</div>` : html`<p class="fila-vacia">Sin movimientos todavía.</p>`}
    ${movs.length > 60 && html`<p class="nota">Se muestran los 60 más recientes. El resto está en Movimientos.</p>`}`;
}

export const render = (estado, ui, param) => (param ? detalle(estado, param) : lista(estado));

function abrirCuenta(cuentaId) {
  const estado = obtener();
  const existente = cuentaId ? cuentaPorId(estado, cuentaId) : null;
  abrirHoja({
    titulo: existente ? 'Editar cuenta' : 'Nueva cuenta',
    cuerpo: html`<div class="grupo">
      ${campo('Nombre', html`<input name="nombre" type="text" autocomplete="off" enterkeyhint="done" placeholder="Ej. Banco, Billetera" value="${existente?.nombre ?? ''}">`)}
      ${campo('Tipo', html`<select name="tipo">${opcionesSelect(TIPOS, existente?.tipo ?? 'banco')}</select>`)}
      ${!existente && campo('Saldo de hoy', entradaMonto('saldo'))}
    </div>
    ${existente &&
    html`<div class="grupo separado"><button type="button" class="fila accion" data-hoja-op="archivar">${existente.archivada ? 'Volver a usar esta cuenta' : 'Archivar (ya no la uso)'}</button></div>`}`,
    alAbrir(form) {
      form.addEventListener('click', (ev) => {
        if (ev.target.closest('[data-hoja-op="archivar"]')) {
          form.querySelector('[data-hoja="cerrar"]').click();
          cambiar((e) => {
            const c = cuentaPorId(e, existente.id);
            c.archivada = !c.archivada;
          });
          aviso(existente.archivada ? 'Cuenta activa otra vez' : 'Cuenta archivada');
        }
      });
    },
    alGuardar(datos) {
      const nombre = String(datos.get('nombre')).trim();
      if (!nombre) return 'Ponle un nombre a la cuenta.';
      const tipo = String(datos.get('tipo'));
      if (existente) {
        cambiar((e) => Object.assign(cuentaPorId(e, existente.id), { nombre, tipo }));
        aviso('Cuenta guardada');
        return;
      }
      const texto = String(datos.get('saldo') ?? '').trim();
      const saldo = texto ? parseMonto(texto) : 0;
      if (Number.isNaN(saldo)) return 'Escribe un saldo válido (puede ser 0).';
      cambiar((e) => e.cuentas.push({ id: uid(), nombre, tipo, saldoInicial: saldo, archivada: false }));
      aviso('Cuenta agregada');
    },
    eliminar: existente && 'Eliminar cuenta',
    async alEliminar() {
      const usada = estado.movimientos.some((m) => m.cuentaId === existente.id || m.cuentaDestinoId === existente.id) || estado.fijos.some((f) => f.cuentaId === existente.id) || estado.deudas.some((d) => d.cuentaId === existente.id);
      if (usada) return aviso('Esta cuenta tiene movimientos o pagos ligados. Archívala en lugar de eliminarla.');
      if (estado.cuentas.length === 1) return aviso('Necesitas al menos una cuenta.');
      if (!(await confirmar({ titulo: 'Eliminar cuenta', mensaje: `Se quita «${existente.nombre}».`, aceptar: 'Eliminar' }))) return;
      cambiar((e) => {
        e.cuentas = e.cuentas.filter((c) => c.id !== existente.id);
        for (const o of e.objetivos) for (const a of o.aportes) if (a.cuentaId === existente.id) a.cuentaId = null;
      });
      location.hash = '#cuentas';
      aviso('Cuenta eliminada');
    },
  });
}

// «Corregir el saldo»: escribe cuánto hay de verdad y la app ajusta el punto de partida de la cuenta.
function abrirAjuste(cuentaId) {
  const estado = obtener();
  const actual = saldoCuenta(estado, cuentaId);
  abrirHoja({
    titulo: 'Corregir el saldo',
    compacta: true,
    cuerpo: html`<p class="mensaje">Escribe cuánto hay hoy en la cuenta. No se crea ningún gasto ni ingreso: solo se corrige el saldo.</p>
      <div class="grupo">${campo('Saldo real', entradaMonto('saldo', numEntrada(actual)))}</div>`,
    guardar: 'Corregir',
    alGuardar(datos) {
      const real = parseMonto(datos.get('saldo'));
      if (Number.isNaN(real)) return 'Escribe un monto válido.';
      cambiar((e) => {
        const c = cuentaPorId(e, cuentaId);
        c.saldoInicial = Math.round((c.saldoInicial + real - actual) * 100) / 100;
      });
      aviso('Saldo corregido');
    },
  });
}

export const acciones = {
  'cuenta-nueva': () => {
    abrirCuenta();
    return false;
  },
  'cuenta-editar': (el) => {
    abrirCuenta(el.dataset.id);
    return false;
  },
  'cuenta-ajustar': (el) => {
    abrirAjuste(el.dataset.id);
    return false;
  },
};
