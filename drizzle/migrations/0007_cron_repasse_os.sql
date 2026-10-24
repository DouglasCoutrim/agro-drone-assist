-- lovable-cron-fallback-reviewed: 1-hour acceptance deadline is time-based; no row change happens when it expires
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('repassar-os-sem-recebimento', '*/5 * * * *', $$SELECT public.repassar_os_sem_recebimento();$$);