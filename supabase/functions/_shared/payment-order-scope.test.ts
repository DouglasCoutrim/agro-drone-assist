import { describe, expect, it } from 'bun:test';
import { applyPaidReference, validateChargeReferences } from './payment-order-scope';

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
function database(owner = 'shop-a', failure = false) {
  const updates: any[] = [];
  const admin = { from(table: string) {
    const filters: Record<string, any> = {};
    let patch: any;
    const q: any = {
      select: () => q,
      eq: (k: string, v: any) => { filters[k] = v; return q; },
      update: (v: any) => { patch = v; return q; },
      maybeSingle: async () => ({ data: filters.organization_id === owner ? { id } : null, error: failure ? 'offline' : null }),
      then: (resolve: any) => { updates.push({ table, filters, patch }); resolve({ error: null }); },
    }; return q;
  } };
  return { admin, updates };
}
describe('payment references are organization scoped', () => {
  it('rejects another shop order when creating a charge', async () => {
    expect(await validateChargeReferences(database().admin, 'shop-b', { ordem_servico_id: id })).toBe(false);
  });
  it('rejects another shop quote and malformed identifiers', async () => {
    expect(await validateChargeReferences(database().admin, 'shop-b', { orcamento_id: id })).toBe(false);
    expect(await validateChargeReferences(database().admin, 'shop-a', { ordem_servico_id: '<script>' })).toBe(false);
  });
  it('allows own records and fails closed on lookup failure', async () => {
    expect(await validateChargeReferences(database().admin, 'shop-a', { ordem_servico_id: id })).toBe(true);
    expect(await validateChargeReferences(database('shop-a', true).admin, 'shop-a', { ordem_servico_id: id })).toBe(false);
  });
  it('scopes both the lookup and the order mutation', async () => {
    const d = database(); await applyPaidReference(d.admin, 'shop-a', id);
    expect(d.updates).toEqual([{ table: 'ordens_servico', filters: { id, organization_id: 'shop-a' }, patch: { status: 'entregue' } }]);
  });
  it('never mutates a foreign order and scopes the quote fallback', async () => {
    const d = database(); await applyPaidReference(d.admin, 'shop-b', id);
    expect(d.updates[0].table).toBe('orcamentos');
    expect(d.updates[0].filters.organization_id).toBe('shop-b');
  });
  it('ignores legacy references and missing organization', async () => {
    const d = database(); await applyPaidReference(d.admin, 'shop-a', 'OS-123');
    await applyPaidReference(d.admin, '', id); expect(d.updates).toEqual([]);
  });
});