-- Setup: scene visit behavior logs for personalized profile modules

CREATE TABLE IF NOT EXISTS public.scene_visit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scene_id uuid NOT NULL REFERENCES public.scenes(id) ON DELETE CASCADE,
  first_visited_at timestamptz NOT NULL DEFAULT now(),
  last_visited_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scene_id)
);

CREATE INDEX IF NOT EXISTS idx_scene_visit_logs_user_last_visit
  ON public.scene_visit_logs(user_id, last_visited_at DESC);

CREATE OR REPLACE FUNCTION public.set_scene_visit_logs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_scene_visit_logs_updated_at ON public.scene_visit_logs;
CREATE TRIGGER trg_scene_visit_logs_updated_at
BEFORE UPDATE ON public.scene_visit_logs
FOR EACH ROW
EXECUTE FUNCTION public.set_scene_visit_logs_updated_at();

ALTER TABLE public.scene_visit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scene_visit_logs_select_own ON public.scene_visit_logs;
CREATE POLICY scene_visit_logs_select_own
ON public.scene_visit_logs
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS scene_visit_logs_insert_own ON public.scene_visit_logs;
CREATE POLICY scene_visit_logs_insert_own
ON public.scene_visit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS scene_visit_logs_update_own ON public.scene_visit_logs;
CREATE POLICY scene_visit_logs_update_own
ON public.scene_visit_logs
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS scene_visit_logs_delete_own ON public.scene_visit_logs;
CREATE POLICY scene_visit_logs_delete_own
ON public.scene_visit_logs
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
