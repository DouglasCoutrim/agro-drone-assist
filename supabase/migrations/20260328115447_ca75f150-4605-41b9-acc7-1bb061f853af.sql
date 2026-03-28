
-- Add 'active' column to organizations for disable/enable functionality
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Add 'telefone' column to organizations for onboarding
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS telefone text;
