import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CreditCard, Copy, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { UpgradePlanModal } from './UpgradePlanModal';

interface PayButtonProps {
  cliente_id?: string;
  valor: number;
  descricao: string;
  ordem_servico_id?: string;
  orcamento_id?: string;
  size?: 'sm' | 'default';
  variant?: 'default' | 'outline';
}

export function PayButton(props: PayButtonProps) {
  const { has } = useFeatureAccess();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleClick = async () => {
    if (!has('cobrancas_asaas')) { setShowUpgrade(true); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-customer-charge', { body: props });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResult(data);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao gerar cobrança');
    } finally { setLoading(false); }
  };

  return (
    <>
      <Button size={props.size || 'default'} variant={props.variant || 'default'} onClick={handleClick} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
        Pagar via PIX/Boleto
      </Button>

      <UpgradePlanModal open={showUpgrade} onOpenChange={setShowUpgrade} reason="feature" />

      <Dialog open={!!result} onOpenChange={() => setResult(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cobrança gerada</DialogTitle><DialogDescription className="sr-only">Detalhes da cobrança gerada</DialogDescription></DialogHeader>
          {result && result.pix_manual && (
            <div className="space-y-3">
              <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 text-center">
                <p className="text-xs uppercase text-muted-foreground">Pague via PIX direto para a oficina</p>
                <p className="text-2xl font-bold mt-1">R$ {Number(result.valor).toFixed(2)}</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Titular</span><span className="font-medium">{result.pix_receiver_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span className="font-medium uppercase">{result.pix_key_type}</span></div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs">Chave PIX</span>
                  <div className="flex gap-2">
                    <code className="text-xs bg-muted p-2 rounded flex-1 break-all">{result.pix_key_value}</code>
                    <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(result.pix_key_value); toast.success('Chave copiada'); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <Button className="w-full" onClick={() => { navigator.clipboard.writeText(result.pix_key_value); toast.success('Chave PIX copiada'); }}>
                <Copy className="h-4 w-4 mr-2" /> Copiar Chave PIX
              </Button>
            </div>
          )}
          {result && !result.pix_manual && (
            <div className="space-y-4">
              {result.pix_qr_image && (
                <div>
                  <p className="text-sm font-semibold mb-2">PIX</p>
                  <img src={`data:image/png;base64,${result.pix_qr_image}`} alt="QR Code" className="w-40 h-40 border rounded mx-auto" />
                  {result.pix_payload && (
                    <div className="flex gap-2 mt-2">
                      <code className="text-xs bg-muted p-2 rounded flex-1 break-all">{result.pix_payload}</code>
                      <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(result.pix_payload); toast.success('Copiado'); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
              {result.bank_slip_url && (
                <Button asChild variant="outline" className="w-full">
                  <a href={result.bank_slip_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-2" /> Abrir boleto</a>
                </Button>
              )}
              {result.payment_url && (
                <Button asChild className="w-full">
                  <a href={result.payment_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-2" /> Página de pagamento</a>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
