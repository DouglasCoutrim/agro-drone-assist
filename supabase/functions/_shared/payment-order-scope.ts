// All provider references must stay inside the account that issued the charge.
export async function validateChargeReferences(admin: any, organizationId: string, refs: {
  ordem_servico_id?: string; orcamento_id?: string;
}) {
  for (const [table, id] of [['ordens_servico', refs.ordem_servico_id], ['orcamentos', refs.orcamento_id]]) {
    if (!id) continue;
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return false;
    const { data, error } = await admin.from(table).select('id')
      .eq('id', id).eq('organization_id', organizationId).maybeSingle();
    if (error || !data) return false;
  }
  return true;
}

export async function applyPaidReference(admin: any, organizationId: string, reference: unknown) {
  if (!organizationId || typeof reference !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference)) return;
  const { data: os, error } = await admin.from('ordens_servico').select('id')
    .eq('id', reference).eq('organization_id', organizationId).maybeSingle();
  if (error) throw error;
  const table = os ? 'ordens_servico' : 'orcamentos';
  const { error: updateError } = await admin.from(table)
    .update({ status: os ? 'entregue' : 'aprovado' })
    .eq('id', reference).eq('organization_id', organizationId);
  if (updateError) throw updateError;
}