# Cuentas manuales, flujo de reservas v2 e Inicio rediseñado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el spec en `docs/superpowers/specs/2026-08-11-cuentas-reservas-v2-design.md`: login con usuario o correo, alta manual de cuentas desde admin, lenguaje "Alumnado", el nuevo ciclo de vida de reservas (apartar → cancelar hasta 12h antes → confirmar o auto-descuento tras la clase), ventana de reserva de 7 días / 1 hora antes, ajuste manual de clases usadas, e Inicio de alumna rediseñado con "Contáctame" y "Súmate a la comunidad".

**Architecture:** Continúa exactamente la arquitectura ya en producción (`docs/superpowers/plans/2026-08-08-conectar-supabase.md`): HTML/CSS/JS plano sin build, Supabase vía CDN ESM, lógica pura en `app/lib/` con `node --test`, capa de datos delgada en `app/data.js`. Este plan es un delta sobre archivos ya existentes, no un proyecto nuevo.

**Tech Stack:** El mismo ya establecido — HTML5, CSS3, JS ESM nativo, `@supabase/supabase-js@2`, Node.js v22 para pruebas locales, Supabase (Postgres + Auth + RLS).

## Global Constraints

- No romper ninguna de las 25 pruebas existentes en `app/lib/*.test.js` salvo las que este plan modifica explícitamente (las de `estadoAsistenciaBadge`), y siempre reemplazándolas por pruebas nuevas equivalentes, nunca borrándolas sin más.
- Todas las fechas de Postgres se siguen parseando con `parseFechaSQL`/`hoyISO` de `app/lib/date-utils.js`, nunca con `new Date(fechaISO)` directo.
- Todo texto que venga de la base de datos y se inserte en `innerHTML` debe pasar por `escaparHTML` de `app/lib/escape.js` (ver la política ya establecida en el código existente).
- Errores de Supabase en botones/formularios se muestran con `mostrarErrorCerca` de `app/ui.js`, nunca `alert()` salvo que el elemento no soporte `insertAdjacentElement` (comportamiento ya existente de `mostrarErrorCerca`, no cambiar).
- El cliente temporal para crear cuentas manuales (Tarea 4) DEBE crearse con `{ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }` — sin esto, crear la cuenta de alguien más desde el navegador de Caro reemplazaría su propia sesión guardada.
- El SQL de este plan (Tarea 1) se agrega AL FINAL de `supabase/actualizaciones.sql` — nunca se borra ni se reescribe lo que ya hay ahí, porque es un archivo que Caro pega completo en el SQL Editor de Supabase cada vez que hay cambios.
- No se ejecuta el SQL contra ninguna base de datos real desde aquí — no hay credenciales de servidor, solo la llave pública. Correrlo es un paso manual de Caro (Tarea 10), igual que siempre.
- Además del SQL, Caro debe desactivar "Confirm email" en el dashboard de Supabase (Authentication → Providers → Email) — esto NO se puede hacer por SQL ni por código, es un toggle de configuración. Documentarlo claramente en la Tarea 10.

---

## Mapa de archivos

```
app-pump-flow/
├── index.html                (Tarea 6) login "correo o usuario", quita mensaje de confirmar correo,
│                                       agrega diálogo de cuenta manual, botón "+ Nueva cuenta",
│                                       "Alumnado", rediseño de #a-inicio, quita tip del día
├── app/
│   ├── supabase-client.js    (Tarea 5) agrega crearClienteTemporal()
│   ├── data.js                (Tarea 3) username en selects, cancelarReserva, procesarAsistenciasPasadas,
│   │                                   resolverCorreoPorUsuario, actualizarClasesUsadas, crearAlumnaManual,
│   │                                   se quita hacerCheckin
│   ├── auth.js                (Tarea 4) iniciarSesionConIdentificador (usuario o correo)
│   ├── alumna.js               (Tarea 8) quita check-in, agrega "tus próximas reservas" con cancelar,
│   │                                    ventana de 7 días / 1 hora en Clases, botones de contacto
│   ├── admin.js                (Tarea 9) quita "sin check-in", ajuste manual de clases usadas,
│   │                                    alta manual de cuentas, lenguaje "Alumnado"
│   ├── app.js                  (Tarea 10) procesarAsistenciasPasadas en el arranque, login con
│   │                                     identificador, registro con auto-login
│   └── lib/
│       ├── status.js           (Tarea 2) reservasFuturas, horasHastaClase, puedeApartar, puedeCancelar,
│       │                                estadoAsistenciaBadge simplificado
│       └── status.test.js      (Tarea 2)
└── supabase/
    └── actualizaciones.sql     (Tarea 1) username, correo_de_usuario(), procesar_asistencias_pasadas()
```

---

### Task 1: SQL — usuario/contraseña, resolver correo, auto-procesar asistencias pasadas

**Contexto para quien implemente:** al igual que con el SQL anterior, esto no se ejecuta desde aquí — se agrega al archivo `supabase/actualizaciones.sql` (que ya existe con contenido previo) y Caro lo corre ella misma en el SQL Editor de Supabase. Además del SQL, hay un paso de configuración que Caro debe hacer a mano en el dashboard (desactivar "Confirm email"), documentado en la Tarea 10, no en SQL.

**Files:**
- Modify: `supabase/actualizaciones.sql` (agregar al final, sin tocar lo que ya existe)

**Interfaces:**
- Produces: columna `alumnas.username`; función RPC `correo_de_usuario(nombre_usuario text) returns text` (para `authenticated` y `anon`, ya que se llama antes de iniciar sesión); función RPC `procesar_asistencias_pasadas()` (para `authenticated`).

- [ ] **Step 1: Agregar al final de `supabase/actualizaciones.sql`**

```sql

-- ============================================
-- Cuentas creadas por Caro con usuario y contraseña (sin correo real)
-- ============================================
-- Para alumnado que Caro da de alta ella misma, sin depender de que
-- tengan o revisen un correo. El login acepta correo O usuario.
alter table alumnas add column if not exists username text unique;

-- Resuelve el correo interno asociado a un usuario, para poder iniciar
-- sesión con nombre de usuario en vez de correo. Solo expone el correo
-- de ESE usuario puntual, nada más de la tabla. Se ejecuta antes de
-- iniciar sesión, por eso "anon" también necesita permiso.
create or replace function correo_de_usuario(nombre_usuario text)
returns text language sql security definer stable set search_path = public as $$
  select email from auth.users where id = (
    select id from alumnas where username = nombre_usuario
  );
$$;

grant execute on function correo_de_usuario(text) to anon, authenticated;

-- ============================================
-- Auto-confirma asistencia de clases que ya pasaron y nadie resolvió
-- ============================================
-- Si nadie canceló su lugar y Caro no confirmó su asistencia, en cuanto
-- la clase ya pasó de hora se cuenta como tomada (se descuenta igual el
-- paquete, vía el trigger que ya existe, trg_descuenta_ins). Se llama
-- sola cada vez que alguien abre la app, igual que generar_clases().
create or replace function procesar_asistencias_pasadas()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into asistencias (alumna_id, clase_id, confirmada_admin)
  select r.alumna_id, r.clase_id, now()
  from reservas r
  join clases c on c.id = r.clase_id
  join horarios h on h.id = c.horario_id
  where (c.fecha + h.hora) < now()
    and not exists (
      select 1 from asistencias a
      where a.alumna_id = r.alumna_id and a.clase_id = r.clase_id
    )
  on conflict (alumna_id, clase_id) do nothing;
end;
$$;

grant execute on function procesar_asistencias_pasadas() to authenticated;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/actualizaciones.sql
git commit -m "feat: SQL para usuario/contraseña, resolver correo y auto-procesar asistencias pasadas"
```

---

### Task 2: `app/lib/status.js` — nuevas reglas puras (ventana de reserva, badge simplificado)

**Files:**
- Modify: `app/lib/status.js`
- Modify: `app/lib/status.test.js`

**Interfaces:**
- Produces (nuevas o cambiadas):
  - `reservasFuturas(reservas: {claseId,fecha,hora}[], hoyISOStr: string) => {claseId,fecha,hora}[]` (ordenadas, todas las futuras — antes solo existía `proximaReserva` que regresaba una)
  - `proximaReserva(...)` — ahora implementada sobre `reservasFuturas`, mismo comportamiento externo que antes
  - `horasHastaClase(fecha: string, hora: string, ahora?: Date) => number` (puede ser negativo si ya pasó)
  - `puedeApartar(fecha, hora, ahora?) => boolean` (true si faltan 1 hora o más)
  - `puedeCancelar(fecha, hora, ahora?) => boolean` (true si faltan 12 horas o más)
  - `estadoAsistenciaBadge(asistencia) => 'confirmada' | 'pendiente'` — **cambio de comportamiento**: ya no existe `'sin_checkin'` (el check-in de la alumna desaparece en este plan). Ahora es binario: confirmada por la admin, o pendiente.
