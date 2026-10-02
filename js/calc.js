// Todos los cálculos, sin nada de pantalla. Regla: en los datos guardados solo va lo que el usuario
// escribe; saldos, pendientes, cuotas y avances se calculan aquí. «hoy» es "AAAA-MM-DD" para poder probarlos.
import { diasEnMes, diasHasta, fechaDelMes, hoyISO, mesesEntre, sumarDias, sumarMeses } from './format.js';

export const suma = (numeros) => numeros.reduce((a, b) => a + b, 0);
const redondo = (n) => Math.round(n * 100) / 100;

export const cuentaPorId = (estado, id) => estado.cuentas.find((c) => c.id === id);
export const categoriaPorId = (estado, id) => estado.categorias.find((c) => c.id === id);
export const deudaPorId = (estado, id) => estado.deudas.find((d) => d.id === id);
export const cuentasActivas = (estado) => estado.cuentas.filter((c) => !c.archivada);
export const categoriasDe = (estado, tipo) => estado.categorias.filter((c) => c.tipo === tipo);

const enMes = (mesId) => (m) => m.fecha.startsWith(mesId);
export const movimientosDelMes = (estado, mesId) => estado.movimientos.filter(enMes(mesId));
// Más reciente primero; a igual fecha, el último que se anotó.
export const ordenarMovimientos = (lista) => lista.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado ?? '').localeCompare(a.creado ?? ''));

// --- Cuentas ---

// Cuánto hay en la cuenta: lo que tenía al empezar + ingresos − gastos ± transferencias.
export function saldoCuenta(estado, cuentaId) {
  let saldo = cuentaPorId(estado, cuentaId)?.saldoInicial ?? 0;
  for (const m of estado.movimientos) {
    if (m.tipo === 'ingreso' && m.cuentaId === cuentaId) saldo += m.monto;
    if (m.tipo === 'gasto' && m.cuentaId === cuentaId) saldo -= m.monto;
    if (m.tipo === 'transferencia') {
      if (m.cuentaId === cuentaId) saldo -= m.monto;
      if (m.cuentaDestinoId === cuentaId) saldo += m.monto;
    }
  }
  return redondo(saldo);
}

// Dinero de la cuenta apartado para objetivos (sigue en la cuenta, pero ya tiene destino).
export const reservadoEnCuenta = (estado, cuentaId) =>
  redondo(suma(estado.objetivos.flatMap((o) => o.aportes.filter((a) => a.cuentaId === cuentaId).map((a) => a.monto))));

export const patrimonio = (estado) => redondo(suma(estado.cuentas.map((c) => saldoCuenta(estado, c.id))));

// --- Resumen de un periodo (un mes, tres meses, un año…) ---

export const finDeMes = (mesId) => `${mesId}-${String(diasEnMes(mesId)).padStart(2, '0')}`;

// Movimientos entre dos fechas (incluidas); con «cuentaId», solo los de esa cuenta.
export const movimientosEntre = (estado, desde, hasta, cuentaId = '') =>
  estado.movimientos.filter((m) => m.fecha >= desde && m.fecha <= hasta && (!cuentaId || m.cuentaId === cuentaId || m.cuentaDestinoId === cuentaId));

// Agrupa por categoría: total, número de movimientos, parte del total y los movimientos (más recientes primero).
export function porCategoria(estado, movs) {
  const total = suma(movs.map((m) => m.monto));
  const grupos = new Map();
  for (const m of movs) {
    const g = grupos.get(m.categoriaId) ?? { id: m.categoriaId, categoria: categoriaPorId(estado, m.categoriaId), total: 0, n: 0, movs: [] };
    g.total += m.monto;
    g.n += 1;
    g.movs.push(m);
    grupos.set(m.categoriaId, g);
  }
  return [...grupos.values()].map((g) => ({ ...g, total: redondo(g.total), pct: total ? g.total / total : 0, movs: ordenarMovimientos(g.movs) })).sort((a, b) => b.total - a.total);
}

