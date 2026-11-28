import somNotificacao from "@/assets/som-notificacao.mp3";

// Preferência por aparelho. O valor gravado é o "silenciado" (compatível com o
// botão do sino, que já usava a mesma chave).
const MUTE_KEY = "livreos:sound-muted";

/** Som ligado? (padrão: ligado) */
export const isSomAtivado = () => localStorage.getItem(MUTE_KEY) !== "1";

export const setSomAtivado = (ativado: boolean) => {
  localStorage.setItem(MUTE_KEY, ativado ? "0" : "1");
};

let audio: HTMLAudioElement | null = null;

function getAudio() {
  if (!audio) {
    audio = new Audio(somNotificacao);
    audio.preload = "auto";
    audio.volume = 0.85;
  }
  return audio;
}

/**
 * Os navegadores só liberam áudio depois de um gesto do usuário. Este primeiro
 * toque toca o som sem volume para "destravar" o aparelho; a partir daí os
 * avisos podem soar sem interação.
 */
export function desbloquearAudio() {
  const a = getAudio();
  a.muted = true;
  a.play()
    .then(() => {
      a.pause();
      a.currentTime = 0;
      a.muted = false;
    })
    .catch(() => {
      a.muted = false;
    });
}

/** Toca o aviso sonoro. Use `forcar` no botão "Testar som". */
export function tocarSomNotificacao(forcar = false) {
  if (!forcar && !isSomAtivado()) return;
  const a = getAudio();
  a.currentTime = 0;
  a.play().catch(() => {
    // Sem gesto do usuário o navegador pode recusar; o próximo toque resolve.
  });
  if (navigator.vibrate) navigator.vibrate([150, 80, 150]);
}

/** Destrava o áudio já no primeiro toque em qualquer lugar do app. */
export function destravarSomNoPrimeiroToque() {
  if (typeof window === "undefined") return () => {};
  const unlock = () => desbloquearAudio();
  window.addEventListener("pointerdown", unlock, { once: true });
  return () => window.removeEventListener("pointerdown", unlock);
}
