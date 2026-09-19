# Control de gastos

App web para llevar el control de tus gastos mensuales desde el celular: pagos fijos, gastos extras, un objetivo de pago (por ejemplo, un crucero) y un plan de ahorro. Se instala en la pantalla de inicio del iPhone como una app y funciona sin internet.

**Probarla:** <https://lelouuak.github.io/control-de-gastos/>

Nació como una hoja de Excel y conserva su lógica, pensada ahora para usarse con el pulgar.

## Qué hace

La app tiene cinco pestañas.

| Pestaña | Para qué sirve |
|---|---|
| **Mes** | El tablero de un mes: salario, pagos fijos, extras, crucero y gastos personales, cada uno con su estado **Pendiente / Pagado**, y la cifra «Te queda». El chip **Total** suma todos los meses. |
| **Ahorro** | Cuánto ahorrarás en total, si superas tu meta, una gráfica con una barra por mes y el detalle de cada mes. |
| **Extras** | Los gastos que no son fijos, agrupados por mes, cada uno Pagado o Pendiente. |
| **Crucero** | Seguimiento de un objetivo de pago: cuánto falta, un barco que avanza según lo abonado, la cuota sugerida y los abonos. |
| **Config** | Salario, pagos fijos y sus días, el objetivo de pago, el respaldo y la restauración de datos. |

### Cómo se calcula

Todo se deriva de unos pocos datos que escribe el usuario; el resto se calcula.

```
Saldo libre    = salario − plan móvil − abuelos − extras
Ahorro del mes = saldo libre − cuota del crucero − gastos personales
Ahorro acumulado = suma de los ahorros de los meses del plan hasta ese mes

Cuota del crucero = faltante / meses restantes
Meses restantes   = meses para terminar de pagar − cuotas ya pagadas

Ya pagado  = lo marcado como Pagado
Por pagar  = lo que sigue en Pendiente (pagos fijos, extras, crucero y gastos personales)
```

- Un extra **pendiente** resta del saldo libre (es un gasto comprometido), pero cuenta como «por pagar».
- Marcar como **Pagado** la cuota del crucero en la pestaña Mes registra un abono ligado a ese mes en la pestaña Crucero; volver a Pendiente lo quita.
- Cuando un pago fijo sigue Pendiente y su día del mes ya pasó, la app muestra «Venció el día X».
- La meta de ahorro es un porcentaje del salario y el gasto personal es un estimado mensual; ambos se editan en la pestaña Ahorro.

## Instalar en el iPhone

1. Abre la dirección de la app en **Safari**.
2. Toca **Compartir → Añadir a pantalla de inicio**.
3. Abre la app **desde el ícono**.

> El ícono de inicio y Safari guardan sus datos por separado. Usa siempre el ícono.

## Tus datos y tu privacidad

- **No hay servidor ni cuentas.** Todo se guarda en el propio dispositivo, en IndexedDB.
- La app pide al sistema que no borre esos datos por falta de espacio.
- Este repositorio es público y contiene **solo código**; una instalación nueva arranca en blanco.
- Si borras la app o cambias de teléfono sin respaldo, se pierden los datos. Por eso **Config → Respaldar ahora** genera un archivo `.json` que puedes guardar en Archivos o iCloud Drive, y **Restaurar desde un archivo** lo vuelve a cargar. Al abrir la pestaña Mes, la app avisa si pasan 7 días sin un respaldo (30 si ya hiciste uno).
- Los respaldos de versiones anteriores se pueden importar: la app los actualiza al formato actual.

## Cómo está hecha

HTML, CSS y JavaScript sin librerías ni paso de compilación. Usa módulos ES, IndexedDB, un service worker para el modo sin conexión, `<dialog>` para las hojas de captura y SVG para la gráfica y el barco.

