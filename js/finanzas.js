// Cálculos de la fase 2, sin nada de pantalla: periodos y comparaciones, límites por categoría,
// salud financiera, fondo de emergencia, previsión de 30 días, «puedes gastar» y avisos.
// Igual que en calc.js, «hoy» es "AAAA-MM-DD" para poder probarlos.
import { suma, resumenPeriodo, resumenMes, movimientosEntre, finDeMes, planDelMes, proximos, patrimonio, estadoDeuda, estadoObjetivo, categoriaPorId } from './calc.js';
import { dinero, diasEnMes, diasHasta, fechaDelMes, hoyISO, nombreMesAnio, sumarDias, sumarMeses } from './format.js';

const redondo = (n) => Math.round(n * 100) / 100;
const variacion = (actual, anterior) => (anterior > 0 ? (actual - anterior) / anterior : null);

// --- Periodos de Análisis → Resumen ---

// Rango del periodo que contiene «hoy» y el mismo tramo del periodo anterior (para comparar justo).
export function periodo(tipo, hoy = hoyISO()) {
  const mes = hoy.slice(0, 7);
  const anio = hoy.slice(0, 4);
  let desde;
  let hasta;
  let antDesde;
  let antHasta;
  if (tipo === 'anio') {
    [desde, hasta] = [`${anio}-01-01`, `${anio}-12-31`];
    [antDesde, antHasta] = [`${anio - 1}-01-01`, `${anio - 1}-12-31`];
  } else {
    const meses = tipo === '3meses' ? 3 : 1;
    const primero = sumarMeses(mes, 1 - meses);
    [desde, hasta] = [`${primero}-01`, finDeMes(mes)];
    [antDesde, antHasta] = [`${sumarMeses(primero, -meses)}-01`, finDeMes(sumarMeses(mes, -meses))];
  }
  const transcurridos = diasHasta(desde, hoy < hasta ? hoy : hasta) + 1;
  const total = diasHasta(desde, hasta) + 1;
  // El anterior se corta en el mismo número de días: el 10 de octubre se compara con el 1–10 de septiembre.
  const antCorte = sumarDias(antDesde, transcurridos - 1);
  return { tipo, desde, hasta, transcurridos, total, restantes: total - transcurridos, anterior: { desde: antDesde, hasta: antCorte < antHasta ? antCorte : antHasta } };
}

export function resumenAnalisis(estado, tipo, hoy = hoyISO(), cuentaId = '') {
  const p = periodo(tipo, hoy);
  const r = resumenPeriodo(estado, p.desde, p.hasta, cuentaId);
  const ant = resumenPeriodo(estado, p.anterior.desde, p.anterior.hasta, cuentaId);
  const gastoDiario = r.gastos / p.transcurridos;
  // Proyección (solo el mes): lo gastado + pagos fijos y cuotas que faltan + el gasto del día a día que viene.
  // El ritmo diario mezcla el de este mes con el de los tres meses anteriores: al empezar el mes pesa más
  // la historia (un solo día de gastos no dice mucho) y al final pesa más lo que va del mes.
  let proyeccion = null;
  if (tipo === 'mes') {
    const variable = (desde, hasta) => suma(movimientosEntre(estado, desde, hasta, cuentaId).filter((m) => m.tipo === 'gasto' && !m.fijo && !m.deudaId).map((m) => m.monto));
    const ritmoMes = variable(p.desde, p.hasta) / p.transcurridos;
    const inicioHist = `${sumarMeses(hoy.slice(0, 7), -3)}-01`;
    const finHist = sumarDias(p.desde, -1);
    const hayHistoria = movimientosEntre(estado, inicioHist, finHist, cuentaId).length > 0;
    const ritmoHist = variable(inicioHist, finHist) / (diasHasta(inicioHist, finHist) + 1);
    const peso = hayHistoria ? p.transcurridos / p.total : 1;
    const pendiente = cuentaId ? 0 : planDelMes(estado, hoy).porPagar;
    proyeccion = redondo(r.gastos + pendiente + (peso * ritmoMes + (1 - peso) * ritmoHist) * p.restantes);
  }
  return { ...r, periodo: p, gastoDiario: redondo(gastoDiario), proyeccion, anterior: ant, cambioGastos: variacion(r.gastos, ant.gastos) };
}

// --- Comparar: últimos 7 o 14 días, o el mes en curso, contra el tramo anterior del mismo largo ---

