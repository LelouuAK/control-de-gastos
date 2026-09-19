// Respaldo y restauración: un archivo JSON que puedes guardar en Archivos / iCloud Drive.
import { VERSION_DATOS } from './version.js';
import { hoyISO } from './format.js';
import { cambiar, obtener } from './store.js';
import { aviso } from './ui.js';

const ES_MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS = ['Pagado', 'Pendiente'];

export const armarRespaldo = (estado) =>
  JSON.stringify({ app: 'control-de-gastos', version: VERSION_DATOS, exportado: new Date().toISOString(), datos: estado }, null, 2);

function numero(valor, nombre, { min = -Infinity, max = Infinity } = {}) {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < min || valor > max) throw new Error(`Dato no válido en el respaldo: ${nombre}.`);
  return valor;
}

function elegir(valor, permitidos, nombre) {
  if (!permitidos.includes(valor)) throw new Error(`Dato no válido en el respaldo: ${nombre}.`);
  return valor;
}

function texto(valor, nombre) {
  if (typeof valor !== 'string') throw new Error(`Dato no válido en el respaldo: ${nombre}.`);
  return valor;
}

const patron = (valor, regex, nombre) => {
  if (!regex.test(valor)) throw new Error(`Dato no válido en el respaldo: ${nombre}.`);
  return valor;
};

// Lee el texto de un respaldo, lo valida y devuelve solo los campos que la app conoce.
export function leerRespaldo(contenido) {
  let crudo;
  try {
    crudo = JSON.parse(contenido);
  } catch {
    throw new Error('No se pudo leer el archivo: no es un respaldo válido.');
  }
  if (crudo?.app !== 'control-de-gastos' || typeof crudo.datos !== 'object' || !crudo.datos) throw new Error('Este archivo no es un respaldo de Control de gastos.');
  if (crudo.version > VERSION_DATOS) throw new Error('El respaldo es de una versión más nueva. Actualiza la app.');

  const d = crudo.datos;
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
    ahorroDesde: patron(texto(c.ahorroDesde, 'primer mes del plan'), ES_MES, 'primer mes del plan'),
  };

  const meses = (Array.isArray(d.meses) ? d.meses : []).map((m) => ({
    id: patron(texto(m?.id, 'mes'), ES_MES, 'mes'),
    movil: elegir(m.movil, ESTADOS, 'estado del plan móvil'),
    abuelos: elegir(m.abuelos, ESTADOS, 'estado de abuelos'),
    ahorroReal: m.ahorroReal == null ? null : numero(m.ahorroReal, 'ahorro real'),
  }));
  if (!meses.length) throw new Error('El respaldo no tiene ningún mes.');
  meses.sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(meses.map((m) => m.id)).size !== meses.length) throw new Error('El respaldo tiene meses repetidos.');

  const extras = (Array.isArray(d.extras) ? d.extras : []).map((x) => {
    const mes = patron(texto(x?.mes, 'mes del extra'), ES_MES, 'mes del extra');
    if (!meses.some((m) => m.id === mes)) throw new Error(`Un extra apunta a un mes que no existe (${mes}).`);
    return { id: texto(x.id, 'id del extra'), mes, concepto: texto(x.concepto, 'concepto'), monto: numero(x.monto, 'monto del extra'), creado: typeof x.creado === 'string' ? x.creado : new Date().toISOString() };
  });

  const abonos = (Array.isArray(d.abonos) ? d.abonos : []).map((a) => ({
    id: texto(a?.id, 'id del abono'),
    fecha: patron(texto(a.fecha, 'fecha del abono'), ES_FECHA, 'fecha del abono'),
    monto: numero(a.monto, 'monto del abono'),
    nota: typeof a.nota === 'string' ? a.nota : '',
  }));

  const ahora = new Date().toISOString();
  const m = d.meta ?? {};
  return {
    version: VERSION_DATOS,
    config,
    meses,
    extras,
    abonos,
    meta: {
      creado: typeof m.creado === 'string' ? m.creado : ahora,
      modificado: typeof m.modificado === 'string' ? m.modificado : ahora,
      ultimoRespaldo: typeof m.ultimoRespaldo === 'string' ? m.ultimoRespaldo : null,
    },
  };
}

// En iPhone lo más fiable es la hoja de compartir («Guardar en Archivos»); si no existe, se descarga.
async function entregarArchivo(nombre, contenido) {
  const archivo = new File([contenido], nombre, { type: 'application/json' });
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
  const resultado = await entregarArchivo(`gastos-respaldo-${hoyISO()}.json`, armarRespaldo(obtener()));
  if (resultado === 'cancelado') return;
  cambiar((e) => {
    e.meta.ultimoRespaldo = new Date().toISOString();
  });
  aviso('Respaldo guardado');
}

// Aviso en pantalla si nunca se ha hecho un respaldo (a los 7 días) o el último tiene más de 30 días.
export function respaldoPendiente(estado) {
  const dias = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000;
  const { ultimoRespaldo, creado } = estado.meta;
  return ultimoRespaldo ? dias(ultimoRespaldo) > 30 : dias(creado) > 7;
}