- Sin cambios: `cupoDisponible`, `puntosCupo`, `estadoClase`, `estadoPaquete`, `paqueteVenceEnDias`, `siguienteNumeroValoracion`, `tieneValoraciones`, `inicialAvatar`.
- Consumido por: `app/data.js` no depende de esto; `app/alumna.js` (Tarea 8) y `app/admin.js` (Tarea 9) sí.

- [ ] **Step 1: Reemplazar `app/lib/status.test.js` completo**

```js
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
```

- [ ] **Step 2: Correr las pruebas y confirmar que fallan**

Run: `npm test`
Expected: FAIL — `reservasFuturas`, `horasHastaClase`, `puedeApartar`, `puedeCancelar` no existen todavía; la prueba de `estadoAsistenciaBadge` falla contra la implementación vieja de 3 estados.

- [ ] **Step 3: Reemplazar `app/lib/status.js` completo**

```js
import { parseFechaSQL } from './date-utils.js';

export function cupoDisponible(cupoTotal, reservasCount) {
  return Math.max(0, cupoTotal - reservasCount);
}

export function puntosCupo(cupoTotal, reservasCount) {
  const ocupados = Math.min(reservasCount, cupoTotal);
  return Array.from({ length: cupoTotal }, (_, i) => i < ocupados);
}

export function estadoClase(cupoTotal, reservasCount) {
  return reservasCount >= cupoTotal ? 'llena' : 'disponible';
}

export function reservasFuturas(reservas, hoyISOStr) {
  return reservas
    .filter((r) => r.fecha >= hoyISOStr)
    .sort((a, b) => (a.fecha === b.fecha
      ? a.hora.localeCompare(b.hora)
      : a.fecha.localeCompare(b.fecha)));
}

export function proximaReserva(reservas, hoyISOStr) {
  return reservasFuturas(reservas, hoyISOStr)[0] ?? null;
}

export function estadoPaquete(paquete, hoyISOStr) {
  if (!paquete || !paquete.activo) return 'sin_paquete';
  if (paquete.vence && paquete.vence < hoyISOStr) return 'por_pagar';
  return 'al_dia';
}

export function paqueteVenceEnDias(paquete, hoyISOStr, dias = 7) {
  if (!paquete || !paquete.activo || !paquete.vence) return false;
  const hoy = parseFechaSQL(hoyISOStr);
  const vence = parseFechaSQL(paquete.vence);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + dias);
  return vence >= hoy && vence <= limite;
}

export function estadoAsistenciaBadge(asistencia) {
  return asistencia?.confirmada_admin ? 'confirmada' : 'pendiente';
}

export function horasHastaClase(fecha, hora, ahora = new Date()) {
  const [h, m] = hora.split(':').map(Number);
  const inicio = parseFechaSQL(fecha);
  inicio.setHours(h, m, 0, 0);
  return (inicio.getTime() - ahora.getTime()) / (1000 * 60 * 60);
}

export function puedeApartar(fecha, hora, ahora = new Date()) {
  return horasHastaClase(fecha, hora, ahora) >= 1;
}

export function puedeCancelar(fecha, hora, ahora = new Date()) {
  return horasHastaClase(fecha, hora, ahora) >= 12;
}

export function siguienteNumeroValoracion(valoraciones) {
  if (!valoraciones.length) return 1;
  return Math.max(...valoraciones.map((v) => v.numero)) + 1;
}

export function tieneValoraciones(valoraciones) {
  return valoraciones.length > 0;
}

export function inicialAvatar(nombre) {
  return (nombre?.trim()?.[0] ?? '?').toUpperCase();
}
```

- [ ] **Step 4: Correr las pruebas y confirmar que pasan**

Run: `npm test`
Expected: PASS — todas las pruebas de `app/lib/` (las de `date-utils.js` y `escape.js` sin cambios, más las nuevas/actualizadas de `status.js`).

- [ ] **Step 5: Commit**

```bash
git add app/lib/status.js app/lib/status.test.js
git commit -m "feat: reservasFuturas, ventana de reserva (1h/12h) y badge de asistencia simplificado"
```

---

### Task 3: `app/data.js` — cancelar, procesar pasadas, resolver usuario, ajustar clases, alta manual

**Files:**
- Modify: `app/data.js`

**Interfaces:**
- Consumes: nada nuevo de otros módulos (sigue recibiendo `supabase`/cliente como primer argumento en cada función).
- Produces (nuevas):
  - `cancelarReserva(supabase, alumnaId, claseId) => Promise<void>`
  - `procesarAsistenciasPasadas(supabase) => Promise<void>` (RPC)
  - `resolverCorreoPorUsuario(supabase, username) => Promise<string | null>` (RPC)
  - `actualizarClasesUsadas(supabase, paqueteId, clasesUsadas) => Promise<void>`
  - `crearAlumnaManual(clienteTemporal, {nombre, username, contrasena, telefono, plataforma}) => Promise<void>`
- Cambia:
  - `crearPerfilAlumna(supabase, {id, nombre, telefono, plataforma, username?}) => Promise<void>` — ahora acepta `username` opcional.
  - `obtenerPerfil`, `obtenerPerfilOpcional`, `listarAlumnas` — el `select` ahora incluye `username`.
- Se elimina: `hacerCheckin` (ya no hay check-in de la alumna en este plan).
- Consumido por: `app/auth.js` (Tarea 4), `app/alumna.js` (Tarea 8), `app/admin.js` (Tarea 9).

- [ ] **Step 1: Reemplazar `app/data.js` completo**

