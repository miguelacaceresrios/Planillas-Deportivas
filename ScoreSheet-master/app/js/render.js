/* Renderizado.
 *
 * Dos vistas del mismo estado: el formulario (editor) y la hoja (imprimible).
 * Las dos se generan recorriendo el esquema del deporte, así que nunca se
 * desincronizan y añadir un deporte no requiere tocar este archivo.
 *
 * Los campos equivalentes de ambas vistas comparten data-path, que es lo que
 * permite reflejar un cambio de un panel en el otro sin volver a dibujar nada.
 */

(function (PL) {
    'use strict';

    var h = PL.h;

    // Ancho de cada columna en el formulario y peso relativo en la hoja.
    var TRACK = { xs: '62px', sm: '92px', md: 'minmax(130px, 1fr)', lg: 'minmax(190px, 2fr)' };
    var WEIGHT = { xs: 1, sm: 1.6, md: 2.4, lg: 4 };

    var ORG_FALLBACK = 'Formatos oficiales para competencias';

    function track(col) { return TRACK[col.size] || TRACK.md; }
    function weight(col) { return WEIGHT[col.size] || WEIGHT.md; }

    function rosterTitle(block) {
        return block.team ? 'Plantilla · ' : block.title;
    }

    function teamNameSpan(team, data) {
        return h('span', { dataset: { teamName: team }, text: PL.teamName(data, team) });
    }

    function formatMeta(field, value) {
        if (field.type === 'date' && value) {
            var parts = value.split('-');
            if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
        }
        return value || '';
    }

    function shortDate(iso) {
        var d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
    }

    // ------------------------------------------------------- barra de planillas

    function renderSheetBar(sport, sheets, activeId) {
        var select = h('select', { class: 'input', dataset: { action: 'sheet-select' }, 'aria-label': 'Planilla guardada' },
            sheets.map(function (s) {
                return h('option', {
                    value: s.id,
                    selected: s.id === activeId,
                    text: s.name + ' · ' + shortDate(s.updatedAt)
                });
            }));

        var active = sheets.filter(function (s) { return s.id === activeId; })[0] || sheets[0];

        return PL.frag([
            h('span', { class: 'sheetbar-label', text: 'Planilla' }),
            select,
            h('input', {
                class: 'input',
                value: active.name,
                placeholder: 'Nombre',
                'aria-label': 'Nombre de la planilla',
                dataset: { action: 'sheet-rename' }
            }),
            h('div', { class: 'sheetbar-actions' }, [
                h('button', { class: 'btn small', type: 'button', text: '+ Nueva', dataset: { action: 'sheet-new' } }),
                h('button', { class: 'btn small', type: 'button', text: 'Ejemplo', title: 'Carga una planilla de muestra con datos inventados', dataset: { action: 'sheet-demo' } }),
                h('button', { class: 'btn small', type: 'button', text: 'Duplicar', dataset: { action: 'sheet-dup' } }),
                h('button', { class: 'btn small', type: 'button', text: 'Borrar', dataset: { action: 'sheet-del' } })
            ])
        ]);
    }

    // ---------------------------------------------------------------- formulario

    function fieldControl(field, value, path) {
        var id = 'f-' + path.replace(/\./g, '-');

        var control = field.type === 'select'
            ? h('select', { class: 'input', id: id, dataset: { path: path } },
                field.options.map(function (option) {
                    return h('option', { value: option, text: option, selected: option === value });
                }))
            : h('input', {
                class: 'input',
                id: id,
                type: field.type || 'text',
                placeholder: field.placeholder || '',
                value: value || '',
                dataset: { path: path }
            });

        return h('div', { class: 'field' }, [
            h('label', { for: id, text: field.label }),
            control
        ]);
    }

    /** Datos de la institución: se comparten entre todos los deportes. */
    function configForm(config) {
        return h('details', { class: 'block config' }, [
            h('summary', { text: 'Institución y logo' }),
            h('div', { class: 'field-grid' }, [
                h('div', { class: 'field' }, [
                    h('label', { for: 'f-institucion', text: 'Nombre de la institución' }),
                    h('input', {
                        class: 'input',
                        id: 'f-institucion',
                        value: config.institucion || '',
                        placeholder: 'Ej: I.E. José Carlos Mariátegui',
                        dataset: { config: 'institucion' }
                    })
                ]),
                h('div', { class: 'field' }, [
                    h('label', { text: 'Logo' }),
                    h('div', { class: 'logo-row' }, [
                        config.logo ? h('img', { class: 'logo-preview', src: config.logo, alt: 'Logo' }) : null,
                        h('button', { class: 'btn small', type: 'button', text: 'Elegir imagen', dataset: { action: 'logo-pick' } }),
                        config.logo ? h('button', { class: 'btn small ghost', type: 'button', text: 'Quitar', dataset: { action: 'logo-clear' } }) : null
                    ])
                ])
            ])
        ]);
    }

    function metaForm(sport, data) {
        return h('section', { class: 'block' }, [
            h('header', { class: 'block-head' }, [h('h3', { text: 'Datos generales' })]),
            h('div', { class: 'field-grid' }, sport.meta.map(function (field) {
                return fieldControl(field, data.meta[field.key], 'meta.' + field.key);
            }))
        ]);
    }

    function rosterForm(block, data) {
        var rows = data.rosters[block.key];
        var columns = block.columns.filter(function (col) { return !col.sheetOnly; });
        var hidden = block.columns.length - columns.length;

        var grid = h('div', {
            class: 'grid-table',
            style: { gridTemplateColumns: '30px ' + columns.map(track).join(' ') + ' 30px' }
        });

        grid.appendChild(h('div', { class: 'gt-head', text: 'N°' }));
        columns.forEach(function (col) { grid.appendChild(h('div', { class: 'gt-head', text: col.label })); });
        grid.appendChild(h('div', { class: 'gt-head' }));

        PL.layoutRows(block, rows.length).forEach(function (item) {
            if (item.group) {
                grid.appendChild(h('div', { class: 'gt-group', text: item.group }));
                return;
            }

            var i = item.index;
            grid.appendChild(h('div', { class: 'gt-num', text: String(i + 1) }));

            columns.forEach(function (col) {
                grid.appendChild(h('input', {
                    class: col.computed ? 'input computed' : 'input',
                    type: col.type || 'text',
                    value: rows[i][col.key] || '',
                    readOnly: !!col.computed,
                    tabIndex: col.computed ? -1 : null,
                    title: col.computed ? 'Se calcula solo' : null,
                    'aria-label': col.label + ', fila ' + (i + 1),
                    dataset: col.computed
                        ? { path: 'rosters.' + block.key + '.' + i + '.' + col.key, computed: '1' }
                        : { path: 'rosters.' + block.key + '.' + i + '.' + col.key }
                }));
            });

            grid.appendChild(h('button', {
                class: 'row-remove',
                type: 'button',
                text: '×',
                title: 'Quitar la fila (si es de las mínimas, sólo se vacía)',
                'aria-label': 'Quitar fila ' + (i + 1),
                dataset: { action: 'row-remove', block: block.key, index: String(i) }
            }));
        });

        var hint = block.hint || (hidden > 0 ? hidden + ' columnas más se rellenan en la planilla' : rows.length + ' filas');

        return h('section', { class: 'block' }, [
            h('header', { class: 'block-head' }, [
                h('h3', {}, [rosterTitle(block), block.team ? teamNameSpan(block.team, data) : null]),
                h('span', { class: 'hint', text: hint })
            ]),
            h('div', { class: 'scroll-x' }, [grid]),
            h('div', { class: 'block-foot' }, [
                h('button', {
                    class: 'btn small',
                    type: 'button',
                    text: '+ ' + (block.addLabel || 'Añadir fila'),
                    dataset: { action: 'row-add', block: block.key }
                }),
                h('button', {
                    class: 'btn small ghost',
                    type: 'button',
                    text: 'Plantilla CSV',
                    title: 'Descarga esta tabla en blanco para rellenarla en Excel y volver a importarla',
                    dataset: { action: 'roster-template', block: block.key }
                })
            ])
        ]);
    }

    function periodsForm(block, data) {
        var totalLabel = block.totalMode === 'wins' ? block.unit + 's' : 'Total';

        var header = h('div', { class: 'periods-row' }, [
            h('span', {}),
            h('div', { class: 'periods-inputs' }, block.labels.map(function (label) {
                return h('span', { class: 'gt-head', style: { width: '52px', textAlign: 'center' }, text: label });
            })),
            h('span', { class: 'gt-head', text: totalLabel })
        ]);

        var rows = ['local', 'visitante'].map(function (team) {
            return h('div', { class: 'periods-row' }, [
                h('span', { class: 'team-name' }, [teamNameSpan(team, data)]),
                h('div', { class: 'periods-inputs' }, block.labels.map(function (label, i) {
                    return h('input', {
                        class: 'input',
                        type: 'number',
                        min: '0',
                        value: data.periods[block.key][team][i] || '',
                        'aria-label': block.unit + ' ' + label + ', ' + team,
                        dataset: { path: 'periods.' + block.key + '.' + team + '.' + i }
                    });
                })),
                h('span', { class: 'periods-total', dataset: { score: block.key + '.' + team }, text: '0' })
            ]);
        });

        return h('section', { class: 'block' }, [
            h('header', { class: 'block-head' }, [
                h('h3', { text: block.title }),
                h('span', {
                    class: 'hint',
                    text: block.totalMode === 'wins' ? 'El marcador cuenta sets ganados' : 'El total se calcula solo'
                })
            ]),
            h('div', { class: 'periods-grid' }, [header].concat(rows))
        ]);
    }

    function notesForm(block, data) {
        return h('section', { class: 'block' }, [
            h('header', { class: 'block-head' }, [h('h3', { text: block.label })]),
            h('textarea', {
                class: 'input',
                rows: 4,
                placeholder: block.placeholder || '',
                value: data.notes[block.key] || '',
                'aria-label': block.label,
                dataset: { path: 'notes.' + block.key }
            })
        ]);
    }

    function renderForm(sport, data, config) {
        var sections = [configForm(config), metaForm(sport, data)];

        sport.blocks.forEach(function (block) {
            if (block.type === 'roster') sections.push(rosterForm(block, data));
            else if (block.type === 'periods') sections.push(periodsForm(block, data));
            else if (block.type === 'notes') sections.push(notesForm(block, data));
        });

        return PL.frag(sections);
    }

    // -------------------------------------------------------------- revisión

    /** Sólo cuentan como problemas los errores y avisos: lo pendiente es neutro. */
    function renderReview(issues) {
        var problems = issues.filter(function (item) { return item.level !== 'info'; });
        var shown = issues.slice(0, 12);

        return PL.frag([
            h('h3', {
                class: 'review-title',
                text: problems.length ? 'Revisión (' + problems.length + ')' : 'Revisión'
            }),
            problems.length ? null : h('div', { class: 'review-ok', text: 'Sin problemas.' }),
            shown.length
                ? h('ul', { class: 'review-list' }, shown.map(function (item) {
                    return h('li', { class: item.level, text: item.text });
                }))
                : null,
            issues.length > shown.length
                ? h('div', { class: 'hint', text: 'y ' + (issues.length - shown.length) + ' más' })
                : null
        ]);
    }

    // ------------------------------------------------------------------- hoja

    function sheetHead(sport, data, config) {
        var chips = sport.meta
            .filter(function (field) { return !(sport.teams && (field.key === 'local' || field.key === 'visitante')); })
            .map(function (field) {
                return h('div', {}, [
                    h('span', { class: 'label', text: field.label + ': ' }),
                    h('span', { class: 'value', dataset: { metaValue: field.key }, text: formatMeta(field, data.meta[field.key]) })
                ]);
            });

        return [
            h('header', { class: 'sheet-head' }, [
                config.logo ? h('img', { class: 'sheet-logo', src: config.logo, alt: '' }) : null,
                h('div', { class: 'sheet-headings' }, [
                    h('div', { class: 'sheet-org', dataset: { configValue: 'institucion' }, text: config.institucion || ORG_FALLBACK }),
                    h('div', { class: 'sheet-title', text: sport.title }),
                    h('div', { class: 'sheet-subtitle', dataset: { sheetSubtitle: sport.subtitleFrom }, text: data.meta[sport.subtitleFrom] || '' })
                ])
            ]),
            h('div', { class: 'sheet-meta' }, chips)
        ];
    }

    function scoreboard(sport, data) {
        var block = PL.blocksOfType(sport, 'periods')[0];
        if (!block) return null;

        return h('div', { class: 'scoreboard' }, [
            h('div', { class: 'side' }, [h('small', { text: 'Local' }), teamNameSpan('local', data)]),
            h('div', { class: 'result' }, [
                h('span', { dataset: { score: block.key + '.local' }, text: '0' }),
                ' – ',
                h('span', { dataset: { score: block.key + '.visitante' }, text: '0' })
            ]),
            h('div', { class: 'side away' }, [h('small', { text: 'Visitante' }), teamNameSpan('visitante', data)])
        ]);
    }

    function blockClass(block) {
        return block.breakBefore ? 'sheet-block break-before' : 'sheet-block';
    }

    function periodsSheet(block, data) {
        var head = h('tr', {}, [h('th', { text: block.unit })]
            .concat(block.labels.map(function (label) { return h('th', { text: label }); }))
            .concat([h('th', { text: 'Total' })]));

        var rows = ['local', 'visitante'].map(function (team) {
            var cells = [h('td', { class: 'team' }, [teamNameSpan(team, data)])];

            block.labels.forEach(function (label, i) {
                cells.push(h('td', {}, [h('input', {
                    type: 'number',
                    value: data.periods[block.key][team][i] || '',
                    'aria-label': block.unit + ' ' + label + ', ' + team,
                    dataset: { path: 'periods.' + block.key + '.' + team + '.' + i }
                })]));
            });

            cells.push(h('td', { class: 'total', dataset: { total: block.key + '.' + team }, text: '0' }));
            return h('tr', {}, cells);
        });

        return h('section', { class: blockClass(block) }, [
            h('h3', { text: block.title }),
            h('table', { class: 'planilla' }, [h('thead', {}, [head]), h('tbody', {}, rows)])
        ]);
    }

    function rosterSheet(block, data) {
        var rows = data.rosters[block.key];
        var columns = block.columns;
        var span = columns.length + (block.numbered ? 1 : 0);

        var weights = (block.numbered ? [0.7] : []).concat(columns.map(weight));
        var total = weights.reduce(function (a, b) { return a + b; }, 0);
        var cols = h('colgroup', {}, weights.map(function (w) {
            return h('col', { style: { width: (w / total * 100).toFixed(2) + '%' } });
        }));

        var head = h('tr', {}, (block.numbered ? [h('th', { text: 'N°' })] : [])
            .concat(columns.map(function (col) { return h('th', { text: col.label }); })));

        var body = [];
        PL.layoutRows(block, rows.length).forEach(function (item) {
            if (item.group) {
                body.push(h('tr', { class: 'group' }, [h('td', { colspan: span, text: item.group })]));
                return;
            }

            var i = item.index;
            var cells = block.numbered ? [h('td', { class: 'num', text: String(i + 1) })] : [];

            columns.forEach(function (col) {
                var classes = [];
                if (col.align === 'left') classes.push('left');
                if (col.computed) classes.push('computed');

                cells.push(h('td', {}, [h('input', {
                    class: classes.length ? classes.join(' ') : null,
                    type: col.type === 'number' ? 'number' : 'text',
                    value: rows[i][col.key] || '',
                    readOnly: !!col.computed,
                    tabIndex: col.computed ? -1 : null,
                    'aria-label': col.label + ', fila ' + (i + 1),
                    dataset: col.computed
                        ? { path: 'rosters.' + block.key + '.' + i + '.' + col.key, computed: '1' }
                        : { path: 'rosters.' + block.key + '.' + i + '.' + col.key }
                })]));
            });

            body.push(h('tr', {}, cells));
        });

        return h('section', { class: blockClass(block) }, [
            h('h3', {}, [rosterTitle(block), block.team ? teamNameSpan(block.team, data) : null]),
            h('table', { class: 'planilla' }, [cols, h('thead', {}, [head]), h('tbody', {}, body)])
        ]);
    }

    function notesSheet(block, data) {
        return h('section', { class: blockClass(block) }, [
            h('h3', { text: block.label }),
            h('textarea', {
                value: data.notes[block.key] || '',
                'aria-label': block.label,
                dataset: { path: 'notes.' + block.key }
            })
        ]);
    }

    function signatures(sport) {
        if (!sport.signatures || !sport.signatures.length) return null;
        return h('footer', { class: 'signatures' }, sport.signatures.map(function (role) {
            return h('div', { class: 'signature', text: role });
        }));
    }

    function renderSheet(sport, data, config) {
        var parts = sheetHead(sport, data, config);

        parts.push(scoreboard(sport, data));

        sport.blocks.forEach(function (block) {
            if (block.type === 'roster') parts.push(rosterSheet(block, data));
            else if (block.type === 'periods') parts.push(periodsSheet(block, data));
            else if (block.type === 'notes') parts.push(notesSheet(block, data));
        });

        parts.push(signatures(sport));
        return PL.frag(parts);
    }

    PL.renderForm = renderForm;
    PL.renderSheet = renderSheet;
    PL.renderSheetBar = renderSheetBar;
    PL.renderReview = renderReview;
    PL.formatMeta = formatMeta;
    PL.ORG_FALLBACK = ORG_FALLBACK;
})(window.PL);
