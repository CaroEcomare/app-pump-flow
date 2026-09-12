# Clase muestra grupal + aviso en Google Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para ejecutar este plan tarea por tarea. Los pasos usan checkboxes (`- [ ]`) para llevar el progreso.

**Goal:** Permitir que varias personas agenden el mismo horario de clase muestra, y que cada vez que alguien agende (o cancele) aparezca/actualice un evento en el Google Calendar de Caro, para que se entere sin tener que abrir la app.

**Architecture:** (1) Se quita la restricción de exclusividad de horario en `citas_clase_muestra` y la lógica del front que la asumía. (2) Se agrega infraestructura nueva en este proyecto — Supabase Edge Functions en Deno — con dos funciones: `gcal-oauth` (conecta la cuenta de Google una sola vez) y `gcal-sync` (crea/actualiza/borra el evento del horario). (3) Un trigger de Postgres en `citas_clase_muestra` llama a `gcal-sync` vía `pg_net` cada vez que alguien agenda o se cancela. La lógica de qué texto poner y qué acción tomar vive en un módulo puro y testeable con Node; las llamadas de red a Google (Edge Functions) no son testeables desde este repo y se verifican a mano una vez desplegadas.

**Tech Stack:** JavaScript plano (frontend, igual que el resto de la app), SQL/PL-pgSQL + extensión `pg_net` (Supabase), Supabase Edge Functions en Deno, API de Google Calendar v3 + OAuth 2.0, Node `--test` para la lógica pura.

**Spec:** [docs/superpowers/specs/2026-09-03-google-calendar-sync-design.md](../specs/2026-09-03-google-calendar-sync-design.md) (secciones A, C, D, E, F — la sección B, clases regulares, queda fuera de alcance de este plan por decisión de la usuaria)

## Global Constraints

- Alcance: **solo** la sincronía de clase muestra (sección C del spec). La sincronía de clases regulares con conteo en vivo (sección B) NO se construye en este plan.
- Clase muestra ahora es grupal: varias personas pueden agendar el mismo `(fecha, hora)`. Sin cupo máximo por ahora.
- Un solo evento de Google Calendar por `(fecha, hora)`, actualizado con la lista de personas conforme se agenda/cancela gente — no un evento por persona.
- La *anon key* del proyecto (`sb_publishable_e7ynsWO1oaQj58lDg1zuQg_DT8aCKB9`, la misma que ya está en `app/supabase-client.js`) es la que usan los triggers para llamar a las Edge Functions — no es un secreto nuevo, así puede vivir en el SQL.
- La *service role key* y las credenciales de Google (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) nunca van en el código ni en SQL — solo como *secrets* de la Edge Function.
- Si falla la sincronía con Google (token vencido, Google caído), la cita ya quedó guardada en la base de datos de todos modos — nunca se pierde un registro por un fallo de Calendar. No hay reintento automático en esta vuelta.
- Proyecto de Supabase: URL `https://euhltloldxnbjbizmwze.supabase.co` (ref `euhltloldxnbjbizmwze`), la misma que ya usa `app/supabase-client.js`.

---

## Task 1: Permitir varias personas por horario de clase muestra

**Files:**
- Create: `supabase/clase-muestra-grupal.sql`
- Modify: `app/lib/status.js` (función `slotsDisponiblesClaseMuestra`)
- Modify: `app/lib/status.test.js`
- Modify: `app/clase-muestra.js`
- Modify: `app/data.js` (quitar `listarSlotsOcupadosClaseMuestra`, ya no se usa)

**Interfaces:**
- Produces: `slotsDisponiblesClaseMuestra(disponibilidad, hoy, dias = 14)` — mismo comportamiento que antes pero SIN el parámetro `ocupados` (ya no excluye nada por ocupación).

- [ ] **Step 1: Actualizar los tests de `slotsDisponiblesClaseMuestra` a la nueva firma (sin `ocupados`)**

Archivo: `app/lib/status.test.js`. Busca el bloque de tests de `slotsDisponiblesClaseMuestra` (5 tests) y reemplázalo completo por:

