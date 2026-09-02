# Agendar clase muestra (Plan 1: agendar + administrar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cualquier prospecto pueda agendar una clase muestra desde un link público (sin cuenta), eligiendo entre los horarios que Caro dejó disponibles, y que Caro pueda ver/cancelar esas citas y definir su disponibilidad desde una pestaña nueva en su vista admin.

**Architecture:** Extiende la app estática existente (Supabase + JS sin build) con dos tablas nuevas (`disponibilidad_clase_muestra`, `citas_clase_muestra`), una función RPC de solo-lectura para que el público sepa qué horarios ya están ocupados sin exponer datos de nadie, una pantalla pública nueva accesible por query string (sin pasar por el login), y una pestaña nueva en la vista admin. La notificación automática por Google Calendar es un plan aparte, posterior a este.

**Tech Stack:** Supabase (Postgres + RLS + RPC), JS vanilla con módulos ES, mismo patrón del resto de la app (`app/data.js` para queries, `app/lib/status.js` para lógica pura con pruebas, `node --test` para las pruebas).

**Spec:** `docs/superpowers/specs/2026-09-01-clase-muestra-design.md`

## Global Constraints

- Cada clase muestra dura 1 hora (fijo, no configurable por franja).
- Los slots se calculan para los próximos 14 días.
- No hay cancelación por parte del prospecto: solo Caro cancela desde su vista admin.
- No se generan filas de prueba en el proyecto real de Supabase de Caro — la verificación con datos reales es la última tarea de este plan, y al final se borran los datos de prueba creados.

---

## Task 1: Esquema en Supabase (tablas, RLS, función de slots ocupados)

**Files:**
- Modify: `supabase/actualizaciones.sql` (agregar al final)

**Interfaces:**
- Produces: tablas `disponibilidad_clase_muestra` (`id`, `dia_semana` int 0-6, `hora` time, `activo` boolean) y `citas_clase_muestra` (`id`, `fecha` date, `hora` time, `nombre` text, `telefono` text, `cancelada` boolean, `created_at` timestamptz); función `slots_ocupados_clase_muestra()` que regresa `(fecha date, hora time)` de las citas no canceladas.

- [ ] **Step 1: Agregar el bloque SQL al final de `supabase/actualizaciones.sql`**

```sql

-- ============================================
-- Clase muestra: agendar público, sin cuenta
-- ============================================
-- Disponibilidad fija semanal que define Caro (mismo patrón que
-- "horarios" para las clases regulares, pero sin cupo: cada franja es
-- de una sola persona, así que no hace falta ese campo).
create table if not exists disponibilidad_clase_muestra (
  id serial primary key,
  dia_semana int not null check (dia_semana between 0 and 6),
  hora time not null,
  activo boolean not null default true
);
alter table disponibilidad_clase_muestra enable row level security;

drop policy if exists "ver disponibilidad clase muestra" on disponibilidad_clase_muestra;
create policy "ver disponibilidad clase muestra" on disponibilidad_clase_muestra
  for select using (true);

drop policy if exists "admin administra disponibilidad clase muestra" on disponibilidad_clase_muestra;
create policy "admin administra disponibilidad clase muestra" on disponibilidad_clase_muestra
  for all using (es_admin());

-- Citas agendadas por prospectos. Sin alumna_id: quien agenda no tiene
-- cuenta todavía.
create table if not exists citas_clase_muestra (
  id serial primary key,
  fecha date not null,
  hora time not null,
  nombre text not null,
  telefono text,
  cancelada boolean not null default false,
  created_at timestamptz not null default now()
);
alter table citas_clase_muestra enable row level security;

-- Evita que dos personas agenden el mismo horario si le dan "enviar" casi
-- al mismo tiempo (la segunda inserción truena con un error claro, que la
-- pantalla pública ya sabe mostrar). No aplica a citas ya canceladas, para
-- que ese horario se pueda volver a agendar después.
create unique index if not exists citas_clase_muestra_fecha_hora_activa
  on citas_clase_muestra (fecha, hora) where cancelada = false;

-- Cualquiera puede agendar (no puede crear una cita ya cancelada).
drop policy if exists "cualquiera agenda clase muestra" on citas_clase_muestra;
create policy "cualquiera agenda clase muestra" on citas_clase_muestra
  for insert with check (cancelada = false);

-- Solo la admin ve el detalle completo (nombre, teléfono) y puede cancelar.
drop policy if exists "admin ve citas clase muestra" on citas_clase_muestra;
create policy "admin ve citas clase muestra" on citas_clase_muestra
  for select using (es_admin());

drop policy if exists "admin cancela clase muestra" on citas_clase_muestra;
create policy "admin cancela clase muestra" on citas_clase_muestra
  for update using (es_admin());

-- El público necesita saber qué horarios YA NO están libres, sin ver
-- nombres ni teléfonos de nadie más. Esta función expone nada más
-- fecha+hora de las citas no canceladas — "security definer" hace que
-- corra con permisos de quien la creó (la admin), no de quien la llama,
-- así que no choca con la policy de "select" de arriba.
create or replace function slots_ocupados_clase_muestra()
returns table(fecha date, hora time)
language sql security definer stable set search_path = public as $$
  select fecha, hora from citas_clase_muestra
  where cancelada = false and fecha >= current_date;
$$;

grant execute on function slots_ocupados_clase_muestra() to anon, authenticated;
```

