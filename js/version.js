export const VERSION_APP = '2.0.0';
// Sube este número solo cuando cambie la forma de los datos guardados (y agrega la migración en store.js).
// 2: cada extra tiene estado Pagado/Pendiente.
// 3: cada mes guarda si el gasto personal está Pagado/Pendiente; un abono puede ir ligado a un mes (cuota del crucero).
// 4: modelo general: cuentas, categorías, movimientos, pagos fijos, deudas y objetivos (ver migrar-v4.js).
export const VERSION_DATOS = 4;