export function comparar(estado, modo, hoy = hoyISO()) {
  let actual;
  let anterior;
  if (modo === 'mes') {
    const p = periodo('mes', hoy);
    actual = { desde: p.desde, hasta: hoy };
    anterior = p.anterior;
  } else {
    const dias = Number(modo);
    actual = { desde: sumarDias(hoy, 1 - dias), hasta: hoy };
    anterior = { desde: sumarDias(hoy, 1 - 2 * dias), hasta: sumarDias(hoy, -dias) };
  }
  const a = resumenPeriodo(estado, actual.desde, actual.hasta);
  const b = resumenPeriodo(estado, anterior.desde, anterior.hasta);
  const cats = new Map();
  for (const g of a.gastosPorCategoria) cats.set(g.id, { id: g.id, categoria: g.categoria, actual: g.total, anterior: 0, movs: g.movs });
  for (const g of b.gastosPorCategoria) {
    const c = cats.get(g.id) ?? { id: g.id, categoria: g.categoria, actual: 0, anterior: 0, movs: [] };
    c.anterior = g.total;
    c.movsAnterior = g.movs;
    cats.set(g.id, c);
  }
  const categorias = [...cats.values()]
    .map((c) => ({ ...c, movsAnterior: c.movsAnterior ?? [], diferencia: redondo(c.actual - c.anterior), cambio: variacion(c.actual, c.anterior), nueva: c.anterior === 0 && c.actual > 0 }))
    .sort((x, y) => Math.abs(y.diferencia) - Math.abs(x.diferencia));
  const fila = (k) => ({ actual: a[k], anterior: b[k], diferencia: redondo(a[k] - b[k]), cambio: variacion(Math.abs(a[k]), Math.abs(b[k])) });
  return { actual: { ...actual, dias: diasHasta(actual.desde, actual.hasta) + 1 }, anterior: { ...anterior, dias: diasHasta(anterior.desde, anterior.hasta) + 1 }, ingresos: fila('ingresos'), gastos: fila('gastos'), balance: { ...fila('balance'), cambio: null }, categorias }; // el % de un balance (que puede ser negativo) confunde
}

// --- Límites por categoría ---
// Con «acumular», lo que no se gasta de un mes pasa al siguiente (nunca pasa en negativo).

export function estadoLimites(estado, mesId) {
  const gastoDe = (catId, mes) => suma(movimientosEntre(estado, `${mes}-01`, finDeMes(mes)).filter((m) => m.tipo === 'gasto' && m.categoriaId === catId).map((m) => m.monto));
  return estado.limites
    .filter((l) => categoriaPorId(estado, l.categoriaId))
    .map((l) => {
      let arrastre = 0;
      if (l.acumular && l.desde && l.desde < mesId) {
        for (let m = l.desde; m < mesId; m = sumarMeses(m, 1)) arrastre = Math.max(0, arrastre + l.monto - gastoDe(l.categoriaId, m));
      }
      const disponible = redondo(l.monto + arrastre);
      const gastado = redondo(gastoDe(l.categoriaId, mesId));
      return { ...l, categoria: categoriaPorId(estado, l.categoriaId), arrastre: redondo(arrastre), disponible, gastado, queda: redondo(disponible - gastado), uso: disponible > 0 ? gastado / disponible : gastado > 0 ? Infinity : 0 };
    })
    .sort((a, b) => b.uso - a.uso);
}

export function resumenLimites(estado, mesId) {
  const lista = estadoLimites(estado, mesId);
  const disponible = suma(lista.map((l) => l.disponible));
  const gastado = suma(lista.map((l) => l.gastado));
  return { lista, disponible: redondo(disponible), gastado: redondo(gastado), uso: disponible > 0 ? gastado / disponible : 0, pasados: lista.filter((l) => l.uso > 1).length };
}

// --- Objetivos: cuánto apartar este mes para ir al día con las fechas límite ---

export function paraObjetivosEsteMes(estado, hoy = hoyISO()) {
  const mes = hoy.slice(0, 7);
  return redondo(
    suma(
      estado.objetivos.map((o) => {
        // La cuota mensual se calcula como estaba al empezar el mes; lo ya aportado este mes la va cubriendo.
        const aportadoMes = suma(o.aportes.filter((a) => a.fecha.startsWith(mes)).map((a) => a.monto));
        const alInicio = estadoObjetivo({ ...o, aportes: o.aportes.filter((a) => a.fecha < `${mes}-01`) }, hoy);
        return alInicio.porMes ? Math.max(0, alInicio.porMes - aportadoMes) : 0;
      }),
    ),
  );
}

// --- Planificación: cuánto puedes gastar de aquí a fin de mes ---

export function puedesGastar(estado, hoy = hoyISO()) {
  const plan = planDelMes(estado, hoy);
  const objetivos = paraObjetivosEsteMes(estado, hoy);
  const libre = redondo(plan.teQueda - objetivos);
  const dias = diasEnMes(plan.mesId) - Number(hoy.slice(8, 10)) + 1;
  return { ...plan, objetivos, libre, dias, porDia: libre > 0 ? redondo(libre / dias) : 0 };
}

