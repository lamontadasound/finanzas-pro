DO $$ DECLARE t text;a text;p text;n text;BEGIN
 FOREACH t IN ARRAY ARRAY['socios','movimientos_socios'] LOOP
 FOREACH a IN ARRAY ARRAY['view','create','edit','delete'] LOOP
 n:=CASE a WHEN 'view' THEN 'line_select' WHEN 'create' THEN 'line_insert' WHEN 'edit' THEN 'line_update' ELSE 'line_delete' END;
 p:=CASE WHEN t='socios' THEN format('public.has_line_perm(auth.uid(),linea_negocio,%L)',a) ELSE format('public.is_admin(auth.uid()) OR EXISTS(SELECT 1 FROM public.socios s WHERE s.id=socio_id AND public.has_line_perm(auth.uid(),s.linea_negocio,%L))',a) END;
 EXECUTE format('ALTER POLICY %I ON public.%I %s',n,t,CASE WHEN a='create' THEN 'WITH CHECK('||p||')' WHEN a='edit' THEN 'USING('||p||') WITH CHECK('||p||')' ELSE 'USING('||p||')' END);
 END LOOP;END LOOP;END $$;