```
.
├─ index.html · manifest.webmanifest · sw.js
├─ css/styles.css
├─ icons/
└─ js/
   ├─ main.js       arranque, pestañas y un solo oyente de toques y cambios
   ├─ calc.js       todas las fórmulas, sin nada de pantalla
   ├─ store.js      guardado en IndexedDB y única puerta para modificar datos
   ├─ respaldo.js   exportar, importar y validar el archivo de respaldo
   ├─ seed.js       datos de una instalación nueva (en blanco)
   ├─ format.js     dinero, fechas y lectura de montos ("12,50" y "12.50")
   ├─ ui.js         plantillas seguras, avisos, hojas de captura y confirmaciones
   ├─ version.js
   └─ views/        mes.js · ahorro.js · extras.js · crucero.js · config.js
```

El flujo es siempre el mismo: **toque → `store.cambiar()` → se guarda → se repinta la pantalla con las fórmulas de `calc.js`**. Todo lo que escribe el usuario se escapa antes de mostrarse.

### Datos guardados

Un solo documento JSON. Solo se guarda lo que escribe el usuario.

```json
{
  "version": 3,
  "config": { "salario": 1000, "movil": 30, "movilDia": 6, "abuelos": 50, "abuelosDia": 30,
              "cruceroFaltante": 400, "cruceroMeses": 4,
              "gastoPersonal": 150, "metaAhorroPct": 0.2, "ahorroDesde": "2026-09" },
  "meses":  [ { "id": "2026-09", "movil": "Pendiente", "abuelos": "Pendiente",
                "personal": "Pendiente", "ahorroReal": null } ],
  "extras": [ { "id": "…", "mes": "2026-09", "concepto": "Regalo", "monto": 20,
                "estado": "Pagado", "creado": "…" } ],
  "abonos": [ { "id": "…", "fecha": "2026-09-20", "monto": 100, "nota": "", "mes": "2026-09" } ],
  "meta":   { "creado": "…", "modificado": "…", "ultimoRespaldo": null }
}
```

Para cambiar la forma de los datos: sube `VERSION_DATOS` en `js/version.js` y agrega el paso de migración en `js/store.js → migrar()`. Los datos guardados y los respaldos antiguos se actualizan solos al abrirse.

### Desarrollo

No hay nada que instalar: sirve la carpeta con cualquier servidor estático y abre `index.html` desde ahí (los service workers y los módulos ES no funcionan abriendo el archivo directamente). El service worker guarda copias, así que al probar cambios conviene borrarlo desde las herramientas del navegador.

Las pruebas viven fuera de este repositorio. Comparan las fórmulas de `calc.js` contra los valores de la hoja de cálculo original, y cubren la migración de datos y la validación de respaldos.

### Publicar una nueva versión

1. Haz los cambios y sube `VERSION_APP` en `js/version.js`.
2. **Sube el número de `CACHE` en `sw.js`** (`gastos-v3` → `gastos-v4`…). Así el teléfono baja todos los archivos juntos, los instala completos y recarga la app sola.
3. `git add -A`, `git commit` y `git push`. GitHub Pages tarda 1–2 minutos.
4. La app instalada se actualiza al abrirla con internet, sin tocar los datos guardados.

Se publica desde la rama `main`, carpeta raíz. El archivo `.nojekyll` evita que GitHub procese el sitio como Jekyll.

## Compatibilidad y límites

- Pensada para **iPhone con iOS 15.4 o superior**; la instalación en la pantalla de inicio se hace desde Safari.
- Probada en un navegador de escritorio con el tamaño de un iPhone 15, en claro y oscuro y sin conexión. Todavía sin confirmar en un iPhone real: la instalación desde Safari, el teclado sobre las hojas de captura y el botón de respaldo hacia la app Archivos.
- El salario, el plan móvil y los abuelos son un solo valor para todos los meses: cambiarlos modifica también los meses pasados.
- El gasto personal es un estimado; «Pagado» solo significa que ya lo gastaste este mes.
- La pestaña Mes en modo **Total** incluye los meses anteriores al plan de ahorro, que no llevan crucero ni gasto personal.