```javascript
test('slotsDisponiblesClaseMuestra genera un slot por cada franja de disponibilidad que caiga en el rango de días', () => {
  const hoy = new Date(2026, 7, 10, 8, 0); // lunes 10 de agosto de 2026, 8:00am
  const disponibilidad = [{ diaSemana: 1, hora: '10:00:00' }]; // lunes 10am
  const slots = slotsDisponiblesClaseMuestra(disponibilidad, hoy, 14);
  assert.deepEqual(slots, [
    { fecha: '2026-08-10', hora: '10:00:00' },
    { fecha: '2026-08-17', hora: '10:00:00' },
  ]);
});

test('slotsDisponiblesClaseMuestra no excluye un horario aunque ya tenga gente agendada', () => {
  const hoy = new Date(2026, 7, 10, 8, 0);
  const disponibilidad = [{ diaSemana: 1, hora: '10:00:00' }];
  const slots = slotsDisponiblesClaseMuestra(disponibilidad, hoy, 14);
  assert.deepEqual(slots, [
    { fecha: '2026-08-10', hora: '10:00:00' },
    { fecha: '2026-08-17', hora: '10:00:00' },
  ]);
});

test('slotsDisponiblesClaseMuestra excluye horarios de hoy con menos de 1 hora de anticipación', () => {
  const hoy = new Date(2026, 7, 10, 9, 30); // lunes 10 de agosto, 9:30am
  const disponibilidad = [{ diaSemana: 1, hora: '10:00:00' }]; // hoy mismo a las 10am, faltan 30 min
  const slots = slotsDisponiblesClaseMuestra(disponibilidad, hoy, 14);
  assert.deepEqual(slots, [{ fecha: '2026-08-17', hora: '10:00:00' }]);
});

test('slotsDisponiblesClaseMuestra usa 14 días por default si se omite el argumento', () => {
  const hoy = new Date(2026, 7, 10, 8, 0);
  const disponibilidad = [{ diaSemana: 1, hora: '10:00:00' }];
  const slots = slotsDisponiblesClaseMuestra(disponibilidad, hoy);
  assert.deepEqual(slots, [
    { fecha: '2026-08-10', hora: '10:00:00' },
    { fecha: '2026-08-17', hora: '10:00:00' },
  ]);
});

test('slotsDisponiblesClaseMuestra ordena por fecha y luego por hora', () => {
  const hoy = new Date(2026, 7, 10, 8, 0);
  const disponibilidad = [
    { diaSemana: 3, hora: '16:00:00' }, // miércoles
    { diaSemana: 1, hora: '10:00:00' }, // lunes
  ];
  const slots = slotsDisponiblesClaseMuestra(disponibilidad, hoy, 3);
  assert.deepEqual(slots, [{ fecha: '2026-08-10', hora: '10:00:00' }, { fecha: '2026-08-12', hora: '16:00:00' }]);
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan (la función todavía tiene la firma vieja)**

Run: `npm test`
Expected: FAIL — los tests nuevos llaman `slotsDisponiblesClaseMuestra(disponibilidad, hoy, dias)` (3 argumentos), pero la función actual espera `(disponibilidad, ocupados, hoy, dias)` (4 argumentos), así que `hoy` llega en la posición de `ocupados` y truena o da resultados incorrectos.

- [ ] **Step 3: Actualizar `slotsDisponiblesClaseMuestra` a la nueva firma**

Archivo: `app/lib/status.js`. Busca:

```javascript
export function slotsDisponiblesClaseMuestra(disponibilidad, ocupados, hoy, dias = 14) {
  const ocupadosSet = new Set(ocupados.map((o) => `${o.fecha}_${o.hora}`));
  const slots = [];
  for (let i = 0; i < dias; i += 1) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() + i);
    const fechaISO = hoyISO(fecha);
    const diaSemana = fecha.getDay();
    disponibilidad
      .filter((d) => d.diaSemana === diaSemana)
      .forEach((d) => {
        if (ocupadosSet.has(`${fechaISO}_${d.hora}`)) return;
        if (!puedeApartar(fechaISO, d.hora, hoy)) return;
        slots.push({ fecha: fechaISO, hora: d.hora });
      });
  }
  return slots.sort((a, b) => (a.fecha === b.fecha ? a.hora.localeCompare(b.hora) : a.fecha.localeCompare(b.fecha)));
}
```

Reemplázala por:

```javascript
export function slotsDisponiblesClaseMuestra(disponibilidad, hoy, dias = 14) {
  const slots = [];
  for (let i = 0; i < dias; i += 1) {
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() + i);
    const fechaISO = hoyISO(fecha);
    const diaSemana = fecha.getDay();
    disponibilidad
      .filter((d) => d.diaSemana === diaSemana)
      .forEach((d) => {
        if (!puedeApartar(fechaISO, d.hora, hoy)) return;
        slots.push({ fecha: fechaISO, hora: d.hora });
      });
  }
  return slots.sort((a, b) => (a.fecha === b.fecha ? a.hora.localeCompare(b.hora) : a.fecha.localeCompare(b.fecha)));
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npm test`
Expected: todos los tests pasan, incluyendo los 5 de `slotsDisponiblesClaseMuestra`.

- [ ] **Step 5: Actualizar `app/clase-muestra.js` para dejar de pedir/usar los horarios ocupados**

Archivo: `app/clase-muestra.js`. Busca:

```javascript
import { listarDisponibilidadClaseMuestra, listarSlotsOcupadosClaseMuestra, agendarClaseMuestra } from './data.js';
```

Reemplázala por:

```javascript
import { listarDisponibilidadClaseMuestra, agendarClaseMuestra } from './data.js';
```

Luego busca:

```javascript
  const [disponibilidad, ocupados] = await Promise.all([
    listarDisponibilidadClaseMuestra(supabase),
    listarSlotsOcupadosClaseMuestra(supabase),
  ]);
  const disponibilidadMapeada = disponibilidad.map((d) => ({ diaSemana: d.dia_semana, hora: d.hora }));
  const slots = slotsDisponiblesClaseMuestra(disponibilidadMapeada, ocupados, new Date());
