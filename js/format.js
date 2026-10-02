const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Monedas que se pueden elegir en Ajustes. Solo cambia el símbolo: no convierte cantidades.
export const MONEDAS = [
  ['USD', '$', 'Dólar estadounidense'],
  ['PAB', 'B/.', 'Balboa panameño'],
  ['EUR', '€', 'Euro'],
  ['MXN', '$', 'Peso mexicano'],
  ['COP', '$', 'Peso colombiano'],
  ['ARS', '$', 'Peso argentino'],
  ['CLP', '$', 'Peso chileno'],
  ['PEN', 'S/', 'Sol peruano'],
  ['CRC', '₡', 'Colón costarricense'],
  ['GTQ', 'Q', 'Quetzal guatemalteco'],
  ['HNL', 'L', 'Lempira hondureño'],
  ['NIO', 'C$', 'Córdoba nicaragüense'],
  ['DOP', 'RD$', 'Peso dominicano'],
  ['BOB', 'Bs', 'Boliviano'],
  ['PYG', '₲', 'Guaraní paraguayo'],
  ['UYU', '$U', 'Peso uruguayo'],
  ['VES', 'Bs.', 'Bolívar venezolano'],
  ['BRL', 'R$', 'Real brasileño'],
  ['GBP', '£', 'Libra esterlina'],
  ['CAD', 'C$', 'Dólar canadiense'],
];
let simbolo = '$';
export const usarMoneda = (codigo) => {
  simbolo = MONEDAS.find((m) => m[0] === codigo)?.[1] ?? '$';
};

// Meses como "AAAA-MM" y fechas como "AAAA-MM-DD": se ordenan bien como texto.
export const nombreMes = (id) => MESES[Number(id.slice(5, 7)) - 1];
export const abreviaturaMes = (id) => nombreMes(id).slice(0, 3);
export const nombreMesAnio = (id) => `${nombreMes(id)} ${id.slice(0, 4)}`;
export const mesDeFecha = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
export const mesDeHoy = () => mesDeFecha(new Date());
export const sumarMeses = (id, n) => mesDeFecha(new Date(Number(id.slice(0, 4)), Number(id.slice(5, 7)) - 1 + n, 1));
export const mesSiguiente = (id) => sumarMeses(id, 1);
export const mesesEntre = (desde, hasta) => (Number(hasta.slice(0, 4)) - Number(desde.slice(0, 4))) * 12 + Number(hasta.slice(5, 7)) - Number(desde.slice(5, 7));
export const diasEnMes = (id) => new Date(Number(id.slice(0, 4)), Number(id.slice(5, 7)), 0).getDate();

const aISO = (d) => `${mesDeFecha(d)}-${String(d.getDate()).padStart(2, '0')}`;
const deISO = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
export const hoyISO = () => aISO(new Date());
export const sumarDias = (iso, n) => {
  const d = deISO(iso);
  d.setDate(d.getDate() + n);
  return aISO(d);
};
export const diasHasta = (desde, hasta) => Math.round((deISO(hasta) - deISO(desde)) / 86400000);
// Día «dia» del mes (si el mes es más corto, el último día: el 31 de febrero es el 28 o 29).
export const fechaDelMes = (mesId, dia) => `${mesId}-${String(Math.min(dia, diasEnMes(mesId))).padStart(2, '0')}`;
export const diaSemana = (iso) => DIAS[deISO(iso).getDay()];
export const fechaCorta = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
export const fechaHumana = (iso) => `${Number(iso.slice(8, 10))} ${abreviaturaMes(iso).toLowerCase()}`;

export function cuandoEs(iso, hoy = hoyISO()) {
  const d = diasHasta(hoy, iso);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Mañana';
  if (d === -1) return 'Ayer';
  if (d < 0) return `Hace ${-d} días`;
  return d < 7 ? `En ${d} días` : fechaHumana(iso);
}

export function dinero(n, { signo = false } = {}) {
  const r = Math.round(n * 100) / 100;
  const texto = Math.abs(r).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pre = r < 0 ? '−' : signo && r > 0 ? '+' : '';
  return `${pre}${simbolo}${texto}`;
}

export const numEntrada = (n) => (n == null ? '' : (Math.round(n * 100) / 100).toFixed(2));

// Acepta "26.90", "26,90" y "1,234.50". Devuelve NaN si no es un número.
export function parseMonto(texto) {
  let t = String(texto ?? '').replace(/[\s$€£₡₲]/g, '');
  if (!t) return NaN;
  t = t.includes(',') && t.includes('.') ? t.replace(/,/g, '') : t.replace(',', '.');
  return /^-?(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : NaN;
}

export const uid = () => crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
