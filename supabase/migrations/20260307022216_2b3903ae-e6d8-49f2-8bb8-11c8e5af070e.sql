
-- Add new status values to the enum
ALTER TYPE public.status_os ADD VALUE IF NOT EXISTS 'recebido';
ALTER TYPE public.status_os ADD VALUE IF NOT EXISTS 'aguardando_diagnostico';
ALTER TYPE public.status_os ADD VALUE IF NOT EXISTS 'aguardando_aprovacao';
ALTER TYPE public.status_os ADD VALUE IF NOT EXISTS 'aprovado';
ALTER TYPE public.status_os ADD VALUE IF NOT EXISTS 'em_reparo';
ALTER TYPE public.status_os ADD VALUE IF NOT EXISTS 'em_testes';
ALTER TYPE public.status_os ADD VALUE IF NOT EXISTS 'pronto_retirada';

-- Add new columns for professional OS form
ALTER TABLE public.ordens_servico 
  ADD COLUMN IF NOT EXISTS marca varchar DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS checklist_bateria boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist_carregador boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist_controle boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist_cabos boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist_helices boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS checklist_outros boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS condicao_visual text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS custo_pecas numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_mao_obra numeric DEFAULT 0;