- [ ] **Step 2: Pegar el archivo completo en Supabase y correrlo**

Copia **todo** el contenido de `supabase/actualizaciones.sql` (no solo el bloque nuevo) y pégalo en el SQL Editor de Supabase → Run. Debe decir "Success. No rows returned".

- [ ] **Step 3: Verificar en el Table Editor de Supabase**

Confirma que aparecen las tablas `disponibilidad_clase_muestra` y `citas_clase_muestra` (Database → Tables), y que `citas_clase_muestra` tiene RLS activado (ícono de candado).

- [ ] **Step 4: Commit**

```bash
git add supabase/actualizaciones.sql
git commit -m "feat: esquema de Supabase para agendar clase muestra"
```

---

## Task 2: Cálculo de horarios disponibles (lógica pura, con pruebas)

**Files:**
- Modify: `app/lib/status.js`
- Test: `app/lib/status.test.js`

**Interfaces:**
- Consumes: `puedeApartar(fecha, hora, ahora)` (ya existe en `status.js`, exige al menos 1 hora de anticipación); `hoyISO(fecha)` de `app/lib/date-utils.js`.
- Produces: `slotsDisponiblesClaseMuestra(disponibilidad, ocupados, hoy, dias = 14) => {fecha: string, hora: string}[]`, ordenado por fecha y luego hora ascendente. `disponibilidad` es `{diaSemana: number, hora: string}[]` (0 = domingo, ya filtrada a solo activos por quien llama). `ocupados` es `{fecha: string, hora: string}[]`.

- [ ] **Step 1: Agregar el import de `hoyISO` en `status.js`**

`app/lib/status.js` ya importa de `./date-utils.js` en la línea 1. Cambia esa línea:

```javascript
import { parseFechaSQL, hoyISO } from './date-utils.js';
```

- [ ] **Step 2: Escribir las pruebas que fallan**

Agrega en `app/lib/status.test.js`, dentro del import de `status.js` (junto a las demás funciones importadas):

```javascript
  agruparAsistenciasPorPaquete, slotsDisponiblesClaseMuestra,
```

Y al final del archivo:

