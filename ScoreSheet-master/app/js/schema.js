/* Definición declarativa de las planillas.
 *
 * Este es el ÚNICO archivo que hay que tocar para añadir, quitar o cambiar un
 * deporte: el formulario, la hoja imprimible y la forma del estado se derivan
 * todos de aquí. No hay HTML ni lógica por deporte en ningún otro sitio.
 *
 * Un deporte = { id, label, title, meta: [campos], blocks: [bloques], signatures }
 *
 * Tipos de bloque:
 *   roster   lista de filas (competidores o plantilla de un equipo)
 *   periods  marcador por periodos (sets, cuartos, tiempos)
 *   notes    texto libre (incidencias, observaciones)
 *
 * Columnas de un roster: { key, label, type, size, align, sheetOnly, computed }
 *   size       xs | sm | md | lg   (ancho en el formulario)
 *   sheetOnly  no aparece en el formulario, sólo como celda de la hoja impresa
 *              (datos que se anotan durante la competencia, a mano)
 *   computed   la columna se calcula sola y se muestra bloqueada:
 *                { type: 'max',  from: ['i1', 'i2', ...] }
 *                { type: 'rank', by: 'mejor', order: 'desc' }
 *                { type: 'rank', by: 'tiempo', order: 'asc', parse: 'time' }
 *
 * Bloque periods:
 *   totalMode  'sum'  el marcador es la suma (goles por tiempo, puntos por cuarto)
 *              'wins' el marcador son periodos ganados (sets de voleibol)
 *
 * Cualquier bloque admite breakBefore: true para empezar en una página nueva.
 */

