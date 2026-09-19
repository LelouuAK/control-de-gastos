// Hoja «Config»: los datos base que alimentan todas las fórmulas, más respaldo y restauración.
import { html, aviso, confirmar } from '../ui.js';
import { cambiar, reemplazarDatos } from '../store.js';
import { nombreMesAnio, fechaCorta, numEntrada, parseMonto } from '../format.js';
import { leerRespaldo } from '../respaldo.js';
import { datosNuevos } from '../seed.js';
import { VERSION_APP } from '../version.js';

export const id = 'config';
export const titulo = 'Configuración';

// Reglas de cada campo editable: monto (0 o más), dia (1–31) o entero.
const CAMPOS = {
  salario: { tipo: 'monto' },
  movil: { tipo: 'monto' },
  movilDia: { tipo: 'dia' },
  abuelos: { tipo: 'monto' },
  abuelosDia: { tipo: 'dia' },
  cruceroFaltante: { tipo: 'monto' },
  cruceroMeses: { tipo: 'entero' },
};

const entrada = (campo, valor, modo = 'decimal') =>
  html`<input class="num" type="text" inputmode="${modo}" autocomplete="off" data-cambio="cfg" data-campo="${campo}" value="${valor}">`;

const fila = (nombre, nota, control) => html`<label class="fila"><span class="et">${nombre}${nota && html`<small>${nota}</small>`}</span>${control}</label>`;

export function render(estado) {
  const c = estado.config;
  const ultimo = estado.meta.ultimoRespaldo;
  return html`
    <h1 class="titulo">${titulo}</h1>
    <p class="sub">Aquí van los datos base. Todo lo demás se calcula solo.</p>

    <h2 class="grupo-t">Ingresos y pagos fijos</h2>
    <div class="grupo">
      ${fila('Salario mensual', '', entrada('salario', numEntrada(c.salario)))}
      ${fila('Plan móvil (mensual)', '', entrada('movil', numEntrada(c.movil)))}
      ${fila('Día de pago del plan móvil', '', entrada('movilDia', c.movilDia, 'numeric'))}
      ${fila('Pago a los abuelos (mensual)', '', entrada('abuelos', numEntrada(c.abuelos)))}
      ${fila('Día de pago de los abuelos', '', entrada('abuelosDia', c.abuelosDia, 'numeric'))}
    </div>

    <h2 class="grupo-t">Crucero</h2>
    <div class="grupo">
      ${fila('Faltante inicial', '', entrada('cruceroFaltante', numEntrada(c.cruceroFaltante)))}
      ${fila('Meses para terminar de pagar', 'Cámbialo si ya pasó un mes y sigues pagando', entrada('cruceroMeses', c.cruceroMeses, 'numeric'))}
    </div>

    <h2 class="grupo-t">Plan de ahorro</h2>
    <div class="grupo">
      <label class="fila"><span class="et">Primer mes del plan</span>
        <select data-cambio="cfg-desde" aria-label="Primer mes del plan">${estado.meses.map((m) => html`<option value="${m.id}" ${m.id === c.ahorroDesde && 'selected'}>${nombreMesAnio(m.id)}</option>`)}</select>
      </label>
    </div>

    <h2 class="grupo-t">Tus datos</h2>
    <div class="grupo">
      <div class="fila"><span class="et">Último respaldo</span><span class="val">${ultimo ? fechaCorta(ultimo) : 'Nunca'}</span></div>
      <button type="button" class="fila accion" data-accion="respaldar">Respaldar ahora</button>
      <label class="fila accion">Restaurar desde un archivo<input type="file" class="oculto" accept=".json,application/json" data-cambio="restaurar"></label>
      <button type="button" class="fila accion peligro" data-accion="borrar-todo">Borrar todo y empezar en blanco</button>
    </div>
    <p class="nota">Los datos se guardan solo en este dispositivo. El respaldo es un archivo que puedes guardar en Archivos o iCloud Drive.</p>

    <details class="ayuda">
      <summary>Cómo usar</summary>
      <ul>
        <li>Cada mes marca en Mes si el plan móvil y los abuelos están Pagado o Pendiente.</li>
        <li>Cada gasto extra se anota con su mes; se suma solo.</li>
        <li>Cada abono al crucero se registra en Crucero; el faltante se actualiza solo.</li>
      </ul>
    </details>
    <p class="nota centro">Control de gastos ${VERSION_APP}</p>
  `;
}

export const acciones = {
  'borrar-todo': async () => {
    const seguro = await confirmar({ titulo: 'Borrar todo', mensaje: 'Se borrarán tu salario, pagos, extras y abonos de este dispositivo. Haz un respaldo antes si quieres conservarlos.', aceptar: 'Borrar' });
    if (seguro) {
      reemplazarDatos(datosNuevos());
      aviso('Datos borrados');
    }
    return false;
  },
};

export const cambios = {
  cfg: (el) => {
    const campo = el.dataset.campo;
    const { tipo } = CAMPOS[campo];
    const valor = parseMonto(el.value);
    const valido = tipo === 'dia' ? Number.isInteger(valor) && valor >= 1 && valor <= 31 : tipo === 'entero' ? Number.isInteger(valor) && valor >= 0 : valor >= 0;
    if (!valido) return aviso(tipo === 'dia' ? 'El día va de 1 a 31.' : tipo === 'entero' ? 'Escribe un número entero.' : 'Escribe un monto válido.');
    cambiar((e) => {
      e.config[campo] = valor;
    });
  },
  'cfg-desde': (el) =>
    cambiar((e) => {
      e.config.ahorroDesde = el.value;
    }),
  restaurar: async (el) => {
    const archivo = el.files?.[0];
    el.value = ''; // permite elegir el mismo archivo otra vez
    if (!archivo) return;
    try {
      const datos = leerRespaldo(await archivo.text());
      const resumen = `${datos.meses.length} meses, ${datos.extras.length} extras y ${datos.abonos.length} abonos`;
      const seguro = await confirmar({ titulo: 'Restaurar datos', mensaje: `Se reemplazarán los datos actuales por los del archivo (${resumen}).`, aceptar: 'Restaurar' });
      if (!seguro) return;
      reemplazarDatos(datos);
      aviso('Datos restaurados');
    } catch (err) {
      aviso(err.message);
    }
  },
};
