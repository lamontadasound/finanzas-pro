-- ============================================================================
-- FASE H — Facturación: numeración transaccional, emisores fiscales,
-- permisos finos, snapshots y sincronización con Drive.
-- PREPARADA, NO EJECUTADA. NO VERIFICADA CONTRA POSTGRES REAL.
--
-- Revisión 2 — corrige nueve defectos reales encontrados auditando la
-- revisión 1. Cada uno está marcado en su sitio con [FIX-n]:
--
--   [FIX-1] TIPOS DE ID. La revisión 1 declaraba `p_factura_id UUID`,
--           `p_ingreso_id UUID`, `p_fecha DATE`, `clientes.id UUID` y una
--           clave ajena `factura_rectifica_id UUID REFERENCES facturas(id)`.
--           El esquema real (20260713_001_schema_completo.sql) usa
--           `facturas.id TEXT`, `ingresos.id TEXT`, `facturas.fecha TEXT`:
--           los ids los genera el cliente con `uid()` (base36, NO UUID).
--           La clave ajena UUID→TEXT hacía FALLAR la migración entera al
--           ejecutarse. Aquí todo es TEXT, coincidiendo con lo existente.
--   [FIX-2] UNICIDAD POR EMISOR Y SERIE. El índice único era global sobre
--           `numero_secuencial`: con dos emisores, cada uno con su contador,
--           el segundo colisionaba contra el primero. Ahora es único por
--           (emisor_id, serie, numero_secuencial), y `facturas` guarda
--           `emisor_id` para poder indexarlo.
--   [FIX-3] REINTENTO CONCURRENTE. La comprobación de idempotencia leía
--           `numero_secuencial` SIN bloquear la fila: dos llamadas
--           simultáneas con el mismo `p_factura_id` (doble clic, reintento)
--           leían NULL las dos y ambas consumían número. Ahora se bloquea la
--           fila de la factura (FOR UPDATE) ANTES de comprobar y asignar.
--   [FIX-4] CONFIANZA EN EL NAVEGADOR. `p_linea_id` y `p_emisor_id` venían
--           del cliente: bastaba enviar una línea permitida para emitir
--           sobre un ingreso de otra. Ahora la línea se DERIVA del registro
--           real de `ingresos` y el emisor de `proyecto_emisor`; el
--           navegador ya no envía ninguno de los dos.
--   [FIX-5] RLS DEL CONTADOR. `numeracion_contador` no tenía RLS: era
--           legible y ESCRIBIBLE directamente vía PostgREST con la anon key.
--   [FIX-6] FACTURAS EMITIDAS SIN PROTECCIÓN. Nada impedía UPDATE/DELETE
--           directo de una factura ya emitida saltándose las funciones.
--   [FIX-7] CARRERA AL CREAR LA FILA DEL CONTADOR. `PERFORM ... FOR UPDATE`
--           + `IF NOT FOUND THEN INSERT` no es atómico: dos transacciones
--           simultáneas insertaban a la vez y una moría por unicidad. Ahora
--           `INSERT ... ON CONFLICT DO NOTHING` y después el FOR UPDATE.
--   [FIX-8] EMISOR DE LA RECTIFICATIVA. Se leía del snapshot JSON o del
--           cliente. Ahora se lee de `facturas.emisor_id` de la ORIGINAL,
--           en el servidor.
--   [FIX-9] REVERSIÓN. El plan anterior hacía DROP de `configuracion_fiscal`
--           y `clientes` (pérdida de datos). Ver el plan del final: conserva
--           datos y NUNCA reabre políticas públicas.
--
-- Aditiva e idempotente. No borra ni renombra ninguna columna existente.
-- Depende de: 20260908 (permisos) y 20260909 (Auth/RLS/admin), que definen
-- `is_admin`, `has_line_perm` y `has_module_perm`.
-- ============================================================================

BEGIN;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS gasto_id TEXT REFERENCES public.gastos(id);

-- ══ 1. Columnas nuevas en `facturas` — todas opcionales, aditivas ══════════
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS estado TEXT
  CHECK (estado IN ('borrador','emitida','parcialmente_cobrada','cobrada','anulada','pendiente_sincronizar','error_sincronizacion'));
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS porcentaje_facturado NUMERIC;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS numero_secuencial BIGINT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS retencion NUMERIC;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS fecha_emision TIMESTAMPTZ;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS emitida_por UUID;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS anulada_por UUID;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS fecha_anulacion TIMESTAMPTZ;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS historial JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS numero_proveedor TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS proveedor TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS posible_duplicado BOOLEAN DEFAULT false;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS documento_id TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS drive_file_id TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS drive_link TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS drive_nombre_archivo TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS drive_fecha_subida TIMESTAMPTZ;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS drive_subido_por UUID;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS sync_estado TEXT
  CHECK (sync_estado IN ('sin_sincronizar','sincronizada','pendiente','error'));
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS sync_ultimo_error TEXT;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS emisor_snapshot JSONB;
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS cliente_snapshot JSONB;
-- [FIX-1] TEXT, no UUID: `facturas.id` es TEXT en el esquema real.
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS factura_rectifica_id TEXT REFERENCES public.facturas(id);
-- [FIX-2] Emisor bajo el que se emitió: necesario para la unicidad por
-- (emisor, serie) y para que la rectificativa herede el emisor correcto.
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS emisor_id TEXT;


