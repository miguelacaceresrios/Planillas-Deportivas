/* Genera dist/planillas.html: toda la aplicación en un solo archivo.
 *
 * El desarrollo sigue siendo modular —siete módulos y tres hojas de estilo—;
 * esto existe sólo para repartirla: un archivo que se manda por correo y se
 * abre con doble clic, sin instalar nada y sin conexión.
 *
 *   node tools/build.js      (o: npm run build)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');
const OUT = path.join(ROOT, 'dist');

const read = (rel) => fs.readFileSync(path.join(APP, rel), 'utf8');

let html = read('index.html');

// Hojas de estilo -> <style>
html = html.replace(/[ \t]*<link rel="stylesheet" href="([^"]+)">\r?\n/g,
    (_, href) => '    <style>\n' + read(href).trimEnd() + '\n    </style>\n');

// Scripts -> <script>. Un "</script>" dentro del código cerraría la etiqueta
// antes de tiempo, así que se neutraliza.
html = html.replace(/[ \t]*<script src="([^"]+)"><\/script>\r?\n/g,
    (_, src) => '    <script>\n' + read(src).replace(/<\/script/gi, '<\/script').trimEnd() + '\n    </script>\n');

// Icono -> data URI, para que el archivo suelto no pierda nada.
html = html.replace(/href="favicon\.svg"/,
    () => 'href="data:image/svg+xml;base64,' + fs.readFileSync(path.join(APP, 'favicon.svg')).toString('base64') + '"');

html = html.replace('<body>',
    '<body>\n    <!-- Archivo único generado con "npm run build". Código fuente modular en app/. -->');

// Si queda alguna referencia a un archivo externo, esto no es autocontenido.
const leftover = html.match(/(?:src|href)="(?!data:|https?:|#)[^"]+"/g);
if (leftover) {
    console.error('ERROR: quedan referencias externas -> ' + leftover.join(', '));
    process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'planillas.html'), html);

console.log('dist/planillas.html  ' + (Buffer.byteLength(html) / 1024).toFixed(0) +
    ' KB  ·  un solo archivo, sin dependencias, funciona sin conexión');
