-- Update Wiki Articles with more content and tour steps

-- 1. Bem-vindo ao LivreOS (Dashboard)
UPDATE public.wiki_articles 
SET 
  content = '# Bem-vindo ao LivreOS

O LivreOS é o sistema completo de gestão para sua oficina: **Ordens de Serviço, Estoque, Financeiro, Clientes, Orçamentos e Logística** em um só lugar.

## Dashboard: O Coração do seu Negócio
O Dashboard oferece uma visão em tempo real da saúde da sua oficina.

![Dashboard do Sistema](https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800)

### Funções Principais:
- **KPIs:** Visualize rapidamente o número de OS abertas, concluídas, itens com estoque baixo e o faturamento do mês.
- **OS Recentes:** Lista das últimas ordens de serviço criadas para acesso rápido.
- **Alertas:** Notificações críticas sobre atrasos em OS, cobranças vencidas e reposição de estoque.

### Navegação Rápida:
Use a barra lateral para navegar entre os módulos ou utilize o atalho **Ctrl+K** para buscar qualquer coisa no sistema.',
  tour_steps = '[
    {"target": "body", "content": "Bem-vindo ao guia interativo do LivreOS! Vamos te mostrar as principais funções.", "placement": "center"},
    {"target": ".grid.grid-cols-2.lg\\\\:grid-cols-4", "content": "Aqui estão seus indicadores principais: OS, Estoque e Faturamento."},
    {"target": ".bg-card.border.border-border.rounded-2xl.shadow-soft.overflow-hidden", "content": "Nesta tabela você acompanha as últimas Ordens de Serviço."},
    {"target": ".bg-card.border.border-border.rounded-2xl.shadow-soft.overflow-hidden:last-child", "content": "Fique atento aos alertas! Aqui o sistema avisa sobre atrasos e estoque baixo."}
  ]'::jsonb,
  tour_target_route = '/dashboard'
WHERE slug = 'bem-vindo';

-- 2. Ordens de Serviço
UPDATE public.wiki_articles 
SET 
  content = '# Gestão de Ordens de Serviço (OS)

A Ordem de Serviço é o módulo mais importante do sistema. Ela gerencia todo o ciclo de vida do reparo, desde a entrada até o faturamento.

![Gestão de OS](https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=800)

## O Fluxo de Trabalho (Pipeline)
Toda OS segue etapas lógicas:
1. **Recebido:** Equipamento entrou na oficina.
2. **Aguard. Diagnóstico:** Técnico precisa avaliar o problema.
3. **Aguard. Aprovação:** Orçamento enviado ao cliente.
4. **Em Reparo/Testes:** Trabalho sendo executado.
5. **Pronto/Entregue:** Equipamento finalizado e devolvido.

### Criando uma OS:
- Clique em **Nova OS**.
- Siga o assistente (Wizard): Selecione o Cliente → Equipamento → Problema → Revisão.
- Adicione fotos e checklists para segurança jurídica.

### WhatsApp e Impressão:
Você pode enviar o orçamento ou o status da OS diretamente para o WhatsApp do cliente ou imprimir um PDF profissional.',
  tour_steps = '[
    {"target": "button.gradient-primary", "content": "Clique aqui para iniciar uma nova Ordem de Serviço."},
    {"target": ".relative input", "content": "Busque por número da OS, nome do cliente ou equipamento."},
    {"target": ".divide-y", "content": "Aqui você gerencia todas as suas ordens. Clique em uma para ver detalhes."}
  ]'::jsonb,
  tour_target_route = '/ordens-servico'
WHERE slug = 'criando-primeira-os';

-- 3. Estoque
UPDATE public.wiki_articles 
SET 
  content = '# Controle de Estoque Inteligente

Mantenha seu inventário organizado e nunca perca uma venda por falta de peças.