-- ══ 2. Emisores fiscales y asignación por línea ═══════════════════════════
-- Varias filas: una por emisor real. 'default' es el emisor migrado del
-- modelo antiguo de fila única. `id` es TEXT (lo fija un admin o `uid()`).
CREATE TABLE IF NOT EXISTS public.configuracion_fiscal (
  id                    TEXT PRIMARY KEY DEFAULT 'default',
  nombre_interno        TEXT,
  razon_social          TEXT,
  nombre_comercial      TEXT,
  nif_cif               TEXT,
  direccion_fiscal      TEXT,
  email                 TEXT,
  telefono              TEXT,
  iban                  TEXT,
  logo_url              TEXT,
  condiciones_pago      TEXT,
  texto_legal           TEXT,
  serie_formato         TEXT DEFAULT '{numero}',
  numero_inicial        BIGINT,
  numeracion_confirmada BOOLEAN NOT NULL DEFAULT false,
  activo                BOOLEAN NOT NULL DEFAULT true,
  actualizado_por       UUID,
  actualizado_en        TIMESTAMPTZ
);
-- Idempotencia ante una ejecución parcial previa de esta misma migración.
ALTER TABLE public.configuracion_fiscal ADD COLUMN IF NOT EXISTS nombre_interno TEXT;
ALTER TABLE public.configuracion_fiscal ADD COLUMN IF NOT EXISTS numeracion_confirmada BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.configuracion_fiscal ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.configuracion_fiscal DROP CONSTRAINT IF EXISTS solo_fila_default;

CREATE TABLE IF NOT EXISTS public.proyecto_emisor (
  linea_id        TEXT PRIMARY KEY
                  CHECK (linea_id IN ('montada_sound','dj','real_madrid','montada_installations')),
  emisor_id       TEXT NOT NULL REFERENCES public.configuracion_fiscal(id),
  actualizado_por UUID,
  actualizado_en  TIMESTAMPTZ DEFAULT now()
);


