# Análise de custos e planos do LivreOS

**Data da análise:** 28/11/2026
**Escopo:** custos identificáveis no código e nas tarifas públicas dos fornecedores; nenhum pagamento real foi realizado.

## Conclusão executiva

Os preços atuais do banco — Bronze R$39,90, Prata R$59,90 e Ouro R$69,90 — são baixos para sustentar o LivreOS se incluírem emissão fiscal por CNPJ, suporte humano, impostos e crescimento da infraestrutura. O ponto crítico é fiscal: a Focus NFe informa R$94,90/mês no plano Solo, com 1 CNPJ e 100 documentos incluídos, além de R$0,11 por documento adicional [1]. Portanto, emitir NF-e/NFS-e não deve ficar embutido gratuitamente em todos os planos.

A recomendação comercial inicial é manter três planos-base e cobrar fiscal como módulo adicional por CNPJ:

- **Bronze: R$79,90/mês** — operação essencial, até 2 usuários e 30 OS/mês.
- **Prata: R$149,90/mês** — financeiro, cobranças, atendimento e até 5 usuários.
- **Ouro: R$299,90/mês** — operação avançada, até 15 usuários, OS sem limite comercial, rotas, API e suporte prioritário.
- **Módulo Fiscal: R$179,90/mês por CNPJ**, incluindo até 100 documentos; documentos adicionais devem ser cobrados separadamente, com preço comercial sugerido de R$0,25 por documento.

Esses valores são uma recomendação de lançamento, não um preço final matematicamente fechado. Ainda faltam quatro entradas do negócio: custo mensal de suporte, impostos sobre a receita, quantidade esperada de tenants e custo efetivo contratado de domínio/infraestrutura. A fórmula e os cenários abaixo deixam claro onde substituir as premissas.

## O que o código comprova hoje

A migration `supabase/migrations/20260516205740_b14373ea-99de-46a7-a45e-ea4c08562479.sql` registra os planos atuais:

- Bronze: R$39,90, 2 usuários, 30 OS/mês.
- Prata: R$59,90, 4 usuários, 60 OS/mês.
- Ouro: R$69,90, 10 usuários, OS sem limite configurado.

A mesma migration coloca `os`, `clientes`, `estoque` e `orcamentos` no Bronze; acrescenta financeiro, cobranças, Mercado Livre e templates de WhatsApp no Prata; e acrescenta rotas, white-label, API REST e suporte prioritário no Ouro.

O código também mostra que:

1. O LivreOS usa Supabase para banco, autenticação, Storage, Realtime e Edge Functions.
2. A assinatura da plataforma e cobranças de clientes usam Asaas; a aplicação cria clientes, cobranças e QR Code Pix por API.
3. A emissão e o recebimento de documentos fiscais usam Focus NFe quando o tenant configura o recurso.
4. A busca de imagens de produtos pode usar Firecrawl com chave, mas possui fallback para Bing, DuckDuckGo, Openverse e Wikimedia sem chave.
5. Os botões de WhatsApp atualmente abrem links/templates, não uma API oficial de envio em lote. Portanto, não atribuí custo de WhatsApp ao plano-base.
6. O upload de anexos de OS usa o Storage do Supabase, com limite de 5 MB por imagem.
7. O cliente Mercado Pago aparece como gateway opcional configurável por empresa; não deve ser tratado como custo central do LivreOS quando a tarifa é paga pelo próprio tenant.

## Custos recorrentes identificáveis

### Supabase

O plano Pro começa em US$25/mês. Ele inclui 8 GB de disco por projeto, 100 GB de Storage, 250 GB de egress, 250 GB de cached egress e 2 milhões de invocações de Edge Functions; excedentes são cobrados à parte [2]. O Supabase informa que o compute é cobrado por projeto, mas o crédito de US$10 do Pro cobre uma instância Micro no cenário padrão [2].

Para esta análise, usei **US$25/mês** como piso de infraestrutura do Supabase Pro. É uma premissa a confirmar no painel da conta, porque o projeto pode estar no Free, Pro ou em uma configuração com compute diferente.

### Lovable e hospedagem pública

O Lovable informa plano Pro de US$25/mês, com custom domains, e hospedagem publicada gratuita com HTTPS incluído [3] [4]. O plano do Lovable é principalmente custo de construção, publicação e domínio personalizado; não é um custo proporcional direto por tenant. Mesmo assim, ele deve entrar no custo fixo da operação enquanto o projeto depender dele.