![Estoque](https://images.unsplash.com/photo-1553413077-190dd305871c?auto=format&fit=crop&q=80&w=800)

## Funções de Destaque:
- **Importação Mercado Livre:** Basta colar o link do anúncio para cadastrar o produto com foto e preço.
- **Margem de Lucro Global:** Defina uma margem e aplique a todos os produtos de uma só vez.
- **Estoque Mínimo:** O sistema avisa automaticamente no Dashboard quando um item precisa de reposição.

### Como Cadastrar:
1. Vá em **Novo Item**.
2. Preencha a descrição, custo e margem.
3. Defina a localização física na oficina para facilitar a busca.',
  tour_steps = '[
    {"target": "button.gradient-primary", "content": "Cadastre novos produtos aqui. Tente usar a importação do Mercado Livre!"},
    {"target": ".bg-muted\\\\/50.rounded-lg", "content": "Gerencie sua margem de lucro de forma global aqui."},
    {"target": ".grid.grid-cols-3", "content": "Acompanhe o valor total do seu patrimônio em estoque."}
  ]'::jsonb,
  tour_target_route = '/estoque'
WHERE slug = 'controle-estoque';

-- 4. Financeiro
UPDATE public.wiki_articles 
SET 
  content = '# Gestão Financeira e Cobranças

Tenha controle total sobre o dinheiro que entra e sai da sua empresa.

![Financeiro](https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=800)

## Módulos Financeiros:
- **Fluxo de Caixa:** Registre receitas, despesas, salários e comissões.
- **Integração Asaas:** Gere boletos e Pix automaticamente vinculados às suas OS.
- **Relatórios:** Visualize o lucro líquido do mês em tempo real.

### Cobranças Automáticas:
Ao finalizar uma OS, você pode gerar a cobrança no Asaas com um clique. O sistema monitora o pagamento e atualiza o status financeiro automaticamente.',
  tour_steps = '[
    {"target": ".grid.grid-cols-2.lg\\\\:grid-cols-4", "content": "Veja seu lucro real após descontar despesas e comissões."},
    {"target": "button.gradient-primary", "content": "Registre entradas ou saídas manuais que não vieram de uma OS."},
    {"target": ".space-y-2", "content": "Acompanhe o extrato detalhado de todas as movimentações."}
  ]'::jsonb,
  tour_target_route = '/financeiro'
WHERE slug = 'asaas-cobrancas';

-- 5. Clientes (Criar se não existir ou atualizar)
INSERT INTO public.wiki_articles (category_id, slug, title, summary, content, tags, published, sort_order, tour_target_route, tour_steps)
VALUES (
  (SELECT id FROM public.wiki_categories WHERE slug = 'clientes' LIMIT 1),
  'gestao-clientes',
  'Gestão de Clientes e CRM',
  'Como gerenciar sua base de contatos e histórico de atendimentos.',
  '# Central de Clientes

O cadastro de clientes é a base para o histórico de equipamentos e faturamento.

![Clientes](https://images.unsplash.com/photo-1556745753-b2904692b3cd?auto=format&fit=crop&q=80&w=800)

## Funcionalidades:
- **Busca por CEP:** Preenchimento automático de endereço via ViaCEP.
- **Validação de CPF/CNPJ:** Evite cadastros duplicados ou errados.
- **Histórico Completo:** Ao abrir um cliente, veja todas as OS e cobranças vinculadas a ele.

### Sincronização Asaas:
Clientes cadastrados no LivreOS são sincronizados automaticamente com o Asaas, permitindo a emissão de cobranças sem redigitação.',
  ARRAY['clientes', 'crm', 'asaas'],
  true,
  10,
  '/clientes',
  '[
    {"target": "button.gradient-primary", "content": "Cadastre novos clientes aqui. Use a busca por CEP para agilizar!"},
    {"target": ".relative input", "content": "Busque por nome, telefone ou CPF/CNPJ."},
    {"target": ".divide-y", "content": "Clique em um cliente para ver o histórico completo de serviços prestados."}
  ]'::jsonb
) ON CONFLICT (slug) DO UPDATE 
SET 
  content = EXCLUDED.content,
  tour_steps = EXCLUDED.tour_steps,
  tour_target_route = EXCLUDED.tour_target_route;