export function resumenPeriodo(estado, desde, hasta, cuentaId = '') {
  const movs = movimientosEntre(estado, desde, hasta, cuentaId);
  const ingresos = movs.filter((m) => m.tipo === 'ingreso');
  const gastos = movs.filter((m) => m.tipo === 'gasto');
  const totalIngresos = redondo(suma(ingresos.map((m) => m.monto)));
  const totalGastos = redondo(suma(gastos.map((m) => m.monto)));
  return {
    desde,
    hasta,
    ingresos: totalIngresos,
    gastos: totalGastos,
    balance: redondo(totalIngresos - totalGastos),
    tasaAhorro: totalIngresos > 0 ? (totalIngresos - totalGastos) / totalIngresos : null,
    n: movs.length,
    gastosPorCategoria: porCategoria(estado, gastos),
    ingresosPorCategoria: porCategoria(estado, ingresos),
  };
}

export const resumenMes = (estado, mesId, cuentaId = '') => resumenPeriodo(estado, `${mesId}-01`, finDeMes(mesId), cuentaId);

// --- Pagos fijos y programados ---

const PASO_MESES = { mensual: 1, trimestral: 3, anual: 12 };

// Fechas en que toca el pago fijo, entre «desde» y «hasta» (incluidas).
export function ocurrencias(fijo, desde, hasta) {
  const fechas = [];
  if (fijo.frecuencia === 'unica') return fijo.inicio >= desde && fijo.inicio <= hasta ? [fijo.inicio] : [];
  if (fijo.frecuencia === 'semanal') {
    for (let f = fijo.inicio; f <= hasta; f = sumarDias(f, 7)) if (f >= desde) fechas.push(f);
    return fechas;
  }
  const paso = PASO_MESES[fijo.frecuencia];
  const dia = Number(fijo.inicio.slice(8, 10));
  const mesInicio = fijo.inicio.slice(0, 7);
  for (let i = 0; ; i += paso) {
    const f = fechaDelMes(sumarMeses(mesInicio, i), dia);
    if (f > hasta) return fechas;
    if (f >= desde) fechas.push(f);
  }
}

// Dos fechas son «la misma vez» de un pago fijo si caen en el mismo mes (o a menos de 4 días, si es semanal).
// Así, si se cambia el día de pago, lo ya registrado sigue contando.
export const mismaVez = (fijo, a, b) => (fijo.frecuencia === 'semanal' ? Math.abs(diasHasta(a, b)) < 4 : fijo.frecuencia === 'unica' || a.slice(0, 7) === b.slice(0, 7));
export const pagoDeFijo = (estado, fijo, fecha) => estado.movimientos.find((m) => m.fijo?.id === fijo.id && mismaVez(fijo, m.fijo.fecha, fecha));
export const omitida = (fijo, fecha) => fijo.omitidas.some((o) => mismaVez(fijo, o, fecha));

// Lo que falta por pagar o cobrar de cada pago fijo hasta «hasta»: los atrasados desde su inicio y los próximos.
export function fijosPendientes(estado, hasta, hoy = hoyISO()) {
  const lista = [];
  for (const fijo of estado.fijos) {
    if (fijo.pausado) continue;
    for (const fecha of ocurrencias(fijo, fijo.inicio, hasta)) {
      if (omitida(fijo, fecha) || pagoDeFijo(estado, fijo, fecha)) continue;
      lista.push({ clase: 'fijo', id: fijo.id, fecha, tipo: fijo.tipo, concepto: fijo.concepto, monto: fijo.monto, categoriaId: fijo.categoriaId, vencido: fecha < hoy });
    }
  }
  return lista;
}

// --- Deudas ---

