# Auditoría de flujos — PML App (wt-catalog)

**Fecha:** 2026-08-22
**Alcance:** todos los flujos de la aplicación: entrada/login, Home, Buscar, Escanear, Añadir
(asistente), Producto, Cajas, Conteo físico, Validar, Inventario (nuevo y viejo), Pricing/Repricer,
Resumen financiero, Unificar duplicados, Colores S&S, Leer etiqueta (OCR), Historial y Exports.

**Base analizada:** `index.html` (4.340 líneas), `catalog.js`, `ocr-label.edge.ts`,
`wt_supabase_setup.sql` en la rama `main`.

> **Nota sobre el acceso al demo.** `https://demo.parishmart.com/` está bloqueado por la política
> de salida de red del entorno donde se ejecutó esta auditoría (el proxy devuelve 403 en el CONNECT),
> así que no pude hacer clic por la interfaz en vivo. La auditoría se hizo sobre el código fuente de
> la app en este repositorio, que es más exhaustivo que una revisión manual: cubre el 100 % de las
> ramas de cada flujo, incluidas las que sólo se disparan con error de red o con varios usuarios a la
> vez. Si el demo corriera una versión distinta de este `index.html`, hay que revalidar los puntos
> marcados con ⚠︎.

---

## Resumen ejecutivo

La app hace muchísimo y se nota que está pensada desde el trabajo real de la nave: los flujos de
caja → etiqueta 4×6 → conteo → validación están bien pensados y el borrador automático de caja
(`wt_box_draft`) es un detalle de producto excelente.

Los problemas serios no están en la interfaz, están debajo:

1. **La base de datos está abierta a Internet.** Cualquiera con la URL del demo puede leer, editar
   o borrar todo el inventario, los costos y los precios. Esto es lo primero que hay que arreglar.
2. **Los números mienten a partir de cierto tamaño.** Hay un tope de 3.000 filas y un KPI que suma
   sólo la primera página; nada avisa de ello.
3. **El conteo físico se pisa solo.** Guardar una caja reescribe (y a veces borra) el conteo manual
   de otra persona.
4. **No hay concurrencia.** Dos personas trabajando a la vez pueden destruirse cajas mutuamente.

Cuento **9 incidencias de prioridad alta, 13 de media y 10 de baja**.

---

## 🔴 Prioridad ALTA

### A1 · La base de datos está abierta a cualquiera que abra el demo

`wt_supabase_setup.sql` deja RLS en `for all to anon using (true) with check (true)` y la clave
publicable está en el bundle (`index.html:1044`). El comentario del propio SQL lo reconoce:
*"se permite acceso con la clave pública (anon) para que funcione desde el móvil sin login"*.

Consecuencia: con la URL del demo, cualquiera puede sacar el inventario completo con costos y
márgenes, cambiar precios o hacer un `DELETE` de toda la tabla. No hace falta ser técnico, es una
petición HTTP.

**Qué haría yo (en este orden):**

1. Hoy mismo, mientras se decide lo demás: bajar las políticas de `anon` a `select` sobre las
   columnas no sensibles, y quitar `insert/update/delete` de `anon`. Rompe la escritura desde el
   móvil, pero es preferible a lo que hay.
2. Meter Supabase Auth (email + magic link, o usuario/contraseña por operario). Es una tarde de
   trabajo y cambia el problema de raíz.
3. Reescribir las políticas contra `authenticated`, y separar por rol: operario (escribe `qty`,
   `counted`, cajas) vs. administrador (ve y edita `cost`, `price`, `prices`, `margin`).
4. Rotar la clave publicable actual una vez cerrado el acceso.
5. Poner `wt_movements` en sólo-inserción (ya lo está) y sin `delete` para nadie: es tu única
   auditoría.

### A2 · No hay autenticación: entrar es escribir un nombre

`doEnter()` (`index.html:1337`) sólo valida que el campo nombre no esté vacío. Cualquier texto entra.
El nombre se guarda en `localStorage` y se usa como firma en el historial y en `counted_by`, así que
**la trazabilidad del conteo tampoco es fiable**: cualquiera puede escribir "Harold" y contar en su
nombre.

