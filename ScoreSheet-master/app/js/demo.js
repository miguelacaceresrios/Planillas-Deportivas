/* Datos de ejemplo.
 *
 * Quien abre la aplicación por primera vez se encuentra un formulario vacío y
 * no entiende qué hace. Un clic en "Ejemplo" carga una planilla realista.
 *
 * Todos los nombres, instituciones y DNI son INVENTADOS. La aplicación maneja
 * datos de menores de edad, así que aquí nunca debe entrar nada real.
 *
 * Los datos pasan por Store.importSheet(), o sea por hydrate(), igual que un
 * archivo importado: no hay una segunda puerta de entrada al estado.
 */

(function (PL) {
    'use strict';

    /** Filas como arrays posicionales: mucho menos ruido que treinta objetos. */
    function rows(keys, table) {
        return table.map(function (values) {
            var row = {};
            keys.forEach(function (key, i) {
                row[key] = values[i] === undefined ? '' : String(values[i]);
            });
            return row;
        });
    }

    var JUGADOR = ['dorsal', 'nombre'];

    var DEMO = {
        salto: {
            meta: { prueba: 'Salto alto', categoria: 'Sub-15', genero: 'Femenino', sede: 'Coliseo Municipal' },
            rosters: {
                competidores: rows(['nombre', 'ie', 'le', 'altura', 'saltometro', 'mejor', 'nulo'], [
                    ['Lucía Ramos Vega', 'I.E. San Martín', 'LE-104', '1.20', '1.20 / 1.25 / 1.30', '1.30', '1'],
                    ['Camila Ortiz Núñez', 'I.E. Los Andes', 'LE-118', '1.20', '1.20 / 1.25 / 1.35', '1.35', '2'],
                    ['Valeria Chávez Soto', 'I.E. San Martín', 'LE-127', '1.25', '1.25 / 1.30', '1.30', '0'],
                    ['Daniela Flores Ríos', 'I.E. Bolognesi', 'LE-133', '1.25', '1.25 / 1.30 / 1.40', '1.40', '1'],
                    ['Ariana Quispe Mena', 'I.E. Los Andes', 'LE-141', '1.20', '1.20 / 1.25', '1.25', '2'],
                    ['Fátima León Paredes', 'I.E. Bolognesi', 'LE-150', '1.30', '1.30 / 1.35', '1.35', '1']
                ])
            }
        },

        carrera: {
            meta: { prueba: '100 m planos', categoria: 'Sub-17', pista: 'Serie 1', sede: 'Estadio Municipal' },
            rosters: {
                competidores: rows(['nombre', 'dni', 'ie', 'carril', 'tiempo', 'obs'], [
                    ['Diego Salazar Ruiz', '70000011', 'I.E. San Martín', '3', '11.84', ''],
                    ['Mateo Herrera Lazo', '70000012', 'I.E. Los Andes', '4', '11.62', ''],
                    ['Sebastián Pardo Gil', '70000013', 'I.E. Bolognesi', '5', '12.07', ''],
                    ['Joaquín Medina Cruz', '70000014', 'I.E. San Martín', '2', '12.35', ''],
                    ['Rodrigo Vargas Peña', '70000015', 'I.E. Los Andes', '6', '11.95', ''],
                    ['Iván Castro Moreno', '70000016', 'I.E. Bolognesi', '7', '', 'No se presentó']
                ])
            }
        },

        lanzamiento: {
            meta: { prueba: 'Lanzamiento de bala', categoria: 'Sub-17', genero: 'Masculino', sede: 'Estadio Municipal' },
            rosters: {
                competidores: rows(['nombre', 'dni', 'ie', 'i1', 'i2', 'i3', 'i4', 'i5', 'i6'], [
                    ['Adrián Rojas Campos', '70000021', 'I.E. San Martín', '9.40', '9.85', '10.12', '9.90', '10.05', '9.75'],
                    ['Bruno Aguilar Tello', '70000022', 'I.E. Los Andes', '10.30', '10.55', '10.10', '10.80', '10.45', '10.60'],
                    ['Nicolás Ibáñez Cruz', '70000023', 'I.E. Bolognesi', '8.95', '9.20', '9.05', '9.35', '9.10', '9.25'],
                    ['Tomás Guerrero Díaz', '70000024', 'I.E. San Martín', '10.05', '9.80', '10.25', '10.15', '9.95', '10.20'],
                    ['Emilio Navarro Solís', '70000025', 'I.E. Los Andes', '9.60', '9.45', '9.70', '9.55', '9.65', '9.50']
                ])
            }
        },

        voleibol: {
            meta: {
                torneo: 'Torneo Interescolar 2026', categoria: 'Sub-17', sede: 'Coliseo Municipal',
                local: 'I.E. San Martín', visitante: 'I.E. Los Andes'
            },
            periods: { sets: { local: ['25', '23', '25', '25'], visitante: ['21', '25', '18', '22'] } },
            rosters: {
                plantillaLocal: rows(JUGADOR, [
                    [1, 'Ana Belén Torres'], [3, 'Mariana Ccopa Luna'], [5, 'Rocío Delgado Vidal'],
                    [7, 'Paula Escalante Ruiz'], [9, 'Sofía Bermúdez Alva'], [11, 'Katia Zúñiga Ponce'],
                    [13, 'Gabriela Ninanya Cruz'], [15, 'Renata Ojeda Farfán']
                ]),
                plantillaVisitante: rows(JUGADOR, [
                    [2, 'Milagros Ayala Roque'], [4, 'Jimena Barreto Silva'], [6, 'Alexia Cordero Lino'],
                    [8, 'Naomi Huamán Prado'], [10, 'Thalía Requena Vílchez'], [12, 'Andrea Sifuentes Mora'],
                    [14, 'Brenda Tapia Quiroz'], [16, 'Carla Ugarte Bendezú']
                ])
            }
        },

        futbol: {
            meta: {
                torneo: 'Campeonato Intercolegial 2026', categoria: 'Sub-16', sede: 'Estadio Municipal',
                local: 'I.E. San Martín', visitante: 'I.E. Bolognesi'
            },
            periods: { goles: { local: ['1', '2'], visitante: ['1', '0'] } },
            notes: {
                incidencias: 'Min. 23 gol de Ramírez (local). Min. 38 gol de Peña (visitante). ' +
                    'Min. 57 y 71 goles de Alarcón (local). Min. 64 amarilla a Peña por reclamo.'
            },
            rosters: {
                plantillaLocal: rows(['dorsal', 'nombre', 'goles', 'ta'], [
                    [1, 'Kevin Salcedo Rivas'], [2, 'Álvaro Ttito Mamani'], [3, 'Piero Lazo Carrión'],
                    [4, 'Jhon Ramírez Osorio', '1'], [5, 'César Alarcón Mejía', '2'], [6, 'Luis Pacheco Rondán'],
                    [7, 'Marco Zevallos Tinoco'], [8, 'Erick Palomino Ávila'], [9, 'Frank Cárdenas Loayza'],
                    [10, 'Gustavo Meza Arroyo'], [11, 'Bryan Sulca Huertas']
                ]),
                plantillaVisitante: rows(['dorsal', 'nombre', 'goles', 'ta'], [
                    [1, 'Óscar Benites Farro'], [2, 'Renzo Cabrera Núñez'], [3, 'Jean Peña Morales', '1', '1'],
                    [4, 'Hugo Trujillo Vera'], [5, 'Ramiro Cueva Espinoza'], [6, 'Axel Quiroga Baca'],
                    [7, 'Dylan Velásquez Ríos'], [8, 'Nelson Ríos Camacho'], [9, 'Julio Ascue Ttupa'],
                    [10, 'Fabio Lengua Zárate'], [11, 'Aldo Grados Chumpitaz']
                ])
            }
        },

        baloncesto: {
            meta: {
                torneo: 'Liga Escolar 2026', categoria: 'Sub-14', sede: 'Coliseo Municipal',
                local: 'I.E. Los Andes', visitante: 'I.E. Bolognesi'
            },
            periods: { cuartos: { local: ['14', '12', '18', '15'], visitante: ['11', '16', '13', '14'] } },
            rosters: {
                plantillaLocal: rows(['dorsal', 'nombre', 'puntos', 'faltas'], [
                    [4, 'Santiago Ames Rivera', '12', '2'], [5, 'Leonardo Bustos Gala', '9', '1'],
                    [6, 'Ignacio Chacón Peralta', '15', '3'], [7, 'Rafael Durán Cossío', '8', '0'],
                    [8, 'Martín Espejo Yauri', '6', '2'], [9, 'Pablo Figueroa Tapia', '4', '1'],
                    [10, 'Álex Gonzales Mamani', '5', '2'], [11, 'Cristian Huapaya León', '0', '0']
                ]),
                plantillaVisitante: rows(['dorsal', 'nombre', 'puntos', 'faltas'], [
                    [3, 'Diego Iparraguirre Sosa', '10', '3'], [6, 'Fernando Jara Cornejo', '14', '2'],
                    [8, 'Gonzalo Rivas Ramos', '7', '1'], [9, 'Héctor Linares Bravo', '11', '4'],
                    [10, 'Ismael Manrique Oré', '6', '2'], [12, 'Jorge Núñez Aliaga', '4', '0'],
                    [14, 'Kenyi Olaya Serna', '2', '1'], [15, 'Luis Prado Villena', '0', '0']
                ])
            }
        }
    };

    /** Datos de ejemplo de un deporte, o null si no los tiene. */
    PL.demoData = function (sportId) {
        return DEMO[sportId] || null;
    };
})(window.PL);
