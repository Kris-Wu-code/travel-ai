-- Setup: sync job logs for external data ingestion

CREATE TABLE IF NOT EXISTS public.sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed')),
  started_at timestamptz NOT NULL,
  finished_at timestamptz NOT NULL,
  duration_ms integer NOT NULL DEFAULT 0,
  scenes_count integer NOT NULL DEFAULT 0,
  search_plan_count integer NOT NULL DEFAULT 0,
  amap_request_count integer NOT NULL DEFAULT 0,
  amap_rate_limited_count integer NOT NULL DEFAULT 0,
  amap_failed_count integer NOT NULL DEFAULT 0,
  poi_written_count integer NOT NULL DEFAULT 0,
  poi_failed_count integer NOT NULL DEFAULT 0,
  food_written_count integer NOT NULL DEFAULT 0,
  food_failed_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_job_name_created_at
  ON public.sync_jobs(job_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_status_created_at
  ON public.sync_jobs(status, created_at DESC);