```

Reemplázala por:

```javascript
  const disponibilidad = await listarDisponibilidadClaseMuestra(supabase);
  const disponibilidadMapeada = disponibilidad.map((d) => ({ diaSemana: d.dia_semana, hora: d.hora }));
  const slots = slotsDisponiblesClaseMuestra(disponibilidadMapeada, new Date());
```

Por último, en el mismo archivo, dentro de `renderFormulario`, busca este bloque del manejo de error al agendar (ya no aplica — el error `23505` era específicamente por la restricción de horario único que este task quita):

```javascript
    } catch (err) {
      if (boton) boton.disabled = false;
      if (err.code === '23505') {
        mostrarErrorCerca(boton ?? e.target, 'Ese horario acaba de apartarse. Elige otro, por favor 🤍');
        return;
      }
      mostrarErrorCerca(boton ?? e.target, `No se pudo agendar: ${err.message}`);
    }
```

Reemplázalo por:

```javascript
    } catch (err) {
      if (boton) boton.disabled = false;
      mostrarErrorCerca(boton ?? e.target, `No se pudo agendar: ${err.message}`);
    }
```

- [ ] **Step 6: Quitar la función que ya no se usa de `app/data.js`**

Archivo: `app/data.js`. Busca y elimina por completo esta función (ya nada la llama):

```javascript
export async function listarSlotsOcupadosClaseMuestra(supabase) {
  const { data, error } = await supabase.rpc('slots_ocupados_clase_muestra');
  if (error) throw error;
  return data;
}
```

- [ ] **Step 7: Verificar que no queda ninguna referencia a lo que se quitó**

Run:
```bash
grep -rn "listarSlotsOcupadosClaseMuestra\|ocupadosSet\|slots_ocupados_clase_muestra" app/
```
Expected: sin resultados (0 líneas). Si aparece algo, falta limpiarlo.

- [ ] **Step 8: Correr toda la suite una vez más antes de commitear**

Run: `npm test`
Expected: todos los tests pasan (mismo conteo que al inicio, menos el test viejo de exclusión que se reemplazó por el de "no excluye").

- [ ] **Step 9: Crear el SQL que Caro va a pegar en el editor de Supabase**

Crea el archivo `supabase/clase-muestra-grupal.sql` con este contenido exacto:

```sql
-- ============================================
-- Clase muestra grupal: quitar la exclusividad de horario
-- ============================================
-- Antes, un horario de clase muestra solo podía tener UNA cita activa
-- (pensado como sesión 1 a 1). Ahora la clase muestra es grupal: varias
-- personas pueden agendar el mismo (fecha, hora). Pega este archivo
-- completo en el SQL Editor de Supabase y córrelo.

drop index if exists citas_clase_muestra_fecha_hora_activa;

-- Ya no se usa (la pantalla pública ya no oculta horarios ocupados).
drop function if exists slots_ocupados_clase_muestra();
```

- [ ] **Step 10: Commit**

```bash
git add supabase/clase-muestra-grupal.sql app/lib/status.js app/lib/status.test.js app/clase-muestra.js app/data.js
git commit -m "$(cat <<'EOF'
feat: permitir varias personas en el mismo horario de clase muestra

La clase muestra ahora es grupal, no 1 a 1. Se quita la lógica que
excluía horarios ya ocupados (slotsDisponiblesClaseMuestra ya no
recibe "ocupados") y se agrega supabase/clase-muestra-grupal.sql para
quitar la restricción de la base de datos que lo impedía.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

**Nota para Caro (no es parte del task, es un recordatorio):** este SQL todavía no está pegado en tu base de datos real — eso pasa en el Task 8, junto con todo lo demás de Google Calendar.

---

## Task 2: Lógica pura de la sincronía con Google Calendar (testeable con Node)

**Files:**
- Create: `supabase/functions/_shared/gcal-logic.js`
- Create: `supabase/functions/_shared/gcal-logic.test.js`
- Modify: `package.json` (agregar la carpeta nueva al comando de test)

