import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Copy, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCpfCnpj, formatCurrency, formatPhone, getErrorMessage, validateCpfCnpj } from '@/lib/formatters';
import { mensagemDoErroFuncao } from '@/lib/functionsError';
import { toast } from 'sonner';

type Pagador = { nome: string; cpfCnpj: string; email: string; telefone: string };

const CICLO_LABEL: Record<string, string> = {
  mensal: 'por mês',
  semestral: 'a cada 6 meses',
  anual: 'por ano',
};

export default function CheckoutPublico() {
  const { token } = useParams<{ token: string }>();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<any>(null);
  const [pagamento, setPagamento] = useState<any>(null);
  const [pago, setPago] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pagador, setPagador] = useState<Pagador>({ nome: '', cpfCnpj: '', email: '', telefone: '' });

  const chamar = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('public-checkout', { body: { ...body, token } });
    if (error) throw new Error(await mensagemDoErroFuncao(error, 'Não foi possível carregar o link de pagamento.'));
    if (data?.error) throw new Error(data.error);
    return data;
  }, [token]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!token) { setErro('Link de pagamento incompleto.'); setCarregando(false); return; }
      try {
        const data = await chamar({ action: 'info' });
        if (!ativo) return;
        setInfo(data);
        setPagamento(data.pagamento ?? null);
        setPago(data.status === 'paid');
        setPagador({
          nome: data.sugestao?.nome ?? '',
          cpfCnpj: data.sugestao?.cpfCnpj ? formatCpfCnpj(data.sugestao.cpfCnpj) : '',
          email: data.sugestao?.email ?? '',
          telefone: data.sugestao?.telefone ? formatPhone(data.sugestao.telefone) : '',
        });
      } catch (e) {
        if (ativo) setErro(getErrorMessage(e));
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => { ativo = false; };
  }, [chamar, token]);

  useEffect(() => {
    if (!pagamento || pago) return;
    const intervalo = setInterval(async () => {
      try {
        const s = await chamar({ action: 'status' });
        if (s?.status === 'paid' || s?.fatura_status === 'pago') {
          setPago(true);
          toast.success('Pagamento confirmado!');
        }
      } catch { /* segue tentando no próximo ciclo */ }
    }, 5000);
    return () => clearInterval(intervalo);
  }, [pagamento, pago, chamar]);

  const gerarCobranca = async () => {
    if (!validateCpfCnpj(pagador.cpfCnpj)) {
      toast.error('Confira o CPF ou CNPJ informado.');
      return;
    }
    setEnviando(true);
    try {
      const r = await chamar({ action: 'charge', ...pagador });
      setPagamento(r.pagamento ?? null);
      if (r.status === 'paid') setPago(true);
      toast.success('Cobrança gerada. Escolha a forma de pagamento.');
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setEnviando(false);
    }
  };

  const copiar = (texto: string, rotulo = 'Copiado') => {
    navigator.clipboard.writeText(texto);
    toast.success(rotulo);
  };

  const valor = pagamento?.valor ?? info?.valor;
  const vencimento = pagamento?.vencimento ?? info?.vencimento;

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          Pagamento seguro da assinatura
        </div>

        {carregando && (
          <Card className="p-8 flex items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Carregando link de pagamento...
          </Card>
        )}

        {!carregando && erro && (
          <Card className="p-8 space-y-3 text-center">
            <TriangleAlert className="h-8 w-8 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">Não foi possível abrir este link</h1>
            <p className="text-muted-foreground">{erro}</p>
            <p className="text-sm text-muted-foreground">
              Peça um novo link para o administrador da conta no menu Assinatura.
            </p>
          </Card>
        )}

        {!carregando && !erro && pago && (
          <Card className="p-8 space-y-3 text-center">
            <CheckCircle2 className="h-10 w-10 text-success mx-auto" />
            <h1 className="text-2xl font-bold">Pagamento confirmado</h1>
            <p className="text-muted-foreground">
              {info?.empresa ? `A assinatura de ${info.empresa} está ativa.` : 'A assinatura está ativa.'} O plano
              {info?.plano?.nome ? ` ${info.plano.nome}` : ''} já pode ser usado por toda a equipe.
            </p>
            <Button asChild className="mt-2">
              <a href="/auth">Entrar no sistema</a>
            </Button>
          </Card>
        )}

        {!carregando && !erro && !pago && info && (
          <>
            <Card className="p-6 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Assinatura</p>
                <h1 className="text-2xl font-bold">{info.empresa ?? 'Sua empresa'}</h1>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="uppercase">{info.plano?.nome ?? info.plano?.slug}</Badge>
                <Badge variant="secondary">{info.ciclo}</Badge>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Valor</p>
                  <p className="text-xl font-bold">{formatCurrency(valor ?? 0)}</p>
                  <p className="text-xs text-muted-foreground">{CICLO_LABEL[info.ciclo] ?? ''}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vencimento</p>
                  <p className="font-medium">{vencimento ? new Date(`${vencimento}T00:00:00`).toLocaleDateString('pt-BR') : '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Link válido até</p>
                  <p className="font-medium">
                    {info.expira_em ? new Date(info.expira_em).toLocaleDateString('pt-BR') : '-'}
                  </p>
                </div>
              </div>
            </Card>

            {!pagamento && (
              <Card className="p-6 space-y-4">
                <div>
                  <h2 className="font-semibold">Dados de quem vai pagar</h2>
                  <p className="text-sm text-muted-foreground">
                    Usamos esses dados apenas para emitir a cobrança e o comprovante.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="pagador-nome">Nome ou razão social</Label>
                    <Input
                      id="pagador-nome"
                      value={pagador.nome}
                      onChange={(e) => setPagador({ ...pagador, nome: e.target.value })}
                      placeholder="Ex.: Agro Drones Ltda"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pagador-doc">CPF ou CNPJ</Label>
                    <Input
                      id="pagador-doc"
                      value={pagador.cpfCnpj}
                      onChange={(e) => setPagador({ ...pagador, cpfCnpj: formatCpfCnpj(e.target.value) })}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pagador-telefone">Telefone (opcional)</Label>
                    <Input
                      id="pagador-telefone"
                      value={pagador.telefone}
                      onChange={(e) => setPagador({ ...pagador, telefone: formatPhone(e.target.value) })}
                      placeholder="(00) 00000-0000"
                      inputMode="tel"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="pagador-email">E-mail</Label>
                    <Input
                      id="pagador-email"
                      type="email"
                      value={pagador.email}
                      onChange={(e) => setPagador({ ...pagador, email: e.target.value })}
                      placeholder="financeiro@suaempresa.com.br"
                    />
                  </div>
                </div>

                <Button className="w-full" onClick={gerarCobranca} disabled={enviando}>
                  {enviando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Gerar cobrança
                </Button>
              </Card>
            )}

            {pagamento && (
              <Card className="p-6 space-y-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Aguardando o pagamento. Esta página é atualizada sozinha.
                </div>

                {pagamento.pix_qr_image && (
                  <div className="space-y-3">
                    <h2 className="font-semibold">PIX</h2>
                    <div className="flex flex-wrap gap-4">
                      <img
                        src={`data:image/png;base64,${pagamento.pix_qr_image}`}
                        alt="QR Code PIX"
                        className="h-48 w-48 rounded border bg-white p-1"
                      />
                      <div className="flex-1 min-w-[240px] space-y-2">
                        <p className="text-xs text-muted-foreground">PIX copia e cola</p>
                        <code className="block max-h-28 overflow-auto break-all rounded bg-muted p-2 text-xs">
                          {pagamento.pix_payload}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copiar(pagamento.pix_payload, 'Código PIX copiado')}
                        >
                          <Copy className="h-4 w-4 mr-2" /> Copiar código
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {pagamento.bank_slip_url && (
                  <div className="space-y-2">
                    <h2 className="font-semibold">Boleto</h2>
                    {pagamento.barcode && (
                      <code className="block break-all rounded bg-muted p-2 text-xs">{pagamento.barcode}</code>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <a href={pagamento.bank_slip_url} target="_blank" rel="noreferrer">Abrir boleto</a>
                      </Button>
                      {pagamento.barcode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copiar(pagamento.barcode, 'Linha digitável copiada')}
                        >
                          <Copy className="h-4 w-4 mr-2" /> Copiar linha digitável
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {pagamento.invoice_url && (
                  <Button asChild variant="link" className="justify-start px-0">
                    <a href={pagamento.invoice_url} target="_blank" rel="noreferrer">
                      Abrir página de pagamento (cartão, PIX ou boleto)
                    </a>
                  </Button>
                )}
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
