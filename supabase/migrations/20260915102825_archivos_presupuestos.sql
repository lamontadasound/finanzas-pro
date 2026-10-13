insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('presupuestos','presupuestos',false,10485760,array['application/pdf']);
create policy presupuestos_pdf_read on storage.objects for select to authenticated
using (bucket_id='presupuestos' and exists (
  select 1 from public.presupuestos p
  where p.id::text=(storage.foldername(name))[2]
  and p.linea_negocio=(storage.foldername(name))[1]
  and public.has_line_perm((select auth.uid()),p.linea_negocio,'view')
));
create policy presupuestos_pdf_create on storage.objects for insert to authenticated
with check (bucket_id='presupuestos' and exists (
  select 1 from public.presupuestos p
  where p.id::text=(storage.foldername(name))[2]
  and p.linea_negocio=(storage.foldername(name))[1]
  and storage.filename(name)='r' || p.revision::text || '.pdf'
  and public.has_line_perm((select auth.uid()),p.linea_negocio,'view')
  and (public.has_line_perm((select auth.uid()),p.linea_negocio,'edit')
    or (p.created_by=(select auth.uid()) and public.has_line_perm((select auth.uid()),p.linea_negocio,'create')))
));
-- No UPDATE policy: archived revisions are immutable.
