# Logout no mobile + Auto-logout por inatividade

## Problema
1. No viewport < 1024px (mobile/tablet, que é o seu caso atual com 978px) o `Header.tsx` está com `hidden lg:flex`, então o menu de avatar com o botão "Sair" não aparece. O `MobileHeader` e `BottomNav` não têm opção de sair.
2. Não existe nenhuma rotina de auto-logout por inatividade implementada (apesar da regra antiga de 8h estar registrada na memória). Você quer reduzir para **10 minutos**.

## O que será feito

### 1. Botão "Sair" visível no mobile
Adicionar em `src/components/layout/MobileHeader.tsx` um menu (avatar + DropdownMenu) com:
- E-mail do usuário
- Badge do role
- Item "Sair" (ícone LogOut, vermelho) chamando `signOut()` e redirecionando para `/auth`

Isso reaproveita exatamente o mesmo padrão do `Header.tsx` desktop, garantindo paridade.

### 2. Auto-logout por inatividade (10 min)
Criar `src/hooks/useInactivityLogout.ts`:
- Constante `INACTIVITY_MS = 10 * 60 * 1000`
- Constante `WARNING_MS = 60 * 1000` (aviso 1 min antes)
- Escuta eventos: `mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll`, `visibilitychange`
- Usa `setTimeout` (com debounce/throttle nos listeners) para:
  - aos 9 min → toast "Sua sessão expirará em 1 minuto por inatividade"
  - aos 10 min → `signOut()` + toast "Sessão encerrada por inatividade" + redireciona para `/auth`
- Sincroniza última atividade entre abas via `localStorage` (`lastActivityAt`) + listener `storage`, para que atividade em qualquer aba reinicie o contador
- Só ativa quando há usuário autenticado

Integrar o hook em `src/hooks/useAuth.tsx` (ou no `MainLayout`) para rodar em toda a área logada.

### 3. Atualizar memória do projeto
Atualizar `mem://auth/sessao-seguranca` e o Core do index para refletir **10 minutos** em vez de 8h.

## Detalhes técnicos
- Sem mudanças no banco/RLS — totalmente client-side.
- `supabase.auth` já mantém o refresh token; o auto-logout é apenas UX local: forçamos `signOut()` para invalidar a sessão local.
- Sem dependências novas.

## Arquivos
- editar: `src/components/layout/MobileHeader.tsx`
- criar: `src/hooks/useInactivityLogout.ts`
- editar: `src/hooks/useAuth.tsx` (chamar o hook dentro do `AuthProvider` após `user` resolver) **ou** `src/components/layout/MainLayout.tsx`
- atualizar: `mem://auth/sessao-seguranca` + `mem://index.md`
