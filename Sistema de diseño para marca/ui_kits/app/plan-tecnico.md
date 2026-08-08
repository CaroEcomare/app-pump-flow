# App Pump&Flow — cómo se construye

## La arquitectura

Tres piezas:

1. **GitHub** guarda el código y publica la app con GitHub Pages. Tus alumnas la abren desde el navegador del celular y la pueden guardar en su pantalla de inicio.
2. **Supabase** guarda los datos: usuarias, clases, reservas, asistencias, paquetes, pagos y valoraciones. Es gratis hasta 50,000 usuarias activas al mes, muy por encima de lo que necesitas.
3. **La app** (el diseño que ya está en `ui_kits/app/index.html`) se conecta a Supabase para leer y escribir esos datos.

## Las dos vistas

**Alumna:** inicio con su próxima clase y botón de check-in, apartado de clases con cupo visible de 6 lugares, contenido (videos de YouTube y meditaciones) y "Tu espacio" con su paquete y su historial de asistencias. Las valoraciones son solo para ti, no las ve la alumna.

**Tú como administradora:** pantalla de hoy para pasar lista y confirmar los check-in, lista de alumnas con su estado de pago, ficha individual con el historial completo de valoraciones y el paquete, y vista de clases con los cupos.

## Valoraciones sucesivas

Cada alumna acumula valoraciones. En su ficha aparecen apiladas, la más reciente arriba y desplegable. El botón "+ Nueva valoración" abre el formulario con los 20 campos en blanco y la fecha de hoy; al guardar se crea una fila nueva en `valoraciones` con el `numero` siguiente. Así puedes comparar cómo cambian sus perímetros y su diástasis a lo largo de los meses.

## Doble check-in

La alumna toca "Hacer check-in" al llegar. Eso crea el registro en estado `pendiente`. En tu pantalla de hoy aparece con botón "Confirmar"; cuando lo tocas pasa a `confirmada` y ahí sí se le descuenta una clase de su paquete. Si alguien no hizo check-in, aparece marcada como "Sin check-in" y tú puedes confirmarla igual.

## Tablas de Supabase

```sql
-- Alumnas (extiende auth.users de Supabase)
create table alumnas (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null,
  telefono text,
  fecha_alta date default current_date,
  es_admin boolean default false,
  notas text
);

-- Horarios fijos: martes y jueves 19:15, miércoles y viernes 10:00
create table horarios (
  id serial primary key,
  dia_semana int not null,        -- 2=martes, 3=miércoles, 4=jueves, 5=viernes
  hora time not null,
  cupo int default 6,
  activo boolean default true
);

-- Cada ocurrencia real de clase
create table clases (
  id serial primary key,
  horario_id int references horarios,
  fecha date not null,
  cupo int default 6,
  cancelada boolean default false,
  unique (horario_id, fecha)
);

-- Reserva: "hoy voy"
create table reservas (
  id serial primary key,
  alumna_id uuid references alumnas on delete cascade,
  clase_id int references clases on delete cascade,
  creada_en timestamptz default now(),
  unique (alumna_id, clase_id)
);

-- Asistencia con doble check-in
create table asistencias (
  id serial primary key,
  alumna_id uuid references alumnas on delete cascade,
  clase_id int references clases on delete cascade,
  checkin_alumna timestamptz,     -- lo pone ella
  confirmada_admin timestamptz,   -- lo pones tú
  unique (alumna_id, clase_id)
);

-- Paquetes: tú los activas cuando recibes el pago
create table paquetes (
  id serial primary key,
  alumna_id uuid references alumnas on delete cascade,
  tipo text default 'mensualidad', -- 'introduccion' | 'mensualidad'
  clases_totales int default 8,
  clases_usadas int default 0,
  monto numeric,
  forma_pago text,                 -- 'transferencia' | 'efectivo'
  fecha_pago date,
  vence date,
  activo boolean default true
);

-- Valoraciones: una alumna puede tener varias en el tiempo
create table valoraciones (
  id serial primary key,
  alumna_id uuid references alumnas on delete cascade,
  numero int,                      -- 1, 2, 3... orden de la valoración
  fecha date default current_date,
  edad int,
  ciclo text,
  partos text,
  observaciones text,
  tonicidad_abdominal text,
  competencia_abdominal_dedos numeric,
  coactivacion_abdominal text,
  diastasis_supraumbilical numeric,
  diastasis_umbilical numeric,
  diastasis_infraumbilical numeric,
  tonicidad_diafragma_izq text,
  tonicidad_diafragma_der text,
  competencia_perineal text,
  perimetro_cintura numeric,
  perimetro_ombligo numeric,
  perimetro_bajo_ombligo numeric,
  perimetro_cadera numeric,
  perimetro_cintura_apnea numeric,
  creada_en timestamptz default now()
);

-- Contenido: videos de YouTube y meditaciones
create table contenido (
  id serial primary key,
  titulo text not null,
  categoria text,                  -- 'hipopresivos' | 'meditaciones'
  youtube_url text,
  descripcion text,
  orden int default 0,
  publicado boolean default true
);
```

**Regla de cupo:** antes de insertar una reserva, contar cuántas hay para esa `clase_id`. Si son 6, se rechaza. Conviene hacerlo con una función de Postgres para que no haya dos reservas simultáneas que pasen el límite.

**Regla de descuento:** cuando confirmas una asistencia, se suma 1 a `clases_usadas` del paquete activo de esa alumna.

**Seguridad (RLS):** cada alumna solo puede leer y escribir sus propios datos. Tú, con `es_admin = true`, puedes ver todo.

## Los pasos

1. **Ahora:** el diseño de las pantallas está listo (este archivo).
2. **Tú:** creas cuenta en supabase.com, proyecto nuevo, pegas el SQL de arriba en el SQL Editor.
3. **Con Claude Code:** en tu computadora, con la carpeta del proyecto, le pides que conecte la app a Supabase usando este documento. Ahí se escribe la lógica real de login, reservas y check-in.
4. **Publicar:** repositorio en GitHub, activas GitHub Pages, y queda en línea.

## Sobre Calendly

No hace falta. Calendly no sabe de paquetes ni de asistencias, y tendrías dos sistemas separados. El apartado de clases dentro de la app queda conectado con el paquete de cada alumna, que es lo que necesitas.