### Asaas

A página oficial informa que não há mensalidade ou taxa de adesão. A cobrança ocorre quando o pagamento é recebido [5]. As tarifas padrão exibidas são:

- Pix recebido: R$1,99 por transação.
- Boleto recebido: R$1,99 por transação.
- Cartão de débito: R$0,35 + 1,89%.
- Cartão de crédito à vista: R$0,49 + 2,99%.
- Cartão de crédito à vista promocional por três meses: R$0,49 + 1,99%.

Para não superestimar a margem, usei R$1,99 por recebimento como referência conservadora para Pix/boleto após a promoção. A tarifa efetiva da conta deve ser confirmada no painel Asaas antes de publicar os preços.

### Focus NFe

O plano Solo custa R$94,90/mês, atende 1 CNPJ/CPF, inclui 100 documentos e cobra R$0,11 por documento adicional [1]. O plano Start custa R$119,90/mês para 3 CNPJs/CPFs, com 100 documentos por CNPJ e R$0,11 por documento adicional [1].

Como o código armazena configuração fiscal por organização, o modelo mais seguro é repassar esse custo por CNPJ como um módulo. Se o LivreOS assumir o custo de vários CNPJs de tenants diferentes dentro de uma única conta, a regra comercial precisa ser revisada para não consumir a franquia de um cliente com documentos de outro.

### Firecrawl, mapas, e-mail e WhatsApp

O código aceita `FIRECRAWL_API_KEY`, mas não há tarifa contratada disponível no repositório. O custo deve ser considerado **desconhecido** até consultar a conta do fornecedor ou remover a dependência paga. Os fallbacks gratuitos não garantem SLA nem estabilidade comercial.

Não encontrei no fluxo principal uma API oficial paga de WhatsApp ou um provedor pago de mapas. O WhatsApp usa templates/links; isso não equivale a envio automatizado pela API oficial. O e-mail transacional aparece associado ao Supabase Auth, mas o plano efetivo e os limites da conta precisam ser verificados no painel.

## Cenário de custo fixo mínimo

Para converter o custo do Supabase e Lovable, usei apenas como referência de planejamento **R$5,75 por US$1**, próximo da cotação PTAX consultada do Banco Central; a cotação deve ser atualizada no mês do fechamento [6].

| Item | USD/mês | BRL/mês na premissa |
|---|---:|---:|
| Supabase Pro | US$25 | R$143,75 |
| Lovable Pro | US$25 | R$143,75 |
| **Subtotal fixo conhecido** | **US$50** | **R$287,50** |

Esse subtotal não inclui domínio, impostos, suporte, marketing, contabilidade, tarifas de saque/antecipação, custo de desenvolvimento e Focus NFe. A alocação do subtotal por tenant fica assim:

| Tenants pagantes | Infraestrutura fixa alocada por tenant |
|---:|---:|
| 10 | R$28,75/mês |
| 20 | R$14,38/mês |
| 50 | R$5,75/mês |
| 100 | R$2,88/mês |

A margem real melhora com escala, desde que o uso de Storage, egress, banco, funções e suporte não cresça mais rápido que a receita.

## Economia dos preços recomendados

Considerando apenas a tarifa padrão de R$1,99 do Asaas para Pix/boleto, antes de impostos, suporte e infraestrutura compartilhada:

| Plano | Preço | Receita após Asaas | Observação |
|---|---:|---:|---|
| Bronze | R$79,90 | R$77,91 | Bom para aquisição; não inclui fiscal nem módulos de alto suporte. |
| Prata | R$149,90 | R$147,91 | Faixa para operação profissional e financeiro. |
| Ouro | R$299,90 | R$297,91 | Absorve mais usuários, suporte e módulos avançados. |
| Fiscal | R$179,90 | R$177,91 | Cobre o plano Focus Solo de R$94,90 e deixa R$83,01 antes de impostos/suporte. |

Se o cliente pagar cartão à vista pela tarifa promocional de 1,99% + R$0,49, a receita líquida aproximada fica em R$77,82 no Bronze, R$146,43 no Prata, R$293,44 no Ouro e R$175,83 no módulo Fiscal. Para o planejamento, deve ser usada a tarifa padrão da conta, não a promocional.

## Estrutura comercial recomendada

### Bronze — R$79,90