// --- Previsión: lo que entra y sale en los próximos días (incluye lo atrasado) ---

export function prevision(estado, hoy = hoyISO(), dias = 30) {
  const lista = proximos(estado, hoy, dias);
  const cobros = redondo(suma(lista.filter((p) => p.tipo === 'ingreso').map((p) => p.monto)));
  const pagos = redondo(suma(lista.filter((p) => p.tipo === 'gasto').map((p) => p.monto)));
  const hoySaldo = patrimonio(estado);
  return { lista, cobros, pagos, saldoHoy: hoySaldo, saldoFinal: redondo(hoySaldo + cobros - pagos) };
}

// Lo que había en todas las cuentas al terminar el día «fecha».
export const saldoAl = (estado, fecha) =>
  redondo(patrimonio(estado) - suma(estado.movimientos.filter((m) => m.fecha > fecha).map((m) => (m.tipo === 'ingreso' ? m.monto : m.tipo === 'gasto' ? -m.monto : 0))));

export const saldoPorMes = (estado, hoy = hoyISO(), n = 6) =>
  Array.from({ length: n }, (_, i) => sumarMeses(hoy.slice(0, 7), i - n + 1)).map((id) => ({ id, saldo: saldoAl(estado, id === hoy.slice(0, 7) ? hoy : finDeMes(id)) }));

// --- Salud financiera ---
// Cuatro indicadores de 0 a 25 puntos cada uno: ahorro, colchón, deudas y cómo cambian los gastos.
// Es una orientación, no asesoría financiera.

export function saludFinanciera(estado, hoy = hoyISO()) {
  const mes = hoy.slice(0, 7);
  // Base: los últimos tres meses completos con movimientos (o el mes en curso si aún no hay historia).
  const pasados = [1, 2, 3].map((i) => resumenMes(estado, sumarMeses(mes, -i))).filter((r) => r.n > 0);
  const base = pasados.length ? pasados : [resumenMes(estado, mes)];
  const ingresos = suma(base.map((r) => r.ingresos));
  const gastos = suma(base.map((r) => r.gastos));
  const gastoMedio = redondo(gastos / base.length);
  const ingresoMedio = redondo(ingresos / base.length);
  const tasaAhorro = ingresos > 0 ? (ingresos - gastos) / ingresos : null;
  const total = patrimonio(estado);
  const colchon = gastoMedio > 0 ? Math.max(0, total) / gastoMedio : null;

  // Cambio de gastos: este mes hasta hoy contra el mes pasado hasta el mismo día.
  const dia = Number(hoy.slice(8, 10));
  const mesAnt = sumarMeses(mes, -1);
  const gastoHoy = resumenPeriodo(estado, `${mes}-01`, hoy).gastos;
  const gastoAnt = resumenPeriodo(estado, `${mesAnt}-01`, fechaDelMes(mesAnt, dia)).gastos;
  const cambioGastos = variacion(gastoHoy, gastoAnt);

  // Carga de deudas: cuotas del mes frente a lo que entra al mes.
  const deudas = estado.deudas.map((d) => estadoDeuda(estado, d, hoy)).filter((e) => e.falta > 0);
  const cuotas = redondo(suma(deudas.map((e) => (e.situacion === 'pagada' ? e.pagadoEsteMes : e.cuota + e.pagadoEsteMes))));
  const entraAlMes = Math.max(ingresoMedio, suma(estado.fijos.filter((f) => f.tipo === 'ingreso' && !f.pausado && f.frecuencia === 'mensual').map((f) => f.monto)));
  const cargaDeudas = entraAlMes > 0 ? cuotas / entraAlMes : deudas.length ? 1 : 0;
  const finDeudas = deudas.length ? deudas.map((e) => e.fin).sort().at(-1) : null;

  const meta = estado.ajustes.metaAhorroPct || 0.2;
  const tope = (x) => Math.max(0, Math.min(1, x));
  const puntos = {
    ahorro: Math.round(25 * (tasaAhorro == null ? 0 : tope(tasaAhorro / meta))),
    colchon: Math.round(25 * (colchon == null ? 0 : tope(colchon / 6))),
    // Cuotas hasta el 15% de lo que entra = 25; desde el 50% = 0.
    deudas: Math.round(25 * tope((0.5 - cargaDeudas) / 0.35)),
    // Gastar igual o menos que el mes pasado = 25; 30% más o peor = 0. Sin mes anterior para comparar cuenta como neutral.
    gastos: Math.round(25 * (cambioGastos == null ? 0.75 : tope(1 - cambioGastos / 0.3))),
  };
  const puntaje = puntos.ahorro + puntos.colchon + puntos.deudas + puntos.gastos;
  const nivel = puntaje >= 80 ? 'Posición sólida' : puntaje >= 60 ? 'Bien encaminado' : puntaje >= 40 ? 'Con margen de mejora' : 'Necesita atención';
  const sinDatos = !estado.movimientos.length;
  return { sinDatos, puntaje, nivel, puntos, tasaAhorro, meta, colchon, gastoMedio, ingresoMedio, cambioGastos, cargaDeudas, cuotas, finDeudas, mesesBase: pasados.length, patrimonio: total };
}

