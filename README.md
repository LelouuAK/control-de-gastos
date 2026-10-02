# Control de gastos

App web para llevar tus finanzas desde el celular: gastos e ingresos, cuentas, pagos fijos, **deudas en cuotas** y objetivos de ahorro. Se instala en la pantalla de inicio del iPhone como una app, funciona sin internet y tus datos se quedan en tu teléfono.

**Probarla:** <https://lelouuak.github.io/control-de-gastos/>

## Qué hace

Barra inferior: **Inicio · Movimientos · + · Análisis · Ajustes**.

| Pantalla | Para qué sirve |
|---|---|
| **Inicio** | Cuánto **te queda este mes** (lo que entra menos lo gastado y lo que falta pagar), lo que toca pagar o cobrar con un botón para marcarlo, tus deudas, tus cuentas, tus objetivos y lo último que anotaste. |
| **Movimientos** | Lista por mes con buscador y filtros (tipo, cuenta, categoría), o **calendario** con lo anotado y lo que viene cada día. |
| **+** | Anotar un gasto, un ingreso o una transferencia entre cuentas. Un gasto puede ser el abono a una deuda. |
| **Análisis** | **Resumen** del mes, 3 meses o el año (balance, % ahorrado contra tu meta, gasto por día, cuánto habrás gastado al cerrar el mes, frente al periodo anterior, lo importante del mes, próximos 30 días y en qué se va el dinero); **Histórico** mes a mes y del año; **Comparar** los últimos 7 o 14 días, o el mes, con el tramo anterior. |
| **Ajustes** | Cuentas, pagos fijos, deudas, objetivos, categorías, **Planificación**, **Centro financiero**, moneda, meta de ahorro, respaldo y exportación a CSV. |
| Planificación | Cuánto **puedes gastar** hasta fin de mes (y por día), **límites por categoría** (lo no gastado puede pasar al mes siguiente) y avisos. |
| Centro financiero | Puntaje de **salud financiera** con cuatro indicadores (ahorro, colchón, deudas y gastos), **fondo de emergencia** y previsión de 30 días. Es una orientación con tus números, no asesoría financiera. |

### Deudas

Cualquier cosa que debas: un préstamo, la tarjeta, un viaje en cuotas o dinero que te prestaron. Se paga de dos formas:

- **En un número de meses:** la cuota es lo que falta entre los meses que quedan hasta el último mes. Si un mes no pagas, la cuota de los siguientes sube.
- **Con cuota fija:** esa cuota hasta terminar; la última puede ser menor.

Cada deuda tiene su **día de pago**: la cuota aparece en Inicio y en el calendario, y se marca como atrasada si pasa la fecha. Un pago parcial deja pendiente solo lo que falta de la cuota del mes.

### Pagos fijos

Salario, alquiler, teléfono, suscripciones… cada mes, semana, 3 meses, año o una sola vez. No se anotan solos: cuando toca aparecen en Inicio y se marcan como pagados o cobrados con un toque (también se pueden anotar con otro monto u omitir esa vez).

## Instalar en el iPhone

1. Abre la dirección de la app en **Safari**.
2. Toca **Compartir → Añadir a pantalla de inicio**.
3. Abre la app **desde el ícono**.

> El ícono de inicio y Safari guardan sus datos por separado. Usa siempre el ícono.

## Tus datos y tu privacidad

- **No hay servidor ni cuentas de usuario.** Todo se guarda en el propio dispositivo, en IndexedDB.
- Este repositorio es público y contiene **solo código**; una instalación nueva arranca en blanco.
- **Ajustes → Respaldar ahora** genera un archivo `.json` para guardar en Archivos o iCloud Drive; **Restaurar desde un archivo** lo vuelve a cargar. Inicio avisa si pasan 7 días sin un respaldo (30 si ya hiciste uno).
- Los respaldos de la versión 1 (la que tenía Mes, Ahorro, Extras y Crucero) se pueden importar: se convierten solos al modelo nuevo.

## Cómo está hecha

HTML, CSS y JavaScript sin librerías ni paso de compilación: módulos ES, IndexedDB, un service worker para el modo sin conexión, `<dialog>` para las hojas de captura y SVG para las gráficas.