(function (PL) {
    'use strict';

    var GENEROS = ['Masculino', 'Femenino', 'Mixto'];

    // --- Fragmentos reutilizables (funciones: cada deporte recibe objetos nuevos) ---

    function fFecha() {
        return { key: 'fecha', label: 'Fecha', type: 'date', today: true };
    }

    function fCategoria() {
        return { key: 'categoria', label: 'Categoría', placeholder: 'Ej: Sub-15' };
    }

    function fSede() {
        return { key: 'sede', label: 'Sede', placeholder: 'Ej: Estadio Municipal' };
    }

    function fEquipos() {
        return [
            { key: 'local', label: 'Equipo local', placeholder: 'Nombre del equipo local' },
            { key: 'visitante', label: 'Equipo visitante', placeholder: 'Nombre del equipo visitante' }
        ];
    }

    function cNombre() {
        return { key: 'nombre', label: 'Nombre y apellidos', size: 'lg', align: 'left' };
    }

    function cDni() {
        return { key: 'dni', label: 'DNI', size: 'sm' };
    }

    function cIe() {
        return { key: 'ie', label: 'I.E.', size: 'md', align: 'left' };
    }

    function cPuesto(computed) {
        return { key: 'puesto', label: 'Puesto', size: 'xs', computed: computed };
    }

    function cObs() {
        return { key: 'obs', label: 'Observaciones', size: 'md', align: 'left' };
    }

    /** Plantilla de un equipo: dorsal + nombre + las columnas propias del deporte. */
    function plantilla(team, extraColumns, options) {
        var block = {
            type: 'roster',
            key: team === 'local' ? 'plantillaLocal' : 'plantillaVisitante',
            team: team,
            title: team === 'local' ? 'Plantilla local' : 'Plantilla visitante',
            addLabel: 'Añadir jugador',
            numbered: true,
            minRows: 12,
            columns: [
                { key: 'dorsal', label: 'Dorsal', type: 'number', size: 'xs' },
                cNombre()
            ].concat(extraColumns || [])
        };
        return Object.assign(block, options || {});
    }

    function marcador(key, title, unit, labels, totalMode) {
        return {
            type: 'periods',
            key: key,
            title: title,
            unit: unit,
            labels: labels,
            totalMode: totalMode || 'sum'
        };
    }

    // --- Deportes ---

    var SPORTS = [
        {
            id: 'salto',
            label: 'Atletismo · Salto',
            title: 'Planilla de salto',
            subtitleFrom: 'prueba',
            meta: [
                { key: 'prueba', label: 'Prueba', placeholder: 'Ej: Salto alto' },
                fCategoria(),
                { key: 'genero', label: 'Género', type: 'select', options: GENEROS },
                fSede(),
                fFecha()
            ],
            blocks: [
                {
                    type: 'roster',
                    key: 'competidores',
                    title: 'Competidores',
                    addLabel: 'Añadir competidor',
                    numbered: true,
                    minRows: 12,
                    columns: [
                        cNombre(),
                        cIe(),
                        { key: 'le', label: 'L.E.', size: 'sm' },
                        { key: 'altura', label: 'Altura inicial', size: 'sm' },
                        { key: 'saltometro', label: 'Medidas del saltómetro', size: 'md' },
                        { key: 'mejor', label: 'Mejor salto', size: 'sm' },
                        { key: 'nulo', label: 'Nulo', size: 'xs' },
                        cPuesto({ type: 'rank', by: 'mejor', order: 'desc' })
                    ]
                }
            ],
            signatures: ['Juez de prueba', 'Anotador', 'Delegado']
        },

        {
            id: 'carrera',
            label: 'Atletismo · Carrera',
            title: 'Planilla de carrera',
            subtitleFrom: 'prueba',
            meta: [
                { key: 'prueba', label: 'Prueba', placeholder: 'Ej: 100 m planos' },
                fCategoria(),
                { key: 'pista', label: 'Pista / serie', placeholder: 'Ej: Serie 1' },
                fSede(),
                fFecha()
            ],
            blocks: [
                {
                    type: 'roster',
                    key: 'competidores',
                    title: 'Competidores',
                    hint: 'Tiempo: 12.34, 1:02.5 o 1:02:03',
                    addLabel: 'Añadir competidor',
                    numbered: true,
                    minRows: 12,
                    columns: [
                        cNombre(),
                        cDni(),
                        cIe(),
                        { key: 'carril', label: 'Carril', size: 'xs' },
                        { key: 'tiempo', label: 'Tiempo', size: 'sm' },
                        cPuesto({ type: 'rank', by: 'tiempo', order: 'asc', parse: 'time' }),
                        cObs()
                    ]
                }
            ],
            signatures: ['Juez de llegada', 'Cronometrista', 'Anotador', 'Delegado']
        },

        {
            id: 'lanzamiento',
            label: 'Atletismo · Lanzamiento',
            title: 'Planilla de lanzamiento',
            subtitleFrom: 'prueba',
            meta: [
                { key: 'prueba', label: 'Prueba', placeholder: 'Ej: Lanzamiento de jabalina' },
                fCategoria(),
                { key: 'genero', label: 'Género', type: 'select', options: GENEROS },
                fSede(),
                fFecha()
            ],
            blocks: [
                {
                    type: 'roster',
                    key: 'competidores',
                    title: 'Competidores',
                    hint: 'La mejor marca y el puesto se calculan solos',
                    addLabel: 'Añadir competidor',
                    numbered: true,
                    minRows: 10,
                    columns: [
                        cNombre(),
                        cDni(),
                        cIe(),
                        { key: 'i1', label: '1', type: 'number', size: 'xs' },
                        { key: 'i2', label: '2', type: 'number', size: 'xs' },
                        { key: 'i3', label: '3', type: 'number', size: 'xs' },
                        { key: 'i4', label: '4', type: 'number', size: 'xs' },
                        { key: 'i5', label: '5', type: 'number', size: 'xs' },
                        { key: 'i6', label: '6', type: 'number', size: 'xs' },
                        {
                            key: 'mejor',
                            label: 'Mejor marca',
                            size: 'sm',
                            computed: { type: 'max', from: ['i1', 'i2', 'i3', 'i4', 'i5', 'i6'] }
                        },
                        cPuesto({ type: 'rank', by: 'mejor', order: 'desc' }),
                        { key: 'obs', label: 'Observaciones', size: 'md', align: 'left', sheetOnly: true }
                    ]
                }
            ],
            signatures: ['Juez de prueba', 'Anotador', 'Delegado']
        },

        {
            id: 'voleibol',
            label: 'Voleibol',
            title: 'Planilla de voleibol',
            subtitleFrom: 'torneo',
            teams: true,
            meta: [
                { key: 'torneo', label: 'Torneo', placeholder: 'Ej: Torneo interescolar' },
                fCategoria(),
                fSede(),
                fFecha()
            ].concat(fEquipos()),
            blocks: [
                // El marcador de voleibol son sets ganados, no puntos sumados.
                marcador('sets', 'Sets', 'Set', ['1', '2', '3', '4', '5'], 'wins'),
                plantilla('local', [{ key: 'obs', label: 'Observaciones', size: 'md', align: 'left', sheetOnly: true }]),
                plantilla('visitante', [{ key: 'obs', label: 'Observaciones', size: 'md', align: 'left', sheetOnly: true }]),
                { type: 'notes', key: 'incidencias', label: 'Incidencias', placeholder: 'Amonestaciones, cambios, tiempos técnicos...' }
            ],
            signatures: ['Árbitro principal', 'Árbitro auxiliar', 'Anotador', 'Delegado local', 'Delegado visitante']
        },

        {
            id: 'futbol',
            label: 'Fútbol',
            title: 'Planilla de fútbol',
            subtitleFrom: 'torneo',
            teams: true,
            meta: [
                { key: 'torneo', label: 'Torneo', placeholder: 'Ej: Campeonato intercolegial' },
                fCategoria(),
                fSede(),
                fFecha()
            ].concat(fEquipos()),
            blocks: [
                marcador('goles', 'Goles por tiempo', 'Tiempo', ['1.º T', '2.º T']),
                plantilla('local', [
                    { key: 'goles', label: 'Goles', size: 'xs', sheetOnly: true },
                    { key: 'ta', label: 'T.A.', size: 'xs', sheetOnly: true },
                    { key: 'tr', label: 'T.R.', size: 'xs', sheetOnly: true }
                ], { groups: [{ label: 'Titulares', rows: 11 }, { label: 'Suplentes', rows: 7 }] }),
                // 36 jugadores no caben en una A4 junto al resto: la visitante abre página.
                plantilla('visitante', [
                    { key: 'goles', label: 'Goles', size: 'xs', sheetOnly: true },
                    { key: 'ta', label: 'T.A.', size: 'xs', sheetOnly: true },
                    { key: 'tr', label: 'T.R.', size: 'xs', sheetOnly: true }
                ], { groups: [{ label: 'Titulares', rows: 11 }, { label: 'Suplentes', rows: 7 }], breakBefore: true }),
                { type: 'notes', key: 'incidencias', label: 'Incidencias', placeholder: 'Goles, tarjetas, cambios, lesiones...' }
            ],
            signatures: ['Árbitro principal', 'Asistente 1', 'Asistente 2', 'Delegado local', 'Delegado visitante']
        },

        {
            id: 'baloncesto',
            label: 'Baloncesto',
            title: 'Planilla de baloncesto',
            subtitleFrom: 'torneo',
            teams: true,
            meta: [
                { key: 'torneo', label: 'Torneo', placeholder: 'Ej: Liga escolar' },
                fCategoria(),
                fSede(),
                fFecha()
            ].concat(fEquipos()),
            blocks: [
                marcador('cuartos', 'Puntos por cuarto', 'Cuarto', ['1.º', '2.º', '3.º', '4.º']),
                plantilla('local', [
                    { key: 'puntos', label: 'Puntos', size: 'xs', sheetOnly: true },
                    { key: 'faltas', label: 'Faltas', size: 'xs', sheetOnly: true }
                ]),
                plantilla('visitante', [
                    { key: 'puntos', label: 'Puntos', size: 'xs', sheetOnly: true },
                    { key: 'faltas', label: 'Faltas', size: 'xs', sheetOnly: true }
                ]),
                { type: 'notes', key: 'incidencias', label: 'Incidencias', placeholder: 'Tiempos muertos, faltas técnicas, cambios...' }
            ],
            signatures: ['Árbitro principal', 'Árbitro auxiliar', 'Anotador', 'Cronometrista', 'Delegado']
        }
    ];

    // --- Consultas sobre el esquema ---

    function sportById(id) {
        for (var i = 0; i < SPORTS.length; i++) {
            if (SPORTS[i].id === id) return SPORTS[i];
        }
        return SPORTS[0];
    }

    function blocksOfType(sport, type) {
        return sport.blocks.filter(function (b) { return b.type === type; });
    }

    /** Filas mínimas de un roster: la suma de sus grupos, o minRows. */
    function minCount(block) {
        if (block.groups) {
            return block.groups.reduce(function (total, g) { return total + g.rows; }, 0);
        }
        return block.minRows || 10;
    }

    /**
     * Secuencia de filas a pintar: intercala las cabeceras de grupo
     * (titulares / suplentes) con los índices de fila.
     * Devuelve [{ group: 'Titulares' }, { index: 0 }, ...]
     */
    function layoutRows(block, count) {
        var out = [];
        var i = 0;

        if (block.groups) {
            block.groups.forEach(function (g) {
                out.push({ group: g.label });
                for (var k = 0; k < g.rows && i < count; k++, i++) out.push({ index: i });
            });
        }
        for (; i < count; i++) out.push({ index: i });

        return out;
    }

    function teamName(data, team) {
        var name = (data.meta[team] || '').trim();
        return name || (team === 'local' ? 'Equipo local' : 'Equipo visitante');
    }

    PL.sports = SPORTS;
    PL.sportById = sportById;
    PL.blocksOfType = blocksOfType;
    PL.minCount = minCount;
    PL.layoutRows = layoutRows;
    PL.teamName = teamName;
})(window.PL);
