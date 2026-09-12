# Decisiones

Por qué el proyecto está hecho así. Cada entrada lleva el coste que se aceptó a
cambio: una decisión sin contrapartida normalmente es que no se pensó.

---

### 1. Sin build, sin dependencias, sin servidor

**Decisión.** Scripts clásicos cargados por orden, ni bundler ni `npm install`.
La aplicación se abre haciendo doble clic en `app/index.html`.

**Por qué.** El encargo es para un colegio: se usa en un patio o un gimnasio, con
wifi irregular, en ordenadores que no siempre dejan instalar nada, y el resultado
final es papel. Una herramienta que necesita `npm run dev` para arrancar no se usa.

**Coste.** No hay módulos ES (`type="module"` no funciona sobre `file://`), así que
los módulos se comunican por un espacio de nombres global `window.PL`. Es un precio
bajo por no depender de nada.

---

### 2. Un esquema declarativo por deporte

**Decisión.** `app/js/schema.js` describe cada deporte —campos, bloques, columnas—
y de ahí se derivan el formulario, la hoja imprimible y la forma del estado.

**Por qué.** La versión original repetía seis formularios a mano en el HTML y un
`switch` de 440 líneas donde cada deporte volvía a resolver el mismo problema.
Añadir un deporte era copiar y pegar todo y equivocarse en algún sitio.

**Coste.** Hay una capa de indirección: para entender cómo se pinta una tabla hay
que leer el esquema y el renderizador, no un bloque de HTML literal. A cambio,
añadir un deporte es añadir un objeto y no se toca nada más.

---

### 3. El estado no vive en el DOM

**Decisión.** Los datos están en `store.js`; la interfaz sólo los dibuja.

**Por qué.** Antes la fuente de verdad eran los propios `<input>`, así que cambiar
de deporte o regenerar la vista previa borraba lo escrito.

**Coste.** Hay que mantener sincronizados dos paneles. Se resuelve con `data-path`:
los campos equivalentes del formulario y de la hoja comparten ruta, y al escribir se
copia el valor al gemelo sin volver a dibujar, para no perder el foco ni el cursor.

---

### 4. Nada de `innerHTML`

**Decisión.** Todo se construye con `createElement` mediante el ayudante `h()`.

**Por qué.** La versión original montaba la vista previa concatenando cadenas con
los datos del formulario sin escapar: escribir `"><script>` en el nombre de un
competidor ejecutaba código. Con la API del DOM esa clase de fallo no existe.

**Coste.** Construir nodos es más verboso que una plantilla de texto.

---

### 5. El marcador de voleibol no suma puntos

**Decisión.** En voleibol el marcador cuenta **sets ganados** (`totalMode: 'wins'`);
en fútbol y baloncesto sí se suman los periodos. La columna *Total* de la tabla
sigue mostrando los puntos, que sirven para el golaveraje.

**Por qué.** 25-23 / 25-20 / 22-25 es un 2-1, no un 72-68. Un marcador que suma
puntos en voleibol es sencillamente incorrecto.

**Coste.** El bloque `periods` deja de ser uniforme y necesita un modo. Merece la
pena: la alternativa es que el dato esté mal.

---

### 6. Lo que falta por rellenar no se pinta de color

**Decisión.** Tres niveles de revisión: *error* (rojo, frena la impresión), *aviso*
(ámbar) y *pendiente* (gris, agrupado en una sola línea).

**Por qué.** Con un aviso por cada campo vacío, abrir la aplicación mostraba siete
líneas ámbar antes de escribir nada. Una planilla recién abierta está vacía, no está
mal. Si todo grita, nada destaca.

**Coste.** Hay que decidir a qué nivel pertenece cada comprobación, y esa decisión
es de criterio, no automática.

---

### 7. Los datos nunca salen del dispositivo

**Decisión.** Sin servidor, sin cuentas, sin red. Todo en `localStorage`, y lo que
se comparte lo exporta la persona a mano (JSON, CSV o papel).

**Por qué.** La aplicación recoge nombres y DNI de menores de edad. La forma más
sólida de no filtrar esos datos es no tener dónde enviarlos.

**Coste.** No hay sincronización entre dispositivos ni copia de seguridad
automática. Si algún día hiciera falta, la costura ya existe: el JSON de
exportación es el contrato de datos, y una sincronización iría encima sin
reescribir nada.

---

### 8. Todo lo que entra pasa por `hydrate()`

**Decisión.** Los datos del almacenamiento y los de un archivo importado se mezclan
campo a campo contra el esquema; nunca se usan tal cual.

**Por qué.** Dos problemas con una sola solución: un archivo manipulado no puede
meter campos extraños en el estado, y un cambio de esquema no rompe lo ya guardado
(hay migración de la versión anterior y una prueba que la cubre).

**Coste.** Importar es más lento y más código que un `JSON.parse` directo.

---

### 9. El archivo único es formato de reparto, no de desarrollo

**Decisión.** El código fuente es modular; `npm run build` genera
`dist/planillas.html` con todo dentro.

**Por qué.** Para mandarle la herramienta a otro profesor por correo, siete archivos
y tres carpetas son una barrera. Un archivo que se abre con doble clic, no.

**Coste.** Hay un paso de construcción... pero sólo para repartir. Desarrollar sigue
sin necesitarlo. El build falla si queda una referencia externa, así que el archivo
o es autocontenido o no se genera.

---

### 10. El contraste se mide, no se elige a ojo

**Decisión.** `npm run contrast` lee los tokens de `base.css` y comprueba veinte
parejas reales contra WCAG 2.1 AA. Falla si alguna baja del mínimo.

**Por qué.** Al escribirlo aparecieron dos fallos que a ojo no se veían: los
`placeholder` en 3.56:1 y, peor, el borde de los campos en 1.40:1 con un relleno a
1.02:1 del panel — es decir, cajas de texto sin borde perceptible. De ahí sale el
token `--control-line`: un divisor estructural puede ser un susurro, el borde de un
control no.

**Coste.** Un tono más de la paleta que mantener.

---

### 11. La plantilla CSV existe porque "Importar" no tenía de dónde importar

**Decisión.** Cada tabla se descarga en blanco como CSV —con dos filas de cabecera
que dicen a qué deporte y a qué tabla pertenece— y el botón Importar acepta tanto
el JSON de una planilla entera como esa plantilla rellenada.

**Por qué.** Importar sólo leía el JSON que exportaba la propia aplicación: para
importar algo había que haber exportado antes. Un usuario nuevo pulsaba el botón y
no tenía nada que darle. Un viaje de ida y vuelta sin ida. Descargar una planilla
JSON en blanco no lo arreglaba —para eso ya está "+ Nueva"—; hacía falta un formato
que se pueda rellenar **fuera** de la aplicación, o sea en Excel, y poder leerlo.

**Coste.** Un analizador de CSV propio y un formato más que mantener. Las dos filas
de cabecera son fáciles de romper si alguien las borra, así que el error lo dice
explícitamente en vez de fallar en silencio. Importar una plantilla vacía avisa en
lugar de vaciar la tabla.

---

### 12. Las flechas navegan en vez de incrementar

**Decisión.** En las tablas, Enter y las flechas arriba/abajo recorren la columna.
En los campos numéricos eso sustituye al incremento nativo.

**Por qué.** Quien usa esto mete 18 o 36 filas seguidas. Moverse por la tabla se
hace cien veces; subir un número de uno en uno, casi nunca.

**Coste.** Se pierde un comportamiento que algunas personas esperan. Es reversible
en una línea si resulta molestar.