-- ══ 3. Clientes ═══════════════════════════════════════════════════════════
-- [FIX-1] `id TEXT`: el cliente lo genera con `uid()` (base36), no con
-- gen_random_uuid(). Con UUID, cada alta desde la app fallaba.
CREATE TABLE IF NOT EXISTS public.clientes (
  id            TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  nif_cif       TEXT,
  direccion     TEXT,
  email         TEXT,
  telefono      TEXT,
  es_empresa    BOOLEAN NOT NULL DEFAULT true,
  observaciones TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ══ 4. Numeración: contador transaccional por (emisor, serie) ═════════════
-- No es una SEQUENCE: `nextval()` NO es transaccional (un ROLLBACK no
-- devuelve el número consumido). Una fila de tabla normal, bloqueada con
-- FOR UPDATE, sí participa por completo en la transacción y se revierte.
CREATE TABLE IF NOT EXISTS public.numeracion_contador (
  emisor_id     TEXT NOT NULL DEFAULT 'default',
  serie         TEXT NOT NULL DEFAULT '',
  ultimo_numero BIGINT NOT NULL DEFAULT 0,
  confirmado    BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (emisor_id, serie)
);

CREATE TABLE IF NOT EXISTS public.numeracion_log (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero      BIGINT NOT NULL,
  emisor_id   TEXT NOT NULL DEFAULT 'default',
  serie       TEXT NOT NULL DEFAULT '',
  factura_id  TEXT,                              -- [FIX-1] TEXT, no UUID
  user_id     UUID NOT NULL,
  asignado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_numeracion_log_numero
  ON public.numeracion_log (emisor_id, serie, numero);


-- ══ 5. Permisos finos de facturación ══════════════════════════════════════
-- Independientes del CRUD genérico del módulo `contabilidad`: se puede
-- poder VER facturas sin poder EMITIRlas, RECTIFICARlas ni GESTIONAR la
-- numeración. Se comprueban DENTRO de las funciones, no solo en la interfaz.
CREATE TABLE IF NOT EXISTS public.user_facturacion_permissions (
  user_id                    UUID PRIMARY KEY,
  puede_emitir               BOOLEAN NOT NULL DEFAULT false,
  puede_rectificar           BOOLEAN NOT NULL DEFAULT false,
  puede_gestionar_numeracion BOOLEAN NOT NULL DEFAULT false,
  actualizado_por            UUID,
  actualizado_en             TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.has_facturacion_perm(p_user_id UUID, p_accion TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.user_facturacion_permissions;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=p_user_id AND activo) THEN RETURN false; END IF;
  IF public.is_admin(p_user_id) THEN RETURN true; END IF;
  SELECT * INTO v_row FROM public.user_facturacion_permissions WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN false; END IF;   -- deny-by-default
  RETURN CASE p_accion
    WHEN 'emitir'               THEN v_row.puede_emitir
    WHEN 'rectificar'           THEN v_row.puede_rectificar
    WHEN 'gestionar_numeracion' THEN v_row.puede_gestionar_numeracion
    ELSE false
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.has_facturacion_perm(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_facturacion_perm(UUID, TEXT) TO authenticated;


-- ══ 6. [FIX-4] Derivación en el servidor: línea y emisor ══════════════════
-- El navegador ya NO envía la línea ni el emisor. La línea se deriva del
-- registro real de `ingresos`, replicando exactamente la lógica de
-- `resolveLinea` del frontend (src/config/resolveLinea.ts); el emisor sale
-- de `proyecto_emisor`.
CREATE OR REPLACE FUNCTION public.linea_de_ingreso(p_ingreso_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ing RECORD;
BEGIN
  IF p_ingreso_id IS NULL THEN RETURN NULL; END IF;
  SELECT i.id, i.area, i.tipo_evento, i.linea_negocio INTO v_ing
    FROM public.ingresos i WHERE i.id = p_ingreso_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_ing.linea_negocio IN ('montada_sound','dj','real_madrid','montada_installations') THEN RETURN v_ing.linea_negocio; END IF;
  IF v_ing.linea_negocio = 'La Montada Installations' THEN RETURN 'montada_installations'; END IF;
  IF v_ing.linea_negocio = 'Real Madrid' THEN RETURN 'real_madrid'; END IF;
  IF v_ing.linea_negocio = 'La Montada Sound' THEN RETURN 'montada_sound'; END IF;
  IF v_ing.area = 'montada' THEN RETURN 'montada_sound'; END IF;
  IF v_ing.id IN ('tavsmkotyqfms30yxr1','gsdi12lqqoms30zk7x') OR v_ing.tipo_evento IN ('Partido','real_madrid') THEN RETURN 'real_madrid'; END IF;
  RETURN 'dj';
END;
$$;
REVOKE ALL ON FUNCTION public.linea_de_ingreso(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.linea_de_ingreso(TEXT) TO authenticated;

-- Emisor asignado a una línea. Sin asignación explícita cae al emisor
-- 'default' (el migrado) — nunca a "el primero de la lista". Devuelve NULL
-- si no hay ninguno activo: quien llame debe fallar, no inventarse uno.
CREATE OR REPLACE FUNCTION public.emisor_de_linea(p_linea TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pe.emisor_id FROM public.proyecto_emisor pe
  JOIN public.configuracion_fiscal cf ON cf.id=pe.emisor_id AND cf.activo
  WHERE pe.linea_id=p_linea;

$$;
REVOKE ALL ON FUNCTION public.emisor_de_linea(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emisor_de_linea(TEXT) TO authenticated;


-- ══ 7. Emisión: número + guardado en UNA operación atómica ════════════════
-- [FIX-3] Bloquea la fila de la factura ANTES de comprobar idempotencia y de
--         asignar número: cierra la carrera del doble clic / reintento.
-- [FIX-4] Deriva línea y emisor del registro real; el cliente no los envía.
-- [FIX-7] Crea la fila del contador con ON CONFLICT DO NOTHING (atómico).
CREATE OR REPLACE FUNCTION public.emitir_numero_factura(
  p_factura_id TEXT,
  p_area TEXT, p_tipo TEXT, p_cliente TEXT, p_concepto TEXT,
  p_base_imponible NUMERIC, p_porcentaje_iva NUMERIC, p_importe_iva NUMERIC,
  p_total NUMERIC, p_fecha TEXT, p_ingreso_id TEXT,
  p_porcentaje_facturado NUMERIC, p_notas TEXT DEFAULT NULL
)
RETURNS TABLE (numero_emitido BIGINT, emisor_asignado TEXT, serie_asignada TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_factura   RECORD;
  v_linea     TEXT;
  v_emisor_id TEXT;
  v_serie     TEXT;
  v_numero    BIGINT;
  v_emisor    JSONB;
  v_cliente   JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;

  -- [FIX-3] Bloqueo de la fila de la factura ANTES de nada. Una segunda
  -- llamada concurrente con el mismo id espera aquí; cuando entra, ya ve el
  -- `numero_secuencial` escrito por la primera y sale por idempotencia.
  SELECT * INTO v_factura FROM public.facturas WHERE id = p_factura_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La factura % no existe — créala como borrador antes de emitir.', p_factura_id;
  END IF;

  v_linea := public.linea_de_ingreso(v_factura.ingreso_id);
  IF NOT public.has_facturacion_perm(auth.uid(),'emitir') OR v_linea IS NULL
     OR NOT public.has_line_perm(auth.uid(),v_linea,'create')
     OR p_ingreso_id IS DISTINCT FROM v_factura.ingreso_id THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='No tienes permiso sobre esta factura o su ingreso.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_factura.ingreso_id,0));
  PERFORM 1 FROM public.ingresos WHERE id=v_factura.ingreso_id FOR SHARE;
  IF v_factura.numero_secuencial IS NOT NULL THEN
    RETURN QUERY SELECT v_factura.numero_secuencial, v_factura.emisor_id, COALESCE(v_factura.serie, '');
    RETURN;
  END IF;

  IF v_factura.tipo <> 'emitida' THEN
    RAISE EXCEPTION 'Solo se numeran facturas emitidas (esta es de tipo %).', v_factura.tipo;
  END IF;

  IF NOT public.has_facturacion_perm(auth.uid(), 'emitir') THEN
    RAISE EXCEPTION 'No tienes permiso para emitir facturas.';
  END IF;

  -- [FIX-4] Línea DERIVADA del ingreso real, no enviada por el navegador.
  v_linea := public.linea_de_ingreso(v_factura.ingreso_id);
  IF v_linea IS NULL THEN
    RAISE EXCEPTION 'No se puede determinar la línea de negocio: la factura debe estar vinculada a un ingreso existente.';
  END IF;
  IF NOT public.has_line_perm(auth.uid(), v_linea, 'create') THEN
    RAISE EXCEPTION 'No tienes permiso para emitir facturas en la línea %.', v_linea;
  END IF;

  -- [FIX-4] Emisor DERIVADO de la asignación del proyecto, no del cliente.
  v_emisor_id := public.emisor_de_linea(v_linea);
  IF v_emisor_id IS NULL THEN
    RAISE EXCEPTION 'La línea % no tiene ningún emisor fiscal activo asignado. Asígnalo en Administración antes de emitir.', v_linea;
  END IF;

  SELECT to_jsonb(cf) INTO v_emisor FROM public.configuracion_fiscal cf WHERE cf.id = v_emisor_id;
  IF NULLIF(trim(COALESCE(v_emisor->>'razon_social','')), '') IS NULL
     OR NULLIF(trim(COALESCE(v_emisor->>'nif_cif','')), '') IS NULL THEN
    RAISE EXCEPTION 'Faltan datos fiscales obligatorios del emisor % (razón social / NIF-CIF).', v_emisor_id;
  END IF;
  v_serie := COALESCE(v_factura.serie, '');

  SELECT to_jsonb(c) INTO v_cliente FROM public.clientes c
   WHERE lower(trim(c.nombre)) = lower(trim(p_cliente)) LIMIT 1;

  IF p_porcentaje_facturado IS NULL OR p_porcentaje_facturado <= 0 OR p_porcentaje_facturado > 100
     OR p_porcentaje_facturado::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Porcentaje no válido.';
  END IF;
  IF p_tipo <> 'emitida' OR p_area IS DISTINCT FROM v_factura.area OR trim(COALESCE(p_concepto,''))='' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Datos de factura no válidos.';
  END IF;
  IF v_cliente IS NULL OR NULLIF(trim(v_cliente->>'nif_cif'),'') IS NULL OR NULLIF(trim(v_cliente->>'direccion'),'') IS NULL
     OR NULLIF(trim(v_emisor->>'direccion_fiscal'),'') IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Completa los datos fiscales de emisor y cliente (NIF y dirección).';
  END IF;
  IF (SELECT count(*) FROM public.clientes WHERE lower(trim(nombre))=lower(trim(p_cliente))) <> 1 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='La ficha fiscal del cliente es ambigua.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ingresos i WHERE i.id=v_factura.ingreso_id
     AND i.cliente=p_cliente AND i.area=p_area AND i.base_imponible>0
     AND p_base_imponible=round(i.base_imponible*p_porcentaje_facturado/100,2)
     AND p_porcentaje_iva=i.porcentaje_iva
     AND p_importe_iva=round(p_base_imponible*i.porcentaje_iva/100,2)
     AND p_total=p_base_imponible+p_importe_iva) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Los importes no coinciden con el ingreso y el porcentaje.';
  END IF;
  PERFORM p_fecha::date;
  -- [FIX-7] Alta atómica de la fila del contador y luego bloqueo.
  INSERT INTO public.numeracion_contador (emisor_id, serie, ultimo_numero, confirmado)
  VALUES (v_emisor_id, v_serie, 0, false)
  ON CONFLICT (emisor_id, serie) DO NOTHING;

  PERFORM 1 FROM public.numeracion_contador
   WHERE emisor_id = v_emisor_id AND serie = v_serie FOR UPDATE;

  IF NOT (SELECT confirmado FROM public.numeracion_contador
           WHERE emisor_id = v_emisor_id AND serie = v_serie) THEN
    RAISE EXCEPTION 'La numeración del emisor % (serie "%") no ha sido confirmada por un administrador.', v_emisor_id, v_serie;
  END IF;

  UPDATE public.numeracion_contador
     SET ultimo_numero = ultimo_numero + 1
   WHERE emisor_id = v_emisor_id AND serie = v_serie
   RETURNING ultimo_numero INTO v_numero;

  INSERT INTO public.numeracion_log (numero, emisor_id, serie, factura_id, user_id)
  VALUES (v_numero, v_emisor_id, v_serie, p_factura_id, auth.uid());

  -- [FIX-6] Marca de operación privilegiada: deja pasar ESTE update ante el
  -- trigger de inmutabilidad, y solo este.
  PERFORM set_config('app.facturacion_privilegiada', 'on', true);

  UPDATE public.facturas SET
    numero = v_numero::text, numero_secuencial = v_numero,
    emisor_id = v_emisor_id, serie = v_serie,
    area = p_area, tipo = p_tipo, cliente = p_cliente, concepto = p_concepto,
    base_imponible = p_base_imponible, porcentaje_iva = p_porcentaje_iva,
    importe_iva = p_importe_iva, total = p_total, fecha = p_fecha,
    ingreso_id = COALESCE(p_ingreso_id, ingreso_id),
    porcentaje_facturado = p_porcentaje_facturado,
    notas = p_notas, linea_negocio = v_linea, estado = 'emitida',
    fecha_emision = now(), emitida_por = auth.uid(),
    emisor_snapshot = v_emisor, cliente_snapshot = v_cliente,
    historial = COALESCE(historial, '[]'::jsonb) || jsonb_build_object(
      'fecha', now(), 'usuarioId', auth.uid(), 'accion', 'emitida',
      'detalle', format('Nº %s · emisor %s · línea %s', v_numero, v_emisor_id, v_linea))
  WHERE id = p_factura_id;

  PERFORM set_config('app.facturacion_privilegiada', 'off', true);

  RETURN QUERY SELECT v_numero, v_emisor_id, v_serie;
END;
$$;
REVOKE ALL ON FUNCTION public.emitir_numero_factura(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.emitir_numero_factura(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;


-- ══ 8. Confirmación del número inicial, por (emisor, serie) ═══════════════
CREATE OR REPLACE FUNCTION public.fijar_numero_inicial_factura(
  p_numero_inicial BIGINT, p_emisor_id TEXT DEFAULT 'default', p_serie TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.has_facturacion_perm(auth.uid(), 'gestionar_numeracion') THEN
    RAISE EXCEPTION 'No tienes permiso para configurar la numeración de facturación.';
  END IF;
  IF p_numero_inicial IS NULL OR p_numero_inicial < 1 THEN
    RAISE EXCEPTION 'El número inicial debe ser un entero positivo.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.configuracion_fiscal WHERE id = p_emisor_id) THEN
    RAISE EXCEPTION 'El emisor % no existe.', p_emisor_id;
  END IF;
  INSERT INTO public.numeracion_contador(emisor_id,serie) VALUES(p_emisor_id,p_serie) ON CONFLICT DO NOTHING;
  PERFORM 1 FROM public.numeracion_contador WHERE emisor_id=p_emisor_id AND serie=p_serie FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.numeracion_log WHERE emisor_id = p_emisor_id AND serie = p_serie) THEN
    RAISE EXCEPTION 'Ya se han emitido facturas con esta numeración — no se puede reiniciar el contador.';
  END IF;

  INSERT INTO public.numeracion_contador (emisor_id, serie, ultimo_numero, confirmado)
  VALUES (p_emisor_id, p_serie, p_numero_inicial - 1, true)
  ON CONFLICT (emisor_id, serie)
    DO UPDATE SET ultimo_numero = EXCLUDED.ultimo_numero, confirmado = true;

  UPDATE public.configuracion_fiscal
     SET numeracion_confirmada = true, numero_inicial = p_numero_inicial,
         actualizado_por = auth.uid(), actualizado_en = now()
   WHERE id = p_emisor_id;
END;
$$;
REVOKE ALL ON FUNCTION public.fijar_numero_inicial_factura(BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fijar_numero_inicial_factura(BIGINT, TEXT, TEXT) TO authenticated;


-- ══ 9. Rectificación ══════════════════════════════════════════════════════
-- La original se CONSERVA íntegra (solo pasa a 'anulada') y se emite una
-- rectificativa enlazada, con número nuevo del MISMO contador de la
-- original. Quien sume facturación debe excluir siempre 'anulada': así la
-- original deja de contar y solo cuenta la rectificativa, sin doble cómputo.
-- [FIX-8] El emisor sale de `facturas.emisor_id` de la ORIGINAL, en el
--         servidor: nunca se re-resuelve por la asignación actual (que pudo
--         cambiar) ni se acepta del navegador.
CREATE OR REPLACE FUNCTION public.crear_factura_rectificativa(
  p_original_id TEXT, p_motivo TEXT, p_nueva_factura_id TEXT,
  p_base_imponible NUMERIC, p_porcentaje_iva NUMERIC, p_importe_iva NUMERIC,
  p_total NUMERIC, p_porcentaje_facturado NUMERIC
)
RETURNS TABLE (numero_emitido BIGINT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_orig   RECORD;
  v_linea  TEXT;
  v_serie  TEXT;
  v_numero BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado.'; END IF;
  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'El motivo de la rectificación es obligatorio.';
  END IF;
  IF NOT public.has_facturacion_perm(auth.uid(), 'rectificar') THEN
    RAISE EXCEPTION 'No tienes permiso para rectificar facturas.';
  END IF;

  -- Bloqueo de la original: dos rectificaciones simultáneas se serializan y
  -- la segunda ve `estado='anulada'` y sale.
  SELECT * INTO v_orig FROM public.facturas WHERE id = p_original_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura original no encontrada.'; END IF;
  v_linea := v_orig.linea_negocio;
  IF v_linea IS NULL OR NOT public.has_line_perm(auth.uid(),v_linea,'edit') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='No tienes permiso sobre esta factura.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.facturas WHERE id=p_nueva_factura_id AND factura_rectifica_id=p_original_id) THEN
    RETURN QUERY SELECT numero_secuencial FROM public.facturas WHERE id=p_nueva_factura_id;
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_orig.ingreso_id,0));
  IF p_total IS NULL OR p_total < 0 OR p_total > v_orig.total OR p_total::text IN ('NaN','Infinity','-Infinity')
     OR p_base_imponible IS NULL OR p_importe_iva IS NULL OR p_porcentaje_facturado IS NULL
     OR p_porcentaje_iva IS DISTINCT FROM v_orig.porcentaje_iva
     OR p_base_imponible <> round(p_total/(1+p_porcentaje_iva/100),2)
     OR p_importe_iva <> p_total-p_base_imponible
     OR NOT EXISTS(SELECT 1 FROM public.ingresos WHERE id=v_orig.ingreso_id AND total>0
                   AND p_porcentaje_facturado=round(p_total/total*100,2)) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Importes de rectificación no válidos.';
  END IF;
  IF v_orig.estado = 'anulada' THEN RAISE EXCEPTION 'Esta factura ya está anulada.'; END IF;
  IF v_orig.numero_secuencial IS NULL THEN
    RAISE EXCEPTION 'Solo se rectifican facturas ya emitidas (esta no tiene número).';
  END IF;
  IF EXISTS (SELECT 1 FROM public.facturas WHERE id = p_nueva_factura_id) THEN
    RAISE EXCEPTION 'Ya existe una factura con el id %.', p_nueva_factura_id;
  END IF;

  -- [FIX-4] Permiso de línea, derivado del ingreso real de la original.
  v_linea := public.linea_de_ingreso(v_orig.ingreso_id);
  IF v_linea IS NOT NULL AND NOT public.has_line_perm(auth.uid(), v_linea, 'edit') THEN
    RAISE EXCEPTION 'No tienes permiso para rectificar facturas de la línea %.', v_linea;
  END IF;

  -- [FIX-8] Emisor y serie: los de la ORIGINAL, leídos del registro.
  IF v_orig.emisor_id IS NULL THEN
    RAISE EXCEPTION 'La factura original no tiene emisor registrado — no se puede rectificar con seguridad.';
  END IF;
  v_serie := COALESCE(v_orig.serie, '');

  PERFORM 1 FROM public.numeracion_contador
   WHERE emisor_id = v_orig.emisor_id AND serie = v_serie FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe contador para el emisor % (serie "%").', v_orig.emisor_id, v_serie;
  END IF;

  UPDATE public.numeracion_contador SET ultimo_numero = ultimo_numero + 1
   WHERE emisor_id = v_orig.emisor_id AND serie = v_serie
   RETURNING ultimo_numero INTO v_numero;

  INSERT INTO public.numeracion_log (numero, emisor_id, serie, factura_id, user_id)
  VALUES (v_numero, v_orig.emisor_id, v_serie, p_nueva_factura_id, auth.uid());

  PERFORM set_config('app.facturacion_privilegiada', 'on', true);

  -- La original conserva TODOS sus importes y su número. Solo se anula.
  UPDATE public.facturas SET
    estado = 'anulada', anulada_por = auth.uid(), fecha_anulacion = now(),
    motivo_anulacion = p_motivo,
    historial = COALESCE(historial, '[]'::jsonb) || jsonb_build_object(
      'fecha', now(), 'usuarioId', auth.uid(), 'accion', 'anulada', 'detalle', p_motivo)
  WHERE id = p_original_id;

  INSERT INTO public.facturas (
    id, area, tipo, numero, numero_secuencial, serie, emisor_id, cliente, concepto,
    base_imponible, porcentaje_iva, importe_iva, total, fecha, pagada, iva_deducible,
    ingreso_id, linea_negocio, estado, porcentaje_facturado, fecha_emision, emitida_por,
    emisor_snapshot, cliente_snapshot, factura_rectifica_id, notas
  ) VALUES (
    p_nueva_factura_id, v_orig.area, v_orig.tipo, v_numero::text, v_numero, v_serie, v_orig.emisor_id,
    v_orig.cliente, 'Rectificación de la factura ' || v_orig.numero || ': ' || p_motivo,
    p_base_imponible, p_porcentaje_iva, p_importe_iva, p_total,
    to_char(CURRENT_DATE, 'YYYY-MM-DD'),          -- [FIX-1] `fecha` es TEXT
    false, v_orig.iva_deducible,
    v_orig.ingreso_id, v_orig.linea_negocio, 'emitida', p_porcentaje_facturado, now(), auth.uid(),
    v_orig.emisor_snapshot, v_orig.cliente_snapshot, p_original_id, p_motivo
  );

  PERFORM set_config('app.facturacion_privilegiada', 'off', true);

  RETURN QUERY SELECT v_numero;
END;
$$;
REVOKE ALL ON FUNCTION public.crear_factura_rectificativa(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_factura_rectificativa(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;


-- ══ 10. Sincronización con Drive: permiso y registro idempotente ══════════
-- La Edge Function `drive-sync` llama a estas funciones. Comprueban que el
-- usuario puede acceder a ESA factura (por su línea) antes de subir nada, y
-- registran el resultado de forma idempotente: dos peticiones simultáneas
-- para la misma factura no dejan dos archivos registrados.
CREATE OR REPLACE FUNCTION public.puede_sincronizar_factura(p_factura_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_f RECORD; v_linea TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT * INTO v_f FROM public.facturas WHERE id = p_factura_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF public.is_admin(auth.uid()) THEN RETURN true; END IF;
  v_linea := v_f.linea_negocio;
  IF v_linea IS NULL THEN
    -- Facturas de gasto sin ingreso vinculado: permiso del módulo.
    RETURN false;
  END IF;
  RETURN public.has_line_perm(auth.uid(), v_linea, 'edit');
END;
$$;
REVOKE ALL ON FUNCTION public.puede_sincronizar_factura(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.puede_sincronizar_factura(TEXT) TO authenticated;

-- Reserva el "derecho a subir" de una factura bloqueando su fila: si otra
-- petición simultánea ya subió, devuelve el fileId existente y la Edge
-- Function borra de Drive el archivo duplicado que hubiera creado.
CREATE OR REPLACE FUNCTION public.registrar_sync_drive(
  p_factura_id TEXT, p_file_id TEXT, p_folder_id TEXT, p_link TEXT, p_nombre TEXT
)
RETURNS TABLE (file_id_final TEXT, ya_existia BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_f RECORD;
BEGIN
  IF NOT public.puede_sincronizar_factura(p_factura_id) THEN
    RAISE EXCEPTION 'No tienes permiso para sincronizar esta factura.';
  END IF;
  SELECT * INTO v_f FROM public.facturas WHERE id = p_factura_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Factura % no encontrada.', p_factura_id; END IF;

  IF v_f.drive_file_id IS NOT NULL THEN
    RETURN QUERY SELECT v_f.drive_file_id, true;   -- ya sincronizada: idempotente
    RETURN;
  END IF;

  PERFORM set_config('app.facturacion_privilegiada', 'on', true);
  UPDATE public.facturas SET
    drive_file_id = p_file_id, drive_folder_id = p_folder_id, drive_link = p_link,
    drive_nombre_archivo = p_nombre, drive_fecha_subida = now(),
    drive_subido_por = auth.uid(), sync_estado = 'sincronizada', sync_ultimo_error = NULL
  WHERE id = p_factura_id;
  PERFORM set_config('app.facturacion_privilegiada', 'off', true);

  RETURN QUERY SELECT p_file_id, false;
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_sync_drive(TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_sync_drive(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_error_sync_drive(p_factura_id TEXT, p_error TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.puede_sincronizar_factura(p_factura_id) THEN
    RAISE EXCEPTION 'No tienes permiso para sincronizar esta factura.';
  END IF;
  PERFORM set_config('app.facturacion_privilegiada', 'on', true);
  UPDATE public.facturas
     SET sync_estado = 'error', sync_ultimo_error = left(COALESCE(p_error, 'error desconocido'), 500)
   WHERE id = p_factura_id AND drive_file_id IS NULL;  -- nunca degrada una ya sincronizada
  PERFORM set_config('app.facturacion_privilegiada', 'off', true);
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_error_sync_drive(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_error_sync_drive(TEXT, TEXT) TO authenticated;


-- ══ 11. Índices, tope del 100% e inmutabilidad ════════════════════════════
-- [FIX-2] Unicidad POR EMISOR Y SERIE, no global.
ALTER TABLE public.facturas DROP CONSTRAINT IF EXISTS uq_factura_num_area_tipo;
DROP INDEX IF EXISTS public.idx_facturas_numero_secuencial_unico;   -- índice global defectuoso (revisión 1)
CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_numero_por_emisor_serie
  ON public.facturas (emisor_id, COALESCE(serie, ''), numero_secuencial)
  WHERE numero_secuencial IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_ingreso_id ON public.facturas (ingreso_id);
CREATE INDEX IF NOT EXISTS idx_facturas_estado ON public.facturas (estado);
CREATE INDEX IF NOT EXISTS idx_facturas_sync_estado ON public.facturas (sync_estado);

-- Tope del 100% facturado por ingreso, con advisory lock por ingreso para
-- que dos parciales simultáneas no pasen ambas la comprobación.
CREATE OR REPLACE FUNCTION public.validar_porcentaje_facturado()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_suma NUMERIC;
BEGIN
  IF NEW.tipo <> 'emitida' OR NEW.ingreso_id IS NULL
     OR NEW.estado IS NULL OR NEW.estado IN ('borrador','anulada') THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.ingreso_id, 0));
  SELECT COALESCE(SUM(porcentaje_facturado), 0) INTO v_suma
    FROM public.facturas
   WHERE ingreso_id = NEW.ingreso_id AND tipo = 'emitida'
     AND estado NOT IN ('borrador','anulada') AND id <> NEW.id;
  IF v_suma + COALESCE(NEW.porcentaje_facturado, 0) > 100.001 THEN
    RAISE EXCEPTION 'La suma de facturas emitidas de este ingreso superaría el 100%% (ya facturado: %, intentando añadir: %).',
      v_suma, NEW.porcentaje_facturado;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validar_porcentaje_facturado ON public.facturas;
CREATE TRIGGER trg_validar_porcentaje_facturado
  BEFORE INSERT OR UPDATE ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public.validar_porcentaje_facturado();

-- [FIX-6] Inmutabilidad de las facturas ya emitidas. Sin esto, cualquiera
-- con la anon key podía cambiar número/importes o borrar una factura fiscal
-- directamente vía PostgREST. Solo las funciones de esta migración (que
-- marcan `app.facturacion_privilegiada`) pueden tocarlas.
CREATE OR REPLACE FUNCTION public.proteger_factura_emitida()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE field text;
BEGIN
  IF current_user IN ('postgres','supabase_admin','service_role') THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP<>'DELETE' THEN
    FOREACH field IN ARRAY ARRAY['drive_file_id','drive_folder_id','drive_link','drive_nombre_archivo','drive_fecha_subida','drive_subido_por'] LOOP
      IF (TG_OP='INSERT' AND to_jsonb(NEW)->>field IS NOT NULL) OR
         (TG_OP='UPDATE' AND to_jsonb(NEW)->field IS DISTINCT FROM to_jsonb(OLD)->field) THEN
        RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Solo el servicio Drive confirma una subida.';
      END IF;
    END LOOP;
    IF NEW.sync_estado='sincronizada' AND (TG_OP='INSERT' OR OLD.sync_estado IS DISTINCT FROM 'sincronizada') THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='La subida debe verificarse en Drive.';
    END IF;
  END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.numero_secuencial IS NOT NULL OR NEW.emisor_snapshot IS NOT NULL OR NEW.cliente_snapshot IS NOT NULL
       OR (NEW.tipo='emitida' AND COALESCE(NEW.estado,'borrador') <> 'borrador') THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='La emisión requiere la función de facturación.';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.numero_secuencial IS NOT NULL THEN
    IF TG_OP='DELETE' THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Una factura emitida no se puede borrar.';
    END IF;
    IF (to_jsonb(NEW)-ARRAY['pagada','pagos_recibidos','fecha_pago','enviada'])
       IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['pagada','pagos_recibidos','fecha_pago','enviada']) THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Una factura emitida es inmutable. Usa rectificación.';
    END IF;
  ELSIF TG_OP='UPDATE' AND (NEW.numero_secuencial IS NOT NULL OR NEW.emisor_snapshot IS NOT NULL
          OR NEW.cliente_snapshot IS NOT NULL OR (NEW.tipo='emitida' AND COALESCE(NEW.estado,'borrador')<>'borrador')) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='La emisión requiere la función de facturación.';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END; $$;
DROP TRIGGER IF EXISTS trg_proteger_factura_emitida ON public.facturas;
CREATE TRIGGER trg_proteger_factura_emitida BEFORE INSERT OR UPDATE OR DELETE ON public.facturas
FOR EACH ROW EXECUTE FUNCTION public.proteger_factura_emitida();

-- ══ 12. RLS de todas las tablas nuevas ════════════════════════════════════
-- [FIX-5] `numeracion_contador` estaba SIN RLS: legible y escribible con la
-- anon key. Ahora lectura solo admin/contabilidad y NINGUNA política de
-- escritura (solo las funciones SECURITY DEFINER la tocan).
ALTER TABLE public.numeracion_contador ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_admin_o_contabilidad" ON public.numeracion_contador;
CREATE POLICY "select_admin_o_contabilidad" ON public.numeracion_contador FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.has_module_perm(auth.uid(), 'contabilidad', 'view'));

ALTER TABLE public.numeracion_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_admin_o_contabilidad" ON public.numeracion_log;
CREATE POLICY "select_admin_o_contabilidad" ON public.numeracion_log FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.has_module_perm(auth.uid(), 'contabilidad', 'view'));

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_contabilidad" ON public.clientes;
CREATE POLICY "select_contabilidad" ON public.clientes FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.has_module_perm(auth.uid(), 'contabilidad', 'view'));
DROP POLICY IF EXISTS "write_contabilidad" ON public.clientes;
CREATE POLICY "write_contabilidad" ON public.clientes FOR ALL
  USING (public.is_admin(auth.uid()) OR public.has_module_perm(auth.uid(), 'contabilidad', 'edit'))
  WITH CHECK (public.is_admin(auth.uid()) OR public.has_module_perm(auth.uid(), 'contabilidad', 'edit'));

ALTER TABLE public.configuracion_fiscal ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_autenticado" ON public.configuracion_fiscal;
CREATE POLICY "select_autenticado" ON public.configuracion_fiscal FOR SELECT
  USING (auth.uid() IS NOT NULL);   -- necesario para generar el PDF
DROP POLICY IF EXISTS "write_admin" ON public.configuracion_fiscal;
CREATE POLICY "write_admin" ON public.configuracion_fiscal FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.proyecto_emisor ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_autenticado" ON public.proyecto_emisor;
CREATE POLICY "select_autenticado" ON public.proyecto_emisor FOR SELECT
  USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "write_admin" ON public.proyecto_emisor;
CREATE POLICY "write_admin" ON public.proyecto_emisor FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.user_facturacion_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_propio_o_admin" ON public.user_facturacion_permissions;
CREATE POLICY "select_propio_o_admin" ON public.user_facturacion_permissions FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
-- Escritura solo admin: nadie puede concederse permisos a sí mismo.
DROP POLICY IF EXISTS "write_admin" ON public.user_facturacion_permissions;
CREATE POLICY "write_admin" ON public.user_facturacion_permissions FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));


-- ══ 13. Emisor 'default' migrado del modelo antiguo ═══════════════════════
-- Si no existe ningún emisor se crea 'default' VACÍO — sin datos fiscales
-- inventados. Queda sin numeración confirmada: nadie puede emitir hasta que
-- un administrador rellene los datos y confirme el número inicial.
INSERT INTO public.configuracion_fiscal (id, nombre_interno, activo, numeracion_confirmada)
VALUES ('default', 'Emisor principal (pendiente de completar)', true, false)
ON CONFLICT (id) DO NOTHING;

REVOKE ALL ON public.numeracion_contador, public.numeracion_log FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.numeracion_contador, public.numeracion_log TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.clientes,public.configuracion_fiscal,public.proyecto_emisor,public.user_facturacion_permissions TO authenticated;
REVOKE ALL ON FUNCTION public.linea_de_ingreso(TEXT),public.emisor_de_linea(TEXT) FROM authenticated;

COMMIT;

-- ============================================================================
-- Reversión: consultar ACTIVACION.md. No quitar triggers de inmutabilidad ni
-- índices de numeración: preservan las facturas ya emitidas. Antes de COMMIT,
-- cualquier fallo revierte la activación; después, detener emisión y corregir
-- con migración hacia adelante o restaurar una copia validada en entorno aislado.
