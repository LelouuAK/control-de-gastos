// Centro financiero: salud financiera, fondo de emergencia, previsión de 30 días y tus datos.
// Es una orientación con tus propios números, no asesoría financiera.
import { html, aviso, cabecera, barra } from '../ui.js';
import { cambiar, obtener } from '../store.js';
import { saludFinanciera, fondoEmergencia, prevision } from '../finanzas.js';
import { estadoObjetivo } from '../calc.js';
import { dinero, hoyISO, nombreMesAnio, uid } from '../format.js';
import { filaPendiente } from './piezas.js';

export const id = 'centro';
export const titulo = 'Centro financiero';
export const pestana = 'ajustes';

const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const meses = (x) => (x == null ? '—' : `${x.toLocaleString('en-US', { maximumFractionDigits: 1 })} ${Math.round(x * 10) === 10 ? 'mes' : 'meses'}`);

// Medidor semicircular del puntaje (0–100).
function medidor(puntaje) {
  const r = 52;
  const largo = Math.PI * r;
  return html`<svg class="medidor" viewBox="0 0 128 72" role="img" aria-label="Puntaje ${puntaje} de 100">
    <path d="M12 66a52 52 0 0 1 104 0" class="medidor-fondo"></path>
    <path d="M12 66a52 52 0 0 1 104 0" class="medidor-valor" style="stroke-dasharray:${largo};stroke-dashoffset:${largo * (1 - puntaje / 100)}"></path>
    <text x="64" y="58" text-anchor="middle" class="medidor-num">${puntaje}</text>
    <text x="64" y="70" text-anchor="middle" class="medidor-de">de 100</text>
  </svg>`;
}

