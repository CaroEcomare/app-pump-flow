import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cupoDisponible, puntosCupo, estadoClase, reservasFuturas, proximaReserva,
  estadoPaquete, paqueteVenceEnDias, estadoAsistenciaBadge,
  horasHastaClase, puedeApartar, puedeCancelar,
  siguienteNumeroValoracion, tieneValoraciones, inicialAvatar,
} from './status.js';

test('cupoDisponible resta ocupados del total, nunca negativo', () => {
  assert.equal(cupoDisponible(6, 3), 3);
  assert.equal(cupoDisponible(6, 6), 0);
  assert.equal(cupoDisponible(6, 8), 0);
});

test('puntosCupo marca los primeros N como ocupados', () => {
  assert.deepEqual(puntosCupo(6, 3), [true, true, true, false, false, false]);
  assert.deepEqual(puntosCupo(4, 0), [false, false, false, false]);
});

test('estadoClase distingue llena de disponible', () => {
  assert.equal(estadoClase(6, 6), 'llena');
  assert.equal(estadoClase(6, 5), 'disponible');
});

test('reservasFuturas ignora pasadas y ordena por fecha y hora', () => {
  const reservas = [
    { claseId: 1, fecha: '2026-08-01', hora: '10:00:00' },
    { claseId: 2, fecha: '2026-08-15', hora: '19:15:00' },
    { claseId: 3, fecha: '2026-08-11', hora: '19:15:00' },
    { claseId: 4, fecha: '2026-08-11', hora: '10:00:00' },
  ];
  assert.deepEqual(reservasFuturas(reservas, '2026-08-05'), [reservas[3], reservas[2], reservas[1]]);
});

test('reservasFuturas regresa arreglo vacío sin reservas futuras', () => {
  assert.deepEqual(reservasFuturas([{ claseId: 1, fecha: '2026-01-01', hora: '10:00:00' }], '2026-08-11'), []);
  assert.deepEqual(reservasFuturas([], '2026-08-11'), []);
});

test('proximaReserva toma la más próxima futura', () => {
  const reservas = [
    { claseId: 1, fecha: '2026-08-01', hora: '10:00:00' },
    { claseId: 2, fecha: '2026-08-15', hora: '19:15:00' },
    { claseId: 3, fecha: '2026-08-11', hora: '10:00:00' },
  ];
  assert.deepEqual(proximaReserva(reservas, '2026-08-05'), reservas[2]);
});

test('proximaReserva desempata por hora cuando la fecha es igual', () => {
  const reservas = [
    { claseId: 1, fecha: '2026-08-11', hora: '19:15:00' },
    { claseId: 2, fecha: '2026-08-11', hora: '10:00:00' },
  ];
  assert.deepEqual(proximaReserva(reservas, '2026-08-11'), reservas[1]);
});

test('proximaReserva regresa null sin reservas futuras', () => {
  assert.equal(proximaReserva([{ claseId: 1, fecha: '2026-01-01', hora: '10:00:00' }], '2026-08-11'), null);
  assert.equal(proximaReserva([], '2026-08-11'), null);
});

test('estadoPaquete distingue sin_paquete, al_dia y por_pagar', () => {
  assert.equal(estadoPaquete(null, '2026-08-11'), 'sin_paquete');
  assert.equal(estadoPaquete({ activo: false, vence: '2026-09-01' }, '2026-08-11'), 'sin_paquete');
  assert.equal(estadoPaquete({ activo: true, vence: '2026-09-01' }, '2026-08-11'), 'al_dia');
  assert.equal(estadoPaquete({ activo: true, vence: '2026-08-01' }, '2026-08-11'), 'por_pagar');
});

test('paqueteVenceEnDias detecta ventana de 7 días por default', () => {
  assert.equal(paqueteVenceEnDias({ activo: true, vence: '2026-08-15' }, '2026-08-11'), true);
  assert.equal(paqueteVenceEnDias({ activo: true, vence: '2026-08-25' }, '2026-08-11'), false);
  assert.equal(paqueteVenceEnDias({ activo: true, vence: '2026-08-05' }, '2026-08-11'), false);
  assert.equal(paqueteVenceEnDias(null, '2026-08-11'), false);
});

test('estadoAsistenciaBadge solo distingue confirmada de pendiente', () => {
  assert.equal(estadoAsistenciaBadge(null), 'pendiente');
  assert.equal(estadoAsistenciaBadge({ confirmada_admin: null }), 'pendiente');
  assert.equal(estadoAsistenciaBadge({ confirmada_admin: '2026-08-11T19:20:00Z' }), 'confirmada');
});

test('horasHastaClase calcula horas exactas hacia adelante y hacia atrás', () => {
  const ahora = new Date(2026, 7, 11, 18, 15);
  assert.equal(horasHastaClase('2026-08-11', '19:15:00', ahora), 1);
  assert.equal(horasHastaClase('2026-08-11', '17:15:00', ahora), -1);
  assert.equal(horasHastaClase('2026-08-12', '18:15:00', ahora), 24);
});

test('puedeApartar exige al menos 1 hora de anticipación', () => {
  const ahora = new Date(2026, 7, 11, 18, 15);
  assert.equal(puedeApartar('2026-08-11', '19:15:00', ahora), true);
  assert.equal(puedeApartar('2026-08-11', '19:00:00', ahora), false);
});

test('puedeCancelar exige al menos 12 horas de anticipación', () => {
  const ahora = new Date(2026, 7, 11, 6, 0);
  assert.equal(puedeCancelar('2026-08-11', '19:15:00', ahora), true);
  assert.equal(puedeCancelar('2026-08-11', '17:00:00', ahora), false);
});

test('siguienteNumeroValoracion empieza en 1 y sigue el máximo', () => {
  assert.equal(siguienteNumeroValoracion([]), 1);
  assert.equal(siguienteNumeroValoracion([{ numero: 1 }, { numero: 2 }]), 3);
});

test('tieneValoraciones', () => {
  assert.equal(tieneValoraciones([]), false);
  assert.equal(tieneValoraciones([{ numero: 1 }]), true);
});

test('inicialAvatar toma la primera letra en mayúscula', () => {
  assert.equal(inicialAvatar('mariana López'), 'M');
  assert.equal(inicialAvatar(''), '?');
});
