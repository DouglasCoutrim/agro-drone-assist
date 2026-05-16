import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, LogOut, ExternalLink } from 'lucide-react';

export default function MensalidadeAtraso() {
  const { signOut } = useAuth();
  const { organization } = useOrganization();
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    if (!organization) return;
    supabase.from('tenant_invoices' as any)
      .select('*')
      .eq('organization_id', organization.id)
      .in('status', ['pendente', 'vencido'])
      .order('vencimento')
      .then(({ data }) => setInvoices(data || []));
  }, [organization]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <CardTitle>Acesso suspenso</CardTitle>
              <p className="text-sm text-muted-foreground">{organization?.blocked_reason || 'Mensalidade em atraso'}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">
            Para reativar sua conta, quite as faturas em aberto abaixo:
          </p>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma fatura encontrada. Entre em contato com o suporte.</p>
          ) : (
            invoices.map((inv) => (
              <div key={inv.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">Competência {inv.competencia}</div>
                  <div className="text-sm text-muted-foreground">Vence: {new Date(inv.vencimento).toLocaleDateString('pt-BR')}</div>
                  <div className="text-lg font-bold text-primary">R$ {Number(inv.valor).toFixed(2)}</div>
                </div>
                {inv.payment_url && (
                  <Button size="sm" asChild>
                    <a href={inv.payment_url} target="_blank" rel="noreferrer">
                      Pagar <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </Button>
                )}
              </div>
            ))
          )}
          <Button variant="outline" className="w-full" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
