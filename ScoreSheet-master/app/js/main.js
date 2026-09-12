/* Arranque y conexión de las piezas.
 *
 * Cinco escuchadores delegados (input, change, click, paste, keydown) en vez
 * de los onclick repartidos por el HTML. Escribir no vuelve a dibujar nada: se actualiza el
 * estado, se recalculan los valores derivados y se refleja el valor en el
 * campo gemelo del otro panel, así no se pierde el foco ni el cursor.
 */

(function (PL) {
    'use strict';

    var $ = PL.$;
    var $$ = PL.$$;
    var h = PL.h;
    var Store = PL.Store;

    var workspace, editor, formHost, review, sheetbar, sheet, tabs;
    var sport;

    function blockByKey(key) {
        for (var i = 0; i < sport.blocks.length; i++) {
            if (sport.blocks[i].key === key) return sport.blocks[i];
        }
        return null;
    }

    /** "rosters.plantillaLocal.3.dorsal" -> { block, row, col } */
    function parseRosterPath(path) {
        var parts = path.split('.');
        if (parts[0] !== 'rosters') return null;
        return { block: parts[1], row: Number(parts[2]), col: parts[3] };
    }

    function cellPath(blockKey, row, colKey) {
        return 'rosters.' + blockKey + '.' + row + '.' + colKey;
    }

    /** El formulario oculta las columnas sheetOnly; la hoja las muestra todas. */
    function panelColumns(block, el) {
        if (el.closest('#sheet')) return block.columns;
        return block.columns.filter(function (col) { return !col.sheetOnly; });
    }

    function focusCell(blockKey, row, colKey, scope) {
        var el = $('[data-path="' + cellPath(blockKey, row, colKey) + '"]', scope);
        if (el) {
            el.focus();
            if (el.select) el.select();
        }
        return el;
    }

    function setText(selector, text) {
        $$(selector, workspace).forEach(function (el) { el.textContent = text; });
    }

    // ------------------------------------------------------------- derivados

    /** Recalcula columnas, marcadores y avisos, y los vuelca en el DOM ya pintado. */
    function updateDerived() {
        var data = Store.data(sport.id);

        PL.recompute(sport, data);

        $$('[data-computed]', workspace).forEach(function (el) {
            var value = String(Store.get(sport.id, el.dataset.path));
            if (el.value !== value) el.value = value;
        });

        PL.blocksOfType(sport, 'periods').forEach(function (block) {
            var result = PL.periodScore(block, data);
            ['local', 'visitante'].forEach(function (team) {
                setText('[data-total="' + block.key + '.' + team + '"]', String(result.sum[team]));
                setText('[data-score="' + block.key + '.' + team + '"]', String(result.score[team]));
            });
        });

        PL.replace(review, PL.renderReview(PL.validate(sport, data)));
    }

    function updateDocTitle() {
        var subtitle = (Store.data(sport.id).meta[sport.subtitleFrom] || '').trim();
        document.title = sport.title + (subtitle ? ' · ' + subtitle : '') + ' — Planillas';
    }

    function render() {
        var data = Store.data(sport.id);
        var config = Store.getConfig();
        var scroll = sheet.parentNode.scrollTop;

        PL.replace(sheetbar, PL.renderSheetBar(sport, Store.sheets(sport.id), Store.sheet(sport.id).id));
        PL.replace(formHost, PL.renderForm(sport, data, config));
        PL.replace(sheet, PL.renderSheet(sport, data, config));

        sheet.parentNode.scrollTop = scroll;
        updateDerived();
        updateDocTitle();
    }

    function selectSport(id) {
        sport = PL.sportById(id);
        Store.setActive(sport.id);

        $$('.tab', tabs).forEach(function (tab) {
            tab.setAttribute('aria-selected', String(tab.dataset.sport === sport.id));
        });

        render();
        editor.scrollTop = 0;
    }

    /** Un cambio en los datos generales sólo afecta a textos sueltos de la hoja. */
    function onMetaChange(key) {
        var data = Store.data(sport.id);

        if (key === 'local' || key === 'visitante') {
            setText('[data-team-name="' + key + '"]', PL.teamName(data, key));
        }

        var subtitle = $('[data-sheet-subtitle="' + key + '"]', workspace);
        if (subtitle) subtitle.textContent = data.meta[key] || '';

        var chip = $('[data-meta-value="' + key + '"]', workspace);
        if (chip) {
            var field = sport.meta.filter(function (f) { return f.key === key; })[0];
            chip.textContent = PL.formatMeta(field, data.meta[key]);
        }

        if (key === sport.subtitleFrom) updateDocTitle();
    }

    // --------------------------------------------------------------- eventos

    function onInput(event) {
        var el = event.target;
        if (!el.dataset) return;

        if (el.dataset.action === 'sheet-rename') {
            Store.renameSheet(sport.id, el.value);
            var current = Store.sheet(sport.id).id;
            $$('option', sheetbar).forEach(function (option) {
                if (option.value === current) option.textContent = el.value;
            });
            return;
        }

        if (el.dataset.config) {
            Store.setConfig(el.dataset.config, el.value);
            setText('[data-config-value="' + el.dataset.config + '"]', el.value || PL.ORG_FALLBACK);
            return;
        }

        var path = el.dataset.path;
        if (!path) return;

        Store.set(sport.id, path, el.value);

        // Reflejar el valor en el campo equivalente del otro panel.
        $$('[data-path="' + path + '"]', workspace).forEach(function (twin) {
            if (twin !== el && twin.value !== el.value) twin.value = el.value;
        });

        if (path.indexOf('meta.') === 0) onMetaChange(path.split('.')[1]);
        updateDerived();
    }

    /**
     * Pegar desde Excel. El portapapeles llega como TSV, así que un bloque de
     * celdas se reparte por filas y columnas desde donde está el cursor,
     * creando las filas que hagan falta. Pegar un valor suelto (sin tabuladores
     * ni saltos de línea) se deja al navegador.
     */
    function onPaste(event) {
        var el = event.target;
        if (!el.dataset || !el.dataset.path) return;

        var pos = parseRosterPath(el.dataset.path);
        if (!pos) return;

        var text = event.clipboardData ? event.clipboardData.getData('text/plain') : '';
        if (!text || !/[\t\r\n]/.test(text)) return;

        event.preventDefault();

        var block = blockByKey(pos.block);
        var columns = panelColumns(block, el);
        var start = 0;
        for (var i = 0; i < columns.length; i++) {
            if (columns[i].key === pos.col) { start = i; break; }
        }

        var grid = text.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map(function (line) {
            return line.split('\t');
        });

        var rows = Store.data(sport.id).rosters[block.key];
        grid.forEach(function (cells, r) {
            var row = pos.row + r;
            while (rows.length <= row) Store.addRow(sport.id, block);

            cells.forEach(function (value, c) {
                var column = columns[start + c];
                if (!column || column.computed) return;
                Store.set(sport.id, cellPath(block.key, row, column.key), value.trim());
            });
        });

        render();
        focusCell(block.key, pos.row, columns[start].key, el.closest('#sheet') ? sheet : editor);
    }

    /** Enter y flechas recorren la columna, como en una hoja de cálculo. */
    function onKeyDown(event) {
        var el = event.target;
        if (!el.dataset || !el.dataset.path) return;

        var pos = parseRosterPath(el.dataset.path);
        if (!pos) return;

        var step = 0;
        if (event.key === 'Enter' || event.key === 'ArrowDown') step = 1;
        else if (event.key === 'ArrowUp') step = -1;
        else return;

        event.preventDefault();

        var block = blockByKey(pos.block);
        var target = pos.row + step;
        if (target < 0) return;

        var scope = el.closest('#sheet') ? sheet : editor;

        if (target >= Store.data(sport.id).rosters[block.key].length) {
            Store.addRow(sport.id, block);
            render();
        }

        focusCell(block.key, target, pos.col, scope);
    }

    function onChange(event) {
        var el = event.target;
        if (el.dataset && el.dataset.action === 'sheet-select') {
            Store.selectSheet(sport.id, el.value);
            render();
        }
    }

    // ------------------------------------------------------- importar/exportar

    function currentFilename(extension) {
        return 'planilla-' + sport.id + '-' + PL.io.slug(Store.sheet(sport.id).name) + '.' + extension;
    }

    function exportJSON() {
        PL.io.download(currentFilename('json'), 'application/json', PL.io.toJSON(sport, Store.sheet(sport.id)));
    }

    function exportCSV() {
        PL.io.download(currentFilename('csv'), 'text/csv', PL.io.toCSV(sport, Store.sheet(sport.id), Store.getConfig()));
    }

    function importPlanilla(text) {
        var imported = PL.io.fromJSON(text);
        Store.importSheet(imported.sportId, imported.name, imported.data);
        selectSport(imported.sportId);
    }

    /** Una plantilla CSV trae una sola tabla: reemplaza esa, no la planilla entera. */
    function importRoster(text) {
        var parsed = PL.io.fromCSV(text);
        if (parsed.sportId !== sport.id) selectSport(parsed.sportId);

        if (!window.confirm('Se reemplazarán las filas de "' + parsed.blockTitle +
            '" en la planilla actual por ' + parsed.rows.length + ' fila(s) del archivo. ¿Continuar?')) return;

        Store.setRosterRows(sport.id, blockByKey(parsed.rosterKey), parsed.rows);
        render();
    }

    function importFile() {
        PL.io.pickFile('.json,.csv,application/json,text/csv').then(function (file) {
            if (!file) return;
            return PL.io.readText(file).then(function (text) {
                if (/\.csv$/i.test(file.name || '')) importRoster(text);
                else importPlanilla(text);
            });
        }).catch(function (error) {
            window.alert('No se pudo importar: ' + error.message);
        });
    }

    function pickLogo() {
        PL.io.pickFile('image/*').then(function (file) {
            if (!file) return;
            return PL.io.readImage(file, 240).then(function (dataUrl) {
                Store.setConfig('logo', dataUrl);
                render();
            });
        }).catch(function (error) {
            window.alert('No se pudo cargar el logo: ' + error.message);
        });
    }

    /** Los errores (un dorsal repetido) frenan; los avisos sólo informan. */
    function printSheet() {
        var errors = PL.validate(sport, Store.data(sport.id)).filter(function (i) { return i.level === 'error'; });

        if (errors.length && !window.confirm(
            'La planilla tiene ' + errors.length + ' error(es):\n\n' +
            errors.slice(0, 5).map(function (i) { return '· ' + i.text; }).join('\n') +
            '\n\n¿Imprimir de todas formas?')) return;

        window.print();
    }

    function onClick(event) {
        var el = event.target.closest ? event.target.closest('[data-action]') : null;
        if (!el) return;

        var action = el.dataset.action;

        if (action === 'print') {
            printSheet();
        } else if (action === 'tab') {
            selectSport(el.dataset.sport);
        } else if (action === 'export-json') {
            exportJSON();
        } else if (action === 'export-csv') {
            exportCSV();
        } else if (action === 'import') {
            importFile();
        } else if (action === 'roster-template') {
            var tabla = blockByKey(el.dataset.block);
            PL.io.download('plantilla-' + sport.id + '-' + PL.io.slug(tabla.title) + '.csv', 'text/csv',
                PL.io.toTemplateCSV(sport, tabla, Store.data(sport.id)));
        } else if (action === 'logo-pick') {
            pickLogo();
        } else if (action === 'logo-clear') {
            Store.setConfig('logo', '');
            render();
        } else if (action === 'sheet-new') {
            Store.createSheet(sport.id);
            render();
        } else if (action === 'sheet-demo') {
            var muestra = PL.demoData(sport.id);
            if (muestra) {
                Store.importSheet(sport.id, 'Ejemplo', muestra);
                render();
            }
        } else if (action === 'sheet-dup') {
            Store.duplicateSheet(sport.id);
            render();
        } else if (action === 'sheet-del') {
            if (window.confirm('¿Borrar la planilla "' + Store.sheet(sport.id).name + '"?')) {
                Store.removeSheet(sport.id);
                render();
            }
        } else if (action === 'row-add') {
            var block = blockByKey(el.dataset.block);
            var index = Store.addRow(sport.id, block);
            render();
            var first = $('[data-path="rosters.' + block.key + '.' + index + '.' + block.columns[0].key + '"]', editor);
            if (first) first.focus();
        } else if (action === 'row-remove') {
            Store.removeRow(sport.id, blockByKey(el.dataset.block), Number(el.dataset.index));
            render();
        }
    }

    function buildTabs() {
        PL.replace(tabs, PL.sports.map(function (s) {
            return h('button', {
                class: 'tab',
                type: 'button',
                role: 'tab',
                text: s.label,
                'aria-selected': 'false',
                dataset: { action: 'tab', sport: s.id }
            });
        }));
    }

    function init() {
        workspace = $('#workspace');
        editor = $('#editor');
        formHost = $('#form-host');
        review = $('#review');
        sheetbar = $('#sheetbar');
        sheet = $('#sheet');
        tabs = $('#tabs');

        Store.load();
        buildTabs();
        selectSport(Store.getActive());

        document.addEventListener('input', onInput);
        document.addEventListener('change', onChange);
        document.addEventListener('click', onClick);
        document.addEventListener('paste', onPaste);
        document.addEventListener('keydown', onKeyDown);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})(window.PL);