```js
import { hoyISO } from './lib/date-utils.js';

export async function crearPerfilAlumna(supabase, { id, nombre, telefono, plataforma, username }) {
  const { error } = await supabase
    .from('alumnas')
    .insert({ id, nombre, telefono, plataforma, username: username ?? null });
  if (error) throw error;
}

export async function obtenerPerfil(supabase, userId) {
  const { data, error } = await supabase
    .from('alumnas')
    .select('id, nombre, telefono, es_admin, fecha_alta, plataforma, username')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function obtenerPerfilOpcional(supabase, userId) {
  const { data, error } = await supabase
    .from('alumnas')
    .select('id, nombre, telefono, es_admin, fecha_alta, plataforma, username')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listarClasesProximas(supabase, semanas = 4) {
  const hoy = hoyISO();
  const limite = new Date();
  limite.setDate(limite.getDate() + semanas * 7);
  const { data, error } = await supabase
    .from('clases')
    .select('id, fecha, cupo, horario_id, horarios(hora), reservas(id)')
    .eq('cancelada', false)
    .gte('fecha', hoy)
    .lte('fecha', hoyISO(limite))
    .order('fecha', { ascending: true });
  if (error) throw error;
  return data.map((c) => ({ ...c, reservasCount: c.reservas.length }));
}

export async function obtenerMisReservas(supabase, alumnaId) {
  const { data, error } = await supabase
    .from('reservas')
    .select('id, clase_id, clases(fecha, horarios(hora))')
    .eq('alumna_id', alumnaId);
  if (error) throw error;
  return data.map((r) => ({
    reservaId: r.id,
    claseId: r.clase_id,
    fecha: r.clases.fecha,
    hora: r.clases.horarios.hora,
  }));
}

export async function apartarLugar(supabase, alumnaId, claseId) {
  const { error } = await supabase.from('reservas').insert({ alumna_id: alumnaId, clase_id: claseId });
  if (error) throw error;
}

export async function cancelarReserva(supabase, alumnaId, claseId) {
  const { error } = await supabase
    .from('reservas')
    .delete()
    .eq('alumna_id', alumnaId)
    .eq('clase_id', claseId);
  if (error) throw error;
}

export async function obtenerPaqueteActivo(supabase, alumnaId) {
  const { data, error } = await supabase
    .from('paquetes')
    .select('*')
    .eq('alumna_id', alumnaId)
    .eq('activo', true)
    .order('fecha_pago', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function actualizarClasesUsadas(supabase, paqueteId, clasesUsadas) {
  const { error } = await supabase.from('paquetes').update({ clases_usadas: clasesUsadas }).eq('id', paqueteId);
  if (error) throw error;
}

export async function obtenerMisAsistencias(supabase, alumnaId) {
  const { data, error } = await supabase
    .from('asistencias')
    .select('id, clase_id, checkin_alumna, confirmada_admin, clases(fecha, horarios(hora))')
    .eq('alumna_id', alumnaId)
    .order('id', { ascending: false });
  if (error) throw error;
  return data.map((a) => ({
    id: a.id,
    claseId: a.clase_id,
    checkinAlumna: a.checkin_alumna,
    confirmadaAdmin: a.confirmada_admin,
    fecha: a.clases.fecha,
    hora: a.clases.horarios.hora,
  }));
}

export async function listarAlumnas(supabase) {
  const { data, error } = await supabase
    .from('alumnas')
    .select('id, nombre, telefono, fecha_alta, es_admin, plataforma, username')
    .order('nombre', { ascending: true });
  if (error) throw error;
  return data;
}

// Consultas en bloque para la vista de admin: una sola petición para
// todas las alumnas, en vez de una por alumna.
export async function listarPaquetesActivos(supabase) {
  const { data, error } = await supabase
    .from('paquetes')
    .select('*')
    .eq('activo', true)
    .order('fecha_pago', { ascending: false });
  if (error) throw error;
  return data;
}

export async function listarAlumnaIdsConValoracion(supabase) {
  const { data, error } = await supabase.from('valoraciones').select('alumna_id');
  if (error) throw error;
  return data.map((v) => v.alumna_id);
}

// Devuelve TODAS las clases de hoy (normalmente una, pero nada impide
// activar dos horarios el mismo día; con .maybeSingle() eso tumbaba
// la pantalla completa de la admin).
export async function listarClasesDeHoy(supabase) {
  const { data, error } = await supabase
    .from('clases')
    .select('id, fecha, horarios(hora)')
    .eq('fecha', hoyISO())
    .eq('cancelada', false)
    .order('id', { ascending: true });
  if (error) throw error;
  return data;
}

export async function listarReservasDeClase(supabase, claseId) {
  const [{ data: reservas, error: e1 }, { data: asistencias, error: e2 }] = await Promise.all([
    supabase.from('reservas').select('id, alumna_id, alumnas(nombre, plataforma)').eq('clase_id', claseId),
    supabase.from('asistencias').select('alumna_id, checkin_alumna, confirmada_admin').eq('clase_id', claseId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const asistenciaPorAlumna = new Map(asistencias.map((a) => [a.alumna_id, a]));
  return reservas.map((r) => ({
    alumnaId: r.alumna_id,
    nombre: r.alumnas.nombre,
    plataforma: r.alumnas.plataforma,
    asistencia: asistenciaPorAlumna.get(r.alumna_id) ?? null,
  }));
}

export async function confirmarAsistencia(supabase, alumnaId, claseId) {
  const { error } = await supabase
    .from('asistencias')
    .upsert(
      { alumna_id: alumnaId, clase_id: claseId, confirmada_admin: new Date().toISOString() },
      { onConflict: 'alumna_id,clase_id' },
    );
  if (error) throw error;
}

export async function listarValoraciones(supabase, alumnaId) {
  const { data, error } = await supabase
    .from('valoraciones')
    .select('*')
    .eq('alumna_id', alumnaId)
    .order('numero', { ascending: false });
  if (error) throw error;
  return data;
}

export async function crearValoracion(supabase, alumnaId, campos, numero) {
  const { error } = await supabase.from('valoraciones').insert({ alumna_id: alumnaId, numero, ...campos });
  if (error) throw error;
}

export async function obtenerFichaAlumna(supabase, alumnaId) {
  const [alumna, paquete, valoraciones, asistencias] = await Promise.all([
    obtenerPerfil(supabase, alumnaId),
    obtenerPaqueteActivo(supabase, alumnaId),
    listarValoraciones(supabase, alumnaId),
    obtenerMisAsistencias(supabase, alumnaId),
  ]);
  return { alumna, paquete, valoraciones, asistencias };
}

export async function activarPaquete(supabase, alumnaId, { tipo, clasesTotales, monto, formaPago, fechaPago, vence }) {
  const paqueteAnterior = await obtenerPaqueteActivo(supabase, alumnaId);
  if (paqueteAnterior) {
    const { error } = await supabase.from('paquetes').update({ activo: false }).eq('id', paqueteAnterior.id);
    if (error) throw error;
  }
  const { error } = await supabase.from('paquetes').insert({
    alumna_id: alumnaId,
    tipo,
    clases_totales: clasesTotales,
    clases_usadas: 0,
    monto,
    forma_pago: formaPago,
    fecha_pago: fechaPago,
    vence,
    activo: true,
  });
  if (error) throw error;
}

export async function generarClases(supabase) {
  const { error } = await supabase.rpc('generar_clases');
  if (error) throw error;
}

export async function procesarAsistenciasPasadas(supabase) {
  const { error } = await supabase.rpc('procesar_asistencias_pasadas');
  if (error) throw error;
}

export async function resolverCorreoPorUsuario(supabase, username) {
  const { data, error } = await supabase.rpc('correo_de_usuario', { nombre_usuario: username });
  if (error) throw error;
  return data;
}

// clienteTemporal debe ser un cliente de Supabase creado con
// { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
// (ver crearClienteTemporal en supabase-client.js), para no reemplazar la
// sesión de quien está creando la cuenta (normalmente la administradora).
export async function crearAlumnaManual(clienteTemporal, { nombre, username, contrasena, telefono, plataforma }) {
  const correoInterno = `${username}@alumnado.pumpflow.app`;
  const { data, error } = await clienteTemporal.auth.signUp({
    email: correoInterno,
    password: contrasena,
    options: { data: { nombre, telefono, plataforma, username } },
  });
  if (error) throw error;
  await crearPerfilAlumna(clienteTemporal, { id: data.user.id, nombre, telefono, plataforma, username });
}
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check app/data.js`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add app/data.js
git commit -m "feat: cancelar reserva, procesar asistencias pasadas, login por usuario y alta manual"
```

---

### Task 4: `app/supabase-client.js` — cliente temporal para altas manuales

**Files:**
- Modify: `app/supabase-client.js`

**Interfaces:**
- Produces: `crearClienteTemporal() => SupabaseClient` (misma URL/llave que el cliente principal, pero sin persistir sesión en `localStorage`).
- Consumido por: `app/admin.js` (Tarea 9).

- [ ] **Step 1: Reemplazar `app/supabase-client.js` completo**

```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://euhltloldxnbjbizmwze.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_e7ynsWO1oaQj58lDg1zuQg_DT8aCKB9';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cliente aislado para crear la cuenta de alguien más (ej. la admin dando
// de alta a una alumna) sin tocar la sesión ya guardada en este navegador.
// persistSession/detectSessionInUrl en false evitan que pise el localStorage
// de la sesión activa de quien lo usa.
export function crearClienteTemporal() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check app/supabase-client.js`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add app/supabase-client.js
git commit -m "feat: cliente temporal aislado para altas manuales de cuentas"
```

---

### Task 5: `app/auth.js` — login con usuario o correo

**Files:**
- Modify: `app/auth.js`

**Interfaces:**
- Consumes: `resolverCorreoPorUsuario` de `app/data.js` (Tarea 3).
- Produces (nueva): `iniciarSesionConIdentificador({identificador, contrasena}) => Promise<{user, session}>` — si `identificador` contiene `@` se usa como correo directo; si no, se resuelve como usuario primero. Si el usuario no existe, lanza un error genérico (no confirma ni niega qué usuarios existen).
- Sin cambios: `registrar`, `iniciarSesion`, `cerrarSesion`, `obtenerSesionActual`, `asegurarPerfil`.
- Consumido por: `app/app.js` (Tarea 10).

- [ ] **Step 1: Reemplazar `app/auth.js` completo**

```js
import { supabase } from './supabase-client.js';
import { crearPerfilAlumna, obtenerPerfil, obtenerPerfilOpcional, resolverCorreoPorUsuario } from './data.js';

export async function registrar({ correo, contrasena, nombre, telefono, plataforma }) {
  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: contrasena,
    options: { data: { nombre, telefono, plataforma } },
  });
  if (error) throw error;
  return data;
}

export async function iniciarSesion({ correo, contrasena }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena });
  if (error) throw error;
  return data;
}

export async function iniciarSesionConIdentificador({ identificador, contrasena }) {
  let correo = identificador;
  if (!identificador.includes('@')) {
    correo = await resolverCorreoPorUsuario(supabase, identificador);
    if (!correo) throw new Error('Usuario o contraseña incorrectos');
  }
  return iniciarSesion({ correo, contrasena });
}

export async function cerrarSesion() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function obtenerSesionActual() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function asegurarPerfil(user) {
  let perfil = await obtenerPerfilOpcional(supabase, user.id);
  if (!perfil) {
    await crearPerfilAlumna(supabase, {
      id: user.id,
      nombre: user.user_metadata?.nombre ?? '',
      telefono: user.user_metadata?.telefono ?? '',
      plataforma: user.user_metadata?.plataforma ?? 'no',
    });
    perfil = await obtenerPerfil(supabase, user.id);
  }
  return perfil;
}
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check app/auth.js`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add app/auth.js
git commit -m "feat: iniciar sesión con usuario o correo"
```

---

### Task 6: `index.html` — login "correo o usuario", Alumnado, Inicio rediseñado, alta manual

**Contexto para quien implemente:** varios cambios puntuales sobre el archivo ya existente, no una reescritura completa. Sigue exactamente los `old_string`/`new_string` de cada step, en orden, sobre el `index.html` actual del repo.

**Files:**
- Modify: `index.html`

**Interfaces:**
- Produces (IDs nuevos que las tareas 8 y 9 usan): `#login-identificador` (reemplaza a `#login-correo`), `#a-inicio-mis-reservas`, `#dialog-alumna-manual` + `#dialog-alumna-manual-body`, `#btn-nueva-alumna-manual`.
- Elimina: `#registro-exito` (ya no aplica, el registro entra directo).

