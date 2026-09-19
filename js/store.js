// Dónde viven los datos: un solo documento JSON guardado en IndexedDB, dentro del iPhone.
// Para pasar a la nube más adelante solo hay que cambiar leer() y escribir(); el resto no se entera.
import { datosNuevos } from './seed.js';
import { VERSION_DATOS } from './version.js';

const BD = 'control-gastos';
const ALMACEN = 'estado';
const CLAVE = 'principal';

let conexion = null;
const abrir = () =>
  (conexion ??= new Promise((ok, fallo) => {
    const req = indexedDB.open(BD, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(ALMACEN);
    req.onsuccess = () => ok(req.result);
    req.onerror = () => {
      conexion = null;
      fallo(req.error);
    };
  }));

async function leer() {
  const bd = await abrir();
  return new Promise((ok, fallo) => {
    const req = bd.transaction(ALMACEN).objectStore(ALMACEN).get(CLAVE);
    req.onsuccess = () => ok(req.result ?? null);
    req.onerror = () => fallo(req.error);
  });
}

async function escribir(valor) {
  const bd = await abrir();
  return new Promise((ok, fallo) => {
    const tx = bd.transaction(ALMACEN, 'readwrite');
    tx.objectStore(ALMACEN).put(valor, CLAVE);
    tx.oncomplete = ok;
    tx.onerror = tx.onabort = () => fallo(tx.error);
  });
}

let estado = null;
let cola = Promise.resolve();
let alFallar = () => {};
const oyentes = new Set();
let guardadoDisponible = true;

export const obtener = () => estado;
export const suscribir = (fn) => oyentes.add(fn);
export const alFallarGuardado = (fn) => {
  alFallar = fn;
};
export const hayGuardado = () => guardadoDisponible;

// Aquí irán las migraciones cuando cambie la forma de los datos (VERSION_DATOS).
function migrar(datos) {
  if (datos.version > VERSION_DATOS) throw new Error('Los datos guardados son de una versión más nueva de la app.');
  return datos;
}

function persistir() {
  const copia = structuredClone(estado);
  cola = cola.then(() => escribir(copia)).catch((err) => alFallar(err));
}

export async function iniciar() {
  try {
    const guardado = await leer();
    estado = guardado ? migrar(guardado) : datosNuevos();
    if (!guardado) persistir();
  } catch (err) {
    guardadoDisponible = false; // p. ej. el navegador bloquea el almacenamiento: la app funciona, pero no guarda
    estado = datosNuevos();
  }
  navigator.storage?.persist?.().catch(() => {}); // pide a iOS que no borre estos datos por falta de espacio
  return estado;
}

// Única puerta para modificar datos: aplica el cambio, guarda y avisa a las pantallas.
export function cambiar(fn) {
  fn(estado);
  estado.meta.modificado = new Date().toISOString();
  persistir();
  oyentes.forEach((f) => f());
}

export function reemplazarDatos(nuevos) {
  estado = nuevos;
  persistir();
  oyentes.forEach((f) => f());
}
