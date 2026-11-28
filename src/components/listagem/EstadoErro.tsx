import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EstadoErroProps {
  mensagem: string;
  aoTentarNovamente: () => void;
}

/**
 * Estado de erro para telas que dependem de uma consulta.
 * Substitui o estado "vazio" quando a falha é de carregamento, para o usuário
 * ver o problema e poder tentar de novo em vez de uma lista vazia.
 */
export function EstadoErro({ mensagem, aoTentarNovamente }: EstadoErroProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{mensagem}</p>
      <Button variant="outline" size="sm" onClick={aoTentarNovamente}>
        Tentar novamente
      </Button>
    </div>
  );
}
