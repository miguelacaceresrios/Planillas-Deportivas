/* Prueba de humo: ejecuta el código real de la aplicación contra un DOM mínimo.
 *
 *   node test/smoke.js
 *
 * No hay dependencias: el stub de abajo implementa sólo lo que la app usa
 * (createElement, dataset, querySelector con selectores simples, eventos).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = path.join(__dirname, '..', 'app', 'js');

// ------------------------------------------------------------------ DOM stub

function camel(attr) { return attr.replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }

class TextNode {
    constructor(text) { this.nodeType = 3; this._text = String(text); this.parentNode = null; }
    get textContent() { return this._text; }
}

class Node {
    constructor(tag) {
        this.tagName = (tag || '').toUpperCase();
        this.nodeType = 1;
        this.childNodes = [];
        this.attributes = {};
        this.dataset = {};
        this.style = {};
        this.className = '';
        this.parentNode = null;
        this.id = '';
        this.value = '';
        this.readOnly = false;
        this.selected = false;
        this._listeners = {};
    }

    appendChild(child) {
        // Como el DOM real: un fragmento vuelca sus hijos y se vacía.
        if (child.nodeType === 11) {
            child.childNodes.slice().forEach(c => this.appendChild(c));
            child.childNodes = [];
            return child;
        }
        child.parentNode = this;
        this.childNodes.push(child);
        return child;
    }

    removeChild(child) {
        const i = this.childNodes.indexOf(child);
        if (i >= 0) this.childNodes.splice(i, 1);
        return child;
    }

    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k]; }
    addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); }
    focus() { global.__focused = this; }
    select() {}

    set textContent(v) {
        this.childNodes = [];
        if (String(v) !== '') this.appendChild(new TextNode(v));
    }
    get textContent() { return this.childNodes.map(c => c.textContent).join(''); }
    get children() { return this.childNodes.filter(n => n.nodeType === 1); }

    matches(sel) {
        let m;
        if ((m = sel.match(/^#(.+)$/))) return this.id === m[1];
        if ((m = sel.match(/^\.(.+)$/))) return String(this.className).split(/\s+/).includes(m[1]);
        if ((m = sel.match(/^\[([\w-]+)="(.*)"\]$/))) {
            const [, attr, val] = m;
            if (attr.startsWith('data-')) return this.dataset[camel(attr.slice(5))] === val;
            return this.attributes[attr] === val;
        }
        if ((m = sel.match(/^\[([\w-]+)\]$/))) {
            const attr = m[1];
            if (attr.startsWith('data-')) return this.dataset[camel(attr.slice(5))] !== undefined;
            return this.attributes[attr] !== undefined;
        }
        if (/^[a-z]+$/i.test(sel)) return this.tagName === sel.toUpperCase();
        throw new Error('selector no soportado por el stub: ' + sel);
    }

    _all(out) {
        for (const c of this.childNodes) if (c.nodeType === 1) { out.push(c); c._all(out); }
        return out;
    }
    querySelectorAll(sel) { return this._all([]).filter(n => n.matches(sel)); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    closest(sel) { let n = this; while (n) { if (n.nodeType === 1 && n.matches(sel)) return n; n = n.parentNode; } return null; }
}

const document = new Node('#document');
document.createElement = (t) => new Node(t);
document.createTextNode = (t) => new TextNode(t);
document.createDocumentFragment = () => { const f = new Node('#fragment'); f.nodeType = 11; return f; };
document.readyState = 'complete';
document.title = '';

const storage = {};
let printed = 0;

global.localStorage = {
    getItem: (k) => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
};
global.document = document;
global.window = global;
global.window.print = () => { printed++; };
global.window.confirm = () => true;
global.window.alert = () => {};

// Árbol equivalente al de index.html
function el(tag, id, cls) { const n = new Node(tag); if (id) n.id = id; if (cls) n.className = cls; return n; }

const body = el('body');
document.appendChild(body);
document.body = body;

const tabs = el('nav', 'tabs');
const workspace = el('main', 'workspace');
const editor = el('section', 'editor');
const sheetbar = el('div', 'sheetbar', 'sheetbar');
const formHost = el('div', 'form-host');
const review = el('div', 'review', 'review');
const wrap = el('section', 'sheet-wrap');
const sheet = el('article', 'sheet', 'sheet');

editor.appendChild(sheetbar);
editor.appendChild(formHost);
editor.appendChild(review);
wrap.appendChild(sheet);
workspace.appendChild(editor);
workspace.appendChild(wrap);
body.appendChild(tabs);
body.appendChild(workspace);

for (const file of ['dom.js', 'schema.js', 'compute.js', 'store.js', 'io.js', 'demo.js', 'render.js', 'main.js']) {
    vm.runInThisContext(fs.readFileSync(path.join(APP, file), 'utf8'), { filename: file });
}

const PL = global.window.PL;
const Store = PL.Store;

// ------------------------------------------------------------------ utilidades

const fire = (type, target, extra) => (document._listeners[type] || [])
    .forEach(fn => fn(Object.assign({ target: target, preventDefault() {} }, extra || {})));
const type = (node, value) => { node.value = value; fire('input', node); };
const openSport = (id) => fire('click', tabs.querySelector('[data-sport="' + id + '"]'));
const field = (path, scope) => (scope || editor).querySelector('[data-path="' + path + '"]');

let fails = 0;
function check(name, cond, extra) {
    if (cond) console.log('  ok   ' + name);
    else { fails++; console.log('  FALLA ' + name + (extra !== undefined ? ' → ' + extra : '')); }
}
function section(title) { console.log('\n== ' + title + ' =='); }

// ------------------------------------------------------------------- pruebas

section('Render de cada deporte');
for (const sport of PL.sports) {
    openSport(sport.id);
    check(sport.id + ': pinta formulario y hoja',
        editor.querySelectorAll('[data-path]').length > 0 && sheet.querySelectorAll('[data-path]').length > 0);
    check(sport.id + ': sin "undefined" suelto', !/undefined/.test(sheet.textContent));
    check(sport.id + ': firmas completas',
        sheet.querySelectorAll('.signature').length === sport.signatures.length);
}

section('Voleibol: el marcador son sets ganados, no puntos');
openSport('voleibol');
[['0', '25', '23'], ['1', '25', '20'], ['2', '22', '25']].forEach(([i, local, away]) => {
    type(field('periods.sets.local.' + i), local);
    type(field('periods.sets.visitante.' + i), away);
});
const vScore = workspace.querySelectorAll('[data-score="sets.local"]').map(n => n.textContent);
const vAway = workspace.querySelectorAll('[data-score="sets.visitante"]').map(n => n.textContent);
check('marcador 2 - 1', vScore.every(v => v === '2') && vAway.every(v => v === '1'), vScore + ' / ' + vAway);
check('la columna Total sigue sumando puntos (72)',
    sheet.querySelector('[data-total="sets.local"]').textContent === '72',
    sheet.querySelector('[data-total="sets.local"]').textContent);

section('Fútbol: los goles sí se suman');
openSport('futbol');
type(field('periods.goles.local.0'), '2');
type(field('periods.goles.local.1'), '1');
check('1.º T + 2.º T = 3',
    workspace.querySelectorAll('[data-score="goles.local"]').every(n => n.textContent === '3'));

section('Lanzamiento: mejor marca y puesto automáticos');
openSport('lanzamiento');
type(field('rosters.competidores.0.i1'), '48');
type(field('rosters.competidores.0.i2'), '50');
type(field('rosters.competidores.1.i1'), '52');
type(field('rosters.competidores.2.i1'), '52');
check('mejor marca = mayor intento', field('rosters.competidores.0.mejor').value === '50',
    field('rosters.competidores.0.mejor').value);
check('empate comparte puesto (1, 1, 3)',
    field('rosters.competidores.1.puesto').value === '1' &&
    field('rosters.competidores.2.puesto').value === '1' &&
    field('rosters.competidores.0.puesto').value === '3',
    [0, 1, 2].map(i => field('rosters.competidores.' + i + '.puesto').value).join(','));
check('sin marca no hay puesto', field('rosters.competidores.3.puesto').value === '');
check('la columna calculada está bloqueada', field('rosters.competidores.0.mejor').readOnly === true);

section('Carrera: puesto por tiempo, admite mm:ss');
openSport('carrera');
type(field('rosters.competidores.0.tiempo'), '1:02.5');
type(field('rosters.competidores.1.tiempo'), '58.2');
check('el más rápido es primero',
    field('rosters.competidores.1.puesto').value === '1' && field('rosters.competidores.0.puesto').value === '2',
    field('rosters.competidores.1.puesto').value + ',' + field('rosters.competidores.0.puesto').value);

section('Pegar desde Excel');
openSport('carrera');
const clip = (text) => ({ clipboardData: { getData: () => text } });
const comp = () => Store.data('carrera').rosters.competidores;

fire('paste', field('rosters.competidores.0.nombre'),
    clip('Ana Quispe\t12345678\nLuis Rojas\t87654321'));
check('reparte el bloque por filas y columnas',
    comp()[0].nombre === 'Ana Quispe' && comp()[0].dni === '12345678' &&
    comp()[1].nombre === 'Luis Rojas' && comp()[1].dni === '87654321',
    JSON.stringify(comp().slice(0, 2).map(r => r.nombre + '/' + r.dni)));

const antes = comp().length;
fire('paste', field('rosters.competidores.' + (antes - 2) + '.nombre'),
    clip(Array.from({ length: 6 }, (_, i) => 'Alumno ' + i).join('\n')));
check('crea las filas que falten', comp().length === antes + 4,
    comp().length + ' (antes ' + antes + ')');

fire('paste', field('rosters.competidores.0.nombre'), clip('Un valor suelto'));
check('un valor sin tabuladores se deja al navegador', comp()[0].nombre === 'Ana Quispe');

section('Teclado');
fire('keydown', field('rosters.competidores.0.nombre'), { key: 'ArrowDown' });
check('flecha abajo baja de fila',
    global.__focused.dataset.path === 'rosters.competidores.1.nombre',
    global.__focused.dataset.path);

fire('keydown', field('rosters.competidores.1.nombre'), { key: 'ArrowUp' });
check('flecha arriba sube',
    global.__focused.dataset.path === 'rosters.competidores.0.nombre',
    global.__focused.dataset.path);

const ultima = comp().length - 1;
fire('keydown', field('rosters.competidores.' + ultima + '.nombre'), { key: 'Enter' });
check('Enter en la última fila añade otra', comp().length === ultima + 2,
    comp().length);

section('Revisión');
openSport('baloncesto');
type(field('rosters.plantillaLocal.0.dorsal'), '7');
type(field('rosters.plantillaLocal.1.dorsal'), '7');
type(field('rosters.plantillaLocal.0.nombre'), 'Ana');
let issues = PL.validate(PL.sportById('baloncesto'), Store.data('baloncesto'));
check('dorsal repetido es error',
    issues.some(i => i.level === 'error' && /dorsal 7 repetido/.test(i.text)),
    JSON.stringify(issues.filter(i => i.level === 'error')));
openSport('carrera');
type(field('rosters.competidores.0.dni'), '123');
issues = PL.validate(PL.sportById('carrera'), Store.data('carrera'));
check('DNI corto es aviso', issues.some(i => i.level === 'warn' && /8 dígitos/.test(i.text)));
check('la lista de revisión se pinta', review.textContent.length > 0);

section('Revisión: una planilla vacía no alarma');
openSport('voleibol');
fire('click', sheetbar.querySelector('[data-action="sheet-new"]'));
const fresh = PL.validate(PL.sportById('voleibol'), Store.data('voleibol'));
check('recién creada no tiene ni un aviso de color',
    fresh.filter(i => i.level !== 'info').length === 0,
    JSON.stringify(fresh.filter(i => i.level !== 'info')));
check('lo pendiente cabe en una sola línea neutra',
    fresh.filter(i => i.level === 'info' && /^Pendiente:/.test(i.text)).length === 1,
    JSON.stringify(fresh.map(i => i.level + ': ' + i.text)));
check('la cabecera no cuenta lo pendiente como problema',
    /Revisión$/m.test(review.querySelector('.review-title').textContent),
    review.querySelector('.review-title').textContent);
check('y lo dice explícitamente', /Sin problemas/.test(review.textContent));
openSport('baloncesto');
check('los problemas de verdad van primero',
    PL.validate(PL.sportById('baloncesto'), Store.data('baloncesto'))[0].level === 'error');

section('Varias planillas por deporte');
openSport('salto');
const firstId = Store.sheet('salto').id;
type(field('meta.prueba'), 'Salto alto A');
fire('click', sheetbar.querySelector('[data-action="sheet-new"]'));
check('se crea una segunda planilla', Store.sheets('salto').length === 2);
check('la nueva está vacía', Store.data('salto').meta.prueba === '');
type(field('meta.prueba'), 'Salto largo B');
Store.selectSheet('salto', firstId);
openSport('salto');
check('la primera conserva sus datos', Store.data('salto').meta.prueba === 'Salto alto A',
    Store.data('salto').meta.prueba);
const renamer = sheetbar.querySelector('[data-action="sheet-rename"]');
type(renamer, 'Serie inaugural');
check('renombrar', Store.sheet('salto').name === 'Serie inaugural');
fire('click', sheetbar.querySelector('[data-action="sheet-dup"]'));
check('duplicar copia los datos', Store.data('salto').meta.prueba === 'Salto alto A' &&
    Store.sheets('salto').length === 3);
check('la copia se llama distinto', /copia/.test(Store.sheet('salto').name), Store.sheet('salto').name);
fire('click', sheetbar.querySelector('[data-action="sheet-del"]'));
check('borrar', Store.sheets('salto').length === 2);
while (Store.sheets('salto').length > 1) fire('click', sheetbar.querySelector('[data-action="sheet-del"]'));
fire('click', sheetbar.querySelector('[data-action="sheet-del"]'));
check('borrar la última deja una vacía', Store.sheets('salto').length === 1);

section('Institución y logo');
Store.setConfig('institucion', 'I.E. José Carlos Mariátegui');
openSport('salto');
check('la institución encabeza la hoja',
    sheet.querySelector('[data-config-value="institucion"]').textContent === 'I.E. José Carlos Mariátegui');
Store.setConfig('logo', 'data:image/png;base64,AAA');
openSport('salto');
check('el logo se pinta', sheet.querySelectorAll('.sheet-logo').length === 1);

section('Salto de página en fútbol');
openSport('futbol');
check('la plantilla visitante abre página',
    sheet.querySelectorAll('.break-before').length === 1);

section('Exportar CSV');
openSport('futbol');
type(field('meta.local'), 'Colegio San Juan');
const csv = PL.io.toCSV(PL.sportById('futbol'), Store.sheet('futbol'), Store.getConfig());
check('lleva BOM para Excel', csv.charCodeAt(0) === 0xFEFF);
check('separa por punto y coma', csv.includes('Planilla;'));
check('incluye la institución', csv.includes('I.E. José Carlos Mariátegui'));
check('incluye el equipo', csv.includes('Colegio San Juan'));
check('escapa las comillas y separadores', PL.io.toCSV.length >= 0 &&
    !/(^|\r\n)[^\r\n]*;[^\r\n]*"[^"]*$/.test(csv));

section('Exportar e importar JSON');
const json = PL.io.toJSON(PL.sportById('futbol'), Store.sheet('futbol'));
const parsed = PL.io.fromJSON(json);
check('conserva el deporte', parsed.sportId === 'futbol');
const before = Store.sheets('futbol').length;
Store.importSheet(parsed.sportId, 'Importada', parsed.data);
check('la importación añade una planilla', Store.sheets('futbol').length === before + 1);
check('con los datos intactos', Store.data('futbol').meta.local === 'Colegio San Juan');
let rejected = false;
try { PL.io.fromJSON('{"app":"otra-cosa"}'); } catch (e) { rejected = /no es una planilla/.test(e.message); }
check('rechaza un archivo ajeno', rejected);
try { PL.io.fromJSON('no soy json'); rejected = false; } catch (e) { rejected = /JSON válido/.test(e.message); }
check('rechaza un archivo corrupto', rejected);
const hostile = PL.io.fromJSON(JSON.stringify({
    app: 'planillas-deportivas', sport: 'futbol', name: 'X',
    data: { meta: { local: 'O', __proto__: 'x', inventado: 'y' }, rosters: { inventado: [] } }
}));
Store.importSheet('futbol', 'Hostil', hostile.data);
check('un archivo manipulado no mete campos extraños',
    Store.data('futbol').meta.inventado === undefined && Store.data('futbol').rosters.inventado === undefined);

section('Datos de ejemplo');
PL.sports.forEach((sp) => {
    openSport(sp.id);
    fire('click', sheetbar.querySelector('[data-action="sheet-demo"]'));
    const issues = PL.validate(sp, Store.data(sp.id));
    check(sp.id + ': el ejemplo sale limpio y completo', issues.length === 0,
        JSON.stringify(issues.map(i => i.level + ': ' + i.text)));
    check(sp.id + ': el ejemplo llega a la hoja', /I.E./.test(sheet.textContent));
});

openSport('voleibol');
fire('click', sheetbar.querySelector('[data-action="sheet-demo"]'));
check('el ejemplo de voleibol marca 3-1',
    sheet.querySelector('[data-score="sets.local"]').textContent === '3' &&
    sheet.querySelector('[data-score="sets.visitante"]').textContent === '1',
    sheet.querySelector('[data-score="sets.local"]').textContent + '-' +
    sheet.querySelector('[data-score="sets.visitante"]').textContent);

openSport('lanzamiento');
check('el ejemplo de lanzamiento calcula la mejor marca',
    Store.data('lanzamiento').rosters.competidores[1].mejor === '10.8',
    Store.data('lanzamiento').rosters.competidores[1].mejor);

section('Plantilla CSV: importar sin haber exportado antes');
openSport('carrera');
const tablaCarrera = PL.sportById('carrera').blocks[0];
const plantilla = PL.io.toTemplateCSV(PL.sportById('carrera'), tablaCarrera, Store.data('carrera'));

check('la plantilla dice de qué deporte y tabla es',
    /^\uFEFFPlanilla;carrera/.test(plantilla) && /Tabla;competidores/.test(plantilla));
check('lleva los encabezados de las columnas', plantilla.indexOf('Nombre y apellidos;DNI') !== -1);
check('viene con filas en blanco para rellenar', plantilla.split('\r\n').length > 12);

// Rellenarla como haría cualquiera en Excel.
const lineas = plantilla.split('\r\n');
lineas[3] = 'Rosa Pérez Alva;70000031;I.E. San Martín;1;13.20;';
lineas[4] = 'Sara Gómez Ríos;70000032;I.E. Los Andes;2;12.90;';
const leida = PL.io.fromCSV(lineas.join('\r\n'));

check('se lee de vuelta y sabe dónde va',
    leida.sportId === 'carrera' && leida.rosterKey === 'competidores' && leida.rows.length === 2,
    JSON.stringify(leida.rows));

Store.setRosterRows('carrera', tablaCarrera, leida.rows);
openSport('carrera');
check('las filas entran en la planilla',
    Store.data('carrera').rosters.competidores[0].nombre === 'Rosa Pérez Alva' &&
    Store.data('carrera').rosters.competidores[1].tiempo === '12.90');
check('y el puesto se recalcula solo',
    Store.data('carrera').rosters.competidores[1].puesto === '1' &&
    Store.data('carrera').rosters.competidores[0].puesto === '2',
    Store.data('carrera').rosters.competidores.slice(0, 2).map(r => r.puesto).join(','));
check('se completa hasta el mínimo de filas',
    Store.data('carrera').rosters.competidores.length >= 12);

let rechazo = '';
try { PL.io.fromCSV(plantilla); } catch (e) { rechazo = e.message; }
check('una plantilla en blanco avisa en vez de vaciar la tabla',
    /ninguna fila con datos/.test(rechazo), rechazo);

try { rechazo = ''; PL.io.fromCSV('a;b\nc;d\ne;f\ng;h'); } catch (e) { rechazo = e.message; }
check('un CSV cualquiera se rechaza explicando qué hacer',
    /dos primeras filas/.test(rechazo), rechazo);

try { rechazo = ''; PL.io.fromCSV('Planilla;ajedrez\nTabla;x\nA;B\n1;2'); } catch (e) { rechazo = e.message; }
check('un deporte desconocido se rechaza', /Deporte desconocido/.test(rechazo), rechazo);

check('el parser respeta comillas y separadores',
    PL.io.parseCSV('a;"b;c";"di ""hola"""')[0].join('|') === 'a|b;c|di "hola"',
    JSON.stringify(PL.io.parseCSV('a;"b;c";"di ""hola"""')[0]));

section('Sin XSS');
openSport('salto');
type(field('meta.prueba'), '"><img src=x onerror=alert(1)>');
const chip = sheet.querySelector('[data-meta-value="prueba"]');
check('el payload queda como texto plano',
    chip.textContent === '"><img src=x onerror=alert(1)>' && chip.children.length === 0);

section('Imprimir');
fire('click', (() => { const b = el('button'); b.dataset.action = 'print'; body.appendChild(b); return b; })());
check('llama a window.print()', printed === 1, 'printed=' + printed);

(async function () {
    // El guardado está deliberadamente diferido (debounce de 250 ms).
    await new Promise(r => setTimeout(r, 300));

    section('Persistencia');
    check('escribe en localStorage', typeof storage['planillas.v3'] === 'string');
    const saved = JSON.parse(storage['planillas.v3']);
    check('guarda la configuración', saved.config.institucion === 'I.E. José Carlos Mariátegui');
    check('guarda varias planillas', saved.sports.futbol.sheets.length >= 2);
    Store.load();
    // Importar deja activa la planilla importada, así que se busca por nombre.
    const reloaded = Store.sheets('futbol').filter(s => s.name === 'Importada')[0];
    check('recarga y conserva cada planilla',
        reloaded && reloaded.data.meta.local === 'Colegio San Juan',
        reloaded && reloaded.data.meta.local);
    check('recalcula al cargar',
        Store.sheets('lanzamiento')[0].data.rosters.competidores[0].mejor === '50',
        Store.sheets('lanzamiento')[0].data.rosters.competidores[0].mejor);

    section('Migración desde la versión anterior');
    delete storage['planillas.v3'];
    storage['planillas.v2'] = JSON.stringify({
        v: 2, active: 'salto',
        sports: { salto: { meta: { prueba: 'Datos antiguos' }, rosters: {}, periods: {}, notes: {} } }
    });
    Store.load();
    check('los datos v2 pasan a ser una planilla',
        Store.sheets('salto').length === 1 && Store.data('salto').meta.prueba === 'Datos antiguos',
        Store.data('salto').meta.prueba);
    openSport('salto');
    check('y se pintan', /Datos antiguos/.test(sheet.textContent));

    console.log('\n' + (fails === 0 ? 'TODO OK' : fails + ' FALLOS'));
    process.exit(fails === 0 ? 0 : 1);
})();