- [ ] **Step 1: Renombrar el campo de login a "Correo o usuario"**

Reemplazar:
```html
  <form id="form-login" class="card" style="width:100%;max-width:340px;margin-top:16px">
    <label class="field"><span>Correo</span><input class="input" type="email" id="login-correo" required></label>
    <label class="field"><span>Contraseña</span><input class="input" type="password" id="login-contrasena" required minlength="6"></label>
    <div id="login-error" class="badge err" style="display:none;margin-top:10px"></div>
    <button class="pillbtn" type="submit" style="width:100%;margin-top:14px">Entrar</button>
  </form>
```
por:
```html
  <form id="form-login" class="card" style="width:100%;max-width:340px;margin-top:16px">
    <label class="field"><span>Correo o usuario</span><input class="input" type="text" id="login-identificador" required></label>
    <label class="field"><span>Contraseña</span><input class="input" type="password" id="login-contrasena" required minlength="6"></label>
    <div id="login-error" class="badge err" style="display:none;margin-top:10px"></div>
    <button class="pillbtn" type="submit" style="width:100%;margin-top:14px">Entrar</button>
  </form>
```

- [ ] **Step 2: Quitar el mensaje de "revisa tu correo" (ya no aplica, el registro entra directo)**

Reemplazar:
```html
    <div id="registro-error" class="badge err" style="display:none;margin-top:10px"></div>
    <div id="registro-exito" class="muted" style="display:none;margin-top:10px">Te mandamos un correo para confirmar tu cuenta. Ábrelo y luego inicia sesión aquí 🤍</div>
    <button class="pillbtn" type="submit" style="width:100%;margin-top:14px">Crear cuenta</button>
```
por:
```html
    <div id="registro-error" class="badge err" style="display:none;margin-top:10px"></div>
    <button class="pillbtn" type="submit" style="width:100%;margin-top:14px">Crear cuenta</button>
```

- [ ] **Step 3: Rediseñar `#a-inicio` — quitar el tip del día, agregar "tus próximas reservas" y los botones de contacto**

Reemplazar:
```html
  <div class="screen active" id="a-inicio">
    <img src="assets/logo-morado.png" alt="Pump&Flow" style="height:50px">
    <h1 id="a-inicio-saludo">Hola 🤍</h1>
    <div id="a-inicio-proxima-clase"></div>
    <div id="a-inicio-paquete"></div>
    <div class="card">
      <b style="color:var(--text-title)">Tip de hoy ✨</b>
      <div style="font:var(--text-small);margin-top:6px">Antes de tu apnea, exhala todo el aire con calma. Tu diafragma trabaja mejor sin prisa.</div>
    </div>
  </div>
```
por:
```html
  <div class="screen active" id="a-inicio">
    <img src="assets/logo-morado.png" alt="Pump&Flow" style="height:50px">
    <h1 id="a-inicio-saludo">Hola 🤍</h1>
    <div id="a-inicio-proxima-clase"></div>
    <div id="a-inicio-mis-reservas"></div>
    <div id="a-inicio-paquete"></div>
    <a class="pillbtn soft" style="width:100%;margin-top:14px;text-align:center;text-decoration:none;display:block;box-sizing:border-box" href="https://wa.me/524431331146?text=Hola%20Caro%20%F0%9F%A4%8D" target="_blank">Contáctame</a>
    <a class="pillbtn" style="width:100%;margin-top:10px;text-align:center;text-decoration:none;display:block;box-sizing:border-box" href="https://chat.whatsapp.com/L3UWcyfbMScFiHUd9fhu5h?s=cl&p=i&ilr=0" target="_blank">Súmate a la comunidad</a>
  </div>
```

- [ ] **Step 4: Renombrar "Alumnas" a "Alumnado" y agregar el botón de alta manual**

Reemplazar:
```html
  <div class="screen" id="d-alumnas">
    <h1>Alumnas</h1>
    <div id="d-alumnas-lista"></div>
  </div>
```
por:
```html
  <div class="screen" id="d-alumnas">
    <div class="row"><h1>Alumnado</h1><button class="pillbtn soft" id="btn-nueva-alumna-manual" style="padding:7px 16px;min-height:36px;font-size:13px">+ Nueva cuenta</button></div>
    <div id="d-alumnas-lista"></div>
  </div>
```

- [ ] **Step 5: Renombrar la pestaña "Alumnas" del tabbar de admin**

Reemplazar:
```html
    <button class="tab" data-s="d-alumnas"><i data-lucide="users" class="ico"></i>Alumnas</button>
```
por:
```html
    <button class="tab" data-s="d-alumnas"><i data-lucide="users" class="ico"></i>Alumnado</button>
```

- [ ] **Step 6: Agregar el diálogo de alta manual, junto a los otros dos diálogos**

Reemplazar:
```html
<dialog id="dialog-valoracion"><div class="dialog-body" id="dialog-valoracion-body"></div></dialog>
<dialog id="dialog-paquete"><div class="dialog-body" id="dialog-paquete-body"></div></dialog>
```
por:
```html
<dialog id="dialog-valoracion"><div class="dialog-body" id="dialog-valoracion-body"></div></dialog>
<dialog id="dialog-paquete"><div class="dialog-body" id="dialog-paquete-body"></div></dialog>
<dialog id="dialog-alumna-manual"><div class="dialog-body" id="dialog-alumna-manual-body"></div></dialog>
```

- [ ] **Step 7: Verificación no-visual con curl**

```bash
npx --yes http-server -p 8080 . & sleep 2
curl -s http://localhost:8080/ | grep -o 'login-identificador\|a-inicio-mis-reservas\|dialog-alumna-manual\|btn-nueva-alumna-manual'
kill %1
```
Expected: los 4 IDs aparecen en el output.

- [ ] **Step 8: Commit**

```bash
git add index.html
git commit -m "feat: login con usuario o correo, Alumnado, Inicio rediseñado, alta manual"
```

---

### Task 7: `app/styles.css` — sin cambios necesarios, verificar

**Contexto:** revisando las clases usadas en las Tareas 6, 8 y 9 (`.pillbtn`, `.pillbtn.soft`, `.card`, `.badge`, `.field`, `.input`, `.link-suave`, `.row`, `.dato`), todas ya existen en `app/styles.css` de un plan anterior. Esta tarea es solo de verificación, no debería requerir cambios.

**Files:**
- Ninguno (verificación).

- [ ] **Step 1: Confirmar que no falta ninguna clase**

Run: `grep -o '\.pillbtn\|\.card\|\.badge\|\.field\|\.input\|\.link-suave\|\.row\|\.dato' app/styles.css | sort -u`
Expected: las 8 clases aparecen listadas.

- [ ] **Step 2: Si falta alguna (no debería), agregarla siguiendo el mismo patrón visual del resto del archivo, y hacer commit. Si no falta ninguna, no hay commit en esta tarea.**

---

### Task 8: `app/alumna.js` — quita check-in, agrega cancelar y ventana de reserva

**Files:**
- Modify: `app/alumna.js`

**Interfaces:**
- Consumes: de `app/data.js` (Tarea 3) — `listarClasesProximas`, `obtenerMisReservas`, `apartarLugar`, `cancelarReserva`, `obtenerPaqueteActivo`, `obtenerMisAsistencias` (ya NO `hacerCheckin`, se eliminó); de `app/lib/status.js` (Tarea 2) — `reservasFuturas`, `proximaReserva`, `estadoPaquete`, `estadoAsistenciaBadge`, `puntosCupo`, `estadoClase`, `cupoDisponible`, `puedeApartar`, `puedeCancelar`.
- Produces: `montarVistaAlumna({supabase, alumnaId, nombre, onCerrarSesion}) => Promise<void>` — misma firma que antes.
- Consumido por: `app/app.js` (Tarea 10).

- [ ] **Step 1: Reemplazar `app/alumna.js` completo**

