// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import migration from '../../supabase/migrations/20261109131425_facturas_montada_independientes.sql?raw';

it('permite borrar el ingreso Sound, conserva su factura y mantiene el bloqueo de Real Madrid', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE ingresos(id text primary key, linea_negocio text);
      CREATE TABLE facturas(id text primary key, linea_negocio text, ingreso_id text, porcentaje_facturado numeric,
        numero_secuencial int, total numeric, cliente_snapshot jsonb, drive_file_id text);
      CREATE FUNCTION protect_invoiced_income() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS(SELECT 1 FROM facturas WHERE ingreso_id=OLD.id AND numero_secuencial IS NOT NULL) THEN
          RAISE EXCEPTION 'No se puede borrar un ingreso con facturas emitidas.';
        END IF;
        RETURN OLD;
      END $$;
      CREATE TRIGGER protect_invoiced_income BEFORE DELETE ON ingresos FOR EACH ROW EXECUTE FUNCTION protect_invoiced_income();
      ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;
      ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
      INSERT INTO ingresos VALUES('sound','montada_sound'),('rm','real_madrid');
      INSERT INTO facturas VALUES('f-sound','montada_sound','sound',100,42,121,'{"nombre":"Cliente"}','pdf-42'),
        ('f-rm','real_madrid','rm',100,43,242,'{"nombre":"Real Madrid"}','pdf-43');
    `);
    const before = (await db.query("SELECT to_jsonb(f)-'ingreso_id'-'porcentaje_facturado' AS data FROM facturas f ORDER BY id")).rows;
    await expect(db.exec("DELETE FROM ingresos WHERE id='sound'")).rejects.toThrow('No se puede borrar');
    await db.exec(migration);
    await db.exec("DELETE FROM ingresos WHERE id='sound'");
    expect((await db.query("SELECT to_jsonb(f)-'ingreso_id'-'porcentaje_facturado' AS data FROM facturas f ORDER BY id")).rows).toEqual(before);
    expect((await db.query("SELECT ingreso_id,porcentaje_facturado FROM facturas WHERE id='f-sound'")).rows).toEqual([{ingreso_id:null,porcentaje_facturado:'0'}]);
    await expect(db.exec("DELETE FROM ingresos WHERE id='rm'")).rejects.toThrow('No se puede borrar');
    await expect(db.exec("UPDATE facturas SET ingreso_id='sound' WHERE id='f-sound'")).rejects.toThrow('facturas_montada_independientes');
    expect((await db.query("SELECT bool_and(relrowsecurity) AS protected FROM pg_class WHERE oid IN ('ingresos'::regclass,'facturas'::regclass)")).rows).toEqual([{protected:true}]);
  } finally { await db.close(); }
});
