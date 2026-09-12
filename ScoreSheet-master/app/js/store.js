/* Estado de la aplicación.
 *
 * Cada deporte guarda VARIAS planillas, no una: en una jornada se arbitran
 * tres series de 100 m y la segunda no debe pisar a la primera.
 *
 *   { config: { institucion, logo },
 *     active: 'futbol',
 *     sports: { futbol: { activeSheet: 'id', sheets: [ {id, name, updatedAt, data} ] } } }
 *
 * Y los datos de una planilla:
 *   { meta: {clave: texto},
 *     rosters: {clave: [ {columna: texto} ]},
 *     periods: {clave: {local: [texto], visitante: [texto]}},
 *     notes: {clave: texto} }
 *
 * Las rutas ("meta.prueba", "rosters.competidores.3.nombre") son las que
 * llevan los inputs en data-path y conectan formulario, hoja y estado.
 */

(function (PL) {
    'use strict';

    var KEY = 'planillas.v3';
    var LEGACY_KEY = 'planillas.v2';

    var config = { institucion: '', logo: '' };
    var sports = {};
    var active = null;
    var saveTimer = null;

    function today() {
        var d = new Date();
        var mm = String(d.getMonth() + 1);
        var dd = String(d.getDate());
        return d.getFullYear() + '-' + (mm.length < 2 ? '0' + mm : mm) + '-' + (dd.length < 2 ? '0' + dd : dd);
    }

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function emptyRow(block) {
        var row = {};
        block.columns.forEach(function (col) { row[col.key] = ''; });
        return row;
    }

    /** Datos iniciales de una planilla, derivados del esquema del deporte. */
    function blank(sport) {
        var data = { meta: {}, rosters: {}, periods: {}, notes: {} };

        sport.meta.forEach(function (f) {
            if (f.today) data.meta[f.key] = today();
            else if (f.type === 'select') data.meta[f.key] = f.options[0];
            else data.meta[f.key] = '';
        });

        sport.blocks.forEach(function (block) {
            if (block.type === 'roster') {
                var rows = [];
                var n = PL.minCount(block);
                for (var i = 0; i < n; i++) rows.push(emptyRow(block));
                data.rosters[block.key] = rows;
            } else if (block.type === 'periods') {
                data.periods[block.key] = {
                    local: block.labels.map(function () { return ''; }),
                    visitante: block.labels.map(function () { return ''; })
                };
            } else if (block.type === 'notes') {
                data.notes[block.key] = '';
            }
        });

        return data;
    }

    /**
     * Mezcla unos datos cualesquiera con los valores por defecto, campo por
     * campo. Es la única puerta de entrada: lo que venga del almacenamiento o
     * de un archivo importado se adapta al esquema en vez de romper la app.
     */
    function hydrate(sport, stored) {
        var data = blank(sport);
        if (!stored || typeof stored !== 'object') return data;

        var storedMeta = stored.meta || {};
        sport.meta.forEach(function (f) {
            if (typeof storedMeta[f.key] === 'string' && storedMeta[f.key] !== '') {
                data.meta[f.key] = storedMeta[f.key];
            }
        });

        sport.blocks.forEach(function (block) {
            if (block.type === 'roster') {
                var src = (stored.rosters || {})[block.key];
                if (!Array.isArray(src)) return;
                var rows = src.map(function (raw) {
                    var row = emptyRow(block);
                    if (raw && typeof raw === 'object') {
                        block.columns.forEach(function (col) {
                            if (typeof raw[col.key] === 'string') row[col.key] = raw[col.key];
                        });
                    }
                    return row;
                });
                while (rows.length < PL.minCount(block)) rows.push(emptyRow(block));
                data.rosters[block.key] = rows;
            } else if (block.type === 'periods') {
                var p = (stored.periods || {})[block.key] || {};
                ['local', 'visitante'].forEach(function (team) {
                    if (!Array.isArray(p[team])) return;
                    data.periods[block.key][team] = block.labels.map(function (_, i) {
                        return typeof p[team][i] === 'string' ? p[team][i] : '';
                    });
                });
            } else if (block.type === 'notes') {
                var text = (stored.notes || {})[block.key];
                if (typeof text === 'string') data.notes[block.key] = text;
            }
        });

        return data;
    }

    function makeSheet(sport, name, storedData) {
        return {
            id: uid(),
            name: name,
            updatedAt: new Date().toISOString(),
            data: hydrate(sport, storedData)
        };
    }

    // ------------------------------------------------------------ persistencia

    function readKey(key) {
        try {
            return JSON.parse(localStorage.getItem(key));
        } catch (e) {
            return null; // datos corruptos o almacenamiento bloqueado
        }
    }

    /** La versión anterior guardaba una sola planilla por deporte. */
    function migrateLegacy(old) {
        if (!old || !old.sports) return null;

        var out = { active: old.active, config: {}, sports: {} };
        Object.keys(old.sports).forEach(function (id) {
            out.sports[id] = { sheets: [{ id: uid(), name: 'Planilla 1', data: old.sports[id] }] };
        });
        return out;
    }

    function load() {
        var stored = readKey(KEY) || migrateLegacy(readKey(LEGACY_KEY)) || {};
        var storedConfig = stored.config || {};

        config = {
            institucion: typeof storedConfig.institucion === 'string' ? storedConfig.institucion : '',
            logo: typeof storedConfig.logo === 'string' ? storedConfig.logo : ''
        };

        sports = {};
        PL.sports.forEach(function (sport) {
            var raw = (stored.sports || {})[sport.id] || {};
            var list = Array.isArray(raw.sheets) ? raw.sheets : [];

            var sheets = list.map(function (s, i) {
                s = s || {};
                return {
                    id: typeof s.id === 'string' && s.id ? s.id : uid(),
                    name: typeof s.name === 'string' && s.name ? s.name : 'Planilla ' + (i + 1),
                    updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : new Date().toISOString(),
                    data: hydrate(sport, s.data)
                };
            });

            if (!sheets.length) sheets.push(makeSheet(sport, 'Planilla 1'));

            var found = sheets.filter(function (s) { return s.id === raw.activeSheet; })[0];
            sports[sport.id] = { activeSheet: found ? found.id : sheets[0].id, sheets: sheets };

            sheets.forEach(function (s) { PL.recompute(sport, s.data); });
        });

        active = PL.sportById(stored.active).id;
    }

    function save() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(function () {
            try {
                localStorage.setItem(KEY, JSON.stringify({
                    v: 3, active: active, config: config, sports: sports
                }));
            } catch (e) {
                // Navegación privada o cuota llena: la app sigue funcionando sin guardar.
            }
        }, 250);
    }

    // ------------------------------------------------------------------ acceso

    function getConfig() {
        return config;
    }

    function setConfig(key, value) {
        config[key] = value;
        save();
    }

    function sheets(sportId) {
        return sports[sportId].sheets;
    }

    function sheet(sportId) {
        var entry = sports[sportId];
        var found = entry.sheets.filter(function (s) { return s.id === entry.activeSheet; })[0];
        return found || entry.sheets[0];
    }

    function data(sportId) {
        return sheet(sportId).data;
    }

    function touch(sportId) {
        sheet(sportId).updatedAt = new Date().toISOString();
    }

    function get(sportId, path) {
        var parts = path.split('.');
        var cursor = data(sportId);

        for (var i = 0; i < parts.length; i++) {
            if (cursor === undefined || cursor === null) return '';
            cursor = cursor[parts[i]];
        }
        return cursor === undefined || cursor === null ? '' : cursor;
    }

    /** set('futbol', 'rosters.plantillaLocal.2.nombre', 'Ana') */
    function set(sportId, path, value) {
        var parts = path.split('.');
        var cursor = data(sportId);

        for (var i = 0; i < parts.length - 1; i++) {
            cursor = cursor[parts[i]];
            if (cursor === undefined || cursor === null) return false;
        }

        cursor[parts[parts.length - 1]] = value;
        touch(sportId);
        save();
        return true;
    }

    // ----------------------------------------------------------- planillas

    function selectSheet(sportId, sheetId) {
        var found = sports[sportId].sheets.filter(function (s) { return s.id === sheetId; })[0];
        if (!found) return false;
        sports[sportId].activeSheet = sheetId;
        save();
        return true;
    }

    function createSheet(sportId) {
        var entry = sports[sportId];
        var created = makeSheet(PL.sportById(sportId), 'Planilla ' + (entry.sheets.length + 1));
        entry.sheets.push(created);
        entry.activeSheet = created.id;
        save();
        return created.id;
    }

    function duplicateSheet(sportId) {
        var entry = sports[sportId];
        var source = sheet(sportId);
        var copy = {
            id: uid(),
            name: source.name + ' (copia)',
            updatedAt: new Date().toISOString(),
            data: JSON.parse(JSON.stringify(source.data))
        };

        entry.sheets.push(copy);
        entry.activeSheet = copy.id;
        save();
        return copy.id;
    }

    /** Nunca se queda sin ninguna: borrar la última deja una vacía. */
    function removeSheet(sportId) {
        var entry = sports[sportId];
        var index = entry.sheets.indexOf(sheet(sportId));

        entry.sheets.splice(index, 1);
        if (!entry.sheets.length) entry.sheets.push(makeSheet(PL.sportById(sportId), 'Planilla 1'));

        entry.activeSheet = entry.sheets[Math.min(index, entry.sheets.length - 1)].id;
        save();
        return entry.activeSheet;
    }

    function renameSheet(sportId, name) {
        sheet(sportId).name = name;
        touch(sportId);
        save();
    }

    /** Alta desde un archivo importado: los datos pasan por hydrate. */
    function importSheet(sportId, name, rawData) {
        var entry = sports[sportId];
        var created = makeSheet(PL.sportById(sportId), name, rawData);

        PL.recompute(PL.sportById(sportId), created.data);
        entry.sheets.push(created);
        entry.activeSheet = created.id;
        save();
        return created.id;
    }

    // ---------------------------------------------------------------- filas

    function addRow(sportId, block) {
        var rows = data(sportId).rosters[block.key];
        rows.push(emptyRow(block));
        touch(sportId);
        save();
        return rows.length - 1;
    }

    /** Quita la fila; si ya se está en el mínimo del esquema, sólo la vacía. */
    function removeRow(sportId, block, index) {
        var rows = data(sportId).rosters[block.key];
        if (rows.length > PL.minCount(block)) rows.splice(index, 1);
        else rows[index] = emptyRow(block);
        touch(sportId);
        save();
    }

    /** Reemplaza las filas de una tabla (importación de una plantilla CSV). */
    function setRosterRows(sportId, block, incoming) {
        var rows = incoming.map(function (raw) {
            var row = emptyRow(block);
            block.columns.forEach(function (col) {
                if (typeof raw[col.key] === 'string') row[col.key] = raw[col.key];
            });
            return row;
        });

        while (rows.length < PL.minCount(block)) rows.push(emptyRow(block));

        data(sportId).rosters[block.key] = rows;
        touch(sportId);
        save();
        return rows.length;
    }

    function reset(sportId) {
        sheet(sportId).data = blank(PL.sportById(sportId));
        touch(sportId);
        save();
    }

    function getActive() {
        return active;
    }

    function setActive(sportId) {
        active = sportId;
        save();
    }

    PL.Store = {
        load: load,
        getConfig: getConfig,
        setConfig: setConfig,
        sheets: sheets,
        sheet: sheet,
        data: data,
        get: get,
        set: set,
        selectSheet: selectSheet,
        createSheet: createSheet,
        duplicateSheet: duplicateSheet,
        removeSheet: removeSheet,
        renameSheet: renameSheet,
        importSheet: importSheet,
        addRow: addRow,
        removeRow: removeRow,
        setRosterRows: setRosterRows,
        reset: reset,
        getActive: getActive,
        setActive: setActive
    };
})(window.PL);
