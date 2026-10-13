import {scenarios} from './database-scenarios.mjs';
import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
const pg = new PGlite();
await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text); ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; GRANT USAGE ON SCHEMA storage TO anon,authenticated,service_role; GRANT SELECT,INSERT,DELETE ON storage.objects TO anon,authenticated; CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
INSERT INTO auth.users VALUES('f700fe77-98f4-4cda-8c75-2524e782afcd','juliacentenodj@gmail.com');`);
const dir='supabase/migrations';
for(const file of (await readdir(dir)).sort()) {
 if(file >= '20260906') continue;
 await pg.exec(await readFile(`${dir}/${file}`,'utf8'));
 console.log('PASS historical schema',file);
}
await pg.exec("INSERT INTO public.ingresos(id,area,concepto,cliente,tipo_evento,fecha_evento,base_imponible,porcentaje_iva,importe_iva,total,metodo_pago,created_at) VALUES('preserved','montada','Registro anterior','Cliente anterior','Boda','2025-01-02',999.99,21,210,1209.99,'transferencia','2025-01-02')");
await import('./build-activation.mjs');
const activation=await readFile('supabase/ACTIVAR_FINANZAS.sql','utf8');
await pg.exec(activation); console.log('PASS unified activation and 13-table integrity');
await pg.exec(activation); console.log('PASS activation idempotence');
const count=await scenarios(pg); console.log(`${count} PostgreSQL scenarios passed`);
await pg.exec(await readFile('supabase/migrations/20260913_001_socios_business_line.sql','utf8'));
const patch=await readFile('supabase/repartos_gestoria.sql','utf8');
await pg.exec(patch);await pg.exec(patch);
const partners=await pg.query("select linea_negocio,count(*)::int n from socios where activo group by linea_negocio order by linea_negocio");
if(partners.rows.length!==2||partners.rows.some(r=>r.n!==3))throw Error('Socios esperados o idempotencia incorrectos');
await pg.exec("INSERT INTO impuestos(id,tipo,concepto,fecha,importe,estado,created_at) VALUES ('test-gestoria','gestoria','Gestoría','2026-09-10',50,'pendiente',now())");
const result=await pg.query("select id from socios where nombre='Julia' and linea_negocio='montada_installations'");
const sid=result.rows[0].id;
await pg.query("INSERT INTO movimientos_socios(id,socio_id,fecha,tipo,cantidad,concepto,created_at) VALUES ('manual-test',$1,'2026-09-10','reparto_beneficio_cobrado',250,'Reparto',now())",[sid]);
let denied=false;try{await pg.query("INSERT INTO movimientos_socios(id,socio_id,fecha,tipo,cantidad,concepto,created_at) VALUES ('capital-test',$1,'2026-09-10','aportacion_personal',250,'Capital',now())",[sid]);}catch{denied=true;}
if(!denied)throw Error('Capital Installations permitido indebidamente');
await pg.exec("UPDATE movimientos_socios SET cantidad=300 WHERE id='manual-test'");
const edited=await pg.query("select cantidad from movimientos_socios where id='manual-test'");if(Number(edited.rows[0].cantidad)!==300)throw Error('Edición fallida');
console.log('PASS Gestoría persistida; 6 socios; idempotencia; reparto editable; capital Installations rechazado');
await pg.close();