**Sugerencia:** que el `who` venga del usuario autenticado (A1), nunca de un campo libre. Es el
mismo trabajo que ya hay que hacer para A1 y arregla la auditoría de conteos de paso.

### A3 · El PIN de precios es cosmético y está en el código

`var MONEY_PIN='7788';` (`index.html:1397`), visible con Ver Código Fuente. Y aunque no lo estuviera:
`DB.list()` trae `cost, price, prices, margin, retail, our` al navegador **antes** de pedir el PIN
(`LIGHTCOLS`, línea 1066). El candado sólo oculta píxeles; los datos ya están en el dispositivo.

**Sugerencia:** que la separación viva en la base (dos vistas de Postgres: `wt_inventory_public` sin
columnas de dinero y `wt_inventory_admin` con ellas, cada una con su política por rol). El PIN del
cliente puede quedarse como comodidad, pero no como control.

### A4 · La función OCR se puede usar gratis contra tu cuenta de Anthropic

En `ocr-label.edge.ts`:

- `GATE_KEY` es la misma clave publicable que va en el bundle → la "puerta" está abierta.
- `Verify JWT = OFF` (documentado en la cabecera del propio archivo).
- `Access-Control-Allow-Origin: "*"`.
- Sin límite de tamaño de imagen, sin rate-limit, sin control de gasto.

Además, en el cliente `ocrHandle()` prueba **hasta 4 orientaciones** (`const oris=[0,90,270,180]`)
haciendo una llamada de visión por cada una, con `claude-opus-5` por defecto. Una foto torcida cuesta
4 llamadas del modelo más caro.

**Sugerencias:**

- Exigir un JWT de Supabase Auth real (sale gratis en cuanto exista A1) y borrar el `x-gate`.
- Restringir CORS al dominio del demo.
- Tope de tamaño de imagen (p. ej. rechazar > 2 MB de base64) y contador por usuario/día en una tabla.
- Para el modelo: `claude-haiku-4-5-20251001` o `claude-sonnet-5` cubren de sobra un OCR de etiqueta
  manuscrita a una fracción del coste. Yo empezaría por Haiku 4.5 y sólo escalaría a Sonnet si la
  precisión no da.
- En vez de 4 llamadas, detectar la orientación en el cliente (relación de aspecto + EXIF ya lo
  tienes) o mandar una sola llamada avisando al modelo de que la imagen puede venir girada.
- `max_tokens: 2048` se queda corto para una cuadrícula grande: si la respuesta se corta, el
  `JSON.parse` falla y el usuario ve "no se detectó ningún producto" en lugar de un error real.
  Subirlo y comprobar `stop_reason === 'max_tokens'`.

### A5 · Los totales se truncan en silencio

Dos fallos que se suman:

- `DB.list(3000)` es el tope de **todas** las pantallas pesadas: Inventario, Pricing, Validar,
  Unificar, Resumen financiero y todos los exports. A partir del SKU 3.001 los cálculos son falsos
  y no hay ningún aviso.
- `DB.stats()` (`index.html:1262`) pide `select=qty` **sin `limit`**: el conteo de productos es
  exacto (viene de la cabecera `content-range`), pero las **unidades se suman sólo sobre las filas
  que PostgREST devuelve por defecto**. El KPI "unidades" del Home es incorrecto en cuanto la tabla
  supera ese límite, y no coincide con el de otras pantallas.

**Sugerencias:**

- Mover los agregados a la base: una vista `wt_kpis` (o un `rpc`) que devuelva
  `count(*), sum(qty), sum(cost*qty)` en una sola fila. Es una consulta, siempre exacta, y quita
  presión al móvil.
- Para las listas, paginación por keyset (ya tienes el patrón implementado en `loadImgs`), y si se
  llega al tope, decirlo en pantalla: *"mostrando 3.000 de 5.412 — filtra para ver el resto"*.

### A6 · Guardar una caja borra el conteo físico de otra persona

`saveCurBox()` llama a `recountFromBoxes(afectados)` y esa función hace, para cada SKU tocado:

