# Notificações pop-up em tempo real (som + permissão do PWA)

## Problema

A infraestrutura de notificações já existia no banco (`notifications`, `notify_user`,
`notify_org_role`, triggers de OS/estoque/suporte/mensalidade e push via Edge Function), mas
**nada chegava na hora na tela**:

1. A publicação `supabase_realtime` estava **vazia**, então a assinatura em tempo real do app
   nunca recebia INSERT — o som e o toast existentes simplesmente não disparavam.
2. Não havia nenhuma regra de notificação para **solicitação de compra**.
3. O aviso era um toast curto, sem pedido explícito de autorização de notificações/áudio.

## Banco (via SQL, sem arquivos de migration)

- `alter publication supabase_realtime add table public.notifications;` — habilita a entrega em
  tempo real das notificações do usuário (a RLS `Users view own notifications` continua
  limitando cada um às próprias linhas).
- `public.trg_notify_solicitacao_compra()` + trigger `trg_notify_solicitacao_compra` em
  `solicitacoes_compra` (AFTER INSERT OR UPDATE):
  - INSERT → avisa os **admins** da organização (`tipo = 'estoque'`, link `/compras`), cobrindo
    tanto o pedido manual quanto a solicitação automática de estoque baixo.
  - UPDATE de status para `em_cotacao` / `aprovada` / `rejeitada` → avisa o
    `solicitado_por` (quem pediu recebe a resposta).
- Tipo `'estoque'` foi escolhido de propósito: já existe aba "Estoque" na página de
  notificações, então nada novo precisou entrar na lista de filtros.

## Aplicação

- `src/lib/notification-sound.ts` (novo) — preferência de som por aparelho
  (`livreos:sound-muted`, compatível com o que o sino já usava), `desbloquearAudio()`,
  `tocarSomNotificacao()` e `destravarSomNoPrimeiroToque()` (política de autoplay).
- `src/hooks/useNotificacoesAoVivo.ts` (novo) — assinatura Realtime em
  `notifications` filtrada por `user_id`, com log de erro de canal.
- `src/components/notifications/PopupNotificacao.tsx` (novo) — cartão de aviso com ícone por
  tipo, "Abrir" (marca como lida e navega pelo `link`) e "Fechar".
- `src/components/notifications/NotificadorGlobal.tsx` (novo) — monta o pop-up, toca o som,
  dispara `new Notification(...)` quando a aba não está visível, e mostra o **pedido de
  autorização** ("Ativar notificações e som" / "Agora não", reaparecendo após 7 dias de
  dispensa). Montado no `MainLayout`.
- `src/components/layout/MainLayout.tsx` — passou a renderizar `<NotificadorGlobal />` no lugar
  do antigo `useSoundNotifications()`.
- `src/components/NotificationBell.tsx` — botão de som agora usa o utilitário central.
- `src/components/PushNotificationsCard.tsx` — além do push, ganhou o controle de **som** com
  "Testar som" (que também destrava o áudio).
- `src/hooks/useSoundNotifications.ts` — removido (substituído pelo notificador global).

## Observações

- Push com o app **fechado** continua dependendo da Edge Function `send-web-push` (VAPID +
  `push_subscriptions`), que já estava no ar; não foi alterada.
- O envio manual de um aviso para um usuário específico (fora das regras automáticas) não foi
  implementado; `notify_user` / `notify_org_role` aceitam isso no banco se for necessário criar
  uma RPC guardada por admin.
