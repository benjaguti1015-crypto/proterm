-- ProTerm: asocia los certificados de ejemplo (ficticios) a 7 equipos de la demo.
-- Correr en el SQL Editor de Supabase, después de la migración 0003_certificados.sql.
--
-- Los PDF vienen dentro de la app (public/certificados-ejemplo/), no hace falta subirlos.
-- Las fechas y números coinciden con lo que dice cada PDF.
-- Si después subes un certificado real desde /equipos, ese reemplaza al de ejemplo.

update equipos as e
set
  certificado_numero = c.numero,
  certificado_laboratorio = c.laboratorio,
  fecha_calibracion = c.calibracion,
  fecha_vencimiento = c.vence,
  certificado_path = 'ejemplo/' || e.codigo || '.pdf',
  certificado_subido_at = now()
from (values
  ('RU-SON-001', 'CAL-2026-0013', 'Laboratorio de Acústica Sur', date '2026-06-19', date '2027-06-19'),
  ('RU-SON-002', 'CAL-2025-0014', 'Laboratorio de Acústica Sur', date '2025-11-28', date '2026-11-28'),
  ('RU-CAL-001', 'CAL-2026-0015', 'Laboratorio de Acústica Sur', date '2026-06-19', date '2027-06-19'),
  ('RU-CAL-002', 'CAL-2026-0016', 'Laboratorio de Acústica Sur', date '2026-06-19', date '2027-06-19'),
  ('PM-GAS-001', 'CAL-2026-0008', 'Metrología Ambiental Centro', date '2026-06-19', date '2027-06-19'),
  ('PM-GAS-002', 'CAL-2025-0009', 'Metrología Ambiental Centro', date '2025-11-11', date '2026-11-11'),
  ('PM-PIT-001', 'CAL-2026-0004', 'Metrología Ambiental Centro', date '2026-06-19', date '2027-06-19')
) as c (codigo, numero, laboratorio, calibracion, vence)
where e.codigo = c.codigo;

-- Comprobación: deben aparecer los 7 equipos con su certificado.
select codigo, certificado_numero, fecha_vencimiento, certificado_path
from equipos
where certificado_path like 'ejemplo/%'
order by codigo;