export function fondoEmergencia(estado, hoy = hoyISO()) {
  const s = saludFinanciera(estado, hoy);
  const objetivo = estado.objetivos.find((o) => /emergencia/i.test(o.nombre));
  return { gastoMedio: s.gastoMedio, cobertura: s.colchon, basico: redondo(s.gastoMedio * 3), solido: redondo(s.gastoMedio * 6), objetivo };
}

// --- Lectura del mes y avisos ---

// Frases cortas con lo importante del mes en curso.
export function lecturaDelMes(estado, hoy = hoyISO()) {
  const r = resumenAnalisis(estado, 'mes', hoy);
  const frases = [];
  const mayor = r.gastosPorCategoria[0];
  if (mayor) frases.push(`${mayor.categoria?.nombre ?? 'Sin categoría'} es tu mayor gasto: ${Math.round(mayor.pct * 100)}% de lo gastado.`);
  const dif = redondo(r.gastos - r.anterior.gastos);
  if (r.anterior.gastos > 0) frases.push(dif > 0 ? `Llevas gastado ${dinero(dif)} más que el mes pasado a estas alturas.` : dif < 0 ? `Llevas gastado ${dinero(-dif)} menos que el mes pasado a estas alturas.` : 'Vas gastando lo mismo que el mes pasado.');
  else if (r.gastos > 0) frases.push(resumenMes(estado, sumarMeses(hoy.slice(0, 7), -1)).gastos > 0 ? 'El mes pasado, a estas alturas, aún no habías gastado nada.' : 'Es el primer mes con gastos para comparar.');
  const meta = estado.ajustes.metaAhorroPct;
  if (r.tasaAhorro != null) frases.push(r.tasaAhorro >= meta ? `Vas ahorrando el ${Math.round(r.tasaAhorro * 100)}% de lo que entró: por encima de tu meta del ${Math.round(meta * 100)}%.` : `Vas ahorrando el ${Math.round(Math.max(0, r.tasaAhorro) * 100)}% de lo que entró; tu meta es el ${Math.round(meta * 100)}%.`);
  const s = saludFinanciera(estado, hoy);
  if (s.finDeudas) frases.push(`Al ritmo de tu plan, terminas de pagar tus deudas en ${nombreMesAnio(s.finDeudas).toLowerCase()}.`);
  return frases;
}

// Avisos para revisar: pagos atrasados o cercanos, límites pasados o casi, y un mes en rojo.
export function avisos(estado, hoy = hoyISO(), { conPagos = true } = {}) {
  const lista = [];
  const prox = proximos(estado, hoy, 3);
  if (conPagos) {
    const atrasados = prox.filter((p) => p.vencido && p.tipo === 'gasto');
    if (atrasados.length) lista.push({ nivel: 'mal', texto: `Tienes ${atrasados.length === 1 ? 'un pago atrasado' : `${atrasados.length} pagos atrasados`} por ${dinero(suma(atrasados.map((p) => p.monto)))}.`, href: '#inicio' });
    for (const p of prox.filter((x) => !x.vencido && x.tipo === 'gasto')) {
      const d = diasHasta(hoy, p.fecha);
      lista.push({ nivel: 'ojo', texto: `${p.concepto}: ${dinero(p.monto)} ${d === 0 ? 'hoy' : d === 1 ? 'mañana' : `en ${d} días`}.`, href: '#inicio' });
    }
  }
  for (const l of estadoLimites(estado, hoy.slice(0, 7))) {
    const nombre = l.categoria.nombre;
    if (l.uso > 1) lista.push({ nivel: 'mal', texto: `Te pasaste ${dinero(l.gastado - l.disponible)} del límite de ${nombre}.`, href: '#planificacion' });
    else if (l.uso >= 0.8) lista.push({ nivel: 'ojo', texto: `Llevas el ${Math.round(l.uso * 100)}% del límite de ${nombre}; te quedan ${dinero(l.queda)}.`, href: '#planificacion' });
  }
  if (planDelMes(estado, hoy).teQueda < 0) lista.push({ nivel: 'mal', texto: 'Este mes sale más dinero del que entra.', href: '#inicio' });
  return lista;
}

