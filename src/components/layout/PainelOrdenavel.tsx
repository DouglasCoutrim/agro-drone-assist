import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, GripVertical, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { carregarOrdem, chaveDoPainel, limparOrdem, moverItem, salvarOrdem } from "@/lib/painel-layout";
import { PainelBlocoContext } from "./painel-bloco-context";

/**
 * Painel com blocos que o usuário reorganiza na ordem que preferir.
 *
 * A ordem é **somente visual**: nada aqui grava em registro nenhum. Cada filho direto que
 * deve participar precisa das marcas `data-bloco` (id estável) e `data-rotulo` (nome exibido
 * no puxador). Exemplo:
 *
 * ```tsx
 * <PainelOrdenavel tela="inicio">
 *   <div data-bloco="indicadores" data-rotulo="Indicadores">...</div>
 *   <section data-bloco="alertas" data-rotulo="Requer atenção">...</section>
 * </PainelOrdenavel>
 * ```
 *
 * Arrasta com mouse e com o dedo (Pointer Events) e também responde às setas ↑ ↓ quando o
 * puxador está focado. A ordem fica salva por usuário e por tela.
 */
export function PainelOrdenavel({
  tela,
  children,
  className,
}: {
  tela: string;
  children: ReactNode;
  className?: string;
}) {
  const { user } = useAuth();

  const filhos = Children.toArray(children).filter(isValidElement).map((elemento) => {
    const props = elemento.props as Record<string, unknown>;
    const id = typeof props["data-bloco"] === "string" ? (props["data-bloco"] as string) : "";
    const rotulo = typeof props["data-rotulo"] === "string" ? (props["data-rotulo"] as string) : id;
    return { id, rotulo, elemento };
  });
  const blocos = filhos.filter((b) => b.id);
  const semMarca = filhos.filter((b) => !b.id).map((b) => b.elemento);

  const idsPadrao = blocos.map((b) => b.id);
  // Chave estável: evita recarregar/regravar a ordem a cada render.
  const chaveIds = idsPadrao.join("|");
  const chave = chaveDoPainel(user?.id, tela);

  const [ordem, setOrdem] = useState<string[]>(idsPadrao);
  // Para qual chave a ordem atual já foi carregada: evita regravar/limpar antes de ler.
  const [carregadoPara, setCarregadoPara] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState("");
  // Blocos encolhidos pelo usuário (acordeão). Somente visual, nada é gravado.
  const [recolhidos, setRecolhidos] = useState<Record<string, boolean>>({});
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const arrastandoRef = useRef<string | null>(null);

  // Carrega a ordem salva quando muda o usuário, a tela ou o conjunto de blocos.
  useEffect(() => {
    const ids = chaveIds ? chaveIds.split("|") : [];
    setOrdem(carregarOrdem(chave, ids));
    setCarregadoPara(chave);
  }, [chave, chaveIds]);

  // Grava a ordem; se ela voltou ao padrão, limpa o que estava salvo.
  useEffect(() => {
    if (carregadoPara !== chave) return;
    const ids = chaveIds ? chaveIds.split("|") : [];
    if (ordem.join("|") === ids.join("|")) limparOrdem(chave);
    else salvarOrdem(chave, ordem);
  }, [ordem, chave, chaveIds, carregadoPara]);

  const padrao = chaveIds ? chaveIds.split("|") : [];
  const alterado = ordem.join("|") !== padrao.join("|");

  const alternarRecolhido = (id: string, rotulo: string) => {
    const encolhendo = !recolhidos[id];
    setRecolhidos((atual) => ({ ...atual, [id]: encolhendo }));
    setAnuncio(`${rotulo} ${encolhendo ? "encolhido" : "expandido"}.`);
  };

  const iniciarArraste = (id: string, e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastandoRef.current = id;
    setArrastando(id);
  };

  const moverArraste = (e: React.PointerEvent<HTMLButtonElement>) => {
    const id = arrastandoRef.current;
    if (!id) return;
    e.preventDefault();
    // Qual bloco está sob o ponteiro agora? (medido na hora, já que a lista se reorganiza)
    let destino = ordem.indexOf(id);
    if (destino < 0) return;
    ordem.forEach((outroId, i) => {
      const el = refs.current[outroId];
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom) destino = i;
    });
    if (destino !== ordem.indexOf(id)) {
      setOrdem((atual) => moverItem(atual, atual.indexOf(id), destino));
    }
  };

  const finalizarArraste = () => {
    if (arrastandoRef.current) {
      setAnuncio(`Bloco reposicionado. Posição ${ordem.indexOf(arrastandoRef.current) + 1} de ${ordem.length}.`);
    }
    arrastandoRef.current = null;
    setArrastando(null);
  };

  const atalhoTeclado = (id: string, e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const de = ordem.indexOf(id);
    if (de < 0) return;
    const para = e.key === "ArrowUp" ? de - 1 : de + 1;
    const nova = moverItem(ordem, de, para);
    if (nova === ordem) return;
    setOrdem(nova);
    const rotulo = blocos.find((b) => b.id === id)?.rotulo || id;
    setAnuncio(`${rotulo} agora na posição ${para + 1} de ${nova.length}.`);
  };

  return (
    <div className={cn("space-y-4 lg:space-y-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Seu painel: arraste pelos pontos para reorganizar, use ↑ ↓ no teclado, ou encolha o que não usa
        </p>
        {alterado && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setOrdem(padrao)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrão
          </Button>
        )}
      </div>

      <p aria-live="polite" className="sr-only">{anuncio}</p>

      {ordem.map((id) => {
        const bloco = blocos.find((b) => b.id === id);
        if (!bloco) return null;
        const encolhido = !!recolhidos[id];
        const conteudoId = `bloco-${id}-conteudo`;
        return (
          <div key={id} ref={(el) => { refs.current[id] = el; }} className={cn(arrastando === id && "opacity-70")}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label={`Reorganizar bloco ${bloco.rotulo}`}
                onPointerDown={(e) => iniciarArraste(id, e)}
                onPointerMove={moverArraste}
                onPointerUp={finalizarArraste}
                onPointerCancel={finalizarArraste}
                onKeyDown={(e) => atalhoTeclado(id, e)}
                className="flex cursor-grab touch-none items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
              >
                <GripVertical className="h-3.5 w-3.5" />
                {bloco.rotulo}
              </button>
              <button
                type="button"
                aria-expanded={!encolhido}
                aria-controls={conteudoId}
                title={encolhido ? "Expandir" : "Encolher"}
                onClick={() => alternarRecolhido(id, bloco.rotulo)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", encolhido && "-rotate-90")} />
                {encolhido ? "Expandir" : "Encolher"}
              </button>
            </div>
            <div
              id={conteudoId}
              hidden={encolhido}
              className={cn("rounded-2xl", arrastando === id && "ring-2 ring-primary/40")}
            >
              <PainelBlocoContext.Provider value={true}>
                {bloco.elemento}
              </PainelBlocoContext.Provider>
            </div>
          </div>
        );
      })}

      {semMarca}
    </div>
  );
}
