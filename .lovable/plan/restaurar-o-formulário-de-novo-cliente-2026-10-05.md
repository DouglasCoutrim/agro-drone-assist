# Restaurar o formulário de novo cliente

## Objetivo
Fazer o botão **Novo Cliente** abrir novamente o formulário completo de cadastro na tela **Clientes**.

## Diagnóstico confirmado
- O botão **Novo Cliente** está ligado ao controle de abertura da janela em `src/pages/Clientes.tsx`.
- Porém, essa janela contém apenas o botão de abertura: o conteúdo do formulário não está mais renderizado dentro dela. Por isso o clique parece não fazer nada.
- A criação rápida usada dentro de uma OS possui outro formulário e continua montada separadamente.

## Alterações
1. Recolocar na janela de **Novo Cliente** os campos já previstos pela tela: nome, telefone, e-mail, CPF/CNPJ, CEP, endereço, cidade, estado e observações.
2. Reutilizar as rotinas existentes de busca de CEP, aviso de CPF/CNPJ duplicado, validação, salvamento, cancelamento e proteção contra descarte de dados preenchidos.
3. Garantir que o mesmo conteúdo seja usado ao editar um cliente, preservando os dados atuais.
4. Validar no celular e no computador: abrir pelo botão do topo e pelo botão de lista vazia, cancelar, editar e concluir um novo cadastro.

## Detalhes técnicos
- A correção fica restrita a `src/pages/Clientes.tsx`; não exige alteração no banco.
- O formulário será inserido como `DialogContent` do `Dialog` controlado por `dialogOpen`.
- O cadastro rápido dentro da OS não será alterado nesta correção.
