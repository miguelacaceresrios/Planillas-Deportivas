/* Valores derivados y revisión de la planilla.
 *
 * Nada de lo que se puede calcular debería escribirse a mano: en una planilla
 * oficial cada número copiado es un error en potencia. Aquí viven las columnas
 * calculadas (mejor marca, puesto), los marcadores y los avisos de revisión.
 *
 * Todo son funciones puras sobre (esquema, datos), así que se pueden probar
 * sin navegador.
 */

(function (PL) {
    'use strict';

    /** "12,5" y "12.5" valen lo mismo; el resto es vacío. */
    function parseNum(value) {
        if (typeof value !== 'string' || value.trim() === '') return null;
        var n = parseFloat(value.replace(',', '.'));
        return isFinite(n) ? n : null;
    }

    /** Acepta "12.34", "1:02.5" y "1:02:03" y devuelve segundos. */
    function parseTime(value) {
        if (typeof value !== 'string' || value.trim() === '') return null;
        var parts = value.trim().replace(',', '.').split(':');
        var seconds = 0;

        for (var i = 0; i < parts.length; i++) {
            var n = parseFloat(parts[i]);
            if (!isFinite(n)) return null;
            seconds = seconds * 60 + n;
        }
        return seconds;
    }

    function valueOf(row, key, parse) {
        return parse === 'time' ? parseTime(row[key]) : parseNum(row[key]);
    }

    /**
     * Puestos por ranking. Los empates comparten puesto (1, 2, 2, 4) y quien no
     * tiene marca se queda sin puesto: así una descalificación no corre la lista.
     */
    function rank(rows, column) {
        var spec = column.computed;
        var scored = [];

        rows.forEach(function (row, index) {
            var value = valueOf(row, spec.by, spec.parse);
            if (value !== null) scored.push({ index: index, value: value });
            else row[column.key] = '';
        });

        scored.sort(function (a, b) {
            return spec.order === 'asc' ? a.value - b.value : b.value - a.value;
        });

        var position = 0;
        var previous = null;
        var current = 0;

        scored.forEach(function (entry) {
            position++;
            if (previous === null || entry.value !== previous) current = position;
            previous = entry.value;
            rows[entry.index][column.key] = String(current);
        });
    }

    function max(rows, column) {
        rows.forEach(function (row) {
            var values = column.computed.from
                .map(function (key) { return parseNum(row[key]); })
                .filter(function (n) { return n !== null; });

            row[column.key] = values.length ? String(Math.max.apply(null, values)) : '';
        });
    }

    /** Recalcula, sobre los propios datos, todas las columnas marcadas como computed. */
    function recompute(sport, data) {
        sport.blocks.forEach(function (block) {
            if (block.type !== 'roster') return;
            var rows = data.rosters[block.key];

            block.columns.forEach(function (column) {
                if (!column.computed) return;
                if (column.computed.type === 'max') max(rows, column);
                else if (column.computed.type === 'rank') rank(rows, column);
            });
        });
    }

    /**
     * Marcador de un bloque de periodos.
     *   sum   suma de los valores (goles por tiempo, puntos por cuarto)
     *   score lo que va en el marcador grande; en voleibol NO es la suma de
     *         puntos sino los sets ganados: 25-23 / 25-20 / 22-25 es 2-1.
     */
    function periodScore(block, data) {
        var values = data.periods[block.key];
        var sum = { local: 0, visitante: 0 };

        ['local', 'visitante'].forEach(function (team) {
            values[team].forEach(function (raw) {
                var n = parseNum(raw);
                if (n !== null) sum[team] += n;
            });
        });

        if (block.totalMode !== 'wins') {
            return { sum: sum, score: { local: sum.local, visitante: sum.visitante } };
        }

        var won = { local: 0, visitante: 0 };
        block.labels.forEach(function (_, i) {
            var local = parseNum(values.local[i]);
            var away = parseNum(values.visitante[i]);
            if (local === null || away === null || local === away) return;
            if (local > away) won.local++;
            else won.visitante++;
        });

        return { sum: sum, score: won };
    }

    // ------------------------------------------------------------- revisión

    function issue(level, text) {
        return { level: level, text: text };
    }

    /** El equipo entre paréntesis sólo si tiene nombre: "Plantilla local (Equipo local)" sobra. */
    function rosterLabel(block, data) {
        if (!block.team) return block.title;
        var name = (data.meta[block.team] || '').trim();
        return name ? block.title + ' (' + name + ')' : block.title;
    }

    function checkRoster(block, data, issues, unnamed) {
        var rows = data.rosters[block.key];
        var label = rosterLabel(block, data);
        var hasDni = block.columns.some(function (c) { return c.key === 'dni'; });
        var hasDorsal = block.columns.some(function (c) { return c.key === 'dorsal'; });
        var dorsales = {};
        var named = 0;

        rows.forEach(function (row, i) {
            var line = label + ', fila ' + (i + 1);
            if ((row.nombre || '').trim() !== '') named++;

            if (hasDni && (row.dni || '').trim() !== '' && !/^\d{8}$/.test(row.dni.trim())) {
                issues.push(issue('warn', line + ': el DNI debe tener 8 dígitos.'));
            }

            if (hasDorsal) {
                var dorsal = (row.dorsal || '').trim();
                if (dorsal === '') return;
                if (dorsales[dorsal] !== undefined) {
                    issues.push(issue('error', label + ': dorsal ' + dorsal + ' repetido (filas ' +
                        (dorsales[dorsal] + 1) + ' y ' + (i + 1) + ').'));
                } else {
                    dorsales[dorsal] = i;
                }
            }
        });

        if (named === 0) unnamed.push(label);
    }

    /** Los puntos anotados por jugador deberían cuadrar con la suma de los cuartos. */
    function checkTally(sport, data, issues) {
        var periods = PL.blocksOfType(sport, 'periods')[0];
        if (!periods || periods.totalMode === 'wins') return;

        var totals = periodScore(periods, data);

        sport.blocks.forEach(function (block) {
            if (block.type !== 'roster' || !block.team) return;
            if (!block.columns.some(function (c) { return c.key === 'puntos'; })) return;

            var scored = 0;
            var any = false;
            data.rosters[block.key].forEach(function (row) {
                var n = parseNum(row.puntos);
                if (n !== null) { scored += n; any = true; }
            });

            var expected = totals.sum[block.team];
            if (any && expected > 0 && scored !== expected) {
                issues.push(issue('warn', rosterLabel(block, data) + ': los puntos por jugador suman ' +
                    scored + ' y los cuartos ' + expected + '.'));
            }
        });
    }

    var RANK = { error: 0, warn: 1, info: 2 };

    /**
     * Tres niveles: error (algo está mal), warn (probablemente mal) e info
     * (todavía sin rellenar).
     *
     * Una planilla recién abierta está vacía, no está mal: si cada campo sin
     * rellenar fuese un aviso de color, abrir la aplicación sería encontrarse
     * siete líneas ámbar y el color dejaría de significar nada. Lo pendiente
     * va agrupado en una sola línea neutra y primero se listan los problemas.
     */
    function validate(sport, data) {
        var issues = [];
        var pending = [];
        var unnamed = [];

        sport.meta.forEach(function (field) {
            if ((data.meta[field.key] || '').trim() === '') pending.push(field.label);
        });

        sport.blocks.forEach(function (block) {
            if (block.type === 'roster') checkRoster(block, data, issues, unnamed);
        });

        checkTally(sport, data, issues);

        if (pending.length) issues.push(issue('info', 'Pendiente: ' + pending.join(', ') + '.'));
        if (unnamed.length) issues.push(issue('info', 'Sin nombres: ' + unnamed.join(', ') + '.'));

        return issues.sort(function (a, b) { return RANK[a.level] - RANK[b.level]; });
    }

    PL.parseNum = parseNum;
    PL.parseTime = parseTime;
    PL.recompute = recompute;
    PL.periodScore = periodScore;
    PL.validate = validate;
})(window.PL);