**Interfaces:**
- Produces:
  - `construirResumenClaseMuestra(personas: {nombre: string, telefono: string|null}[]) => { titulo: string, descripcion: string }`
  - `decidirAccionCalendario({ eventoExistente: string|null, cantidadPersonas: number }) => 'crear' | 'actualizar' | 'borrar' | 'ninguna'`
  - `construirRangoEvento(fecha: 'YYYY-MM-DD', hora: 'HH:MM:SS') => { inicio: string, fin: string }` (strings de fecha-hora SIN zona horaria, para mandarlos junto con `timeZone: 'America/Mexico_City'` a la API de Google Calendar — nunca usar `Date#toISOString()` con estos valores, porque asumiría UTC y correría el evento 6 horas).
- Consumed by: Task 5 (`gcal-sync`, Edge Function).

- [ ] **Step 1: Escribir los tests, todos juntos, antes que la implementación**

Crea `supabase/functions/_shared/gcal-logic.test.js`:

```javascript
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
```

- [ ] **Step 2: Correr los tests y confirmar que fallan (el archivo de implementación no existe todavía)**

Run: `node --test supabase/functions/_shared/gcal-logic.test.js`
Expected: FAIL — `Cannot find module './gcal-logic.js'` o equivalente.

- [ ] **Step 3: Implementar `gcal-logic.js`**

Crea `supabase/functions/_shared/gcal-logic.js`:

```javascript
export function construirResumenClaseMuestra(personas) {
  const n = personas.length;
  const titulo = `Clase muestra · ${n} persona${n === 1 ? '' : 's'}`;
  const descripcion = personas
    .map((p) => `${p.nombre}${p.telefono ? ` · ${p.telefono}` : ''}`)
    .join('\n');
  return { titulo, descripcion };
}

export function decidirAccionCalendario({ eventoExistente, cantidadPersonas }) {
  if (cantidadPersonas === 0) return eventoExistente ? 'borrar' : 'ninguna';
  return eventoExistente ? 'actualizar' : 'crear';
}

// Arma fecha-hora SIN zona horaria (ej. "2026-09-15T18:15:00"), para
// usarse junto con timeZone: 'America/Mexico_City' en la API de Google
// Calendar. Aritmética en un espacio UTC "de mentiras" solo para sumar
// la hora sin que el motor de JS interprete ninguna zona horaria real.
export function construirRangoEvento(fecha, hora) {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const [h, m, s] = hora.split(':').map(Number);
  const inicioUTC = new Date(Date.UTC(anio, mes - 1, dia, h, m, s || 0));
  const finUTC = new Date(inicioUTC.getTime() + 60 * 60 * 1000);
  const formatear = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
  };
  return { inicio: formatear(inicioUTC), fin: formatear(finUTC) };
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `node --test supabase/functions/_shared/gcal-logic.test.js`
Expected: 9/9 tests pasan.

- [ ] **Step 5: Agregar la carpeta nueva al comando de test del proyecto**

Archivo: `package.json`. Busca:

```json
    "test": "node --test app/lib/*.test.js"
```

Reemplázalo por:

```json
    "test": "node --test app/lib/*.test.js supabase/functions/_shared/*.test.js"
```

- [ ] **Step 6: Correr la suite completa del proyecto**

Run: `npm test`
Expected: todos los tests pasan (los de `app/lib/` más los 9 nuevos de `gcal-logic`).

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared/gcal-logic.js supabase/functions/_shared/gcal-logic.test.js package.json
git commit -m "$(cat <<'EOF'
feat: lógica pura de sincronía con Google Calendar, con tests

construirResumenClaseMuestra arma título/descripción del evento,
decidirAccionCalendario decide crear/actualizar/borrar/nada según
cuánta gente hay agendada, y construirRangoEvento arma el horario del
evento sin que se corrompa por zona horaria (Deno corre en UTC).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Modelo de datos para Google Calendar

**Files:**
- Create: `supabase/google-calendar-modelo.sql`

**Interfaces:**
- Produces: columna `citas_clase_muestra.google_event_id` y tabla `google_calendar_tokens(id, refresh_token, updated_at)` — usadas por Tasks 4, 5 y 6.

Este task es solo SQL (nada que testear con Node). Caro lo pega en el Task 8 junto con el resto.

- [ ] **Step 1: Escribir el SQL**

Crea `supabase/google-calendar-modelo.sql`:

```sql
-- ============================================
-- Modelo de datos: sincronía de clase muestra con Google Calendar
-- ============================================
-- Pega este archivo completo en el SQL Editor de Supabase y córrelo.
-- Necesita la extensión pg_net (llamadas HTTP desde triggers). Si el
-- create extension de abajo da error de permisos, actívala desde el
-- Dashboard de Supabase: Database > Extensions > busca "pg_net" > Enable.

create extension if not exists pg_net with schema extensions;