export function render(estado) {
  const hoy = hoyISO();
  const s = saludFinanciera(estado, hoy);
  const f = fondoEmergencia(estado, hoy);
  const prev = prevision(estado, hoy, 30);
  const fo = f.objetivo ? estadoObjetivo(f.objetivo, hoy) : null;
  const indicador = (nombre, valor, detalle, puntos, clase = '') => html`<div class="indicador">
    <small>${nombre}</small><b class="${clase}">${valor}</b><span>${detalle}</span>${barra(puntos / 25, puntos >= 18 ? 'objetivo' : puntos >= 10 ? '' : 'gasto')}</div>`;
  return html`
    ${cabecera(titulo, { volver: '#ajustes', textoVolver: 'Ajustes' })}
    <section class="salud">
      ${medidor(s.sinDatos ? 0 : s.puntaje)}
      <div>
        <p class="salud-nivel">${s.sinDatos ? 'Aún sin datos' : s.nivel}</p>
        <p class="hero-sub">${s.sinDatos ? 'Anota tus ingresos y gastos y aquí verás cómo vas.' : `Calculado con tu ahorro, tu colchón, tus deudas y tus gastos${s.mesesBase === 1 ? " del último mes" : s.mesesBase ? ` de los últimos ${s.mesesBase} meses` : " de este mes"}. Es una orientación, no asesoría financiera.`}</p>
      </div>
    </section>

    <h2 class="grupo-t">Tus cuatro indicadores</h2>
    <div class="indicadores">
      ${indicador('Ahorro', pct(s.tasaAhorro), `De lo que entra. Meta: ${pct(s.meta)}`, s.puntos.ahorro, s.tasaAhorro != null && s.tasaAhorro >= s.meta ? 'ingreso' : '')}
      ${indicador('Colchón', meses(s.colchon), 'De gastos cubiertos. Ideal: 3 a 6', s.puntos.colchon)}
      ${indicador('Deudas', pct(s.cargaDeudas), s.cuotas > 0 ? `De lo que entra va a cuotas (${dinero(s.cuotas)}). Ideal: menos de 35%` : 'Sin cuotas este mes', s.puntos.deudas, s.cargaDeudas > 0.35 ? 'neg' : '')}
      ${indicador('Gastos', s.cambioGastos == null ? '—' : `${s.cambioGastos > 0 ? '+' : ''}${Math.round(s.cambioGastos * 100)}%`, 'Frente al mes pasado, a estas alturas', s.puntos.gastos, s.cambioGastos > 0.1 ? 'neg' : '')}
    </div>
    ${s.finDeudas && html`<p class="nota">Al ritmo de tus cuotas terminas de pagar tus deudas en ${nombreMesAnio(s.finDeudas).toLowerCase()}.</p>`}

    <h2 class="grupo-t">Fondo de emergencia</h2>
    <div class="grupo">
      <div class="fila"><span class="et">Gasto medio al mes<small>Promedio de tus últimos meses</small></span><span class="val">${dinero(f.gastoMedio)}</span></div>
      <div class="fila"><span class="et">Te alcanza para<small>Con lo que tienes en tus cuentas (${dinero(s.patrimonio)})</small></span><span class="val">${meses(f.cobertura)}</span></div>
      <div class="fila"><span class="et">Fondo básico: 3 meses</span><span class="val">${dinero(f.basico)}</span></div>
      <div class="fila"><span class="et">Fondo sólido: 6 meses</span><span class="val">${dinero(f.solido)}</span></div>
      ${f.objetivo
        ? html`<a class="fila" href="#objetivo/${f.objetivo.id}"><span class="ico">${f.objetivo.icono}</span><span class="et">${f.objetivo.nombre}<small>${dinero(fo.ahorrado)} de ${dinero(f.objetivo.meta)}</small>${barra(fo.avance, 'objetivo')}</span><span class="val">${pct(fo.avance)}</span></a>`
        : f.gastoMedio > 0 && html`<button type="button" class="fila accion" data-accion="fondo-crear">Crear el objetivo «Fondo de emergencia» (${dinero(f.basico)})</button>`}
    </div>

    <h2 class="grupo-t">Próximos 30 días</h2>
    <div class="kpis tres">
      <div><small>Por cobrar</small><b class="ingreso">+${dinero(prev.cobros)}</b></div>
      <div><small>Por pagar</small><b>−${dinero(prev.pagos)}</b></div>
      <div><small>Saldo previsto</small><b class="${prev.saldoFinal < 0 ? 'neg' : ''}">${dinero(prev.saldoFinal)}</b></div>
    </div>
    ${prev.lista.length ? html`<div class="grupo separado">${prev.lista.map((p) => filaPendiente(estado, p, hoy))}</div>` : html`<p class="fila-vacia separado">Nada programado en los próximos 30 días.</p>`}

    <h2 class="grupo-t">Tus datos</h2>
    <div class="grupo">
      <button type="button" class="fila" data-accion="csv"><span class="ico">⬇️</span><span class="et">Descargar movimientos (CSV)<small>Se abre en Excel o Numbers</small></span></button>
      <button type="button" class="fila" data-accion="respaldar"><span class="ico">💾</span><span class="et">Descargar copia completa<small>Cuentas, movimientos, deudas, objetivos y ajustes</small></span></button>
      <a class="fila" href="#ajustes"><span class="ico">↩️</span><span class="et">Restaurar una copia<small>En Ajustes → Tus datos</small></span><span class="flecha"></span></a>
    </div>
    <p class="nota">Tus datos viven solo en este teléfono. La copia no sale a ningún servidor.</p>`;
}

export const acciones = {
  'fondo-crear': () => {
    const f = fondoEmergencia(obtener());
    let nuevo;
    cambiar((e) => e.objetivos.push((nuevo = { id: uid(), nombre: 'Fondo de emergencia', meta: f.basico, fechaLimite: null, icono: '🛟', creado: new Date().toISOString(), aportes: [] })));
    aviso('Objetivo creado');
    location.hash = `#objetivo/${nuevo.id}`;
    return false;
  },
};
// «csv» y «respaldar» (Tus datos) son las mismas acciones de Ajustes.