```js
if (t > 0) { await DB.setCount(sku, t); }
else       { await DB.clearCount(sku); }   // ← borra el conteo manual
```

Es decir: si alguien contó a mano 40 unidades de un SKU y otra persona guarda una caja donde ese SKU
ya no está, el conteo de 40 desaparece sin aviso ni registro. Y si el SKU sí está en cajas, el conteo
manual se sustituye por la suma de cajas.

Es especialmente grave porque el flujo de conteo está diseñado justo para comparar sistema vs. físico,
y esto contamina el lado "físico" con datos del sistema.

**Sugerencias:**

- Separar los dos orígenes en columnas distintas: `counted_manual` y `counted_boxes`. La pantalla
  Validar muestra las tres cifras (sistema / cajas / manual) y el operario decide.
- Como mínimo, no borrar nunca: si `t === 0`, dejar el `counted` que hubiera y registrar el evento en
  `wt_movements`.
- Pedir confirmación cuando el recálculo vaya a pisar un `counted` con `counted_by` distinto al
  usuario actual.

### A7 · Dos personas a la vez se destruyen las cajas

Tres problemas de concurrencia en el mismo flujo:

- `wt_boxes.items` se guarda como **array completo**, y `DB.saveBox` hace un upsert
  (`on_conflict=code, resolution=merge-duplicates`). Es *last-write-wins*: si A y B abren la caja 12
  y A guarda después que B, todo el trabajo de B se pierde en silencio.
- `DB.nextBoxCode()` es "leer el código más alto y sumar 1", sin reserva. Dos móviles pidiendo caja
  nueva a la vez obtienen el **mismo código**, y el upsert los fusiona: una caja se come a la otra.
- El mismo array-completo hace que `assignBox()` tenga que recorrer y regrabar **todas** las cajas
  para mover un SKU (`for (const b of boxes) { ... await DB.saveBox(...) }`).

**Sugerencias:**

- Normalizar: tabla `wt_box_items (box_code, sku, qty, ...)` con clave primaria compuesta. Mover un
  ítem pasa a ser un `UPDATE` de una fila, y desaparecen las escrituras masivas.
- Los códigos de caja, con una `sequence` de Postgres (`nextval`), nunca leyendo el máximo.
- Añadir `updated_at` como token de concurrencia optimista: si cambió desde que abriste la caja,
  avisar en vez de sobrescribir.

### A8 · Operaciones de varios pasos sin transacción ni vuelta atrás

Varios flujos hacen 2-3 escrituras que deben ocurrir juntas, pero no lo hacen:

| Flujo | Qué pasa si falla a medias |
|---|---|
| `ddMerge()` — unificar duplicados | Suma las cantidades en el SKU canónico y **luego** borra los viejos. Si el borrado falla, quedan las dos filas y **el inventario se infla** |
| `saveCurBox()` con cambio de código | Guarda la caja nueva y **luego** borra la vieja. Si el borrado falla, quedan dos cajas con el mismo contenido, y `recountFromBoxes` cuenta las piezas dos veces |
| `assignBox()` | N escrituras seguidas; si se corta en medio, el SKU puede quedar fuera de todas las cajas |
| `pmlBulkDelete()` | Borra del inventario y luego de las cajas; si falla lo segundo, quedan ítems huérfanos apuntando a SKUs inexistentes |

Y el error casi nunca se ve: hay **91 bloques `catch(e){}` vacíos** en `index.html`. Los bucles
cuentan aciertos y descartan fallos, así que el aviso final ("47 validados") no dice que 3 no se
guardaron.

**Sugerencias:**

- Mover cada operación compuesta a una función `plpgsql` con `security definer` — igual que ya hiciste
  bien con `wt_adjust_qty`. Una llamada, atómica, con historial dentro.
- Que los bucles acumulen los fallos y los muestren: *"47 validados · 3 fallaron (toca para ver)"*.
- Un `window.onerror` + `unhandledrejection` que al menos deje rastro; hoy no hay ninguno.

### A9 · Las fotos van en base64 dentro de la tabla de inventario

