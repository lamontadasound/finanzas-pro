CREATE TABLE public.personal_monthly_income (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 month date NOT NULL CHECK (extract(day from month)=1),
 line_id text NOT NULL CHECK(line_id IN ('dj','montada_sound','real_madrid','montada_installations')),
 assigned numeric(14,2) NOT NULL DEFAULT 0 CHECK(assigned>=0),
 received numeric(14,2) NOT NULL DEFAULT 0 CHECK(received>=0),
 PRIMARY KEY(user_id,month,line_id)
);
ALTER TABLE public.personal_monthly_income ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.personal_monthly_income FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.personal_monthly_income TO authenticated;
CREATE POLICY personal_owner ON public.personal_monthly_income FOR ALL TO authenticated
USING(user_id=auth.uid() AND public.is_admin(auth.uid()))
WITH CHECK(user_id=auth.uid() AND public.is_admin(auth.uid()));
