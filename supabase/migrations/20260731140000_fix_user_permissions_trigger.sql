-- =============================================================================
-- FIX permissoes de usuario que voltavam desmarcadas (Equipe)
-- A migration 20260305123058 criou a funcao handle_new_user_permissions() mas
-- nunca criou o trigger. Sem a linha em user_permissions, o toggle da Equipe
-- fazia UPDATE sem afetar nenhuma linha (sem erro) e a mudanca nao persistia.
-- Aqui criamos o trigger faltante para novos signups (qualquer fluxo).
-- Idempotente.
-- =============================================================================

DROP TRIGGER IF EXISTS on_auth_user_create_permissions ON auth.users;
CREATE TRIGGER on_auth_user_create_permissions
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_permissions();
