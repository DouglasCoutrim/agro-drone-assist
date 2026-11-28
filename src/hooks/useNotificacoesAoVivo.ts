import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface NotificacaoAoVivo {
  id: string;
  tipo: string;
  titulo: string;
  corpo: string | null;
  link: string | null;
  criadaEm: string;
}

/**
 * Escuta em tempo real as notificações do usuário logado (tabela `notifications`).
 * Depende de a tabela estar publicada no Supabase Realtime e das policies de
 * leitura — cada usuário recebe apenas as próprias linhas.
 */
export function useNotificacoesAoVivo(aoChegar: (n: NotificacaoAoVivo) => void) {
  const { user } = useAuth();
  const callback = useRef(aoChegar);
  callback.current = aoChegar;

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notificacoes-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const linha = payload.new as {
            id: string;
            type: string | null;
            title: string;
            body: string | null;
            link: string | null;
            created_at: string;
          };
          callback.current({
            id: linha.id,
            tipo: linha.type || "info",
            titulo: linha.title,
            corpo: linha.body,
            link: linha.link,
            criadaEm: linha.created_at,
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Canal de notificações indisponível:", status);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}
