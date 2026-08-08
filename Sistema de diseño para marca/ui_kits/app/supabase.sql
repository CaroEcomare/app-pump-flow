-- ============================================
-- Pump&Flow — Base de datos
-- Pega TODO este archivo en el SQL Editor de Supabase y córrelo.
-- ============================================

-- Alumnas (extiende auth.users de Supabase)
create table alumnas (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null,
  telefono text,
  fecha_alta date default current_date,
  es_admin boolean default false,
  notas text
);

-- Horarios fijos
create table horarios (
  id serial primary key,
  dia_semana int not null,
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
  checkin_alumna timestamptz,
  confirmada_admin timestamptz,
  unique (alumna_id, clase_id)
);

-- Paquetes
create table paquetes (
  id serial primary key,
  alumna_id uuid references alumnas on delete cascade,
  tipo text default 'mensualidad',
  clases_totales int default 8,
  clases_usadas int default 0,
  monto numeric,
  forma_pago text,
  fecha_pago date,
  vence date,
  activo boolean default true
);

-- Valoraciones (varias por alumna, en el tiempo)
create table valoraciones (
  id serial primary key,
  alumna_id uuid references alumnas on delete cascade,
  numero int,
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
  categoria text,
  youtube_url text,
  descripcion text,
  orden int default 0,
  publicado boolean default true
);

-- ============================================
-- Tus horarios
-- 2=martes, 3=miércoles, 4=jueves, 5=viernes
-- ============================================
insert into horarios (dia_semana, hora, cupo) values
  (2, '19:15', 6),
  (4, '19:15', 6),
  (3, '10:00', 6),
  (5, '10:00', 6);

-- ============================================
-- Seguridad: cada alumna ve solo lo suyo, tú ves todo
-- ============================================
alter table alumnas enable row level security;
alter table reservas enable row level security;
alter table asistencias enable row level security;
alter table paquetes enable row level security;
alter table valoraciones enable row level security;
alter table clases enable row level security;
alter table horarios enable row level security;
alter table contenido enable row level security;

create or replace function es_admin()
returns boolean language sql security definer stable as $$
  select coalesce((select es_admin from alumnas where id = auth.uid()), false);
$$;

create policy "alumna ve su perfil" on alumnas
  for select using (id = auth.uid() or es_admin());
create policy "alumna edita su perfil" on alumnas
  for update using (id = auth.uid() or es_admin());
create policy "alta de perfil propio" on alumnas
  for insert with check (id = auth.uid());

create policy "ver clases" on clases for select using (true);
create policy "admin edita clases" on clases for all using (es_admin());
create policy "ver horarios" on horarios for select using (true);
create policy "admin edita horarios" on horarios for all using (es_admin());
create policy "ver contenido" on contenido for select using (publicado or es_admin());
create policy "admin edita contenido" on contenido for all using (es_admin());

create policy "ver reservas" on reservas for select using (true);
create policy "alumna aparta su lugar" on reservas
  for insert with check (alumna_id = auth.uid());
create policy "alumna cancela su lugar" on reservas
  for delete using (alumna_id = auth.uid() or es_admin());

create policy "ver asistencias propias" on asistencias
  for select using (alumna_id = auth.uid() or es_admin());
create policy "alumna hace checkin" on asistencias
  for insert with check (alumna_id = auth.uid());
create policy "admin confirma asistencia" on asistencias
  for update using (es_admin());

create policy "ver paquete propio" on paquetes
  for select using (alumna_id = auth.uid() or es_admin());
create policy "admin activa paquetes" on paquetes for all using (es_admin());

create policy "solo admin ve valoraciones" on valoraciones
  for all using (es_admin());

-- ============================================
-- Cupo de 6: rechaza la reserva si la clase está llena
-- ============================================
create or replace function checa_cupo()
returns trigger language plpgsql as $$
declare ocupados int; limite int;
begin
  select count(*) into ocupados from reservas where clase_id = new.clase_id;
  select cupo into limite from clases where id = new.clase_id;
  if ocupados >= limite then
    raise exception 'Esta clase ya está llena';
  end if;
  return new;
end;
$$;

create trigger trg_cupo before insert on reservas
  for each row execute function checa_cupo();

-- ============================================
-- Al confirmar asistencia, descuenta una clase del paquete
-- ============================================
create or replace function descuenta_clase()
returns trigger language plpgsql as $$
begin
  if new.confirmada_admin is not null and old.confirmada_admin is null then
    update paquetes set clases_usadas = clases_usadas + 1
    where alumna_id = new.alumna_id and activo = true
      and clases_usadas < clases_totales;
  end if;
  return new;
end;
$$;

create trigger trg_descuenta after update on asistencias
  for each row execute function descuenta_clase();
