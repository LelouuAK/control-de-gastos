// Datos de una instalación nueva. Van en blanco a propósito: la app se publica en internet
// y tus cifras personales no deben viajar dentro del código. Tus datos se cargan con «Importar».
import { VERSION_DATOS } from './version.js';
import { mesDeHoy, mesSiguiente } from './format.js';

export function datosNuevos() {
  const ahora = new Date().toISOString();
  const meses = [];
  for (let id = mesDeHoy(); meses.length < 4; id = mesSiguiente(id)) {
    meses.push({ id, movil: 'Pendiente', abuelos: 'Pendiente', personal: 'Pendiente', ahorroReal: null });
  }
  return {
    version: VERSION_DATOS,
    config: {
      salario: 0,
      movil: 0,
      movilDia: 1,
      abuelos: 0,
      abuelosDia: 1,
      cruceroFaltante: 0,
      cruceroMeses: 1,
      gastoPersonal: 0,
      metaAhorroPct: 0.2,
      ahorroDesde: meses[0].id,
    },
    meses,
    extras: [],
    abonos: [],
    meta: { creado: ahora, modificado: ahora, ultimoRespaldo: null },
  };
}
