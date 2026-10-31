# Permissões em árvore espelhando o menu

## O que muda para o usuário
Em **Equipe → permissões do usuário**, a lista atual de chaves soltas será trocada por uma cópia do menu principal:

```text
[x] Início
    [x] Dashboard
    [ ] Oficina ao Vivo (TV)
[x] Estoque
    [x] Produtos e Peças
    [ ] Importar XML (NF-e)
[ ] Fiscal            (módulo inteiro bloqueado)
```

- Marcar um módulo marca todos os itens dentro dele.
- Desmarcar itens deixa o módulo em estado "parcial" (traço no lugar do check).
- Desmarcar o módulo bloqueia todos os itens dele.
- Botões "Marcar tudo" / "Desmarcar tudo".
- Itens que o papel do usuário já não permite (ex.: Equipe só para administrador) aparecem desabilitados, com balão explicando.
- Sempre que o menu ganhar um item novo, ele aparece automaticamente na tela de permissões.

## Efeito no sistema
- O menu (computador e celular) mostra só os itens marcados; módulos sem nenhum item marcado somem.
- Abrir uma tela desmarcada pelo endereço mostra "Sem acesso" e volta ao Dashboard.
- Administradores continuam com acesso total.
- Usuários atuais: as permissões que já têm hoje são convertidas, então ninguém perde ou ganha acesso na troca.

## Detalhes técnicos
- Nova coluna `rotas_bloqueadas text[]` (padrão vazio) em `user_permissions`, guardando os `href` desmarcados; lista de bloqueados para que itens novos do menu fiquem liberados por padrão. Backfill a partir das colunas `acesso_*` atuais (mapa coluna → hrefs). Colunas antigas ficam marcadas como DEPRECATED.
- `navConfig.ts` vira a fonte única: componente `PermissionTree` lê `navSections`, com Checkbox de três estados.
- `usePermissions` expõe `canAccess(href)`; `NavModules` e o guarda de rotas usam essa função.
- Escrita protegida pelas regras atuais de RLS (só admin da organização altera).
- Teste: módulo marcado com um subitem desmarcado bloqueia só esse subitem.
