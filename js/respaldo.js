// Respaldo y restauración: un archivo JSON que puedes guardar en Archivos / iCloud Drive.
// También acepta respaldos de la app 1.x (los convierte al modelo nuevo) y exporta los movimientos a CSV.
import { VERSION_DATOS } from './version.js';
import { hoyISO, numEntrada } from './format.js';
import { cambiar, obtener } from './store.js';
import { aviso } from './ui.js';
import { validarV3, convertirAv4 } from './migrar-v4.js';
import { categoriaPorId, cuentaPorId, ordenarMovimientos } from './calc.js';

const ES_MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const ES_FECHA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIPOS_MOV = ['gasto', 'ingreso', 'transferencia'];
const FRECUENCIAS = ['unica', 'semanal', 'mensual', 'trimestral', 'anual'];
const TIPOS_CUENTA = ['banco', 'efectivo', 'tarjeta', 'ahorro', 'otro'];

export const armarRespaldo = (estado) =>
  JSON.stringify({ app: 'control-de-gastos', version: VERSION_DATOS, exportado: new Date().toISOString(), datos: estado }, null, 2);

const malo = (nombre) => new Error(`Dato no válido en el respaldo: ${nombre}.`);
function numero(valor, nombre, { min = -Infinity, max = Infinity } = {}) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < min || valor > max) throw malo(nombre);
  return valor;
}
const texto = (valor, nombre) => {
  if (typeof valor !== 'string') throw malo(nombre);
  return valor;
};
const elegir = (valor, permitidos, nombre) => {
  if (!permitidos.includes(valor)) throw malo(nombre);
  return valor;
};
const patron = (valor, regex, nombre) => {
  if (!regex.test(texto(valor, nombre))) throw malo(nombre);
  return valor;
};
const opcional = (valor, fn) => (valor == null || valor === '' ? null : fn(valor));
const lista = (v) => (Array.isArray(v) ? v : []);
const idsUnicos = (items, nombre) => {
  if (new Set(items.map((x) => x.id)).size !== items.length) throw new Error(`El respaldo tiene ${nombre} repetidos.`);
};

