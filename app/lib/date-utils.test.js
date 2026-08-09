import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseFechaSQL, hoyISO, esHoy, formatHora12,
  formatDiaMes, formatDiaMesConDia, formatMesAno, formatFechaCompleta,
} from './date-utils.js';

test('parseFechaSQL construye la fecha local sin corrimiento UTC', () => {
  const fecha = parseFechaSQL('2026-08-11');
  assert.equal(fecha.getFullYear(), 2026);
  assert.equal(fecha.getMonth(), 7);
  assert.equal(fecha.getDate(), 11);
});

test('hoyISO da formato YYYY-MM-DD con ceros a la izquierda', () => {
  assert.equal(hoyISO(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(hoyISO(new Date(2026, 10, 25)), '2026-11-25');
});

test('esHoy compara solo año/mes/día', () => {
  const hoy = new Date(2026, 7, 11, 23, 59);
  assert.equal(esHoy('2026-08-11', hoy), true);
  assert.equal(esHoy('2026-08-12', hoy), false);
});

test('formatHora12 convierte horas de Postgres a 12h en minúsculas', () => {
  assert.equal(formatHora12('19:15:00'), '7:15 pm');
  assert.equal(formatHora12('10:00:00'), '10:00 am');
  assert.equal(formatHora12('00:00:00'), '12:00 am');
  assert.equal(formatHora12('12:00:00'), '12:00 pm');
});

test('formatDiaMes da día y mes sin año', () => {
  assert.equal(formatDiaMes('2026-08-11'), '11 de agosto');
});

test('formatDiaMesConDia agrega el nombre del día de la semana', () => {
  assert.equal(formatDiaMesConDia('2026-08-11'), 'martes 11 de agosto');
});

test('formatMesAno da mes y año', () => {
  assert.equal(formatMesAno('2026-03-14'), 'marzo de 2026');
});

test('formatFechaCompleta da día, mes y año', () => {
  assert.equal(formatFechaCompleta('2026-08-04'), '4 de agosto de 2026');
});
