import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const tables=['ingresos','gastos','facturas','equipo','impuestos','documentos','gastos_evento','pagos_evento','suplidos','eventos','socios','movimientos_socios','usuarios'];
const names=tables.map(x=>"'"+x+"'").join(',');
const files=['supabase/migrations/20260909_001_fase_g_activar_admin_y_rls.sql','supabase/migrations/20260910_001_fase_h_facturacion.sql','supabase/hardening.sql'];
const parts=await Promise.all(files.map(async file=>`-- SOURCE ${file}\n`+(await readFile(file,'utf8')).replace(/^(BEGIN;|COMMIT;)\s*$/gm,'')));
const before=`
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
CREATE TEMP TABLE finance_baseline(table_name text,id text,payload jsonb,PRIMARY KEY(table_name,id)) ON COMMIT DROP;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY[${names}] LOOP
  IF to_regclass('public.'||t) IS NULL THEN RAISE EXCEPTION 'Falta tabla %. No ejecutar el esquema histórico a ciegas: revisar el proyecto conectado.',t; END IF;
  EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE',t);
  EXECUTE format('INSERT INTO finance_baseline SELECT %L,id::text,to_jsonb(x)-''linea_negocio''-CASE WHEN %L=''ingresos'' AND id::text IN (''tavsmkotyqfms30yxr1'',''gsdi12lqqoms30zk7x'') THEN ''tipo_evento'' ELSE ''__no_field__'' END FROM public.%I x',t,t,t);
 END LOOP;
END $$;
`;
const after=`
-- All original IDs and original fields are preserved, except approved classifications.
CREATE TEMP TABLE finance_validation(table_name text,before_count bigint,after_count bigint) ON COMMIT DROP;
DO $$ DECLARE t text; bad bigint; before_n bigint; after_n bigint; BEGIN
 FOREACH t IN ARRAY ARRAY[${names}] LOOP
  EXECUTE format('SELECT count(*) FROM finance_baseline b LEFT JOIN public.%I x ON x.id::text=b.id WHERE b.table_name=%L AND (x.id IS NULL OR NOT b.payload <@ to_jsonb(x))',t,t) INTO bad;
  IF bad<>0 THEN RAISE EXCEPTION 'Integridad fallida en %: % registros. Activación abortada.',t,bad; END IF;
  SELECT count(*) INTO before_n FROM finance_baseline WHERE table_name=t;
  EXECUTE format('SELECT count(*) FROM public.%I',t) INTO after_n;
  IF before_n<>after_n THEN RAISE EXCEPTION 'Conteo cambiado en %. Activación abortada.',t; END IF;
  INSERT INTO finance_validation VALUES(t,before_n,after_n);
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=ANY(ARRAY[${names}]) AND (qual='true' OR with_check='true')) THEN RAISE EXCEPTION 'Política abierta residual.'; END IF;
 IF NOT public.is_admin('f700fe77-98f4-4cda-8c75-2524e782afcd') THEN RAISE EXCEPTION 'Administradora no activa.'; END IF;
END $$;
SELECT * FROM finance_validation ORDER BY table_name;
COMMIT;
`;
const result='-- ACTIVACIÓN ÚNICA. Leer ACTIVACION.md y verificar backup/proyecto antes de ejecutar.\n-- No ejecutar F, G y H por separado. No crea usuarios Auth ni emite facturas.\n'+before+parts.join('\n')+after;
await writeFile('supabase/ACTIVAR_FINANZAS.sql',result);
await writeFile('supabase/ACTIVAR_FINANZAS.sha256',createHash('sha256').update(result).digest('hex')+'  ACTIVAR_FINANZAS.sql\n');
console.log('Generated one transactional activation with integrity checks for 13 tables.');
