-- ============================================================================
-- PREPARADA, NO EJECUTADA. No aplicar en producción hasta revisión y
-- autorización explícita de Julia (Fase B → "detente y muestra el plan
-- antes de ejecutar SQL").
--
-- Objetivo: añadir una clave estable `linea_negocio` (montada_sound | dj |
-- real_madrid | montada_installations) a las tablas que hoy solo tienen
-- `area` ('montada' | 'dj', TEXT libre sin CHECK) o, en el caso de `equipo`,
-- una tercera variante distinta (`area` con 'montada'|'dj'|'real_madrid').
--
-- Idempotente: usa IF NOT EXISTS / IF EXISTS en todo, y el backfill solo
-- toca filas cuyo valor sea NULL, por lo que se puede ejecutar varias veces
-- sin duplicar ni sobrescribir nada. No borra ni renombra ninguna columna
-- existente — `area` se mantiene intacta para no romper el código actual
-- mientras conviven ambos sistemas.
--
-- Backfill de Real Madrid: las 15 filas de `ingresos` con
-- tipo_evento = 'real_madrid' (confirmadas en la auditoría), MÁS los 2
-- registros confirmados por Julia el 2026-09-06 tras revisión manual
-- (nunca reclasificados automáticamente):
--   - id 'tavsmkotyqfms30yxr1' ("Real Madrid vs Real Sociedad", 2026-08-26)
--   - id 'gsdi12lqqoms30zk7x'  ("Real Madrid vs Malaga",        2026-08-30)
-- Ambos tenían tipo_evento = 'Boda' por error de captura — son partidos del
-- Real Madrid. Se corrige tipo_evento a 'Partido' y se clasifican como
-- 'real_madrid'. Se identifican por ID exacto (no por texto) para no
-- afectar accidentalmente a ningún otro registro. Concepto, cliente,
-- fecha, importes, cobros y factura NO se tocan. No tienen gastos_evento,
-- pagos_evento ni suplidos vinculados (comprobado por ingreso_id).
-- ============================================================================

-- 1. Nueva columna en cada tabla afectada -----------------------------------
ALTER TABLE ingresos      ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
ALTER TABLE gastos        ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
ALTER TABLE gastos_evento ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
ALTER TABLE pagos_evento  ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
ALTER TABLE suplidos      ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
ALTER TABLE facturas      ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
ALTER TABLE documentos    ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
ALTER TABLE impuestos     ADD COLUMN IF NOT EXISTS linea_negocio TEXT;
-- equipo ya tiene una columna `area` con 'montada'|'dj'|'real_madrid' —
-- se añade linea_negocio en paralelo para unificar la clave con el resto.
ALTER TABLE equipo        ADD COLUMN IF NOT EXISTS linea_negocio TEXT;

-- 2. Backfill: montada → montada_sound --------------------------------------
UPDATE ingresos      SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';
UPDATE gastos         SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';
UPDATE gastos_evento  SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';
UPDATE pagos_evento   SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';
UPDATE suplidos       SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';
UPDATE facturas       SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';
UPDATE documentos     SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';
UPDATE equipo         SET linea_negocio = 'montada_sound' WHERE linea_negocio IS NULL AND area = 'montada';

-- 3a. Corrección puntual de tipo_evento — solo los 2 IDs confirmados por
--     Julia (revisión manual, no un patrón de texto). Se aplica ANTES del
--     backfill por tipo_evento para que el paso 3b ya los reconozca.
UPDATE ingresos SET tipo_evento = 'Partido'
  WHERE id IN ('tavsmkotyqfms30yxr1', 'gsdi12lqqoms30zk7x') AND tipo_evento = 'Boda';

-- 3b. Backfill: dj + tipo_evento = 'real_madrid' → real_madrid ---------------
--    (15 filas confirmadas por auditoría + las 2 corregidas en 3a)
UPDATE ingresos SET linea_negocio = 'real_madrid'
  WHERE linea_negocio IS NULL AND area = 'dj' AND tipo_evento IN ('real_madrid', 'Partido');

-- gastos_evento/pagos_evento/suplidos heredan la línea de su ingreso padre
UPDATE gastos_evento ge SET linea_negocio = i.linea_negocio
  FROM ingresos i WHERE ge.ingreso_id = i.id AND ge.linea_negocio IS NULL AND i.linea_negocio = 'real_madrid';
UPDATE pagos_evento pe SET linea_negocio = i.linea_negocio
  FROM ingresos i WHERE pe.ingreso_id = i.id AND pe.linea_negocio IS NULL AND i.linea_negocio = 'real_madrid';
UPDATE suplidos su SET linea_negocio = i.linea_negocio
  FROM ingresos i WHERE su.ingreso_id = i.id AND su.linea_negocio IS NULL AND i.linea_negocio = 'real_madrid';

-- equipo ya tenía su propio area='real_madrid' — se traslada tal cual
UPDATE equipo SET linea_negocio = 'real_madrid' WHERE linea_negocio IS NULL AND area = 'real_madrid';

-- 4. Resto de filas 'dj' (no Real Madrid) → dj -------------------------------
UPDATE ingresos      SET linea_negocio = 'dj' WHERE linea_negocio IS NULL AND area = 'dj';
UPDATE gastos         SET linea_negocio = 'dj' WHERE linea_negocio IS NULL AND area = 'dj';
UPDATE gastos_evento  SET linea_negocio = 'dj' WHERE linea_negocio IS NULL AND area = 'dj';
UPDATE pagos_evento   SET linea_negocio = 'dj' WHERE linea_negocio IS NULL AND area = 'dj';
UPDATE suplidos       SET linea_negocio = 'dj' WHERE linea_negocio IS NULL AND area = 'dj';
UPDATE facturas       SET linea_negocio = 'dj' WHERE linea_negocio IS NULL AND area = 'dj';
UPDATE documentos     SET linea_negocio = 'dj' WHERE linea_negocio IS NULL AND area = 'dj';

-- 5. Marca de auditoría para futuros casos ambiguos que aparezcan (los 2
--    conocidos ya se corrigieron en el paso 3a y quedan excluidos aquí) ----
UPDATE ingresos
  SET notas = COALESCE(notas, '') || CASE WHEN notas ILIKE '%[revisar-linea]%' THEN '' ELSE E'\n[REVISAR-LINEA] cliente contiene "Real Madrid" pero tipo_evento no lo confirma — revisar manualmente.' END
  WHERE area = 'dj' AND tipo_evento NOT IN ('real_madrid', 'Partido') AND cliente ILIKE '%real madrid%';

-- 6. CHECK constraint — se añade en un paso posterior separado, solo cuando
--    TODAS las filas tengan linea_negocio no nulo, para no romper inserts en
--    curso. No incluido en esta migración a propósito.
-- ALTER TABLE ingresos ADD CONSTRAINT ingresos_linea_negocio_check
--   CHECK (linea_negocio IN ('montada_sound','dj','real_madrid','montada_installations'));
