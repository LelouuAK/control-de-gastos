// Todas las fórmulas del Excel, sin nada de pantalla. Cada función indica de qué hoja viene.
// Regla: en los datos guardados solo va lo que el usuario escribe; todo lo demás se calcula aquí.
import { mesDeHoy } from './format.js';

const suma = (numeros) => numeros.reduce((a, b) => a + b, 0);
const centavos = (n) => Math.round(n * 100);

export const extrasDelMes = (estado, mesId) => estado.extras.filter((x) => x.mes === mesId);

// Hoja «Control Mensual»: una fila por mes + la fila TOTAL.
export function controlMensual(estado) {
  const { salario, movil, abuelos } = estado.config;
  const filas = estado.meses.map((m) => {
    const delMes = extrasDelMes(estado, m.id);
    const extras = suma(delMes.map((x) => x.monto));
    const extrasPendientes = suma(delMes.filter((x) => x.estado === 'Pendiente').map((x) => x.monto));
    const total = movil + abuelos + extras; // H = C + E + G: un extra pendiente también es gasto del mes
    // J: en el Excel todos los extras contaban como pagados; ahora solo los que están en Pagado.
    const yaPagado = (m.movil === 'Pagado' ? movil : 0) + (m.abuelos === 'Pagado' ? abuelos : 0) + (extras - extrasPendientes);
    return {
      id: m.id,
      salario, // B
      movil, // C
      estadoMovil: m.movil, // D
      abuelos, // E
      estadoAbuelos: m.abuelos, // F
      extras, // G
      extrasPendientes,
      total,
      saldo: salario - total, // I = B - H
      yaPagado,
      porPagar: total - yaPagado, // K = H - J
    };
  });
  const totales = Object.fromEntries(
    ['salario', 'movil', 'abuelos', 'extras', 'total', 'saldo', 'yaPagado', 'porPagar'].map((k) => [k, suma(filas.map((f) => f[k]))]),
  );
  return { filas, totales };
}

// Hoja «Crucero»: faltante, abonos y abono sugerido por mes.
export function crucero(estado) {
  const { cruceroFaltante: inicial, cruceroMeses: meses } = estado.config;
  const abonado = suma(estado.abonos.map((a) => a.monto));
  const actual = inicial - abonado;
  // «Meses restantes» lo escribe el usuario en Config, igual que en el Excel (no baja solo cada mes).
  return { inicial, abonado, actual, meses, sugerido: meses > 0 ? actual / meses : 0 };
}

// Hoja «Plan de Ahorro»: solo los meses desde config.ahorroDesde.
export function planAhorro(estado) {
  const { salario, gastoPersonal, metaAhorroPct, ahorroDesde } = estado.config;
  const cr = crucero(estado);
  const meta = salario * metaAhorroPct;
  let paraCruceroAcum = 0;
  let ahorroAcum = 0;
  const filas = controlMensual(estado)
    .filas.filter((f) => f.id >= ahorroDesde)
    .map((f) => {
      const paraCrucero = Math.max(0, Math.min(cr.sugerido, cr.actual - paraCruceroAcum)); // C
      paraCruceroAcum += paraCrucero;
      const ahorroPlan = f.saldo - paraCrucero - gastoPersonal; // E = B - C - D
      ahorroAcum += ahorroPlan; // H
      const real = estado.meses.find((m) => m.id === f.id).ahorroReal; // I: lo llena el usuario
      return {
        id: f.id,
        saldo: f.saldo,
        paraCrucero,
        gastoPersonal,
        ahorroPlan,
        meta, // F
        cumple: centavos(ahorroPlan) >= centavos(meta), // G
        acumulado: ahorroAcum,
        real,
        diferencia: real == null ? null : real - ahorroPlan, // J
      };
    });
  const totales = {
    saldo: suma(filas.map((f) => f.saldo)),
    paraCrucero: suma(filas.map((f) => f.paraCrucero)),
    gastoPersonal: suma(filas.map((f) => f.gastoPersonal)),
    ahorroPlan: suma(filas.map((f) => f.ahorroPlan)),
    meta: suma(filas.map((f) => f.meta)),
    real: suma(filas.map((f) => f.real ?? 0)),
    diferencia: suma(filas.map((f) => f.diferencia ?? 0)),
  };
  return { filas, totales };
}

// Mes que se muestra al abrir: el de hoy si existe, si no el último registrado.
export function mesPorDefecto(estado, hoy = mesDeHoy()) {
  return estado.meses.some((m) => m.id === hoy) ? hoy : estado.meses.at(-1).id;
}
