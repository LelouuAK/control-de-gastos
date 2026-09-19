const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const SIMBOLO = '$';

// Los meses se guardan como "AAAA-MM" (ej. "2026-09") para poder ordenarlos como texto.
export const nombreMes = (id) => MESES[Number(id.slice(5)) - 1];
export const abreviaturaMes = (id) => nombreMes(id).slice(0, 3);
export const nombreMesAnio = (id) => `${nombreMes(id)} ${id.slice(0, 4)}`;
export const mesDeFecha = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const mesDeHoy = () => mesDeFecha(new Date());
export const mesSiguiente = (id) => mesDeFecha(new Date(Number(id.slice(0, 4)), Number(id.slice(5)), 1));
export const diasEnMes = (id) => new Date(Number(id.slice(0, 4)), Number(id.slice(5)), 0).getDate();
export const hoyISO = () => `${mesDeHoy()}-${String(new Date().getDate()).padStart(2, '0')}`;
export const fechaCorta = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

// Igual que el formato del Excel ($#,##0.00); guionSiCero muestra "–" cuando el monto es 0.
export function dinero(n, { guionSiCero = false } = {}) {
  const r = Math.round(n * 100) / 100;
  if (r === 0 && guionSiCero) return '–';
  const texto = Math.abs(r).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${r < 0 ? '−' : ''}${SIMBOLO}${texto}`;
}

export const numEntrada = (n) => (n == null ? '' : (Math.round(n * 100) / 100).toFixed(2));

// Acepta "26.90", "26,90" y "1,234.50". Devuelve NaN si no es un número.
export function parseMonto(texto) {
  let t = String(texto ?? '').replace(/[\s$]/g, '');
  if (!t) return NaN;
  t = t.includes(',') && t.includes('.') ? t.replace(/,/g, '') : t.replace(',', '.');
  return /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : NaN;
}

export const uid = () => crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
