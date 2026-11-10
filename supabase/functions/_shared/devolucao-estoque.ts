// Baixa o estoque de uma devolução de compra somente após a NF-e ser autorizada (uma única vez).
export async function baixarEstoqueDevolucao(admin: any, nfId: string, usuarioId: string | null = null) {
  const { data: devs } = await admin.from('devolucoes_compra')
    .update({ estoque_baixado: true }).eq('nf_id', nfId).eq('estoque_baixado', false).select('*');
  for (const d of devs || []) {
    for (const it of (d.itens || []) as any[]) {
      const qtd = Number(it.quantidade) || 0;
      if (qtd <= 0) continue;
      if (it.item_estoque_id) {
        const { data: est } = await admin.from('itens_estoque').select('quantidade')
          .eq('id', it.item_estoque_id).eq('organization_id', d.organization_id).maybeSingle();
        if (est) {
          await admin.from('itens_estoque').update({ quantidade: Number(est.quantidade) - qtd }).eq('id', it.item_estoque_id);
          await admin.from('movimentacoes_estoque').insert({
            item_id: it.item_estoque_id, organization_id: d.organization_id, quantidade: qtd, tipo: 'saida',
            motivo: 'Devolução de compra ao fornecedor', usuario_id: usuarioId ?? d.created_by,
          });
        }
      }
      const { data: nci } = await admin.from('notas_compra_itens').select('quantidade_devolvida').eq('id', it.nota_compra_item_id).maybeSingle();
      if (nci) await admin.from('notas_compra_itens').update({ quantidade_devolvida: Number(nci.quantidade_devolvida || 0) + qtd }).eq('id', it.nota_compra_item_id);
    }
  }
}
