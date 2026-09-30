# Corrigir achados do Project Monitoring

## Resultado esperado
- Manter o isolamento entre empresas sem reabrir funções do banco para visitantes.
- Impedir que administradores exclusivos da plataforma vejam atalhos de módulos empresariais sem acesso.

## Implementação
1. Registrar o primeiro achado como desatualizado: o banco atual já concede execução das funções auxiliares aos usuários autenticados e ao serviço interno, não concede a visitantes, e não há novos erros recentes.
2. Ajustar o menu lateral para respeitar o papel empresarial mesmo para administradores da plataforma. Um administrador sem papel em uma empresa verá somente o acesso ao painel administrativo; se também tiver papel empresarial, verá os módulos permitidos por esse papel.
3. Validar a compilação e registrar o segundo achado como corrigido.

## Detalhes técnicos
- Não alterar RLS nem ampliar privilégios para `anon`.
- Alteração limitada ao filtro de navegação em `Sidebar.tsx`.
