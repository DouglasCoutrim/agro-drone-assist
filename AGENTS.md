# Decisões técnicas

- Logos das empresas ficam no bucket público `logos`, em pastas identificadas pela organização; leitura pública serve telas e PDFs, enquanto gravação é restrita ao administrador da própria organização.
- No estoque, `custo_unitario` e `preco_venda` são entradas independentes; importações não devem calcular margem automaticamente para preservar o preço escolhido pelo usuário.