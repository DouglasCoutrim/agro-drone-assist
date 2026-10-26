import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import soundAsset from "@/assets/notification.mp3.asset.json";

const MUTE_KEY = "livreos:sound-muted";
export const isSoundMuted = () => localStorage.getItem(MUTE_KEY) === "1";
export const setSoundMuted = (m: boolean) => localStorage.setItem(MUTE_KEY, m ? "1" : "0");

let audio: HTMLAudioElement | null = null;
const getAudio = () => {
  if (!audio) {
    audio = new Audio(soundAsset.url);
    audio.preload = "auto";
  }
  return audio;
};

export function playNotificationSound() {
  if (isSoundMuted()) return;
  const a = getAudio();
  a.currentTime = 0;
  a.play().catch(() => {});
  if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
}

/** Escuta em tempo real as notificações do usuário logado e toca o som. */
export function useSoundNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Desbloqueia o áudio no primeiro toque (política de autoplay dos celulares)
  useEffect(() => {
    const unlock = () => {
      const a = getAudio();
      a.muted = true;
      a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
      window.removeEventListener("pointerdown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-sound-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as { title: string; body: string | null; link: string | null };
          playNotificationSound();
          toast(n.title, {
            description: n.body ?? undefined,
            action: n.link ? { label: "Abrir", onClick: () => navigate(n.link!) } : undefined,
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, navigate]);
}