```javascript
test('slotsDisponiblesClaseMuestra genera un slot por cada franja de disponibilidad que caiga en el rango de días', () => {
  const hoy = new Date(2026, 7, 10, 8, 0); // lunes 10 de agosto de 2026, 8:00am
  const disponibilidad = [{ diaSemana: 1, hora: '10:00:00' }]; // lunes 10am
  const slots = slotsDisponiblesClaseMuestra(disponibilidad, [], hoy, 14);
  assert.deepEqual(slots, [
    { fecha: '2026-08-10', hora: '10:00:00' },
    { fecha: '2026-08-17', hora: '10:00:00' },
  ]);
});

test('slotsDisponiblesClaseMuestra excluye los horarios que ya tienen cita', () => {
  const hoy = new Date(2026, 7, 10, 8, 0);
  const disponibilidad = [{ diaSemana: 1, hora: '10:00:00' }];
  const ocupados = [{ fecha: '2026-08-10', hora: '10:00:00' }];
  const slots = slotsDisponiblesClaseMuestra(disponibilidad, ocupados, hoy, 14);
  assert.deepEqual(slots, [{ fecha: '2026-08-17', hora: '10:00:00' }]);
});

test('slotsDisponiblesClaseMuestra excluye horarios de hoy con menos de 1 hora de anticipación', () => {
  const hoy = new Date(2026, 7, 10, 9, 30); // lunes 10 de agosto, 9:30am
  const disponibilidad = [{ diaSemana: 1, hora: '10:00:00' }]; // hoy mismo a las 10am, faltan 30 min
  const slots = slotsDisponiblesClaseMuestra(disponibilidad, [], hoy, 14);
  assert.deepEqual(slots, [{ fecha: '2026-08-17', hora: '10:00:00' }]);
});

test('slotsDisponiblesClaseMuestra ordena por fecha y luego por hora', () => {
  const hoy = new Date(2026, 7, 10, 8, 0);
  const disponibilidad = [
    { diaSemana: 3, hora: '16:00:00' }, // miércoles
    { diaSemana: 1, hora: '10:00:00' }, // lunes
  ];
  const slots = slotsDisponiblesClaseMuestra(disponibilidad, [], hoy, 3);
  assert.deepEqual(slots, [{ fecha: '2026-08-10', hora: '10:00:00' }, { fecha: '2026-08-12', hora: '16:00:00' }]);
});
```

- [ ] **Step 3: Correr las pruebas y verificar que fallan**

Run: `npm test`
Expected: FAIL — `status.js does not provide an export named 'slotsDisponiblesClaseMuestra'`

- [ ] **Step 4: Implementar la función**

Agrega al final de `app/lib/status.js`:

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

- [ ] **Step 5: Correr las pruebas y verificar que pasan**

Run: `npm test`
Expected: PASS, todas las pruebas (las nuevas y las que ya existían)

- [ ] **Step 6: Commit**

```bash
git add app/lib/status.js app/lib/status.test.js
git commit -m "feat: calcular horarios disponibles de clase muestra, con pruebas"
```

---

## Task 3: Funciones de datos en `app/data.js`

**Files:**
- Modify: `app/data.js`

**Interfaces:**
- Consumes: `hoyISO()` (ya importado en `data.js`).
- Produces:
  - `listarDisponibilidadClaseMuestra(supabase) => Promise<{id, dia_semana, hora, activo}[]>`
  - `crearDisponibilidadClaseMuestra(supabase, {diaSemana, hora}) => Promise<void>`
  - `desactivarDisponibilidadClaseMuestra(supabase, id) => Promise<void>`
  - `listarSlotsOcupadosClaseMuestra(supabase) => Promise<{fecha, hora}[]>`
  - `agendarClaseMuestra(supabase, {fecha, hora, nombre, telefono}) => Promise<void>`
  - `listarCitasClaseMuestra(supabase) => Promise<{id, fecha, hora, nombre, telefono, cancelada, created_at}[]>`
  - `cancelarCitaClaseMuestra(supabase, citaId) => Promise<void>`

No lleva pruebas: mismo criterio que el resto de `data.js` (son wrappers delgados sobre Supabase, sin lógica propia que probar — la lógica real ya se probó en la Tarea 2). Se verifican de punta a punta en la Tarea 7.

- [ ] **Step 1: Agregar las funciones al final de `app/data.js`**