// Estado de una deuda a la fecha «hoy». La cuota se reparte así:
// - con cuota fija: esa cuota hasta terminar (la última puede ser menor);
// - con número de cuotas: lo que falta entre los meses que quedan hasta el último mes del plan
//   (como el crucero del Excel). Si se atrasa un mes, la cuota de los siguientes sube.
export function estadoDeuda(estado, deuda, hoy = hoyISO()) {
  const pagos = ordenarMovimientos(estado.movimientos.filter((m) => m.deudaId === deuda.id));
  const pagado = redondo(suma(pagos.map((m) => m.monto)));
  const falta = Math.max(0, redondo(deuda.total - pagado));
  const mesHoy = hoy.slice(0, 7);
  const pagadoEsteMes = redondo(suma(pagos.filter(enMes(mesHoy)).map((m) => m.monto)));
  const mesesConPago = new Set(pagos.map((m) => m.fecha.slice(0, 7))).size;
  const empezo = mesHoy >= deuda.inicio;

  // Reparte «saldo» en cuotas a partir del mes «desde»: devuelve la cuota y cuántos meses quedan.
  const reparto = (saldo, desde) => {
    if (saldo <= 0) return { cuota: 0, meses: 0 };
    if (deuda.cuotaFija) return { cuota: Math.min(deuda.cuotaFija, saldo), meses: Math.ceil(saldo / deuda.cuotaFija - 1e-9) };
    const meses = Math.max(1, mesesEntre(desde, sumarMeses(deuda.inicio, deuda.cuotas - 1)) + 1);
    return { cuota: saldo / meses, meses };
  };

  // Cuota de este mes (o del primer mes, si la deuda empieza más adelante): lo que tocaba antes de los
  // pagos del mes, menos lo ya pagado. Un pago parcial deja pendiente solo lo que falta de la cuota.
  const mesCuota = empezo ? mesHoy : deuda.inicio;
  const fechaCuota = fechaDelMes(mesCuota, deuda.diaPago);
  const delMes = empezo ? reparto(falta + pagadoEsteMes, mesHoy) : reparto(falta, deuda.inicio);
  const restoMes = empezo ? Math.max(0, redondo(delMes.cuota - pagadoEsteMes)) : redondo(delMes.cuota);
  const cubierta = empezo && restoMes < 0.01;
  // Con la cuota del mes cubierta se muestra la próxima (desde el mes siguiente).
  const siguiente = reparto(falta, sumarMeses(mesHoy, 1));
  const cuota = cubierta ? siguiente.cuota : restoMes;
  const mesesRestantes = falta <= 0 ? 0 : cubierta ? siguiente.meses : delMes.meses;
  const fin = falta <= 0 ? (pagos[0]?.fecha.slice(0, 7) ?? mesHoy) : cubierta ? sumarMeses(mesHoy, siguiente.meses) : sumarMeses(mesCuota, delMes.meses - 1);

  let situacion;
  if (falta <= 0) situacion = 'liquidada';
  else if (cubierta) situacion = 'pagada';
  else situacion = fechaCuota < hoy ? 'vencida' : 'pendiente';

  return {
    pagos,
    pagado,
    falta,
    avance: deuda.total > 0 ? Math.min(1, pagado / deuda.total) : 0,
    cuota: redondo(cuota),
    mesesRestantes,
    // Con cuota fija el total sale de lo pagado + lo que falta (un mes con pago parcial no se cuenta dos veces).
    totalCuotas: deuda.cuotaFija ? mesesConPago + mesesRestantes - (empezo && pagadoEsteMes > 0 && !cubierta ? 1 : 0) : deuda.cuotas,
    cuotasPagadas: mesesConPago,
    fin,
    mesCuota,
    fechaCuota,
    pagadoEsteMes,
    situacion,
  };
}

export function resumenDeudas(estado, hoy = hoyISO()) {
  const activas = estado.deudas.map((d) => ({ deuda: d, ...estadoDeuda(estado, d, hoy) }));
  return {
    lista: activas,
    falta: redondo(suma(activas.map((d) => d.falta))),
    pagado: redondo(suma(activas.map((d) => d.pagado))),
    total: redondo(suma(estado.deudas.map((d) => d.total))),
    cuotasDelMes: redondo(suma(activas.filter((d) => d.situacion === 'pendiente' || d.situacion === 'vencida').filter((d) => d.mesCuota === hoy.slice(0, 7)).map((d) => d.cuota))),
  };
}