// Valida datos v4 y devuelve solo los campos que la app conoce.
function validarV4(d) {
  const a = d.ajustes ?? {};
  const ajustes = {
    nombre: typeof a.nombre === 'string' ? a.nombre : '',
    moneda: typeof a.moneda === 'string' ? a.moneda : 'USD',
    metaAhorroPct: numero(a.metaAhorroPct ?? 0.2, 'meta de ahorro', { min: 0, max: 1 }),
  };
  const cuentas = lista(d.cuentas).map((c) => ({
    id: texto(c?.id, 'id de cuenta'),
    nombre: texto(c.nombre, 'nombre de cuenta'),
    tipo: elegir(c.tipo, TIPOS_CUENTA, 'tipo de cuenta'),
    saldoInicial: numero(c.saldoInicial, 'saldo inicial'),
    archivada: Boolean(c.archivada),
  }));
  if (!cuentas.length) throw new Error('El respaldo no tiene ninguna cuenta.');
  idsUnicos(cuentas, 'cuentas');
  const categorias = lista(d.categorias).map((c) => ({
    id: texto(c?.id, 'id de categoría'),
    tipo: elegir(c.tipo, ['gasto', 'ingreso'], 'tipo de categoría'),
    nombre: texto(c.nombre, 'nombre de categoría'),
    icono: typeof c.icono === 'string' ? c.icono : '•',
  }));
  idsUnicos(categorias, 'categorías');
  const existe = (items, id, nombre) => {
    if (!items.some((x) => x.id === id)) throw new Error(`El respaldo apunta a ${nombre} que no existe.`);
    return id;
  };
  const deudas = lista(d.deudas).map((x) => ({
    id: texto(x?.id, 'id de deuda'),
    nombre: texto(x.nombre, 'nombre de deuda'),
    total: numero(x.total, 'total de la deuda', { min: 0 }),
    cuotas: numero(x.cuotas ?? 1, 'número de cuotas', { min: 1 }),
    cuotaFija: opcional(x.cuotaFija, (v) => numero(v, 'cuota fija', { min: 0.01 })),
    inicio: patron(x.inicio, ES_MES, 'primer mes de la deuda'),
    diaPago: numero(x.diaPago, 'día de pago', { min: 1, max: 31 }),
    cuentaId: existe(cuentas, x.cuentaId, 'una cuenta'),
    nota: typeof x.nota === 'string' ? x.nota : '',
    creado: typeof x.creado === 'string' ? x.creado : null,
  }));
  idsUnicos(deudas, 'deudas');
  const fijos = lista(d.fijos).map((f) => ({
    id: texto(f?.id, 'id de pago fijo'),
    tipo: elegir(f.tipo, ['gasto', 'ingreso'], 'tipo de pago fijo'),
    concepto: texto(f.concepto, 'concepto del pago fijo'),
    monto: numero(f.monto, 'monto del pago fijo', { min: 0 }),
    cuentaId: existe(cuentas, f.cuentaId, 'una cuenta'),
    categoriaId: existe(categorias, f.categoriaId, 'una categoría'),
    frecuencia: elegir(f.frecuencia, FRECUENCIAS, 'frecuencia'),
    inicio: patron(f.inicio, ES_FECHA, 'fecha del pago fijo'),
    pausado: Boolean(f.pausado),
    omitidas: lista(f.omitidas).map((o) => patron(o, ES_FECHA, 'fecha omitida')),
  }));
  idsUnicos(fijos, 'pagos fijos');
  const movimientos = lista(d.movimientos).map((m) => {
    const tipo = elegir(m?.tipo, TIPOS_MOV, 'tipo de movimiento');
    return {
      id: texto(m.id, 'id de movimiento'),
      tipo,
      monto: numero(m.monto, 'monto del movimiento', { min: 0 }),
      concepto: texto(m.concepto, 'concepto'),
      fecha: patron(m.fecha, ES_FECHA, 'fecha del movimiento'),
      cuentaId: existe(cuentas, m.cuentaId, 'una cuenta'),
      cuentaDestinoId: tipo === 'transferencia' ? existe(cuentas, m.cuentaDestinoId, 'una cuenta') : null,
      categoriaId: tipo === 'transferencia' ? null : existe(categorias, m.categoriaId, 'una categoría'),
      nota: typeof m.nota === 'string' ? m.nota : '',
      deudaId: m.deudaId == null ? null : existe(deudas, m.deudaId, 'una deuda'),
      fijo: m.fijo == null ? null : { id: existe(fijos, m.fijo.id, 'un pago fijo'), fecha: patron(m.fijo.fecha, ES_FECHA, 'fecha del pago fijo') },
      creado: typeof m.creado === 'string' ? m.creado : null,
    };
  });
  idsUnicos(movimientos, 'movimientos');
  const objetivos = lista(d.objetivos).map((o) => ({
    id: texto(o?.id, 'id de objetivo'),
    nombre: texto(o.nombre, 'nombre de objetivo'),
    meta: numero(o.meta, 'meta del objetivo', { min: 0 }),
    fechaLimite: opcional(o.fechaLimite, (v) => patron(v, ES_FECHA, 'fecha límite')),
    icono: typeof o.icono === 'string' ? o.icono : '🎯',
    creado: typeof o.creado === 'string' ? o.creado : null,
    aportes: lista(o.aportes).map((x) => ({
      id: texto(x?.id, 'id de aporte'),
      fecha: patron(x.fecha, ES_FECHA, 'fecha de aporte'),
      monto: numero(x.monto, 'monto de aporte'),
      cuentaId: opcional(x.cuentaId, (v) => existe(cuentas, v, 'una cuenta')),
      nota: typeof x.nota === 'string' ? x.nota : '',
    })),
  }));
  idsUnicos(objetivos, 'objetivos');
  const limites = lista(d.limites).map((l) => ({
    categoriaId: existe(categorias, l?.categoriaId, 'una categoría'),
    monto: numero(l.monto, 'límite', { min: 0 }),
    acumular: Boolean(l.acumular),
    desde: opcional(l.desde, (v) => patron(v, ES_MES, 'mes del límite')), // desde cuándo acumula lo no gastado
  }));
  if (new Set(limites.map((l) => l.categoriaId)).size !== limites.length) throw new Error('El respaldo tiene límites repetidos.');
  const ahora = new Date().toISOString();
  const m = d.meta ?? {};
  return {
    version: VERSION_DATOS,
    ajustes,
    cuentas,
    categorias,
    movimientos,
    fijos,
    deudas,
    objetivos,
    limites,
    meta: {
      creado: typeof m.creado === 'string' ? m.creado : ahora,
      modificado: typeof m.modificado === 'string' ? m.modificado : ahora,
      ultimoRespaldo: typeof m.ultimoRespaldo === 'string' ? m.ultimoRespaldo : null,
    },
  };
}

