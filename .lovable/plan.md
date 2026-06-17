## Problema

Em `src/pages/Index.tsx` (linhas 51-53) há um `useEffect` que, ao detectar que o usuário é platform admin e está em `/dashboard`, força `navigate("/admin-master")`. Isso desfaz o clique em "Minha Empresa" no header do AdminMaster — a página da empresa carrega por um instante e volta direto para o painel admin.

## Correção

Remover/desativar esse redirecionamento automático, deixando o platform admin acessar livremente o dashboard da empresa quando ele tem `organization`.

### Mudança

**`src/pages/Index.tsx`** — remover o `useEffect` que redireciona platform admin para `/admin-master`. Assim:

- Quem clica em "Minha Empresa" no AdminMaster fica no `/dashboard` da empresa.
- Para voltar ao painel da plataforma, o admin usa o link "Admin Master" já existente no Sidebar (linha 122-124) ou navega para `/admin-master` direto.

Nenhuma outra rota é afetada. O fluxo de login continua o mesmo — o login redireciona para `/dashboard` e a partir daí a navegação fica livre.

## Observação

Se preferir manter o auto-redirect só para o primeiro login (e não para cliques manuais), uma alternativa seria usar um flag em `sessionStorage` setado pelo botão "Minha Empresa" para suprimir o redirect uma vez. Mas a solução mais simples e previsível é remover o redirect — o platform admin já tem o menu lateral para voltar ao admin quando quiser.