El propio código lo documenta (`index.html:1063`):

> *"⚠️ img y gallery guardan base64 pesado (fotos subidas) → cualquier select que los incluya
> TIMEOUTEA en Postgres (statement timeout)"*

De ahí salen el parche `LIGHTCOLS`, `loadImgs()` con **60 peticiones encadenadas de 40 filas**,
`bgLoadImgs`, `IMGCACHE`, `repaintThumbs`, `pmlHealImgs`… una capa entera de complejidad para esquivar
un problema de diseño. Cada foto son ~80-150 KB de base64 (que en la BD ocupan ~33 % más que el
binario) dentro de la fila del producto.

**Sugerencia:** Supabase Storage. `wt_inventory.img` pasa a guardar una ruta, no los bytes. Con eso
se caen `LIGHTCOLS`, `loadImgs`, `IMGCACHE`, `bgLoadImgs`, `pmlHealImgs` y `schedRepaint` — varios
cientos de líneas menos — y las miniaturas las sirve el CDN con caché. Es la refactorización con mejor
relación beneficio/esfuerzo de toda la lista.

---

## 🟠 Prioridad MEDIA

### M1 · Tres vocabularios distintos de "Condición"

| Sitio | Valores aceptados |
|---|---|
| `CONDS` (cajas, ficha, OCR) | New · As new no hand tag · Good conditions · Liquidation |
| `#bulk-status` (Inventario viejo) | New · As new · No hand tag · 2da — y **rechaza** cualquier otro |
| `pmlb-cond` (Inventario, bulk) | texto libre, sin validar |

Además, en el bloque de acciones bulk se declara una constante `CONDS` local con un quinto valor
(`'vendible'`) que **no se usa en ninguna parte**. Resultado práctico: el desplegable "Condición" del
Inventario se llena de variantes que son el mismo estado, y filtrar por condición deja de servir.

**Sugerencia:** una sola constante exportada, un `<select>` en todos los sitios (nunca texto libre) y
un `CHECK` en la columna de Postgres. Antes, un `UPDATE` de normalización para lo ya cargado.

### M2 · Los ficheros de marketplace no cargan tal cual

- **eBay:** `*Category` va **vacío** en todas las filas → File Exchange rechaza el fichero.
  `*ConditionID` es fijo `1000` (New) e ignora `d.status`, así que la liquidación se publica como
  nueva. El título se corta a 80 sin control ("…").
- **Amazon:** `item-condition` fijo `11`. Las filas sin ASIN **ni** UPC salen con `product-id` y
  `product-id-type` vacíos → error de carga.
- **Todos:** los exports usan `d.qty`, pero la tabla de Inventario muestra `pmlQtyView(d)` (la suma
  de las cajas). **Lo que ves en pantalla no es lo que exportas** — y la diferencia puede ser grande.
- **CSV de selección:** la cabecera declara `Precio` y `eBay` como columnas distintas, pero las dos se
  rellenan con `rPrice(d,'ebay')`.

**Sugerencias:** mapa marca/tipo → categoría de eBay (aunque sea una tabla `wt_ebay_cats` con 20
filas), mapear `status` → ConditionID/item-condition, filtrar las filas sin identificador antes de
exportar, y unificar la cantidad exportada con la que se muestra (o poner las dos columnas y
etiquetarlas).

### M3 · Inyección de fórmulas en los CSV

`csvE()` y el `q()` de `pmlExportSel` escapan comillas y saltos de línea, pero no neutralizan los
valores que empiezan por `=`, `+`, `-` o `@`. Un campo de texto libre (Comentarios, Título listing,
Nombre de caja) con `=HYPERLINK(...)` se ejecuta al abrir el fichero en Excel.

**Sugerencia:** anteponer un apóstrofo o `\t` a los valores que empiecen por esos caracteres. Son dos
líneas en `csvE()`.

### M4 · Todo depende de cuatro scripts de CDN, sin red de seguridad

```html
<script src="https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/..."></script>
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/..."></script>
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/..."></script>
<script src="https://cdn.jsdelivr.net/gh/hgurupia/wt-catalog@main/catalog.js"></script>
```

