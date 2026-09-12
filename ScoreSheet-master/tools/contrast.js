/* Auditoría de contraste (WCAG 2.1) sobre los tokens reales de css/base.css.
 *
 * Elegir colores "a ojo" en un tema oscuro es como se acaba con etiquetas que
 * no se leen. Esto lo mide: lee los tokens del CSS, calcula la relación de
 * contraste de cada pareja que se usa de verdad y falla si alguna baja del
 * mínimo. Se puede ejecutar en CI.
 *
 *   node tools/contrast.js      (o: npm run contrast)
 */

const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'css', 'base.css'), 'utf8');

// --- tokens declarados en :root ---
const tokens = {};
for (const m of css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) tokens['--' + m[1]] = m[2];

function rgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Mezcla un color con alfa sobre un fondo opaco. */
function over(fg, alpha, bg) {
    const a = rgb(fg), b = rgb(bg);
    return '#' + a.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha))
        .toString(16).padStart(2, '0')).join('');
}

function luminance(hex) {
    const [r, g, b] = rgb(hex).map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a, b) {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
}

const T = (name) => tokens[name] || name;

// Parejas que existen de verdad en la interfaz. min: 4.5 texto normal,
// 3.0 texto grande y elementos de interfaz (bordes, iconos).
const PAIRS = [
    ['Texto del editor',        T('--text'),       T('--panel'),  4.5],
    ['Texto sobre el fondo',    T('--text'),       T('--bg'),     4.5],
    ['Etiquetas y pistas',      T('--muted'),      T('--panel'),  4.5],
    ['Etiquetas sobre fondo',   T('--muted'),      T('--bg'),     4.5],
    ['Cabeceras de bloque',     T('--accent'),     T('--panel'),  4.5],
    ['Aviso (revisión)',        T('--warn'),       T('--panel'),  4.5],
    ['Error (revisión)',        T('--danger'),     T('--panel'),  4.5],
    ['Marcador de posición',    '#748695',         T('--field'),  4.5],
    ['Botón primario',          T('--accent-ink'), T('--accent'), 4.5],
    ['Pestaña inactiva',        T('--muted'),      over('#ffffff', 0.03, T('--bg')), 4.5],
    ['Borde de campo',          T('--control-line'), T('--field'),  3.0],
    ['Borde de campo/panel',    T('--control-line'), T('--panel'),  3.0],
    ['Borde de pestaña',        T('--control-line'), T('--bg'),     3.0],
    ['Hover de campo',          '#7d93a3',         T('--field'),  3.0],
    ['Divisor estructural',     T('--line-soft'),  T('--panel'),  1.0],
    ['Hoja: texto',             '#101418',         '#ffffff',     4.5],
    ['Hoja: organización',      '#4a5560',         '#ffffff',     4.5],
    ['Hoja: subtítulo',         '#333c45',         '#ffffff',     4.5],
    ['Hoja: etiqueta marcador', '#5a646e',         '#ffffff',     4.5],
    ['Hoja: cabecera de tabla', '#101418',         '#e9edf1',     4.5],
];

let failed = 0;
console.log('Contraste (WCAG 2.1 AA)\n');

for (const [label, fg, bg, min] of PAIRS) {
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) failed++;
    console.log('  ' + (ok ? 'ok   ' : 'BAJO ') + label.padEnd(24) +
        r.toFixed(2).padStart(6) + ':1   (mínimo ' + min.toFixed(1) + ')   ' + fg + ' sobre ' + bg);
}

console.log('\n' + (failed ? failed + ' pareja(s) por debajo del mínimo' : 'Todas las parejas cumplen AA'));
process.exit(failed ? 1 : 0);
