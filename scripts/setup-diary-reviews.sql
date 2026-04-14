-- Setup: real diary rating table (one user one rating)

CREATE TABLE IF NOT EXISTS public.diary_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id uuid NOT NULL REFERENCES public.diaries(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating numeric(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diary_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_diary_reviews_diary_id ON public.diary_reviews(diary_id);
CREATE INDEX IF NOT EXISTS idx_diary_reviews_user_id ON public.diary_reviews(user_id);

CREATE OR REPLACE FUNCTION public.set_diary_reviews_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_diary_score_from_reviews()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_diary_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_diary_id := OLD.diary_id;
  ELSE
    target_diary_id := NEW.diary_id;
  END IF;

  UPDATE public.diaries d
  SET score = sub.avg_rating
  FROM (
    SELECT
      diary_id,
      ROUND(AVG(rating)::numeric, 2) AS avg_rating
    FROM public.diary_reviews
    WHERE diary_id = target_diary_id
    GROUP BY diary_id
  ) sub
  WHERE d.id = sub.diary_id;

  UPDATE public.diaries d
  SET score = NULL
  WHERE d.id = target_diary_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.diary_reviews r
      WHERE r.diary_id = target_diary_id
    );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_diary_reviews_updated_at ON public.diary_reviews;
CREATE TRIGGER trg_diary_reviews_updated_at
BEFORE UPDATE ON public.diary_reviews
FOR EACH ROW
EXECUTE FUNCTION public.set_diary_reviews_updated_at();

DROP TRIGGER IF EXISTS trg_sync_diary_score_from_reviews ON public.diary_reviews;
CREATE TRIGGER trg_sync_diary_score_from_reviews
AFTER INSERT OR UPDATE OR DELETE ON public.diary_reviews
FOR EACH ROW
EXECUTE FUNCTION public.sync_diary_score_from_reviews();

ALTER TABLE public.diary_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diary_reviews_select_authenticated ON public.diary_reviews;
CREATE POLICY diary_reviews_select_authenticated
ON public.diary_reviews
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS diary_reviews_insert_own ON public.diary_reviews;
CREATE POLICY diary_reviews_insert_own
ON public.diary_reviews
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS diary_reviews_update_own ON public.diary_reviews;
CREATE POLICY diary_reviews_update_own
ON public.diary_reviews
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS diary_reviews_delete_own ON public.diary_reviews;
CREATE POLICY diary_reviews_delete_own
ON public.diary_reviews
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