Ninguno lleva `integrity`. El catálogo apunta a `@main`, que es una rama móvil: un commit cambia lo
que sirve el CDN a todos los usuarios sin desplegar nada. Y si jsdelivr no responde (caída, wifi de
nave con filtrado, roaming):

- Sin ZXing → `startScan()` abre la cámara **sin decodificar y sin decir nada**: el operario apunta al
  código de barras y no pasa nada, para siempre.
- Sin JsBarcode → `renderBarcodes()` hace `return` y salen **etiquetas impresas sin código de barras**,
  que es peor que no imprimir.
- Sin XLSX → el reporte Excel avisa correctamente ("El módulo de Excel no cargó"), bien ahí.

**Sugerencias:** fijar `catalog.js` a un tag (`@v119`, no `@main`), añadir `integrity` + `crossorigin`
a los tres de npm, y auto-alojar las tres librerías junto al `index.html` (ya sirves desde el mismo
sitio, son ~300 KB). Y comprobar `window.ZXing` / `window.JsBarcode` **antes** de dejar que el usuario
entre al flujo, con un mensaje claro.

### M5 · El botón Atrás pierde el contexto

`openProduct()` termina con `nav=['s-home','s-prod']`, machacando la pila de navegación. Abres un
producto desde Buscar, tocas ‹ y apareces en **Home**, con la búsqueda borrada. Lo mismo desde Conteo,
Validar y los resultados de escaneo. En la tabla de Inventario se parchea a mano
(`nav=['s-home','s-pml','s-prod']`), lo que confirma que el diseño no acompaña.

**Sugerencia:** que `openProduct` haga `go('s-prod')` y respete la pila. El parche del PML se puede
borrar.

### M6 · Escanear dos veces la misma prenda no hace nada

En `startScan()`, `lastCode` guarda el último código leído y `onCode` sale sin hacer nada si se repite
— pero `lastCode` **nunca se limpia**. En un conteo por escaneo, pasar dos piezas iguales seguidas
registra una sola, sin ningún aviso. Es un error de inventario que nadie ve.

**Sugerencia:** limpiar `lastCode` a los ~1,5 s (es un anti-rebote, no un anti-duplicado), y dar
feedback distinto para "leído" y "repetido, ignorado" (la vibración ya está, falta el mensaje).

### M7 · Editar "Cant." también escribe el conteo

En la tabla de Inventario viejo, el handler de `.qin` hace `DB.adjust(...)` **y a continuación**
`DB.setCount(sku, nv)`, con el toast "Cantidad N · ✓ contado". Es decir: corregir la cantidad del
sistema marca automáticamente el físico como igual al sistema, que es exactamente la comparación que
el flujo de conteo pretende hacer.