-- Qué evento de Calendar corresponde al horario (fecha, hora) de esta
-- cita. Varias citas del mismo horario comparten el mismo valor aquí
-- (se sobrescribe igual en todas cuando se crea/actualiza el evento).
alter table citas_clase_muestra add column if not exists google_event_id text;

-- Un solo renglón: el refresh token de la cuenta de Google que Caro
-- conecte. "id boolean primary key default true" más el check de abajo
-- garantiza que nunca pueda haber más de un renglón.
create table if not exists google_calendar_tokens (
  id boolean primary key default true,
  refresh_token text not null,
  updated_at timestamptz not null default now(),
  constraint google_calendar_tokens_una_sola_fila check (id)
);

-- RLS activo SIN ninguna policy: nadie puede leer ni escribir esta
-- tabla desde el cliente (autenticado o no) ni desde el público. Solo
-- la Edge Function, que usa la service role key (ignora RLS), puede.
alter table google_calendar_tokens enable row level security;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/google-calendar-modelo.sql
git commit -m "$(cat <<'EOF'
feat: modelo de datos SQL para sincronía con Google Calendar

Columna citas_clase_muestra.google_event_id y tabla
google_calendar_tokens (un solo renglón, sin policies — solo la Edge
Function con service role key puede leerla/escribirla).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Edge Function `gcal-oauth` (conectar la cuenta de Google)

**Files:**
- Create: `supabase/functions/gcal-oauth/index.ts`

**Interfaces:**
- Consumes: variables de entorno `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `APP_URL` (se configuran en el Task 8), más `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (estas dos las inyecta Supabase automáticamente en toda Edge Function, no hay que configurarlas a mano).
- Produces: al visitar esta URL sin `?code=`, redirige a la pantalla de permisos de Google. Google redirige de vuelta a esta misma URL con `?code=...`; en ese caso guarda el refresh token en `google_calendar_tokens` y redirige a `APP_URL` con `?gcal=conectado` (o `?gcal=error`).

No es testeable con Node (necesita la API real de Google y Deno). Se verifica a mano en el Task 9.

- [ ] **Step 1: Escribir la Edge Function**

Crea `supabase/functions/gcal-oauth/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const GOOGLE_REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI')!;
const APP_URL = Deno.env.get('APP_URL')!;

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');

  // Paso 1: sin código todavía. Manda a Caro a la pantalla de permisos de Google.
  if (!code) {
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', GOOGLE_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    return Response.redirect(authUrl.toString(), 302);
  }

  // Paso 2: Google ya regresó con el código. Lo cambiamos por tokens.
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  const tokenData = await tokenRes.json();

  if (!tokenRes.ok || !tokenData.refresh_token) {
    console.error('Error al cambiar el código por tokens:', tokenData);
    return Response.redirect(`${APP_URL}?gcal=error`, 302);
  }

  const { error } = await supabaseAdmin
    .from('google_calendar_tokens')
    .upsert({ id: true, refresh_token: tokenData.refresh_token, updated_at: new Date().toISOString() });

  if (error) {
    console.error('Error al guardar el token:', error);
    return Response.redirect(`${APP_URL}?gcal=error`, 302);
  }

  return Response.redirect(`${APP_URL}?gcal=conectado`, 302);
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/gcal-oauth/index.ts
git commit -m "$(cat <<'EOF'
feat: Edge Function gcal-oauth para conectar Google Calendar

Redirige a la pantalla de permisos de Google, y al volver con el
código lo cambia por un refresh token que guarda en
google_calendar_tokens. access_type=offline + prompt=consent
garantizan que Google sí regrese un refresh token.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Edge Function `gcal-sync` (crear/actualizar/borrar el evento)

**Files:**
- Create: `supabase/functions/gcal-sync/index.ts`

**Interfaces:**
- Consumes: `construirResumenClaseMuestra`, `decidirAccionCalendario`, `construirRangoEvento` de `../_shared/gcal-logic.js` (Task 2). Variables de entorno `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (Task 8), `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (automáticas).
- Produces: recibe `POST { fecha, hora }`, mira quién sigue activo en ese horario, y crea/actualiza/borra el evento correspondiente en Google Calendar. Consumido por el trigger del Task 6.

No es testeable con Node (necesita la API real de Google, Deno, y la base de datos real). La lógica que sí se puede probar ya se probó en el Task 2; esta función es el "pegamento" de red, se verifica a mano en el Task 9.

- [ ] **Step 1: Escribir la Edge Function**

Crea `supabase/functions/gcal-sync/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  construirResumenClaseMuestra,
  decidirAccionCalendario,
  construirRangoEvento,
} from '../_shared/gcal-logic.js';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function obtenerAccessToken() {
  const { data, error } = await supabaseAdmin
    .from('google_calendar_tokens')
    .select('refresh_token')
    .eq('id', true)
    .maybeSingle();
  if (error || !data) throw new Error('Google Calendar no está conectado todavía');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: data.refresh_token,
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`No se pudo refrescar el token de Google: ${JSON.stringify(json)}`);
  return json.access_token as string;
}

