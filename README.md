# Planillas Deportivas

Aplicación web para rellenar, revisar e imprimir planillas deportivas oficiales.
HTML, CSS y JavaScript puro: sin dependencias, sin build, sin servidor.

## Uso

Abre `app/index.html` en el navegador. Nada más.

1. Elige el deporte en las pestañas superiores.
2. Rellena el formulario de la izquierda; la planilla de la derecha se actualiza al escribir.
3. También puedes escribir directamente sobre la planilla: los dos paneles están sincronizados.
4. **Imprimir** saca sólo la planilla, en A4 vertical.

## Qué hace

- **Varias planillas por deporte.** Tres series de 100 m en una jornada son tres
  planillas guardadas, no una pisando a la otra. Nueva, duplicar, renombrar, borrar.
- **Se guarda solo** en el navegador (`localStorage`): cerrar la pestaña no pierde nada.
- **Botón Ejemplo**: carga una planilla de muestra completa para ver de qué va sin
  tener que teclear nada. Los nombres, instituciones y DNI son inventados.
- **Captura rápida.** Pega desde Excel y el bloque de celdas se reparte por filas y
  columnas, creando las que falten. Enter y las flechas arriba/abajo recorren la
  columna como en una hoja de cálculo.
- **Cálculos automáticos.** La mejor marca es el mayor de los seis intentos y el puesto
  sale del ranking (los empates comparten puesto). En carrera el tiempo admite
  `12.34`, `1:02.5` o `1:02:03`. Las columnas calculadas salen bloqueadas.
- **Marcadores correctos por deporte.** En voleibol el marcador son *sets ganados*
  (25-23 / 25-20 / 22-25 es 2-1), no la suma de puntos; en fútbol y baloncesto sí se suma.
- **Revisión antes de imprimir**, en tres niveles. *Error*: dorsal repetido en un
  equipo —pide confirmación al imprimir—. *Aviso*: DNI que no tiene 8 dígitos, puntos
  por jugador que no cuadran con los cuartos. *Pendiente*: lo que aún no has rellenado,
  agrupado en una línea gris. Una planilla recién abierta está vacía, no está mal, así
  que no se pinta de color: si todo grita, nada destaca.
- **Cabecera institucional:** nombre y logo del colegio, configurados una vez.
- **Exportar e importar.** JSON para guardar y reabrir una planilla entera, CSV para
  Excel (con `;` y BOM, que es como Excel en español lo abre bien).
- **Plantilla CSV.** Cada tabla se puede descargar en blanco, rellenar en Excel y
  volver a cargarla con Importar. Sin esto, "Importar" sólo servía para archivos que
  la propia aplicación hubiera exportado antes.

## Compartir

Para mandársela a alguien, genera el **archivo único**:

```
npm run build
```

Eso deja en `dist/planillas.html` la aplicación entera —HTML, CSS, JavaScript e
icono— en un solo archivo que se abre con doble clic, sin instalar nada y sin
conexión. Es lo que se envía por correo o WhatsApp a otro profesor. El build falla
si queda cualquier referencia a un archivo externo, así que o es autocontenido o no
se genera.

Para compartir **una planilla** y no la aplicación: JSON (la otra persona la reabre
con Importar), CSV (para Excel) o Imprimir → Guardar como PDF.

## Arquitectura

La aplicación está dirigida por datos: un esquema declarativo describe cada deporte y
de ahí se derivan el formulario, la hoja imprimible y la forma del estado. No hay HTML
ni lógica específica por deporte.

Las decisiones de diseño, con el coste que se aceptó a cambio de cada una, están en
**[DECISIONS.md](DECISIONS.md)**.

```
.
├── app/              La aplicación: esto es lo que se abre y lo que se despliega.
├── test/smoke.js     Pruebas, sin dependencias.
├── tools/build.js    Genera el archivo único de dist/.
├── tools/contrast.js Auditoría de contraste de la paleta.
├── DECISIONS.md      Por qué está hecho así, y a cambio de qué.
└── package.json

app/
├── index.html        Armazón: cabecera, pestañas y los dos contenedores. Nada más.
├── favicon.svg       Icono de la pestaña.
├── css/
│   ├── base.css      Tokens de color, reset y tipografía.
│   ├── app.css       Cromo de la aplicación: cabecera, pestañas, editor.
│   └── sheet.css     La planilla en pantalla y las reglas de impresión.
└── js/
    ├── dom.js        Helper h() para construir nodos (nada de innerHTML).
    ├── schema.js     Definición de los deportes.  ← el único archivo por deporte
    ├── compute.js    Columnas calculadas, marcadores y revisión.
    ├── store.js      Estado, varias planillas y persistencia.
    ├── io.js         Exportar/importar JSON y CSV.
    ├── render.js     Esquema + estado → formulario y hoja.
    └── main.js       Arranque y los escuchadores delegados.
```

Flujo: `schema` describe → `store` guarda → `compute` deriva → `render` dibuja las dos
vistas → `main` conecta los eventos. Los campos equivalentes del formulario y de la hoja
comparten el atributo `data-path` (`meta.prueba`, `rosters.plantillaLocal.3.dorsal`), que
es lo que permite reflejar un cambio de un panel en el otro sin volver a dibujar:
escribir no pierde el foco ni mueve el cursor.

Todo lo que entra al estado —almacenamiento o archivo importado— pasa por `hydrate()`,
que lo adapta campo a campo al esquema. Un archivo manipulado no puede meter datos
extraños, y un esquema que cambia no rompe lo ya guardado.

## Añadir o cambiar un deporte

Se toca **sólo `js/schema.js`**. Un deporte son sus datos generales y una lista de
bloques:

| Bloque    | Para qué sirve                                              |
|-----------|-------------------------------------------------------------|
| `roster`  | Lista de filas: competidores o plantilla de un equipo.       |
| `periods` | Marcador por sets, cuartos o tiempos.                        |
| `notes`   | Texto libre (incidencias, observaciones).                    |

En las columnas de un `roster`: `size` (`xs`/`sm`/`md`/`lg`) fija el ancho,
`sheetOnly: true` marca las que sólo salen en la planilla impresa —lo que se anota a
mano durante la competencia— y `computed` la calcula sola:

```js
{ key: 'mejor',  label: 'Mejor marca', computed: { type: 'max',  from: ['i1', 'i2', 'i3'] } }
{ key: 'puesto', label: 'Puesto',      computed: { type: 'rank', by: 'mejor', order: 'desc' } }
```

En un `periods`, `totalMode: 'wins'` cuenta periodos ganados (voleibol) en vez de
sumarlos. Cualquier bloque admite `breakBefore: true` para empezar en página nueva.

## Pruebas

```
npm test        # 57 comprobaciones funcionales
npm run contrast   # auditoría de contraste WCAG 2.1 AA
```

`npm test` ejecuta la aplicación real contra un DOM mínimo, sin dependencias: renderiza
los seis deportes y comprueba cálculos, marcadores, sincronía entre paneles, pegado desde
Excel, varias planillas, importación/exportación, migración de datos antiguos y que nada
se interprete como HTML.

`npm run contrast` lee los tokens de color de `base.css` y mide veinte parejas reales
de la interfaz contra WCAG 2.1 AA. Falla si alguna baja del mínimo, así que el tema no
se puede degradar sin que salte.

## Deportes incluidos

Atletismo (salto, carrera, lanzamiento), voleibol, fútbol y baloncesto.
