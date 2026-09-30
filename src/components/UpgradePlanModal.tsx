import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Crown, Sparkles, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UpgradePlanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: 'os' | 'users' | 'feature';
  currentPlan?: string;
}

const PLANS = [
  {
    slug: 'bronze', name: 'Bronze', price: 39.90, icon: Zap,
    highlights: ['2 usuários', '30 OS / mês', 'Clientes, Estoque, Orçamentos'],
  },
  {
    slug: 'prata', name: 'Prata', price: 59.90, icon: Sparkles, recommended: true,
    highlights: ['4 usuários', '60 OS / mês', 'Financeiro + Cobrança PIX/Boleto', 'WhatsApp & Mercado Livre'],
  },
  {
    slug: 'ouro', name: 'Ouro', price: 69.90, icon: Crown,
    highlights: ['10 usuários', 'OS ilimitadas', 'White-label completo', 'Rotas, API REST, Suporte prioritário'],
  },
];

export function UpgradePlanModal({ open, onOpenChange, reason = 'feature', currentPlan }: UpgradePlanModalProps) {
  const navigate = useNavigate();

  const reasonText = {
    os: 'Você atingiu o limite mensal de Ordens de Serviço do seu plano.',
    users: 'Você atingiu o limite de usuários do seu plano.',
    feature: 'Este recurso não está disponível no seu plano atual.',
  }[reason];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Faça upgrade do seu plano</DialogTitle>
          <DialogDescription>{reasonText} Escolha o plano ideal para crescer.</DialogDescription>
        </DialogHeader>
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {PLANS.map(p => {
            const Icon = p.icon;
            const isCurrent = currentPlan === p.slug;
            return (
              <Card key={p.slug} className={`p-5 relative ${p.recommended ? 'border-primary ring-2 ring-primary/30' : ''}`}>
                {p.recommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full font-medium">
                    Recomendado
                  </span>
                )}
                <Icon className="h-8 w-8 text-primary mb-2" />
                <h3 className="text-xl font-bold">{p.name}</h3>
                <div className="text-3xl font-black mt-2">
                  R$ {p.price.toFixed(2).replace('.', ',')}
                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                </div>
                <ul className="mt-4 space-y-2 text-sm">
                  {p.highlights.map(h => (
                    <li key={h} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full mt-5"
                  variant={p.recommended ? 'default' : 'outline'}
                  disabled={isCurrent}
                  onClick={() => { onOpenChange(false); navigate('/assinatura'); }}
                >
                  {isCurrent ? 'Plano atual' : 'Escolher'}
                </Button>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
