# Roadmap

- [x] Verificar os oito achados atuais de monitoramento e corrigir somente problemas confirmados.
- [x] Validar abertura de vendas e janelas no celular, testar bloqueio de conversão agrupada e encerrar os oito achados. Não gravar vendas reais durante a revisão.

- [x] Criar cadastros de Fornecedores e Transportadoras com isolamento por empresa.
- [x] Organizar navegação em módulos recolhíveis e aproximar o visual das referências.
- [x] Paginar listas de registros com quantidade menor por página.
- [x] Validar novos cadastros e navegação no computador e celular.

- [x] Corrigir todos os erros de compilação que bloqueiam a publicação.
- [x] Confirmar que a prévia voltou a compilar sem erros.
- [x] Verificar as permissões atuais das funções auxiliares de RLS.
- [x] Corrigir os atalhos empresariais exibidos a administradores sem papel na empresa.
- [x] Validar e encerrar os dois achados do Project Monitoring.
- [x] Eliminar o ciclo nas regras de acesso que ocultava os dados da Volt Master.
- [x] Validar empresa, perfil, foto, ordens e indicadores com a conta afetada.
- [x] Exibir o motivo real quando o cadastro de um membro for recusado.
- [x] Garantir cadastro completo e seguro de novos membros da equipe.
- [x] Corrigir o bloqueio de origem nas consultas ao Asaas.
- [x] Permitir códigos de estoque iguais em empresas diferentes.
- [x] Evitar cadastros duplicados por envios simultâneos no estoque.
- [x] Não consultar o Asaas quando a empresa usa PIX manual ou não possui credenciais.
- [x] Permitir múltiplos papéis por usuário com acessos combinados.
- [x] Sugerir papéis e permissões a partir das responsabilidades informadas pelo gestor, com confirmação antes de aplicar.
- [x] Restaurar a logo quebrada da empresa e garantir novos uploads no armazenamento da empresa.
- [x] Permitir custo e preço de venda independentes no estoque, sem cálculo por porcentagem.
- [x] Remover o cache antigo do aplicativo sem perder a instalação pela tela inicial.
- [ ] Corrigir a tela em branco na versão publicada e validar a conexão no endereço público.
- [x] Corrigir o salvamento e a leitura de ajudantes nas ordens de serviço.
- [x] Manter ajudantes, comissões e observações internas fora da OS enviada ao cliente.
- [x] Corrigir a edição de OS com orçamento legado, preservar lançamentos existentes e confirmar remoções antes de salvar.
- [x] Remover cadastros rápidos de peças e serviços nas OS e orçamentos, preservando seleção de itens existentes.
- [x] Permitir salvar comissões de técnicos por administradores da mesma empresa, inclusive usuários com os dois papéis.

## Limpeza aprovada de funções órfãs
- [x] Remover consultas e gravações de ajudantes descontinuados da OS sem apagar históricos.
- [x] Retirar telas e indicadores legados de retenções, preservando comissões e emissão fiscal.
- [x] Excluir catálogo antigo e componentes comprovadamente sem uso.
- [x] Simplificar Configurações e eliminar controles fictícios/duplicados.
- [x] Revisar funções antigas do Mercado Livre e preservar integrações ainda usadas.
- [x] Validar testes, compilação automática e abertura das telas afetadas.

Observações da limpeza: redirecionamentos legados preservados; funções do Mercado Livre mantidas porque sua retirada do serviço não fazia parte das cinco etapas aprovadas e integrações externas não podem ser descartadas pela ausência de chamadas na interface. Históricos e funções de cálculo anteriores preservados; painel financeiro atual deixou de consultar retenções e passou a ler a comissão da OS.