```javascript
export async function listarDisponibilidadClaseMuestra(supabase) {
  const { data, error } = await supabase
    .from('disponibilidad_clase_muestra')
    .select('*')
    .eq('activo', true)
    .order('dia_semana', { ascending: true })
    .order('hora', { ascending: true });
  if (error) throw error;
  return data;
}

export async function crearDisponibilidadClaseMuestra(supabase, { diaSemana, hora }) {
  const { error } = await supabase
    .from('disponibilidad_clase_muestra')
    .insert({ dia_semana: diaSemana, hora, activo: true });
  if (error) throw error;
}

export async function desactivarDisponibilidadClaseMuestra(supabase, id) {
  const { error } = await supabase
    .from('disponibilidad_clase_muestra')
    .update({ activo: false })
    .eq('id', id);
  if (error) throw error;
}

export async function listarSlotsOcupadosClaseMuestra(supabase) {
  const { data, error } = await supabase.rpc('slots_ocupados_clase_muestra');
  if (error) throw error;
  return data;
}

export async function agendarClaseMuestra(supabase, { fecha, hora, nombre, telefono }) {
  const { error } = await supabase
    .from('citas_clase_muestra')
    .insert({ fecha, hora, nombre, telefono });
  if (error) throw error;
}

export async function listarCitasClaseMuestra(supabase) {
  const { data, error } = await supabase
    .from('citas_clase_muestra')
    .select('*')
    .eq('cancelada', false)
    .gte('fecha', hoyISO())
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true });
  if (error) throw error;
  return data;
}

export async function cancelarCitaClaseMuestra(supabase, citaId) {
  const { error } = await supabase
    .from('citas_clase_muestra')
    .update({ cancelada: true })
    .eq('id', citaId);
  if (error) throw error;
}
```

- [ ] **Step 2: Verificar que el archivo carga sin errores de sintaxis**

Run: `node --check app/data.js`
Expected: sin salida (sin errores)

- [ ] **Step 3: Commit**

```bash
git add app/data.js
git commit -m "feat: funciones de datos para disponibilidad y citas de clase muestra"
```

---

## Task 4: HTML — pantalla pública y pestaña nueva en admin

**Files:**
- Modify: `index.html`

**Interfaces:**
- Produces: `#pantalla-clase-muestra` (pantalla pública, misma jerarquía que `#pantalla-auth`/`#pantalla-alumna`/`#pantalla-admin`) con `#clase-muestra-contenido` adentro; pestaña `d-muestra` en la barra de abajo de `#pantalla-admin` con `#d-muestra-disponibilidad`, `#form-disponibilidad-clase-muestra`, `#d-muestra-link` y `#d-muestra-citas`.

- [ ] **Step 1: Agregar la pantalla pública, después del cierre de `#pantalla-auth` (línea 40) y antes de `#switch-vistas`**

```html
<div class="pantalla" id="pantalla-clase-muestra" style="align-items:center;justify-content:center;padding:24px">
  <img src="assets/logo-morado.png" alt="Pump&Flow" style="height:50px;margin-bottom:18px">
  <div class="card" style="width:100%;max-width:340px">
    <h1 style="font:var(--text-h3);margin-bottom:4px">Agenda tu clase muestra</h1>
    <div id="clase-muestra-contenido"></div>
  </div>
</div>
```

- [ ] **Step 2: Agregar el botón de la pestaña, dentro de `.tabbar` de `#pantalla-admin` (después del botón `data-s="d-clases"`)**

```html
    <button class="tab" data-s="d-muestra"><i data-lucide="calendar-plus" class="ico"></i>Muestra</button>
```

- [ ] **Step 3: Agregar la pantalla de la pestaña, dentro de `.contenedor-app` de `#pantalla-admin`, después de `<div class="screen" id="d-clases">...</div>`**