```js
import {
  listarClasesProximas, obtenerMisReservas, apartarLugar, cancelarReserva,
  obtenerPaqueteActivo, obtenerMisAsistencias,
} from './data.js';
import { hoyISO, esHoy, formatHora12, formatDiaMesConDia } from './lib/date-utils.js';
import {
  reservasFuturas, proximaReserva, estadoPaquete, estadoAsistenciaBadge,
  puntosCupo, estadoClase, cupoDisponible, puedeApartar, puedeCancelar,
} from './lib/status.js';
import { escaparHTML } from './lib/escape.js';
import { wireTabs, mostrarErrorCerca } from './ui.js';

const SEMANAS_PARA_RESERVAR = 1;

export async function montarVistaAlumna({ supabase, alumnaId, nombre, onCerrarSesion }) {
  const primerNombre = (nombre ?? '').trim().split(' ')[0] || 'aquí';
  document.getElementById('a-inicio-saludo').textContent = `Hola, ${primerNombre} 🤍`;

  wireTabs('pantalla-alumna');
  wireLogout('a-espacio', onCerrarSesion);

  await Promise.all([
    renderInicio(supabase, alumnaId),
    renderClases(supabase, alumnaId),
    renderEspacio(supabase, alumnaId),
  ]);
}

async function renderInicio(supabase, alumnaId) {
  const [reservas, paquete] = await Promise.all([
    obtenerMisReservas(supabase, alumnaId),
    obtenerPaqueteActivo(supabase, alumnaId),
  ]);
  const proxima = proximaReserva(reservas, hoyISO());
  const contProxima = document.getElementById('a-inicio-proxima-clase');
  const contPaquete = document.getElementById('a-inicio-paquete');

  if (!proxima) {
    contProxima.innerHTML = `
      <div class="card" style="background:var(--pf-lavanda);color:#fff">
        <b style="font:var(--text-h3)">Aún no tienes clase apartada</b>
        <div style="font:var(--text-small);margin:6px 0 12px">Ve a "Clases" y aparta tu espacio para tu próxima sesión.</div>
      </div>`;
  } else {
    const hoy = esHoy(proxima.fecha);
    contProxima.innerHTML = `
      <div class="card" style="background:var(--pf-lavanda);color:#fff">
        <div class="row"><b style="font:var(--text-h3)">Hipopresivos grupal</b><span class="badge" style="background:#fff">${hoy ? 'Hoy' : escaparHTML(formatDiaMesConDia(proxima.fecha))} ${escaparHTML(formatHora12(proxima.hora))}</span></div>
        <div style="font:var(--text-small);color:#fff;margin:6px 0 12px">Presencial</div>
      </div>`;
  }

  await renderMisReservas(supabase, alumnaId);

  const estado = estadoPaquete(paquete, hoyISO());
  contPaquete.innerHTML = renderTarjetaPaquete(paquete, estado);
}

async function renderMisReservas(supabase, alumnaId) {
  const reservas = await obtenerMisReservas(supabase, alumnaId);
  const futuras = reservasFuturas(reservas, hoyISO());
  const cont = document.getElementById('a-inicio-mis-reservas');

  if (futuras.length === 0) {
    cont.innerHTML = '';
    return;
  }

  cont.innerHTML = `
    <div class="card">
      <b style="color:var(--text-title)">Tus próximas reservas</b>
      ${futuras.map((r) => {
        const puedeCancelarEsta = puedeCancelar(r.fecha, r.hora);
        return `
          <div class="dato">
            <span>${escaparHTML(formatDiaMesConDia(r.fecha))} · ${escaparHTML(formatHora12(r.hora))}</span>
            ${puedeCancelarEsta
              ? `<button class="pillbtn soft cancelar-reserva" data-clase-id="${escaparHTML(r.claseId)}" style="padding:7px 16px;min-height:36px;font-size:13px">No podré asistir</button>`
              : ''}
          </div>`;
      }).join('')}
      <div class="muted" style="margin-top:8px">Puedes cancelar hasta 12 horas antes de tu clase</div>
    </div>`;

  cont.querySelectorAll('.cancelar-reserva').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await cancelarReserva(supabase, alumnaId, Number(btn.dataset.claseId));
        await Promise.all([renderInicio(supabase, alumnaId), renderClases(supabase, alumnaId)]);
      } catch (err) {
        btn.disabled = false;
        mostrarErrorCerca(btn, `No se pudo cancelar: ${err.message}`);
      }
    });
  });
}

async function renderClases(supabase, alumnaId) {
  const [clases, reservas] = await Promise.all([
    listarClasesProximas(supabase, SEMANAS_PARA_RESERVAR),
    obtenerMisReservas(supabase, alumnaId),
  ]);
  const idsReservados = new Set(reservas.map((r) => r.claseId));
  const cont = document.getElementById('a-clases-lista');
  cont.innerHTML = clases.map((c) => {
    const yaReservada = idsReservados.has(c.id);
    const estado = estadoClase(c.cupo, c.reservasCount);
    const puntos = puntosCupo(c.cupo, c.reservasCount)
      .map((ocupado) => `<i class="cupo ${ocupado ? '' : 'libre'}"></i>`).join('');
    const disponibles = cupoDisponible(c.cupo, c.reservasCount);
    const dentroDeVentana = puedeApartar(c.fecha, c.horarios.hora);
    let boton;
    if (yaReservada) {
      boton = `<button class="pillbtn soft" style="width:100%" disabled>Tu lugar está apartado ✨</button>`;
    } else if (estado === 'llena') {
      boton = `<button class="pillbtn soft" style="width:100%" disabled>Sin lugares</button>`;
    } else if (!dentroDeVentana) {
      const mensaje = encodeURIComponent(`Hola Caro, quiero checar disponibilidad para la clase del ${formatDiaMesConDia(c.fecha)} a las ${formatHora12(c.horarios.hora)} 🤍`);
      boton = `<a class="pillbtn soft" style="width:100%;text-align:center;text-decoration:none;display:block;box-sizing:border-box" href="https://wa.me/524431331146?text=${mensaje}" target="_blank">Mándame mensaje para verificar disponibilidad</a>`;
    } else {
      boton = `<button class="pillbtn" style="width:100%" data-clase-id="${escaparHTML(c.id)}">Aparto mi espacio</button>`;
    }
    return `
      <div class="card" style="${estado === 'llena' && !yaReservada ? 'opacity:.6' : ''}">
        <div class="row"><b style="color:var(--text-title)">${escaparHTML(formatDiaMesConDia(c.fecha))}</b>
          <span class="badge ${estado === 'llena' ? 'err' : ''}">${estado === 'llena' ? 'Llena' : escaparHTML(formatHora12(c.horarios.hora))}</span></div>
        <div class="cupos">${puntos}</div>
        <div class="muted" style="margin:6px 0 12px">${estado === 'llena' ? 'Sin lugares' : `${disponibles} lugar${disponibles === 1 ? '' : 'es'} disponible${disponibles === 1 ? '' : 's'}`}</div>
        ${boton}
      </div>`;
  }).join('') || '<div class="muted">Aún no hay clases programadas, vuelve pronto 🤍</div>';

  cont.querySelectorAll('button[data-clase-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await apartarLugar(supabase, alumnaId, Number(btn.dataset.claseId));
        await Promise.all([renderClases(supabase, alumnaId), renderInicio(supabase, alumnaId)]);
      } catch (err) {
        btn.disabled = false;
        const yaLlena = /llena/i.test(err.message);
        mostrarErrorCerca(btn, yaLlena ? 'Esta clase ya está llena, elige otro horario 🤍' : `No se pudo apartar tu lugar: ${err.message}`);
      }
    });
  });
}

async function renderEspacio(supabase, alumnaId) {
  const [paquete, asistencias] = await Promise.all([
    obtenerPaqueteActivo(supabase, alumnaId),
    obtenerMisAsistencias(supabase, alumnaId),
  ]);
  const estado = estadoPaquete(paquete, hoyISO());
  document.getElementById('a-espacio-paquete').innerHTML = `<div class="card">${renderDatosPaquete(paquete, estado)}</div>`;
  document.getElementById('a-espacio-asistencias').innerHTML = `
    <div class="card">
      <b style="color:var(--text-title)">Tus asistencias</b>
      ${asistencias.length === 0 ? '<div class="muted" style="margin-top:8px">Aún no tienes asistencias registradas</div>' : asistencias.map((a) => {
        const badge = estadoAsistenciaBadge({ confirmada_admin: a.confirmadaAdmin });
        const texto = badge === 'confirmada' ? 'Confirmada' : 'Pendiente';
        const clase = badge === 'confirmada' ? 'ok' : 'warn';
        return `<div class="dato"><span>${escaparHTML(formatDiaMesConDia(a.fecha))} · ${escaparHTML(formatHora12(a.hora))}</span><span class="badge ${clase}">${texto}</span></div>`;
      }).join('')}
    </div>`;
}

function renderTarjetaPaquete(paquete, estado) {
  if (estado === 'sin_paquete') {
    return `<div class="card"><b style="color:var(--text-title)">Tu paquete</b><div class="muted" style="margin-top:8px">Aún no tienes un paquete activo. Pregúntale a Caro para activarlo.</div></div>`;
  }
  const restantes = paquete.clases_totales - paquete.clases_usadas;
  const porcentaje = Math.round((restantes / paquete.clases_totales) * 100);
  return `
    <div class="card">
      <div class="row"><b style="color:var(--text-title)">Tu paquete</b><span class="badge">Quedan ${escaparHTML(restantes)} de ${escaparHTML(paquete.clases_totales)}</span></div>
      <div class="prog"><i style="width:${Number(porcentaje) || 0}%"></i></div>
      <div class="muted" style="margin-top:8px">${paquete.vence ? `Tu siguiente pago es el ${escaparHTML(formatDiaMesConDia(paquete.vence))}` : ''}</div>
    </div>`;
}

function renderDatosPaquete(paquete, estado) {
  if (estado === 'sin_paquete') {
    return `<b style="color:var(--text-title)">Tu paquete</b><div class="muted" style="margin-top:8px">Aún no tienes un paquete activo.</div>`;
  }
  return `
    <b style="color:var(--text-title)">Tu paquete</b>
    <div class="dato"><span>Clases restantes</span><b>${escaparHTML(paquete.clases_totales - paquete.clases_usadas)} de ${escaparHTML(paquete.clases_totales)}</b></div>
    <div class="dato"><span>Último pago</span><b>${paquete.monto ? `$${escaparHTML(paquete.monto)} · ` : ''}${paquete.fecha_pago ? escaparHTML(formatDiaMesConDia(paquete.fecha_pago)) : '—'}</b></div>
    <div class="dato"><span>Siguiente pago</span><b>${paquete.vence ? escaparHTML(formatDiaMesConDia(paquete.vence)) : '—'}</b></div>
    <div class="dato"><span>Forma de pago</span><b>${paquete.forma_pago ? escaparHTML(paquete.forma_pago) : '—'}</b></div>`;
}

function wireLogout(screenId, onCerrarSesion) {
  if (!onCerrarSesion) return;
  document.getElementById(screenId).querySelector('.btn-logout')?.addEventListener('click', onCerrarSesion);
}
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check app/alumna.js`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add app/alumna.js
git commit -m "feat: quita check-in, agrega cancelar reserva y ventana de 7 días / 1 hora"
```

---

### Task 9: `app/admin.js` — quita "sin check-in", ajuste manual de clases, alta manual, Alumnado

**Files:**
- Modify: `app/admin.js`

**Interfaces:**
- Consumes: de `app/data.js` (Tarea 3) — todo lo que ya usaba, más `actualizarClasesUsadas`, `crearAlumnaManual`; de `app/supabase-client.js` (Tarea 4) — `crearClienteTemporal`; de `app/lib/status.js` (Tarea 2) — `estadoAsistenciaBadge` (ahora binario, ya no hay rama `sin_checkin`).
- Produces: `montarVistaAdmin({supabase, onCerrarSesion}) => Promise<void>` — misma firma que antes.
- Consumido por: `app/app.js` (Tarea 10).

- [ ] **Step 1: Agregar el import de `crearClienteTemporal` y de las dos funciones nuevas de `data.js`**

Reemplazar:
```js
import {
  listarClasesDeHoy, listarReservasDeClase, confirmarAsistencia,
  listarAlumnas, obtenerFichaAlumna, activarPaquete, crearValoracion,
  listarClasesProximas, listarPaquetesActivos, listarAlumnaIdsConValoracion,
} from './data.js';
import { hoyISO, formatHora12, formatDiaMesConDia, formatFechaCompleta } from './lib/date-utils.js';
import { escaparHTML } from './lib/escape.js';
import { wireTabs, mostrarErrorCerca } from './ui.js';
```
por:
```js
import {
  listarClasesDeHoy, listarReservasDeClase, confirmarAsistencia,
  listarAlumnas, obtenerFichaAlumna, activarPaquete, crearValoracion,
  listarClasesProximas, listarPaquetesActivos, listarAlumnaIdsConValoracion,
  actualizarClasesUsadas, crearAlumnaManual,
} from './data.js';
import { crearClienteTemporal } from './supabase-client.js';
import { hoyISO, formatHora12, formatDiaMesConDia, formatFechaCompleta } from './lib/date-utils.js';
import { escaparHTML } from './lib/escape.js';
import { wireTabs, mostrarErrorCerca } from './ui.js';
```

- [ ] **Step 2: Quitar la etiqueta "Sin check-in" (ya no hay check-in de la alumna)**

Reemplazar:
```js
        const etiquetaOrigen = etiquetaPlataforma(r.plataforma);
        return `<div class="dato"><div style="display:flex;align-items:center;gap:10px"><span class="avatar" style="width:34px;height:34px;font-size:13px">${escaparHTML(inicialAvatar(r.nombre))}</span>${escaparHTML(r.nombre)}${etiquetaOrigen ? ` <span class="badge">${escaparHTML(etiquetaOrigen)}</span>` : ''}${badge === 'sin_checkin' ? ' <span class="badge warn">Sin check-in</span>' : ''}</div>${accion}</div>`;
