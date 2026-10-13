-- Run transactionally; no test users or documents survive the rollback.
begin;
do $$
declare
  actor uuid := gen_random_uuid();
  own_quote uuid;
  other_quote uuid;
  changed integer;
  payload jsonb := '{"titulo":"Prueba transaccional","cliente":"Ficticio","fecha":"2026-09-15","validez":"2026-10-15","iva":21,"estado":"borrador","conceptos":[{"id":"a","descripcion":"Prueba","cantidad":1,"precio":10}]}'::jsonb;
begin
  insert into auth.users(id) values(actor);
  insert into public.profiles(id,email,nombre,rol,activo) values(actor,actor::text || '@example.invalid','Prueba transaccional','usuario',true);
  insert into public.user_line_permissions(user_id,linea_negocio,can_view,can_create,can_edit,can_delete) values(actor,'montada_sound',true,true,true,true);
  insert into public.presupuestos(linea_negocio,contenido,created_by) values('real_madrid',payload,actor) returning id into other_quote;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
  set local role authenticated;
  insert into public.presupuestos(linea_negocio,contenido) values('montada_sound',payload) returning id into own_quote;
  if not exists(select 1 from public.presupuestos where id=own_quote) then raise exception 'Cannot read own line'; end if;
  if exists(select 1 from public.presupuestos where id=other_quote) then raise exception 'Cross-line data visible'; end if;
  update public.presupuestos set contenido=payload,revision=2 where id=own_quote and revision=1;
  get diagnostics changed=row_count; if changed<>1 then raise exception 'Allowed update failed'; end if;
  update public.presupuestos set revision=3 where id=own_quote and revision=1;
  get diagnostics changed=row_count; if changed<>0 then raise exception 'Stale revision updated'; end if;
  update public.presupuestos set revision=3 where id=other_quote;
  get diagnostics changed=row_count; if changed<>0 then raise exception 'Cross-line update allowed'; end if;
  begin
    insert into public.presupuestos(linea_negocio,contenido) values('real_madrid',payload);
    raise exception 'Cross-line insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.presupuestos set linea_negocio='real_madrid' where id=own_quote;
    raise exception 'Immutable line changed';
  exception when insufficient_privilege then null; end;
  delete from public.presupuestos where id=other_quote;
  get diagnostics changed=row_count; if changed<>0 then raise exception 'Cross-line delete allowed'; end if;
  reset role;
  insert into public.user_line_permissions(user_id,linea_negocio,can_view,can_create,can_edit,can_delete) values(actor,'dj',true,true,true,true),(actor,'real_madrid',true,true,true,true),(actor,'montada_installations',true,true,true,true);
  set local role authenticated;
  begin
    insert into public.presupuestos(linea_negocio,contenido) values('dj',payload);
    raise exception 'DJ insertion allowed despite line restriction';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.presupuestos(linea_negocio,contenido) values('real_madrid',payload);
    raise exception 'Real Madrid insertion allowed despite line restriction';
  exception when insufficient_privilege then null; end;
  insert into public.presupuestos(linea_negocio,contenido) values('montada_installations',payload);
  reset role;
  update public.user_line_permissions set can_create=false,can_edit=false,can_delete=false where user_id=actor;
  set local role authenticated;
  if not exists(select 1 from public.presupuestos where id=own_quote) then raise exception 'Viewer cannot read'; end if;
  update public.presupuestos set revision=3 where id=own_quote;
  get diagnostics changed=row_count; if changed<>0 then raise exception 'Viewer edited'; end if;
  delete from public.presupuestos where id=own_quote;
  get diagnostics changed=row_count; if changed<>0 then raise exception 'Viewer deleted'; end if;
  begin
    insert into public.presupuestos(linea_negocio,contenido) values('montada_sound',payload);
    raise exception 'Viewer inserted';
  exception when insufficient_privilege then null; end;
  reset role;
  update public.user_line_permissions set can_delete=true where user_id=actor;
  set local role authenticated;
  delete from public.presupuestos where id=own_quote;
  get diagnostics changed=row_count; if changed<>1 then raise exception 'Allowed delete failed'; end if;
  reset role;
  set local role anon;
  begin
    perform 1 from public.presupuestos;
    raise exception 'Anonymous read allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.presupuestos(linea_negocio,contenido) values('montada_sound',payload);
    raise exception 'Anonymous insert allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.presupuestos set revision=2 where id=other_quote;
    raise exception 'Anonymous update allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.presupuestos where id=other_quote;
    raise exception 'Anonymous delete allowed';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;
rollback;
select 'PASS: CRUD, line isolation, read-only, anonymous access, immutable line and stale revision; test data rolled back' as verification;
