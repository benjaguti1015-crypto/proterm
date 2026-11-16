-- ProTerm, fase 2: calibración de equipos.
-- Correr una sola vez en el SQL Editor de Supabase, después de 0001_inicial.sql.
--
-- fecha_calibracion: cuándo se calibró el equipo por última vez.
-- fecha_vencimiento: hasta qué día es válida esa calibración (inclusive).
-- Un equipo con la calibración vencida no puede salir a terreno.

-- ---------------------------------------------------------------
-- Administradores: pueden editar las fechas de calibración.
-- ---------------------------------------------------------------

alter table usuarios add column es_admin boolean not null default false;

-- ---------------------------------------------------------------
-- Vista de estado: se agregan las fechas de calibración al final.
-- ---------------------------------------------------------------

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
  e.fecha_vencimiento
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

-- ---------------------------------------------------------------
-- crear_salida: además de los conflictos, rechaza equipos con la
-- calibración vencida. Si hay alguno, no guarda nada.
-- ---------------------------------------------------------------

create or replace function crear_salida(
  p_furgon_id bigint,
  p_servicio_id bigint,
  p_usuario_id bigint,
  p_fecha_retorno date,
  p_equipo_ids bigint[]
) returns jsonb
language plpgsql
as $$
declare
  v_ids bigint[];
  v_conflictos jsonb;
  v_vencidos jsonb;
  v_salida_id bigint;
  v_hoy date := (now() at time zone 'America/Santiago')::date;
begin
  select array_agg(distinct x) into v_ids from unnest(p_equipo_ids) as x;

  if v_ids is null then
    return jsonb_build_object('ok', false, 'error', 'sin_equipos');
  end if;

  -- Bloquea los equipos pedidos: dos confirmaciones simultáneas sobre
  -- el mismo equipo se atienden una después de la otra.
  perform 1 from equipos where id = any (v_ids) order by id for update;

  if exists (
    select 1 from unnest(v_ids) as x
    where not exists (
      select 1 from kit_servicio k where k.servicio_id = p_servicio_id and k.equipo_id = x
    )
  ) then
    return jsonb_build_object('ok', false, 'error', 'fuera_de_kit');
  end if;

  if exists (select 1 from salidas where furgon_id = p_furgon_id and estado = 'abierta') then
    return jsonb_build_object('ok', false, 'error', 'furgon_ocupado');
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'codigo', ee.codigo,
      'nombre', ee.nombre,
      'furgon_nombre', ee.furgon_nombre,
      'responsable', ee.responsable,
      'fecha_retorno_estimada', ee.fecha_retorno_estimada
    ) order by ee.codigo
  )
  into v_conflictos
  from equipos_estado ee
  where ee.id = any (v_ids) and ee.en_uso;

  if v_conflictos is not null then
    return jsonb_build_object('ok', false, 'error', 'conflicto', 'conflictos', v_conflictos);
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'codigo', e.codigo,
      'nombre', e.nombre,
      'fecha_vencimiento', e.fecha_vencimiento
    ) order by e.codigo
  )
  into v_vencidos
  from equipos e
  where e.id = any (v_ids) and e.fecha_vencimiento < v_hoy;

  if v_vencidos is not null then
    return jsonb_build_object('ok', false, 'error', 'vencidos', 'vencidos', v_vencidos);
  end if;

  insert into salidas (furgon_id, servicio_id, usuario_id, fecha_retorno_estimada)
  values (p_furgon_id, p_servicio_id, p_usuario_id, p_fecha_retorno)
  returning id into v_salida_id;

  insert into salida_items (salida_id, equipo_id)
  select v_salida_id, x from unnest(v_ids) as x;

  return jsonb_build_object('ok', true, 'salida_id', v_salida_id);
exception
  -- Dos confirmaciones simultáneas para el mismo furgón.
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'furgon_ocupado');
end;
$$;

-- Las fechas tienen que tener sentido: no puede vencer antes de calibrarse.
alter table equipos add constraint equipos_fechas_calibracion_coherentes
  check (fecha_vencimiento is null or fecha_calibracion is null or fecha_vencimiento >= fecha_calibracion);

-- Permisos: igual que en 0001, solo la service role.
revoke all on equipos_estado from anon, authenticated;
grant all on equipos_estado to service_role;
revoke execute on function crear_salida(bigint, bigint, bigint, date, bigint[]) from public, anon, authenticated;
grant execute on function crear_salida(bigint, bigint, bigint, date, bigint[]) to service_role;
