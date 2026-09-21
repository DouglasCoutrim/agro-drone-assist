# Corrigir erros ao cadastrar produtos

## Diagnóstico confirmado

- O cadastro falha com conflito de código porque o banco exige que `codigo` seja único em todo o sistema, enquanto a tela gera `P-00001`, `P-00002` etc. separadamente para cada empresa.
- Assim, a primeira empresa que usa um código impede qualquer outra empresa de reutilizar esse mesmo código, apesar de os estoques serem isolados.
- A tela também consulta o Asaas automaticamente mesmo quando a empresa está configurada para PIX manual ou sem gateway; isso gera os erros 400 independentes vistos no console.

## Alterações

1. **Corrigir a unicidade do estoque**
   - Substituir a regra global de código único por uma regra composta de empresa + código.
   - Preservar o isolamento entre empresas e permitir que cada uma tenha sua própria sequência `P-00001`, `P-00002` etc.

2. **Tornar a criação resistente a concorrência**
   - Ao abrir um novo item, continuar sugerindo o próximo código da empresa.
   - No salvamento, tratar uma eventual colisão simultânea, recalcular o próximo código e tentar novamente uma única vez.
   - Bloquear envios repetidos enquanto o cadastro estiver em andamento e apresentar uma mensagem clara se ainda houver conflito.

3. **Eliminar os erros indevidos do Asaas**
   - Consultar cobranças Asaas no painel somente quando a empresa realmente estiver configurada com esse gateway e possuir credenciais.
   - Manter PIX manual funcionando sem chamadas de cobrança externas e sem erros no console.

4. **Validar os fluxos afetados**
   - Cadastrar produtos com códigos iguais em duas empresas distintas.
   - Cadastrar produtos consecutivos na mesma empresa e testar dois envios próximos.
   - Confirmar que o estoque atual continua intacto e que PIX manual não dispara chamadas ao Asaas.
   - Verificar compilação e erros em tempo de uso.

## Detalhes técnicos

- Alteração estrutural via migração: remover `UNIQUE (codigo)` e criar `UNIQUE (organization_id, codigo)` em `itens_estoque`.
- Ajustar o salvamento em `Estoque.tsx` para reconhecer conflito `23505`, regenerar o código no escopo da empresa e repetir com segurança.
- Condicionar a consulta automática em `Index.tsx` à configuração financeira real da empresa.