```html
  <div class="screen" id="d-muestra">
    <h1>Clase muestra</h1>
    <div class="card">
      <b style="color:var(--text-title)">Tu link para compartir</b>
      <div class="dato"><span id="d-muestra-link" style="word-break:break-all"></span></div>
    </div>
    <div class="card">
      <b style="color:var(--text-title)">Disponibilidad</b>
      <div id="d-muestra-disponibilidad" style="margin-top:8px"></div>
      <form id="form-disponibilidad-clase-muestra" class="row" style="margin-top:10px;gap:8px">
        <label class="field" style="flex:1;margin-top:0"><span>Día</span>
          <select class="input" name="diaSemana">
            <option value="0">Domingo</option>
            <option value="1">Lunes</option>
            <option value="2">Martes</option>
            <option value="3">Miércoles</option>
            <option value="4">Jueves</option>
            <option value="5">Viernes</option>
            <option value="6">Sábado</option>
          </select>
        </label>
        <label class="field" style="flex:1;margin-top:0"><span>Hora</span><input class="input" type="time" name="hora" required></label>
        <button class="pillbtn soft" type="submit" style="padding:7px 16px;min-height:36px;font-size:13px;align-self:flex-end">Agregar</button>
      </form>
    </div>
    <div class="card">
      <b style="color:var(--text-title)">Próximas citas</b>
      <div id="d-muestra-citas" style="margin-top:8px"></div>
    </div>
  </div>
```

- [ ] **Step 4: Verificar visualmente que el HTML es válido**

Abre `index.html` en el navegador directamente (doble click, o `open index.html`). Debe seguir cargando la pantalla de login sin errores en la consola del navegador (aunque la pestaña "Muestra" y la pantalla pública todavía no tengan lógica — eso es de las Tareas 5 y 6).

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: HTML de la pantalla pública y la pestaña de clase muestra"
```

---

## Task 5: Pantalla pública — agendar sin cuenta

**Files:**
- Create: `app/clase-muestra.js`
- Modify: `app/app.js`

**Interfaces:**
- Consumes: de `app/data.js` (Tarea 3) — `listarDisponibilidadClaseMuestra`, `listarSlotsOcupadosClaseMuestra`, `agendarClaseMuestra`; de `app/lib/status.js` (Tarea 2) — `slotsDisponiblesClaseMuestra`; de `app/lib/date-utils.js` — `formatDiaMesConDia`, `formatHora12`; de `app/lib/escape.js` — `escaparHTML`; de `app/ui.js` — `mostrarErrorCerca`.
- Produces: `montarClaseMuestra({ supabase }) => Promise<void>`, exportada desde `app/clase-muestra.js`.

- [ ] **Step 1: Crear `app/clase-muestra.js`**

```javascript
import { listarDisponibilidadClaseMuestra, listarSlotsOcupadosClaseMuestra, agendarClaseMuestra } from './data.js';
import { formatDiaMesConDia, formatHora12 } from './lib/date-utils.js';
import { escaparHTML } from './lib/escape.js';
import { slotsDisponiblesClaseMuestra } from './lib/status.js';
import { mostrarErrorCerca } from './ui.js';

export async function montarClaseMuestra({ supabase }) {
  const cont = document.getElementById('clase-muestra-contenido');
  cont.innerHTML = '<div class="muted">Cargando horarios…</div>';
  const [disponibilidad, ocupados] = await Promise.all([
    listarDisponibilidadClaseMuestra(supabase),
    listarSlotsOcupadosClaseMuestra(supabase),
  ]);
  const disponibilidadMapeada = disponibilidad.map((d) => ({ diaSemana: d.dia_semana, hora: d.hora }));
  const slots = slotsDisponiblesClaseMuestra(disponibilidadMapeada, ocupados, new Date());
  renderSlots(supabase, cont, slots);
}

function renderSlots(supabase, cont, slots) {
  if (slots.length === 0) {
    cont.innerHTML = '<div class="muted" style="margin-top:12px">No hay horarios disponibles por ahora. Escríbele a Caro directo.</div>';
    return;
  }
  cont.innerHTML = `
    <div class="muted" style="margin:8px 0 12px">Elige un horario:</div>
    <div id="clase-muestra-slots">
      ${slots.map((s, i) => `<button type="button" class="pillbtn soft slot-clase-muestra" data-i="${i}" style="width:100%;margin-bottom:8px;text-align:left">${escaparHTML(formatDiaMesConDia(s.fecha))} · ${escaparHTML(formatHora12(s.hora))}</button>`).join('')}
    </div>`;
  cont.querySelectorAll('.slot-clase-muestra').forEach((btn) => {
    btn.addEventListener('click', () => renderFormulario(supabase, cont, slots[Number(btn.dataset.i)]));
  });
}

