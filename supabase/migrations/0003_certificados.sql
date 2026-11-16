-- ProTerm: certificado de calibración adjunto a cada equipo.
-- Correr una sola vez en el SQL Editor de Supabase, después de 0002_calibracion.sql.
--
-- El PDF se guarda en Supabase Storage, en el bucket privado "certificados".
-- La app lo entrega con un enlace temporal, generado desde el servidor.

alter table equipos
  add column certificado_numero text,
  add column certificado_laboratorio text,
  add column certificado_path text,
  add column certificado_subido_at timestamptz;

-- Vista de estado: se agregan los datos del certificado al final.
create or replace view equipos_estado with (security_invoker = true) as
select
  e.id,
  e.codigo,
  e.nombre,
  e.categoria,
  (u.salida_id is not null) as en_uso,
  u.salida_id,
  u.furgon_id,
  u.furgon_nombre,
  u.responsable,
  u.fecha_retorno_estimada,
  e.fecha_calibracion,
  e.fecha_vencimiento,
  e.certificado_numero,
  e.certificado_laboratorio,
  (e.certificado_path is not null) as tiene_certificado
from equipos e
left join (
  select
    si.equipo_id,
    s.id as salida_id,
    f.id as furgon_id,
    f.nombre as furgon_nombre,
    us.nombre as responsable,
    s.fecha_retorno_estimada
  from salida_items si
  join salidas s on s.id = si.salida_id and s.estado = 'abierta'
  join furgones f on f.id = s.furgon_id
  join usuarios us on us.id = s.usuario_id
  where si.devuelto_at is null
) u on u.equipo_id = e.id;

revoke all on equipos_estado from anon, authenticated;
grant all on equipos_estado to service_role;

-- Bucket privado para los PDF: máximo 4 MB, solo PDF.
-- Sin políticas: solo la service role (el servidor de la app) puede leer y escribir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('certificados', 'certificados', false, 4194304, array['application/pdf'])
on conflict (id) do nothing;