```
por:
```js
        const etiquetaOrigen = etiquetaPlataforma(r.plataforma);
        return `<div class="dato"><div style="display:flex;align-items:center;gap:10px"><span class="avatar" style="width:34px;height:34px;font-size:13px">${escaparHTML(inicialAvatar(r.nombre))}</span>${escaparHTML(r.nombre)}${etiquetaOrigen ? ` <span class="badge">${escaparHTML(etiquetaOrigen)}</span>` : ''}</div>${accion}</div>`;
```

- [ ] **Step 3: Simplificar el badge de "Asistencias recientes" en la Ficha (ya no hay "Sin check-in")**

Reemplazar:
```js
      ${asistencias.slice(0, 5).map((a) => {
        const badge = estadoAsistenciaBadge({ checkin_alumna: a.checkinAlumna, confirmada_admin: a.confirmadaAdmin });
        const texto = badge === 'confirmada' ? 'Confirmada' : badge === 'pendiente' ? 'Pendiente' : 'Sin check-in';
        const clase = badge === 'confirmada' ? 'ok' : badge === 'pendiente' ? 'warn' : '';
        return `<div class="dato"><span>${escaparHTML(formatDiaMesConDia(a.fecha))} · ${escaparHTML(formatHora12(a.hora))}</span><span class="badge ${clase}">${texto}</span></div>`;
      }).join('') || '<div class="muted">Sin asistencias todavía</div>'}
    </div>`;
```
por:
```js
      ${asistencias.slice(0, 5).map((a) => {
        const badge = estadoAsistenciaBadge({ confirmada_admin: a.confirmadaAdmin });
        const texto = badge === 'confirmada' ? 'Confirmada' : 'Pendiente';
        const clase = badge === 'confirmada' ? 'ok' : 'warn';
        return `<div class="dato"><span>${escaparHTML(formatDiaMesConDia(a.fecha))} · ${escaparHTML(formatHora12(a.hora))}</span><span class="badge ${clase}">${texto}</span></div>`;
      }).join('') || '<div class="muted">Sin asistencias todavía</div>'}
    </div>`;
```

- [ ] **Step 4: Agregar el campo editable de "Clases usadas" en la Ficha**

Reemplazar:
```js
      ${estado === 'sin_paquete'
        ? '<div class="muted" style="margin-top:8px">Sin paquete activo</div>'
        : `<div class="dato"><span>Clases restantes</span><b>${escaparHTML(paquete.clases_totales - paquete.clases_usadas)} de ${escaparHTML(paquete.clases_totales)}</b></div>
           <div class="dato"><span>Último pago</span><b>${paquete.monto ? `$${escaparHTML(paquete.monto)} · ` : ''}${escaparHTML(paquete.forma_pago ?? '')} · ${paquete.fecha_pago ? escaparHTML(formatDiaMesConDia(paquete.fecha_pago)) : '—'}</b></div>
           <div class="dato"><span>Siguiente pago</span><b>${paquete.vence ? escaparHTML(formatDiaMesConDia(paquete.vence)) : '—'}</b></div>`}
    </div>
```
por:
```js
      ${estado === 'sin_paquete'
        ? '<div class="muted" style="margin-top:8px">Sin paquete activo</div>'
        : `<div class="dato"><span>Clases restantes</span><b>${escaparHTML(paquete.clases_totales - paquete.clases_usadas)} de ${escaparHTML(paquete.clases_totales)}</b></div>
           <div class="dato"><span>Último pago</span><b>${paquete.monto ? `$${escaparHTML(paquete.monto)} · ` : ''}${escaparHTML(paquete.forma_pago ?? '')} · ${paquete.fecha_pago ? escaparHTML(formatDiaMesConDia(paquete.fecha_pago)) : '—'}</b></div>
           <div class="dato"><span>Siguiente pago</span><b>${paquete.vence ? escaparHTML(formatDiaMesConDia(paquete.vence)) : '—'}</b></div>
           <form id="form-clases-usadas" class="row" style="margin-top:10px;gap:8px">
             <label class="field" style="flex:1;margin-top:0"><span>Clases usadas</span><input class="input" type="number" min="0" name="clasesUsadas" value="${escaparHTML(paquete.clases_usadas)}"></label>
             <button class="pillbtn soft" type="submit" style="padding:7px 16px;min-height:36px;font-size:13px;align-self:flex-end">Guardar</button>
           </form>`}
    </div>
