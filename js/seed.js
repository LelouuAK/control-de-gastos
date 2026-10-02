// Datos de una instalación nueva. Van en blanco a propósito: la app se publica en internet
// y tus cifras personales no deben viajar dentro del código. Tus datos se cargan con «Restaurar».
import { VERSION_DATOS } from './version.js';

// Categorías con las que arranca cualquier persona; se pueden renombrar, quitar o agregar más.
export const CATEGORIAS_BASE = [
  ['comida', 'gasto', 'Comida', '🛒'],
  ['transporte', 'gasto', 'Transporte', '🚌'],
  ['vivienda', 'gasto', 'Vivienda', '🏠'],
  ['servicios', 'gasto', 'Servicios', '💡'],
  ['telefono', 'gasto', 'Teléfono e internet', '📱'],
  ['salud', 'gasto', 'Salud', '💊'],
  ['ocio', 'gasto', 'Ocio', '🎬'],
  ['compras', 'gasto', 'Compras', '🛍️'],
  ['familia', 'gasto', 'Familia', '👪'],
  ['personal', 'gasto', 'Personal', '🙂'],
  ['deudas', 'gasto', 'Deudas', '🧾'],
  ['otros', 'gasto', 'Otros gastos', '📦'],
  ['salario', 'ingreso', 'Salario', '💼'],
  ['extra', 'ingreso', 'Ingresos extra', '✨'],
  ['otros-ingresos', 'ingreso', 'Otros ingresos', '💵'],
].map(([id, tipo, nombre, icono]) => ({ id, tipo, nombre, icono }));

export function datosNuevos() {
  const ahora = new Date().toISOString();
  return {
    version: VERSION_DATOS,
    ajustes: { nombre: '', moneda: 'USD', metaAhorroPct: 0.2 },
    cuentas: [{ id: 'principal', nombre: 'Principal', tipo: 'banco', saldoInicial: 0, archivada: false }],
    categorias: structuredClone(CATEGORIAS_BASE),
    movimientos: [],
    fijos: [],
    deudas: [],
    objetivos: [],
    limites: [],
    meta: { creado: ahora, modificado: ahora, ultimoRespaldo: null },
  };
}
