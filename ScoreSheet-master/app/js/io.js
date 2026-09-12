/* Entrada y salida de archivos: JSON para guardar y reabrir, CSV para Excel.
 *
 * Los datos viven en el localStorage de UN navegador. Sin esto, lo que se
 * rellena en el aula no llega a secretaría.
 *
 * La construcción del texto (toCSV, toJSON, fromJSON) es pura y se puede
 * probar sin navegador; sólo download, pickFile y readImage tocan el DOM.
 */

(function (PL) {
    'use strict';

    var SIGNATURE = 'planillas-deportivas';

    // ------------------------------------------------------------------ CSV

    /** Excel en español separa por ";" y necesita el BOM para leer los acentos. */
    function csvCell(value) {
        var text = value === null || value === undefined ? '' : String(value);
        if (/[";\r\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
        return text;
    }

    function csvRow(cells) {
        return cells.map(csvCell).join(';');
    }

    function toCSV(sport, sheet, config) {
        var data = sheet.data;
        var lines = [];

        if (config && config.institucion) lines.push(csvRow(['Institución', config.institucion]));
        lines.push(csvRow(['Planilla', sport.title]));
        lines.push(csvRow(['Nombre', sheet.name]));

        sport.meta.forEach(function (field) {
            lines.push(csvRow([field.label, data.meta[field.key]]));
        });
        lines.push('');

        sport.blocks.forEach(function (block) {
            if (block.type === 'roster') {
                lines.push(csvRow([block.team ? block.title + ' - ' + PL.teamName(data, block.team) : block.title]));
                lines.push(csvRow(['N°'].concat(block.columns.map(function (c) { return c.label; }))));

                data.rosters[block.key].forEach(function (row, i) {
                    lines.push(csvRow([i + 1].concat(block.columns.map(function (c) { return row[c.key]; }))));
                });
            } else if (block.type === 'periods') {
                var score = PL.periodScore(block, data);
                lines.push(csvRow([block.title]));
                lines.push(csvRow(['Equipo'].concat(block.labels, ['Total'])));

                ['local', 'visitante'].forEach(function (team) {
                    lines.push(csvRow([PL.teamName(data, team)]
                        .concat(data.periods[block.key][team], [score.sum[team]])));
                });
                lines.push(csvRow(['Marcador', score.score.local + ' - ' + score.score.visitante]));
            } else if (block.type === 'notes') {
                lines.push(csvRow([block.label]));
                lines.push(csvRow([data.notes[block.key]]));
            }
            lines.push('');
        });

        return '﻿' + lines.join('\r\n');
    }

    // ----------------------------------------------------------------- JSON

    function toJSON(sport, sheet) {
        return JSON.stringify({
            app: SIGNATURE,
            v: 3,
            sport: sport.id,
            name: sheet.name,
            exported: new Date().toISOString(),
            data: sheet.data
        }, null, 2);
    }

    /**
     * Devuelve { sportId, name, data } o lanza un error explicando qué pasa.
     * Los datos crudos NO se usan tal cual: quien llama los pasa por el
     * hidratado del esquema, así que un archivo manipulado no puede meter
     * campos extraños en el estado.
     */
    function fromJSON(text) {
        var parsed;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            throw new Error('El archivo no es un JSON válido.');
        }

        if (!parsed || parsed.app !== SIGNATURE) {
            throw new Error('El archivo no es una planilla exportada por esta aplicación.');
        }

        var sport = PL.sports.filter(function (s) { return s.id === parsed.sport; })[0];
        if (!sport) throw new Error('La planilla es de un deporte desconocido: ' + parsed.sport + '.');

        return {
            sportId: sport.id,
            name: typeof parsed.name === 'string' && parsed.name ? parsed.name : 'Planilla importada',
            data: parsed.data
        };
    }

    function slug(text) {
        return String(text).toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'planilla';
    }

    // -------------------------------------------------------------- browser

    function download(filename, mime, text) {
        var blob = new Blob([text], { type: mime + ';charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    function pickFile(accept) {
        return new Promise(function (resolve) {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.addEventListener('change', function () {
                resolve(input.files && input.files[0] ? input.files[0] : null);
            });
            input.click();
        });
    }

    function readText(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result)); };
            reader.onerror = function () { reject(new Error('No se pudo leer el archivo.')); };
            reader.readAsText(file);
        });
    }

    /** El logo se reescala antes de guardarlo: localStorage tiene unos 5 MB. */
    function readImage(file, maxSize) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();

            reader.onload = function () {
                var image = new Image();
                image.onload = function () {
                    var scale = Math.min(1, maxSize / Math.max(image.width, image.height));
                    var canvas = document.createElement('canvas');
                    canvas.width = Math.round(image.width * scale);
                    canvas.height = Math.round(image.height * scale);
                    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL('image/png'));
                };
                image.onerror = function () { reject(new Error('No se pudo leer la imagen.')); };
                image.src = String(reader.result);
            };

            reader.onerror = function () { reject(new Error('No se pudo leer el archivo.')); };
            reader.readAsDataURL(file);
        });
    }

    // ------------------------------------------ plantilla CSV editable

    /** Normaliza un encabezado para emparejarlo con su columna. */
    function norm(text) {
        return String(text).trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }

    /**
     * Tabla en blanco para rellenar en Excel y volver a cargarla.
     *
     * Sin esto, "Importar" sólo servía para archivos que la propia aplicación
     * hubiera exportado antes: un viaje de ida y vuelta sin ida.
     *
     * Las dos primeras filas dicen a qué deporte y a qué tabla pertenece, para
     * que al importar no haya que adivinarlo ni preguntar.
     */
    function toTemplateCSV(sport, block, data) {
        var title = block.team ? block.title + ' - ' + PL.teamName(data, block.team) : block.title;
        var lines = [
            csvRow(['Planilla', sport.id, sport.title]),
            csvRow(['Tabla', block.key, title]),
            csvRow(block.columns.map(function (c) { return c.label; }))
        ];

        var blank = block.columns.map(function () { return ''; });
        for (var i = 0; i < PL.minCount(block); i++) lines.push(csvRow(blank));

        return '\uFEFF' + lines.join('\r\n');
    }

    /** Parte un CSV separado por ";" respetando las comillas. */
    function parseCSV(text) {
        var rows = [], row = [], cell = '', quoted = false;
        text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            if (quoted) {
                if (ch !== '"') cell += ch;
                else if (text[i + 1] === '"') { cell += '"'; i++; }
                else quoted = false;
            } else if (ch === '"') quoted = true;
            else if (ch === ';') { row.push(cell); cell = ''; }
            else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
            else cell += ch;
        }
        row.push(cell);
        rows.push(row);
        return rows;
    }

    /**
     * Lee una plantilla rellenada: { sportId, rosterKey, rows }, con las filas
     * ya traducidas a las claves de columna del esquema. Los errores explican
     * qué hacer, no sólo qué falló.
     */
    function fromCSV(text) {
        var table = parseCSV(text);
        if (table.length < 4) throw new Error('El archivo está vacío o no tiene forma de plantilla.');

        if (norm(table[0][0]) !== 'planilla' || norm(table[1][0]) !== 'tabla') {
            throw new Error('Al CSV le faltan las dos primeras filas ("Planilla" y "Tabla"). ' +
                'Descarga la plantilla desde la aplicación y rellena esa.');
        }

        var sportId = String(table[0][1] || '').trim();
        var rosterKey = String(table[1][1] || '').trim();

        var sport = PL.sports.filter(function (s) { return s.id === sportId; })[0];
        if (!sport) throw new Error('Deporte desconocido en el archivo: "' + sportId + '".');

        var block = sport.blocks.filter(function (b) {
            return b.type === 'roster' && b.key === rosterKey;
        })[0];
        if (!block) throw new Error('La tabla "' + rosterKey + '" no existe en ' + sport.label + '.');

        var keys = table[2].map(function (header) {
            var match = block.columns.filter(function (c) { return norm(c.label) === norm(header); })[0];
            return match ? match.key : null;
        });
        if (!keys.filter(Boolean).length) {
            throw new Error('Ningún encabezado del CSV coincide con las columnas de "' + block.title +
                '". ¿Se cambió la fila de títulos?');
        }

        var rows = table.slice(3).map(function (cells) {
            var row = {};
            keys.forEach(function (key, i) {
                if (key) row[key] = String(cells[i] === undefined ? '' : cells[i]).trim();
            });
            return row;
        });

        var isBlank = function (row) {
            return Object.keys(row).every(function (k) { return row[k] === ''; });
        };
        while (rows.length && isBlank(rows[rows.length - 1])) rows.pop();

        if (!rows.length) throw new Error('La plantilla no tiene ninguna fila con datos.');

        return { sportId: sportId, rosterKey: rosterKey, rows: rows, blockTitle: block.title };
    }

    PL.io = {
        toCSV: toCSV,
        toTemplateCSV: toTemplateCSV,
        parseCSV: parseCSV,
        fromCSV: fromCSV,
        toJSON: toJSON,
        fromJSON: fromJSON,
        slug: slug,
        download: download,
        pickFile: pickFile,
        readText: readText,
        readImage: readImage
    };
})(window.PL);
