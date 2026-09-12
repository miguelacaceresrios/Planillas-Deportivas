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


