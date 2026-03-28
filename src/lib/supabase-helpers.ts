import { toast } from "sonner";

/**
 * Handles Supabase errors with RLS-aware messages
 */
export function handleSupabaseError(error: any, context?: string) {
  const message = error?.message || "Erro desconhecido";
  const code = error?.code;

  if (code === "42501" || message.includes("row-level security")) {
    toast.error("Erro de permissão: Sua conta não está vinculada a esta organização.");
    return;
  }

  if (code === "23505") {
    toast.error("Este registro já existe. Verifique os dados duplicados.");
    return;
  }

  if (code === "23503") {
    toast.error("Referência inválida: um dos campos relacionados não foi encontrado.");
    return;
  }

  toast.error(context ? `${context}: ${message}` : message);
}