```
.
├─ index.html · manifest.webmanifest · sw.js
├─ css/styles.css
├─ icons/
└─ js/
   ├─ main.js        arranque, rutas (#inicio, #deuda/<id>…) y un solo oyente de toques y cambios
   ├─ calc.js        cálculos base (saldos, mes, pagos fijos, deudas, objetivos), sin pantalla
   ├─ finanzas.js    periodos, comparar, límites, puedes gastar, previsión, salud financiera y avisos
   ├─ store.js       guardado en IndexedDB y única puerta para modificar datos
   ├─ migrar-v4.js   paso de los datos de la versión 1 al modelo actual
   ├─ respaldo.js    exportar, importar y validar respaldos; CSV
   ├─ seed.js        datos de una instalación nueva (en blanco, con categorías base)
   ├─ format.js      dinero, monedas, fechas y lectura de montos ("12,50" y "12.50")
   ├─ ui.js          plantillas seguras, avisos, hojas de captura y piezas comunes
   ├─ version.js
   └─ views/         inicio · movimientos · analisis · ajustes · cuentas · categorias · deudas
                     objetivos · fijos · planificacion · centro · hojas (captura) · piezas (filas comunes)
```

El flujo es siempre el mismo: **toque → `store.cambiar()` → se guarda → se repinta la pantalla con `calc.js`**. Todo lo que escribe el usuario se escapa antes de mostrarse.

### Datos guardados

Un solo documento JSON. Solo se guarda lo que escribe el usuario; saldos, pendientes, cuotas y avances se calculan.

```json
{
  "version": 4,
  "ajustes":    { "nombre": "", "moneda": "USD", "metaAhorroPct": 0.2 },
  "cuentas":    [ { "id": "principal", "nombre": "Principal", "tipo": "banco", "saldoInicial": 0, "archivada": false } ],
  "categorias": [ { "id": "comida", "tipo": "gasto", "nombre": "Comida", "icono": "🛒" } ],
  "movimientos":[ { "id": "…", "tipo": "gasto", "monto": 20, "concepto": "Almuerzo", "fecha": "2026-10-01",
                    "cuentaId": "principal", "cuentaDestinoId": null, "categoriaId": "comida", "nota": "",
                    "deudaId": null, "fijo": null, "creado": "…" } ],
  "fijos":      [ { "id": "…", "tipo": "gasto", "concepto": "Alquiler", "monto": 300, "frecuencia": "mensual",
                    "inicio": "2026-10-05", "cuentaId": "principal", "categoriaId": "vivienda", "pausado": false, "omitidas": [] } ],
  "deudas":     [ { "id": "…", "nombre": "Préstamo", "total": 1200, "cuotas": 12, "cuotaFija": null,
                    "inicio": "2026-10", "diaPago": 15, "cuentaId": "principal", "nota": "" } ],
  "objetivos":  [ { "id": "…", "nombre": "Moto", "meta": 3000, "fechaLimite": null, "icono": "🏍️",
                    "aportes": [ { "id": "…", "fecha": "2026-10-01", "monto": 100, "cuentaId": "principal", "nota": "" } ] } ],
  "limites":    [ { "categoriaId": "personal", "monto": 150, "acumular": false, "desde": "2026-10" } ],
  "meta":       { "creado": "…", "modificado": "…", "ultimoRespaldo": null }
}
```

- Un movimiento con `fijo: { id, fecha }` es el pago de un pago fijo en esa fecha; con `deudaId`, el abono a una deuda.
- Para cambiar la forma de los datos: sube `VERSION_DATOS` en `js/version.js` y agrega el paso en `js/store.js → migrar()`.

### Desarrollo y publicación

Sirve la carpeta con cualquier servidor estático (los service workers y los módulos ES no funcionan abriendo el archivo directamente). Para publicar: sube `VERSION_APP` y el número de `CACHE` en `sw.js`, y haz `git push`; GitHub Pages tarda 1–2 minutos y la app instalada se actualiza sola al abrirla con internet.

## Compatibilidad y límites

- Pensada para **iPhone con iOS 15.4 o superior**.
- Los pagos fijos no se registran solos: hay que marcarlos (así la app refleja lo que de verdad pasó).
- La moneda solo cambia el símbolo; no convierte montos.

## Licencia

[MIT](LICENSE): puedes usar, copiar, modificar y distribuir el código, conservando el aviso de copyright. Se ofrece tal cual, sin garantía.
