import test from 'node:test';
import assert from 'node:assert/strict';
import { escaparHTML } from './escape.js';

test('escaparHTML neutraliza etiquetas HTML', () => {
  assert.equal(
    escaparHTML('<img src=x onerror="alert(1)">'),
    '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
  );
});

test('escaparHTML escapa comillas simples y ampersands', () => {
  assert.equal(escaparHTML(`Ana & Sofía's`), 'Ana &amp; Sofía&#39;s');
});

test('escaparHTML devuelve cadena vacía para null y undefined', () => {
  assert.equal(escaparHTML(null), '');
  assert.equal(escaparHTML(undefined), '');
});

test('escaparHTML convierte números a texto sin cambiarlos', () => {
  assert.equal(escaparHTML(8), '8');
  assert.equal(escaparHTML(0), '0');
});

test('escaparHTML deja texto normal intacto', () => {
  assert.equal(escaparHTML('María Fernanda'), 'María Fernanda');
});
