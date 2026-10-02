// Paso de los datos de la app 1.x (réplica del Excel: salario, plan móvil, abuelos, extras, crucero y plan
// de ahorro) al modelo general 2.0 (cuentas, categorías, movimientos, pagos fijos, deudas y objetivos).
// Nada se pierde:
//   salario, plan móvil y abuelos → pagos fijos mensuales; cada mes marcado «Pagado» → un movimiento
//   salario de los meses ya pasados → un ingreso (el Excel lo daba por cobrado)
//   extras pagados → gastos en «Otros gastos»; extras pendientes → pagos programados de una sola vez
//   crucero → una deuda; cada abono → un pago de esa deuda
//   gasto personal → límite de la categoría «Personal»; meta de ahorro % → Ajustes
//   ahorro real de cada mes → aportes al objetivo «Ahorro»
import { datosNuevos } from './seed.js';
import { diasEnMes, fechaDelMes, hoyISO, uid } from './format.js';

const ES_MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS = ['Pagado', 'Pendiente'];

const malo = (nombre) => new Error(`Dato no válido en el respaldo: ${nombre}.`);
function numero(valor, nombre, { min = -Infinity, max = Infinity } = {}) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < min || valor > max) throw malo(nombre);
  return valor;
}
const elegir = (valor, permitidos, nombre) => {
  if (!permitidos.includes(valor)) throw malo(nombre);
  return valor;
};
const texto = (valor, nombre) => {
  if (typeof valor !== 'string') throw malo(nombre);
  return valor;
};
const patron = (valor, regex, nombre) => {
  if (!regex.test(texto(valor, nombre))) throw malo(nombre);
  return valor;
};

// Valida un respaldo de la app 1.x (datos v1, v2 o v3) y lo deja con la forma v3.
export function validarV3(d) {
  const c = d.config ?? {};
  const config = {
    salario: numero(c.salario, 'salario', { min: 0 }),
    movil: numero(c.movil, 'plan móvil', { min: 0 }),
    movilDia: numero(c.movilDia, 'día del plan móvil', { min: 1, max: 31 }),
    abuelos: numero(c.abuelos, 'abuelos', { min: 0 }),
    abuelosDia: numero(c.abuelosDia, 'día de los abuelos', { min: 1, max: 31 }),
    cruceroFaltante: numero(c.cruceroFaltante, 'faltante del crucero', { min: 0 }),
    cruceroMeses: numero(c.cruceroMeses, 'meses del crucero', { min: 0 }),
    gastoPersonal: numero(c.gastoPersonal, 'gasto personal', { min: 0 }),
    metaAhorroPct: numero(c.metaAhorroPct, 'meta de ahorro', { min: 0, max: 1 }),
    ahorroDesde: patron(c.ahorroDesde, ES_MES, 'primer mes del plan'),
  };
  const meses = (Array.isArray(d.meses) ? d.meses : []).map((m) => ({
    id: patron(m?.id, ES_MES, 'mes'),
    movil: elegir(m.movil, ESTADOS, 'estado del plan móvil'),
    abuelos: elegir(m.abuelos, ESTADOS, 'estado de abuelos'),
    personal: m.personal === undefined ? 'Pendiente' : elegir(m.personal, ESTADOS, 'estado del gasto personal'),
    ahorroReal: m.ahorroReal == null ? null : numero(m.ahorroReal, 'ahorro real'),
  }));
  if (!meses.length) throw new Error('El respaldo no tiene ningún mes.');
  meses.sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(meses.map((m) => m.id)).size !== meses.length) throw new Error('El respaldo tiene meses repetidos.');
  const extras = (Array.isArray(d.extras) ? d.extras : []).map((x) => ({
    id: texto(x?.id, 'id del extra'),
    mes: patron(x.mes, ES_MES, 'mes del extra'),
    concepto: texto(x.concepto, 'concepto'),
    monto: numero(x.monto, 'monto del extra'),
    estado: x.estado === undefined ? 'Pagado' : elegir(x.estado, ESTADOS, 'estado del extra'), // los respaldos v1 no lo traen
    creado: typeof x.creado === 'string' ? x.creado : null,
  }));
  const abonos = (Array.isArray(d.abonos) ? d.abonos : []).map((a) => ({
    id: texto(a?.id, 'id del abono'),
    fecha: patron(a.fecha, ES_FECHA, 'fecha del abono'),
    monto: numero(a.monto, 'monto del abono'),
    nota: typeof a.nota === 'string' ? a.nota : '',
    mes: a.mes == null ? null : patron(a.mes, ES_MES, 'cuota del abono'),
  }));
  return { version: 3, config, meses, extras, abonos, meta: d.meta ?? {} };
}

const redondo = (n) => Math.round(n * 100) / 100;

