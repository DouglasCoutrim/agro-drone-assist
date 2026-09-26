-- ============================================================
-- Add OS Type and Finalizada Status
-- ============================================================

-- 1. Create enum for OS types
CREATE TYPE public.tipo_os AS ENUM ('normal', 'revisao');

-- 2. Extend status_os enum to include 'finalizada'
-- First, create a new enum with all values
CREATE TYPE public.status_os_new AS ENUM ('aberta', 'em_andamento', 'aguardando_peca', 'concluida', 'entregue', 'cancelada', 'recebido', 'aguardando_diagnostico', 'aguardando_aprovacao', 'aprovado', 'em_reparo', 'em_testes', 'pronto_retirada', 'finalizada');

-- Drop default that references old enum
ALTER TABLE public.ordens_servico ALTER COLUMN status DROP DEFAULT;

-- Alter column to use new type
ALTER TABLE public.ordens_servico 
  ALTER COLUMN status TYPE public.status_os_new USING status::text::public.status_os_new;

-- Drop old enum
DROP TYPE public.status_os;

-- Rename new enum to original name
ALTER TYPE public.status_os_new RENAME TO status_os;

-- Re-add default with new enum
ALTER TABLE public.ordens_servico ALTER COLUMN status SET DEFAULT 'recebido'::status_os;

-- 3. Add tipo_os column to ordens_servico
ALTER TABLE public.ordens_servico
  ADD COLUMN tipo_os tipo_os DEFAULT 'normal';

-- 4. Add checklist_equipamento_tipo_id to link OS to specific checklist configuration
ALTER TABLE public.ordens_servico
  ADD COLUMN checklist_equipamento_tipo_id UUID REFERENCES public.checklist_tipos_equipamento(id) ON DELETE SET NULL;

-- 5. Create index for better query performance
CREATE INDEX idx_ordens_servico_tipo_os ON public.ordens_servico(tipo_os);
CREATE INDEX idx_ordens_servico_checklist_equipamento_tipo_id ON public.ordens_servico(checklist_equipamento_tipo_id);