```

- [ ] **Step 5: Renombrar "Alumna desde" a un texto neutro en la Ficha**

Reemplazar:
```js
    <div class="muted">Alumna desde ${escaparHTML(formatFechaCompleta(alumna.fecha_alta))}</div>
```
por:
```js
    <div class="muted">En Pump&Flow desde ${escaparHTML(formatFechaCompleta(alumna.fecha_alta))}</div>
```

- [ ] **Step 6: Conectar el formulario de "Clases usadas" y el botón de alta manual en `renderFicha`**

Reemplazar:
```js
  document.getElementById('btn-nueva-valoracion').addEventListener('click', () => abrirDialogValoracion(supabase, alumnaId, valoraciones));
  document.getElementById('btn-activar-paquete').addEventListener('click', () => abrirDialogPaquete(supabase, alumnaId));
}
```
por:
```js
  document.getElementById('btn-nueva-valoracion').addEventListener('click', () => abrirDialogValoracion(supabase, alumnaId, valoraciones));
  document.getElementById('btn-activar-paquete').addEventListener('click', () => abrirDialogPaquete(supabase, alumnaId));

  const formClasesUsadas = document.getElementById('form-clases-usadas');
  formClasesUsadas?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = e.submitter ?? e.target.querySelector('button[type="submit"]');
    if (boton) boton.disabled = true;
    const formData = new FormData(e.target);
    try {
      await actualizarClasesUsadas(supabase, paquete.id, Number(formData.get('clasesUsadas')));
      await renderFicha(supabase, alumnaId);
    } catch (err) {
      if (boton) boton.disabled = false;
      mostrarErrorCerca(boton ?? e.target, `No se pudo guardar: ${err.message}`);
    }
  });
}
```

- [ ] **Step 7: Cambiar los mensajes de "sin alumnas" a "sin alumnado"**

Reemplazar:
```js
  cont.innerHTML = filas.join('') || '<div class="muted">Aún no tienes alumnas registradas</div>';
```
por:
```js
  cont.innerHTML = filas.join('') || '<div class="muted">Aún no tienes alumnado registrado</div>';
```

- [ ] **Step 8: Cambiar "alumna(s)" por "persona(s)" en "Pendientes de la semana"**

Reemplazar:
```js
      <div class="dato"><span>Pagos por recibir</span><b>${pagosPorRecibir} alumna${pagosPorRecibir === 1 ? '' : 's'}</b></div>
      <div class="dato"><span>Paquetes por vencer</span><b>${paquetesPorVencer} alumna${paquetesPorVencer === 1 ? '' : 's'}</b></div>
      <div class="dato"><span>Valoraciones pendientes</span><b>${valoracionesPendientes} alumna${valoracionesPendientes === 1 ? '' : 's'}</b></div>
```
por:
```js
      <div class="dato"><span>Pagos por recibir</span><b>${pagosPorRecibir} persona${pagosPorRecibir === 1 ? '' : 's'}</b></div>
      <div class="dato"><span>Paquetes por vencer</span><b>${paquetesPorVencer} persona${paquetesPorVencer === 1 ? '' : 's'}</b></div>
      <div class="dato"><span>Valoraciones pendientes</span><b>${valoracionesPendientes} persona${valoracionesPendientes === 1 ? '' : 's'}</b></div>
```

- [ ] **Step 9: Agregar la función del diálogo de alta manual, y conectar el botón "+ Nueva cuenta" en `montarVistaAdmin`**

Reemplazar:
```js
export async function montarVistaAdmin({ supabase, onCerrarSesion }) {
  wireTabs('pantalla-admin');
  document.getElementById('d-hoy').querySelector('.btn-logout')?.addEventListener('click', onCerrarSesion);

  // Un solo bloque de consultas para las dos pantallas que lo necesitan.
  const resumen = await cargarResumenAlumnas(supabase);
  await Promise.all([renderHoy(supabase, resumen), renderAlumnas(supabase, resumen), renderClasesAdmin(supabase)]);
  document.getElementById('d-ficha').innerHTML = '<h1>Ficha</h1><div class="muted">Elige una alumna en la pestaña "Alumnas".</div>';
}
```
por:
```js
export async function montarVistaAdmin({ supabase, onCerrarSesion }) {
  wireTabs('pantalla-admin');
  document.getElementById('d-hoy').querySelector('.btn-logout')?.addEventListener('click', onCerrarSesion);
  document.getElementById('btn-nueva-alumna-manual')?.addEventListener('click', () => abrirDialogAlumnaManual(supabase));

  // Un solo bloque de consultas para las dos pantallas que lo necesitan.
  const resumen = await cargarResumenAlumnas(supabase);
  await Promise.all([renderHoy(supabase, resumen), renderAlumnas(supabase, resumen), renderClasesAdmin(supabase)]);
  document.getElementById('d-ficha').innerHTML = '<h1>Ficha</h1><div class="muted">Elige a alguien en la pestaña "Alumnado".</div>';
}