// Convierte datos v3 (ya válidos) al modelo v4. «hoy» decide qué salarios ya se cobraron.
export function convertirAv4(d, hoy = hoyISO()) {
  const nuevo = datosNuevos();
  const c = d.config;
  const mesHoy = hoy.slice(0, 7);
  const primerMes = d.meses[0]?.id ?? mesHoy;
  const ahora = new Date().toISOString();
  const creado = typeof d.meta?.creado === 'string' ? d.meta.creado : ahora;
  const cuentaId = nuevo.cuentas[0].id;

  const movimiento = (datos) =>
    nuevo.movimientos.push({ id: uid(), tipo: 'gasto', cuentaId, cuentaDestinoId: null, categoriaId: 'otros', nota: '', deudaId: null, fijo: null, creado, ...datos });
  const fijo = (datos) => {
    const f = { id: uid(), tipo: 'gasto', cuentaId, frecuencia: 'mensual', pausado: false, omitidas: [], ...datos };
    nuevo.fijos.push(f);
    return f;
  };

  if (c.salario > 0) {
    const f = fijo({ tipo: 'ingreso', concepto: 'Salario', monto: c.salario, categoriaId: 'salario', inicio: `${primerMes}-01` });
    for (const m of d.meses.filter((m) => m.id < mesHoy)) {
      movimiento({ tipo: 'ingreso', concepto: 'Salario', monto: c.salario, categoriaId: 'salario', fecha: `${m.id}-01`, fijo: { id: f.id, fecha: `${m.id}-01` } });
    }
  }
  for (const [clave, concepto, categoriaId] of [
    ['movil', 'Plan móvil', 'telefono'],
    ['abuelos', 'Abuelos', 'familia'],
  ]) {
    if (!(c[clave] > 0)) continue;
    const dia = c[`${clave}Dia`];
    const f = fijo({ concepto, monto: c[clave], categoriaId, inicio: fechaDelMes(primerMes, dia) });
    for (const m of d.meses.filter((m) => m[clave] === 'Pagado')) {
      const fecha = fechaDelMes(m.id, dia);
      movimiento({ concepto, monto: c[clave], categoriaId, fecha, fijo: { id: f.id, fecha } });
    }
  }

  for (const x of d.extras) {
    const dia = x.creado?.startsWith(x.mes) ? x.creado.slice(0, 10) : `${x.mes}-01`;
    if (x.estado === 'Pendiente') fijo({ concepto: x.concepto, monto: x.monto, categoriaId: 'otros', frecuencia: 'unica', inicio: dia });
    else movimiento({ concepto: x.concepto, monto: x.monto, fecha: dia, creado: x.creado ?? creado });
  }

  if (c.cruceroFaltante > 0 || d.abonos.length) {
    const deuda = { id: uid(), nombre: 'Crucero', total: c.cruceroFaltante, cuotas: Math.max(1, Math.round(c.cruceroMeses)), cuotaFija: null, inicio: c.ahorroDesde, diaPago: 30, cuentaId, nota: '', creado };
    nuevo.deudas.push(deuda);
    for (const a of d.abonos) {
      // Un abono marcado como «cuota de» un mes cuenta como pago de ese mes.
      const fecha = a.mes && !a.fecha.startsWith(a.mes) ? fechaDelMes(a.mes, Number(a.fecha.slice(8, 10))) : a.fecha;
      movimiento({ concepto: 'Pago de Crucero', monto: a.monto, categoriaId: 'deudas', fecha, nota: a.nota, deudaId: deuda.id });
    }
  }

  if (c.gastoPersonal > 0) nuevo.limites.push({ categoriaId: 'personal', monto: c.gastoPersonal, acumular: false, desde: mesHoy });
  nuevo.ajustes.metaAhorroPct = c.metaAhorroPct;

  const reales = d.meses.filter((m) => m.ahorroReal);
  if (reales.length) {
    const mesesPlan = d.meses.filter((m) => m.id >= c.ahorroDesde).length;
    const ahorrado = reales.reduce((s, m) => s + m.ahorroReal, 0);
    nuevo.objetivos.push({
      id: uid(),
      nombre: 'Ahorro',
      meta: Math.max(redondo(c.salario * c.metaAhorroPct * mesesPlan), redondo(ahorrado)),
      fechaLimite: null,
      icono: '🐷',
      creado,
      aportes: reales.map((m) => ({ id: uid(), fecha: `${m.id}-${diasEnMes(m.id)}`, monto: m.ahorroReal, cuentaId, nota: 'Ahorro real del mes' })),
    });
  }

  nuevo.meta = {
    creado,
    modificado: typeof d.meta?.modificado === 'string' ? d.meta.modificado : ahora,
    ultimoRespaldo: typeof d.meta?.ultimoRespaldo === 'string' ? d.meta.ultimoRespaldo : null,
  };
  return nuevo;
}