Inclui clientes, produtos, estoque, vendas, orçamentos, painel e até 2 usuários. Limite comercial de 30 OS/mês. Não inclui emissão fiscal, rotas, white-label, API ou suporte prioritário.

### Prata — R$149,90

Inclui tudo do Bronze, até 5 usuários, financeiro, contas a receber, cobranças, templates de atendimento e ordens de serviço. Limite comercial sugerido de 100 OS/mês. O limite deve ser validado com o custo de suporte e com o volume médio real.

### Ouro — R$299,90

Inclui tudo do Prata, até 15 usuários, OS sem limite comercial razoável, relatórios avançados, rotas, API REST, white-label limitado por política e suporte prioritário. Recursos de alto custo operacional devem ter fair use documentado.

### Add-on Fiscal — R$179,90 por CNPJ/mês

Inclui até 100 documentos por mês e deve informar claramente que cada documento emitido ou recebido consome a franquia. O preço adicional sugerido de R$0,25 por documento deixa uma reserva sobre o custo Focus publicado de R$0,11, mas ainda precisa contemplar impostos, falhas, suporte e eventual aumento de tarifa.

### Add-ons que não devem ser gratuitos por padrão

- CNPJ fiscal adicional.
- Volume acima da franquia de documentos.
- White-label completo.
- API com alto volume.
- Armazenamento de anexos acima do fair use.
- Suporte dedicado ou implantação assistida.
- Envio oficial de WhatsApp, caso seja integrado no futuro.

## Fórmula para fechar o preço com os seus números

Para cada plano, use:

```text
Preço mínimo = (custo variável por tenant + custo fixo alocado + suporte alocado)
               / (1 - impostos - margem desejada)
```

O custo variável deve incluir tarifa Asaas, Storage/egress acima da franquia, Focus por CNPJ, mensagens pagas, processamento de documentos e qualquer custo de API. A margem desejada deve ser definida sobre a receita líquida, não sobre o preço bruto exibido.

Exemplo de controle mensal por tenant:

```text
margem_contribuição = preço recebido
                    - tarifa_gateway
                    - custo_fiscal
                    - custo_variável_de_infra
                    - suporte_variável
```

O dashboard Master precisa guardar pelo menos: plano, preço bruto, gateway utilizado, tarifa gateway, CNPJs fiscais, documentos emitidos/recebidos, bytes armazenados, chamadas de Edge Functions, tickets de suporte e custo estimado. Sem esses dados, o preço continuará baseado em percepção.

## Riscos que precisam ser corrigidos antes de alterar preços no banco

1. A landing já foi corrigida para exibir apenas Bronze, Prata e Ouro, mas cadastro, assinatura, Master e migrations ainda possuem benefícios e limites diferentes. A fonte de verdade deve ser uma única tabela de planos.
2. A cobrança de assinatura calcula descontos de 10% no semestral e 20% no anual. Esses descontos precisam ser simulados com a tarifa fixa do Asaas; no plano Bronze, o desconto reduz bastante a margem absoluta.
3. O webhook e as faturas devem registrar o valor bruto, desconto, tarifa estimada e valor líquido para o Master.
4. Fiscal não deve ser habilitado somente pelo nome do plano. Deve haver entitlement por CNPJ, franquia mensal e contador idempotente de documentos.
5. Não é seguro publicar os novos valores sem verificar custo de suporte, impostos e plano efetivo da conta Supabase/Lovable.

## Decisão sugerida

Adotar a tabela recomendada como **proposta de preço**, sem aplicar automaticamente em produção neste momento. Primeiro confirmar: quantidade atual de tenants pagantes, plano Supabase, plano Lovable, custo de suporte por tenant, regime tributário e número médio mensal de documentos fiscais. Depois disso, criar uma migration versionada e atualizar landing, cadastro, assinatura, checkout, Master e limites de uso juntos.

## Referências

[1]: https://focusnfe.com.br/precos/ "Focus NFe — preços oficiais"
[2]: https://supabase.com/pricing "Supabase — preços oficiais"
[3]: https://lovable.dev/pricing "Lovable — preços oficiais"
[4]: https://docs.lovable.dev/features/hosting "Lovable — hospedagem e publicação"
[5]: https://www.asaas.com/precos-e-taxas "Asaas — preços e taxas oficiais"
[6]: https://www.bcb.gov.br/ "Banco Central do Brasil — cotação PTAX"