function abrirDialogAlumnaManual(supabase) {
  const dialog = document.getElementById('dialog-alumna-manual');
  const body = document.getElementById('dialog-alumna-manual-body');
  body.innerHTML = `
    <h1 style="font:var(--text-h3)">Nueva cuenta manual</h1>
    <form id="form-alumna-manual">
      <label class="field"><span>Nombre</span><input class="input" type="text" name="nombre" required></label>
      <label class="field"><span>Usuario</span><input class="input" type="text" name="username" required pattern="[a-zA-Z0-9_.]+" title="Solo letras, números, puntos y guiones bajos, sin espacios"></label>
      <label class="field"><span>Contraseña</span><input class="input" type="password" name="contrasena" required minlength="6"></label>
      <label class="field"><span>Teléfono</span><input class="input" type="tel" name="telefono"></label>
      <label class="field"><span>¿Viene de otra plataforma?</span>
        <select class="input" name="plataforma">
          <option value="no">No</option>
          <option value="wellhub">Wellhub</option>
          <option value="totalpass">TotalPass</option>
        </select>
      </label>
      <button class="pillbtn" type="submit" style="width:100%;margin-top:16px">Crear cuenta</button>
      <button class="link-suave" type="button" id="btn-cancelar-alumna-manual" style="width:100%;text-align:center">Cancelar</button>
    </form>`;
  document.getElementById('btn-cancelar-alumna-manual').addEventListener('click', () => dialog.close());
  document.getElementById('form-alumna-manual').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = e.submitter ?? e.target.querySelector('button[type="submit"]');
    if (boton) boton.disabled = true;
    const formData = new FormData(e.target);
    try {
      const clienteTemporal = crearClienteTemporal();
      await crearAlumnaManual(clienteTemporal, {
        nombre: formData.get('nombre'),
        username: formData.get('username'),
        contrasena: formData.get('contrasena'),
        telefono: formData.get('telefono'),
        plataforma: formData.get('plataforma'),
      });
      dialog.close();
      await renderAlumnas(supabase);
    } catch (err) {
      if (boton) boton.disabled = false;
      mostrarErrorCerca(boton ?? e.target, `No se pudo crear la cuenta: ${err.message}`);
    }
  });
  dialog.showModal();
}
```

- [ ] **Step 10: Verificar sintaxis**

Run: `node --check app/admin.js`
Expected: sin salida.

- [ ] **Step 11: Commit**

```bash
git add app/admin.js
git commit -m "feat: ajuste manual de clases usadas, alta manual de cuentas, Alumnado"
```

---

### Task 10: `app/app.js` — auto-procesar asistencias pasadas, login por identificador, registro con auto-login

**Files:**
- Modify: `app/app.js`

**Interfaces:**
- Consumes: `iniciarSesionConIdentificador` de `app/auth.js` (Tarea 5) en vez de `iniciarSesion`; `procesarAsistenciasPasadas` de `app/data.js` (Tarea 3).

- [ ] **Step 1: Cambiar el import**

Reemplazar:
```js
import { obtenerSesionActual, asegurarPerfil, cerrarSesion, registrar, iniciarSesion } from './auth.js';
import { generarClases } from './data.js';
```
por:
```js
import { obtenerSesionActual, asegurarPerfil, cerrarSesion, registrar, iniciarSesionConIdentificador } from './auth.js';
import { generarClases, procesarAsistenciasPasadas } from './data.js';
```

- [ ] **Step 2: Llamar también `procesarAsistenciasPasadas` en el arranque de sesión**

Reemplazar:
```js
async function entrarConSesion(session) {
  const perfil = await asegurarPerfil(session.user);
  generarClases(supabase).catch((err) => console.warn('No se pudieron generar clases:', err.message));
```
por:
```js
async function entrarConSesion(session) {
  const perfil = await asegurarPerfil(session.user);
  generarClases(supabase).catch((err) => console.warn('No se pudieron generar clases:', err.message));
  procesarAsistenciasPasadas(supabase).catch((err) => console.warn('No se pudieron procesar asistencias pasadas:', err.message));
```

- [ ] **Step 3: Usar el campo renombrado y la función de login por identificador**

Reemplazar:
```js
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.style.display = 'none';
  try {
    const { session } = await iniciarSesion({
      correo: document.getElementById('login-correo').value,
      contrasena: document.getElementById('login-contrasena').value,
    });
    await entrarConSesion(session);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
});
```
por:
```js
document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('login-error');
  errorEl.style.display = 'none';
  try {
    const { session } = await iniciarSesionConIdentificador({
      identificador: document.getElementById('login-identificador').value,
      contrasena: document.getElementById('login-contrasena').value,
    });
    await entrarConSesion(session);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
});
```

- [ ] **Step 4: Registro entra directo (ya no hay confirmación de correo pendiente)**

Reemplazar:
```js
document.getElementById('form-registro').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('registro-error');
  const exitoEl = document.getElementById('registro-exito');
  errorEl.style.display = 'none';
  try {
    await registrar({
      correo: document.getElementById('registro-correo').value,
      contrasena: document.getElementById('registro-contrasena').value,
      nombre: document.getElementById('registro-nombre').value,
      telefono: document.getElementById('registro-telefono').value,
      plataforma: document.getElementById('registro-plataforma').value,
    });
    e.target.reset();
    exitoEl.style.display = 'block';
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
});
```
por:
```js
document.getElementById('form-registro').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('registro-error');
  errorEl.style.display = 'none';
  try {
    const { session } = await registrar({
      correo: document.getElementById('registro-correo').value,
      contrasena: document.getElementById('registro-contrasena').value,
      nombre: document.getElementById('registro-nombre').value,
      telefono: document.getElementById('registro-telefono').value,
      plataforma: document.getElementById('registro-plataforma').value,
    });
    e.target.reset();
    await entrarConSesion(session);
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
});
```

- [ ] **Step 5: Verificar sintaxis**

Run: `node --check app/app.js`

- [ ] **Step 6: Correr todas las pruebas de lógica pura una vez más**

Run: `npm test`
Expected: PASS — todo `app/lib/`, nada de esta tarea debió tocarlo.

- [ ] **Step 7: Commit**

```bash
git add app/app.js
git commit -m "feat: login por identificador, auto-login al registrarse, auto-procesar asistencias pasadas"
```

---

### Task 11: Verificación manual end-to-end (con el usuario)

**Contexto:** igual que en el plan anterior, esto no se automatiza — usa el proyecto real de Supabase de Caro y requiere que ella lo pruebe o dé acceso para probarlo.

**Files:** ninguno.

- [ ] **Step 1: Recordar a Caro los dos pasos manuales pendientes, antes de probar nada:**

1. Pegar el `supabase/actualizaciones.sql` completo (ya con el contenido nuevo de la Tarea 1) en el SQL Editor de Supabase.
2. Desactivar "Confirm email": Supabase Dashboard → Authentication → Providers → Email → apagar "Confirm email" → Save. (Esto es un toggle, no SQL.)

- [ ] **Step 2: Servir localmente**

```bash
npx --yes http-server -p 8080 .
```

- [ ] **Step 3: Checklist de alta manual (admin)**

1. Iniciar sesión con la cuenta real de admin de Caro.
2. En "Alumnado", tocar "+ Nueva cuenta", llenar nombre/usuario/contraseña/teléfono/plataforma, guardar.
3. Confirmar que aparece en la lista de inmediato.
4. Cerrar sesión, iniciar sesión de nuevo escribiendo el **usuario** (no el correo) que se acaba de crear, con su contraseña. Debe entrar directo a la vista alumna.

- [ ] **Step 4: Checklist de reservas/cancelación/confirmación**

1. Con la cuenta recién creada, apartar un lugar en una clase dentro de los próximos 7 días.
2. Verificar que en "Inicio" aparece en "Tus próximas reservas" con el botón "No podré asistir" (si faltan 12+ horas) y la leyenda de cancelación.
3. Cancelar esa reserva y confirmar que desaparece de la lista y el cupo se libera (verlo desde otra cuenta o como admin).
4. Volver a apartar la misma clase. Como admin, en "Hoy" o "Clases", confirmar su asistencia y verificar en Supabase que `paquetes.clases_usadas` subió (si tiene paquete activo).
5. Si es posible probar con una clase que ya pasó de hora sin confirmar ni cancelar: verificar que al volver a abrir la app (cualquier cuenta), esa reserva pasada queda con asistencia confirmada automáticamente.

- [ ] **Step 5: Checklist de ajuste manual de clases y ventana de reserva**

1. En la Ficha de alguien con paquete activo, cambiar "Clases usadas" a un número distinto y guardar. Confirmar que se refleja en su vista de alumna ("Quedan N de M").
2. Confirmar que en "Clases" (vista alumna) ya no aparecen clases más allá de 7 días.
3. Si hay una clase dentro de la próxima hora, confirmar que en vez de "Aparto mi espacio" aparece "Mándame mensaje para verificar disponibilidad" y que abre WhatsApp con el mensaje prellenado.

- [ ] **Step 6: Checklist de Inicio y contacto**

1. Confirmar que los botones "Contáctame" y "Súmate a la comunidad" abren los links de WhatsApp correctos.
2. Confirmar que ya no aparece el "Tip de hoy".

- [ ] **Step 7: Limpieza de datos de prueba**

Borrar en Supabase las filas de prueba creadas (incluyendo el usuario en Authentication → Users de la cuenta manual de prueba), igual que en verificaciones anteriores.

- [ ] **Step 8: Commit final si hubo ajustes**

```bash
git status
```
Si hay cambios pendientes de la verificación manual, commitearlos con mensaje descriptivo.

- [ ] **Step 9: Publicar — el sitio ya tiene GitHub Pages activo desde antes**

No hace falta reactivar nada: en cuanto se haga `git push origin main`, GitHub Pages reconstruye solo en unos minutos. Confirmar con Caro antes de hacer el push si prefiere probarlo localmente primero.

---

## Self-Review

**Cobertura del spec:**
- Bloque A (login usuario/correo, alta manual, sin confirmación de correo, "Alumnado") → Tareas 1, 3, 4, 5, 6, 9, 10.
- Bloque B (apartar/cancelar/confirmar/auto-descuento, ventana 7 días / 1 hora) → Tareas 1, 2, 3, 8.
- Bloque C (ajuste manual de clases usadas) → Tareas 3, 9.
- Bloque D (Inicio rediseñado, Contáctame, Súmate a la comunidad) → Tareas 6, 8.
- Punto 6 del pedido original (mensaje de confirmación) → resuelto de otra forma (auto-login), documentado en el spec y en la Tarea 6/10.
- Fuera de alcance del spec (recuperar contraseña, notificaciones, historial de canceladas, cambiar links de contacto desde admin) → no se implementan, consistente.

**Gaps evaluados:**
- ¿Qué pasa si alguien cancela una reserva que ya fue auto-procesada (clase pasada)? No aplica: `puedeCancelar` da `false` para cualquier clase ya pasada (horas negativas), así que el botón de cancelar nunca aparece para esas.
- ¿Puede la RPC `procesar_asistencias_pasadas` correr dos veces sin duplicar el descuento? Sí es segura: usa `not exists` sobre `asistencias` antes de insertar, y el `on conflict do nothing` es una segunda red de seguridad.
- ¿El campo "Clases usadas" permite dejar el paquete en un estado raro (usadas > totales)? No se valida ese límite en esta vuelta — es una herramienta de ajuste manual para Caro, confía en que ella pone números razonables, igual que el resto de los campos de paquete (monto, fechas) no se validan contra reglas de negocio.

**Consistencia de tipos:** revisado que `estadoAsistenciaBadge` reciba siempre `{confirmada_admin}` (con o sin `checkin_alumna` de sobra, que ahora se ignora) en los tres lugares donde se usa (`admin.js` dos veces, `alumna.js` una vez) — ninguno quedó pasando la forma vieja de 3 estados. Revisado que `listarClasesProximas(supabase, 1)` en `alumna.js` no rompe el uso existente en `admin.js` (`listarClasesProximas(supabase)`, sin segundo argumento, sigue usando el default de 4 semanas, sin cambios).