serve(async (req) => {
  try {
    const { fecha, hora } = await req.json();

    const { data: citas, error: citasError } = await supabaseAdmin
      .from('citas_clase_muestra')
      .select('nombre, telefono, google_event_id')
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancelada', false);
    if (citasError) throw citasError;

    const eventoExistente = citas.find((c) => c.google_event_id)?.google_event_id ?? null;
    const accion = decidirAccionCalendario({ eventoExistente, cantidadPersonas: citas.length });

    if (accion === 'ninguna') {
      return new Response(JSON.stringify({ ok: true, accion }), { status: 200 });
    }

    const accessToken = await obtenerAccessToken();

    if (accion === 'borrar') {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventoExistente}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      await supabaseAdmin
        .from('citas_clase_muestra')
        .update({ google_event_id: null })
        .eq('fecha', fecha)
        .eq('hora', hora);
      return new Response(JSON.stringify({ ok: true, accion }), { status: 200 });
    }

    const { titulo, descripcion } = construirResumenClaseMuestra(citas);
    const { inicio, fin } = construirRangoEvento(fecha, hora);
    const cuerpoEvento = {
      summary: titulo,
      description: descripcion,
      start: { dateTime: inicio, timeZone: 'America/Mexico_City' },
      end: { dateTime: fin, timeZone: 'America/Mexico_City' },
    };

    const url = accion === 'crear'
      ? 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
      : `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventoExistente}`;
    const metodo = accion === 'crear' ? 'POST' : 'PATCH';

    const eventRes = await fetch(url, {
      method: metodo,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpoEvento),
    });
    const eventJson = await eventRes.json();
    if (!eventRes.ok) throw new Error(`Google Calendar respondió con error: ${JSON.stringify(eventJson)}`);

    await supabaseAdmin
      .from('citas_clase_muestra')
      .update({ google_event_id: eventJson.id })
      .eq('fecha', fecha)
      .eq('hora', hora)
      .eq('cancelada', false);

    return new Response(JSON.stringify({ ok: true, accion, eventId: eventJson.id }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500 });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/gcal-sync/index.ts
git commit -m "$(cat <<'EOF'
feat: Edge Function gcal-sync para crear/actualizar/borrar el evento

Recibe fecha+hora, calcula quién sigue activo en ese horario, y
crea/actualiza/borra un solo evento de Google Calendar con la lista de
personas, usando la lógica ya probada de gcal-logic.js.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Trigger de Postgres que llama a `gcal-sync`

**Files:**
- Create: `supabase/google-calendar-trigger.sql`

**Interfaces:**
- Consumes: la URL de la Edge Function `gcal-sync` desplegada en el Task 8 (`https://euhltloldxnbjbizmwze.supabase.co/functions/v1/gcal-sync`).
- Produces: cada `insert` en `citas_clase_muestra`, y cada vez que `cancelada` cambia de `false` a `true`, dispara una llamada HTTP a `gcal-sync` con `{ fecha, hora }` de esa cita.

Solo SQL, se pega en el Task 8.

- [ ] **Step 1: Escribir el SQL del trigger**

Crea `supabase/google-calendar-trigger.sql`:

```sql
-- ============================================
-- Trigger: avisar a gcal-sync cuando se agenda o cancela una cita
-- ============================================
-- Pega este archivo DESPUÉS de google-calendar-modelo.sql y de
-- desplegar la Edge Function gcal-sync (Task 8). Si lo pegas antes de
-- desplegar la función, no truena nada — la llamada HTTP simplemente
-- fallará silenciosamente (pg_net no bloquea el insert/update aunque
-- la llamada falle) hasta que la función exista.

create or replace function trigger_sincronizar_clase_muestra()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fecha date;
  v_hora time;
begin
  v_fecha := coalesce(new.fecha, old.fecha);
  v_hora := coalesce(new.hora, old.hora);

  perform net.http_post(
    url := 'https://euhltloldxnbjbizmwze.supabase.co/functions/v1/gcal-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer sb_publishable_e7ynsWO1oaQj58lDg1zuQg_DT8aCKB9'
    ),
    body := jsonb_build_object('fecha', v_fecha, 'hora', v_hora)
  );
  return new;
end;
$$;

drop trigger if exists sincronizar_clase_muestra_insert on citas_clase_muestra;
create trigger sincronizar_clase_muestra_insert
  after insert on citas_clase_muestra
  for each row execute function trigger_sincronizar_clase_muestra();

drop trigger if exists sincronizar_clase_muestra_cancelacion on citas_clase_muestra;
create trigger sincronizar_clase_muestra_cancelacion
  after update of cancelada on citas_clase_muestra
  for each row
  when (old.cancelada is distinct from new.cancelada)
  execute function trigger_sincronizar_clase_muestra();
```

- [ ] **Step 2: Commit**

```bash
git add supabase/google-calendar-trigger.sql
git commit -m "$(cat <<'EOF'
feat: trigger SQL que sincroniza clase muestra con Google Calendar

Después de cada insert o cancelación en citas_clase_muestra, llama a
la Edge Function gcal-sync vía pg_net con la anon key (ya pública).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Botón "Conectar Google Calendar" en el panel admin

**Files:**
- Modify: `portal/index.html` (pantalla `d-muestra`)
- Modify: `app/admin.js` (`montarVistaAdmin`)

**Interfaces:**
- Consumes: la URL de `gcal-oauth` desplegada en el Task 8 (`https://euhltloldxnbjbizmwze.supabase.co/functions/v1/gcal-oauth`).

No hay tests automatizados de DOM en este proyecto — se verifica sirviendo el sitio localmente y con `npm test` como regresión (no debe tocar nada de `app/lib/`).

- [ ] **Step 1: Agregar la tarjeta en `portal/index.html`**

Busca, dentro de la pantalla `d-muestra`:

```html
    <div class="card">
      <b style="color:var(--text-title)">Tu link para compartir</b>
      <div class="dato"><span id="d-muestra-link" style="word-break:break-all"></span></div>
    </div>
```

Justo después de ese `</div>` de cierre, agrega:

```html
    <div class="card">
      <b style="color:var(--text-title)">Avisos en tu Google Calendar</b>
      <div class="dato"><span id="d-gcal-estado" style="display:none"></span></div>
      <button class="pillbtn soft" id="btn-conectar-gcal" style="margin-top:10px">Conectar Google Calendar</button>
    </div>
```

- [ ] **Step 2: Verificar que el HTML quedó bien insertado**

Run:
```bash
grep -c 'id="btn-conectar-gcal"' portal/index.html
grep -c 'id="d-gcal-estado"' portal/index.html
```
Expected: `1` y `1`.

- [ ] **Step 3: Agregar la lógica en `app/admin.js`**

Dentro de `montarVistaAdmin`, junto a los demás listeners de un solo montaje (busca la línea `document.getElementById('btn-agregar-clase')?.addEventListener(...)` para ubicarte), agrega justo después:

```javascript
  document.getElementById('btn-conectar-gcal')?.addEventListener('click', () => {
    location.href = 'https://euhltloldxnbjbizmwze.supabase.co/functions/v1/gcal-oauth';
  });
  mostrarRetornoGcal();
```

Y en cualquier parte del archivo fuera de una función (junto a las demás funciones auxiliares del módulo, por ejemplo justo antes de `async function renderMuestraAdmin`), agrega:

```javascript
function mostrarRetornoGcal() {
  const params = new URLSearchParams(location.search);
  const estado = params.get('gcal');
  const el = document.getElementById('d-gcal-estado');
  if (!estado || !el) return;
  el.style.display = 'block';
  el.textContent = estado === 'conectado'
    ? '✅ Conectado. Ya vas a recibir tus citas de clase muestra aquí.'
    : '⚠️ No se pudo conectar. Intenta de nuevo.';
  history.replaceState(null, '', location.pathname);
}
```

- [ ] **Step 4: Verificación funcional con servidor estático**

```bash
python3 -m http.server 8765 >/tmp/gcal-check.log 2>&1 &
SERVER_PID=$!
sleep 1
curl -s http://localhost:8765/portal/ | grep -q 'btn-conectar-gcal' && echo "OK botón presente" || echo "FALLO"
kill $SERVER_PID
```
Expected: `OK botón presente`.

- [ ] **Step 5: Regresión — la suite de tests sigue pasando**

Run: `npm test`
Expected: mismo resultado que al final del Task 2 (esta tarea no toca `app/lib/` ni `supabase/functions/`).

- [ ] **Step 6: Commit**

```bash
git add portal/index.html app/admin.js
git commit -m "$(cat <<'EOF'
feat: botón para conectar Google Calendar desde el panel admin

En la pestaña Muestra, un botón manda a la pantalla de permisos de
Google (gcal-oauth); al volver, muestra si quedó conectado o no según
el parámetro ?gcal= en la URL.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Configuración manual y despliegue (se hace en vivo con Caro, no es un task de subagente)

**Este task no se dispatcha a un subagente implementador.** Requiere las cuentas reales de Caro (Google Cloud, Supabase CLI) — lo hace el controller (Claude) guiándola paso a paso en la conversación cuando lleguen aquí. No tiene "Files" ni "Interfaces" porque no es código nuevo; es ejecutar y conectar todo lo que los Tasks 1-7 ya construyeron.

**Checklist a seguir en vivo:**

- [ ] **Paso 1: Crear credenciales OAuth en Google Cloud**
  1. Ir a https://console.cloud.google.com/, crear un proyecto nuevo (o usar uno existente).
  2. "APIs y servicios" → "Biblioteca" → buscar "Google Calendar API" → Habilitar.
  3. "APIs y servicios" → "Pantalla de consentimiento OAuth" → tipo Externo → llenar nombre de la app ("Pump&Flow") y correo de contacto → guardar (no hace falta publicarla, puede quedar en modo prueba con la cuenta de Caro como usuaria de prueba).
  4. "APIs y servicios" → "Credenciales" → "Crear credenciales" → "ID de cliente de OAuth" → tipo "Aplicación web".
  5. En "URIs de redirección autorizados", agregar exactamente: `https://euhltloldxnbjbizmwze.supabase.co/functions/v1/gcal-oauth`
  6. Guardar el **Client ID** y el **Client Secret** que Google genera.
  7. **Importante, para siempre:** deja esta pantalla de consentimiento en modo "Prueba" (no la publiques). Es lo único que evita que alguien más pueda conectar su propia cuenta de Google a esta app.

- [ ] **Paso 2: Instalar y conectar el CLI de Supabase** (Claude ejecuta esto en la terminal de Caro)
  ```bash
  npm install -g supabase
  supabase login
  supabase link --project-ref euhltloldxnbjbizmwze
  ```
  `supabase login` abre el navegador para que Caro autorice con su cuenta de Supabase.

- [ ] **Paso 3: Configurar los secrets de las Edge Functions**
  ```bash
  supabase secrets set GOOGLE_CLIENT_ID="<el Client ID del Paso 1>"
  supabase secrets set GOOGLE_CLIENT_SECRET="<el Client Secret del Paso 1>"
  supabase secrets set GOOGLE_REDIRECT_URI="https://euhltloldxnbjbizmwze.supabase.co/functions/v1/gcal-oauth"
  supabase secrets set APP_URL="https://caroecomare.github.io/app-pump-flow/portal/"
  ```

- [ ] **Paso 4: Desplegar las dos Edge Functions**
  ```bash
  supabase functions deploy gcal-oauth
  supabase functions deploy gcal-sync
  ```

- [ ] **Paso 5: Pegar el SQL en el Supabase SQL Editor, en este orden**
  1. `supabase/clase-muestra-grupal.sql` (Task 1)
  2. `supabase/google-calendar-modelo.sql` (Task 3)
  3. `supabase/google-calendar-trigger.sql` (Task 6)

- [ ] **Paso 6: Conectar la cuenta de Google desde la app**
  1. Entrar a `https://caroecomare.github.io/app-pump-flow/portal/` como admin.
  2. Pestaña "Muestra" → botón "Conectar Google Calendar".
  3. Elegir la cuenta de Google, aceptar permisos.
  4. Confirmar que regresa a la app mostrando "✅ Conectado."

---

## Task 9: Verificación end-to-end (manual, con Caro)

**Este task tampoco es de subagente** — es la prueba real del sistema completo, con la cuenta de Google de Caro ya conectada (Task 8).

- [ ] **Paso 1:** Desde el link público (`https://caroecomare.github.io/app-pump-flow/?agenda=clase-muestra`), agendar una cita de prueba con nombre y teléfono ficticios, en uno de los 3 horarios ya cargados (martes/jueves 6:15pm o viernes 10:40am).

- [ ] **Paso 2:** Confirmar que aparece un evento nuevo en el Google Calendar de Caro, en la fecha/hora correctas, titulado "Clase muestra · 1 persona", con el nombre y teléfono en la descripción.

- [ ] **Paso 3:** Agendar una SEGUNDA cita de prueba en el mismo horario exacto. Confirmar que el evento se actualiza (no se crea uno nuevo) a "Clase muestra · 2 personas", con ambos nombres en la descripción.

- [ ] **Paso 4:** Desde el panel admin (pestaña Muestra), cancelar una de las dos citas. Confirmar que el evento se actualiza de vuelta a "Clase muestra · 1 persona" con solo el nombre restante.

- [ ] **Paso 5:** Cancelar la última cita restante. Confirmar que el evento desaparece por completo del Google Calendar.

- [ ] **Paso 6:** Confirmar que las tres citas de prueba (canceladas) siguen existiendo en la base de datos (la app nunca borra registros, solo marca `cancelada = true`) — esto ya lo garantiza el diseño existente, solo es una confirmación visual en el panel admin de que no aparecen en "Próximas citas".