function renderFormulario(supabase, cont, slot) {
  cont.innerHTML = `
    <div class="muted" style="margin-top:8px">${escaparHTML(formatDiaMesConDia(slot.fecha))} · ${escaparHTML(formatHora12(slot.hora))}</div>
    <form id="form-clase-muestra" style="margin-top:12px">
      <label class="field"><span>Nombre</span><input class="input" type="text" name="nombre" required></label>
      <label class="field"><span>Teléfono</span><input class="input" type="tel" name="telefono" required></label>
      <button class="pillbtn" type="submit" style="width:100%;margin-top:16px">Agendar</button>
      <button class="link-suave" type="button" id="btn-otro-horario" style="width:100%;text-align:center">Elegir otro horario</button>
    </form>`;
  document.getElementById('btn-otro-horario').addEventListener('click', () => montarClaseMuestra({ supabase }));
  document.getElementById('form-clase-muestra').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = e.submitter ?? e.target.querySelector('button[type="submit"]');
    if (boton) boton.disabled = true;
    const formData = new FormData(e.target);
    try {
      await agendarClaseMuestra(supabase, {
        fecha: slot.fecha,
        hora: slot.hora,
        nombre: formData.get('nombre'),
        telefono: formData.get('telefono'),
      });
      cont.innerHTML = `<div class="badge ok" style="display:block;text-align:center;padding:14px;margin-top:12px">¡Listo! Tu clase muestra quedó agendada para ${escaparHTML(formatDiaMesConDia(slot.fecha))} a las ${escaparHTML(formatHora12(slot.hora))}. Caro te espera 🤍</div>`;
    } catch (err) {
      if (boton) boton.disabled = false;
      mostrarErrorCerca(boton ?? e.target, `No se pudo agendar: ${err.message}`);
    }
  });
}
```

- [ ] **Step 2: Modificar `app/app.js` para servir esta pantalla antes del login**

Reemplaza la función `mostrarPantalla` (líneas 12-17) para que no dependa de una lista fija de pantallas:

```javascript
function mostrarPantalla(id) {
  document.querySelectorAll('.pantalla').forEach((p) => p.classList.remove('on'));
  document.getElementById(id).classList.add('on');
}
```

Y agrega el import de `montarClaseMuestra` junto a los demás imports (línea 5):

```javascript
import { montarVistaAdmin } from './admin.js';
import { montarClaseMuestra } from './clase-muestra.js';
```

Por último, envuelve el bloque final del archivo (el `try { const sesion = ... }` de las líneas 104-115) así:

```javascript
const params = new URLSearchParams(location.search);
if (params.get('agenda') === 'clase-muestra') {
  mostrarPantalla('pantalla-clase-muestra');
  await montarClaseMuestra({ supabase });
} else {
  try {
    const sesion = await obtenerSesionActual();
    if (sesion) {
      await entrarConSesion(sesion);
    } else {
      mostrarPantalla('pantalla-auth');
    }
  } catch (err) {
    switchVistas.style.display = 'none';
    mostrarPantalla('pantalla-auth');
    alert(`No pudimos abrir tu sesión: ${err.message}\n\nRecarga la página, por favor 🤍`);
  }
}
```

- [ ] **Step 3: Verificar que no hay errores de sintaxis**

Run: `node --check app/app.js && node --check app/clase-muestra.js`
Expected: sin salida (sin errores)

- [ ] **Step 4: Commit**

```bash
git add app/clase-muestra.js app/app.js
git commit -m "feat: pantalla pública para agendar clase muestra sin cuenta"
```

---

## Task 6: Vista admin — disponibilidad y citas de clase muestra

**Files:**
- Modify: `app/admin.js`

**Interfaces:**
- Consumes: de `app/data.js` (Tarea 3) — `listarDisponibilidadClaseMuestra`, `crearDisponibilidadClaseMuestra`, `desactivarDisponibilidadClaseMuestra`, `listarCitasClaseMuestra`, `cancelarCitaClaseMuestra`; `montarVistaAdmin` (ya existe en este archivo) pasa a llamar también `renderMuestraAdmin`.
- Produces: `renderMuestraAdmin(supabase) => Promise<void>` (función interna del módulo, sin exportar — mismo patrón que `renderClasesAdmin`).

- [ ] **Step 1: Agregar las funciones nuevas al import de `./data.js` (línea 1-8)**

```javascript
import {
  listarClasesDeHoy, listarReservasDeClase, confirmarAsistencia, cancelarReserva,
  listarAlumnas, obtenerFichaAlumna, activarPaquete, crearValoracion,
  listarClasesProximas, listarPaquetesActivos, listarAlumnaIdsConValoracion,
  actualizarClasesUsadas, crearAlumnaManual, cancelarClase,
  crearHorarioRecurrente, crearClaseEspecial, generarClases,
  marcarAsistenciaManual, borrarAsistencia,
  actualizarFechaPago, actualizarPagado, agregarPaqueteHistorico,
  listarDisponibilidadClaseMuestra, crearDisponibilidadClaseMuestra,
  desactivarDisponibilidadClaseMuestra, listarCitasClaseMuestra, cancelarCitaClaseMuestra,
} from './data.js';
```

- [ ] **Step 2: Agregar la constante de días de la semana, junto a `CAMPOS_VALORACION` (cerca de la línea 18)**

```javascript
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
```

- [ ] **Step 3: Agregar `renderMuestraAdmin` al final del archivo**

```javascript
async function renderMuestraAdmin(supabase) {
  const link = `${location.origin}${location.pathname}?agenda=clase-muestra`;
  document.getElementById('d-muestra-link').textContent = link;

  const [disponibilidad, citas] = await Promise.all([
    listarDisponibilidadClaseMuestra(supabase),
    listarCitasClaseMuestra(supabase),
  ]);

  const contDisponibilidad = document.getElementById('d-muestra-disponibilidad');
  contDisponibilidad.innerHTML = disponibilidad.map((d) => `
    <div class="dato">
      <span>${escaparHTML(DIAS_SEMANA[d.dia_semana])} · ${escaparHTML(formatHora12(d.hora))}</span>
      <button class="link-suave btn-quitar-disponibilidad" data-id="${escaparHTML(d.id)}" style="padding:0;color:var(--pf-error)">Quitar</button>
    </div>`).join('') || '<div class="muted">Sin horarios definidos todavía</div>';

  const contCitas = document.getElementById('d-muestra-citas');
  contCitas.innerHTML = citas.map((c) => `
    <div class="dato">
      <span>${escaparHTML(formatDiaMesConDia(c.fecha))} · ${escaparHTML(formatHora12(c.hora))} · ${escaparHTML(c.nombre)}${c.telefono ? ` · ${escaparHTML(c.telefono)}` : ''}</span>
      <button class="link-suave btn-cancelar-clase-muestra" data-id="${escaparHTML(c.id)}" style="padding:0;color:var(--pf-error)">Cancelar</button>
    </div>`).join('') || '<div class="muted">Sin citas próximas</div>';

  contDisponibilidad.querySelectorAll('.btn-quitar-disponibilidad').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Quitar este horario de disponibilidad para clase muestra?')) return;
      btn.disabled = true;
      try {
        await desactivarDisponibilidadClaseMuestra(supabase, Number(btn.dataset.id));
        await renderMuestraAdmin(supabase);
      } catch (err) {
        btn.disabled = false;
        mostrarErrorCerca(btn, `No se pudo quitar: ${err.message}`);
      }
    });
  });

  contCitas.querySelectorAll('.btn-cancelar-clase-muestra').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Cancelar esta clase muestra?')) return;
      btn.disabled = true;
      try {
        await cancelarCitaClaseMuestra(supabase, Number(btn.dataset.id));
        await renderMuestraAdmin(supabase);
      } catch (err) {
        btn.disabled = false;
        mostrarErrorCerca(btn, `No se pudo cancelar: ${err.message}`);
      }
    });
  });

  document.getElementById('form-disponibilidad-clase-muestra').addEventListener('submit', async (e) => {
    e.preventDefault();
    const boton = e.submitter ?? e.target.querySelector('button[type="submit"]');
    if (boton) boton.disabled = true;
    const formData = new FormData(e.target);
    try {
      await crearDisponibilidadClaseMuestra(supabase, {
        diaSemana: Number(formData.get('diaSemana')),
        hora: formData.get('hora'),
      });
      await renderMuestraAdmin(supabase);
    } catch (err) {
      if (boton) boton.disabled = false;
      mostrarErrorCerca(boton ?? e.target, `No se pudo agregar: ${err.message}`);
    }
  });
}
```

- [ ] **Step 4: Llamar `renderMuestraAdmin` desde `montarVistaAdmin`**

En `montarVistaAdmin` (línea 40-50), cambia la línea del `Promise.all`:

```javascript
  await Promise.all([renderHoy(supabase, resumen), renderAlumnas(supabase, resumen), renderClasesAdmin(supabase), renderMuestraAdmin(supabase)]);
