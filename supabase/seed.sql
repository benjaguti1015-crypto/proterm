-- ProTerm: datos de ejemplo (ficticios).
-- Correr en el SQL Editor de Supabase después de la migración.
--
-- Requiere haber corrido las migraciones 0001 y 0002.
--
-- OJO: este script BORRA todo lo que haya en las tablas y deja la demo
-- en su estado inicial. Sirve para reiniciar antes de grabar el video.

truncate table salida_items, salidas, kit_servicio, usuarios, equipos, servicios, furgones
  restart identity cascade;

insert into furgones (codigo, nombre) values
  ('furgon-1', 'Furgón 1'),
  ('furgon-2', 'Furgón 2'),
  ('furgon-3', 'Furgón 3');

insert into servicios (nombre) values
  ('Material particulado (isocinético)'),
  ('Ruido (acústica)');

insert into equipos (codigo, nombre, categoria) values
  -- Material particulado
  ('PM-CON-001', 'Consola de control', 'Muestreo'),
  ('PM-SON-001', 'Sonda con liner', 'Muestreo'),
  ('PM-BOQ-001', 'Juego de boquillas', 'Muestreo'),
  ('PM-PIT-001', 'Tubo Pitot tipo S', 'Muestreo'),
  ('PM-IMP-001', 'Caja caliente de impingers', 'Muestreo'),
  ('PM-UMB-001', 'Línea umbilical', 'Muestreo'),
  ('PM-BOM-001', 'Bomba de vacío', 'Muestreo'),
  ('PM-GAS-001', 'Analizador de gases O₂/CO/CO₂', 'Medición'),
  ('PM-GAS-002', 'Analizador de gases O₂/CO/CO₂', 'Medición'),
  ('PM-TER-001', 'Pirómetro/termocupla', 'Medición'),
  ('PM-BAR-001', 'Barómetro', 'Medición'),
  ('PM-MAN-001', 'Manómetro inclinado', 'Medición'),
  -- Ruido
  ('RU-SON-001', 'Sonómetro clase 1', 'Medición'),
  ('RU-SON-002', 'Sonómetro clase 1', 'Medición'),
  ('RU-CAL-001', 'Calibrador acústico', 'Medición'),
  ('RU-CAL-002', 'Calibrador acústico', 'Medición'),
  ('RU-ANE-001', 'Anemómetro / mini estación meteorológica', 'Medición'),
  ('RU-TRI-001', 'Trípode', 'Accesorios'),
  ('RU-PAN-001', 'Pantalla antiviento', 'Accesorios'),
  ('RU-CAB-001', 'Cable de extensión', 'Accesorios'),
  -- Compartidos por ambos servicios
  ('GEN-GPS-001', 'GPS', 'Accesorios'),
  ('GEN-HUI-001', 'Huincha / medidor láser', 'Accesorios');

-- Calibraciones de ejemplo, relativas a hoy (hora de Chile).
-- Los accesorios no se calibran y quedan sin fechas.
-- Vigentes: calibrados hace unos 5 meses, válidos por un año.
update equipos
set
  fecha_calibracion = (now() at time zone 'America/Santiago')::date - 150,
  fecha_vencimiento = (now() at time zone 'America/Santiago')::date + 215
where categoria = 'Medición' or codigo in ('PM-CON-001', 'PM-BOQ-001', 'PM-PIT-001');

-- Vencido hace 5 días: no puede salir a terreno.
update equipos
set
  fecha_calibracion = (now() at time zone 'America/Santiago')::date - 370,
  fecha_vencimiento = (now() at time zone 'America/Santiago')::date - 5
where codigo = 'PM-GAS-002';

-- Por vencer: le quedan 12 días.
update equipos
set
  fecha_calibracion = (now() at time zone 'America/Santiago')::date - 353,
  fecha_vencimiento = (now() at time zone 'America/Santiago')::date + 12
where codigo = 'RU-SON-002';

-- Kit de material particulado: equipos PM + compartidos.
-- Obligatorios: consola, sonda, boquillas, Pitot y analizador de gases.
insert into kit_servicio (servicio_id, equipo_id, obligatorio)
select
  (select id from servicios where nombre = 'Material particulado (isocinético)'),
  e.id,
  e.codigo in ('PM-CON-001', 'PM-SON-001', 'PM-BOQ-001', 'PM-PIT-001', 'PM-GAS-001', 'PM-GAS-002')
from equipos e
where e.codigo like 'PM-%' or e.codigo like 'GEN-%';

-- Kit de ruido: equipos RU + compartidos.
-- Obligatorios: sonómetro y calibrador.
insert into kit_servicio (servicio_id, equipo_id, obligatorio)
select
  (select id from servicios where nombre = 'Ruido (acústica)'),
  e.id,
  e.codigo in ('RU-SON-001', 'RU-SON-002', 'RU-CAL-001', 'RU-CAL-002')
from equipos e
where e.codigo like 'RU-%' or e.codigo like 'GEN-%';

-- Usuarios de ejemplo. El PIN de ambos es 1234.
-- es_admin queda listo para cuando /equipos se restrinja a administradores.
insert into usuarios (nombre, pin_hash, es_admin) values
  ('Pedro', '$2b$10$kgpmbcn8rE6qUwyZAma.0Okphln.r.ZB7aggtGKufLR9NrT8JuHOy', true),
  ('Juanito', '$2b$10$kgpmbcn8rE6qUwyZAma.0Okphln.r.ZB7aggtGKufLR9NrT8JuHOy', false);

-- Salidas abiertas de ejemplo, para que el conflicto se vea de inmediato.

-- Furgón 2, por Pedro: consola y un analizador de gases. Vuelve mañana.
with nueva as (
  insert into salidas (furgon_id, servicio_id, usuario_id, fecha_retorno_estimada)
  values (
    (select id from furgones where codigo = 'furgon-2'),
    (select id from servicios where nombre = 'Material particulado (isocinético)'),
    (select id from usuarios where nombre = 'Pedro'),
    (now() at time zone 'America/Santiago')::date + 1
  )
  returning id
)
insert into salida_items (salida_id, equipo_id)
select nueva.id, e.id from nueva, equipos e
where e.codigo in ('PM-CON-001', 'PM-GAS-001');

-- Furgón 3, por Juanito: un sonómetro y un calibrador. Vuelve en 2 días.
with nueva as (
  insert into salidas (furgon_id, servicio_id, usuario_id, fecha_retorno_estimada)
  values (
    (select id from furgones where codigo = 'furgon-3'),
    (select id from servicios where nombre = 'Ruido (acústica)'),
    (select id from usuarios where nombre = 'Juanito'),
    (now() at time zone 'America/Santiago')::date + 2
  )
  returning id
)
insert into salida_items (salida_id, equipo_id)
select nueva.id, e.id from nueva, equipos e
where e.codigo in ('RU-SON-001', 'RU-CAL-001');