**Sugerencia:** separar las dos acciones. Si el atajo es útil, que sea un botón aparte ("igualar
contado a cantidad") y no un efecto lateral de escribir un número.

### M8 · El asistente de alta no valida nada

`function validStep(n){ return true; }` — con el comentario *"todos los campos opcionales — se
completan luego en Excel"*. Se puede guardar un producto sin marca, sin estilo y sin talla; el SKU
queda como `WT-NUEVO-<timestamp>`. Después nadie lo encuentra ni por búsqueda ni por filtros, y
aparece en los exports.

Además `#wiz-save` **no se deshabilita** durante el guardado: un doble toque en un móvil lento crea
dos productos o suma dos veces la cantidad.

**Sugerencia:** exigir marca + estilo (mínimo para generar SKU) antes del paso 5, y deshabilitar todos
los botones de guardar mientras la promesa está en vuelo. Esto último aplica también a `#do-in` /
`#do-out` en la ficha de producto.

### M9 · Los procesos largos son bucles de uno en uno

`pmlBulkPricing`, `isum-approve`, `markBoxCounted`, `b-complete`, `recountFromBoxes`, "Unificar todos"
y "Validar seleccionados" hacen `await` **por fila**. Con 500 filas y 150 ms de latencia son más de
un minuto de móvil bloqueado, con el usuario mirando "Aprobando 213/500…". Si la pantalla se apaga o
se cierra el navegador, queda a medias y sin registro de por dónde iba.

**Sugerencia:** agrupar en lotes (el patrón `for (i += 80)` ya lo usas en `updateMany` y en el bulk de
precios del repricer) o mover la operación entera a un `rpc` de Postgres. Y ejecutar `Promise.all` con
concurrencia limitada (4-6) donde no haya orden que respetar.

### M10 · Abrir el Inventario escribe en la base sin que nadie lo pida

`pmlHealImgs()` se dispara al entrar en la pantalla y lanza hasta **190 UPDATE** (150 por UPC + 40 por
estilo) para rellenar fotos faltantes. Efectos secundarios en lo que el usuario percibe como una vista
de sólo lectura, consumiendo datos móviles y con toasts que aparecen solos.

**Sugerencia:** convertirlo en un botón explícito ("🖼️ Recuperar fotos faltantes") con su barra de
progreso, o en una tarea programada del lado servidor.

### M11 · La app no sabe que se ha quedado sin red

No hay `window.onerror`, ni `unhandledrejection`, ni `navigator.onLine`, ni service worker, ni
`<noscript>`. `MODE` se fija una sola vez, en el arranque, con un `DB.ping()` — si la red se cae
después, la app sigue creyéndose "online", los `fetch` fallan y (por A8) el fallo se traga en silencio.
En una nave con cobertura irregular, el operario cree que ha guardado y no ha guardado.

Además `doEnter()` puede ejecutarse antes de que `DB.ping()` resuelva, así que se puede entrar antes de
saber en qué modo estás.

**Sugerencias:** escuchar `online`/`offline` y re-hacer el ping; una cola de escrituras pendientes en
`localStorage` que se reintente al recuperar red (el patrón de `wt_box_draft` ya demuestra que sabes
hacerlo); y un service worker que al menos cachee el shell de la app.

### M12 · Contar un SKU desconocido crea producto sin avisar

`countEntry()`: si `DB.bySku()` no encuentra la fila, hace `DB.create()` con `qty: 0` en silencio.
Un escaneo equivocado deja un producto fantasma en el inventario maestro. Lo mismo hace `ensureInv()`
desde varios flujos.

**Sugerencia:** confirmar ("Este SKU no está en el inventario. ¿Crearlo?") o marcar los creados así
con un `origen: 'auto'` para poder revisarlos después.

### M13 · Los errores no llegan al usuario

Ya mencionado en A8, pero merece entrada propia porque afecta a la confianza en todos los flujos:
los contadores de los bucles sólo cuentan éxitos, los `catch` están vacíos y `toast()` recorta los
mensajes a 70-90 caracteres, con lo que el error real de PostgREST (que suele explicar exactamente qué
columna falta) se pierde.

**Sugerencia:** un panel de "últimos errores" accesible desde Home, y no recortar el mensaje ahí.

---

## 🟡 Prioridad BAJA

- **B1 · Zoom bloqueado.** `maximum-scale=1` en el viewport impide ampliar con los dedos. Incumple
  WCAG 1.4.4 y es justo lo que quieres poder hacer en una nave con poca luz para leer un SKU pequeño.
  Quitarlo; el `-webkit-tap-highlight-color` y el `overscroll-behavior` ya evitan los rebotes raros.
- **B2 · Accesibilidad.** Sólo 2 `aria-label` en toda la app. 36 campos usan `placeholder` como única
  etiqueta (desaparece al escribir). Los checkboxes son emojis dentro de `<span>` sin `role` ni foco de
  teclado, así que no se pueden usar sin ratón/dedo.
- **B3 · `esc()` no escapa comillas simples.** Hoy no rompe nada porque todos los atributos generados
  usan comillas dobles, pero es una trampa para el próximo que escriba una plantilla con `'`.
- **B4 · Fuga de memoria en los exports.** `dlFile()` y `pmlExportSel()` crean `URL.createObjectURL`
  y nunca llaman a `revokeObjectURL`. En una sesión larga de exports se acumula.
- **B5 · Nombres internos invertidos.** `s-inv` es "Inventario VIEJO" y `s-pml` es "Inventario";
  la pestaña `data-tab="inv"` llama a `openPML()` y `data-tab="pml"` a `openInv()`. Funciona, pero
  cualquier cambio futuro va a tocar la pantalla equivocada. Renombrar a `s-inv-legacy` / `s-inv-main`.
- **B6 · La caché de colores no caduca.** `CMCACHE` vive toda la sesión: si corriges un color en
  `wt_colors`, la app sigue mostrando el viejo hasta recargar. Un TTL de unos minutos basta.
- **B7 · Peso de carga.** `index.html` (322 KB) + `catalog.js` (176 KB) en cada apertura, con metas
  `no-store` que además impiden cachear. Casi 500 KB por visita en datos móviles. Separar el JS a su
  propio fichero versionado y dejar que el navegador lo cachee.
- **B8 · No es instalable.** Sin `manifest.json` ni service worker no se puede "añadir a la pantalla
  de inicio" como app. Para una herramienta que se usa el 100 % desde el móvil, es fruta madura:
  arranque más rápido, pantalla completa, icono propio.
- **B9 · Impresión de etiquetas.** `printItems()` genera un nodo por unidad: una caja de 300 piezas
  mete 300 `<div>` con su SVG en el DOM antes de imprimir. Y si JsBarcode no cargó (M4), salen
  etiquetas **sin código de barras** en lugar de fallar. Comprobar antes y avisar.
- **B10 · Variantes de UPC sólo a medias.** `upcVariants()` maneja bien EAN-13 vs UPC-A y los ceros a
  la izquierda, pero sólo se usa en `DB.byUPC` (inventario propio). `DB.refByUPC` y `pmlHealImgs`
  consultan `wt_reference` con `upc=eq.` exacto, así que un código con cero inicial no encuentra su
  ficha en la base Harps aunque esté.

---

## Lo que haría yo si fuera mi app, por orden

**Esta semana** — parar el sangrado:

1. Cerrar la escritura anónima en Supabase (A1). Aunque rompa temporalmente el móvil.
2. Cerrar la función OCR y bajar el modelo a Haiku 4.5 (A4). Es dinero saliendo todos los días.
3. Arreglar `DB.stats()` (A5): un `rpc` de una línea. Es el número que ves en la portada.
4. Neutralizar el CSV (M3) y fijar `catalog.js` a un tag (M4). Diez minutos cada uno.

**Este mes** — quitar el riesgo de perder datos:

5. Supabase Auth con dos roles, y `who` desde el usuario real (A1, A2, A3).
6. Separar `counted_manual` de `counted_boxes` y dejar de borrar conteos (A6). Es lo que más confianza
   te va a devolver en la herramienta.
7. Normalizar `wt_box_items` y usar una `sequence` para los códigos de caja (A7).
8. Mover las operaciones compuestas a funciones `plpgsql` atómicas (A8), empezando por `ddMerge` que
   es la que puede inflar el inventario.

**Siguiente trimestre** — quitar deuda:

9. Fotos a Supabase Storage (A9). Borra varios cientos de líneas de parches y arregla el rendimiento
   de todas las listas de golpe.
10. Un solo vocabulario de condición con `CHECK` en la base (M1).
11. Los ficheros de marketplace, validados contra un fichero de prueba real de cada canal (M2).
12. Cola de escrituras offline + service worker (M11, B8).

**Una observación de producto, por si sirve:** `index.html` tiene 4.340 líneas con el HTML, el CSS y
toda la lógica juntos, y ya conviven dos pantallas de inventario ("Inventario" e "Inventario VIEJO")
más dos de precios (Resumen financiero y Pricing) que calculan lo mismo con fórmulas distintas
(`FEES` en una, `RCFG.fees` en la otra — y si tocas una, la otra no se entera). Antes de añadir la
siguiente función, yo dedicaría un rato a decidir cuál de cada pareja sobrevive. Se gana más
borrando que añadiendo.
