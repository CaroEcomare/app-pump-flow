# Conectar la app Pump&Flow a Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la app real de Pump&Flow (login, vista alumna, vista admin, valoraciones, generación de clases) conectada a Supabase, siguiendo el spec en `docs/superpowers/specs/2026-08-08-conectar-supabase-design.md`.

**Architecture:** HTML/CSS/JS planos sin build ni framework, `@supabase/supabase-js` v2 vía CDN ESM (`https://esm.sh/@supabase/supabase-js@2`). Lógica de negocio pura separada en módulos testeables con el test runner nativo de Node (`node --test`); el acceso a Supabase vive en módulos delgados sin lógica propia que testear con unidad, verificados manualmente contra el proyecto real. GitHub Pages sirve el repo desde la raíz de `main`.

**Tech Stack:** HTML5, CSS3 (variables del kit de diseño), JavaScript ESM nativo del navegador, `@supabase/supabase-js@2`, Node.js v22 (`node --test`) solo para pruebas locales de la lógica pura, Supabase (Postgres + Auth + RLS ya configurado).

## Global Constraints

- Sin build step: nada de bundlers, nada de npm en el navegador. El único uso de `package.json`/`node_modules` es para correr pruebas locales de la lógica pura con `node --test`; no se despliega.
- Voz de marca en copy nuevo: tú, cálida, sin comparaciones "no es esto...es esto otro", sin guiones medios (—), emoji solo 🤍 ✨ 🧘🏽‍♀️ (ver `Sistema de diseño para marca/readme.md`).
- Colores/tipografía/radios/sombras: usar únicamente las variables ya definidas en los tokens del kit (`--pf-*`, `--text-*`, `--radius-*`, `--shadow-*`, etc.), copiadas a `app/styles.css` en la Tarea 0. No inventar colores nuevos.
- Todas las fechas de Postgres (`date`) se parsean con `parseFechaSQL` (Tarea 1), nunca con `new Date(fechaISO)` directo, para evitar corrimientos de zona horaria.
- Las URL/llave de Supabase (`https://euhltloldxnbjbizmwze.supabase.co` / `sb_publishable_e7ynsWO1oaQj58lDg1zuQg_DT8aCKB9`) son públicas por diseño (llave anónima); no se tratan como secreto.
- No se crean filas de prueba (alumnas, reservas, valoraciones, etc.) en el proyecto real de Supabase de Caro durante la implementación — es su base de datos de producción. La verificación end-to-end con datos reales queda para la Tarea 10, que la ejecuta Caro con su propia cuenta.
- No se activa GitHub Pages sin confirmación explícita de Caro (Tarea 10).

---

## Mapa de archivos

```
app-pump-flow/
├── index.html                     (Tarea 6) shell: pantalla auth + pantalla alumna + pantalla admin
├── app/
│   ├── styles.css                 (Tarea 0 + Tarea 6) tokens del kit + estilos de la app
│   ├── supabase-client.js         (Tarea 4) cliente Supabase
│   ├── data.js                    (Tarea 4) acceso a datos (queries/mutations)
│   ├── auth.js                    (Tarea 5) registro/login/logout/rol
│   ├── alumna.js                  (Tarea 7) lógica de pantallas de alumna
│   ├── admin.js                   (Tarea 8) lógica de pantallas de admin
│   ├── app.js                     (Tarea 9) bootstrap y ruteo por rol
│   └── lib/
│       ├── date-utils.js          (Tarea 1) helpers de fecha puros
│       ├── date-utils.test.js     (Tarea 1)
│       ├── status.js              (Tarea 2) reglas de negocio puras
│       └── status.test.js         (Tarea 2)
├── assets/                        (Tarea 0) logo-blanco.png, logo-morado.png
├── supabase/
│   └── actualizaciones.sql        (Tarea 3) función generar_clases + policy faltante
├── package.json                   (Tarea 0) solo para `node --test`
└── .gitignore                     (Tarea 0) + node_modules
```

---

### Task 0: Scaffold del proyecto

**Files:**
- Create: `package.json`
- Create: `assets/logo-blanco.png`, `assets/logo-morado.png` (copiados)
- Modify: `.gitignore`

**Interfaces:**
- Produces: carpetas `app/`, `app/lib/`, `assets/`, `supabase/` listas para las tareas siguientes; comando `npm test` funcionando (aunque no haya tests todavía).

- [ ] **Step 1: Crear carpetas y copiar assets**

```bash
mkdir -p app/lib assets supabase
cp "Sistema de diseño para marca/assets/logo-blanco.png" assets/logo-blanco.png
cp "Sistema de diseño para marca/assets/logo-morado.png" assets/logo-morado.png
```

- [ ] **Step 2: Crear `package.json`**

```json
{
  "name": "app-pump-flow",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test app/lib/*.test.js"
  }
}
```

- [ ] **Step 3: Actualizar `.gitignore`**

Agregar una línea `node_modules/` al `.gitignore` existente (no lo reemplaces, solo añade la línea).

- [ ] **Step 4: Verificar que el comando de pruebas corre sin errores aunque no haya tests aún**

