# Decisões técnicas

- Logos das empresas ficam no bucket público `logos`, em pastas identificadas pela organização; leitura pública serve telas e PDFs, enquanto gravação é restrita ao administrador da própria organização.
- No estoque, `custo_unitario` e `preco_venda` são entradas independentes; importações não devem calcular margem automaticamente para preservar o preço escolhido pelo usuário.
- A instalação na tela inicial usa somente manifestos e ícones; não gerar nem registrar Service Worker de cache, e manter `/sw.js` temporariamente apenas como encerramento do Workbox antigo.
- Build da aplicação deve preferir variáveis públicas gerenciadas de conexão e fornecer fallback público específico do projeto via configuração do Vite, porque a publicação pode omitir `.env` e deixar a tela vazia.
- Keep assistant assignments, commissions, and internal OS notes in staff-only views; customer-facing PDF and messages must use explicit customer-facing fields, because internal compensation must not leak to clients.
- Ao editar uma OS, preservar o orçamento sem lançamentos detalhados e atualizar os itens por identidade, confirmando exclusões antes de salvar; substituir toda a lista apaga lançamentos quando uma leitura falha.