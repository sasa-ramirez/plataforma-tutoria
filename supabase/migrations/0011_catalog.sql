-- ============================================================
-- 0011 — Catálogo académico: Facultad → Carrera → Asignatura
-- Aditivo y NO rompe nada: los cursos existentes siguen igual
-- (subject_id es opcional). Ejecutar DESPUÉS de 0001-0010. Idempotente.
-- ============================================================

create table if not exists faculties (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists careers (
  id         uuid primary key default gen_random_uuid(),
  faculty_id uuid not null references faculties(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (faculty_id, name)
);
create index if not exists idx_careers_faculty on careers(faculty_id);

create table if not exists subjects (
  id         uuid primary key default gen_random_uuid(),
  career_id  uuid not null references careers(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (career_id, name)
);
create index if not exists idx_subjects_career on subjects(career_id);

-- El curso (grupo del profe) puede colgar de una asignatura. Opcional.
alter table courses add column if not exists subject_id uuid references subjects(id) on delete set null;
create index if not exists idx_courses_subject on courses(subject_id);

-- ---------- RLS ----------
alter table faculties enable row level security;
alter table careers   enable row level security;
alter table subjects  enable row level security;

-- Cualquier usuario autenticado puede LEER el catálogo (para elegir/filtrar).
drop policy if exists "faculties read" on faculties;
create policy "faculties read" on faculties for select using (true);
drop policy if exists "careers read" on careers;
create policy "careers read" on careers for select using (true);
drop policy if exists "subjects read" on subjects;
create policy "subjects read" on subjects for select using (true);

-- Solo ADMIN puede crear/editar/borrar el catálogo.
drop policy if exists "faculties admin write" on faculties;
create policy "faculties admin write" on faculties for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
drop policy if exists "careers admin write" on careers;
create policy "careers admin write" on careers for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
drop policy if exists "subjects admin write" on subjects;
create policy "subjects admin write" on subjects for all
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- ============================================================
-- SIEMBRA — Universidad de La Guajira (editable desde el panel admin)
-- ============================================================
insert into faculties (name) values
  ('Facultad de Ingeniería'),
  ('Facultad de Ciencias Económicas y Administrativas'),
  ('Facultad de Ciencias de la Educación'),
  ('Facultad de Ciencias Básicas y Aplicadas'),
  ('Facultad de Ciencias Sociales y Humanas'),
  ('Facultad de Ciencias de la Salud')
on conflict (name) do nothing;

-- Carreras por facultad (inserta solo si no existen)
insert into careers (faculty_id, name)
select f.id, c.name from faculties f
join (values
  ('Facultad de Ingeniería', 'Ingeniería de Sistemas'),
  ('Facultad de Ingeniería', 'Ingeniería Industrial'),
  ('Facultad de Ingeniería', 'Ingeniería Ambiental'),
  ('Facultad de Ingeniería', 'Ingeniería Civil'),
  ('Facultad de Ingeniería', 'Ingeniería Electrónica'),
  ('Facultad de Ciencias Económicas y Administrativas', 'Administración de Empresas'),
  ('Facultad de Ciencias Económicas y Administrativas', 'Contaduría Pública'),
  ('Facultad de Ciencias Económicas y Administrativas', 'Economía'),
  ('Facultad de Ciencias Económicas y Administrativas', 'Administración de Empresas Turísticas y Hoteleras'),
  ('Facultad de Ciencias Económicas y Administrativas', 'Negocios Internacionales'),
  ('Facultad de Ciencias de la Educación', 'Licenciatura en Pedagogía Infantil'),
  ('Facultad de Ciencias de la Educación', 'Licenciatura en Etnoeducación'),
  ('Facultad de Ciencias de la Educación', 'Licenciatura en Ciencias Sociales'),
  ('Facultad de Ciencias de la Educación', 'Licenciatura en Matemáticas'),
  ('Facultad de Ciencias de la Educación', 'Licenciatura en Lenguas Extranjeras'),
  ('Facultad de Ciencias Básicas y Aplicadas', 'Biología'),
  ('Facultad de Ciencias Básicas y Aplicadas', 'Microbiología'),
  ('Facultad de Ciencias Sociales y Humanas', 'Derecho'),
  ('Facultad de Ciencias Sociales y Humanas', 'Trabajo Social'),
  ('Facultad de Ciencias Sociales y Humanas', 'Comunicación Social'),
  ('Facultad de Ciencias Sociales y Humanas', 'Psicología'),
  ('Facultad de Ciencias de la Salud', 'Enfermería')
) as c(faculty, name) on c.faculty = f.name
on conflict (faculty_id, name) do nothing;