// Lee el texto de un respaldo, lo valida y devuelve datos v4 listos para usar.
export function leerRespaldo(contenido, hoy = hoyISO()) {
  let crudo;
  try {
    crudo = JSON.parse(contenido);
  } catch {
    throw new Error('No se pudo leer el archivo: no es un respaldo válido.');
  }
  if (crudo?.app !== 'control-de-gastos' || typeof crudo.datos !== 'object' || !crudo.datos) throw new Error('Este archivo no es un respaldo de Control de gastos.');
  if (crudo.version > VERSION_DATOS) throw new Error('El respaldo es de una versión más nueva. Actualiza la app.');
  if (crudo.version < 4) return validarV4(convertirAv4(validarV3(crudo.datos), hoy));
  return validarV4(crudo.datos);
}

// En iPhone lo más fiable es la hoja de compartir («Guardar en Archivos»); si no existe, se descarga.
async function entregarArchivo(nombre, contenido, tipo) {
  const archivo = new File([contenido], nombre, { type: tipo });
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre });
      return 'compartido';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelado';
    }
  }
  const enlace = document.createElement('a');
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 10000);
  return 'descargado';
}

export async function hacerRespaldo() {
  const resultado = await entregarArchivo(`gastos-respaldo-${hoyISO()}.json`, armarRespaldo(obtener()), 'application/json');
  if (resultado === 'cancelado') return;
  cambiar((e) => {
    e.meta.ultimoRespaldo = new Date().toISOString();
  });
  aviso('Respaldo guardado');
}

// Movimientos en CSV (se abre en Excel o Numbers). El BOM hace que Excel lea bien las tildes.
export function movimientosCSV(estado) {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = [['Fecha', 'Tipo', 'Concepto', 'Categoría', 'Cuenta', 'Cuenta destino', 'Monto', 'Nota']];
  for (const m of ordenarMovimientos(estado.movimientos)) {
    filas.push([m.fecha, m.tipo, m.concepto, categoriaPorId(estado, m.categoriaId)?.nombre, cuentaPorId(estado, m.cuentaId)?.nombre, cuentaPorId(estado, m.cuentaDestinoId)?.nombre, numEntrada(m.tipo === 'gasto' ? -m.monto : m.monto), m.nota]);
  }
  return `﻿${filas.map((f) => f.map(celda).join(',')).join('\r\n')}`;
}

export async function exportarCSV() {
  const resultado = await entregarArchivo(`movimientos-${hoyISO()}.csv`, movimientosCSV(obtener()), 'text/csv');
  if (resultado !== 'cancelado') aviso('Movimientos exportados');
}

// Aviso en pantalla si nunca se ha hecho un respaldo (a los 7 días) o el último tiene más de 30 días.
export function respaldoPendiente(estado) {
  const dias = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000;
  const { ultimoRespaldo, creado } = estado.meta;
  return ultimoRespaldo ? dias(ultimoRespaldo) > 30 : dias(creado) > 7;
}
