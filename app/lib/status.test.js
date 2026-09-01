import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cupoDisponible, puntosCupo, estadoClase, reservasFuturas, proximaReserva,
  estadoPaquete, paqueteVenceEnDias, estadoAsistenciaBadge,
  horasHastaClase, puedeApartar, puedeCancelar,
  siguienteNumeroValoracion, tieneValoraciones, inicialAvatar,
  agruparAsistenciasPorPaquete,
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

test('reservasFuturas ignora clases ya pasadas, incluso el mismo día, y ordena por fecha y hora', () => {
  const ahora = new Date(2026, 7, 11, 20, 0); // 11 de agosto de 2026, 8:00pm
  const reservas = [
    { claseId: 1, fecha: '2026-08-01', hora: '10:00:00' }, // pasada, otro día
    { claseId: 2, fecha: '2026-08-11', hora: '19:15:00' }, // hoy, ya pasó (7:15pm < 8:00pm)
    { claseId: 3, fecha: '2026-08-15', hora: '19:15:00' }, // futura
    { claseId: 4, fecha: '2026-08-11', hora: '21:00:00' }, // hoy, todavía no pasa
  ];
  assert.deepEqual(reservasFuturas(reservas, ahora), [reservas[3], reservas[2]]);
});

test('reservasFuturas regresa arreglo vacío sin reservas futuras', () => {
  const ahora = new Date(2026, 7, 11, 20, 0);
  assert.deepEqual(reservasFuturas([{ claseId: 1, fecha: '2026-01-01', hora: '10:00:00' }], ahora), []);
  assert.deepEqual(reservasFuturas([], ahora), []);
});

test('proximaReserva toma la más próxima futura', () => {
  const ahora = new Date(2026, 7, 5, 8, 0);
  const reservas = [
    { claseId: 1, fecha: '2026-08-01', hora: '10:00:00' },
    { claseId: 2, fecha: '2026-08-15', hora: '19:15:00' },
    { claseId: 3, fecha: '2026-08-11', hora: '10:00:00' },
  ];
  assert.deepEqual(proximaReserva(reservas, ahora), reservas[2]);
});

test('proximaReserva desempata por hora cuando la fecha es igual', () => {
  const ahora = new Date(2026, 7, 11, 6, 0);
  const reservas = [
    { claseId: 1, fecha: '2026-08-11', hora: '19:15:00' },
    { claseId: 2, fecha: '2026-08-11', hora: '10:00:00' },
  ];
  assert.deepEqual(proximaReserva(reservas, ahora), reservas[1]);
});

test('proximaReserva regresa null sin reservas futuras', () => {
  const ahora = new Date(2026, 7, 11, 20, 0);
  assert.equal(proximaReserva([{ claseId: 1, fecha: '2026-01-01', hora: '10:00:00' }], ahora), null);
  assert.equal(proximaReserva([], ahora), null);
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

test('agruparAsistenciasPorPaquete reparte asistencias por el rango de cada paquete, más reciente primero', () => {
  const paquetes = [
    { id: 1, fecha_pago: '2026-06-25' },
    { id: 2, fecha_pago: '2026-07-25' },
  ];
  const asistencias = [
    { id: 10, fecha: '2026-06-30' },
    { id: 11, fecha: '2026-07-10' },
    { id: 12, fecha: '2026-07-28' },
  ];
  const grupos = agruparAsistenciasPorPaquete(asistencias, paquetes);
  assert.deepEqual(grupos, [
    { paquete: paquetes[1], asistencias: [asistencias[2]] },
    { paquete: paquetes[0], asistencias: [asistencias[0], asistencias[1]] },
  ]);
});

test('agruparAsistenciasPorPaquete manda a "sin paquete" lo anterior al primer paquete', () => {
  const paquetes = [{ id: 1, fecha_pago: '2026-06-25' }];
  const asistencias = [
    { id: 9, fecha: '2026-06-01' },
    { id: 10, fecha: '2026-06-30' },
  ];
  const grupos = agruparAsistenciasPorPaquete(asistencias, paquetes);
  assert.deepEqual(grupos, [
    { paquete: paquetes[0], asistencias: [asistencias[1]] },
    { paquete: null, asistencias: [asistencias[0]] },
  ]);
});

test('agruparAsistenciasPorPaquete no agrega grupo "sin paquete" si no hay huérfanas', () => {
  const paquetes = [{ id: 1, fecha_pago: '2026-06-25' }];
  const asistencias = [{ id: 10, fecha: '2026-06-30' }];
  const grupos = agruparAsistenciasPorPaquete(asistencias, paquetes);
  assert.equal(grupos.length, 1);
});

test('agruparAsistenciasPorPaquete regresa arreglo vacío sin paquetes ni asistencias', () => {
  assert.deepEqual(agruparAsistenciasPorPaquete([], []), []);
});