```

- [ ] **Step 5: Verificar que no hay errores de sintaxis**

Run: `node --check app/admin.js`
Expected: sin salida (sin errores)

- [ ] **Step 6: Correr toda la suite de pruebas**

Run: `npm test`
Expected: PASS, todas las pruebas

- [ ] **Step 7: Commit**

```bash
git add app/admin.js
git commit -m "feat: vista admin para disponibilidad y citas de clase muestra"
```

---

## Task 7: Verificación de punta a punta con datos reales

**Files:** ninguno (solo verificación manual)

**Nota:** este plan corre en un worktree aislado. Esta tarea se ejecuta DESPUÉS de que `finishing-a-development-branch` integre la rama a `main` y esos commits se suban — no como parte del loop de subagentes, porque necesita el sitio real (GitHub Pages, que sirve desde `main`) y la base de datos real de Supabase.

- [ ] **Step 1: Push a producción**

```bash
git push origin main
```

Espera a que el deploy de GitHub Pages termine (normalmente menos de un minuto).

- [ ] **Step 2: Definir disponibilidad**

Entra a tu cuenta de admin en la app real, pestaña "Muestra". Agrega 1-2 franjas de disponibilidad (ej. hoy más tarde, o mañana). Confirma que aparecen en la lista.

- [ ] **Step 3: Agendar como prospecto**

Copia el link que aparece en "Tu link para compartir" y ábrelo en una ventana privada/incógnito (para simular que no tienes sesión iniciada). Confirma que ves los horarios que acabas de definir, agenda uno con un nombre y teléfono de prueba, y confirma que aparece el mensaje de "¡Listo!".

- [ ] **Step 4: Verificar en el admin**

Vuelve a tu sesión de admin, pestaña "Muestra". Confirma que la cita de prueba aparece en "Próximas citas" con el nombre y teléfono correctos, y que ese horario ya no aparece como disponible si vuelves a abrir el link público.

- [ ] **Step 5: Cancelar la cita de prueba**

Dale "Cancelar" a esa cita desde el admin. Confirma que desaparece de la lista, y que si vuelves a abrir el link público, ese horario vuelve a estar disponible.

- [ ] **Step 6: Limpiar los datos de prueba**

En el Table Editor de Supabase, borra cualquier fila de prueba que haya quedado en `disponibilidad_clase_muestra` y `citas_clase_muestra` (si no las borraste ya desde la app), para no dejar horarios ni citas falsas en el negocio real de Caro.