Run: `npm test`
Expected: `node --test` termina con "tests 0" (sin archivos `*.test.js` todavía) y código de salida 0.

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore assets/logo-blanco.png assets/logo-morado.png
git commit -m "chore: scaffold de la app real (carpetas, package.json, assets)"
```

---

### Task 1: `app/lib/date-utils.js` — helpers de fecha puros

**Files:**
- Create: `app/lib/date-utils.js`
- Test: `app/lib/date-utils.test.js`

**Interfaces:**
- Produces:
  - `parseFechaSQL(fechaISO: string) => Date` (fecha local, sin corrimiento UTC)
  - `hoyISO(fecha?: Date) => string` ("YYYY-MM-DD")
  - `esHoy(fechaISO: string, hoy?: Date) => boolean`
  - `formatHora12(horaSQL: string) => string` (ej. "19:15:00" → "7:15 pm")
  - `formatDiaMes(fechaISO: string) => string` (ej. "11 de agosto")
  - `formatDiaMesConDia(fechaISO: string) => string` (ej. "martes 11 de agosto")
  - `formatMesAno(fechaISO: string) => string` (ej. "marzo de 2026")
  - `formatFechaCompleta(fechaISO: string) => string` (ej. "4 de agosto de 2026")
- Consumido por: `app/lib/status.js` (Tarea 2), `app/data.js` (Tarea 4), `app/alumna.js` (Tarea 7), `app/admin.js` (Tarea 8).

- [ ] **Step 1: Escribir las pruebas primero**

Crear `app/lib/date-utils.test.js`:

```js
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
```

- [ ] **Step 2: Correr las pruebas y confirmar que fallan**

Run: `npm test`
Expected: FAIL — `Cannot find module './date-utils.js'` (el archivo no existe todavía).

- [ ] **Step 3: Implementar `app/lib/date-utils.js`**

```js
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function parseFechaSQL(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function hoyISO(fecha = new Date()) {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function esHoy(fechaISO, hoy = new Date()) {
  const fecha = parseFechaSQL(fechaISO);
  return fecha.getFullYear() === hoy.getFullYear()
    && fecha.getMonth() === hoy.getMonth()
    && fecha.getDate() === hoy.getDate();
}

export function formatHora12(horaSQL) {
  const [hStr, mStr] = horaSQL.split(':');
  let h = Number(hStr);
  const m = mStr.padStart(2, '0');
  const sufijo = h >= 12 ? 'pm' : 'am';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${sufijo}`;
}

export function formatDiaMes(fechaISO) {
  const fecha = parseFechaSQL(fechaISO);
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

export function formatDiaMesConDia(fechaISO) {
  const fecha = parseFechaSQL(fechaISO);
  return `${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

export function formatMesAno(fechaISO) {
  const fecha = parseFechaSQL(fechaISO);
  return `${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

export function formatFechaCompleta(fechaISO) {
  const fecha = parseFechaSQL(fechaISO);
  return `${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}
```

- [ ] **Step 4: Correr las pruebas y confirmar que pasan**

Run: `npm test`
Expected: PASS — 8 tests, 0 fallos.

- [ ] **Step 5: Commit**

```bash
git add app/lib/date-utils.js app/lib/date-utils.test.js
git commit -m "feat: helpers de fecha puros con pruebas"
```

---

### Task 2: `app/lib/status.js` — reglas de negocio puras

**Files:**
- Create: `app/lib/status.js`
- Test: `app/lib/status.test.js`

**Interfaces:**
- Consumes: `parseFechaSQL` de `app/lib/date-utils.js` (Tarea 1).
- Produces:
  - `cupoDisponible(cupoTotal: number, reservasCount: number) => number`
  - `puntosCupo(cupoTotal: number, reservasCount: number) => boolean[]` (true = ocupado)
  - `estadoClase(cupoTotal: number, reservasCount: number) => 'llena' | 'disponible'`
  - `proximaReserva(reservas: {claseId, fecha, hora}[], hoyISOStr: string) => {claseId, fecha, hora} | null`
  - `estadoPaquete(paquete: {activo, vence} | null, hoyISOStr: string) => 'sin_paquete' | 'al_dia' | 'por_pagar'`
  - `paqueteVenceEnDias(paquete: {activo, vence} | null, hoyISOStr: string, dias?: number) => boolean`
  - `estadoAsistenciaBadge(asistencia: {checkin_alumna, confirmada_admin} | null) => 'confirmada' | 'pendiente' | 'sin_checkin'`
  - `siguienteNumeroValoracion(valoraciones: {numero: number}[]) => number`
  - `tieneValoraciones(valoraciones: unknown[]) => boolean`
  - `inicialAvatar(nombre: string) => string`
- Consumido por: `app/data.js` (Tarea 4), `app/alumna.js` (Tarea 7), `app/admin.js` (Tarea 8).

- [ ] **Step 1: Escribir las pruebas primero**

Crear `app/lib/status.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cupoDisponible, puntosCupo, estadoClase, proximaReserva,
  estadoPaquete, paqueteVenceEnDias, estadoAsistenciaBadge,
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

test('proximaReserva ignora pasadas y toma la más próxima futura', () => {
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

test('estadoAsistenciaBadge cubre los tres estados', () => {
  assert.equal(estadoAsistenciaBadge(null), 'sin_checkin');
  assert.equal(estadoAsistenciaBadge({ checkin_alumna: '2026-08-11T19:00:00Z', confirmada_admin: null }), 'pendiente');
  assert.equal(estadoAsistenciaBadge({ checkin_alumna: '2026-08-11T19:00:00Z', confirmada_admin: '2026-08-11T19:20:00Z' }), 'confirmada');
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
Expected: FAIL — `Cannot find module './status.js'`.

- [ ] **Step 3: Implementar `app/lib/status.js`**

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

export function proximaReserva(reservas, hoyISOStr) {
  const futuras = reservas
    .filter((r) => r.fecha >= hoyISOStr)
    .sort((a, b) => (a.fecha === b.fecha
      ? a.hora.localeCompare(b.hora)
      : a.fecha.localeCompare(b.fecha)));
  return futuras[0] ?? null;
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
  if (!asistencia) return 'sin_checkin';
  if (asistencia.confirmada_admin) return 'confirmada';
  if (asistencia.checkin_alumna) return 'pendiente';
  return 'sin_checkin';
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
Expected: PASS — 20 tests en total entre los dos archivos, 0 fallos.

- [ ] **Step 5: Commit**

```bash
git add app/lib/status.js app/lib/status.test.js
git commit -m "feat: reglas de negocio puras (cupo, paquete, asistencia, valoraciones) con pruebas"
```

---

### Task 3: SQL de Supabase — generación de clases y permiso faltante

**Contexto para quien implemente:** las tablas y la mayoría de las políticas de seguridad (RLS) ya existen en el proyecto de Supabase de Caro (ella corrió `Sistema de diseño para marca/ui_kits/app/supabase.sql`). Falta agregar dos cosas ahí: una función que genere las clases de las próximas 4 semanas, y una política de seguridad que hoy falta — sin ella, cuando la admin confirma la asistencia de alguien que nunca hizo check-in, Supabase rechaza la operación (la política actual de `asistencias` solo deja insertar filas donde `alumna_id = auth.uid()`, es decir, solo la propia alumna puede crear su fila; la admin no puede crear una fila de asistencia a nombre de otra persona). Este SQL no se puede correr desde esta máquina: no tenemos las credenciales de servidor de su proyecto, solo la llave pública. Se entrega listo para que Caro lo pegue en el SQL Editor de Supabase, igual que hizo con el archivo original.

**Files:**
- Create: `supabase/actualizaciones.sql`

**Interfaces:**
- Produces: función RPC `generar_clases()` invocable desde el cliente (usada por `app/data.js` en la Tarea 4) y política `admin crea asistencia` sobre la tabla `asistencias`.

- [ ] **Step 1: Escribir `supabase/actualizaciones.sql`**

```sql
-- ============================================
-- Pump&Flow — Actualizaciones para conectar la app
-- Pega TODO este archivo en el SQL Editor de Supabase y córrelo,
-- igual que hiciste con supabase.sql.
-- ============================================

-- Permite que la administradora confirme la asistencia de una alumna
-- aunque esa alumna nunca haya hecho su propio check-in (hoy solo la
-- propia alumna puede crear su fila en "asistencias").
create policy "admin crea asistencia" on asistencias
  for insert with check (es_admin());

-- Genera las clases faltantes de las próximas 4 semanas a partir de
-- los horarios activos. Es "security definer" para que cualquier
-- alumna que entre a la app también pueda dispararla (ella no tiene
-- permiso directo para crear filas en "clases", pero la función corre
-- con los permisos de quien la creó).
create or replace function generar_clases()
returns void language plpgsql security definer set search_path = public as $$
declare
  h record;
  fecha_cursor date;
  fecha_limite date := current_date + interval '4 weeks';
begin
  for h in select * from horarios where activo = true loop
    fecha_cursor := current_date;
    while fecha_cursor <= fecha_limite loop
      if extract(dow from fecha_cursor) = h.dia_semana then
        insert into clases (horario_id, fecha, cupo)
        values (h.id, fecha_cursor, h.cupo)
        on conflict (horario_id, fecha) do nothing;
      end if;
      fecha_cursor := fecha_cursor + 1;
    end loop;
  end loop;
end;
$$;

grant execute on function generar_clases() to authenticated;
```

- [ ] **Step 2: Verificación (instrucciones para Caro, no automatizable desde aquí)**

Documentar en el propio mensaje de entrega de esta tarea, para que Caro lo haga una sola vez:

1. Entra a tu proyecto en supabase.com → SQL Editor.
2. Pega el contenido completo de `supabase/actualizaciones.sql` y dale "Run".
3. Para confirmar que la función quedó bien, corre esta consulta aparte en el mismo editor:
   ```sql
   select generar_clases();
   select fecha, horario_id from clases order by fecha;
   ```
   Debe mostrar filas nuevas en `clases` para los próximos martes, miércoles, jueves y viernes dentro de las próximas 4 semanas, según tus horarios activos.

- [ ] **Step 3: Commit**

```bash
git add supabase/actualizaciones.sql
git commit -m "feat: SQL de generación de clases y permiso de admin para asistencias"
```

Nota: este commit sube el *archivo* SQL al repo (para que quede documentado y versionado). Ejecutarlo en Supabase es un paso manual que le toca a Caro — avísale explícitamente cuando lleguen a esta tarea.

---

### Task 4: `app/supabase-client.js` y `app/data.js` — capa de datos

**Files:**
- Create: `app/supabase-client.js`
- Create: `app/data.js`

**Interfaces:**
- Consumes: `hoyISO` de `app/lib/date-utils.js` (Tarea 1).
- Produces (todas reciben `supabase` como primer argumento):
  - `crearPerfilAlumna(supabase, {id, nombre, telefono}) => Promise<void>`
  - `obtenerPerfil(supabase, userId) => Promise<{id, nombre, telefono, es_admin, fecha_alta}>` (lanza si no existe)
  - `obtenerPerfilOpcional(supabase, userId) => Promise<perfil | null>`
  - `listarClasesProximas(supabase, semanas?) => Promise<{id, fecha, cupo, horario_id, horarios: {hora}, reservasCount}[]>`
  - `obtenerMisReservas(supabase, alumnaId) => Promise<{reservaId, claseId, fecha, hora}[]>`
  - `hacerCheckin(supabase, alumnaId, claseId) => Promise<void>`
  - `apartarLugar(supabase, alumnaId, claseId) => Promise<void>` (puede lanzar si la clase está llena)
  - `obtenerPaqueteActivo(supabase, alumnaId) => Promise<paquete | null>`
  - `obtenerMisAsistencias(supabase, alumnaId) => Promise<{id, checkinAlumna, confirmadaAdmin, fecha, hora}[]>`
  - `listarAlumnas(supabase) => Promise<{id, nombre, telefono, fecha_alta, es_admin}[]>`
  - `obtenerClaseDeHoy(supabase) => Promise<{id, fecha, horarios: {hora}} | null>`
  - `listarReservasDeClase(supabase, claseId) => Promise<{alumnaId, nombre, asistencia: {alumna_id, checkin_alumna, confirmada_admin} | null}[]>`
  - `confirmarAsistencia(supabase, alumnaId, claseId) => Promise<void>`
  - `listarValoraciones(supabase, alumnaId) => Promise<valoracion[]>` (más reciente primero)
  - `crearValoracion(supabase, alumnaId, campos, numero) => Promise<void>`
  - `obtenerFichaAlumna(supabase, alumnaId) => Promise<{alumna, paquete, valoraciones, asistencias}>`
  - `activarPaquete(supabase, alumnaId, {tipo, clasesTotales, monto, formaPago, fechaPago, vence}) => Promise<void>`
  - `generarClases(supabase) => Promise<void>`
- Consumido por: `app/auth.js` (Tarea 5), `app/alumna.js` (Tarea 7), `app/admin.js` (Tarea 8), `app/app.js` (Tarea 9).

- [ ] **Step 1: Implementar `app/supabase-client.js`**

```js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://euhltloldxnbjbizmwze.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_e7ynsWO1oaQj58lDg1zuQg_DT8aCKB9';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

- [ ] **Step 2: Implementar `app/data.js`**

```js
import { hoyISO } from './lib/date-utils.js';

export async function crearPerfilAlumna(supabase, { id, nombre, telefono }) {
  const { error } = await supabase.from('alumnas').insert({ id, nombre, telefono });
  if (error) throw error;
}

export async function obtenerPerfil(supabase, userId) {
  const { data, error } = await supabase
    .from('alumnas')
    .select('id, nombre, telefono, es_admin, fecha_alta')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function obtenerPerfilOpcional(supabase, userId) {
  const { data, error } = await supabase
    .from('alumnas')
    .select('id, nombre, telefono, es_admin, fecha_alta')
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

export async function hacerCheckin(supabase, alumnaId, claseId) {
  const { error } = await supabase
    .from('asistencias')
    .upsert(
      { alumna_id: alumnaId, clase_id: claseId, checkin_alumna: new Date().toISOString() },
      { onConflict: 'alumna_id,clase_id' },
    );
  if (error) throw error;
}

export async function apartarLugar(supabase, alumnaId, claseId) {
  const { error } = await supabase.from('reservas').insert({ alumna_id: alumnaId, clase_id: claseId });
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

export async function obtenerMisAsistencias(supabase, alumnaId) {
  const { data, error } = await supabase
    .from('asistencias')
    .select('id, checkin_alumna, confirmada_admin, clases(fecha, horarios(hora))')
    .eq('alumna_id', alumnaId)
    .order('id', { ascending: false });
  if (error) throw error;
  return data.map((a) => ({
    id: a.id,
    checkinAlumna: a.checkin_alumna,
    confirmadaAdmin: a.confirmada_admin,
    fecha: a.clases.fecha,
    hora: a.clases.horarios.hora,
  }));
}

export async function listarAlumnas(supabase) {
  const { data, error } = await supabase
    .from('alumnas')
    .select('id, nombre, telefono, fecha_alta, es_admin')
    .order('nombre', { ascending: true });
  if (error) throw error;
  return data;
}

export async function obtenerClaseDeHoy(supabase) {
  const { data, error } = await supabase
    .from('clases')
    .select('id, fecha, horarios(hora)')
    .eq('fecha', hoyISO())
    .eq('cancelada', false)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listarReservasDeClase(supabase, claseId) {
  const [{ data: reservas, error: e1 }, { data: asistencias, error: e2 }] = await Promise.all([
    supabase.from('reservas').select('id, alumna_id, alumnas(nombre)').eq('clase_id', claseId),
    supabase.from('asistencias').select('alumna_id, checkin_alumna, confirmada_admin').eq('clase_id', claseId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const asistenciaPorAlumna = new Map(asistencias.map((a) => [a.alumna_id, a]));
  return reservas.map((r) => ({
    alumnaId: r.alumna_id,
    nombre: r.alumnas.nombre,
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
```

- [ ] **Step 3: Verificar que no hay errores de sintaxis**

Run: `node --check app/supabase-client.js && node --check app/data.js`
Expected: sin salida (sin errores). `node --check` no ejecuta imports de red, solo valida sintaxis, así que funciona sin conexión a Supabase.

- [ ] **Step 4: Commit**

```bash
git add app/supabase-client.js app/data.js
git commit -m "feat: cliente de Supabase y capa de acceso a datos"
```

---

### Task 5: `app/auth.js` — registro, login, logout y resolución de rol

**Contexto importante para quien implemente:** Supabase manda un correo de confirmación al registrarse (comportamiento default). Mientras la alumna no confirme su correo, **no hay sesión activa** — así que no se puede crear su fila en `alumnas` justo después de `signUp()` (las políticas de seguridad exigen `auth.uid() = id`, y sin sesión `auth.uid()` es nulo, la inserción sería rechazada). Por eso el nombre/teléfono se guardan como metadata del usuario en el propio `signUp()`, y la fila en `alumnas` se crea la primera vez que hay una sesión activa de verdad (`asegurarPerfil`, llamada desde `app/app.js` en la Tarea 9), no en el registro mismo.

**Files:**
- Create: `app/auth.js`

**Interfaces:**
- Consumes: `crearPerfilAlumna`, `obtenerPerfil`, `obtenerPerfilOpcional` de `app/data.js` (Tarea 4); `supabase` de `app/supabase-client.js` (Tarea 4).
- Produces:
  - `registrar({correo, contrasena, nombre, telefono}) => Promise<{user, session}>`
  - `iniciarSesion({correo, contrasena}) => Promise<{user, session}>`
  - `cerrarSesion() => Promise<void>`
  - `obtenerSesionActual() => Promise<Session | null>`
  - `asegurarPerfil(user: {id, user_metadata}) => Promise<perfil>` (crea la fila en `alumnas` si es la primera vez que hay sesión)
- Consumido por: `app/app.js` (Tarea 9).

- [ ] **Step 1: Implementar `app/auth.js`**

```js
import { supabase } from './supabase-client.js';
import { crearPerfilAlumna, obtenerPerfil, obtenerPerfilOpcional } from './data.js';

export async function registrar({ correo, contrasena, nombre, telefono }) {
  const { data, error } = await supabase.auth.signUp({
    email: correo,
    password: contrasena,
    options: { data: { nombre, telefono } },
  });
  if (error) throw error;
  return data;
}

export async function iniciarSesion({ correo, contrasena }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: contrasena });
  if (error) throw error;
  return data;
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
git commit -m "feat: registro, login, logout y creación diferida de perfil"
```

---

### Task 6: `index.html` y `app/styles.css` — esqueleto visual de la app

**Contexto para quien implemente:** este archivo reemplaza, para la app real, al "marco de teléfono" de dos columnas del mockup (`Sistema de diseño para marca/ui_kits/app/index.html`) — ese marco de 380×720px con sombra era solo para previsualizar diseño en escritorio, no para usarse en un celular real. Aquí cada pantalla ocupa el ancho completo (con un máximo de 480px centrado, igual a como se ve un celular). Todas las clases visuales (`.card`, `.pillbtn`, `.badge`, `.tab`, `.cupo`, `.dato`, etc.) se copian tal cual del mockup — el lenguaje visual no cambia, solo el contenedor exterior.

**Files:**
- Create: `app/styles.css`
- Create: `index.html`

**Interfaces:**
- Consumes: variables CSS de los tokens del kit (`--pf-*`, `--text-*`, `--radius-*`, `--shadow-*`, `--space-*`, `--font-*`, `--type-body`).
- Produces: elementos DOM que las tareas 7, 8 y 9 van a controlar por `id`:
  - `#pantalla-auth`, `#form-login`, `#form-registro`, botones `#switch-auth button[data-modo]`, campos `#login-correo` `#login-contrasena` `#login-error`, `#registro-nombre` `#registro-telefono` `#registro-correo` `#registro-contrasena` `#registro-error` `#registro-exito`.
  - `#pantalla-alumna` con pantallas internas `#a-inicio` `#a-clases` `#a-contenido` `#a-espacio` y tabs `.tab[data-s]`.
  - `#pantalla-admin` con pantallas internas `#d-hoy` `#d-alumnas` `#d-ficha` `#d-clases` y tabs `.tab[data-s]`.
  - `#switch-vistas` (oculto por default, solo se muestra para admin) con botones `[data-pantalla="pantalla-alumna"]` y `[data-pantalla="pantalla-admin"]`.
  - Botones `.btn-logout` (uno en `#a-espacio`, uno en `#d-hoy`).
  - Contenedores de contenido dinámico: `#a-inicio-proxima-clase`, `#a-inicio-paquete`, `#a-clases-lista`, `#a-espacio-paquete`, `#a-espacio-asistencias`, `#d-hoy-lista`, `#d-hoy-pendientes`, `#d-alumnas-lista`, `#d-ficha` (todo el screen se re-renderiza), `#d-clases-lista`.
  - `<dialog id="dialog-valoracion">` y `<dialog id="dialog-paquete">` (Tarea 8 los llena y controla).

- [ ] **Step 1: Crear `app/styles.css`**

```css
@import url("https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Poppins:wght@300;400;500;600;700&display=swap");

:root {
  --pf-rosa-claro: #EFB2E0;
  --pf-rosa: #EAA1DC;
  --pf-lila: #E3C7FA;
  --pf-lavanda: #AA9DED;
  --pf-morado: #584472;
  --pf-lila-fondo: #F5EEFD;
  --pf-rosa-fondo: #FBE9F6;
  --pf-lavanda-hover: #9A8BE4;
  --pf-morado-hover: #4A3861;
  --pf-morado-profundo: #3E2F52;
  --pf-blanco: #FFFFFF;
  --pf-exito: #6FA287;
  --pf-exito-fondo: #E9F3EE;
  --pf-error: #C77490;
  --pf-error-fondo: #F9EAF0;
  --pf-aviso: #C9A26B;
  --pf-aviso-fondo: #F8F0E4;

  --surface-page: var(--pf-lila-fondo);
  --surface-card: var(--pf-blanco);
  --text-title: var(--pf-morado);
  --text-body: var(--pf-morado-profundo);
  --text-muted: #8D7FA6;
  --border-soft: #E3D6F5;
  --focus-ring: var(--pf-lavanda);

  --font-display: "Baloo 2", "Poppins", sans-serif;
  --font-body: "Poppins", sans-serif;
  --text-h1: 700 32px/1.15 var(--font-display);
  --text-h3: 600 20px/1.3 var(--font-body);
  --type-body: 400 16px/1.6 var(--font-body);
  --text-body-strong: 600 16px/1.5 var(--font-body);
  --text-small: 400 14px/1.5 var(--font-body);
  --text-caption: 500 12px/1.4 var(--font-body);
  --text-button: 600 16px/1 var(--font-body);

  --radius-sm: 12px;
  --radius-md: 20px;
  --radius-lg: 28px;
  --radius-pill: 999px;
  --shadow-card: 0 4px 16px rgba(88, 68, 114, 0.10);
  --transition-fast: 150ms ease;
}

*{box-sizing:border-box}
body{margin:0;background:var(--surface-page);font:var(--type-body);color:var(--text-body)}
h1{font:var(--text-h1);color:var(--text-title);margin:6px 0 4px}
.muted{font:var(--text-small);color:var(--text-muted)}
.card{background:#fff;border-radius:var(--radius-lg);box-shadow:var(--shadow-card);padding:18px;margin-top:14px}
.pillbtn{font:var(--text-button);font-size:15px;border:none;border-radius:var(--radius-pill);cursor:pointer;padding:11px 22px;min-height:44px;background:var(--pf-lavanda);color:#fff;transition:background var(--transition-fast)}
.pillbtn:hover{background:var(--pf-lavanda-hover)}
.pillbtn.soft{background:var(--pf-lila);color:var(--pf-morado)}
.pillbtn.soft:hover{background:var(--border-soft)}
.pillbtn.dark{background:var(--pf-morado)}
.pillbtn:disabled{opacity:.45;cursor:not-allowed}
.badge{font:var(--text-caption);font-weight:600;padding:4px 12px;border-radius:var(--radius-pill);background:var(--pf-lila);color:var(--pf-morado);white-space:nowrap}
.badge.ok{background:var(--pf-exito-fondo);color:var(--pf-exito)}
.badge.warn{background:var(--pf-aviso-fondo);color:var(--pf-aviso)}
.badge.err{background:var(--pf-error-fondo);color:var(--pf-error)}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.prog{height:10px;border-radius:999px;background:var(--pf-lila);overflow:hidden;margin-top:8px}
.prog i{display:block;height:100%;background:var(--pf-lavanda);border-radius:999px}
.cupos{display:flex;gap:4px;margin-top:8px}
.cupo{width:16px;height:16px;border-radius:50%;background:var(--pf-lavanda)}
.cupo.libre{background:var(--border-soft)}
.video{background:var(--pf-lila);border-radius:var(--radius-md);height:104px;display:flex;align-items:center;justify-content:center;color:var(--pf-morado);font:var(--text-caption);text-align:center;padding:8px}
.play{width:44px;height:44px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;color:var(--pf-lavanda);font-size:16px;box-shadow:var(--shadow-card)}
.chips{display:flex;gap:8px;margin:14px 0 2px;flex-wrap:wrap}
.chip{font:var(--text-small);font-weight:500;padding:8px 16px;border-radius:var(--radius-pill);border:none;background:#fff;color:var(--pf-morado);cursor:pointer}
.chip.on{background:var(--pf-morado);color:#fff}
.avatar{width:44px;height:44px;border-radius:50%;background:var(--pf-rosa);display:flex;align-items:center;justify-content:center;font:var(--text-body-strong);color:var(--pf-morado);flex-shrink:0}
.dato{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border-soft);font:var(--text-small)}
.dato:last-child{border-bottom:none}
.dato b{color:var(--text-title)}

.switch{display:inline-flex;gap:4px;background:rgba(255,255,255,.15);border-radius:var(--radius-pill);padding:4px}
.switch.claro{background:rgba(88,68,114,.08)}
.switch button{font:var(--text-small);font-weight:600;padding:10px 24px;border-radius:var(--radius-pill);border:none;background:transparent;color:#fff;cursor:pointer;min-height:44px}
.switch.claro button{color:var(--pf-morado)}
.switch button.on{background:#fff;color:var(--pf-morado)}

.pantalla{display:none;flex-direction:column;min-height:100vh}
.pantalla.on{display:flex}
.contenedor-app{max-width:480px;margin:0 auto;width:100%;min-height:100vh;display:flex;flex-direction:column;background:var(--surface-page)}
.screen{flex:1;overflow-y:auto;padding:20px 20px 24px;display:none}
.screen.active{display:block}
.tabbar{display:flex;background:#fff;border-top:1px solid var(--border-soft);padding:8px 6px calc(8px + env(safe-area-inset-bottom));position:sticky;bottom:0}
.tab{flex:1;display:grid;justify-items:center;gap:3px;font:var(--text-caption);color:var(--text-muted);border:none;background:none;cursor:pointer;padding:6px 0;min-height:48px;border-radius:var(--radius-md)}
.tab.on{color:var(--pf-morado);font-weight:600}
.tab .ico{width:20px;height:20px}

.field{display:grid;gap:6px;font:var(--text-small);color:var(--text-body);margin-top:10px}
.field span{font:var(--text-body-strong);font-size:14px;color:var(--text-title)}
.input,.textarea{font:var(--type-body);color:var(--text-body);padding:12px 18px;min-height:48px;border-radius:var(--radius-pill);outline:none;border:2px solid var(--border-soft);background:#fff;transition:border-color var(--transition-fast);width:100%}
.input:focus,.textarea:focus{border-color:var(--focus-ring)}
.textarea{border-radius:var(--radius-md);min-height:80px;font-family:inherit;resize:vertical}

dialog{border:none;border-radius:var(--radius-lg);padding:0;max-width:420px;width:92vw;box-shadow:var(--shadow-card)}
dialog::backdrop{background:rgba(62,47,82,.45)}
.dialog-body{padding:20px;max-height:80vh;overflow-y:auto}

.link-suave{background:none;border:none;color:var(--text-muted);font:var(--text-small);cursor:pointer;text-decoration:underline;padding:8px 0}
```

- [ ] **Step 2: Crear `index.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pump&Flow</title>
<link rel="stylesheet" href="app/styles.css">
</head>
<body>

<div class="pantalla on" id="pantalla-auth" style="align-items:center;justify-content:center;padding:24px">
  <img src="assets/logo-morado.png" alt="Pump&Flow" style="height:50px;margin-bottom:18px">
  <div class="switch claro" id="switch-auth">
    <button class="on" data-modo="login">Iniciar sesión</button>
    <button data-modo="registro">Crear cuenta</button>
  </div>

  <form id="form-login" class="card" style="width:100%;max-width:340px;margin-top:16px">
    <label class="field"><span>Correo</span><input class="input" type="email" id="login-correo" required></label>
    <label class="field"><span>Contraseña</span><input class="input" type="password" id="login-contrasena" required minlength="6"></label>
    <div id="login-error" class="badge err" style="display:none;margin-top:10px"></div>
    <button class="pillbtn" type="submit" style="width:100%;margin-top:14px">Entrar</button>
  </form>

  <form id="form-registro" class="card" style="width:100%;max-width:340px;margin-top:16px;display:none">
    <label class="field"><span>Nombre</span><input class="input" type="text" id="registro-nombre" required></label>
    <label class="field"><span>Teléfono</span><input class="input" type="tel" id="registro-telefono"></label>
    <label class="field"><span>Correo</span><input class="input" type="email" id="registro-correo" required></label>
    <label class="field"><span>Contraseña</span><input class="input" type="password" id="registro-contrasena" required minlength="6"></label>
    <div id="registro-error" class="badge err" style="display:none;margin-top:10px"></div>
    <div id="registro-exito" class="muted" style="display:none;margin-top:10px">Te mandamos un correo para confirmar tu cuenta. Ábrelo y luego inicia sesión aquí 🤍</div>
    <button class="pillbtn" type="submit" style="width:100%;margin-top:14px">Crear cuenta</button>
  </form>
</div>

<div style="display:none;justify-content:center;padding:10px;position:sticky;top:0;background:var(--surface-page);z-index:5" id="switch-vistas">
  <div class="switch claro">
    <button class="on" data-pantalla="pantalla-admin">Vista administradora</button>
    <button data-pantalla="pantalla-alumna">Vista alumna</button>
  </div>
</div>

<!-- ══════════ ALUMNA ══════════ -->
<div class="pantalla" id="pantalla-alumna">
<div class="contenedor-app">
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

  <div class="screen" id="a-clases">
    <h1>Aparta tu espacio</h1>
    <div class="muted">Cada clase tiene cupo para 6 personas</div>
    <div id="a-clases-lista"></div>
  </div>

  <div class="screen" id="a-contenido">
    <h1>Contenido</h1>
    <div class="chips">
      <button class="chip on">Hipopresivos</button><button class="chip">Meditaciones</button>
    </div>
    <div class="card">
      <div class="video"><span class="play">▶</span></div>
      <div class="row" style="margin-top:12px"><b style="color:var(--text-title)">Fundamentos: qué son</b><span class="badge ok">Visto</span></div>
      <div class="muted">Liga de YouTube</div>
    </div>
    <div class="card">
      <div class="video"><span class="play">▶</span></div>
      <div class="row" style="margin-top:12px"><b style="color:var(--text-title)">Cómo se respira</b></div>
      <div class="muted">Liga de YouTube</div>
    </div>
    <div class="card">
      <div class="video" style="background:var(--pf-rosa-claro)"><span class="play">▶</span></div>
      <div class="row" style="margin-top:12px"><b style="color:var(--text-title)">Meditación de 10 minutos</b><span class="badge">Nueva ✨</span></div>
      <div class="muted">Para cerrar tu día con calma</div>
    </div>
  </div>

  <div class="screen" id="a-espacio">
    <h1>Tu espacio</h1>
    <div id="a-espacio-paquete"></div>
    <div id="a-espacio-asistencias"></div>
    <button class="link-suave btn-logout">Cerrar sesión</button>
  </div>

  <div class="tabbar">
    <button class="tab on" data-s="a-inicio">Inicio</button>
    <button class="tab" data-s="a-clases">Clases</button>
    <button class="tab" data-s="a-contenido">Contenido</button>
    <button class="tab" data-s="a-espacio">Tu espacio</button>
  </div>
</div>
</div>

<!-- ══════════ ADMIN ══════════ -->
<div class="pantalla" id="pantalla-admin">
<div class="contenedor-app">
  <div class="screen active" id="d-hoy">
    <img src="assets/logo-morado.png" alt="Pump&Flow" style="height:50px">
    <h1>Hola 🤍</h1>
    <div id="d-hoy-lista"></div>
    <div id="d-hoy-pendientes"></div>
    <button class="link-suave btn-logout">Cerrar sesión</button>
  </div>

  <div class="screen" id="d-alumnas">
    <h1>Alumnas</h1>
    <div id="d-alumnas-lista"></div>
  </div>

  <div class="screen" id="d-ficha"></div>

  <div class="screen" id="d-clases">
    <h1>Tus clases</h1>
    <div class="muted">Cupo de 6 por clase</div>
    <div id="d-clases-lista"></div>
  </div>

  <div class="tabbar">
    <button class="tab on" data-s="d-hoy">Hoy</button>
    <button class="tab" data-s="d-alumnas">Alumnas</button>
    <button class="tab" data-s="d-ficha">Ficha</button>
    <button class="tab" data-s="d-clases">Clases</button>
  </div>
</div>
</div>

<dialog id="dialog-valoracion"><div class="dialog-body" id="dialog-valoracion-body"></div></dialog>
<dialog id="dialog-paquete"><div class="dialog-body" id="dialog-paquete-body"></div></dialog>

<script type="module" src="app/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Verificar visualmente sin JS todavía**

Run: `npx --yes http-server -p 8080 .` (en la raíz del repo) y abrir `http://localhost:8080` en el navegador.
Expected: se ve la pantalla de login/registro con el estilo de marca (fondo lila claro, botones morados/lavanda, tarjeta blanca redondeada). El resto de pantallas está oculto (`display:none` hasta que `app/app.js` exista en la Tarea 9, así que por ahora solo debe verse la pantalla de auth). Cerrar el servidor con Ctrl+C al terminar de revisar.

- [ ] **Step 4: Commit**

```bash
git add app/styles.css index.html
git commit -m "feat: esqueleto visual de la app (login, alumna, admin)"
```

---

### Task 7: `app/alumna.js` — lógica de las pantallas de alumna

**Files:**
- Create: `app/alumna.js`

**Interfaces:**
- Consumes: de `app/data.js` (Tarea 4) — `listarClasesProximas`, `obtenerMisReservas`, `hacerCheckin`, `apartarLugar`, `obtenerPaqueteActivo`, `obtenerMisAsistencias`; de `app/lib/date-utils.js` (Tarea 1) — `hoyISO`, `esHoy`, `formatHora12`, `formatDiaMesConDia`, `formatMesAno`; de `app/lib/status.js` (Tarea 2) — `proximaReserva`, `estadoPaquete`, `estadoAsistenciaBadge`, `puntosCupo`, `estadoClase`, `cupoDisponible`; `supabase` de `app/supabase-client.js` (Tarea 4).
- Produces: `montarVistaAlumna({supabase, alumnaId, nombre, onCerrarSesion}) => Promise<void>` — pinta las 4 pantallas de alumna con datos reales y conecta sus botones. Se puede llamar varias veces (cada vez recarga los datos).
- Consumido por: `app/app.js` (Tarea 9).

- [ ] **Step 1: Implementar `app/alumna.js`**

```js
import {
  listarClasesProximas, obtenerMisReservas, hacerCheckin,
  apartarLugar, obtenerPaqueteActivo, obtenerMisAsistencias,
} from './data.js';
import { hoyISO, esHoy, formatHora12, formatDiaMesConDia, formatMesAno } from './lib/date-utils.js';
import { proximaReserva, estadoPaquete, estadoAsistenciaBadge, puntosCupo, estadoClase, cupoDisponible } from './lib/status.js';

export async function montarVistaAlumna({ supabase, alumnaId, nombre, onCerrarSesion }) {
  document.getElementById('a-inicio-saludo').textContent = `Hola, ${nombre.split(' ')[0]} 🤍`;

  wireTabs('pantalla-alumna');
  wireLogout('a-espacio', onCerrarSesion);
  wireLogout('a-inicio', null, true);

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
        <div class="row"><b style="font:var(--text-h3)">Hipopresivos grupal</b><span class="badge" style="background:#fff">${hoy ? 'Hoy' : formatDiaMesConDia(proxima.fecha)} ${formatHora12(proxima.hora)}</span></div>
        <div style="font:var(--text-small);color:#fff;margin:6px 0 12px">Presencial</div>
        ${hoy ? `<button class="pillbtn" style="background:#fff;color:var(--pf-morado);width:100%" id="btn-checkin">Hacer check-in</button>
        <div id="checkin-hecho" style="display:none;margin-top:10px;font:var(--text-small);color:#fff;text-align:center">Check-in enviado, Caro lo confirma en clase ✨</div>` : ''}
      </div>`;
    if (hoy) {
      document.getElementById('btn-checkin').addEventListener('click', async (e) => {
        e.target.disabled = true;
        await hacerCheckin(supabase, alumnaId, proxima.claseId);
        e.target.style.display = 'none';
        document.getElementById('checkin-hecho').style.display = 'block';
      });
    }
  }

  const estado = estadoPaquete(paquete, hoyISO());
  contPaquete.innerHTML = renderTarjetaPaquete(paquete, estado);
}

async function renderClases(supabase, alumnaId) {
  const [clases, reservas] = await Promise.all([
    listarClasesProximas(supabase),
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
    let boton;
    if (yaReservada) {
      boton = `<button class="pillbtn soft" style="width:100%" disabled>Tu lugar está apartado ✨</button>`;
    } else if (estado === 'llena') {
      boton = `<button class="pillbtn soft" style="width:100%" disabled>Sin lugares</button>`;
    } else {
      boton = `<button class="pillbtn" style="width:100%" data-clase-id="${c.id}">Aparto mi espacio</button>`;
    }
    return `
      <div class="card" style="${estado === 'llena' && !yaReservada ? 'opacity:.6' : ''}">
        <div class="row"><b style="color:var(--text-title)">${formatDiaMesConDia(c.fecha)}</b>
          <span class="badge ${estado === 'llena' ? 'err' : ''}">${estado === 'llena' ? 'Llena' : formatHora12(c.horarios.hora)}</span></div>
        <div class="cupos">${puntos}</div>
        <div class="muted" style="margin:6px 0 12px">${estado === 'llena' ? 'Sin lugares' : `${disponibles} lugar${disponibles === 1 ? '' : 'es'} disponible${disponibles === 1 ? '' : 's'}`}</div>
        ${boton}
      </div>`;
  }).join('');

  cont.querySelectorAll('button[data-clase-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await apartarLugar(supabase, alumnaId, Number(btn.dataset.claseId));
        await Promise.all([renderClases(supabase, alumnaId), renderInicio(supabase, alumnaId)]);
      } catch (err) {
        btn.disabled = false;
        alert('Esta clase ya está llena, elige otro horario 🤍');
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
        const badge = estadoAsistenciaBadge({ checkin_alumna: a.checkinAlumna, confirmada_admin: a.confirmadaAdmin });
        const texto = badge === 'confirmada' ? 'Confirmada' : badge === 'pendiente' ? 'Pendiente' : 'Sin check-in';
        const clase = badge === 'confirmada' ? 'ok' : badge === 'pendiente' ? 'warn' : '';
        return `<div class="dato"><span>${formatDiaMesConDia(a.fecha)} · ${formatHora12(a.hora)}</span><span class="badge ${clase}">${texto}</span></div>`;
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
      <div class="row"><b style="color:var(--text-title)">Tu paquete</b><span class="badge">Quedan ${restantes} de ${paquete.clases_totales}</span></div>
      <div class="prog"><i style="width:${porcentaje}%"></i></div>
      <div class="muted" style="margin-top:8px">${paquete.vence ? `Tu siguiente pago es el ${formatDiaMesConDia(paquete.vence)}` : ''}</div>
    </div>`;
}

function renderDatosPaquete(paquete, estado) {
  if (estado === 'sin_paquete') {
    return `<b style="color:var(--text-title)">Tu paquete</b><div class="muted" style="margin-top:8px">Aún no tienes un paquete activo.</div>`;
  }
  return `
    <b style="color:var(--text-title)">Tu paquete</b>
    <div class="dato"><span>Clases restantes</span><b>${paquete.clases_totales - paquete.clases_usadas} de ${paquete.clases_totales}</b></div>
    <div class="dato"><span>Último pago</span><b>${paquete.monto ? `$${paquete.monto} · ` : ''}${paquete.fecha_pago ? formatDiaMesConDia(paquete.fecha_pago) : '—'}</b></div>
    <div class="dato"><span>Siguiente pago</span><b>${paquete.vence ? formatDiaMesConDia(paquete.vence) : '—'}</b></div>
    <div class="dato"><span>Forma de pago</span><b>${paquete.forma_pago ?? '—'}</b></div>`;
}

function wireTabs(pantallaId) {
  const pantalla = document.getElementById(pantallaId);
  pantalla.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      pantalla.querySelectorAll('.tab').forEach((x) => x.classList.remove('on'));
      pantalla.querySelectorAll('.screen').forEach((x) => x.classList.remove('active'));
      t.classList.add('on');
      pantalla.querySelector(`#${t.dataset.s}`).classList.add('active');
    });
  });
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
git commit -m "feat: lógica de las pantallas de alumna (inicio, clases, tu espacio)"
```

---

### Task 8: `app/admin.js` — lógica de las pantallas de administradora

**Files:**
- Create: `app/admin.js`

**Interfaces:**
- Consumes: de `app/data.js` (Tarea 4) — `obtenerClaseDeHoy`, `listarReservasDeClase`, `confirmarAsistencia`, `listarAlumnas`, `obtenerFichaAlumna`, `activarPaquete`, `crearValoracion`, `obtenerPaqueteActivo`, `listarClasesProximas` (todas importadas estáticamente al inicio del archivo, ver Step 1); de `app/lib/date-utils.js` (Tarea 1) — `hoyISO`, `formatHora12`, `formatDiaMesConDia`, `formatFechaCompleta`, `formatMesAno`; de `app/lib/status.js` (Tarea 2) — `estadoAsistenciaBadge`, `estadoPaquete`, `paqueteVenceEnDias`, `siguienteNumeroValoracion`, `tieneValoraciones`, `inicialAvatar`, `puntosCupo`, `estadoClase`.
- Produces: `montarVistaAdmin({supabase, onCerrarSesion}) => Promise<void>`.
- Consumido por: `app/app.js` (Tarea 9).

- [ ] **Step 1: Implementar `app/admin.js`**

```js
import {
  obtenerClaseDeHoy, listarReservasDeClase, confirmarAsistencia,
  listarAlumnas, obtenerFichaAlumna, activarPaquete, crearValoracion,
  listarClasesProximas, obtenerPaqueteActivo,
} from './data.js';
import { hoyISO, formatHora12, formatDiaMesConDia, formatFechaCompleta } from './lib/date-utils.js';
import {
  estadoAsistenciaBadge, estadoPaquete, paqueteVenceEnDias,
  siguienteNumeroValoracion, tieneValoraciones, inicialAvatar,
  puntosCupo, estadoClase,
} from './lib/status.js';

const CAMPOS_VALORACION = [
  { key: 'edad', label: 'Edad', type: 'number' },
  { key: 'ciclo', label: 'Ciclo', type: 'text' },
  { key: 'partos', label: 'Partos', type: 'text' },
  { key: 'tonicidad_abdominal', label: 'Tonicidad abdominal', type: 'text' },
  { key: 'competencia_abdominal_dedos', label: 'Competencia abdominal (dedos)', type: 'number' },
  { key: 'coactivacion_abdominal', label: 'Co-activación abdominal', type: 'text' },
  { key: 'diastasis_supraumbilical', label: 'Diástasis supraumbilical', type: 'number' },
  { key: 'diastasis_umbilical', label: 'Diástasis umbilical', type: 'number' },
  { key: 'diastasis_infraumbilical', label: 'Diástasis infraumbilical', type: 'number' },
  { key: 'tonicidad_diafragma_izq', label: 'Tonicidad diafragmática cúpula izq.', type: 'text' },
  { key: 'tonicidad_diafragma_der', label: 'Tonicidad diafragmática cúpula der.', type: 'text' },
  { key: 'competencia_perineal', label: 'Competencia perineal', type: 'text' },
  { key: 'perimetro_cintura', label: 'Perímetro de cintura', type: 'number' },
  { key: 'perimetro_ombligo', label: 'Perímetro al ombligo', type: 'number' },
  { key: 'perimetro_bajo_ombligo', label: 'Perímetro abajo de ombligo', type: 'number' },
  { key: 'perimetro_cadera', label: 'Perímetro cadera', type: 'number' },
  { key: 'perimetro_cintura_apnea', label: 'Perímetro cintura con apnea', type: 'number' },
  { key: 'observaciones', label: 'Observaciones', type: 'textarea' },
];

let supabaseRef;

export async function montarVistaAdmin({ supabase, onCerrarSesion }) {
  supabaseRef = supabase;
  wireTabsAdmin();
  document.getElementById('d-hoy').querySelector('.btn-logout')?.addEventListener('click', onCerrarSesion);

  await Promise.all([renderHoy(supabase), renderAlumnas(supabase), renderClasesAdmin(supabase)]);
  document.getElementById('d-ficha').innerHTML = '<h1>Ficha</h1><div class="muted">Elige una alumna en la pestaña "Alumnas".</div>';
}

async function renderHoy(supabase) {
  const clase = await obtenerClaseDeHoy(supabase);
  const contLista = document.getElementById('d-hoy-lista');
  const contPend = document.getElementById('d-hoy-pendientes');

  if (!clase) {
    contLista.innerHTML = `<div class="card"><b style="color:var(--text-title)">Hoy no hay clase</b></div>`;
  } else {
    const reservas = await listarReservasDeClase(supabase, clase.id);
    contLista.innerHTML = `
      <div class="card">
        <div class="row" style="margin-bottom:4px"><b style="color:var(--text-title)">Pasar lista</b><span class="badge">${reservas.filter((r) => r.asistencia?.confirmada_admin).length} de ${reservas.length}</span></div>
        ${reservas.length === 0 ? '<div class="muted">Nadie ha apartado lugar todavía</div>' : reservas.map((r) => {
          const badge = estadoAsistenciaBadge(r.asistencia);
          const accion = badge === 'confirmada'
            ? '<span class="badge ok">Confirmada</span>'
            : `<button class="pillbtn valida" data-alumna-id="${r.alumnaId}" data-clase-id="${clase.id}" style="padding:7px 16px;min-height:36px;font-size:13px">Confirmar</button>`;
          return `<div class="dato"><div style="display:flex;align-items:center;gap:10px"><span class="avatar" style="width:34px;height:34px;font-size:13px">${inicialAvatar(r.nombre)}</span>${r.nombre}${badge === 'sin_checkin' ? ' <span class="badge warn">Sin check-in</span>' : ''}</div>${accion}</div>`;
        }).join('')}
      </div>`;
    contLista.querySelectorAll('.valida').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        await confirmarAsistencia(supabase, btn.dataset.alumnaId, Number(btn.dataset.claseId));
        await renderHoy(supabase);
      });
    });
  }

  const alumnas = await listarAlumnas(supabase);
  const hoy = hoyISO();
  let pagosPorRecibir = 0;
  let paquetesPorVencer = 0;
  let valoracionesPendientes = 0;
  await Promise.all(alumnas.filter((a) => !a.es_admin).map(async (a) => {
    const ficha = await obtenerFichaAlumna(supabase, a.id);
    const estado = estadoPaquete(ficha.paquete, hoy);
    if (estado !== 'al_dia') pagosPorRecibir += 1;
    if (paqueteVenceEnDias(ficha.paquete, hoy)) paquetesPorVencer += 1;
    if (!tieneValoraciones(ficha.valoraciones)) valoracionesPendientes += 1;
  }));
  contPend.innerHTML = `
    <div class="card">
      <b style="color:var(--text-title)">Pendientes de la semana</b>
      <div class="dato"><span>Pagos por recibir</span><b>${pagosPorRecibir} alumna${pagosPorRecibir === 1 ? '' : 's'}</b></div>
      <div class="dato"><span>Paquetes por vencer</span><b>${paquetesPorVencer} alumna${paquetesPorVencer === 1 ? '' : 's'}</b></div>
      <div class="dato"><span>Valoraciones pendientes</span><b>${valoracionesPendientes} alumna${valoracionesPendientes === 1 ? '' : 's'}</b></div>
    </div>`;
}

async function renderAlumnas(supabase) {
  const alumnas = (await listarAlumnas(supabase)).filter((a) => !a.es_admin);
  const hoy = hoyISO();
  const cont = document.getElementById('d-alumnas-lista');
  const filas = await Promise.all(alumnas.map(async (a) => {
    const paquete = await obtenerPaqueteActivo(supabase, a.id);
    const estado = estadoPaquete(paquete, hoy);
    const badgeTexto = estado === 'al_dia' ? 'Al día' : estado === 'por_pagar' ? 'Por pagar' : 'Nueva';
    const badgeClase = estado === 'al_dia' ? 'ok' : estado === 'por_pagar' ? 'err' : 'warn';
    const progreso = paquete ? `${paquete.clases_usadas} de ${paquete.clases_totales} clases` : 'Sin paquete activo';
    return `
      <div class="card row alumna-fila" data-alumna-id="${a.id}" style="cursor:pointer">
        <span class="avatar">${inicialAvatar(a.nombre)}</span>
        <div style="flex:1"><b style="color:var(--text-title)">${a.nombre}</b><div class="muted">${progreso}</div></div>
        <span class="badge ${badgeClase}">${badgeTexto}</span>
      </div>`;
  }));
  cont.innerHTML = filas.join('') || '<div class="muted">Aún no tienes alumnas registradas</div>';
  cont.querySelectorAll('.alumna-fila').forEach((fila) => {
    fila.addEventListener('click', () => {
      renderFicha(supabase, fila.dataset.alumnaId);
      document.querySelector('#pantalla-admin .tab[data-s="d-ficha"]').click();
    });
  });
}

async function renderFicha(supabase, alumnaId) {
  const { alumna, paquete, valoraciones, asistencias } = await obtenerFichaAlumna(supabase, alumnaId);
  const estado = estadoPaquete(paquete, hoyISO());
  const cont = document.getElementById('d-ficha');
  cont.innerHTML = `
    <h1>${alumna.nombre}</h1>
    <div class="muted">Alumna desde ${formatFechaCompleta(alumna.fecha_alta)}</div>

    <div class="card">
      <div class="row"><b style="color:var(--text-title)">Paquete</b><button class="pillbtn soft" id="btn-activar-paquete" style="padding:7px 16px;min-height:36px;font-size:13px">Activar mes</button></div>
      ${estado === 'sin_paquete'
        ? '<div class="muted" style="margin-top:8px">Sin paquete activo</div>'
        : `<div class="dato"><span>Clases restantes</span><b>${paquete.clases_totales - paquete.clases_usadas} de ${paquete.clases_totales}</b></div>
           <div class="dato"><span>Último pago</span><b>${paquete.monto ? `$${paquete.monto} · ` : ''}${paquete.forma_pago ?? ''} · ${paquete.fecha_pago ? formatDiaMesConDia(paquete.fecha_pago) : '—'}</b></div>
           <div class="dato"><span>Siguiente pago</span><b>${paquete.vence ? formatDiaMesConDia(paquete.vence) : '—'}</b></div>`}
    </div>

    <div class="card">
      <div class="row" style="margin-bottom:2px"><b style="color:var(--text-title)">Valoraciones</b><button class="pillbtn" id="btn-nueva-valoracion" style="padding:7px 16px;min-height:36px;font-size:13px">+ Nueva valoración</button></div>
      <div class="muted" style="margin-bottom:10px">${valoraciones.length} registrada${valoraciones.length === 1 ? '' : 's'} · la más reciente arriba</div>
      ${valoraciones.map((v, i) => renderValoracion(v, i, alumna.nombre)).join('') || '<div class="muted">Sin valoraciones todavía</div>'}
    </div>

    <div class="card">
      <b style="color:var(--text-title)">Asistencias recientes</b>
      ${asistencias.slice(0, 5).map((a) => {
        const badge = estadoAsistenciaBadge({ checkin_alumna: a.checkinAlumna, confirmada_admin: a.confirmadaAdmin });
        const texto = badge === 'confirmada' ? 'Confirmada' : badge === 'pendiente' ? 'Pendiente' : 'Sin check-in';
        const clase = badge === 'confirmada' ? 'ok' : badge === 'pendiente' ? 'warn' : '';
        return `<div class="dato"><span>${formatDiaMesConDia(a.fecha)} · ${formatHora12(a.hora)}</span><span class="badge ${clase}">${texto}</span></div>`;
      }).join('') || '<div class="muted">Sin asistencias todavía</div>'}
    </div>`;

  cont.querySelectorAll('.acc').forEach((btn) => {
    btn.addEventListener('click', () => {
      const body = btn.nextElementSibling;
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
    });
  });
  document.getElementById('btn-nueva-valoracion').addEventListener('click', () => abrirDialogValoracion(supabase, alumnaId, valoraciones));
  document.getElementById('btn-activar-paquete').addEventListener('click', () => abrirDialogPaquete(supabase, alumnaId));
}

function renderValoracion(v, index, nombreAlumna) {
  const esReciente = index === 0;
  const filas = CAMPOS_VALORACION.filter((c) => c.key !== 'observaciones')
    .map((c) => `<div class="dato"><span>${c.label}</span><b>${v[c.key] ?? '—'}</b></div>`).join('');
  return `
    <div style="border:2px solid var(--border-soft);border-radius:var(--radius-md);overflow:hidden;margin-bottom:10px">
      <button class="acc" style="width:100%;display:flex;justify-content:space-between;align-items:center;gap:8px;background:var(--pf-lila-fondo);border:none;padding:12px 14px;cursor:pointer;font:var(--text-body-strong);font-size:14px;color:var(--text-title);text-align:left;min-height:44px">
        Valoración ${v.numero} · ${formatFechaCompleta(v.fecha)}<span class="badge ${esReciente ? 'ok' : ''}">${esReciente ? 'Reciente' : 'Ver'}</span>
      </button>
      <div class="acc-body" style="display:none;padding:4px 14px 12px">
        <div class="dato"><span>Nombre</span><b>${nombreAlumna}</b></div>
        ${filas}
        <div class="dato" style="display:block"><span>Observaciones</span><div style="margin-top:4px;color:var(--text-body)">${v.observaciones ?? '—'}</div></div>
      </div>
    </div>`;
}

function abrirDialogValoracion(supabase, alumnaId, valoraciones) {
  const dialog = document.getElementById('dialog-valoracion');
  const body = document.getElementById('dialog-valoracion-body');
  const numero = siguienteNumeroValoracion(valoraciones);
  body.innerHTML = `
    <h1 style="font:var(--text-h3)">Nueva valoración</h1>
    <form id="form-valoracion">
      <label class="field"><span>Fecha</span><input class="input" type="date" name="fecha" value="${hoyISO()}" required></label>
      ${CAMPOS_VALORACION.map((c) => `
        <label class="field"><span>${c.label}</span>
          ${c.type === 'textarea'
            ? `<textarea class="textarea" name="${c.key}"></textarea>`
            : `<input class="input" type="${c.type}" name="${c.key}" ${c.type === 'number' ? 'step="0.1"' : ''}>`}
        </label>`).join('')}
      <button class="pillbtn" type="submit" style="width:100%;margin-top:16px">Guardar valoración</button>
      <button class="link-suave" type="button" id="btn-cancelar-valoracion" style="width:100%;text-align:center">Cancelar</button>
    </form>`;
  document.getElementById('btn-cancelar-valoracion').addEventListener('click', () => dialog.close());
  document.getElementById('form-valoracion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const campos = { fecha: formData.get('fecha') };
    CAMPOS_VALORACION.forEach((c) => {
      const valor = formData.get(c.key);
      campos[c.key] = c.type === 'number' ? (valor === '' ? null : Number(valor)) : (valor || null);
    });
    await crearValoracion(supabase, alumnaId, campos, numero);
    dialog.close();
    await renderFicha(supabase, alumnaId);
  });
  dialog.showModal();
}

function abrirDialogPaquete(supabase, alumnaId) {
  const dialog = document.getElementById('dialog-paquete');
  const body = document.getElementById('dialog-paquete-body');
  body.innerHTML = `
    <h1 style="font:var(--text-h3)">Activar mes</h1>
    <form id="form-paquete">
      <label class="field"><span>Tipo</span>
        <select class="input" name="tipo">
          <option value="mensualidad">Mensualidad</option>
          <option value="introduccion">Introducción</option>
        </select>
      </label>
      <label class="field"><span>Clases totales</span><input class="input" type="number" name="clasesTotales" value="8" required></label>
      <label class="field"><span>Monto</span><input class="input" type="number" name="monto" step="0.01" required></label>
      <label class="field"><span>Forma de pago</span>
        <select class="input" name="formaPago">
          <option value="transferencia">Transferencia</option>
          <option value="efectivo">Efectivo</option>
        </select>
      </label>
      <label class="field"><span>Fecha de pago</span><input class="input" type="date" name="fechaPago" value="${hoyISO()}" required></label>
      <label class="field"><span>Vence</span><input class="input" type="date" name="vence" required></label>
      <button class="pillbtn" type="submit" style="width:100%;margin-top:16px">Activar paquete</button>
      <button class="link-suave" type="button" id="btn-cancelar-paquete" style="width:100%;text-align:center">Cancelar</button>
    </form>`;
  document.getElementById('btn-cancelar-paquete').addEventListener('click', () => dialog.close());
  document.getElementById('form-paquete').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await activarPaquete(supabase, alumnaId, {
      tipo: formData.get('tipo'),
      clasesTotales: Number(formData.get('clasesTotales')),
      monto: Number(formData.get('monto')),
      formaPago: formData.get('formaPago'),
      fechaPago: formData.get('fechaPago'),
      vence: formData.get('vence'),
    });
    dialog.close();
    await renderFicha(supabase, alumnaId);
  });
  dialog.showModal();
}

async function renderClasesAdmin(supabase) {
  const clases = await listarClasesProximas(supabase);
  document.getElementById('d-clases-lista').innerHTML = clases.map((c) => {
    const puntos = puntosCupo(c.cupo, c.reservasCount).map((o) => `<i class="cupo ${o ? '' : 'libre'}"></i>`).join('');
    const estado = estadoClase(c.cupo, c.reservasCount);
    return `
      <div class="card">
        <div class="row"><b style="color:var(--text-title)">${formatDiaMesConDia(c.fecha)} ${formatHora12(c.horarios.hora)}</b><span class="badge ${estado === 'llena' ? 'err' : ''}">${estado === 'llena' ? 'Llena' : `${c.reservasCount} de ${c.cupo}`}</span></div>
        <div class="cupos">${puntos}</div>
      </div>`;
  }).join('') || '<div class="muted">No hay clases próximas todavía</div>';
}

function wireTabsAdmin() {
  const pantalla = document.getElementById('pantalla-admin');
  pantalla.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      pantalla.querySelectorAll('.tab').forEach((x) => x.classList.remove('on'));
      pantalla.querySelectorAll('.screen').forEach((x) => x.classList.remove('active'));
      t.classList.add('on');
      pantalla.querySelector(`#${t.dataset.s}`).classList.add('active');
    });
  });
}
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check app/admin.js`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add app/admin.js
git commit -m "feat: lógica de las pantallas de admin (hoy, alumnas, ficha, valoraciones, paquetes)"
```

---

### Task 9: `app/app.js` — bootstrap y ruteo por rol

**Files:**
- Create: `app/app.js`

**Interfaces:**
- Consumes: `supabase` de `app/supabase-client.js`; `obtenerSesionActual`, `asegurarPerfil`, `cerrarSesion`, `registrar`, `iniciarSesion` de `app/auth.js` (Tarea 5); `generarClases` de `app/data.js` (Tarea 4); `montarVistaAlumna` de `app/alumna.js` (Tarea 7); `montarVistaAdmin` de `app/admin.js` (Tarea 8).
- Produces: efecto de arranque de la app al cargar `index.html` (no exporta nada, es el punto de entrada).

- [ ] **Step 1: Implementar `app/app.js`**

```js
import { supabase } from './supabase-client.js';
import { obtenerSesionActual, asegurarPerfil, cerrarSesion, registrar, iniciarSesion } from './auth.js';
import { generarClases } from './data.js';
import { montarVistaAlumna } from './alumna.js';
import { montarVistaAdmin } from './admin.js';

const pantallaAuth = document.getElementById('pantalla-auth');
const pantallaAlumna = document.getElementById('pantalla-alumna');
const pantallaAdmin = document.getElementById('pantalla-admin');
const switchVistas = document.getElementById('switch-vistas');

function mostrarPantalla(id) {
  pantallaAuth.classList.remove('on');
  pantallaAlumna.classList.remove('on');
  pantallaAdmin.classList.remove('on');
  document.getElementById(id).classList.add('on');
}

async function entrarConSesion(session) {
  const perfil = await asegurarPerfil(session.user);
  generarClases(supabase).catch((err) => console.warn('No se pudieron generar clases:', err.message));

  if (perfil.es_admin) {
    switchVistas.style.display = 'flex';
    await montarVistaAlumna({ supabase, alumnaId: perfil.id, nombre: perfil.nombre, onCerrarSesion: manejarLogout });
    await montarVistaAdmin({ supabase, onCerrarSesion: manejarLogout });
    mostrarPantalla('pantalla-admin');
  } else {
    switchVistas.style.display = 'none';
    await montarVistaAlumna({ supabase, alumnaId: perfil.id, nombre: perfil.nombre, onCerrarSesion: manejarLogout });
    mostrarPantalla('pantalla-alumna');
  }
}

async function manejarLogout() {
  await cerrarSesion();
  mostrarPantalla('pantalla-auth');
}

switchVistas.querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    switchVistas.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
    mostrarPantalla(btn.dataset.pantalla);
  });
});

document.getElementById('switch-auth').querySelectorAll('button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#switch-auth button').forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
    document.getElementById('form-login').style.display = btn.dataset.modo === 'login' ? 'block' : 'none';
    document.getElementById('form-registro').style.display = btn.dataset.modo === 'registro' ? 'block' : 'none';
  });
});

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
    });
    e.target.reset();
    exitoEl.style.display = 'block';
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  }
});

const sesion = await obtenerSesionActual();
if (sesion) {
  await entrarConSesion(sesion);
} else {
  mostrarPantalla('pantalla-auth');
}
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check app/app.js`
Expected: sin salida.

- [ ] **Step 3: Correr todas las pruebas de lógica pura una vez más antes de integrar**

Run: `npm test`
Expected: PASS — 20 tests, 0 fallos (nada de esta tarea debió tocar `app/lib/`).

- [ ] **Step 4: Commit**

```bash
git add app/app.js
git commit -m "feat: bootstrap de la app y ruteo por rol (alumna/admin)"
```

---

### Task 10: Verificación manual end-to-end y publicación

**Contexto:** esta tarea no se automatiza. Usa el proyecto real de Supabase de Caro, así que las pruebas se hacen con una cuenta de prueba real (que luego se puede borrar) y las revisa Caro o quien tenga acceso a su Supabase, no un agente. Sirve como checklist de entrega.

**Files:** ninguno (verificación + un cambio de configuración en GitHub, no en el repo).

- [ ] **Step 1: Servir la app localmente**

```bash
npx --yes http-server -p 8080 .
```

Abrir `http://localhost:8080` en el navegador (celular real conectado a la misma red, o el modo de vista móvil de las herramientas de desarrollador).

- [ ] **Step 2: Checklist de flujo alumna**

1. Crear cuenta de prueba (correo real al que se tenga acceso, o el correo personal de Caro con un "+prueba", ej. `caro+prueba@...`).
2. Confirmar el correo (revisar bandeja de entrada/spam) y luego iniciar sesión.
3. Verificar que entra directo a la vista alumna, sin switch visible.
4. En "Clases", apartar un lugar y confirmar que el cupo baja y el botón cambia a "Tu lugar está apartado".
5. En Supabase (Table Editor → `reservas`), confirmar que apareció la fila.
6. Volver a "Inicio" y confirmar que muestra la clase apartada. Si es hoy, probar "Hacer check-in" y revisar en `asistencias` que se creó la fila con `checkin_alumna`.
7. En "Tu espacio", confirmar que aparece igual sin paquete activo (mensaje de "aún no tienes paquete").

- [ ] **Step 3: Checklist de flujo admin**

1. En el Table Editor de Supabase, en `alumnas`, poner `es_admin = true` en la fila de la cuenta admin real de Caro (no la de prueba).
2. Iniciar sesión con esa cuenta y confirmar que entra directo a la vista admin, con el switch visible arriba.
3. Usar el switch para pasar a "Vista alumna" y de regreso a "Vista administradora"; confirmar que ambas funcionan sin recargar la página.
4. En "Alumnas", confirmar que aparece la alumna de prueba de la Paso 2.
5. Tocarla para abrir su Ficha. Click en "Activar mes", llenar el formulario y guardar. Confirmar en Supabase (`paquetes`) que se creó la fila `activo = true`.
6. Volver a "Tu espacio" con la cuenta de alumna de prueba y confirmar que ahora sí muestra el paquete recién activado.
7. En la Ficha de admin, click en "+ Nueva valoración", llenar algunos campos y guardar. Confirmar en Supabase (`valoraciones`) que se creó con `numero = 1`.
8. Si la clase reservada en el Paso 2 del flujo alumna es hoy: en "Hoy" (admin), confirmar que aparece la reserva de la alumna de prueba, click en "Confirmar", y verificar en Supabase que `asistencias.confirmada_admin` se llenó y que `paquetes.clases_usadas` subió en 1 (por el trigger `descuenta_clase`, ya existente).
9. Confirmar que "Pendientes de la semana" muestra números razonables.

- [ ] **Step 4: Limpieza de datos de prueba**

Borrar en Supabase (Table Editor) las filas creadas en los pasos 2-8 para la cuenta de prueba (`reservas`, `asistencias`, `paquetes`, `valoraciones`, `alumnas`, y el usuario en Authentication → Users), para no dejar datos falsos en el negocio real de Caro.

- [ ] **Step 5: Publicar en GitHub Pages — requiere confirmación explícita de Caro**

No activar este paso sin que Caro lo confirme directamente en la conversación. Cuando lo confirme:

```bash
gh api repos/CaroEcomare/app-pump-flow/pages -X POST -f "source[branch]=main" -f "source[path]=/" 2>&1 || \
gh api repos/CaroEcomare/app-pump-flow/pages -X PUT -f "source[branch]=main" -f "source[path]=/"
```

Verificar con:

```bash
gh api repos/CaroEcomare/app-pump-flow/pages
```

Confirmar que `status` llega a `"built"` (puede tardar uno o dos minutos) y compartirle a Caro la URL que aparece en `html_url`.

- [ ] **Step 6: Commit final si hubo cambios pendientes**

```bash
git status
```

Si hay cambios sin commitear de ajustes hechos durante la verificación manual, commitearlos con un mensaje descriptivo antes de cerrar la tarea.

---

## Self-Review

**Cobertura del spec:**
- Arquitectura y estructura de archivos → Tarea 0, 4, 6.
- Auth (registro/login/logout, confirmación de correo, creación diferida de perfil) → Tarea 5, 9.
- Ruteo por rol + switch solo para admin → Tarea 9.
- Vista alumna (próxima clase, check-in, apartar espacio con cupo real, paquete, asistencias, contenido sin cambios) → Tarea 7.
- Vista admin (pasar lista/confirmar, pendientes de la semana, alumnas, ficha, activar paquete, nueva valoración, clases) → Tarea 8.
- Generación automática de clases (SQL + RPC al entrar) → Tarea 3, 9.
- Publicación en GitHub Pages con confirmación → Tarea 10.
- Fuera de alcance (contenido dinámico, clase extra, lista de espera, notificaciones, recuperar contraseña) → no se implementan en ninguna tarea, consistente con el spec.

**Gap real detectado y corregido durante la planeación:** la política de RLS original de `asistencias` no dejaba a la admin crear una fila de asistencia para una alumna que nunca hizo check-in (solo `alumna_id = auth.uid()`). Se agrega la política `admin crea asistencia` en la Tarea 3 para que "Confirmar" funcione también en ese caso, tal como pide el spec ("si alguien no hizo check-in... tú puedes confirmarla igual").

**Consistencia de tipos:** revisado que las formas de datos que produce `app/data.js` (Tarea 4) coincidan exactamente con lo que consumen `app/lib/status.js` (Tarea 2), `app/alumna.js` (Tarea 7) y `app/admin.js` (Tarea 8) — en particular `proximaReserva` espera `{claseId, fecha, hora}` plano, que es justo lo que devuelve `obtenerMisReservas`; `estadoAsistenciaBadge` espera `{checkin_alumna, confirmada_admin}` con esos nombres de columna exactos (snake_case), que es justo lo que devuelve `listarReservasDeClase` en su campo `asistencia` (no se transformó a camelCase ahí a propósito, para no tener que traducir en dos direcciones).
