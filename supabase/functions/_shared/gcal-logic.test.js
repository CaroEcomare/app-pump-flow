import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirResumenClaseMuestra,
  decidirAccionCalendario,
  construirRangoEvento,
} from './gcal-logic.js';

test('construirResumenClaseMuestra arma título en singular con 1 persona', () => {
  const { titulo } = construirResumenClaseMuestra([{ nombre: 'Ana', telefono: '4441234567' }]);
  assert.equal(titulo, 'Clase muestra · 1 persona');
});

test('construirResumenClaseMuestra arma título en plural con varias personas', () => {
  const { titulo } = construirResumenClaseMuestra([
    { nombre: 'Ana', telefono: '4441234567' },
    { nombre: 'Beto', telefono: '4449876543' },
  ]);
  assert.equal(titulo, 'Clase muestra · 2 personas');
});

test('construirResumenClaseMuestra lista nombre y teléfono, uno por línea', () => {
  const { descripcion } = construirResumenClaseMuestra([
    { nombre: 'Ana', telefono: '4441234567' },
    { nombre: 'Beto', telefono: null },
  ]);
  assert.equal(descripcion, 'Ana · 4441234567\nBeto');
});

test('decidirAccionCalendario crea cuando no hay evento y sí hay personas', () => {
  assert.equal(decidirAccionCalendario({ eventoExistente: null, cantidadPersonas: 1 }), 'crear');
});

test('decidirAccionCalendario actualiza cuando ya hay evento y sigue habiendo personas', () => {
  assert.equal(decidirAccionCalendario({ eventoExistente: 'abc123', cantidadPersonas: 2 }), 'actualizar');
});

test('decidirAccionCalendario borra cuando ya no queda nadie y había evento', () => {
  assert.equal(decidirAccionCalendario({ eventoExistente: 'abc123', cantidadPersonas: 0 }), 'borrar');
});

test('decidirAccionCalendario no hace nada si nunca hubo evento y ya no hay personas', () => {
  assert.equal(decidirAccionCalendario({ eventoExistente: null, cantidadPersonas: 0 }), 'ninguna');
});

test('construirRangoEvento arma inicio y fin (1 hora después) como texto sin zona horaria', () => {
  const { inicio, fin } = construirRangoEvento('2026-09-15', '18:15:00');
  assert.equal(inicio, '2026-09-15T18:15:00');
  assert.equal(fin, '2026-09-15T19:15:00');
});

test('construirRangoEvento cruza la medianoche si la hora + 1 pasa de las 24:00', () => {
  const { inicio, fin } = construirRangoEvento('2026-09-15', '23:40:00');
  assert.equal(inicio, '2026-09-15T23:40:00');
  assert.equal(fin, '2026-09-16T00:40:00');
});