// Cuotas de deuda que tocan hasta «hasta» y siguen sin pagar.
export function cuotasPendientes(estado, hasta, hoy = hoyISO()) {
  return estado.deudas
    .map((d) => ({ d, e: estadoDeuda(estado, d, hoy) }))
    .filter(({ e }) => (e.situacion === 'pendiente' || e.situacion === 'vencida') && e.fechaCuota <= hasta)
    .map(({ d, e }) => ({ clase: 'deuda', id: d.id, fecha: e.fechaCuota, tipo: 'gasto', concepto: `Cuota de ${d.nombre}`, monto: e.cuota, categoriaId: 'deudas', vencido: e.situacion === 'vencida' }));
}

// Todo lo que viene: pagos fijos y cuotas, del más atrasado al más lejano.
export const proximos = (estado, hoy = hoyISO(), dias = 30) =>
  [...fijosPendientes(estado, sumarDias(hoy, dias), hoy), ...cuotasPendientes(estado, sumarDias(hoy, dias), hoy)].sort((a, b) => a.fecha.localeCompare(b.fecha));

// --- El mes en curso, de arriba abajo (cifra grande de Inicio) ---
// Te queda = recibido + por recibir − gastado − por pagar. «Por pagar» incluye lo atrasado de meses anteriores.
export function planDelMes(estado, hoy = hoyISO()) {
  const mesId = hoy.slice(0, 7);
  const finMes = `${mesId}-${String(diasEnMes(mesId)).padStart(2, '0')}`;
  const r = resumenMes(estado, mesId);
  const pend = [...fijosPendientes(estado, finMes, hoy), ...cuotasPendientes(estado, finMes, hoy)];
  const sumaDe = (fn) => redondo(suma(pend.filter(fn).map((p) => p.monto)));
  const porCobrar = sumaDe((p) => p.tipo === 'ingreso');
  const porPagar = sumaDe((p) => p.tipo === 'gasto');
  const atrasado = sumaDe((p) => p.tipo === 'gasto' && p.fecha < `${mesId}-01`);
  return {
    mesId,
    recibido: r.ingresos,
    porCobrar,
    gastado: r.gastos,
    porPagar,
    atrasado,
    teQueda: redondo(r.ingresos + porCobrar - r.gastos - porPagar),
    pendientes: pend.sort((a, b) => a.fecha.localeCompare(b.fecha)),
  };
}

// --- Objetivos de ahorro ---

export function estadoObjetivo(objetivo, hoy = hoyISO()) {
  const ahorrado = redondo(suma(objetivo.aportes.map((a) => a.monto)));
  const falta = Math.max(0, redondo(objetivo.meta - ahorrado));
  const meses = objetivo.fechaLimite ? Math.max(1, mesesEntre(hoy.slice(0, 7), objetivo.fechaLimite.slice(0, 7)) + 1) : null;
  return {
    ahorrado,
    falta,
    avance: objetivo.meta > 0 ? Math.min(1, ahorrado / objetivo.meta) : 0,
    porMes: meses && falta > 0 ? redondo(falta / meses) : null,
    cumplido: objetivo.meta > 0 && falta <= 0,
  };
}

export const resumenObjetivos = (estado, hoy = hoyISO()) => {
  const lista = estado.objetivos.map((o) => ({ objetivo: o, ...estadoObjetivo(o, hoy) }));
  const meta = suma(estado.objetivos.map((o) => o.meta));
  const ahorrado = redondo(suma(lista.map((o) => o.ahorrado)));
  return { lista, meta, ahorrado, avance: meta > 0 ? Math.min(1, ahorrado / meta) : 0 };
};

// Últimos «n» meses terminando en «mesId» (para la gráfica de Análisis).
export const historico = (estado, mesId, n = 6) =>
  Array.from({ length: n }, (_, i) => sumarMeses(mesId, i - n + 1)).map((id) => ({ id, ...resumenMes(estado, id) }));
